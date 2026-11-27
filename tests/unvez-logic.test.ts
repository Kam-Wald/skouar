import { describe, it, expect } from 'vitest'
import {
  applyOp,
  calcBack,
  calcDigit,
  calcDot,
  calcEquals,
  calcFunc,
  calcInit,
  calcNegate,
  calcOp,
  calcPercent,
  convert,
  fmtConv,
  CONV
} from '../src/apps/unvez/logic'

function type(s: ReturnType<typeof calcInit>, digits: string) {
  for (const d of digits) s = calcDigit(s, d)
  return s
}

describe('calculatrice Unvez', () => {
  it('7 + 8 = 15', () => {
    let s = type(calcInit(), '7')
    s = calcOp(s, '+')
    s = type(s, '8')
    s = calcEquals(s)
    expect(s.display).toBe('15')
  })

  it('12 ÷ 4 = 3 et 9 × 3 = 27', () => {
    let s = type(calcInit(), '12')
    s = calcOp(s, '÷')
    s = type(s, '4')
    expect(calcEquals(s).display).toBe('3')
    s = type(calcInit(), '9')
    s = calcOp(s, '×')
    s = type(s, '3')
    expect(calcEquals(s).display).toBe('27')
  })

  it('chaînage : 2 + 3 + 4 = 9 (op en attente appliqué au nouvel opérateur)', () => {
    let s = type(calcInit(), '2')
    s = calcOp(s, '+')
    s = type(s, '3')
    s = calcOp(s, '+')
    expect(s.display).toBe('5')
    s = type(s, '4')
    expect(calcEquals(s).display).toBe('9')
  })

  it('division par zéro → Erreur', () => {
    let s = type(calcInit(), '5')
    s = calcOp(s, '÷')
    s = type(s, '0')
    expect(calcEquals(s).display).toBe('Erreur')
  })

  it('décimaux, négation, backspace, pourcentage', () => {
    let s = type(calcInit(), '1')
    s = calcDot(s)
    s = type(s, '5')
    expect(s.display).toBe('1.5')
    s = calcNegate(s)
    expect(s.display).toBe('-1.5')
    s = calcBack(s)
    expect(s.display).toBe('-1.')
    s = calcPercent(type(calcInit(), '200'))
    expect(s.display).toBe('2')
  })

  it('fonctions scientifiques : √9=3, 5²=25, 1/4=0.25, sin 90°=1', () => {
    expect(calcFunc(type(calcInit(), '9'), 'sqrt').display).toBe('3')
    expect(calcFunc(type(calcInit(), '5'), 'sq').display).toBe('25')
    expect(calcFunc(type(calcInit(), '4'), 'inv').display).toBe('0.25')
    expect(calcFunc(type(calcInit(), '90'), 'sin').display).toBe('1')
    expect(calcFunc(type(calcInit(), '-9'), 'sqrt').display).toBe('Erreur')
  })

  it('applyOp', () => {
    expect(applyOp(2, 3, '+')).toBe(5)
    expect(applyOp(2, 3, '-')).toBe(-1)
    expect(applyOp(2, 3, '×')).toBe(6)
    expect(applyOp(1, 0, '÷')).toBeNaN()
  })
})

describe('convertisseur Unvez', () => {
  it('100 m → ft ≈ 328.084', () => {
    expect(fmtConv(convert(100, 'm', 'ft', 'longueur'))).toBe('328.084')
  })

  it('1 km = 1000 m, 1 mi ≈ 1.609 km', () => {
    expect(convert(1, 'km', 'm', 'longueur')).toBe(1000)
    expect(fmtConv(convert(1, 'mi', 'km', 'longueur'))).toBe('1.60934')
  })

  it('1 kg → lb ≈ 2.20462, 1 t = 1000 kg', () => {
    expect(fmtConv(convert(1, 'kg', 'lb', 'poids'))).toBe('2.20462')
    expect(convert(1, 't', 'kg', 'poids')).toBe(1000)
  })

  it('100 EUR → USD = 108 et 108 USD → 100 EUR (taux indicatifs embarqués)', () => {
    expect(convert(100, 'EUR', 'USD', 'devise')).toBeCloseTo(108, 5)
    expect(convert(108, 'USD', 'EUR', 'devise')).toBeCloseTo(100, 5)
  })

  it('unité inconnue ou valeur invalide → NaN', () => {
    expect(convert(1, 'm', 'xxx', 'longueur')).toBeNaN()
    expect(convert(NaN, 'm', 'ft', 'longueur')).toBeNaN()
  })

  it('toutes les catégories ont des unités valides', () => {
    for (const c of Object.keys(CONV) as (keyof typeof CONV)[]) {
      expect(CONV[c].units.length).toBeGreaterThanOrEqual(4)
      for (const u of CONV[c].units) expect(u.f).toBeGreaterThan(0)
    }
  })
})
