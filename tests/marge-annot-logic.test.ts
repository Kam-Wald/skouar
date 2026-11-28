import { describe, it, expect } from 'vitest'
import { hitAnnotPdf, mergeRectsByLine, normRect, shiftAnnot, TOOLS, COLORS, STAMPS } from '../src/apps/marge/annot'
import type { MargeAnnot } from '../src/apps/marge/store'

describe('marge — annot (logique pure)', () => {
  it('normRect : toujours x,y en haut à gauche, w/h positifs', () => {
    expect(normRect(10, 10, 4, 2)).toEqual([4, 2, 6, 8])
    expect(normRect(0, 0, 5, 5)).toEqual([0, 0, 5, 5])
  })

  it('mergeRectsByLine : fusionne les rects d’une même ligne, garde les lignes séparées', () => {
    const merged = mergeRectsByLine([
      [10, 100, 20, 8],
      [35, 100, 15, 8],
      [10, 130, 40, 8]
    ])
    expect(merged.length).toBe(2)
    const line1 = merged.find((r) => r[1] === 100)!
    expect(line1[0]).toBe(10)
    expect(line1[2]).toBe(40)
  })

  it('TOOLS : 9 outils avec raccourcis 1–9 uniques', () => {
    expect(TOOLS.length).toBe(9)
    expect(new Set(TOOLS.map((t) => t.key)).size).toBe(9)
    expect(COLORS.length).toBe(5)
    expect(STAMPS.length).toBe(4)
  })

  it('shiftAnnot : décale x/y/x2/y2, rects et points, conserve le reste, ne mute pas l’original', () => {
    const hl: MargeAnnot = { id: 'a', docId: 'd', page: 1, type: 'hl', rects: [[10, 90, 50, 40]], color: '#ffd54a', at: 1 }
    expect(shiftAnnot(hl, 20, -20).rects).toEqual([[30, 70, 50, 40]])
    expect(hl.rects).toEqual([[10, 90, 50, 40]])
    const ar: MargeAnnot = { id: 'b', docId: 'd', page: 2, type: 'arrow', x: 0, y: 0, x2: 10, y2: 10, color: '#000', at: 2 }
    expect(shiftAnnot(ar, 5, 5)).toMatchObject({ x: 5, y: 5, x2: 15, y2: 15 })
    const ink: MargeAnnot = { id: 'c', docId: 'd', page: 1, type: 'ink', points: [[0, 0], [10, 10]], color: '#000', at: 3 }
    expect(shiftAnnot(ink, -5, 5).points).toEqual([[-5, 5], [5, 15]])
    const sign: MargeAnnot = { id: 's', docId: 'd', page: 1, type: 'sign', x: 1, y: 2, w: 160, h: 64, color: '#000', dataUrl: 'x', at: 4 }
    expect(shiftAnnot(sign, 10, 10)).toMatchObject({ x: 11, y: 12, w: 160, h: 64, dataUrl: 'x' })
  })

  it('hitAnnotPdf : touche rect / segment / ellipse avec tolérance, rate à côté', () => {
    const hl: MargeAnnot = { id: 'a', docId: 'd', page: 1, type: 'hl', x: 10, y: 90, w: 50, h: 40, color: '#ffd54a', at: 1 }
    expect(hitAnnotPdf(hl, 30, 110, 6)).toBe(true)
    expect(hitAnnotPdf(hl, 5, 110, 6)).toBe(true)
    expect(hitAnnotPdf(hl, 3, 110, 6)).toBe(false)
    expect(hitAnnotPdf(hl, 30, 200, 6)).toBe(false)
    const arrow: MargeAnnot = { id: 'b', docId: 'd', page: 1, type: 'arrow', x: 0, y: 0, x2: 100, y2: 0, color: '#000', at: 2 }
    expect(hitAnnotPdf(arrow, 50, 4, 6)).toBe(true)
    expect(hitAnnotPdf(arrow, 50, 20, 6)).toBe(false)
    const circle: MargeAnnot = { id: 'c', docId: 'd', page: 1, type: 'circle', x: 0, y: 0, w: 40, h: 20, color: '#000', at: 3 }
    expect(hitAnnotPdf(circle, 20, 10, 2)).toBe(true)
    expect(hitAnnotPdf(circle, 45, 10, 2)).toBe(false)
    const ink: MargeAnnot = { id: 'e', docId: 'd', page: 1, type: 'ink', points: [[0, 0], [50, 0]], color: '#000', at: 4 }
    expect(hitAnnotPdf(ink, 25, 3, 6)).toBe(true)
    expect(hitAnnotPdf(ink, 25, 30, 6)).toBe(false)
  })
})
