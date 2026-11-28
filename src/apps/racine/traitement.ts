import type { HealthEvent, RefEntity } from './store'

export const EFFETS = ['aucun', 'leger', 'marque', 'negatif'] as const
export type Effet = (typeof EFFETS)[number]

export const EFFET_LABELS: Record<Effet, string> = {
  aucun: 'Aucun',
  leger: 'Léger',
  marque: 'Marqué',
  negatif: 'Négatif'
}

export const EFFET_SCORES: Record<Effet, number> = {
  aucun: 0,
  leger: 1,
  marque: 2,
  negatif: -1
}

export function effetLabel(e: string): string {
  return (EFFET_LABELS as Record<string, string>)[e] ?? e
}

export function effetScore(e: string): number {
  return (EFFET_SCORES as Record<string, number>)[e] ?? 0
}

export function isEffet(e: unknown): e is Effet {
  return typeof e === 'string' && (EFFETS as readonly string[]).includes(e)
}

export interface EffStat {
  refId: string
  name: string
  total: number
  score: number
  counts: Record<string, number>
  lastDate: number
}

export function efficaciteStats(events: HealthEvent[], refs: RefEntity[]): EffStat[] {
  const byId = new Map(refs.filter((r) => r.kind === 'traitement').map((r) => [r.id, r]))
  const groups = new Map<string, HealthEvent[]>()
  for (const e of events) {
    if (e.type !== 'traitement') continue
    const rid = String(e.payload.refId ?? '')
    if (!rid) continue
    const arr = groups.get(rid) ?? []
    arr.push(e)
    groups.set(rid, arr)
  }
  const stats: EffStat[] = []
  for (const [refId, evs] of groups) {
    const counts: Record<string, number> = {}
    let sum = 0
    for (const e of evs) {
      const f = isEffet(e.payload.effet) ? e.payload.effet : 'aucun'
      counts[f] = (counts[f] ?? 0) + 1
      sum += effetScore(f)
    }
    stats.push({
      refId,
      name: byId.get(refId)?.name ?? String(evs[0].payload.name ?? 'Traitement supprimé'),
      total: evs.length,
      score: sum / evs.length,
      counts,
      lastDate: Math.max(...evs.map((e) => e.date))
    })
  }
  return stats.sort((a, b) => b.score - a.score || b.total - a.total || a.name.localeCompare(b.name, 'fr'))
}

export function fmtScore(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1).replace('.', ',')
}

export function fmtCounts(counts: Record<string, number>): string {
  return EFFETS.filter((e) => counts[e])
    .sort((a, b) => counts[b] - counts[a])
    .map((e) => `${counts[e]} ${EFFET_LABELS[e].toLowerCase()}${counts[e] > 1 ? 's' : ''}`)
    .join(', ')
}
