import { zipFiles, unzipFiles, entryText } from '../apps/kod/zip'
import { deleteDatabaseSafe } from './db'

const LS_PREFIX = 'skouar:'
const PREIMPORT_PREFIX = 'skouar:preImport:'

const b64encode = (buf: ArrayBufferLike): string => {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const b64decode = (b64: string): Uint8Array => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function dumpAll(): Promise<{ localStorage: Record<string, string>; idb: Record<string, unknown> }> {
  const ls: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(LS_PREFIX)) ls[k] = localStorage.getItem(k) ?? ''
  }
  const idb: Record<string, unknown> = {}
  if (!('indexedDB' in window)) return { localStorage: ls, idb }
  const dbs = await indexedDB.databases()
  for (const d of dbs) {
    if (!d.name) continue
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(d.name!)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const stores: Record<string, unknown> = {}
    for (const sn of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(sn, 'readonly')
      const os = tx.objectStore(sn)
      const keys = await new Promise<IDBValidKey[]>((res, rej) => {
        const r = os.getAllKeys()
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const vals = await new Promise<unknown[]>((res, rej) => {
        const r = os.getAll()
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      stores[sn] = {
        keyPath: os.keyPath,
        autoIncrement: os.autoIncrement,
        records: await Promise.all(vals.map(async (v, i) => [keys[i], await serializeValueAsync(v)] as [IDBValidKey, unknown]))
      }
    }
    idb[d.name] = stores
    db.close()
  }
  return { localStorage: ls, idb }
}

const serializeValueAsync = async (v: unknown): Promise<unknown> => {
  if (v instanceof Blob) return { __blob: true, type: v.type, b64: b64encode(await v.arrayBuffer()) }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = await serializeValueAsync(val)
    return out
  }
  if (Array.isArray(v)) {
    const out: unknown[] = []
    for (const item of v) out.push(await serializeValueAsync(item))
    return out
  }
  return v
}

const deserializeValueAsync = async (v: unknown): Promise<unknown> => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    if (o.__blob === true && typeof o.b64 === 'string') return new Blob([b64decode(o.b64) as BlobPart], { type: String(o.type ?? 'application/octet-stream') })
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) out[k] = await deserializeValueAsync(val)
    return out
  }
  if (Array.isArray(v)) {
    const out: unknown[] = []
    for (const item of v) out.push(await deserializeValueAsync(item))
    return out
  }
  return v
}

export async function exportBackup(): Promise<Blob> {
  const data = await dumpAll()
  return zipFiles([
    { name: 'localStorage.json', data: JSON.stringify(data.localStorage) },
    { name: 'idb.json', data: JSON.stringify(data.idb) }
  ])
}

export async function snapshotBeforeImport(): Promise<'localStorage' | 'download'> {
  const data = await dumpAll()
  const json = JSON.stringify(data)
  const ts = Date.now()
  if (json.length < 3_500_000) {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREIMPORT_PREFIX)).sort()
    for (const k of keys.slice(0, Math.max(0, keys.length - 1))) localStorage.removeItem(k)
    localStorage.setItem(`${PREIMPORT_PREFIX}${ts}`, json)
    return 'localStorage'
  }
  const zip = await zipFiles([
    { name: 'localStorage.json', data: JSON.stringify(data.localStorage) },
    { name: 'idb.json', data: json }
  ])
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined') {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zip)
    a.download = `skouar-avant-import-${new Date(ts).toISOString().replace(/[:T]/g, '-').slice(0, 16)}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  return 'download'
}

export async function importBackup(zip: Blob): Promise<{ ls: number; dbs: number }> {
  const entries = await unzipFiles(zip)
  const lsEntry = entries.find((e) => e.name === 'localStorage.json')
  let ls = 0
  if (lsEntry) {
    const parsed = JSON.parse(entryText(lsEntry)) as Record<string, string>
    for (const [k, v] of Object.entries(parsed)) {
      if (k.startsWith(LS_PREFIX)) {
        localStorage.setItem(k, v)
        ls++
      }
    }
  }
  const idbEntry = entries.find((e) => e.name === 'idb.json')
  let dbs = 0
  if (idbEntry && 'indexedDB' in window) {
    const parsed = JSON.parse(entryText(idbEntry)) as Record<string, Record<string, { keyPath: IDBValidKey | null; autoIncrement: boolean; records: [IDBValidKey, unknown][] }>>
    for (const [dbName, stores] of Object.entries(parsed)) {
      const deleted = await deleteDatabaseSafe(dbName)
      if (!deleted) {
        throw new Error(`suppression de « ${dbName} » bloquée (connexion ouverte) — import interrompu, données actuelles intactes`)
      }
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(dbName, 1)
        r.onupgradeneeded = () => {
          const d = r.result
          for (const [sn, meta] of Object.entries(stores)) {
            if (!d.objectStoreNames.contains(sn)) d.createObjectStore(sn, { keyPath: (meta.keyPath ?? undefined) as string | string[] | null | undefined, autoIncrement: meta.autoIncrement })
          }
        }
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      for (const [sn, meta] of Object.entries(stores)) {
        const tx = db.transaction(sn, 'readwrite')
        const os = tx.objectStore(sn)
        for (const [key, val] of meta.records) {
          const v = await deserializeValueAsync(val)
          if (meta.keyPath == null) os.put(v, key)
          else os.put(v)
        }
        await new Promise<void>((res, rej) => {
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })
      }
      db.close()
      dbs++
    }
  }
  return { ls, dbs }
}
