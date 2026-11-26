import { describe, it, expect } from 'vitest'
import { TEMPLATES, applyTemplate, extractPalette, MONTAGE_LAYOUTS } from '../src/apps/skeud/logic'
import {
  cssFilter,
  DEFAULT_FILTERS,
  clampRect,
  toImageRect,
  aspectLabel,
  frameGeom,
  DEFAULT_FRAME,
  outDims,
  DEFAULT_EDIT,
  fmtBytes,
  exportName,
  batchName,
  EXPORT_FORMATS,
  FILTER_PRESETS,
  FRAME_PRESETS,
  framePresetOf,
  FONTS,
  STICKERS,
  newTextLayer,
  newStickerLayer,
  layerDims,
  layerFont
} from '../src/apps/skeud/logic'

describe('skeud logic', () => {
  it('cssFilter ne sort que les écarts aux défauts', () => {
    expect(cssFilter(DEFAULT_FILTERS)).toBe('none')
    expect(cssFilter({ ...DEFAULT_FILTERS, brightness: 1.2, sepia: 0.4 })).toBe('brightness(1.2) sepia(0.4)')
    expect(cssFilter({ ...DEFAULT_FILTERS, hue: 90, grayscale: 1 })).toBe('grayscale(1) hue-rotate(90deg)')
  })
  it('clampRect reste dans les bornes avec taille min 8', () => {
    expect(clampRect({ x: -5, y: -5, w: 50, h: 50 }, 100, 80)).toEqual({ x: 0, y: 0, w: 50, h: 50 })
    expect(clampRect({ x: 90, y: 70, w: 50, h: 50 }, 100, 80)).toEqual({ x: 50, y: 30, w: 50, h: 50 })
    expect(clampRect({ x: 0, y: 0, w: 2, h: 2 }, 100, 80)).toEqual({ x: 0, y: 0, w: 8, h: 8 })
  })
  it('toImageRect convertit coordonnées affichage → image, avec ratio verrouillé', () => {
    const r = toImageRect({ x: 50, y: 25, w: 100, h: 50 }, 200, 100, 400, 200, null)
    expect(r).toEqual({ x: 100, y: 50, w: 200, h: 100 })
    const sq = toImageRect({ x: 0, y: 0, w: 100, h: 50 }, 200, 100, 400, 200, 1)
    expect(sq.w).toBe(sq.h)
    expect(sq.w).toBe(200)
  })
  it('aspectLabel réduit', () => {
    expect(aspectLabel(1920, 1080)).toBe('16:9')
    expect(aspectLabel(1000, 1000)).toBe('1:1')
    expect(aspectLabel(0, 5)).toBe('libre')
  })
  it('frameGeom : passe-partout, bordure, polaroid, cinémascope, cercle', () => {
    expect(frameGeom(100, 50, { ...DEFAULT_FRAME, mat: true, matSize: 10 })).toMatchObject({ W: 120, H: 70, ix: 10, iy: 10, iw: 100, ih: 50 })
    expect(frameGeom(100, 50, { ...DEFAULT_FRAME, border: true, borderWidth: 5 })).toMatchObject({ W: 100, H: 50, ix: 0, iy: 0, iw: 100, ih: 50 })
    expect(frameGeom(100, 50, { ...DEFAULT_FRAME, rounded: true, radius: 999 }).radius).toBe(25)
    const pol = frameGeom(100, 50, { ...DEFAULT_FRAME, mat: true, matSize: 10, polaroid: true })
    expect(pol.H).toBe(50 + 10 + 25)
    const lb = frameGeom(100, 50, { ...DEFAULT_FRAME, letterbox: true, bars: 0.2 })
    expect(lb.bars).toBe(10)
    expect(lb.H).toBe(50 + 20)
    expect(frameGeom(100, 50, { ...DEFAULT_FRAME, circle: true }).circle).toBe(true)
  })
  it('outDims : crop + rotation + resize + cadre', () => {
    expect(outDims(400, 200, DEFAULT_EDIT)).toEqual({ w: 400, h: 200 })
    expect(outDims(400, 200, { ...DEFAULT_EDIT, crop: { x: 0, y: 0, w: 100, h: 100 } })).toEqual({ w: 100, h: 100 })
    expect(outDims(400, 200, { ...DEFAULT_EDIT, rot: 90 })).toEqual({ w: 200, h: 400 })
    expect(outDims(400, 200, { ...DEFAULT_EDIT, size: { w: 100, h: 50 } })).toEqual({ w: 100, h: 50 })
    expect(outDims(400, 200, { ...DEFAULT_EDIT, frame: { ...DEFAULT_FRAME, mat: true, matSize: 10 } })).toEqual({ w: 420, h: 220 })
    expect(outDims(400, 200, { ...DEFAULT_EDIT, frame: { ...DEFAULT_FRAME, letterbox: true, bars: 0.1 } })).toEqual({ w: 400, h: 240 })
  })
  it('fmtBytes / exportName / batchName', () => {
    expect(fmtBytes(500)).toBe('500 o')
    expect(fmtBytes(2048)).toBe('2 Ko')
    expect(fmtBytes(5 * 1024 * 1024)).toBe('5.0 Mo')
    expect(exportName('photo.JPG', 'webp')).toBe('photo.webp')
    expect(batchName('a.png', 'jpg', 2, 12)).toBe('a-skeud-03.jpg')
    expect(EXPORT_FORMATS.map((f) => f.ext)).toEqual(['png', 'jpg', 'webp'])
  })
})

describe('skeud v2 : presets', () => {
  it('bibliothèque de filtres : 20 presets valides', () => {
    expect(FILTER_PRESETS.length).toBe(20)
    for (const p of FILTER_PRESETS) {
      expect(p.label && p.icon).toBeTruthy()
      expect(cssFilter(p.filter)).toBeTruthy()
    }
    expect(cssFilter(FILTER_PRESETS[0].filter)).toBe('none')
    expect(cssFilter(FILTER_PRESETS.find((p) => p.label === 'N&B')!.filter)).toContain('grayscale(1)')
  })
  it('cadres : 30 presets dont les stylés (double/torn/burnt + 16 effets v4), ids uniques, géométries cohérentes', () => {
    expect(FRAME_PRESETS.length).toBe(30)
    for (const id of ['double', 'torn', 'burnt', 'tape', 'corners', 'sketch', 'stamp', 'film', 'shadow', 'neon', 'wood', 'gold', 'lace', 'splatter', 'scan', 'instax', 'comic', 'grunge', 'mat-gold', 'polaroid', 'letterbox', 'circle']) {
      expect(FRAME_PRESETS.some((p) => p.id === id)).toBe(true)
    }
    const torn = FRAME_PRESETS.find((p) => p.id === 'torn')!
    expect(frameGeom(400, 200, torn.frame).W).toBeGreaterThan(400)
    expect(new Set(FRAME_PRESETS.map((p) => p.id)).size).toBe(30)
    for (const p of FRAME_PRESETS) {
      const g = frameGeom(400, 200, p.frame)
      expect(g.W).toBeGreaterThanOrEqual(400 - 2 * (p.frame.border ? p.frame.borderWidth : 0) - 1)
      expect(g.H).toBeGreaterThan(0)
    }
    const pol = FRAME_PRESETS.find((p) => p.id === 'polaroid')!
    expect(frameGeom(400, 200, pol.frame).H).toBeGreaterThan(200 + 36)
    const c = FRAME_PRESETS.find((p) => p.id === 'circle')!
    expect(frameGeom(400, 200, c.frame).circle).toBe(true)
  })
  it('framePresetOf retrouve le preset actif', () => {
    expect(framePresetOf(DEFAULT_FRAME)?.id).toBe('none')
    const v = FRAME_PRESETS.find((p) => p.id === 'vintage-frame')!
    expect(framePresetOf(v.frame)?.id).toBe('vintage-frame')
    expect(framePresetOf({ ...DEFAULT_FRAME, border: true, borderWidth: 3 })).toBeUndefined()
    expect(v.filter && cssFilter(v.filter)).toContain('sepia')
  })
})

describe('skeud v3 : calques, température, presets étendus', () => {
  it('cssFilter température chaude/froide, sharpen exclu du css', () => {
    expect(cssFilter({ ...DEFAULT_FILTERS, temp: 80 })).toBe('sepia(0.28) hue-rotate(-20deg)')
    expect(cssFilter({ ...DEFAULT_FILTERS, temp: -60 })).toBe('hue-rotate(20deg) saturate(0.76)')
    expect(cssFilter({ ...DEFAULT_FILTERS, sharpen: 0.8 })).toBe('none')
  })
  it('FONTS : 38 polices embarquées triées par ordre alphabétique + 20 système, STICKERS : 52', () => {
    expect(FONTS.length).toBe(58)
    expect(STICKERS.length).toBe(52)
    expect(FONTS.some((f) => f.label.includes('Impact'))).toBe(true)
    for (const name of ['Alegreya', 'Playfair', 'Atkinson', 'Roboto', 'Open Sans', 'Bitter', 'Cinzel', 'JetBrains Mono', 'Special Elite', 'Pacifico', 'Permanent Marker', 'Great Vibes', 'Orbitron', 'Raleway', 'Rubik', 'Archivo', 'Bodoni Moda', 'Abril Fatface', 'Instrument Serif', 'Josefin Sans', 'Newsreader', 'Inconsolata']) {
      expect(FONTS.some((f) => f.label.includes(name))).toBe(true)
    }
    const emb = FONTS.slice(0, 38).map((f) => f.label.toLowerCase())
    expect([...emb].sort()).toEqual(emb)
  })
  it('newTextLayer/newStickerLayer + layerDims', () => {
    const t = newTextLayer('a')
    expect(t.kind).toBe('text')
    expect(t.text.length).toBeGreaterThan(0)
    const d = layerDims(t, 1000, (text) => text.length * 10)
    expect(d.h).toBeCloseTo((0.06 * 1000) * 1.25)
    expect(d.w).toBe('Votre texte ici'.length * 10)
    const st = newStickerLayer('b', '🐰')
    expect(layerDims(st, 1000, () => 0)).toEqual({ w: 150, h: 150 })
  })
  it('layerFont gras/italique', () => {
    expect(layerFont({ ...newTextLayer('x'), bold: true, italic: true }, 50)).toBe('italic 700 50px Inter, system-ui, sans-serif')
  })
  it('DEFAULT_EDIT a layers vide', () => {
    expect(DEFAULT_EDIT.layers).toEqual([])
  })
})

describe('skeud v4 : onglets + presets doublés + cadres stylés', () => {
  it('20 filtres caractéristiques, tous produisant un cssFilter valide et non vide (sauf Naturel)', () => {
    expect(FILTER_PRESETS.length).toBe(20)
    const labels = FILTER_PRESETS.map((p) => p.label)
    expect(new Set(labels).size).toBe(20)
    for (const p of FILTER_PRESETS) {
      expect(cssFilter(p.filter)).toBeTruthy()
    }
    expect(cssFilter(FILTER_PRESETS[0].filter)).toBe('none')
    expect(cssFilter(FILTER_PRESETS.find((p) => p.label === 'Négatif')!.filter)).toBe('invert(1)')
    expect(cssFilter(FILTER_PRESETS.find((p) => p.label === 'Coucher de soleil')!.filter)).toContain('sepia(0.45)')
  })
  it('cadres stylés : double/torn/burnt ont les bons flags et géométrie', () => {
    const dbl = FRAME_PRESETS.find((p) => p.id === 'double')!
    expect(dbl.frame.double && dbl.frame.border).toBe(true)
    expect(frameGeom(400, 200, dbl.frame)).toMatchObject({ W: 400, H: 200 })
    const torn = FRAME_PRESETS.find((p) => p.id === 'torn')!
    expect(torn.frame.torn).toBe(true)
    const g = frameGeom(400, 200, torn.frame)
    expect(g.W).toBeGreaterThan(400)
    expect(g.ix).toBeGreaterThan(0)
    const burnt = FRAME_PRESETS.find((p) => p.id === 'burnt')!
    expect(burnt.frame.burnt).toBe(true)
    expect(framePresetOf(burnt.frame)?.id).toBe('burnt')
  })
  it('frameGeom v4 : marges stamp/film/lace/shadow s’ajoutent et restent symétriques', () => {
    for (const id of ['stamp', 'film', 'lace', 'shadow']) {
      const pr = FRAME_PRESETS.find((p) => p.id === id)!
      const g = frameGeom(400, 200, pr.frame)
      expect(g.W).toBeGreaterThan(400)
      expect(g.H).toBeGreaterThan(200)
      expect(g.ix).toBeGreaterThan(0)
      expect(g.iy).toBeGreaterThan(0)
      expect(g.ix + g.iw).toBeLessThan(g.W)
      expect(g.iy + g.ih).toBeLessThan(g.H)
      expect(framePresetOf(pr.frame)?.id).toBe(id)
    }
    const sh = frameGeom(400, 200, { ...DEFAULT_FRAME, shadow: true })
    expect(sh.H - sh.ih).toBe(22 + 34)
    const film = frameGeom(400, 200, { ...DEFAULT_FRAME, film: true })
    expect(film.W - film.iw).toBeGreaterThan(2 * 22 - 1)
  })
  it('frameGeom : edge marquera les bords déchirés/brûlés, symétrique, et 0 sinon', () => {
    const base = frameGeom(400, 200, DEFAULT_FRAME)
    expect(base.edge).toBe(0)
    expect(base.W).toBe(400)
    expect(base.H).toBe(200)
    const torn = frameGeom(400, 200, { ...DEFAULT_FRAME, torn: true })
    expect(torn.edge).toBeGreaterThanOrEqual(10)
    expect(torn.W).toBe(400 + 2 * torn.edge)
    expect(torn.H).toBe(200 + 2 * torn.edge)
    expect(torn.ix).toBe(torn.edge)
    expect(torn.iy).toBe(torn.edge)
    const burnt = frameGeom(400, 200, { ...DEFAULT_FRAME, burnt: true })
    expect(burnt.edge).toBe(torn.edge)
    const matTorn = frameGeom(400, 200, { ...DEFAULT_FRAME, mat: true, matSize: 40, torn: true })
    expect(matTorn.ix).toBe(40 + torn.edge)
    expect(matTorn.W).toBe(400 + 2 * (40 + torn.edge))
  })
})

describe('skeud v5 : templates, palette, montage', () => {
  it('TEMPLATES : 6 templates avec aspect/size/cadre valides', () => {
    expect(TEMPLATES.length).toBe(6)
    for (const t of TEMPLATES) {
      expect(t.aspect).toBeGreaterThan(0)
      expect(t.sizeW).toBeGreaterThanOrEqual(1080)
      expect(FRAME_PRESETS.some((p) => p.id === t.frameId)).toBe(true)
    }
  })
  it('applyTemplate : recadrage centré au bon ratio + taille + cadre + texte optionnel', () => {
    const st = { ...DEFAULT_EDIT }
    const story = TEMPLATES.find((t) => t.id === 'story')!
    const r = applyTemplate(st, 1000, 500, story, 'L1')
    expect(r.crop).not.toBeNull()
    expect(Math.abs(r.crop!.w / r.crop!.h - 9 / 16)).toBeLessThan(0.02)
    expect(r.crop!.x).toBeGreaterThanOrEqual(0)
    expect(r.size).toEqual({ w: 1080, h: 1920 })
    expect(r.layers.length).toBe(0)
    const carte = TEMPLATES.find((t) => t.id === 'carte')!
    const r2 = applyTemplate(st, 1000, 500, carte, 'L2')
    expect(r2.frame.polaroid).toBe(true)
    expect(r2.layers.length).toBe(1)
    expect(r2.layers[0].kind).toBe('text')
  })
  it('extractPalette : 5 hex valides, dominants d’abord', () => {
    const w = 8
    const h = 8
    const px = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = i < 48 ? 200 : 20
      px[i * 4 + 1] = i < 48 ? 30 : 40
      px[i * 4 + 2] = i < 48 ? 30 : 220
      px[i * 4 + 3] = 255
    }
    const pal = extractPalette(px, w, h, 5)
    expect(pal.length).toBe(2)
    expect(pal[0]).toMatch(/^#[0-9a-f]{6}$/)
    expect(pal[0]).toBe('#c81e1e')
    expect(pal[1]).toBe('#1428dc')
  })
  it('MONTAGE_LAYOUTS : 5 dispositions, cols*rows cohérents', () => {
    expect(MONTAGE_LAYOUTS.length).toBe(5)
    for (const l of MONTAGE_LAYOUTS) {
      expect(l.cols * l.rows).toBeGreaterThanOrEqual(2)
    }
  })
})
