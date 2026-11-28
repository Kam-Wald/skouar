export interface TItem {
  str: string
  transform: number[]
  width: number
  height: number
}

export interface TextCache {
  text: string
  starts: number[]
  items: TItem[]
}

export interface SearchMatch {
  page: number
  items?: number[]
  annotId?: string
}

export function cacheFromItems(items: TItem[]): TextCache {
  let text = ''
  const starts: number[] = []
  items.forEach((it, i) => {
    starts[i] = text.length
    text += it.str + ' '
  })
  return { text, starts, items }
}

function itemIndexAt(starts: number[], pos: number): number {
  let lo = 0
  let hi = starts.length - 1
  let idx = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= pos) {
      idx = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return idx
}

export function findMatches(cache: TextCache, q: string): { items: number[] }[] {
  const needle = q.trim().toLowerCase()
  const out: { items: number[] }[] = []
  if (!needle) return out
  const t = cache.text.toLowerCase()
  let i = t.indexOf(needle)
  while (i !== -1) {
    const idxs = new Set<number>()
    for (let c = i; c < i + needle.length; c++) idxs.add(itemIndexAt(cache.starts, c))
    out.push({ items: [...idxs] })
    i = t.indexOf(needle, i + 1)
  }
  return out
}

export function annotsMatching(annots: { id: string; page: number; text?: string }[], q: string): { id: string; page: number }[] {
  const n = q.trim().toLowerCase()
  if (!n) return []
  return annots.filter((a) => (a.text ?? '').toLowerCase().includes(n)).map((a) => ({ id: a.id, page: a.page }))
}

export function notesMatching(notes: { id: string; page: number; text: string }[], q: string): { id: string; page: number }[] {
  const n = q.trim().toLowerCase()
  if (!n) return []
  return notes.filter((x) => x.text.toLowerCase().includes(n)).map((x) => ({ id: x.id, page: x.page }))
}
