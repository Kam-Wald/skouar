export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'code'
  | 'divider'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'file'
  | 'archive'
  | 'toggle'
  | 'columns'
  | 'column'
  | 'toc'
  | 'button'
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
  createdAt?: number
}

export type ViewType =
  | 'table'
  | 'board'
  | 'gallery'
  | 'calendar'
  | 'list'
  | 'timeline'
  | 'feed'
  | 'chart'

export interface Database {
  id: string
  title: string
  columns: Column[]
  rows: Row[]
  view?: ViewType
  groupBy?: string
  chartAgg?: 'count' | 'sum'
}

export interface Cover {
  kind: 'color' | 'pattern' | 'url' | 'file'
  value: string
}

export interface Block {
  id: string
  type: BlockType
  text: string
  done?: boolean
  src?: string
  href?: string
  fileName?: string
  fileSize?: number
  cols?: number
  db?: Database
  children?: Block[]
}

export interface Page {
  id: string
  title: string
  blocks: Block[]
  updatedAt: number
  parentId?: string | null
  icon?: string | null
  iconColor?: string | null
  cover?: Cover | null
}

export interface BlocsState {
  pages: Page[]
  currentPageId: string | null
}
