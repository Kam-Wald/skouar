import { describe, it, expect } from 'vitest'
import { mergeRectsByLine, normRect, TOOLS, COLORS, STAMPS } from '../src/apps/marge/annot'

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
})
