import { createAppDb, uid } from '../../shared/db'
export { uid }
import type { Table } from 'dexie'

export interface LerFile {
  id: string
  title: string
  data: Blob
  pages: number
  updatedAt: number
  lastPage?: number
  rotation?: number
}

export type AnnType = 'hl' | 'ink' | 'note' | 'text' | 'sign' | 'arrow' | 'circle' | 'stamp'

export interface LerAnnot {
  id: string
  fileId: string
  page: number
  type: AnnType
  x?: number
  y?: number
  w?: number
  h?: number
  x2?: number
  y2?: number
  rects?: [number, number, number, number][]
  points?: [number, number][]
  color: string
  text?: string
  size?: number
  dataUrl?: string
  at: number
}

export const db = createAppDb('skouar-ler', [{ version: 1, stores: { pdfs: 'id,title,updatedAt', annots: 'id,fileId,page' } }])
export const pdfs = db.table<LerFile, string>('pdfs')
export const annotsT = db.table<LerAnnot, string>('annots')


export async function listFiles(): Promise<LerFile[]> {
  return pdfs.orderBy('updatedAt').reverse().toArray()
}

export async function addFile(f: LerFile): Promise<void> {
  await pdfs.put(f)
}

export async function updateFile(id: string, patch: Partial<LerFile>): Promise<void> {
  await pdfs.update(id, patch)
}

export async function restoreFile(f: LerFile, annots: LerAnnot[]): Promise<void> {
  await pdfs.put(f)
  await annotsT.bulkPut(annots)
}

export async function deleteFile(id: string): Promise<void> {
  await annotsT.where('fileId').equals(id).delete()
  await pdfs.delete(id)
}

export async function listAnnots(fileId: string): Promise<LerAnnot[]> {
  return annotsT.where('fileId').equals(fileId).toArray()
}

export async function putAnnot(a: LerAnnot): Promise<void> {
  await annotsT.put(a)
}

export async function deleteAnnot(id: string): Promise<void> {
  await annotsT.delete(id)
}
