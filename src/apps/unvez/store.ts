import { createAppDb, kvOf } from '../../shared/db'

export const db = createAppDb('skouar-unvez', [
  { version: 1, stores: { kv: 'id', memos: 'id', folders: 'id' } }
])

export const kv = kvOf(db)

export interface UnvezSettings {
  decimals: number
  sci: boolean
  cook: 'us' | 'metric'
  lastFamily: string | null
  lastFrom: string | null
  lastTo: string | null
  recentPairs: string[]
  favPairs: string[]
  tape: string[]
}

export const DEFAULT_SETTINGS: UnvezSettings = {
  decimals: 6,
  sci: true,
  cook: 'metric',
  lastFamily: null,
  lastFrom: null,
  lastTo: null,
  recentPairs: [],
  favPairs: [],
  tape: []
}

export interface Memo {
  id: string
  name: string
  note: string
  folderId: string | null
  bg: string | null
  kind: 'calc' | 'conv'
  expr: string
  fromUnit: string | null
  toUnit: string | null
  input: string
  result: string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  icon: string
  color: string
  createdAt: number
}
