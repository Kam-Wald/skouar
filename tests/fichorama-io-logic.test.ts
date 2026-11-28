// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

if (typeof Blob !== 'undefined' && !(Blob.prototype as unknown as { arrayBuffer?: unknown }).arrayBuffer) {
  ;(Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = function (this: Blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as ArrayBuffer)
      fr.onerror = () => rej(fr.error)
      fr.readAsArrayBuffer(this)
    })
  }
}

import { db, kv, listCategories, listSheets, seedDefaultCategories, type Category, type Sheet } from '../src/apps/fichorama/store'
import { makeSheet, saveSheet } from '../src/apps/fichorama/sheets'
import { backupFileName, exportData, importData, IO_VERSION, parseBackup } from '../src/apps/fichorama/io'

const reset = async (): Promise<void> => {
  await db.table<Sheet, string>('sheets').clear()
  await db.table<Category, string>('categories').clear()
  await kv.saveKV('seeded', false)
}

const cat = (id: string, name: string): Category => ({
  id,
  name,
  fields: [{ id: 'f1', label: 'Réalisateur', type: 'texte' }],
  removedFields: [],
  createdAt: 1
})

describe('fichorama — export/import JSON (CDC §10, logique)', () => {
  beforeEach(async () => {
    await reset()
  })

  it('exportData → parseBackup : round-trip complet, image Blob sérialisée en base64 puis restituée', async () => {
    const c = cat('c1', 'Films')
    await db.table<Category, string>('categories').put(c)
    const img = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const s = { ...makeSheet('c1', 'Dune', 9, { f1: 'Villeneuve' }, 'super', true, img), createdAt: 5, updatedAt: 6 }
    await saveSheet(s)

    const json = await exportData([c], [s])
    const parsed = JSON.parse(json)
    expect(parsed.app).toBe('fichorama')
    expect(parsed.version).toBe(IO_VERSION)
    expect(parsed.sheets[0].image).toEqual({ __blob: true, type: 'image/png', b64: expect.any(String) })

    const back = await parseBackup(json)
    expect(back.categories.length).toBe(1)
    expect(back.sheets.length).toBe(1)
    expect(back.sheets[0].title).toBe('Dune')
    expect(back.sheets[0].values).toEqual({ f1: 'Villeneuve' })
    const b = back.sheets[0].image
    expect(b).toBeInstanceOf(Blob)
    expect((b as Blob).type).toBe('image/png')
    const buf = new Uint8Array(await (b as Blob).arrayBuffer())
    expect(Array.from(buf)).toEqual([137, 80, 78, 71])
    expect(backupFileName(new Date('2026-11-28T10:00:00Z'))).toBe('fichorama-sauvegarde-2026-11-28.json')
  })

  it('parseBackup : rejets clairs (JSON illisible, mauvaise app, version, note hors bornes, champ invalide, image invalide)', async () => {
    await expect(parseBackup('pas du json')).rejects.toThrow('JSON illisible')
    await expect(parseBackup(JSON.stringify({ app: 'unvez' }))).rejects.toThrow('pas une sauvegarde Fichorama')
    await expect(parseBackup(JSON.stringify({ app: 'fichorama', version: 99, categories: [], sheets: [] }))).rejects.toThrow('Version non supportée')
    const base = { app: 'fichorama', version: 1, categories: [cat('c1', 'Films')], sheets: [] }
    await expect(parseBackup(JSON.stringify({ ...base, sheets: [{ id: 's1', categoryId: 'c1', title: 'X', note: 11, notes: [], fav: false, comment: '', image: null, values: {}, createdAt: 1, updatedAt: 1 }] }))).rejects.toThrow('note hors 0–10')
    await expect(
      parseBackup(JSON.stringify({ ...base, categories: [{ ...cat('c1', 'Films'), fields: [{ id: 'f', label: 'L', type: 'emoji' }] }] }))
    ).rejects.toThrow('type de champ inconnu')
    await expect(
      parseBackup(JSON.stringify({ ...base, sheets: [{ id: 's1', categoryId: 'c1', title: 'X', note: 5, notes: [], fav: false, comment: '', image: 'data:image/png;base64,xx', values: {}, createdAt: 1, updatedAt: 1 }] }))
    ).rejects.toThrow('image mal formée')
  })

  it('importData fusion : met à jour par id, ajoute les nouveaux, garde le reste', async () => {
    const c = cat('c1', 'Films')
    await db.table<Category, string>('categories').put(c)
    const a = makeSheet('c1', 'Dune', 5, {}, '', false, null)
    const keep = makeSheet('c1', 'Arrival', 7, {}, '', false, null)
    await saveSheet(a)
    await saveSheet(keep)

    const imported: Sheet = { ...a, note: 9, notes: [...a.notes, { value: 9, date: 99 }] }
    const added = makeSheet('c1', 'Blade Runner', 8, {}, '', false, null)
    const json = await exportData([c], [imported, added])
    const r = await importData(json, 'fusion')
    expect(r).toEqual({ categories: 1, sheets: 2 })

    const sheets = await listSheets()
    expect(sheets.length).toBe(3)
    const a2 = sheets.find((s) => s.id === a.id)!
    expect(a2.note).toBe(9)
    expect(a2.notes.length).toBe(2)
    expect(sheets.some((s) => s.id === keep.id)).toBe(true)
    expect((await listCategories()).length).toBe(1)
  })

  it('importData remplacer : base supprimée via deleteDatabaseSafe puis rechargée, seed non rejoué', async () => {
    await seedDefaultCategories()
    await saveSheet(makeSheet((await listCategories())[0].id, 'Dune', 9, {}, '', false, null))
    expect((await listSheets()).length).toBe(1)
    expect((await listCategories()).length).toBe(9)

    const c2 = cat('cx', 'Concerts')
    const s2 = makeSheet('cx', 'Live', 6, {}, '', false, null)
    const json = await exportData([c2], [s2])
    const r = await importData(json, 'remplacer')
    expect(r.sheets).toBe(1)

    expect((await listSheets()).map((s) => s.title)).toEqual(['Live'])
    expect((await listCategories()).map((c) => c.name)).toEqual(['Concerts'])
    await seedDefaultCategories()
    expect((await listCategories()).length).toBe(1)
    await saveSheet(makeSheet('cx', 'Live 2', 4, {}, '', false, null))
    expect((await listSheets()).length).toBe(2)
  })
})
