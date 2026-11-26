import Dexie from 'dexie'

export const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export interface KVRow {
  id: string
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
      await t().put({ id, value })
    }
  }
}

export function createAppDb(name: string, versions: { version: number; stores: Record<string, string> }[]): Dexie {
  const db = new Dexie(name)
  for (const v of versions) db.version(v.version).stores(v.stores)
  return db
}
