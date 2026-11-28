import { describe, it, expect } from 'vitest'
import { relTime, safeName, parseRanges } from '../src/apps/marge/logic'

describe('marge — logic (fonctions pures)', () => {
  it('relTime : à l’instant, minutes, heures, puis date fr-FR', () => {
    const now = Date.now()
    expect(relTime(now, now)).toBe("à l'instant")
    expect(relTime(now - 30 * 1000, now)).toBe("à l'instant")
    expect(relTime(now - 5 * 60 * 1000, now)).toBe('il y a 5 min')
    expect(relTime(now - 59 * 60 * 1000, now)).toBe('il y a 59 min')
    expect(relTime(now - 3 * 3600 * 1000, now)).toBe('il y a 3 h')
    expect(relTime(now - 23 * 3600 * 1000, now)).toBe('il y a 23 h')
    const ts = now - 5 * 86400 * 1000
    expect(relTime(ts, now)).toBe(new Date(ts).toLocaleDateString('fr-FR'))
  })

  it('safeName : caractères interdits Windows remplacés par -', () => {
    expect(safeName('rapport: final?.pdf')).toBe('rapport- final-.pdf')
    expect(safeName('a/b\\c*d"e<f>g|h')).toBe('a-b-c-d-e-f-g-h')
    expect(safeName('déjà bon.pdf')).toBe('déjà bon.pdf')
  })

  it('parseRanges : plages « 1-3, 5 », bornes ramenées entre 1 et max', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual([1, 2, 3, 5])
    expect(parseRanges('7', 10)).toEqual([7])
    expect(parseRanges('9-99', 10)).toEqual([9, 10])
    expect(parseRanges('0-2', 10)).toEqual([1, 2])
    expect(parseRanges('abc, 2', 10)).toEqual([2])
    expect(parseRanges('', 10)).toEqual([])
    expect(parseRanges('3-1', 10)).toEqual([3])
    expect(parseRanges('2,2,4-4', 10)).toEqual([2, 4])
  })
})
