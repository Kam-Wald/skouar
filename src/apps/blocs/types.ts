export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'todo'
  | 'bullet'
  | 'database'

export type PropType = 'text' | 'number' | 'select' | 'date' | 'checkbox'

export interface Column {
  id: string
  name: string
  type: PropType
  options?: string[]
}

export type CellValue = string | number | boolean | null

export interface Row {
  id: string
  cells: Record<string, CellValue>
}

export type ViewType = 'table' | 'board' | 'gallery' | 'calendar'

export interface Database {
  id: string
  title: string
  columns: Column[]
  rows: Row[]
  view?: ViewType
  groupBy?: string
}

export interface Block {
  id: string
  type: BlockType
  text: string
  done?: boolean
  db?: Database
}

export interface Page {
  id: string
  title: string
  blocks: Block[]
  updatedAt: number
}

export interface BlocsState {
  pages: Page[]
  currentPageId: string | null
}
