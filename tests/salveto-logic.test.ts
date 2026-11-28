import { describe, it, expect } from 'vitest'
import {
  BODY_ZONES,
  addDays,
  bandeauAccueil,
  bienfaits,
  clampInt,
  cooccurrences,
  cyclesOf,
  dayOf,
  diffDays,
  dernieresValeurs,
  echeancesPreventives,
  eventsOfType,
  eventsOnDay,
  fmtDay,
  fmtDuree,
  fmtPct,
  labelOfEvent,
  makeEvent,
  migrateConfig,
  migrateEvents,
  migrateRefs,
  normalizeTrigger,
  phaseOfDay,
  prevision,
  rdvTries,
  seedConfig,
  seedRefs,
  sortEventsDesc,
  timeOf,
  toLocalISO,
  todayDay,
  touchEvent,
  upsertRef,
  validateEvent,
  type RefItem,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs
} from '../src/apps/salveto/logic'

describe('Salveto logic — dates locales', () => {
  it('toLocalISO / dayOf / timeOf au format local attendu', () => {
    const d = new Date(2025, 0, 5, 9, 7, 3)
    const iso = toLocalISO(d)
    expect(iso).toBe('2025-01-05T09:07:03')
    expect(dayOf(iso)).toBe('2025-01-05')
    expect(timeOf(iso)).toBe('09:07')
  })
})

describe('Salveto logic — validateEvent / migrateEvents (non destructif)', () => {
  it('makeEvent pose id, type, date locale, createdAt/updatedAt', () => {
    const e = makeEvent('moral', { value: 4 })
    expect(e.id).toBeTruthy()
    expect(e.type).toBe('moral')
    expect(/^\d{4}-\d{2}-\d{2}T/.test(e.date)).toBe(true)
    expect(e.createdAt).toBe(e.date)
  })

  it('les bornes sont appliquées par type (moral/énergie/sommeil 1-5, crise/symptôme 1-10, poids > 0)', () => {
    expect(validateEvent({ id: 'a', type: 'moral', date: '2025-01-01T10:00:00', value: 9 })?.value).toBe(5)
    expect(validateEvent({ id: 'a', type: 'moral', date: '2025-01-01T10:00:00', value: -2 })?.value).toBe(1)
    expect(validateEvent({ id: 'a', type: 'crise', date: '2025-01-01T10:00:00', value: 42 })?.value).toBe(10)
    expect(validateEvent({ id: 'a', type: 'poids', date: '2025-01-01T10:00:00', value: '72.56' })?.value).toBe(72.6)
    expect(validateEvent({ id: 'a', type: 'poids', date: '2025-01-01T10:00:00', value: -3 })?.value).toBeUndefined()
  })

  it('les entrées invalides sont rejetées, les champs inconnus conservés', () => {
    expect(validateEvent(null)).toBeNull()
    expect(validateEvent({ id: '', type: 'moral', date: '2025-01-01T10:00:00' })).toBeNull()
    expect(validateEvent({ id: 'a', type: 'inconnu', date: '2025-01-01T10:00:00' })).toBeNull()
    expect(validateEvent({ id: 'a', type: 'moral', date: 'pas-une-date' })).toBeNull()
    const e = validateEvent({ id: 'a', type: 'note', date: '2025-01-01T10:00:00', notes: 'x', champFutur: 42 })
    expect(e).not.toBeNull()
    expect((e as unknown as Record<string, unknown>).champFutur).toBe(42)
  })

  it('migrateEvents filtre sans toucher au tableau d’origine', () => {
    const raw = [
      { id: 'a', type: 'moral', date: '2025-01-01T10:00:00', value: 4 },
      { id: 'b', type: 'bidon', date: '2025-01-01T10:00:00' },
      'pas un objet'
    ]
    const out = migrateEvents(raw)
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('a')
    expect(migrateEvents('non')) .toEqual([])
  })

  it('touchEvent met à jour updatedAt sans toucher au reste', () => {
    const e = makeEvent('note', { notes: 'hello' })
    const t = touchEvent(e)
    expect(t.notes).toBe('hello')
    expect(t.updatedAt >= e.updatedAt).toBe(true)
  })
})

describe('Salveto logic — requêtes sur le journal', () => {
  const evs: SalvetoEvent[] = [
    { id: '1', type: 'moral', date: '2025-01-01T08:00:00', value: 3, createdAt: '', updatedAt: '' },
    { id: '2', type: 'crise', date: '2025-01-01T20:00:00', value: 7, label: 'tête', createdAt: '', updatedAt: '' },
    { id: '3', type: 'moral', date: '2025-01-02T09:00:00', value: 5, createdAt: '', updatedAt: '' }
  ]
  it('sortEventsDesc trie du plus récent au plus ancien', () => {
    expect(sortEventsDesc(evs).map((e) => e.id)).toEqual(['3', '2', '1'])
  })
  it('eventsOnDay / eventsOfType filtrent', () => {
    expect(eventsOnDay(evs, '2025-01-01').map((e) => e.id)).toEqual(['2', '1'])
    expect(eventsOfType(evs, 'moral').length).toBe(2)
  })
})

describe('Salveto logic — libellés', () => {
  it('labelOfEvent formate chaque type en français', () => {
    expect(labelOfEvent(makeEvent('moral', { value: 4 }))).toBe('Moral 4/5')
    expect(labelOfEvent(makeEvent('crise', { value: 8, label: 'tête' }))).toBe('Crise 8/10 — tête')
    expect(labelOfEvent(makeEvent('poids', { value: 72.5 }))).toBe('Poids 72.5 kg')
    expect(labelOfEvent(makeEvent('sommeil', { value: 4, heureCoucher: '23:00', heureReveil: '07:30' }))).toBe(
      'Sommeil 23:00 → 07:30, qualité 4/5'
    )
    expect(labelOfEvent(makeEvent('symptome', { label: 'fièvre', value: 6, dureeMin: 90 }))).toBe('Symptôme fièvre 6/10, 1 h 30 min')
    expect(labelOfEvent(makeEvent('note', { notes: 'journée famille' }))).toBe('Note : journée famille')
  })
  it('fmtDuree', () => {
    expect(fmtDuree(45)).toBe('45 min')
    expect(fmtDuree(120)).toBe('2 h')
    expect(fmtDuree(0)).toBe('')
  })
  it('clampInt', () => {
    expect(clampInt('7', 1, 5)).toBe(5)
    expect(clampInt('abc', 1, 5)).toBeUndefined()
  })
})

describe('Salveto logic — config', () => {
  it('migrateConfig conserve les champs inconnus et filtre les suivis inconnus', () => {
    const c = migrateConfig({ version: 1, onboarded: true, activeSuivis: ['moral', 'bidon'], extra: 'ok' })
    expect(c?.onboarded).toBe(true)
    expect(c?.activeSuivis).toEqual(['moral'])
    expect((c as unknown as Record<string, unknown>).extra).toBe('ok')
    expect(migrateConfig({ version: 99 })).toBeUndefined()
    expect(seedConfig().activeSuivis.length).toBe(13)
  })
})

describe('Salveto logic — co-occurrences (4.I)', () => {
  const mk = (id: string, type: SalvetoEvent['type'], date: string, extra: Partial<SalvetoEvent>): SalvetoEvent => ({
    id,
    type,
    date,
    createdAt: date,
    updatedAt: date,
    ...extra
  })
  it('calcule les co-occurrences déclencheurs × crises, normalisées et triées', () => {
    const evs = [
      mk('1', 'crise', '2025-01-01T10:00:00', { declencheurs: ['Stress'] }),
      mk('2', 'crise', '2025-01-02T10:00:00', { declencheurs: [' stress '] }),
      mk('3', 'crise', '2025-01-03T10:00:00', {}),
      mk('4', 'habitude', '2025-01-01T09:00:00', { label: 'Sport' })
    ]
    const co = cooccurrences(evs)
    expect(co.length).toBe(2)
    expect(co[0].trigger.toLowerCase()).toBe('stress')
    expect(co[0].crises).toBe(2)
    expect(co[0].total).toBe(3)
    expect(co[0].ratio).toBeCloseTo(2 / 3)
    const sport = co.find((c) => c.trigger === 'Sport')!
    expect(sport.crises).toBe(1)
  })
  it('habitude sans crise le même jour ne compte pas', () => {
    const evs = [
      mk('1', 'crise', '2025-01-01T10:00:00', {}),
      mk('2', 'habitude', '2025-01-05T09:00:00', { label: 'Sport' })
    ]
    expect(cooccurrences(evs)).toEqual([])
  })
  it('vide sans crise', () => {
    expect(cooccurrences([mk('1', 'note', '2025-01-01T10:00:00', { notes: 'x' })])).toEqual([])
  })
  it('normalizeTrigger + fmtPct + BODY_ZONES', () => {
    expect(normalizeTrigger('  Manque   de Sommeil ')).toBe('manque de sommeil')
    expect(fmtPct(2 / 3)).toBe('67 %')
    expect(BODY_ZONES.some((z) => z.id === 'dos')).toBe(true)
    expect(BODY_ZONES.length).toBe(13)
  })
})

describe('Salveto logic — refs, bienfaits, dernières valeurs (S4)', () => {
  const mk = (id: string, type: SalvetoEvent['type'], date: string, extra: Partial<SalvetoEvent>): SalvetoEvent => ({
    id,
    type,
    date,
    createdAt: date,
    updatedAt: date,
    ...extra
  })

  it('migrateRefs valide les items (id requis, kind connu, label non vide) et conserve les champs inconnus', () => {
    const m = migrateRefs({
      version: 1,
      items: [
        { id: 't1', kind: 'traitement', label: 'Doliprane', extra: 'x' },
        { id: '', kind: 'traitement', label: 'x' },
        { id: 't2', kind: 'bidon', label: 'x' },
        { kind: 'constante', label: 'sans id' },
        'non-objet'
      ]
    })
    expect(m?.items.length).toBe(1)
    expect(m?.items[0].id).toBe('t1')
    expect((m?.items[0] as unknown as Record<string, unknown>).extra).toBe('x')
    expect(migrateRefs({ version: 2 })).toBeUndefined()
    expect(seedRefs().items).toEqual([])
  })

  it('upsertRef ajoute ou remplace par id sans toucher aux autres', () => {
    let refs: SalvetoRefs = seedRefs()
    const a: RefItem = { id: 'a', kind: 'traitement', label: 'A', createdAt: '2025-01-01T00:00:00' }
    const b: RefItem = { id: 'b', kind: 'constante', label: 'Tension', unite: 'mmHg', createdAt: '2025-01-01T00:00:00' }
    refs = upsertRef(refs, a)
    refs = upsertRef(refs, b)
    refs = upsertRef(refs, { ...a, label: 'A renommé' })
    expect(refs.items.length).toBe(2)
    expect(refs.items.find((x) => x.id === 'a')?.label).toBe('A renommé')
  })

  it('bienfaits agrège les effets par traitement et trie du plus bénéfique au moins utile', () => {
    const refs: SalvetoRefs = {
      version: 1,
      items: [
        { id: 'doli', kind: 'traitement', label: 'Doliprane', createdAt: '' },
        { id: 'sport', kind: 'traitement', label: 'Sport', createdAt: '' }
      ]
    }
    const evs = [
      mk('1', 'traitement', '2025-01-01T08:00:00', { refId: 'doli', label: 'Doliprane', effet: 'marqué' }),
      mk('2', 'traitement', '2025-01-02T08:00:00', { refId: 'doli', label: 'Doliprane', effet: 'léger' }),
      mk('3', 'traitement', '2025-01-03T08:00:00', { refId: 'sport', label: 'Sport', effet: 'marqué' }),
      mk('4', 'traitement', '2025-01-04T08:00:00', { refId: 'sport', label: 'Sport', effet: 'négatif' }),
      mk('5', 'moral', '2025-01-01T09:00:00', { value: 4 })
    ]
    const bien = bienfaits(evs, refs)
    expect(bien.map((b) => b.refId)).toEqual(['doli', 'sport'])
    expect(bien[0].score).toBe(3 + 2)
    expect(bien[0].prises).toBe(2)
    expect(bien[0].effetCounts).toEqual({ aucun: 0, léger: 1, marqué: 1, négatif: 0 })
    expect(bien[1].score).toBe(3 - 3)
    expect(bienfaits([mk('1', 'note', '2025-01-01T10:00:00', {})], refs)).toEqual([])
  })

  it('dernieresValeurs garde la valeur la plus récente par constante', () => {
    const refs: SalvetoRefs = {
      version: 1,
      items: [{ id: 'ta', kind: 'constante', label: 'Tension', unite: 'mmHg', createdAt: '' }]
    }
    const evs = [
      mk('1', 'constante', '2025-01-01T08:00:00', { refId: 'ta', label: 'Tension', value: 120 }),
      mk('2', 'constante', '2025-01-05T08:00:00', { refId: 'ta', label: 'Tension', value: 128 })
    ]
    const d = dernieresValeurs(evs, refs)
    expect(d.length).toBe(1)
    expect(d[0].value).toBe(128)
    expect(dayOf(d[0].date!)).toBe('2025-01-05')
  })
})

describe('Salveto logic — jours + cycle menstruel (S5)', () => {
  const mk = (id: string, type: SalvetoEvent['type'], date: string, extra: Partial<SalvetoEvent>): SalvetoEvent => ({
    id,
    type,
    date,
    createdAt: date,
    updatedAt: date,
    ...extra
  })
  it('addDays / diffDays / fmtDay en local', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01')
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01')
    expect(diffDays('2025-01-01', '2025-01-29')).toBe(28)
    expect(fmtDay('2025-01-05')).toBe('05/01/2025')
  })
  it('cyclesOf : durées de règles et de cycle, tri asc, fin invalide ignorée', () => {
    const evs = [
      mk('a', 'cycle', '2025-01-01T08:00:00', { fin: '2025-01-05T22:00:00', flux: 'moyen' }),
      mk('b', 'cycle', '2025-01-29T08:00:00', { fin: '2025-02-02T22:00:00' }),
      mk('c', 'cycle', '2025-02-26T08:00:00', { fin: '2025-02-20T22:00:00' })
    ]
    const cycles = cyclesOf(evs)
    expect(cycles.map((c) => c.debut)).toEqual(['2025-01-01', '2025-01-29', '2025-02-26'])
    expect(cycles[0].dureeRegles).toBe(5)
    expect(cycles[1].dureeCycle).toBe(28)
    expect(cycles[2].dureeCycle).toBe(28)
    expect(cycles[2].fin).toBeUndefined()
    expect(cycles[0].flux).toBe('moyen')
  })
  it('prevision : moyenne des cycles, prochaine période, fenêtre ovulatoire indicative', () => {
    const evs = [
      mk('a', 'cycle', '2025-01-01T08:00:00', { fin: '2025-01-04T22:00:00' }),
      mk('b', 'cycle', '2025-01-29T08:00:00', { fin: '2025-02-01T22:00:00' }),
      mk('c', 'cycle', '2025-02-26T08:00:00', { fin: '2025-03-01T22:00:00' })
    ]
    const p = prevision(cyclesOf(evs))
    expect(p.nbPeriodes).toBe(3)
    expect(p.baseCycles).toBe(2)
    expect(p.moyCycle).toBe(28)
    expect(p.moyRegles).toBe(4)
    expect(p.prochaineRegles).toBe('2025-03-26')
    expect(p.ovulation).toBe('2025-03-12')
    expect(p.fenetreDebut).toBe('2025-03-10')
    expect(p.fenetreFin).toBe('2025-03-14')
  })
  it('prevision sans assez de cycles : pas de prévision', () => {
    const p = prevision(cyclesOf([mk('a', 'cycle', '2025-01-01T08:00:00', {})]))
    expect(p.moyCycle).toBeUndefined()
    expect(p.prochaineRegles).toBeUndefined()
  })
  it('phaseOfDay : règles, ovulatoire, folliculaire, lutéale', () => {
    const evs = [
      mk('a', 'cycle', '2025-01-01T08:00:00', { fin: '2025-01-05T22:00:00' }),
      mk('b', 'cycle', '2025-01-29T08:00:00', { fin: '2025-02-02T22:00:00' })
    ]
    const cycles = cyclesOf(evs)
    expect(phaseOfDay(cycles, '2025-01-03')).toBe('règles')
    expect(phaseOfDay(cycles, '2025-02-12')).toBe('ovulatoire (indicatif)')
    expect(phaseOfDay(cycles, '2025-02-05')).toBe('folliculaire')
    expect(phaseOfDay(cycles, '2025-02-20')).toBe('lutéale')
    expect(phaseOfDay([], '2025-02-20')).toBe('')
  })
  it('labelOfEvent cycle au format lisible', () => {
    expect(labelOfEvent(mk('a', 'cycle', '2025-01-01T08:00:00', { fin: '2025-01-05T22:00:00', flux: 'abondant' }))).toBe(
      'Règles 01/01/2025 → 05/01/2025 · flux abondant'
    )
  })
})

describe('Salveto logic — RDV, ordonnances, préventif, bandeau (S6)', () => {
  const mk = (id: string, type: SalvetoEvent['type'], date: string, extra: Partial<SalvetoEvent>): SalvetoEvent => ({
    id,
    type,
    date,
    createdAt: date,
    updatedAt: date,
    ...extra
  })

  it('rdvTries sépare à venir (asc) et passés (desc) selon aujourd’hui', () => {
    const today = todayDay()
    const evs = [
      mk('p', 'rdv', `${addDays(today, -10)}T10:00:00`, { label: 'passé' }),
      mk('a', 'rdv', `${addDays(today, 3)}T14:00:00`, { label: 'dans 3 j' }),
      mk('b', 'rdv', `${addDays(today, 10)}T09:00:00`, { label: 'dans 10 j' })
    ]
    const { aVenir, passes } = rdvTries(evs)
    expect(aVenir.map((e) => e.id)).toEqual(['a', 'b'])
    expect(passes.map((e) => e.id)).toEqual(['p'])
  })

  it('echeancesPreventives calcule prochaine échéance, retard et jours restants', () => {
    const today = todayDay()
    const refs: SalvetoRefs = {
      version: 1,
      items: [
        {
          id: 'dent',
          kind: 'preventif',
          label: 'Dentiste',
          periodiciteJours: 365,
          derniereVisite: addDays(today, -400),
          createdAt: ''
        },
        { id: 'opht', kind: 'preventif', label: 'Ophtalmo', periodiciteJours: 730, derniereVisite: addDays(today, -100), createdAt: '' }
      ]
    }
    const e = echeancesPreventives(refs)
    expect(e.length).toBe(2)
    const dent = e.find((x) => x.ref.id === 'dent')!
    expect(dent.enRetard).toBe(true)
    expect(dent.prochaine).toBe(addDays(addDays(today, -400), 365))
    const opht = e.find((x) => x.ref.id === 'opht')!
    expect(opht.enRetard).toBe(false)
    expect(opht.dansJours).toBe(630)
  })

  it('bandeauAccueil : RDV proche, ordonnance à renouveler, preventif échu, rappel moral non noté', () => {
    const today = todayDay()
    const cfg: SalvetoConfig = { version: 1, onboarded: true, desktopOnly: true, activeSuivis: ['moral'] }
    const refs: SalvetoRefs = {
      version: 1,
      items: [
        { id: 'dent', kind: 'preventif', label: 'Dentiste', periodiciteJours: 365, derniereVisite: addDays(today, -400), createdAt: '' }
      ]
    }
    const evs = [
      mk('r', 'rdv', `${addDays(today, 3)}T14:00:00`, { label: 'Dr Martin' }),
      mk('o', 'ordonnance', `${addDays(today, -30)}T09:00:00`, { medecin: 'Dr Martin', contenu: 'Doliprane', aRenouveler: true })
    ]
    const b = bandeauAccueil(evs, refs, cfg)
    expect(b.some((x) => x.kind === 'rdv' && x.texte.includes('Dr Martin dans 3 jours'))).toBe(true)
    expect(b.some((x) => x.kind === 'ordonnance' && x.texte.includes('à renouveler'))).toBe(true)
    expect(b.some((x) => x.kind === 'preventif' && x.texte.includes('Dentiste') && x.texte.includes('dépassée'))).toBe(true)
    expect(b.some((x) => x.kind === 'saisie' && x.texte.includes('moral du jour'))).toBe(true)
    // moral noté aujourd’hui → plus de rappel de saisie
    const b2 = bandeauAccueil([...evs, mk('m', 'moral', `${today}T08:00:00`, { value: 4 })], refs, cfg)
    expect(b2.some((x) => x.kind === 'saisie')).toBe(false)
    // suivi moral désactivé → pas de rappel non plus
    const cfg2 = { ...cfg, activeSuivis: [] }
    expect(bandeauAccueil(evs, refs, cfg2).some((x) => x.kind === 'saisie')).toBe(false)
  })

  it('labelOfEvent rdv / ordonnance', () => {
    expect(labelOfEvent(mk('r', 'rdv', '2025-01-10T14:30:00', { label: 'Dr Martin', lieu: 'Centre', motif: 'contrôle' }))).toBe(
      'RDV Dr Martin le 10/01/2025 à 14:30 · Centre · contrôle'
    )
    expect(labelOfEvent(mk('o', 'ordonnance', '2025-01-10T09:00:00', { medecin: 'Dr Martin', aRenouveler: true, fin: '2025-02-10T23:00:00' }))).toBe(
      'Ordonnance de Dr Martin · à renouveler · fin le 10/02/2025'
    )
  })

  it('migrateConfig : questionsRdv défaut [] et conservé si présent', () => {
    expect(migrateConfig({ version: 1, onboarded: true, activeSuivis: [] })?.questionsRdv).toEqual([])
    expect(migrateConfig({ version: 1, onboarded: true, activeSuivis: [], questionsRdv: ['Q1', 42] })?.questionsRdv).toEqual(['Q1'])
  })
})
