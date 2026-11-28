import { fmtDay } from './events'
import type { HealthEvent } from './store'

const DAY = 86400000

export function validateConstantePayload(p: Record<string, unknown>): string | null {
  if (!String(p.refId ?? '').trim()) return 'Constante requise'
  const v = p.valeur
  if (typeof v === 'number' && isFinite(v)) return null
  if (typeof v === 'string' && v.trim()) return null
  return 'Valeur requise'
}

export function constanteValues(events: HealthEvent[], refId: string): HealthEvent[] {
  return events.filter((e) => e.type === 'constante' && e.payload.refId === refId).sort((a, b) => a.date - b.date)
}

export function constanteLastValue(events: HealthEvent[], refId: string): HealthEvent | null {
  const vs = constanteValues(events, refId)
  return vs.length ? vs[vs.length - 1] : null
}

export interface CycleInfo {
  id: string
  debut: number
  fin: number
  dureeRegles: number
  dureeCycle: number | null
  flux: string
  note: string
}

export function cyclesFromEvents(events: HealthEvent[]): CycleInfo[] {
  return events
    .filter((e) => e.type === 'cycle' && typeof e.payload.debut === 'number' && typeof e.payload.fin === 'number' && (e.payload.fin as number) >= (e.payload.debut as number))
    .map((e) => ({
      id: e.id,
      debut: e.payload.debut as number,
      fin: e.payload.fin as number,
      dureeRegles: Math.round(((e.payload.fin as number) - (e.payload.debut as number)) / DAY) + 1,
      dureeCycle: null as number | null,
      flux: String(e.payload.flux ?? ''),
      note: e.note
    }))
    .sort((a, b) => b.debut - a.debut)
    .map((c, i, arr) => ({ ...c, dureeCycle: i < arr.length - 1 ? Math.round((c.debut - arr[i + 1].debut) / DAY) : null }))
}

export interface CycleStats {
  count: number
  avgRegles: number | null
  avgCycle: number | null
}

export function cycleStats(cycles: CycleInfo[]): CycleStats {
  if (!cycles.length) return { count: 0, avgRegles: null, avgCycle: null }
  const regles = cycles.map((c) => c.dureeRegles)
  const withCycle = cycles.filter((c) => c.dureeCycle !== null)
  const round1 = (n: number): number => Math.round(n * 10) / 10
  return {
    count: cycles.length,
    avgRegles: round1(regles.reduce((a, b) => a + b, 0) / regles.length),
    avgCycle: withCycle.length ? round1(withCycle.reduce((a, c) => a + (c.dureeCycle ?? 0), 0) / withCycle.length) : null
  }
}

export function predictNextPeriod(cycles: CycleInfo[]): { start: number; end: number } | null {
  const st = cycleStats(cycles)
  if (!cycles.length || st.avgCycle === null || st.avgRegles === null) return null
  const start = cycles[0].debut + Math.round(st.avgCycle) * DAY
  return { start, end: start + Math.round(st.avgRegles) * DAY }
}

export function predictOvulation(cycles: CycleInfo[]): number | null {
  const st = cycleStats(cycles)
  if (!cycles.length || st.avgCycle === null) return null
  return cycles[0].debut + (Math.round(st.avgCycle) - 14) * DAY
}

export type CyclePhase = 'regles' | 'folliculaire' | 'ovulation' | 'luteale'

export const PHASE_LABELS: Record<CyclePhase, string> = {
  regles: 'Règles',
  folliculaire: 'Folliculaire',
  ovulation: 'Ovulation (indicative)',
  luteale: 'Lutéale'
}

export function cyclePhaseAt(cycles: CycleInfo[], ts: number): CyclePhase | null {
  if (!cycles.length) return null
  const last = cycles[0]
  if (cycles.some((c) => ts >= c.debut && ts <= c.fin + DAY)) return 'regles'
  const ovu = predictOvulation(cycles)
  if (ovu !== null && Math.abs(ts - ovu) <= DAY) return 'ovulation'
  if (ts > last.fin && (!ovu || ts < ovu)) return 'folliculaire'
  const next = predictNextPeriod(cycles)
  if (ovu !== null && ts > ovu && (!next || ts < next.start)) return 'luteale'
  return null
}

export function fmtCycleRange(start: number, end: number): string {
  return `du ${fmtDay(start)} au ${fmtDay(end)}`
}
