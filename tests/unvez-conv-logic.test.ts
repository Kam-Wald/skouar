import { describe, it, expect } from 'vitest'
import { families, findFamily, findUnit } from '../src/apps/unvez/units'
import { allConversions, convert, factorLabel, formatFR, parseAmount, parseDuration } from '../src/apps/unvez/logic'

const fam = (id: string, cook: 'us' | 'metric' = 'metric') => findFamily(id, cook)!
const u = (f: ReturnType<typeof fam>, id: string) => findUnit(f, id)!

describe('unvez — logique de conversion (CDC 5.G, 10.E/M/N/O/P)', () => {
  it('température : cas célèbres (offset + échelle, pas une multiplication)', () => {
    const t = fam('temperature')
    expect(convert(t, u(t, 'c'), u(t, 'f'), 0)).toBeCloseTo(32, 9)
    expect(convert(t, u(t, 'c'), u(t, 'f'), 100)).toBeCloseTo(212, 9)
    expect(convert(t, u(t, 'c'), u(t, 'k'), 0)).toBeCloseTo(273.15, 9)
    expect(convert(t, u(t, 'c'), u(t, 'f'), -40)).toBeCloseTo(-40, 9)
    expect(convert(t, u(t, 'f'), u(t, 'c'), 32)).toBeCloseTo(0, 9)
    expect(convert(t, u(t, 'k'), u(t, 'c'), 273.15)).toBeCloseTo(0, 9)
    expect(convert(t, u(t, 'th'), u(t, 'c'), 4)).toBeCloseTo(180, 9)
    expect(convert(t, u(t, 'c'), u(t, 'th'), 180)).toBeCloseTo(4, 9)
  })

  it('données : base décimale vs binaire affichées, bits/octets distincts', () => {
    const d = fam('data')
    expect(convert(d, u(d, 'go'), u(d, 'mo'), 1)).toBeCloseTo(1000, 9)
    expect(convert(d, u(d, 'gib'), u(d, 'mib'), 1)).toBeCloseTo(1024, 9)
    expect(convert(d, u(d, 'o'), u(d, 'bit'), 1)).toBeCloseTo(8, 9)
    expect(convert(d, u(d, 'ko'), u(d, 'o'), 1)).toBeCloseTo(1000, 9)
    expect(convert(d, u(d, 'kib'), u(d, 'o'), 1)).toBeCloseTo(1024, 9)
    expect(convert(d, u(d, 'ko'), u(d, 'kib'), 1)).toBeCloseTo(1000 / 1024, 9)
  })

  it('durées : saisie mixte « 1 h 30 » = 5400 s = 90 min', () => {
    expect(parseDuration('1 h 30')).toBe(5400)
    expect(parseDuration('1:30')).toBe(5400)
    expect(parseDuration('2 j 3 h')).toBe(2 * 86400 + 3 * 3600)
    const d = fam('duree')
    expect(convert(d, u(d, 's'), u(d, 'min'), 5400)).toBeCloseTo(90, 9)
    expect(convert(d, u(d, 'min'), u(d, 's'), 90)).toBeCloseTo(5400, 9)
  })

  it('angles : 180° = π rad = 0,5 tour', () => {
    const a = fam('angles')
    expect(convert(a, u(a, 'deg'), u(a, 'rad'), 180)).toBeCloseTo(Math.PI, 9)
    expect(convert(a, u(a, 'deg'), u(a, 'tour'), 180)).toBeCloseTo(0.5, 9)
    expect(convert(a, u(a, 'gon'), u(a, 'deg'), 100)).toBeCloseTo(90, 9)
  })

  it('cuisine : convention US vs métrique (10.P)', () => {
    const us = fam('cuisine', 'us')
    const me = fam('cuisine', 'metric')
    expect(convert(us, u(us, 'cup'), u(us, 'ml'), 1)).toBeCloseTo(236.588, 6)
    expect(convert(me, u(me, 'cup'), u(me, 'ml'), 1)).toBeCloseTo(250, 6)
    expect(convert(us, u(us, 'cup'), u(us, 'ml'), 2)).toBeCloseTo(473.176, 3)
    expect(convert(me, u(me, 'cup'), u(me, 'ml'), 2)).toBeCloseTo(500, 9)
    expect(convert(me, u(me, 'tbsp'), u(me, 'ml'), 1)).toBeCloseTo(15, 9)
    expect(convert(us, u(us, 'tbsp'), u(us, 'ml'), 1)).toBeCloseTo(14.7868, 6)
  })

  it('distance : 100 km en miles, facteur affiché (5.I)', () => {
    const d = fam('distance')
    expect(convert(d, u(d, 'km'), u(d, 'mi'), 100)).toBeCloseTo(62.1371192237, 6)
    expect(factorLabel(d, u(d, 'km'), u(d, 'mi'))).toContain('0,621371')
  })

  it('factorLabel température : règle offset+échelle, pas un faux facteur', () => {
    const t = fam('temperature')
    expect(factorLabel(t, u(t, 'c'), u(t, 'f'))).toContain('9/5 + 32')
    expect(factorLabel(t, u(t, 'c'), u(t, 'k'))).toContain('273,15')
  })

  it('formatFR : millises, virgule FR, notation scientifique, troncature des zéros', () => {
    expect(formatFR(12345.67, 2)).toBe('12 345,67')
    expect(formatFR(1.5e9, 6)).toBe('1,5e9')
    expect(formatFR(0.1 + 0.2, 6)).toBe('0,3')
    expect(formatFR(62.1371192237, 6)).toBe('62,137119')
    expect(formatFR(100000, 6)).toBe('100 000')
    expect(formatFR(0, 6)).toBe('0')
    expect(formatFR(-1234.5, 1)).toBe('-1 234,5')
  })

  it('parseAmount : virgule FR, espaces, exposant', () => {
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('1 234,5')).toBe(1234.5)
    expect(parseAmount('1.5e3')).toBe(1500)
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })

  it('allConversions : panneau « toutes les unités » depuis la base', () => {
    const d = fam('distance')
    const rows = allConversions(d, 1000)
    const m = rows.find((r) => r.unit.id === 'm')
    const km = rows.find((r) => r.unit.id === 'km')
    expect(m?.value).toBe(1000)
    expect(km?.value).toBe(1)
  })
})
