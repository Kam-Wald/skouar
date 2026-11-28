// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { makeEvent, type HealthEvent } from '../src/apps/racine/store'
import { validatePayload } from '../src/apps/racine/events'
import { constanteLastValue, constanteValues, cyclePhaseAt, cyclesFromEvents, cycleStats, predictNextPeriod, predictOvulation, validateConstantePayload, PHASE_LABELS } from '../src/apps/racine/mesures'

const DAY = 86400000
const cycle = (debut: number, fin: number, flux = ''): HealthEvent => makeEvent('cycle', debut, { debut, fin, flux })

describe('racine — constantes + cycle (CDC §6/§7, logique)', () => {
  it('validateConstantePayload + validatePayload constante : refId + valeur (nombre ou texte)', () => {
    expect(validateConstantePayload({ refId: 'c1', valeur: 72.5 })).toBeNull()
    expect(validateConstantePayload({ refId: 'c1', valeur: '12/8' })).toBeNull()
    expect(validateConstantePayload({ refId: '', valeur: 1 })).toContain('Constante')
    expect(validateConstantePayload({ refId: 'c1', valeur: '' })).toContain('Valeur')
    expect(validatePayload('constante', { refId: 'c1', valeur: 7 })).toBeNull()
    expect(validatePayload('constante', { refId: 'c1', valeur: NaN })).toContain('Valeur')
  })

  it('constanteValues / constanteLastValue : valeurs triées, dernière', () => {
    const events = [makeEvent('constante', 3000, { refId: 'c1', valeur: 8 }), makeEvent('constante', 1000, { refId: 'c1', valeur: 7 }), makeEvent('constante', 2000, { refId: 'c2', valeur: 1 })]
    expect(constanteValues(events, 'c1').map((e) => e.date)).toEqual([1000, 3000])
    expect(constanteLastValue(events, 'c1')?.payload.valeur).toBe(8)
    expect(constanteLastValue(events, 'cX')).toBeNull()
  })

  it('cyclesFromEvents : durées (règles inclusif, cycle = écart des débuts), tri desc, invalides ignorés', () => {
    const d1 = 1000 * DAY
    const events = [
      cycle(d1, d1 + 4 * DAY, 'moyen'),
      cycle(d1 + 28 * DAY, d1 + 32 * DAY),
      cycle(d1 + 56 * DAY, d1 + 60 * DAY),
      makeEvent('cycle', 0, { debut: 5, fin: 1 }),
      makeEvent('moral', 0, { level: 3 })
    ]
    const cycles = cyclesFromEvents(events)
    expect(cycles.length).toBe(3)
    expect(cycles[0].debut).toBe(d1 + 56 * DAY)
    expect(cycles.map((c) => c.dureeRegles)).toEqual([5, 5, 5])
    expect(cycles.map((c) => c.dureeCycle)).toEqual([28, 28, null])
    expect(cycles[2].flux).toBe('moyen')
  })

  it('cycleStats + prévisions : moyennes, prochaine période (début+cycleMoy), ovulation (début+cycleMoy−14)', () => {
    const d1 = 1000 * DAY
    const cycles = cyclesFromEvents([cycle(d1, d1 + 4 * DAY), cycle(d1 + 28 * DAY, d1 + 33 * DAY), cycle(d1 + 58 * DAY, d1 + 61 * DAY)])
    const st = cycleStats(cycles)
    expect(st.count).toBe(3)
    expect(st.avgRegles).toBe(5)
    expect(st.avgCycle).toBeCloseTo(29)
    const next = predictNextPeriod(cycles)!
    expect(next.start).toBe((d1 + 58 * DAY) + 29 * DAY)
    expect(next.end - next.start).toBe(5 * DAY)
    expect(predictOvulation(cycles)).toBe((d1 + 58 * DAY) + (29 - 14) * DAY)
    expect(cycleStats([])).toEqual({ count: 0, avgRegles: null, avgCycle: null })
    expect(predictNextPeriod([])).toBeNull()
    expect(predictNextPeriod(cyclesFromEvents([cycle(d1, d1 + 4 * DAY)]))).toBeNull()
  })

  it('cyclePhaseAt : règles, ovulation ±1 j, folliculaire, lutéale', () => {
    const d1 = 1000 * DAY
    const cycles = cyclesFromEvents([cycle(d1, d1 + 4 * DAY), cycle(d1 + 28 * DAY, d1 + 32 * DAY)])
    const ovu = predictOvulation(cycles)!
    expect(cyclePhaseAt(cycles, d1 + 2 * DAY)).toBe('regles')
    expect(cyclePhaseAt(cycles, ovu)).toBe('ovulation')
    expect(cyclePhaseAt(cycles, ovu + DAY)).toBe('ovulation')
    expect(cyclePhaseAt(cycles, d1 + 32 * DAY + 2 * DAY)).toBe('folliculaire')
    expect(cyclePhaseAt(cycles, ovu + 3 * DAY)).toBe('luteale')
    expect(cyclePhaseAt([], d1)).toBeNull()
    expect(PHASE_LABELS.regles).toBe('Règles')
  })
})
