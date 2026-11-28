import Dexie from 'dexie'

export const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export interface KVRow {
  id?: string
  key?: string
  value: unknown
}

export function kvOf(db: Dexie): {
  loadKV: <T>(id: string) => Promise<T | undefined>
  saveKV: (id: string, value: unknown) => Promise<void>
} {
  const t = () => db.table<KVRow, string>('kv')
  return {
    loadKV: async <T,>(id: string): Promise<T | undefined> => ((await t().get(id))?.value) as T | undefined,
    saveKV: async (id: string, value: unknown): Promise<void> => {
      const keyPath = (t().schema.primKey.keyPath as string | undefined) ?? 'id'
      await t().put(keyPath === 'key' ? { key: id, value } : { id, value })
    }
  }
}

export function createAppDb(name: string, versions: { version: number; stores: Record<string, string> }[]): Dexie {
  const db = new Dexie(name)
  for (const v of versions) db.version(v.version).stores(v.stores)
  registerDb(db)
  return db
}

const openDbs: Dexie[] = []

export function registerDb(db: Dexie): void {
  if (!openDbs.includes(db)) openDbs.push(db)
}

export function closeAllDbs(): void {
  for (const d of openDbs) {
    try {
      d.close()
    } catch {
      // ignore
    }
  }
}

export function deleteDatabaseSafe(name: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(false)
    closeAllDbs()
    let done = false
    const finish = (ok: boolean): void => {
      if (!done) {
        done = true
        resolve(ok)
      }
    }
    try {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => finish(true)
      req.onerror = () => finish(false)
      req.onblocked = () => setTimeout(() => finish(false), timeoutMs)
      setTimeout(() => finish(false), timeoutMs + 1000)
    } catch {
      finish(false)
    }
  })
}

export const APP_DB_MAP: Record<string, string> = {
  karneto: 'skouar',
  skrid: 'skouar-skrid',
  ler: 'skouar-ler',
  skeud: 'skouar-skeud',
  kod: 'skouar-kod',
  cockpit: 'skouar-cockpit',
  taol: 'skouar-taol',
  fichorama: 'skouar-fichorama',
  salveto: 'skouar-salveto'
}
