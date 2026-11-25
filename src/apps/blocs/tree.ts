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

export function removeFrom(
  blocks: Block[],
  id: string
): { blocks: Block[]; removed: Block | null } {
  let removed: Block | null = null
  const walk = (arr: Block[]): Block[] =>
    arr.flatMap((b) => {
      if (b.id === id) {
        removed = b
        return []
      }
      if (b.children) return [{ ...b, children: walk(b.children) }]
      return [b]
    })
  return { blocks: walk(blocks), removed }
}

export function insertAt(
  blocks: Block[],
  targetId: string,
  nb: Block,
  after: boolean
): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const children = b.children ? insertAt(b.children, targetId, nb, after) : undefined
    const bb = children ? { ...b, children } : b
    if (b.id === targetId && !after) out.push(nb)
    out.push(bb)
    if (b.id === targetId && after) out.push(nb)
  }
  return out
}

export function moveBlockInTree(
  blocks: Block[],
  id: string,
  targetId: string,
  after: boolean
): Block[] {
  if (id === targetId) return blocks
  const { blocks: without, removed } = removeFrom(blocks, id)
  if (!removed) return blocks
  return insertAt(without, targetId, removed, after)
}
