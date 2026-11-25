import type { Block } from './types'

export function flattenBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b) => [b, ...(b.children ? flattenBlocks(b.children) : [])])
}

export function findBlock(blocks: Block[], id: string): Block | undefined {
  for (const b of blocks) {
    if (b.id === id) return b
    if (b.children) {
      const f = findBlock(b.children, id)
      if (f) return f
    }
  }
  return undefined
}

export function patchBlock(
  blocks: Block[],
  id: string,
  patch: Partial<Block>
): Block[] {
  return blocks.map((b) =>
    b.id === id
      ? { ...b, ...patch }
      : b.children
        ? { ...b, children: patchBlock(b.children, id, patch) }
        : b
  )
}

export function insertAfter(
  blocks: Block[],
  afterId: string,
  nb: Block
): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const children = b.children ? insertAfter(b.children, afterId, nb) : undefined
    out.push(children ? { ...b, children } : b)
    if (b.id === afterId) out.push(nb)
  }
  return out
}

export function deleteFrom(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => (b.children ? { ...b, children: deleteFrom(b.children, id) } : b))
}
