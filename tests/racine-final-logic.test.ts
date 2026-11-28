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

import { db, emptyProfile, getProfile, kv, listEvents, listRefs, makeEvent, saveEvent, type Attachment, type HealthEvent, type RefEntity } from '../src/apps/racine/store'
import { addEvent } from '../src/apps/racine/events'
import { backupFileName, exportData, importData, parseBackup } from '../src/apps/racine/io'
import { ficheMedecinData, genFicheMedecinPDF, pdfText, rapportMensuel } from '../src/apps/racine/rapports'

const DAY = 86400000

describe('racine — rapports + export/import (CDC §13/§17, logique)', () => {
  beforeEach(async () => {
    await db.table('events').clear()
    await db.table('refs').clear()
    await db.table('attachments').clear()
    await db.table('profile').clear()
    await kv.saveKV('questions', [])
  })

  it('backupFileName : salveto-sauvegarde-<date>.json (CDC §17.A)', () => {
    expect(backupFileName(new Date('2026-11-28T10:00:00Z'))).toBe('salveto-sauvegarde-2026-11-28.json')
  })

  it('rapportMensuel : compte/ moyennes du mois courant', () => {
    const now = Date.now()
    const events: HealthEvent[] = [
      makeEvent('crise', now, { intensity: 7 }),
      makeEvent('moral', now, { level: 4 }),
      makeEvent('moral', now - DAY, { level: 2 }),
      makeEvent('energie', now, { level: 5 }),
      makeEvent('sommeil', now, { coucher: '23:00', reveil: '07:00', qualite: 3 }),
      makeEvent('note', now - 40 * DAY, {})
    ]
    const r = rapportMensuel(events, now)
    expect(r.nbCrises).toBe(1)
    expect(r.avgMoral).toBe(3)
    expect(r.avgEnergie).toBe(5)
    expect(r.avgSommeil).toBe(3)
    expect(r.joursSaisis).toBe(2)
    expect(r.totalEntrees).toBe(5)
    expect(r.label.length).toBeGreaterThan(3)
  })

  it('ficheMedecinData : depuis = dernier RDV passé, crises/symptômes filtrés, traitements agrégés', async () => {
    const now = Date.now()
    await addEvent('rdv', { date: now - 10 * DAY, praticien: 'Dr House' }, '', now - 10 * DAY)
    await addEvent('crise', { intensity: 8 }, 'grosse crise', now - 2 * DAY)
    await addEvent('crise', { intensity: 9 }, 'vieille crise', now - 30 * DAY)
    await addEvent('symptome', { type: 'fièvre', intensite: 6 }, '', now)
    const ref: RefEntity = { id: 't1', kind: 'traitement', name: 'Magnésium', unit: '', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: 1 }
    await db.table('refs').put(ref)
    await addEvent('traitement', { refId: 't1', name: 'Magnésium', effet: 'marque' }, '', now)
    const f = ficheMedecinData(emptyProfile(), await listEvents(), await listRefs(), ['Q1 ?'], now)
    expect(f.depuis).toBeLessThanOrEqual(now - 9 * DAY)
    expect(f.crises.length).toBe(1)
    expect(f.crises[0].note).toBe('grosse crise')
    expect(f.symptomes.length).toBe(1)
    expect(f.traitements[0]).toEqual({ name: 'Magnésium', score: 2, counts: { marque: 1 } })
    expect(f.questions).toEqual(['Q1 ?'])
  })

  it('pdfText : assainit les caractères hors WinAnsi ; genFicheMedecinPDF produit un vrai PDF', async () => {
    expect(pdfText('l’été — « ok » … 🚨')).toBe('l\'été - " ok " ... ')
    const now = Date.now()
    await addEvent('moral', { level: 4 }, 'bonne journée', now)
    const f = ficheMedecinData({ ...emptyProfile(), allergies: 'Pénicilline', groupeSanguin: 'O+' }, await listEvents(), [], ['Et si ?'], now)
    const bytes = await genFicheMedecinPDF(f)
    const head = new TextDecoder().decode(bytes.slice(0, 5))
    expect(head).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(500)
  })

  it('exportData → parseBackup : round-trip avec pièce jointe base64, option sans PJ', async () => {
    const now = Date.now()
    const e = makeEvent('moral', now, { level: 5 }, 'super')
    await saveEvent(e)
    const att: Attachment = {
      id: 'a1',
      name: 'ord.pdf',
      mime: 'application/pdf',
      size: 4,
      blob: new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' }),
      eventId: null,
      createdAt: now
    }
    await db.table('attachments').put(att)
    const refs = await listRefs()
    const json = await exportData([e], refs, emptyProfile(), [att], ['Q ?'], true)
    const parsed = JSON.parse(json)
    expect(parsed.app).toBe('racine')
    expect(parsed.attachments[0].blob.__blob).toBe(true)
    const back = await parseBackup(json)
    expect(back.events.length).toBe(1)
    expect(back.attachments[0].blob).toBeInstanceOf(Blob)
    expect(new Uint8Array(await back.attachments[0].blob.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]))
    const light = await exportData([e], refs, emptyProfile(), [att], [], false)
    expect(JSON.parse(light).attachments).toEqual([])
  })

  it('parseBackup : rejets clairs', async () => {
    await expect(parseBackup('nope')).rejects.toThrow('JSON illisible')
    await expect(parseBackup(JSON.stringify({ app: 'unvez' }))).rejects.toThrow('pas une sauvegarde Racine')
    await expect(parseBackup(JSON.stringify({ app: 'racine', version: 99, events: [], refs: [], profile: emptyProfile(), attachments: [], questions: [] }))).rejects.toThrow('Version non supportée')
    const base = { app: 'racine', version: 1, events: [{ id: 'x', type: 'alien', date: 1, payload: {}, note: '', createdAt: 1, updatedAt: 1 }], refs: [], profile: emptyProfile(), attachments: [], questions: [] }
    await expect(parseBackup(JSON.stringify(base))).rejects.toThrow('événement mal formé')
  })

  it('importData fusion / remplacer', async () => {
    const now = Date.now()
    const a = makeEvent('moral', now, { level: 2 }, 'avant')
    await saveEvent(a)
    const b = makeEvent('note', now, {}, 'importée')
    const aUp = { ...a, note: 'modifiée' }
    const json = await exportData([aUp, b], [], emptyProfile(), [], [], false)
    const r1 = await importData(json, 'fusion')
    expect(r1.events).toBe(2)
    let all = await listEvents()
    expect(all.length).toBe(2)
    expect(all.find((e) => e.id === a.id)?.note).toBe('modifiée')
    const c = makeEvent('poids', now, { kg: 70 }, 'seule')
    const json2 = await exportData([c], [], emptyProfile(), [], [], false)
    await importData(json2, 'remplacer')
    all = await listEvents()
    expect(all.map((e) => e.id)).toEqual([c.id])
    expect((await getProfile()).id).toBe('profile')
  })
})
