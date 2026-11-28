import type { MargeAnnotType } from './store'
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
