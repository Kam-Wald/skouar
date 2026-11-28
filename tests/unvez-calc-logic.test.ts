import { describe, it, expect } from 'vitest'
import { applyPercentVariation, evaluate } from '../src/apps/unvez/calc'

describe('unvez — évaluateur d’expressions (CDC 4)', () => {
  it('priorités et parenthèses', () => {
    expect(evaluate('2+2*3', 'DEG')).toEqual({ ok: true, value: 8 })
    expect(evaluate('(2+3)*4', 'DEG')).toEqual({ ok: true, value: 20 })
    expect(evaluate('10/4', 'DEG')).toEqual({ ok: true, value: 2.5 })
    expect(evaluate('2^10', 'DEG')).toEqual({ ok: true, value: 1024 })
    expect(evaluate('2^3^2', 'DEG')).toEqual({ ok: true, value: 512 })
  })

  it('pourcentage postfixe et unaire', () => {
    expect(evaluate('50%', 'DEG')).toEqual({ ok: true, value: 0.5 })
    expect(evaluate('100*50%', 'DEG')).toEqual({ ok: true, value: 50 })
    expect(evaluate('-3+5', 'DEG')).toEqual({ ok: true, value: 2 })
    expect(evaluate('2*-3', 'DEG')).toEqual({ ok: true, value: -6 })
  })

  it('trigo selon le mode d’angle (4.G / 10.J)', () => {
    expect(evaluate('sin(90)', 'DEG')).toEqual({ ok: true, value: 1 })
    expect(evaluate('sin(100)', 'GRAD')).toEqual({ ok: true, value: 1 })
    const rad = evaluate('sin(90)', 'RAD')
    expect(rad.ok && rad.value).toBeCloseTo(0.8939966636, 9)
    expect(evaluate('asin(1)', 'DEG')).toEqual({ ok: true, value: 90 })
    expect(evaluate('cos(0)', 'DEG')).toEqual({ ok: true, value: 1 })
  })

  it('log, racines, constantes, multiplication implicite', () => {
    expect(evaluate('log(1000)', 'DEG')).toEqual({ ok: true, value: 3 })
    expect(evaluate('ln(2.718281828459045)', 'DEG')?.value).toBeCloseTo(1, 9)
    expect(evaluate('√(9)', 'DEG')).toEqual({ ok: true, value: 3 })
    expect(evaluate('π', 'DEG')?.value).toBeCloseTo(Math.PI, 12)
    expect(evaluate('2π', 'DEG')?.value).toBeCloseTo(2 * Math.PI, 12)
    expect(evaluate('2(3+4)', 'DEG')).toEqual({ ok: true, value: 14 })
    expect(evaluate('g', 'DEG')).toEqual({ ok: true, value: 9.80665 })
    expect(evaluate('c', 'DEG')).toEqual({ ok: true, value: 299792458 })
  })

  it('virgule FR acceptée en entrée', () => {
    expect(evaluate('2,5*2', 'DEG')).toEqual({ ok: true, value: 5 })
  })

  it('erreurs : division par zéro, expression invalide, vide', () => {
    expect(evaluate('2/0', 'DEG').ok).toBe(false)
    expect(evaluate('2+', 'DEG').ok).toBe(false)
    expect(evaluate('', 'DEG').ok).toBe(false)
    expect(evaluate('(2+3', 'DEG').ok).toBe(false)
  })

  it('variations en chaîne (4.F) : −20 % puis −10 % sur 100 → 72', () => {
    const after20 = applyPercentVariation(100, -20)
    expect(after20).toBeCloseTo(80, 12)
    expect(applyPercentVariation(after20, -10)).toBeCloseTo(72, 12)
    expect(applyPercentVariation(50, 20)).toBeCloseTo(60, 12)
  })
})
