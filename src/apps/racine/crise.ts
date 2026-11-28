import type { HealthEvent } from './store'

export interface BodyZone {
  id: string
  label: string
  left: number
  top: number
  w: number
  h: number
}

export const BODY_ZONES: BodyZone[] = [
  { id: 'tete', label: 'Tête', left: 37, top: 0, w: 26, h: 14 },
  { id: 'cou', label: 'Cou', left: 44, top: 13.5, w: 12, h: 4.5 },
  { id: 'epauleG', label: 'Épaule gauche', left: 15, top: 17.5, w: 25, h: 6 },
  { id: 'epauleD', label: 'Épaule droite', left: 60, top: 17.5, w: 25, h: 6 },
  { id: 'brasG', label: 'Bras gauche', left: 15, top: 19.5, w: 11, h: 26 },
  { id: 'brasD', label: 'Bras droit', left: 74, top: 19.5, w: 11, h: 26 },
  { id: 'poitrine', label: 'Poitrine', left: 30, top: 24, w: 40, h: 12 },
  { id: 'ventre', label: 'Ventre', left: 31, top: 36.5, w: 38, h: 12 },
  { id: 'hanches', label: 'Hanches', left: 31, top: 49, w: 38, h: 9 },
  { id: 'jambes', label: 'Jambes', left: 33, top: 58, w: 34, h: 37 },
  { id: 'pieds', label: 'Pieds', left: 33, top: 95, w: 34, h: 5 }
]

export function zoneLabel(id: string | null | undefined): string {
  return BODY_ZONES.find((z) => z.id === id)?.label ?? ''
}

export function crisisTriggers(e: HealthEvent): string[] {
  const d = e.payload.declencheurs
  return Array.isArray(d) ? d.map(String).filter(Boolean) : []
}

export function toggleTrigger(list: string[], name: string): string[] {
  const n = name.trim()
  if (!n) return list
  return list.includes(n) ? list.filter((x) => x !== n) : [...list, n]
}

export interface CoOcc {
  name: string
  count: number
  total: number
}

export function crisisCoOccurrences(events: HealthEvent[], lastN = 10): CoOcc[] {
  const crises = events.filter((e) => e.type === 'crise').slice(0, lastN)
  const withTriggers = crises.filter((e) => crisisTriggers(e).length > 0)
  const total = withTriggers.length
  const counts = new Map<string, number>()
  for (const c of withTriggers) {
    for (const t of new Set(crisisTriggers(c))) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, total }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
}

export function allCrisisTriggers(events: HealthEvent[]): string[] {
  const set = new Set<string>()
  for (const e of events) {
    if (e.type !== 'crise') continue
    for (const t of crisisTriggers(e)) set.add(t)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
}
