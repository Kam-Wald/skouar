import { summarize } from './events'
import { startOfDay } from './agenda'
import type { EventType, HealthEvent, RefEntity } from './store'

const DAY = 86400000

export function filterEvents(events: HealthEvent[], types: EventType[] | null, q: string): HealthEvent[] {
  let arr = events
  if (types && types.length > 0) arr = arr.filter((e) => types.includes(e.type))
  const needle = q.trim().toLowerCase()
  if (needle) arr = arr.filter((e) => `${e.note} ${summarize(e)}`.toLowerCase().includes(needle))
  return arr
}

export interface DayCell {
  start: number
  day: number
  inMonth: boolean
  hasCrise: boolean
  hasCycle: boolean
  hasAny: boolean
}

export function monthGrid(year: number, month: number, events: HealthEvent[]): DayCell[] {
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7
  const gridStart = startOfDay(first.getTime()) - startWeekday * DAY
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const start = gridStart + i * DAY
    const d = new Date(start)
    const dayEv = events.filter((e) => e.date >= start && e.date < start + DAY)
    cells.push({
      start,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      hasCrise: dayEv.some((e) => e.type === 'crise'),
      hasCycle: dayEv.some((e) => e.type === 'cycle'),
      hasAny: dayEv.length > 0
    })
  }
  return cells
}

export function dayEvents(events: HealthEvent[], start: number): HealthEvent[] {
  return events.filter((e) => e.date >= start && e.date < start + DAY).sort((a, b) => a.date - b.date)
}

export const PERIODS = [
  { id: '1m', label: '1 mois', days: 31 },
  { id: '3m', label: '3 mois', days: 93 },
  { id: '1a', label: '1 an', days: 366 }
] as const

export type PeriodId = (typeof PERIODS)[number]['id']

export function windowBounds(days: number, now = Date.now()): { from: number; to: number } {
  const to = startOfDay(now) + DAY
  return { from: to - days * DAY, to }
}

export function eventValue(e: HealthEvent): number | null {
  const p = e.payload
  const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : null)
  switch (e.type) {
    case 'poids':
      return num(p.kg)
    case 'moral':
    case 'energie':
      return num(p.level)
    case 'crise':
      return num(p.intensity)
    case 'sommeil':
      return num(p.qualite)
    case 'symptome':
      return num(p.intensite)
    case 'constante':
      return num(p.valeur)
    default:
      return null
  }
}

export interface SeriesFilter {
  type: EventType
  refId?: string
}

export function seriesFor(filter: SeriesFilter, events: HealthEvent[], from: number, to: number): { date: number; value: number }[] {
  return events
    .filter((e) => e.type === filter.type && e.date >= from && e.date < to && (filter.refId === undefined || e.payload.refId === filter.refId))
    .map((e) => ({ date: e.date, value: eventValue(e) ?? 0 }))
    .filter((p) => p.value !== null && isFinite(p.value))
    .sort((a, b) => a.date - b.date)
}

export function markersIn(events: HealthEvent[], from: number, to: number): HealthEvent[] {
  return events.filter((e) => e.type === 'marqueur' && e.date >= from && e.date < to).sort((a, b) => a.date - b.date)
}

export function suiviOptions(refs: RefEntity[]): { id: string; label: string; filter: SeriesFilter }[] {
  const base: { id: string; label: string; filter: SeriesFilter }[] = [
    { id: 'poids', label: 'Poids (kg)', filter: { type: 'poids' } },
    { id: 'moral', label: 'Moral (1-5)', filter: { type: 'moral' } },
    { id: 'energie', label: 'Énergie (1-5)', filter: { type: 'energie' } },
    { id: 'crise', label: 'Crises (intensité 1-10)', filter: { type: 'crise' } },
    { id: 'sommeil', label: 'Sommeil (qualité 1-5)', filter: { type: 'sommeil' } },
    { id: 'symptome', label: 'Symptômes (intensité 1-10)', filter: { type: 'symptome' } }
  ]
  for (const r of refs.filter((x) => x.kind === 'constante')) {
    base.push({ id: `constante:${r.id}`, label: `Constante — ${r.name}`, filter: { type: 'constante', refId: r.id } })
  }
  return base
}

export const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export const DAYS_FR = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di']
