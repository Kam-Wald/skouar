// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
if (typeof Blob !== 'undefined' && !(Blob.prototype as unknown as { arrayBuffer?: unknown }).arrayBuffer) {
  ;(Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = function (this: Blob) {
    const self = this
    return new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as ArrayBuffer)
      fr.onerror = () => rej(fr.error)
      fr.readAsArrayBuffer(self)
    })
  }
}
if (typeof Blob !== 'undefined' && !(Blob.prototype as unknown as { stream?: unknown }).stream) {
  ;(Blob.prototype as unknown as { stream: () => ReadableStream }).stream = function (this: Blob) {
    const self = this
    return new ReadableStream({
      start(controller) {
        const fr = new FileReader()
        fr.onload = () => {
          controller.enqueue(new Uint8Array(fr.result as ArrayBuffer))
          controller.close()
        }
        fr.onerror = () => controller.error(fr.error)
        fr.readAsArrayBuffer(self)
      }
    })
  }
}
import { APP_DB_MAP, createAppDb, deleteDatabaseSafe, kvOf } from '../src/shared/db'
import { apps } from '../src/apps/registry'
import { snapshotBeforeImport, exportBackup, importBackup } from '../src/shared/backup'

const APPS_WITH_DB = ['karneto', 'skrid', 'ler', 'skeud', 'kod', 'cockpit', 'taol', 'fichorama', 'salveto']

describe('sécurité des données (non-régression)', () => {
  it('APP_DB_MAP : le nommage réel de la base de Karneto est « skouar » et chaque app à base est couverte', () => {
    expect(APP_DB_MAP.karneto).toBe('skouar')
    for (const a of apps) {
      if (APPS_WITH_DB.includes(a.id)) expect(APP_DB_MAP[a.id], `app ${a.id}`).toBeTruthy()
    }
    for (const id of APPS_WITH_DB) expect(APP_DB_MAP[id], `map ${id}`).toBeTruthy()
  })

  it('deleteDatabaseSafe supprime réellement (connexions fermées, pas de résolution sur onblocked)', async () => {
    const db = createAppDb('skouar-test-safe', [{ version: 1, stores: { t: 'id' } }])
    await db.table('t').put({ id: 'x' })
    const ok = await deleteDatabaseSafe('skouar-test-safe')
    expect(ok).toBe(true)
    const dbs = await indexedDB.databases()
    expect(dbs.map((d) => d.name)).not.toContain('skouar-test-safe')
  })

  it('kvOf persiste réellement quel que soit le keyPath de la table kv (« key » ou « id »)', async () => {
    for (const spec of ['key', 'id']) {
      const name = `skouar-test-kv-${spec}`
      const db = createAppDb(name, [{ version: 1, stores: { kv: spec } }])
      const kv = kvOf(db)
      await kv.saveKV('config', { a: 1 })
      const back = await kv.loadKV<{ a: number }>('config')
      expect(back, `keyPath ${spec}`).toEqual({ a: 1 })
      const all = await db.table('kv').toArray()
      expect(all.length, `keyPath ${spec}`).toBe(1)
      await deleteDatabaseSafe(name)
    }
  })

  it('snapshotBeforeImport enregistre un snapshot restaurable en localStorage', async () => {
    localStorage.setItem('skouar:theme', 'dark')
    const how = await snapshotBeforeImport()
    expect(how).toBe('localStorage')
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('skouar:preImport:'))
    expect(keys.length).toBeGreaterThanOrEqual(1)
    const snap = JSON.parse(localStorage.getItem(keys[0])!) as { localStorage: Record<string, string> }
    expect(snap.localStorage['skouar:theme']).toBe('dark')
  })

  it('export → import conserve les enregistrements (roundtrip ZIP)', async () => {
    const db = createAppDb('skouar-test-rt', [{ version: 1, stores: { items: 'id' } }])
    await db.table('items').put({ id: 'a1', name: 'lapin' })
    localStorage.setItem('skouar:test-rt', 'valeur œuf')
    const zip = await exportBackup()
    await deleteDatabaseSafe('skouar-test-rt')
    localStorage.removeItem('skouar:test-rt')
    const r = await importBackup(zip)
    expect(r.dbs).toBeGreaterThanOrEqual(1)
    expect(localStorage.getItem('skouar:test-rt')).toBe('valeur œuf')
    const db2 = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('skouar-test-rt')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    const val = await new Promise<unknown>((res, rej) => {
      const tx = db2.transaction('items', 'readonly')
      const rq = tx.objectStore('items').get('a1')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    expect((val as { name: string }).name).toBe('lapin')
    db2.close()
    await deleteDatabaseSafe('skouar-test-rt')
  })
})
