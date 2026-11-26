import { EMBEDDED_FONTS } from '../../shared/fonts'
export interface FilterParams {
  brightness: number
  contrast: number
  saturation: number
  sepia: number
  grayscale: number
  hue: number
  blur: number
  invert: number
  temp: number
  sharpen: number
}

export const DEFAULT_FILTERS: FilterParams = { brightness: 1, contrast: 1, saturation: 1, sepia: 0, grayscale: 0, hue: 0, blur: 0, invert: 0, temp: 0, sharpen: 0 }

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
  if (f.temp > 0) {
    parts.push(`sepia(${round2((f.temp / 100) * 0.35)})`)
    parts.push(`hue-rotate(${Math.round(-f.temp / 4)}deg)`)
  } else if (f.temp < 0) {
    parts.push(`hue-rotate(${Math.round(-f.temp / 3)}deg)`)
    parts.push(`saturate(${round2(1 + f.temp / 250)})`)
  }
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
  double: boolean
  torn: boolean
  burnt: boolean
  tape: boolean
  corners: boolean
  cornerColor: string
  sketch: boolean
  stamp: boolean
  stampColor: string
  film: boolean
  shadow: boolean
  neon: boolean
  neonColor: string
  wood: boolean
  gold: boolean
  lace: boolean
  splatter: boolean
  splatColor: string
  scan: boolean
}

export const DEFAULT_FRAME: FrameParams = {
  border: false, borderColor: '#111111', borderWidth: 8,
  rounded: false, radius: 24,
  vignette: false, vig: 0.45,
  mat: false, matColor: '#ffffff', matSize: 48,
  polaroid: false, letterbox: false, bars: 0.12, circle: false, double: false, torn: false, burnt: false,
  tape: false, corners: false, cornerColor: '#f3e2b3', sketch: false,
  stamp: false, stampColor: '#f6efe2', film: false, shadow: false,
  neon: false, neonColor: '#39ffd8', wood: false, gold: false, lace: false,
  splatter: false, splatColor: '#1a1a2e', scan: false
}

export interface FrameMargins {
  side: number
  top: number
  bottom: number
  edge: number
}

export function frameMargins(w: number, h: number, frame: FrameParams): FrameMargins {
  const edge = frame.torn || frame.burnt ? Math.max(10, Math.round(Math.min(w, h) * 0.04)) : 0
  const mat = frame.mat ? frame.matSize : 0
  let side = mat + edge
  let top = side
  let bottom = (frame.polaroid ? mat * 2.5 : mat) + edge
  if (frame.stamp) {
    const m = Math.max(16, Math.round(Math.min(w, h) * 0.06))
    side += m
    top += m
    bottom += m
  }
  if (frame.lace) {
    const m = Math.max(12, Math.round(Math.min(w, h) * 0.045))
    side += m
    top += m
    bottom += m
  }
  if (frame.shadow) {
    side += 26
    top += 22
    bottom += 34
  }
  if (frame.film) {
    side += Math.max(22, Math.round(h * 0.09))
    top += 8
    bottom += 8
  }
  return { side, top, bottom, edge }
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
  edge: number
}

export function frameGeom(w: number, h: number, frame: FrameParams): FrameGeom {
  const m = frameMargins(w, h, frame)
  const bars = frame.letterbox ? Math.round(h * frame.bars) : 0
  const iw = w
  const ih = h
  return {
    W: iw + 2 * m.side,
    H: ih + m.top + m.bottom + 2 * bars,
    ix: m.side,
    iy: m.top + bars,
    iw,
    ih,
    radius: frame.rounded ? Math.min(frame.radius, Math.min(w, h) / 2) : 0,
    circle: frame.circle,
    bars,
    vig: frame.vignette ? frame.vig : 0,
    edge: m.edge
  }
}

export interface TextLayer {
  id: string
  kind: 'text'
  text: string
  x: number
  y: number
  font: string
  size: number
  color: string
  bg: string
  bgOpacity: number
  lineHeight: number
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
}

export interface StickerLayer {
  id: string
  kind: 'sticker'
  emoji: string
  x: number
  y: number
  size: number
}

export type Layer = TextLayer | StickerLayer

export interface EditState {
  filter: FilterParams
  frame: FrameParams
  rot: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  crop: Rect | null
  size: { w: number; h: number } | null
  layers: Layer[]
}

export const DEFAULT_EDIT: EditState = { filter: { ...DEFAULT_FILTERS }, frame: { ...DEFAULT_FRAME }, rot: 0, flipH: false, flipV: false, crop: null, size: null, layers: [] }

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
  { label: 'Rétro', icon: '📼', filter: { ...DEFAULT_FILTERS, sepia: 0.5, hue: -25, contrast: 1.1, saturation: 0.8 } },
  { label: 'Coucher de soleil', icon: '🌇', filter: { ...DEFAULT_FILTERS, sepia: 0.45, hue: -35, saturation: 1.4, contrast: 1.12, brightness: 1.02 } },
  { label: 'Menthe', icon: '🌿', filter: { ...DEFAULT_FILTERS, hue: 110, saturation: 0.75, brightness: 1.06 } },
  { label: 'Lavande', icon: '💜', filter: { ...DEFAULT_FILTERS, hue: 265, saturation: 0.65, brightness: 1.07 } },
  { label: 'Glacier', icon: '🧊', filter: { ...DEFAULT_FILTERS, hue: 185, saturation: 0.55, brightness: 1.12, contrast: 0.95 } },
  { label: 'Négatif', icon: '🔃', filter: { ...DEFAULT_FILTERS, invert: 1 } },
  { label: 'Flou artistique', icon: '🎨', filter: { ...DEFAULT_FILTERS, blur: 3, contrast: 0.9, saturation: 0.9 } },
  { label: 'Pastel', icon: '🍦', filter: { ...DEFAULT_FILTERS, saturation: 0.5, brightness: 1.12, contrast: 0.92 } },
  { label: 'Photo ancienne', icon: '🪞', filter: { ...DEFAULT_FILTERS, sepia: 0.85, contrast: 0.85, brightness: 1.05, blur: 0.4 } },
  { label: 'Noir & or', icon: '🏅', filter: { ...DEFAULT_FILTERS, grayscale: 1, sepia: 0.3, contrast: 1.4, brightness: 1.02 } },
  { label: 'Néon', icon: '💡', filter: { ...DEFAULT_FILTERS, saturation: 2, contrast: 1.25, brightness: 1.06, hue: 300 } }
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
  { id: 'border', label: 'Filet', icon: '▭', hint: 'Ligne SUR le bord — couleur et épaisseur réglables à côté', frame: F({ border: true, borderColor: '#111111', borderWidth: 8 }) },
  { id: 'double', label: 'Double cadre décalé', icon: '🪟', hint: 'Deux filets décalés, effet galerie', frame: F({ border: true, borderColor: '#111111', borderWidth: 6, double: true }) },
  { id: 'rounded', label: 'Coins arrondis', icon: '◻️', hint: 'Rayon réglable à côté (9999 = pilule)', frame: F({ rounded: true, radius: 32 }) },
  { id: 'vignette', label: 'Vignette', icon: '🌑', hint: 'Bords assombris — intensité réglable', frame: F({ vignette: true, vig: 0.45 }) },
  { id: 'mat', label: 'Passe-partout', icon: '🖼️', hint: 'MARGE autour de l’image — couleur et taille réglables', frame: F({ mat: true, matColor: '#ffffff', matSize: 48 }) },
  { id: 'polaroid', label: 'Polaroid', icon: '📸', hint: 'Marge blanche épaisse en bas', frame: F({ mat: true, matColor: '#ffffff', matSize: 36, polaroid: true }) },
  { id: 'letterbox', label: 'Cinémascope', icon: '🎬', hint: 'Bandes noires haut/bas', frame: F({ letterbox: true, bars: 0.12 }) },
  { id: 'circle', label: 'Cercle', icon: '⭕', hint: 'Image en disque', frame: F({ circle: true }) },
  { id: 'torn', label: 'Papier déchiré', icon: '📄', hint: 'Bord déchiqueté façon papier arraché', frame: F({ torn: true }) },
  { id: 'burnt', label: 'Papier brûlé', icon: '🕯️', hint: 'Bord brûlé, cendré', frame: F({ burnt: true }) },
  { id: 'mat-border', label: 'Encastré', icon: '🗃️', hint: 'Marge + filet intérieur', frame: F({ mat: true, matColor: '#ffffff', matSize: 40, border: true, borderColor: '#111111', borderWidth: 4 }) },
  { id: 'vintage-frame', label: 'Vintage', icon: '🕰️', hint: 'Sépia + vignette + filet crème', frame: F({ vignette: true, vig: 0.4, border: true, borderColor: '#f5f0e6', borderWidth: 6 }), filter: { ...DEFAULT_FILTERS, sepia: 0.45, contrast: 0.95, brightness: 1.05 } },
  { id: 'noir-dramatique', label: 'Noir dramatique', icon: '🎞️', hint: 'N&B + contraste + vignette', frame: F({ vignette: true, vig: 0.55 }), filter: { ...DEFAULT_FILTERS, grayscale: 1, contrast: 1.3, brightness: 0.95 } }
,
  { id: 'tape', label: 'Ruban adhésif', icon: '🖇️', hint: 'Morceaux de scotch aux 4 coins', frame: F({ tape: true }) },
  { id: 'corners', label: 'Coins photo', icon: '📐', hint: 'Triangles d’album aux coins', frame: F({ corners: true, cornerColor: '#f3e2b3' }) },
  { id: 'sketch', label: 'Griffonné', icon: '✏️', hint: 'Contour dessiné à main levée', frame: F({ sketch: true, borderColor: '#222222' }) },
  { id: 'stamp', label: 'Timbre postal', icon: '💌', hint: 'Marge couleur + perforations', frame: F({ stamp: true, stampColor: '#f6efe2' }) },
  { id: 'film', label: 'Pellicule 35 mm', icon: '🎞️', hint: 'Bandes noires + perforations latérales', frame: F({ film: true }) },
  { id: 'shadow', label: 'Ombre portée', icon: '🌑', hint: 'Ombre douce sous la photo', frame: F({ shadow: true }) },
  { id: 'neon', label: 'Néon', icon: '💡', hint: 'Lueur colorée sur fond sombre', frame: F({ neon: true, neonColor: '#39ffd8' }) },
  { id: 'wood', label: 'Cadre bois', icon: '🪵', hint: 'Anneau en dégradé bois', frame: F({ wood: true, borderWidth: 26 }) },
  { id: 'gold', label: 'Doré', icon: '👑', hint: 'Filet dégradé or + double filet', frame: F({ gold: true, borderWidth: 14, double: true }) },
  { id: 'lace', label: 'Dentelle', icon: '🧵', hint: 'Bord festonné façon napperon', frame: F({ lace: true }) },
  { id: 'splatter', label: 'Éclaboussures', icon: '🖌️', hint: 'Taches d’encre + contour griffonné', frame: F({ splatter: true, splatColor: '#1a1a2e', sketch: true }) },
  { id: 'scan', label: 'Rétro TV', icon: '📺', hint: 'Lignes de balayage + coins arrondis + vignette', frame: F({ scan: true, rounded: true, radius: 18, vignette: true, vig: 0.3 }) },
  { id: 'instax', label: 'Instax', icon: '⬜', hint: 'Bord blanc épais, coins arrondis', frame: F({ mat: true, matColor: '#ffffff', matSize: 16, rounded: true, radius: 14 }) },
  { id: 'comic', label: 'BD', icon: '💥', hint: 'Gros filet noir sur marge blanche', frame: F({ mat: true, matColor: '#ffffff', matSize: 8, border: true, borderColor: '#111111', borderWidth: 14 }) },
  { id: 'grunge', label: 'Grunge', icon: '🗞️', hint: 'Déchiré + griffonné + taches', frame: F({ torn: true, sketch: true, splatter: true, splatColor: '#2b2b2b' }) },
  { id: 'mat-gold', label: 'Passe-partout doré', icon: '🏅', hint: 'Marge crème + filet doré', frame: F({ mat: true, matColor: '#f7f2e7', matSize: 42, gold: true, borderWidth: 8 }) }
]
export const framePresetOf = (frame: FrameParams): FramePreset | undefined =>
  FRAME_PRESETS.find((p) => JSON.stringify(p.frame) === JSON.stringify(frame))

const SYSTEM_FONTS_LOCAL: { label: string; value: string }[] = [
  { label: 'Iowan / Georgia (serif)', value: "'Iowan Old Style', Georgia, serif" },
  { label: 'Inter (sans)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Segoe UI', value: "'Segoe UI', system-ui, sans-serif" },
  { label: 'Georgia (serif)', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Palatino', value: "'Palatino Linotype', Palatino, serif" },
  { label: 'Book Antiqua', value: "'Book Antiqua', Palatino, serif" },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Courier New (mono)', value: "'Courier New', monospace" },
  { label: 'Impact (display)', value: 'Impact, sans-serif' },
  { label: 'Brush Script (cursive)', value: "'Brush Script MT', 'Segoe Script', cursive" },
  { label: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
  { label: 'Apple Color Emoji', value: "'Apple Color Emoji', 'Segoe UI Emoji', sans-serif" },
  { label: 'Monospace système', value: "ui-monospace, Menlo, Consolas, monospace" },
  { label: 'Serif système', value: 'serif' },
  { label: 'Sans système', value: 'sans-serif' }
]

export const FONTS: { label: string; value: string }[] = [...EMBEDDED_FONTS, ...SYSTEM_FONTS_LOCAL]


export interface TemplateDef {
  id: string
  label: string
  icon: string
  aspect: number
  sizeW: number
  frameId: string
  text?: string
  hint: string
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'insta-11', label: 'Post Insta 1:1', icon: '⬜', aspect: 1, sizeW: 1080, frameId: 'none', hint: 'Carré 1080×1080' },
  { id: 'insta-45', label: 'Post Insta 4:5', icon: '▭', aspect: 4 / 5, sizeW: 1080, frameId: 'none', hint: 'Portrait 1080×1350' },
  { id: 'story', label: 'Story 9:16', icon: '📱', aspect: 9 / 16, sizeW: 1080, frameId: 'none', hint: '1080×1920 plein écran' },
  { id: 'reel', label: 'Réel 9:16', icon: '🎬', aspect: 9 / 16, sizeW: 1080, frameId: 'rounded', hint: '1080×1920 + coins arrondis' },
  { id: 'carte', label: 'Carte postale', icon: '💌', aspect: 3 / 2, sizeW: 1500, frameId: 'polaroid', text: 'Bons baisers !', hint: '3:2 + polaroid + légende' },
  { id: 'citation', label: 'Citation', icon: '💬', aspect: 1, sizeW: 1080, frameId: 'mat', text: '« … »', hint: 'Carré + passe-partout + texte' }
]

export function applyTemplate(st: EditState, imgW: number, imgH: number, t: TemplateDef, layerId: string): EditState {
  let cw = imgW
  let ch = imgW / t.aspect
  if (ch > imgH) {
    ch = imgH
    cw = imgH * t.aspect
  }
  const crop: Rect = { x: Math.round((imgW - cw) / 2), y: Math.round((imgH - ch) / 2), w: Math.round(cw), h: Math.round(ch) }
  const preset = FRAME_PRESETS.find((p) => p.id === t.frameId)
  const frame = { ...(preset ? preset.frame : DEFAULT_FRAME) }
  const size = { w: t.sizeW, h: Math.max(1, Math.round(t.sizeW / t.aspect)) }
  const layers = [...st.layers]
  if (t.text) {
    layers.push({ ...newTextLayer(layerId), text: t.text, x: 0.08, y: 0.86, size: 0.05, align: 'left' })
  }
  return { ...st, crop, frame, size, layers }
}

export function extractPalette(px: Uint8ClampedArray, w: number, h: number, n = 5): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; c: number }>()
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] < 128) continue
    const r = px[i * 4]
    const g = px[i * 4 + 1]
    const b = px[i * 4 + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = buckets.get(key)
    if (e) {
      e.r += r
      e.g += g
      e.b += b
      e.c++
    } else buckets.set(key, { r, g, b, c: 1 })
  }
  return [...buckets.values()]
    .sort((a, b) => b.c - a.c)
    .slice(0, n)
    .map((e) => '#' + [e.r / e.c, e.g / e.c, e.b / e.c].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''))
}

export interface MontageLayout {
  id: string
  label: string
  cols: number
  rows: number
}

export const MONTAGE_LAYOUTS: MontageLayout[] = [
  { id: 'h2', label: '2 horizontal', cols: 2, rows: 1 },
  { id: 'v2', label: '2 vertical', cols: 1, rows: 2 },
  { id: 'g4', label: 'Grille 2×2', cols: 2, rows: 2 },
  { id: 'g6', label: 'Grille 3×2', cols: 3, rows: 2 },
  { id: 'g6v', label: 'Grille 2×3', cols: 2, rows: 3 }
]

export const STICKERS: string[] = [
  '😀','😂','😍','😎','🤔','😴','😭','😡','👍','👎','👏','🙏','💪','🤝','❤️','💔','💯','🔥','✨','⭐','🎉','🎁','🐰','🐱','🐶','🦊','🐼','🌸','🌈','☀️','🌙','⚡','☕','🍕','🎵','⚽','🏆','🚀','🧠','💡','📌','✅','❌','❓','🗨️','👀','🫶','🤯','😴','🫡','🤌','🍀'
]

export function newTextLayer(id: string): TextLayer {
  return {
    id, kind: 'text', text: 'Votre texte ici', x: 0.1, y: 0.1,
    font: 'Inter, system-ui, sans-serif', size: 0.06, color: '#ffffff',
    bg: '#000000', bgOpacity: 0.35, lineHeight: 1.25, bold: false, italic: false, align: 'left'
  }
}

export function newStickerLayer(id: string, emoji: string): StickerLayer {
  return { id, kind: 'sticker', emoji, x: 0.4, y: 0.4, size: 0.15 }
}

export const layerDims = (l: Layer, iw: number, measure: (text: string, px: number, font: string) => number): { w: number; h: number } => {
  const px = l.size * iw
  if (l.kind === 'sticker') return { w: px, h: px }
  const lines = l.text.split('\n')
  const w = Math.max(1, ...lines.map((ln) => measure(ln, px, layerFont(l, px))))
  return { w, h: lines.length * px * l.lineHeight }
}

export const layerFont = (l: TextLayer, px: number): string =>
  `${l.italic ? 'italic ' : ''}${l.bold ? '700 ' : ''}${Math.max(1, Math.round(px))}px ${l.font}`
