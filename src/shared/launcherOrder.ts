const KEY = 'skouar:launcher:order'

export function loadLauncherOrder(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveLauncherOrder(order: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(order))
}

export function resetLauncherOrder(): void {
  localStorage.removeItem(KEY)
}

export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]))
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (rank.get(a.it.id) ?? 1e9 + a.i) - (rank.get(b.it.id) ?? 1e9 + b.i))
    .map((x) => x.it)
}

export function moveId(ids: string[], dragId: string, beforeId: string | null): string[] {
  const from = ids.indexOf(dragId)
  if (from < 0) return ids
  let to = beforeId ? ids.indexOf(beforeId) : ids.length
  if (to < 0) to = ids.length
  const next = [...ids]
  next.splice(from, 1)
  if (from < to) to -= 1
  next.splice(to, 0, dragId)
  return next
}
