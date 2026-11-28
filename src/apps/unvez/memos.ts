import type Dexie from 'dexie'
import type { Folder, Memo } from './store'

export async function listMemos(db: Dexie): Promise<Memo[]> {
  const all = await db.table<Memo, string>('memos').toArray()
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function listFolders(db: Dexie): Promise<Folder[]> {
  const all = await db.table<Folder, string>('folders').toArray()
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveMemo(db: Dexie, m: Memo): Promise<void> {
  await db.table<Memo, string>('memos').put(m)
}

export async function deleteMemo(db: Dexie, id: string): Promise<void> {
  await db.table<Memo, string>('memos').delete(id)
}

export async function saveFolder(db: Dexie, f: Folder): Promise<void> {
  await db.table<Folder, string>('folders').put(f)
}

export async function removeFolder(db: Dexie, id: string): Promise<void> {
  await db
    .table<Memo, string>('memos')
    .filter((m) => m.folderId === id)
    .modify({ folderId: null })
  await db.table<Folder, string>('folders').delete(id)
}

export async function moveMemo(db: Dexie, memoId: string, folderId: string | null): Promise<void> {
  await db.table<Memo, string>('memos').update(memoId, { folderId, updatedAt: Date.now() })
}

export function searchMemos(memos: Memo[], q: string): Memo[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return memos
  return memos.filter((m) => `${m.name} ${m.note} ${m.expr} ${m.input} ${m.result}`.toLowerCase().includes(needle))
}
