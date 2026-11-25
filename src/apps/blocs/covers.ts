import type { CSSProperties } from 'react'

export interface CoverDef {
  kind: 'color' | 'pattern' | 'url' | 'file'
  value: string
}

export const COVER_COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#1e293b', '#e2e8f0'
]

const BASE = '#312e81'
const W = 'rgba(255,255,255,0.16)'
const W2 = 'rgba(255,255,255,0.28)'

export interface PatternDef {
  id: string
  name: string
  image: string
  size?: string
  position?: string
}

export const COVER_PATTERNS: PatternDef[] = [
  { id: 'diag', name: 'Rayures diagonales', image: `repeating-linear-gradient(45deg, ${W} 0 6px, transparent 6px 14px)` },
  { id: 'diag-fine', name: 'Diagonales fines', image: `repeating-linear-gradient(45deg, ${W} 0 2px, transparent 2px 10px)` },
  { id: 'vert', name: 'Rayures verticales', image: `repeating-linear-gradient(90deg, ${W} 0 6px, transparent 6px 14px)` },
  { id: 'horiz', name: 'Rayures horizontales', image: `repeating-linear-gradient(0deg, ${W} 0 6px, transparent 6px 14px)` },
  { id: 'croix', name: 'Croix', image: `repeating-linear-gradient(0deg, ${W} 0 2px, transparent 2px 12px), repeating-linear-gradient(90deg, ${W} 0 2px, transparent 2px 12px)` },
  { id: 'points', name: 'Petits points', image: `radial-gradient(${W2} 2px, transparent 2.5px)`, size: '18px 18px' },
  { id: 'gros-points', name: 'Gros points', image: `radial-gradient(${W2} 4px, transparent 4.5px)`, size: '26px 26px' },
  { id: 'pois-decal', name: 'Pois décalés', image: `radial-gradient(${W} 3px, transparent 3.5px), radial-gradient(${W} 3px, transparent 3.5px)`, size: '24px 24px', position: '0 0, 12px 12px' },
  { id: 'grille', name: 'Grille', image: `linear-gradient(${W} 1px, transparent 1px), linear-gradient(90deg, ${W} 1px, transparent 1px)`, size: '20px 20px' },
  { id: 'damier', name: 'Damier', image: `repeating-conic-gradient(${W} 0% 25%, transparent 0% 50%)`, size: '28px 28px' },
  { id: 'zigzag', name: 'Zigzag', image: `linear-gradient(135deg, ${W} 25%, transparent 25%), linear-gradient(225deg, ${W} 25%, transparent 25%), linear-gradient(45deg, ${W} 25%, transparent 25%), linear-gradient(315deg, ${W} 25%, transparent 25%)`, size: '24px 24px', position: '12px 0, 12px 0, 0 0, 0 0' },
  { id: 'losanges', name: 'Losanges', image: `repeating-linear-gradient(45deg, ${W} 0 2px, transparent 2px 16px), repeating-linear-gradient(-45deg, ${W} 0 2px, transparent 2px 16px)` },
  { id: 'vagues', name: 'Vagues', image: `radial-gradient(circle at 10px -5px, transparent 12px, ${W} 13px, transparent 14px)`, size: '24px 24px' },
  { id: 'cercles', name: 'Cercles concentriques', image: `repeating-radial-gradient(circle at 50% 50%, ${W} 0 2px, transparent 2px 12px)` },
  { id: 'soleil', name: 'Rayons de soleil', image: `repeating-conic-gradient(from 0deg at 50% 50%, ${W} 0deg 10deg, transparent 10deg 24deg)` },
  { id: 'briques', name: 'Briques', image: `linear-gradient(${W} 2px, transparent 2px), linear-gradient(90deg, ${W} 2px, transparent 2px), linear-gradient(90deg, transparent 50%, ${W} 50% 52%, transparent 52%)`, size: '32px 16px, 32px 16px, 32px 32px' },
  { id: 'confettis', name: 'Confettis', image: `radial-gradient(${W2} 2px, transparent 2.5px), radial-gradient(${W} 2px, transparent 2.5px), radial-gradient(${W} 1.5px, transparent 2px)`, size: '34px 34px, 50px 50px, 26px 26px', position: '0 0, 17px 23px, 9px 13px' },
  { id: 'vichy', name: 'Vichy', image: `repeating-conic-gradient(${W} 0% 25%, transparent 0% 50%)`, size: '16px 16px' },
  { id: 'etoiles', name: 'Étoiles', image: `radial-gradient(${W2} 1.5px, transparent 2px), linear-gradient(${W} 1px, transparent 1px), linear-gradient(90deg, ${W} 1px, transparent 1px)`, size: '30px 30px' },
  { id: 'chevrons', name: 'Chevrons', image: `linear-gradient(135deg, ${W} 25%, transparent 25%), linear-gradient(225deg, ${W} 25%, transparent 25%), linear-gradient(315deg, ${W} 25%, transparent 25%), linear-gradient(45deg, ${W} 25%, transparent 25%)`, size: '24px 24px', position: '-12px 0, -12px 0, 0 0, 0 0' }
]

export function coverStyle(cover: CoverDef | null | undefined): CSSProperties {
  if (!cover) return {}
  if (cover.kind === 'color') return { backgroundColor: cover.value }
  if (cover.kind === 'url' || cover.kind === 'file') return {}
  const [id, hex] = cover.value.split('|')
  const p = COVER_PATTERNS.find((x) => x.id === id)
  if (!p) return { backgroundColor: hex || BASE }
  const style: CSSProperties = { backgroundColor: hex || BASE, backgroundImage: p.image }
  if (p.size) style.backgroundSize = p.size
  if (p.position) style.backgroundPosition = p.position
  return style
}
