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
  | 'callout'
  | 'embed'
  | 'math'
  | 'progress'
  | 'qr'
  | 'countdown'
  | 'gallery'
  | 'pageembed'
  | 'database'

export type PropType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'status'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'location'
  | 'id'
  | 'created'
  | 'edited'

export interface Column {
  id: string
  name: string
  type: PropType
  options?: string[]
  formula?: string
  relationDbId?: string
  rollupColId?: string
  rollupAgg?: 'count' | 'sum' | 'avg' | 'min' | 'max'
}

export type CellValue = string | number | boolean | string[] | null

export interface Row {
  id: string
  cells: Record<string, CellValue>
  createdAt?: number
  updatedAt?: number
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
  | 'map'
  | 'gantt'

export type AggType = 'count' | 'countAll' | 'sum' | 'avg' | 'min' | 'max' | 'checked'

export interface Database {
  id: string
  title: string
  columns: Column[]
  rows: Row[]
  view?: ViewType
  groupBy?: string
  chartAgg?: 'count' | 'sum'
  aggs?: Record<string, AggType>
  ganttStart?: string
  ganttEnd?: string
}

export interface Cover {
  kind: 'color' | 'pattern' | 'url' | 'file'
  value: string
}

export interface BlockAction {
  repeatBlockId: string
  count: number
}

export interface Block {
  id: string
  type: BlockType
  text: string
  done?: boolean
  due?: string | null
  notified?: boolean
  src?: string
  srcs?: string[]
  href?: string
  fileName?: string
  fileSize?: number
  cols?: number
  color?: string
  progress?: number
  pageId?: string
  action?: BlockAction
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
  tags?: string[]
  deletedAt?: number | null
  lastOpened?: number
}

export interface BlocsState {
  pages: Page[]
  currentPageId: string | null
}
