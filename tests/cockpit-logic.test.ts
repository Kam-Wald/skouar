import { describe, it, expect } from 'vitest'
import {
  fmt,
  dayKey,
  lastDays,
  pomodoroPlan,
  focusByDay,
  estVsActual,
  pareto,
  quadOf,
  QUADS,
  WIP_LIMIT,
  wipExceeded,
  energyByDay,
  bestEnergyHour,
  adviceFor,
  reviewSummary,
  BREATH
} from '../src/apps/cockpit/logic'

const at = (y: number, m: number, d: number, h = 10): number => new Date(y, m - 1, d, h, 0, 0).getTime()

describe('fmt', () => {
  it('formate mm:ss et h:mm:ss', () => {
    expect(fmt(0)).toBe('00:00')
    expect(fmt(65)).toBe('01:05')
    expect(fmt(599)).toBe('09:59')
    expect(fmt(3661)).toBe('1:01:01')
    expect(fmt(-5)).toBe('00:00')
  })
})

describe('dayKey / lastDays', () => {
  it('dayKey padde', () => {
    expect(dayKey(new Date(2025, 0, 5))).toBe('2025-01-05')
    expect(dayKey(new Date(2025, 11, 31))).toBe('2025-12-31')
  })
  it('lastDays renvoie n jours ordonnés finissant aujourd’hui', () => {
    const now = new Date(2025, 5, 10, 15, 30)
    const days = lastDays(7, now)
    expect(days.length).toBe(7)
    expect(days[6]).toBe('2025-06-10')
    expect(days[0]).toBe('2025-06-04')
  })
})

describe('pomodoroPlan', () => {
  it('alterne focus/pause, longue pause en dernier', () => {
    const plan = pomodoroPlan(25, 5, 15, 2)
    expect(plan.map((p) => p.kind)).toEqual(['focus', 'pause', 'focus', 'pause'])
    expect(plan[0].sec).toBe(1500)
    expect(plan[1].sec).toBe(300)
    expect(plan[3].sec).toBe(900)
    expect(plan[3].label).toBe('Longue pause')
  })
  it('clamp cycles 1..8 et min 1 min', () => {
    expect(pomodoroPlan(25, 5, 15, 99).length).toBe(16)
    expect(pomodoroPlan(0, 0, 0, 0)[0].sec).toBe(60)
  })
})

describe('focusByDay', () => {
  it('somme les sessions focus par jour, ignore les autres kinds', () => {
    const days = [dayKey(new Date(2025, 5, 10)), dayKey(new Date(2025, 5, 11))]
    const sessions = [
      { kind: 'focus', actualSec: 1500, at: at(2025, 6, 10, 9) },
      { kind: 'focus', actualSec: 600, at: at(2025, 6, 10, 15) },
      { kind: 'pause', actualSec: 300, at: at(2025, 6, 10, 11) },
      { kind: 'focus', actualSec: 1800, at: at(2025, 6, 11, 9) },
      { kind: 'focus', actualSec: 9999, at: at(2024, 1, 1, 9) }
    ]
    expect(focusByDay(sessions, days)).toEqual([
      { day: days[0], min: 35 },
      { day: days[1], min: 30 }
    ])
  })
})

describe('estVsActual', () => {
  it('compare estimations et sessions focus', () => {
    const r = estVsActual([{ estMin: 30 }, { estMin: 60 }], [
      { kind: 'focus', actualSec: 2700, at: at(2025, 6, 10) },
      { kind: 'custom', actualSec: 600, at: at(2025, 6, 10) }
    ])
    expect(r).toEqual({ est: 90, act: 45 })
  })
})

describe('pareto', () => {
  it('trie par valeur décroissante, coupe à 80 %', () => {
    const tasks = [
      { id: 'a', title: 'A', col: 'done', estMin: 10, value: 50, doneAt: at(2025, 6, 1) },
      { id: 'b', title: 'B', col: 'done', estMin: 10, value: 30, doneAt: at(2025, 6, 2) },
      { id: 'c', title: 'C', col: 'done', estMin: 10, value: 20, doneAt: at(2025, 6, 3) },
      { id: 'd', title: 'D', col: 'done', estMin: 10, value: 0, doneAt: at(2025, 6, 4) },
      { id: 'e', title: 'E', col: 'todo', estMin: 10, value: 100, doneAt: null }
    ]
    const rows = pareto(tasks)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows[0].cum).toBeCloseTo(0.5)
    expect(rows[1].cum).toBeCloseTo(0.8)
  })
  it('vide si aucune tâche terminée avec valeur', () => {
    expect(pareto([{ id: 'x', title: 'X', col: 'done', estMin: 5, value: 0, doneAt: 1 }])).toEqual([])
  })
})

describe('matrice Eisenhower', () => {
  it('quadOf couvre les 4 quadrants', () => {
    expect(quadOf({ urgent: true, important: true })).toBe('do-now')
    expect(quadOf({ urgent: false, important: true })).toBe('plan')
    expect(quadOf({ urgent: true, important: false })).toBe('delegate')
    expect(quadOf({ urgent: false, important: false })).toBe('drop')
    expect(Object.keys(QUADS).length).toBe(4)
    for (const q of Object.values(QUADS)) {
      expect(q.label && q.hint && q.advice).toBeTruthy()
    }
  })
  it('wipExceeded respecte la limite', () => {
    expect(wipExceeded(WIP_LIMIT)).toBe(false)
    expect(wipExceeded(WIP_LIMIT + 1)).toBe(true)
  })
})

describe('énergie', () => {
  it('energyByDay moyenne ou null', () => {
    const days = [dayKey(new Date(2025, 5, 10)), dayKey(new Date(2025, 5, 11))]
    const sessions = [
      { kind: 'focus', actualSec: 100, at: at(2025, 6, 10, 9), energy: 4 },
      { kind: 'focus', actualSec: 100, at: at(2025, 6, 10, 11), energy: 2 },
      { kind: 'focus', actualSec: 100, at: at(2025, 6, 11, 9), energy: 5 }
    ]
    const r = energyByDay(sessions, days)
    expect(r[0]).toEqual({ day: days[0], avg: 3 })
    expect(r[1]).toEqual({ day: days[1], avg: 5 })
    expect(energyByDay([], days)[0].avg).toBeNull()
  })
  it('bestEnergyHour exige au moins 2 sessions par heure', () => {
    const sessions = [
      { kind: 'focus', actualSec: 10, at: at(2025, 6, 10, 9), energy: 5 },
      { kind: 'focus', actualSec: 10, at: at(2025, 6, 11, 9), energy: 3 },
      { kind: 'focus', actualSec: 10, at: at(2025, 6, 12, 14), energy: 5 }
    ]
    expect(bestEnergyHour(sessions)).toBe(9)
    expect(bestEnergyHour([])).toBeNull()
  })
})

describe('adviceFor', () => {
  it('déclenche les conseils pertinents, max 5', () => {
    const today = dayKey(new Date(2025, 5, 10))
    const days = lastDays(7, new Date(2025, 5, 10, 12))
    const tasks = [
      { id: 't1', title: 'Grosse tâche', col: 'todo', estMin: 300, urgent: false, important: true, value: 5, doneAt: null },
      { id: 't2', title: 'Mail rapide', col: 'todo', estMin: 2, urgent: false, important: false, value: 1, doneAt: null },
      { id: 'd1', title: 'En cours 1', col: 'doing', estMin: 30, doneAt: null },
      { id: 'd2', title: 'En cours 2', col: 'doing', estMin: 30, doneAt: null },
      { id: 'd3', title: 'En cours 3', col: 'doing', estMin: 30, doneAt: null },
      { id: 'd4', title: 'En cours 4', col: 'doing', estMin: 30, doneAt: null }
    ]
    const advices = adviceFor({ tasks, sessions: [], days, today, shutdownDays: [] })
    const icons = advices.map((a) => a.icon)
    expect(icons).toContain('✂️')
    expect(icons).toContain('🚧')
    expect(icons).toContain('⚡')
    expect(icons).toContain('🌙')
    expect(icons).toContain('🎯')
    expect(advices.length).toBeLessThanOrEqual(5)
  })
  it('conseil énergie quand bestEnergyHour existe', () => {
    const today = dayKey(new Date(2025, 5, 10))
    const days = lastDays(7, new Date(2025, 5, 10, 20))
    const sessions = [
      { kind: 'focus', actualSec: 1500, at: at(2025, 6, 9, 8), energy: 5 },
      { kind: 'focus', actualSec: 1500, at: at(2025, 6, 10, 8), energy: 4 }
    ]
    const advices = adviceFor({ tasks: [], sessions, days, today, shutdownDays: [days[6]] })
    expect(advices.some((a) => a.icon === '🔋' && a.text.includes('8 h'))).toBe(true)
  })
})

describe('reviewSummary', () => {
  it('résume la semaine honnêtement', () => {
    const lines = reviewSummary({ weekMin: 700, est: 600, act: 900, paretoRows: 3, totalDone: 10 })
    expect(lines[0]).toContain('700 min')
    expect(lines[1]).toContain('150 %')
    expect(lines[2]).toContain('Pareto')
  })
  it('estimations justes', () => {
    const lines = reviewSummary({ weekMin: 100, est: 500, act: 500, paretoRows: 0, totalDone: 0 })
    expect(lines[1]).toContain('justes')
    expect(lines.length).toBe(2)
  })
})

describe('BREATH', () => {
  it('4-7-8', () => {
    expect(BREATH.map((b) => b.sec)).toEqual([4, 7, 8])
  })
})
