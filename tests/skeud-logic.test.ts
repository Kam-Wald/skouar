import { describe, it, expect } from 'vitest'
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
  framePresetOf
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
  it('bibliothèque de filtres : 10 presets valides', () => {
    expect(FILTER_PRESETS.length).toBe(10)
    for (const p of FILTER_PRESETS) {
      expect(p.label && p.icon).toBeTruthy()
      expect(cssFilter(p.filter)).toBeTruthy()
    }
    expect(cssFilter(FILTER_PRESETS[0].filter)).toBe('none')
    expect(cssFilter(FILTER_PRESETS.find((p) => p.label === 'N&B')!.filter)).toContain('grayscale(1)')
  })
  it('vingtaine de cadres originaux : 20 presets, ids uniques, géométries cohérentes', () => {
    expect(FRAME_PRESETS.length).toBe(20)
    expect(new Set(FRAME_PRESETS.map((p) => p.id)).size).toBe(20)
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
