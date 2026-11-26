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

export type FrameKind = 'none' | 'border' | 'rounded' | 'vignette' | 'mat'

export interface FrameParams {
  kind: FrameKind
  color: string
  width: number
  radius: number
  mat: number
}

export const DEFAULT_FRAME: FrameParams = { kind: 'none', color: '#ffffff', width: 12, radius: 24, mat: 48 }

export const FRAMES: { kind: FrameKind; label: string; icon: string }[] = [
  { kind: 'none', label: 'Aucun', icon: '⬜' },
  { kind: 'border', label: 'Bordure', icon: '🟫' },
  { kind: 'rounded', label: 'Coins arrondis', icon: '⬜' },
  { kind: 'vignette', label: 'Vignette', icon: '🌑' },
  { kind: 'mat', label: 'Passe-partout', icon: '🖼️' }
]

export interface FrameGeom {
  W: number
  H: number
  ix: number
  iy: number
  iw: number
  ih: number
  radius: number
}

export function frameGeom(w: number, h: number, frame: FrameParams): FrameGeom {
  const mat = frame.kind === 'mat' ? frame.mat : 0
  const bw = frame.kind === 'border' ? frame.width : 0
  return {
    W: w + 2 * mat,
    H: h + 2 * mat,
    ix: mat + bw,
    iy: mat + bw,
    iw: w - 2 * bw,
    ih: h - 2 * bw,
    radius: frame.kind === 'rounded' ? Math.min(frame.radius, Math.min(w, h) / 2) : 0
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
