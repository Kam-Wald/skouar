// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, listEvents, listRefs } from '../src/apps/racine/store'
import { addEvent, ensureRef, summarize, todayEvents, validatePayload } from '../src/apps/racine/events'
import { makeEvent } from '../src/apps/racine/store'

describe('racine — saisie rapide (CDC §4, logique)', () => {
  it('validatePayload : chaque type a ses bornes', () => {
    expect(validatePayload('moral', { level: 3 })).toBeNull()
    expect(validatePayload('moral', { level: 6 })).toContain('1 à 5')
    expect(validatePayload('energie', { level: 0 })).toContain('1 à 5')
    expect(validatePayload('poids', { kg: 72.5 })).toBeNull()
    expect(validatePayload('poids', { kg: -2 })).toContain('kg')
    expect(validatePayload('crise', { intensity: null })).toBeNull()
    expect(validatePayload('crise', { intensity: 7 })).toBeNull()
    expect(validatePayload('crise', { intensity: 11 })).toContain('1 à 10')
    expect(validatePayload('sommeil', { coucher: '22:30', reveil: '07:00', qualite: 4 })).toBeNull()
    expect(validatePayload('sommeil', { coucher: '25:00', reveil: '07:00', qualite: 4 })).toContain('HH:MM')
    expect(validatePayload('sommeil', { coucher: '22:30', reveil: '07:00', qualite: 9 })).toContain('Qualité')
    expect(validatePayload('symptome', { type: 'fièvre', intensite: 8, duree: '2 h' })).toBeNull()
    expect(validatePayload('symptome', { type: '', intensite: 8 })).toContain('symptôme')
    expect(validatePayload('symptome', { type: 'fièvre', intensite: 0 })).toContain('1 à 10')
    expect(validatePayload('habitude', { name: 'sport' })).toBeNull()
    expect(validatePayload('habitude', { name: '  ' })).toContain('habitude')
    expect(validatePayload('note', {})).toBeNull()
  })

  it('summarize : libellés lisibles par type', () => {
    expect(summarize(makeEvent('moral', 0, { level: 4 }))).toBe('Moral 4/5')
    expect(summarize(makeEvent('poids', 0, { kg: 72.5 }))).toBe('Poids 72,5 kg')
    expect(summarize(makeEvent('crise', 0, { intensity: null }))).toBe('Crise (intensité à définir)')
    expect(summarize(makeEvent('crise', 0, { intensity: 7, zone: 'ventre' }))).toBe('Crise — intensité 7/10 — ventre')
    expect(summarize(makeEvent('sommeil', 0, { coucher: '22:30', reveil: '07:00', qualite: 4 }))).toBe('Sommeil 22:30 → 07:00 — qualité 4/5')
    expect(summarize(makeEvent('symptome', 0, { type: 'fièvre', intensite: 8, duree: '2 h' }))).toBe('Symptôme « fièvre » — 8/10, 2 h')
    expect(summarize(makeEvent('habitude', 0, { name: 'sport' }))).toBe('Habitude « sport »')
    expect(summarize(makeEvent('note', 0, {}))).toBe('Note libre')
  })

  it('todayEvents : filtre sur la journée courante, tri horaire croissant', () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0).getTime()
    const events = [
      makeEvent('note', start + 3600_000, {}),
      makeEvent('moral', start + 60_000, { level: 2 }),
      makeEvent('note', start - 86400_000, {})
    ]
    const t = todayEvents(events, start + 7200_000)
    expect(t.map((e) => e.type)).toEqual(['moral', 'note'])
  })

  it('ensureRef : crée une entité de référence une seule fois (insensible à la casse)', async () => {
    await db.table('refs').clear()
    const a = await ensureRef('habitude', 'Sport')
    const b = await ensureRef('habitude', 'sport')
    expect(a.id).toBe(b.id)
    expect((await listRefs('habitude')).length).toBe(1)
  })

  it('addEvent : valide puis persiste, renvoie null si invalide (rien n’est écrit)', async () => {
    await db.table('events').clear()
    const ok = await addEvent('moral', { level: 5 }, 'bonne journée', 1000)
    expect(ok).toBeTruthy()
    const ko = await addEvent('poids', { kg: -1 })
    expect(ko).toBeNull()
    const all = await listEvents()
    expect(all.length).toBe(1)
    expect(all[0].note).toBe('bonne journée')
    expect(all[0].date).toBe(1000)
  })
})
