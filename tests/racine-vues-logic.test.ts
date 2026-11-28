// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { makeEvent, type HealthEvent, type RefEntity } from '../src/apps/racine/store'
import { startOfDay } from '../src/apps/racine/agenda'
import { dayEvents, eventValue, filterEvents, markersIn, monthGrid, seriesFor, suiviOptions, windowBounds } from '../src/apps/racine/vues'

const DAY = 86400000
const now = startOfDay(Date.now()) + 8 * 3600_000

describe('racine — journal/calendrier/courbes (CDC §12/§14, logique)', () => {
  it('filterEvents : par types et par recherche plein texte (note + résumé)', () => {
    const events = [
      makeEvent('moral', now, { level: 4 }, 'bonne journée'),
      makeEvent('crise', now - DAY, { intensity: 7, zone: 'ventre' }, ''),
      makeEvent('poids', now - 2 * DAY, { kg: 72.5 }, 'à jeun')
    ]
    expect(filterEvents(events, null, '').length).toBe(3)
    expect(filterEvents(events, ['crise'], '').map((e) => e.type)).toEqual(['crise'])
    expect(filterEvents(events, ['moral', 'poids'], '').length).toBe(2)
    expect(filterEvents(events, null, 'ventre').map((e) => e.type)).toEqual(['crise'])
    expect(filterEvents(events, null, 'JEUN').map((e) => e.type)).toEqual(['poids'])
    expect(filterEvents(events, ['crise'], 'ventre').length).toBe(1)
    expect(filterEvents(events, null, 'zzz').length).toBe(0)
  })

  it('monthGrid : 42 cases, lundi en tête, marqueurs crise/cycle/saisie, inMonth', () => {
    const y = new Date().getFullYear()
    const m = new Date().getMonth()
    const events = [
      makeEvent('crise', startOfDay(Date.now()), { intensity: 5 }),
      makeEvent('cycle', startOfDay(Date.now()) - 2 * DAY, { debut: 0, fin: 1 })
    ]
    const cells = monthGrid(y, m, events)
    expect(cells.length).toBe(42)
    const first = new Date(y, m, 1)
    expect(new Date(cells[0].start).getDay()).toBe(1)
    const todayCell = cells.find((c) => c.start === startOfDay(Date.now()))!
    expect(todayCell.hasCrise).toBe(true)
    expect(todayCell.hasAny).toBe(true)
    const cycleCell = cells.find((c) => c.start === startOfDay(Date.now()) - 2 * DAY)!
    expect(cycleCell.hasCycle).toBe(true)
    expect(cells.filter((c) => c.inMonth).length).toBe(new Date(y, m + 1, 0).getDate())
    expect(cells.some((c) => !c.hasAny)).toBe(true)
  })

  it('dayEvents + windowBounds + eventValue + seriesFor + markersIn + suiviOptions', () => {
    const events: HealthEvent[] = [
      makeEvent('poids', now, { kg: 72.5 }),
      makeEvent('poids', now - DAY, { kg: 72 }),
      makeEvent('poids', now - 400 * DAY, { kg: 70 }),
      makeEvent('moral', now, { level: 4 }),
      makeEvent('constante', now, { refId: 'c1', valeur: 8, name: 'Tension', unit: '' }),
      makeEvent('marqueur', now, { label: 'début traitement' })
    ]
    expect(dayEvents(events, startOfDay(now)).length).toBe(4)
    const wb = windowBounds(31, now)
    expect(wb.to - wb.from).toBe(31 * DAY)
    expect(eventValue(events[0])).toBe(72.5)
    expect(eventValue(events[3])).toBe(4)
    expect(eventValue(makeEvent('note', now, {}))).toBeNull()
    const poids = seriesFor({ type: 'poids' }, events, wb.from, wb.to)
    expect(poids.map((p) => p.value)).toEqual([72, 72.5])
    const c1 = seriesFor({ type: 'constante', refId: 'c1' }, events, wb.from, wb.to)
    expect(c1.length).toBe(1)
    expect(markersIn(events, wb.from, wb.to).length).toBe(1)
    const refs: RefEntity[] = [{ id: 'c1', kind: 'constante', name: 'Tension', unit: 'mmHg', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: 1 }]
    const opts = suiviOptions(refs)
    expect(opts.length).toBe(7)
    expect(opts[6].label).toBe('Constante — Tension')
  })
})
