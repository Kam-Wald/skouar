import { describe, it, expect } from 'vitest'
import { cacheFromItems, findMatches, annotsMatching, type TItem } from '../src/apps/marge/search'

const item = (str: string, i: number): TItem => ({ str, transform: [1, 0, 0, -1, i * 60, 140], width: 50, height: 10 })

describe('marge — search (logique pure)', () => {
  it('cacheFromItems : texte concaténé + offsets de début par item', () => {
    const c = cacheFromItems([item('Bonjour', 0), item('le monde', 1)])
    expect(c.text).toBe('Bonjour le monde ')
    expect(c.starts).toEqual([0, 8])
    expect(c.items.length).toBe(2)
  })

  it('findMatches : occurrences, casse-insensible, items couverts par occurrence', () => {
    const c = cacheFromItems([item('Bonjour', 0), item('le monde', 1), item('bonjour', 2)])
    const ms = findMatches(c, 'BONJOUR')
    expect(ms.length).toBe(2)
    expect(ms[0].items).toEqual([0])
    expect(ms[1].items).toEqual([2])
    expect(findMatches(c, '')).toEqual([])
    expect(findMatches(c, 'absent')).toEqual([])
  })

  it('findMatches : une occurrence qui chevauche deux items couvre les deux', () => {
    const c = cacheFromItems([item('bon', 0), item('jour', 1)])
    const ms = findMatches(c, 'bon jour')
    expect(ms.length).toBe(1)
    expect(ms[0].items).toEqual([0, 1])
  })

  it('annotsMatching : filtre sur le texte des annotations, casse-insensible', () => {
    const annots = [
      { id: 'a1', page: 2, text: 'Idée pour le contrat' },
      { id: 'a2', page: 5, text: 'contrat à relire' },
      { id: 'a3', page: 7 }
    ]
    expect(annotsMatching(annots, 'contrat').map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(annotsMatching(annots, '')).toEqual([])
  })
})
