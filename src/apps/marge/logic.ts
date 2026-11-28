export function relTime(ts: number, now = Date.now()): string {
  const s = Math.floor((now - ts) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(ts).toLocaleDateString('fr-FR')
}

export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '-')
}

export function parseRanges(input: string, max: number): number[] {
  const out = new Set<number>()
  for (const part of input.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) continue
    const a = Math.min(max, Math.max(1, Number(m[1])))
    const b = Math.min(max, Math.max(a, Number(m[2] ?? m[1])))
    for (let i = a; i <= b; i++) out.add(i)
  }
  return [...out].sort((x, y) => x - y)
}

export function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

export type SortMode = 'date' | 'titre' | 'pages'

export function filterDocs<T extends { title: string }>(docs: T[], q: string): T[] {
  const n = q.trim().toLowerCase()
  if (!n) return docs
  return docs.filter((d) => d.title.toLowerCase().includes(n))
}

export function sortDocs<T extends { title: string; updatedAt: number; pages: number }>(docs: T[], mode: SortMode): T[] {
  const c = [...docs]
  if (mode === 'titre') c.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  else if (mode === 'pages') c.sort((a, b) => b.pages - a.pages)
  else c.sort((a, b) => b.updatedAt - a.updatedAt)
  return c
}

export function progressOf(d: { pages: number; lastPage?: number }): number {
  if (!d.lastPage || d.pages <= 0) return 0
  return Math.min(1, Math.max(0, d.lastPage / d.pages))
}

export function duplicateTitle(t: string): string {
  return `Copie de ${t}`
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
