// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { makeEvent, type HealthEvent } from '../src/apps/racine/store'
import { allCrisisTriggers, BODY_ZONES, crisisCoOccurrences, crisisTriggers, toggleTrigger, zoneLabel } from '../src/apps/racine/crise'

const crise = (declencheurs: string[], date: number): HealthEvent => makeEvent('crise', date, { intensity: 5, zone: null, declencheurs })

describe('racine — crise : carte du corps + déclencheurs + co-occurrences (CDC §4.D/4.E/4.I, logique)', () => {
  it('BODY_ZONES : ids uniques, libellés FR, zoneLabel', () => {
    expect(BODY_ZONES.length).toBe(11)
    expect(new Set(BODY_ZONES.map((z) => z.id)).size).toBe(11)
    expect(BODY_ZONES.every((z) => z.label.length > 0)).toBe(true)
    expect(zoneLabel('ventre')).toBe('Ventre')
    expect(zoneLabel('inconnu')).toBe('')
    expect(zoneLabel(null)).toBe('')
  })

  it('crisisTriggers / toggleTrigger : lecture sûre et bascule', () => {
    expect(crisisTriggers(makeEvent('crise', 0, {}))).toEqual([])
    expect(crisisTriggers(makeEvent('crise', 0, { declencheurs: ['stress', ''] }))).toEqual(['stress'])
    expect(toggleTrigger(['stress'], 'aliment')).toEqual(['stress', 'aliment'])
    expect(toggleTrigger(['stress', 'aliment'], 'stress')).toEqual(['aliment'])
    expect(toggleTrigger(['stress'], '  ')).toEqual(['stress'])
  })

  it('crisisCoOccurrences : fréquences sur les N dernières crises, triées, crises sans déclencheur hors du total', () => {
    const events: HealthEvent[] = [
      crise(['stress', 'aliment'], 4000),
      crise(['stress'], 3000),
      crise([], 2000),
      crise(['météo'], 1000),
      makeEvent('moral', 500, { level: 3 })
    ]
    const co = crisisCoOccurrences(events, 3)
    expect(co).toEqual([
      { name: 'stress', count: 2, total: 2 },
      { name: 'aliment', count: 1, total: 2 }
    ])
    expect(crisisCoOccurrences(events, 10).find((c) => c.name === 'météo')?.count).toBe(1)
    expect(crisisCoOccurrences([])).toEqual([])
    expect(crisisCoOccurrences([crise([], 1)], 10)).toEqual([])
  })

  it('allCrisisTriggers : union triée en FR, hors crises', () => {
    const events: HealthEvent[] = [crise(['stress', 'aliment'], 2), crise(['stress'], 1), makeEvent('note', 0, {})]
    expect(allCrisisTriggers(events)).toEqual(['aliment', 'stress'])
  })
})
