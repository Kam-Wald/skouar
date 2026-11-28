// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { makeEvent, type HealthEvent, type RefEntity } from '../src/apps/racine/store'
import { bandeauItems, ordonnanceProcheFin, preventifEcheance, rdvSorted, rdvStatut, startOfDay, validateOrdonnance, validateRdv } from '../src/apps/racine/agenda'
import { validatePayload } from '../src/apps/racine/events'

const DAY = 86400000
const now = startOfDay(Date.now()) + 12 * 3600_000

const ref = (over: Partial<RefEntity>): RefEntity => ({ id: 'p1', kind: 'preventif', name: 'Dentiste', unit: '', threshold: null, periodicityDays: 180, lastDate: now - 200 * DAY, active: true, createdAt: 1, ...over })

describe('racine — RDV/ordonnances/préventif/bandeau (CDC §8/§10/§11/15.A, logique)', () => {
  it('startOfDay + validateRdv/Ordonnance + validatePayload', () => {
    expect(startOfDay(now)).toBeLessThanOrEqual(now)
    expect(validateRdv({ date: now, praticien: 'Dr House' })).toBeNull()
    expect(validateRdv({ date: NaN, praticien: 'X' })).toContain('Date')
    expect(validateRdv({ date: now, praticien: '' })).toContain('Praticien')
    expect(validateOrdonnance({ date: now, medecin: 'Dr House', contenu: 'Doliprane' })).toBeNull()
    expect(validateOrdonnance({ date: now, medecin: '', contenu: 'X' })).toContain('Médecin')
    expect(validateOrdonnance({ date: now, medecin: 'X', contenu: '' })).toContain('Contenu')
    expect(validatePayload('rdv', { date: now, praticien: 'X' })).toBeNull()
    expect(validatePayload('ordonnance', { date: now, medecin: 'X', contenu: 'Y' })).toBeNull()
    expect(validatePayload('ordonnance', { date: now, medecin: 'X', contenu: '' })).toContain('Contenu')
  })

  it('rdvStatut / rdvSorted : passé si date < aujourd’hui, tri date asc', () => {
    const events: HealthEvent[] = [
      makeEvent('rdv', 0, { date: now + 5 * DAY, praticien: 'B' }),
      makeEvent('rdv', 0, { date: now - 2 * DAY, praticien: 'A' }),
      makeEvent('moral', 0, { level: 3 })
    ]
    expect(rdvStatut(events[0], now)).toBe('a-venir')
    expect(rdvStatut(events[1], now)).toBe('passe')
    expect(rdvSorted(events).map((e) => e.payload.praticien)).toEqual(['A', 'B'])
  })

  it('ordonnanceProcheFin : renouveler + fin ≤ 14 j, ou pas de fin', () => {
    const o = (fin: unknown, renouveler = true) => makeEvent('ordonnance', 0, { date: now, medecin: 'X', contenu: 'Y', renouveler, fin })
    expect(ordonnanceProcheFin(o(now + 5 * DAY), now)).toBe(true)
    expect(ordonnanceProcheFin(o(now + 30 * DAY), now)).toBe(false)
    expect(ordonnanceProcheFin(o(null), now)).toBe(true)
    expect(ordonnanceProcheFin(o(now + 5 * DAY, false), now)).toBe(false)
  })

  it('preventifEcheance : échu / à prévoir / ok', () => {
    expect(preventifEcheance(ref({ lastDate: now - 200 * DAY }), now)?.overdue).toBe(true)
    expect(preventifEcheance(ref({ lastDate: now - 175 * DAY }), now)?.dueSoon).toBe(true)
    expect(preventifEcheance(ref({ lastDate: now - 100 * DAY }), now)?.dueSoon).toBe(false)
    expect(preventifEcheance(ref({ lastDate: null }), now)).toBeNull()
  })

  it('bandeauItems : RDV ≤ 7 j, ordonnances proches, préventif échu, rappel moral — et ordre', () => {
    const sod = startOfDay(now)
    const events: HealthEvent[] = [
      makeEvent('rdv', 0, { date: sod + 3 * DAY, praticien: 'Dr House', motif: 'contrôle' }),
      makeEvent('rdv', 0, { date: sod + 30 * DAY, praticien: 'Loin' }),
      makeEvent('rdv', 0, { date: sod - DAY, praticien: 'Passé' }),
      makeEvent('ordonnance', 0, { date: now, medecin: 'Dr House', contenu: 'Doliprane', renouveler: true, fin: now + 5 * DAY }),
      makeEvent('ordonnance', 0, { date: now, medecin: 'Loin', contenu: 'X', renouveler: true, fin: now + 60 * DAY })
    ]
    const refs = [ref({ name: 'Dentiste', lastDate: now - 200 * DAY }), ref({ id: 'p2', name: 'Ophtalmo', lastDate: now - 175 * DAY })]
    const items = bandeauItems(events, refs, now)
    expect(items[0]).toContain('RDV « Dr House » dans 3 jours')
    expect(items.some((i) => i.includes('Loin') && i.includes('RDV'))).toBe(false)
    expect(items.some((i) => i.includes('Passé'))).toBe(false)
    expect(items.some((i) => i.includes('Ordonnance de Dr House se termine le'))).toBe(true)
    expect(items.some((i) => i.includes('Ordonnance de Loin'))).toBe(false)
    expect(items.some((i) => i.includes('Dentiste') && i.includes('échu'))).toBe(true)
    expect(items.some((i) => i.includes('Ophtalmo') && i.includes('à prévoir'))).toBe(true)
    expect(items[items.length - 1]).toContain('moral du jour')
    const withMoral = bandeauItems([...events, makeEvent('moral', now, { level: 4 })], refs, now)
    expect(withMoral.some((i) => i.includes('moral du jour'))).toBe(false)
    expect(bandeauItems([], [], now)).toEqual(['Ton moral du jour n’est pas encore noté'])
  })
})
