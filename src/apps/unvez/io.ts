import type Dexie from 'dexie'
import type { Folder, Memo, UnvezSettings } from './store'

export const IO_VERSION = 1

export interface UnvezBackup {
  app: 'unvez'
  version: number
  exportedAt: number
  memos: Memo[]
  folders: Folder[]
  settings: Partial<UnvezSettings>
}

export function exportData(memos: Memo[], folders: Folder[], settings: Partial<UnvezSettings>): string {
  const { tape: _tape, ...rest } = settings
  const data: UnvezBackup = { app: 'unvez', version: IO_VERSION, exportedAt: Date.now(), memos, folders, settings: rest }
  return JSON.stringify(data, null, 2)
}

export function parseBackup(json: string): UnvezBackup {
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    throw new Error('JSON illisible')
  }
  const b = v as Partial<UnvezBackup> | null
  if (!b || typeof b !== 'object' || b.app !== 'unvez' || !Array.isArray(b.memos) || !Array.isArray(b.folders)) {
    throw new Error('Fichier non reconnu : pas une sauvegarde Unvez')
  }
  for (const m of b.memos) {
    if (!m || typeof m !== 'object' || typeof (m as Memo).id !== 'string' || typeof (m as Memo).name !== 'string' || typeof (m as Memo).result !== 'string') {
      throw new Error('Sauvegarde invalide : mémo mal formé')
    }
  }
  for (const f of b.folders) {
    if (!f || typeof f !== 'object' || typeof (f as Folder).id !== 'string' || typeof (f as Folder).name !== 'string') {
      throw new Error('Sauvegarde invalide : dossier mal formé')
    }
  }
  return b as UnvezBackup
}

export async function importData(db: Dexie, json: string): Promise<{ memos: number; folders: number }> {
  const b = parseBackup(json)
  await db.table<Memo, string>('memos').clear()
  await db.table<Folder, string>('folders').clear()
  if (b.memos.length) await db.table<Memo, string>('memos').bulkPut(b.memos)
  if (b.folders.length) await db.table<Folder, string>('folders').bulkPut(b.folders)
  return { memos: b.memos.length, folders: b.folders.length }
}

export function backupFileName(d = new Date()): string {
  return `unvez-sauvegarde-${d.toISOString().slice(0, 10)}.json`
}
