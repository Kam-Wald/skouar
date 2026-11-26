export interface FilterParams {
  brightness: number
  contrast: number
  saturation: number
  sepia: number
  grayscale: number
  hue: number
  blur: number
  invert: number
}

export const DEFAULT_FILTERS: FilterParams = { brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hue: 0, blur: 0, invert: 0 }

export function cssFilter(f: FilterParams): string {
  const parts: string[] = []
  if (f.brightness !== 1) parts.push(`brightness(${round2(f.brightness)})`)
  if (f.contrast !== 1) parts.push(`contrast(${round2(f.contrast)})`)
  if (f.saturation !== 1) parts.push(`saturate(${round2(f.saturation)})`)
  if (f.sepia > 0) parts.push(`sepia(${round2(f.sepia)})`)
  if (f.grayscale > 0) parts.push(`grayscale(${round2(f.grayscale)})`)
  if (f.hue !== 0) parts.push(`hue-rotate(${Math.round(f.hue)}deg)`)
  if (f.blur > 0) parts.push(`blur(${round2(f.blur)}px)`)
  if (f.invert > 0) parts.push(`invert(${round2(f.invert)})`)
  return parts.join(' ') || 'none'
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function clampRect(r: Rect, maxW: number, maxH: number): Rect {
  const w = Math.min(Math.max(8, r.w), maxW)
  const h = Math.min(Math.max(8, r.h), maxH)
  const x = Math.min(Math.max(0, r.x), maxW - w)
  const y = Math.min(Math.max(0, r.y), maxH - h)
  return { x, y, w, h }
}

export function toImageRect(sel: Rect, dispW: number, dispH: number, imgW: number, imgH: number, aspect: number | null): Rect {
  const sx = imgW / dispW
  const sy = imgH / dispH
  let r = { x: sel.x * sx, y: sel.y * sy, w: sel.w * sx, h: sel.h * sy }
  if (aspect !== null && r.w > 0) {
    r.h = r.w / aspect
    if (r.y + r.h > imgH) {
      r.h = imgH - r.y
      r.w = r.h * aspect
    }
  }
  return clampRect({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }, imgW, imgH)
}

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

export function aspectLabel(w: number, h: number): string {
  if (!w || !h) return 'libre'
  const g = gcd(w, h)
  return `${w / g}:${h / g}`
}

export const ASPECT_PRESETS: { label: string; v: number | null }[] = [
  { label: 'Libre', v: null },
  { label: '1:1', v: 1 },
  { label: '4:3', v: 4 / 3 },
  { label: '3:4', v: 3 / 4 },
  { label: '16:9', v: 16 / 9 },
  { label: '9:16', v: 9 / 16 }
]

export interface FrameParams {
  border: boolean
  borderColor: string
  borderWidth: number
  rounded: boolean
  radius: number
  vignette: boolean
  vig: number
  mat: boolean
  matColor: string
  matSize: number
  polaroid: boolean
  letterbox: boolean
  bars: number
  circle: boolean
}

export const DEFAULT_FRAME: FrameParams = {
  border: false, borderColor: '#111111', borderWidth: 8,
  rounded: false, radius: 24,
  vignette: false, vig: 0.45,
  mat: false, matColor: '#ffffff', matSize: 48,
  polaroid: false, letterbox: false, bars: 0.12, circle: false
}

export interface FrameGeom {
  W: number
  H: number
  ix: number
  iy: number
  iw: number
  ih: number
  radius: number
  circle: boolean
  bars: number
  vig: number
}

export function frameGeom(w: number, h: number, frame: FrameParams): FrameGeom {
  const side = frame.mat ? frame.matSize : 0
  const top = side
  const bottom = frame.polaroid ? side * 2.5 : side
  const bars = frame.letterbox ? Math.round(h * frame.bars) : 0
  const iw = w
  const ih = h
  return {
    W: iw + 2 * side,
    H: ih + top + bottom + 2 * bars,
    ix: side,
    iy: top + bars,
    iw,
    ih,
    radius: frame.rounded ? Math.min(frame.radius, Math.min(w, h) / 2) : 0,
    circle: frame.circle,
    bars,
    vig: frame.vignette ? frame.vig : 0
  }
}

export interface EditState {
  filter: FilterParams
  frame: FrameParams
  rot: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  crop: Rect | null
  size: { w: number; h: number } | null
}

export const DEFAULT_EDIT: EditState = { filter: { ...DEFAULT_FILTERS }, frame: { ...DEFAULT_FRAME }, rot: 0, flipH: false, flipV: false, crop: null, size: null }

export function outDims(imgW: number, imgH: number, st: EditState): { w: number; h: number } {
  const cw = st.crop ? st.crop.w : imgW
  const ch = st.crop ? st.crop.h : imgH
  const swapped = st.rot === 90 || st.rot === 270
  let w = swapped ? ch : cw
  let h = swapped ? cw : ch
  if (st.size) {
    const s = st.size.w / w
    w = st.size.w
    h = Math.max(1, Math.round(h * s))
  }
  const g = frameGeom(w, h, st.frame)
  return { w: g.W, h: g.H }
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export const EXPORT_FORMATS: { type: string; ext: string; label: string; quality: number }[] = [
  { type: 'image/png', ext: 'png', label: 'PNG (sans perte)', quality: 1 },
  { type: 'image/jpeg', ext: 'jpg', label: 'JPEG', quality: 0.92 },
  { type: 'image/webp', ext: 'webp', label: 'WebP', quality: 0.9 }
]

export function exportName(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image'
  return `${base}.${ext}`
}

export function batchName(name: string, ext: string, i: number, total: number): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image'
  const pad = String(total).length
  return `${base}-skeud-${String(i + 1).padStart(pad, '0')}.${ext}`
}

export interface FilterPreset {
  label: string
  icon: string
  filter: FilterParams
}

export const FILTER_PRESETS: FilterPreset[] = [
  { label: 'Naturel', icon: '✨', filter: { ...DEFAULT_FILTERS } },
  { label: 'Chaud', icon: '🔥', filter: { ...DEFAULT_FILTERS, brightness: 1.08, contrast: 1.05, sepia: 0.25, hue: -10 } },
  { label: 'Froid', icon: '❄️', filter: { ...DEFAULT_FILTERS, brightness: 1.05, saturation: 0.9, hue: 25 } },
  { label: 'N&B', icon: '⬛', filter: { ...DEFAULT_FILTERS, grayscale: 1, contrast: 1.1 } },
  { label: 'Sépia', icon: '📜', filter: { ...DEFAULT_FILTERS, sepia: 0.7, contrast: 0.95 } },
  { label: 'Vintage', icon: '📻', filter: { ...DEFAULT_FILTERS, sepia: 0.4, contrast: 0.9, brightness: 1.05 } },
  { label: 'Dramatique', icon: '🎭', filter: { ...DEFAULT_FILTERS, contrast: 1.35, saturation: 1.15, brightness: 0.95 } },
  { label: 'Doux', icon: '🌫️', filter: { ...DEFAULT_FILTERS, brightness: 1.1, contrast: 0.85, saturation: 0.85, blur: 0.6 } },
  { label: 'Éclatant', icon: '🌈', filter: { ...DEFAULT_FILTERS, saturation: 1.5, contrast: 1.1 } },
  { label: 'Rétro', icon: '📼', filter: { ...DEFAULT_FILTERS, sepia: 0.5, hue: -25, contrast: 1.1, saturation: 0.8 } }
]

export interface FramePreset {
  id: string
  label: string
  icon: string
  hint: string
  frame: FrameParams
  filter?: FilterParams
}

const F = (o: Partial<FrameParams>): FrameParams => ({ ...DEFAULT_FRAME, ...o })

export const FRAME_PRESETS: FramePreset[] = [
  { id: 'none', label: 'Aucun', icon: '⬜', hint: 'Image telle quelle', frame: F({}) },
  { id: 'border-white', label: 'Filet blanc', icon: '▭', hint: 'Bordure = fine ligne collée SUR le bord de l’image', frame: F({ border: true, borderColor: '#ffffff', borderWidth: 8 }) },
  { id: 'border-black', label: 'Filet noir', icon: '▬', hint: 'Ligne noire fine sur le bord', frame: F({ border: true, borderColor: '#111111', borderWidth: 8 }) },
  { id: 'border-accent', label: 'Filet accent', icon: '🟪', hint: 'Ligne couleur primaire', frame: F({ border: true, borderColor: '#4f46e5', borderWidth: 12 }) },
  { id: 'border-thick', label: 'Cadre épais', icon: '🟥', hint: 'Grosse bordure noire', frame: F({ border: true, borderColor: '#111111', borderWidth: 28 }) },
  { id: 'rounded-soft', label: 'Coins doux', icon: '◻️', hint: 'Coins arrondis 24 px', frame: F({ rounded: true, radius: 24 }) },
  { id: 'rounded-strong', label: 'Coins forts', icon: '🔲', hint: 'Coins arrondis 80 px', frame: F({ rounded: true, radius: 80 }) },
  { id: 'rounded-pill', label: 'Pilule', icon: '💊', hint: 'Coins au maximum (ovale)', frame: F({ rounded: true, radius: 9999 }) },
  { id: 'vignette-soft', label: 'Vignette douce', icon: '🌑', hint: 'Assombrissement léger des bords', frame: F({ vignette: true, vig: 0.3 }) },
  { id: 'vignette-strong', label: 'Vignette forte', icon: '⚫', hint: 'Bords bien assombris', frame: F({ vignette: true, vig: 0.7 }) },
  { id: 'mat-white', label: 'Passe-partout blanc', icon: '🖼️', hint: 'Passe-partout = MARGE autour de l’image (façon encadré)', frame: F({ mat: true, matColor: '#ffffff', matSize: 48 }) },
  { id: 'mat-cream', label: 'Passe-partout crème', icon: '🟨', hint: 'Marge crème, style ancien', frame: F({ mat: true, matColor: '#f5f0e6', matSize: 64 }) },
  { id: 'mat-black', label: 'Passe-partout noir', icon: '⬛', hint: 'Marge noire, galerie', frame: F({ mat: true, matColor: '#111111', matSize: 48 }) },
  { id: 'polaroid', label: 'Polaroid', icon: '📸', hint: 'Marge blanche épaisse en bas, façon photo instantanée', frame: F({ mat: true, matColor: '#ffffff', matSize: 36, polaroid: true }) },
  { id: 'letterbox', label: 'Cinémascope', icon: '🎬', hint: 'Bandes noires haut/bas (16:9 → 2.35:1)', frame: F({ letterbox: true, bars: 0.12 }) },
  { id: 'circle', label: 'Cercle', icon: '⭕', hint: 'Image découpée en disque', frame: F({ circle: true }) },
  { id: 'frame-rounded', label: 'Cadre + coins', icon: '🪞', hint: 'Bordure noire + coins arrondis', frame: F({ border: true, borderColor: '#111111', borderWidth: 10, rounded: true, radius: 32 }) },
  { id: 'mat-border', label: 'Encastré', icon: '🗃️', hint: 'Marge blanche + filet intérieur', frame: F({ mat: true, matColor: '#ffffff', matSize: 40, border: true, borderColor: '#111111', borderWidth: 4 }) },
  { id: 'vintage-frame', label: 'Vintage', icon: '🕰️', hint: 'Sépia + vignette + filet crème', frame: F({ vignette: true, vig: 0.4, border: true, borderColor: '#f5f0e6', borderWidth: 6 }), filter: { ...DEFAULT_FILTERS, sepia: 0.45, contrast: 0.95, brightness: 1.05 } },
  { id: 'noir-dramatique', label: 'Noir dramatique', icon: '🎞️', hint: 'N&B + contraste + vignette', frame: F({ vignette: true, vig: 0.55 }), filter: { ...DEFAULT_FILTERS, grayscale: 1, contrast: 1.3, brightness: 0.95 } }
]

export const framePresetOf = (frame: FrameParams): FramePreset | undefined =>
  FRAME_PRESETS.find((p) => JSON.stringify(p.frame) === JSON.stringify(frame))
