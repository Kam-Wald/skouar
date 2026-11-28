import { createAppDb, uid } from '../../shared/db'
export { uid }

export interface MargeDoc {
  id: string
  title: string
  data: Blob
  pages: number
  updatedAt: number
  lastPage?: number
  rotation?: number
  folderId?: string | null
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
