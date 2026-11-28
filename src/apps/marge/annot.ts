import type { MargeAnnot, MargeAnnotType } from './store'
export const COLORS = ['#ffd54a', '#7ee081', '#7ec8ff', '#ff9ecb', '#ff8a5c']
export const STAMPS = ['✅ Lu', '⏳ À faire', '❌ Refusé', '⭐ Important']
export const TEXT_SIZES = [12, 16, 22]

export type Tool = 'select' | 'hl' | 'ink' | 'arrow' | 'circle' | 'text' | 'stamp' | 'note' | 'sign'

export const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: '👆', label: 'Sélection', key: '1' },
  { id: 'hl', icon: '🖍️', label: 'Surligner', key: '2' },
  { id: 'ink', icon: '✏️', label: 'Dessin', key: '3' },
  { id: 'arrow', icon: '➡️', label: 'Flèche', key: '4' },
  { id: 'circle', icon: '⭕', label: 'Cercle', key: '5' },
  { id: 'text', icon: '🔤', label: 'Texte', key: '6' },
  { id: 'stamp', icon: '✅', label: 'Tampon', key: '7' },
  { id: 'note', icon: '📝', label: 'Note', key: '8' },
  { id: 'sign', icon: '✍️', label: 'Signature', key: '9' }
]

export function iconOf(t: MargeAnnotType): string {
  switch (t) {
    case 'hl':
      return '🖍️'
    case 'ink':
      return '✏️'
    case 'arrow':
      return '➡️'
    case 'circle':
      return '⭕'
    case 'text':
      return '🔤'
    case 'stamp':
      return '✅'
    case 'note':
      return '📝'
    case 'sign':
      return '✍️'
  }
}

export function normRect(x0: number, y0: number, x: number, y: number): [number, number, number, number] {
  return [Math.min(x0, x), Math.min(y0, y), Math.abs(x - x0), Math.abs(y - y0)]
}

export function mergeRectsByLine(rects: [number, number, number, number][]): [number, number, number, number][] {
  const byY = new Map<number, [number, number, number, number]>()
  for (const [x, y, w, h] of rects) {
    const key = Math.round(y / 3)
    const prev = byY.get(key)
    if (prev) byY.set(key, [Math.min(prev[0], x), y, Math.max(prev[0] + prev[2], x + w) - Math.min(prev[0], x), h])
    else byY.set(key, [x, y, w, h])
  }
  return [...byY.values()]
}

export interface HistAction {
  kind: 'add' | 'delete' | 'move' | 'edit'
  before?: MargeAnnot
  after?: MargeAnnot
}

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function hitAnnotPdf(a: MargeAnnot, px: number, py: number, tol = 6): boolean {
  if (a.type === 'hl') {
    const rects =
      a.rects ?? (a.x !== undefined && a.w !== undefined ? [[a.x, a.y ?? 0, a.w, a.h ?? 0] as [number, number, number, number]] : [])
    return rects.some(([x, y, w, h]) => px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol)
  }
  if (a.type === 'ink' && a.points && a.points.length > 1) {
    for (let i = 0; i < a.points.length - 1; i++) {
      if (segDist(px, py, a.points[i][0], a.points[i][1], a.points[i + 1][0], a.points[i + 1][1]) <= tol) return true
    }
    return false
  }
  if (a.type === 'arrow' && a.x !== undefined && a.x2 !== undefined) {
    return segDist(px, py, a.x, a.y ?? 0, a.x2, a.y2 ?? 0) <= tol
  }
  if ((a.type === 'circle' || a.type === 'sign') && a.x !== undefined && a.w !== undefined) {
    const rx = a.w / 2 + tol
    const ry = (a.h ?? 0) / 2 + tol
    const ex = (px - (a.x + a.w / 2)) / rx
    const ey = (py - ((a.y ?? 0) + (a.h ?? 0) / 2)) / ry
    return ex * ex + ey * ey <= 1
  }
  return false
}

export function shiftAnnot(a: MargeAnnot, dx: number, dy: number): MargeAnnot {
  const b: MargeAnnot = { ...a }
  if (a.x !== undefined) b.x = a.x + dx
  if (a.y !== undefined) b.y = a.y + dy
  if (a.x2 !== undefined) b.x2 = a.x2 + dx
  if (a.y2 !== undefined) b.y2 = a.y2 + dy
  if (a.rects) b.rects = a.rects.map(([x, y, w, h]) => [x + dx, y + dy, w, h] as [number, number, number, number])
  if (a.points) b.points = a.points.map(([x, y]) => [x + dx, y + dy] as [number, number])
  return b
}
