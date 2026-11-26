import Dexie, { type Table } from 'dexie'

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

class LerDb extends Dexie {
  pdfs!: Table<LerFile, string>
  annots!: Table<LerAnnot, string>
  constructor() {
    super('skouar-ler')
    this.version(1).stores({ pdfs: 'id,title,updatedAt', annots: 'id,fileId,page' })
  }
}

export const db = new LerDb()

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export async function listFiles(): Promise<LerFile[]> {
  return db.pdfs.orderBy('updatedAt').reverse().toArray()
}

export async function addFile(f: LerFile): Promise<void> {
  await db.pdfs.put(f)
}

export async function updateFile(id: string, patch: Partial<LerFile>): Promise<void> {
  await db.pdfs.update(id, patch)
}

export async function restoreFile(f: LerFile, annots: LerAnnot[]): Promise<void> {
  await db.pdfs.put(f)
  await db.annots.bulkPut(annots)
}

export async function deleteFile(id: string): Promise<void> {
  await db.annots.where('fileId').equals(id).delete()
  await db.pdfs.delete(id)
}

export async function listAnnots(fileId: string): Promise<LerAnnot[]> {
  return db.annots.where('fileId').equals(fileId).toArray()
}

export async function putAnnot(a: LerAnnot): Promise<void> {
  await db.annots.put(a)
}

export async function deleteAnnot(id: string): Promise<void> {
  await db.annots.delete(id)
}
