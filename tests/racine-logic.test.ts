// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { APP_DB_MAP } from '../src/shared/db'
import {
  db,
  DEFAULT_RACINE_SETTINGS,
  deleteEvent,
  deleteRef,
  emptyProfile,
  getProfile,
  listEvents,
  listRefs,
  makeEvent,
  saveEvent,
  saveProfile,
  saveRef,
  TRACKERS,
  type RefEntity
} from '../src/apps/racine/store'

describe('racine — store (CDC §16, logique)', () => {
  it('APP_DB_MAP : racine = skouar-racine', () => {
    expect(APP_DB_MAP.racine).toBe('skouar-racine')
  })

  it('events : CRUD, tri date desc, filtre par type', async () => {
    await db.table('events').clear()
    const a = makeEvent('moral', 1000, { level: 3 })
    const b = makeEvent('crise', 3000, { intensity: 7, zone: 'ventre' })
    await saveEvent(b)
    await saveEvent(a)
    const all = await listEvents()
    expect(all.map((e) => e.id)).toEqual([b.id, a.id])
    expect((await listEvents('moral')).map((e) => e.id)).toEqual([a.id])
    expect(all[0].payload).toEqual({ intensity: 7, zone: 'ventre' })
    await deleteEvent(a.id)
    expect((await listEvents()).length).toBe(1)
  })

  it('refs : CRUD par kind', async () => {
    await db.table('refs').clear()
    const r: RefEntity = { id: 'r1', kind: 'constante', name: 'Tension', unit: 'mmHg', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: 1 }
    await saveRef(r)
    expect((await listRefs('constante')).length).toBe(1)
    expect((await listRefs('traitement')).length).toBe(0)
    await deleteRef('r1')
    expect((await listRefs()).length).toBe(0)
  })

  it('profil : vide par défaut, sauvegarde idempotente sur id fixe « profile »', async () => {
    await db.table('profile').clear()
    const p0 = await getProfile()
    expect(p0.id).toBe('profile')
    expect(p0.allergies).toBe('')
    await saveProfile({ ...emptyProfile(), allergies: 'Pénicilline', groupeSanguin: 'O+' })
    await saveProfile({ ...emptyProfile(), allergies: 'Pénicilline', groupeSanguin: 'A-', traitementsCours: 'X' })
    const p1 = await getProfile()
    expect(p1.allergies).toBe('Pénicilline')
    expect(p1.groupeSanguin).toBe('A-')
    expect(p1.traitementsCours).toBe('X')
    expect(p1.updatedAt).toBeGreaterThan(0)
    expect((await db.table('profile').count())).toBe(1)
  })

  it('trackers par défaut : 9 suivis tous actifs, onboarding non fait', () => {
    expect(TRACKERS.length).toBe(9)
    expect(Object.keys(DEFAULT_RACINE_SETTINGS.trackers).sort()).toEqual([...TRACKERS].sort())
    expect(Object.values(DEFAULT_RACINE_SETTINGS.trackers).every(Boolean)).toBe(true)
    expect(DEFAULT_RACINE_SETTINGS.onboarded).toBe(false)
  })
})
