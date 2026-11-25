export type BlockType = 'paragraph' | 'h1' | 'h2' | 'todo' | 'bullet'

export interface Block {
  id: string
  type: BlockType
  text: string
  done?: boolean
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
