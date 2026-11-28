import { createAppDb, uid } from '../../shared/db'
import { duplicateTitle } from './logic'
export { uid }

export interface MargeDoc {
  id: string
  title: string
  data: Blob
  pages: number
  updatedAt: number
  lastPage?: number
  rotation?: number
  folderId?: string
}

export type MargeAnnotType = 'hl' | 'ink' | 'note' | 'text' | 'sign' | 'arrow' | 'circle' | 'stamp'

export interface MargeAnnot {
  id: string
  docId: string
  page: number
  type: MargeAnnotType
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

export interface MargePageNote {
  id: string
  docId: string
  page: number
  text: string
  at: number
}

export interface MargeFolder {
  id: string
  name: string
  icon: string
  color: string
  at: number
}

export interface MargeSignature {
  id: string
  name: string
  dataUrl: string
  at: number
}

export const db = createAppDb('skouar-marge', [
  {
    version: 1,
    stores: {
      kv: 'key',
      docs: 'id, title, folderId, updatedAt',
      annots: 'id, docId, page',
      pageNotes: 'id, docId, page',
      folders: 'id, name',
      signatures: 'id, name'
    }
  }
])

type MargeDocRow = Omit<MargeDoc, 'data'> & { data: ArrayBuffer }

const toRow = async (d: MargeDoc): Promise<MargeDocRow> => ({ ...d, data: await d.data.arrayBuffer() })
const toDoc = (r: MargeDocRow): MargeDoc => ({ ...r, data: new Blob([r.data], { type: 'application/pdf' }) })

export const docsT = db.table<MargeDocRow, string>('docs')
export const annotsT = db.table<MargeAnnot, string>('annots')
export const pageNotesT = db.table<MargePageNote, string>('pageNotes')
export const foldersT = db.table<MargeFolder, string>('folders')
export const signaturesT = db.table<MargeSignature, string>('signatures')

export async function listDocs(): Promise<MargeDoc[]> {
  return (await docsT.orderBy('updatedAt').reverse().toArray()).map(toDoc)
}

export async function addDoc(d: MargeDoc): Promise<void> {
  await docsT.put(await toRow(d))
}

export async function updateDoc(id: string, patch: Partial<Omit<MargeDoc, 'data'>>): Promise<void> {
  await docsT.update(id, patch)
}

export async function listAnnots(docId: string): Promise<MargeAnnot[]> {
  return annotsT.where('docId').equals(docId).toArray()
}

export async function listPageNotes(docId: string): Promise<MargePageNote[]> {
  return pageNotesT.where('docId').equals(docId).toArray()
}

export async function restoreDoc(doc: MargeDoc, annots: MargeAnnot[], notes: MargePageNote[]): Promise<void> {
  await docsT.put(await toRow(doc))
  await annotsT.bulkPut(annots)
  await pageNotesT.bulkPut(notes)
}

export async function deleteDoc(id: string): Promise<void> {
  await annotsT.where('docId').equals(id).delete()
  await pageNotesT.where('docId').equals(id).delete()
  await docsT.delete(id)
}

export async function listFolders(): Promise<MargeFolder[]> {
  const all = await foldersT.toArray()
  return all.sort((a, b) => a.at - b.at)
}

export async function addFolder(f: MargeFolder): Promise<void> {
  await foldersT.put(f)
}

export async function deleteFolderCascade(id: string): Promise<void> {
  await docsT.where('folderId').equals(id).modify({ folderId: undefined })
  await foldersT.delete(id)
}

export async function setDocFolder(docId: string, folderId: string | null): Promise<void> {
  await docsT
    .where('id')
    .equals(docId)
    .modify({ folderId: folderId ?? undefined, updatedAt: Date.now() })
}

export async function duplicateDoc(d: MargeDoc): Promise<MargeDoc> {
  const copy: MargeDoc = {
    ...d,
    id: uid(),
    title: duplicateTitle(d.title),
    updatedAt: Date.now(),
    lastPage: undefined,
    folderId: d.folderId
  }
  await addDoc(copy)
  return copy
}
