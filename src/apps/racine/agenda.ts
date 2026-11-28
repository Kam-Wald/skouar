import { fmtDay, todayEvents } from './events'
import { kv, type HealthEvent, type RefEntity } from './store'

const DAY = 86400000

export const startOfDay = (ts: number): number => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

export function validateRdv(p: Record<string, unknown>): string | null {
  if (!isNum(p.date)) return 'Date du RDV requise'
  return String(p.praticien ?? '').trim() ? null : 'Praticien requis'
}

export function validateOrdonnance(p: Record<string, unknown>): string | null {
  if (!isNum(p.date)) return 'Date de l’ordonnance requise'
  if (!String(p.medecin ?? '').trim()) return 'Médecin requis'
  return String(p.contenu ?? '').trim() ? null : 'Contenu requis'
}

export function rdvStatut(e: HealthEvent, now: number): 'a-venir' | 'passe' {
  return (e.payload.date as number) < startOfDay(now) ? 'passe' : 'a-venir'
}

export function rdvSorted(events: HealthEvent[]): HealthEvent[] {
  return events.filter((e) => e.type === 'rdv').sort((a, b) => (a.payload.date as number) - (b.payload.date as number))
}

export function ordonnanceProcheFin(e: HealthEvent, now: number, delaiJours = 14): boolean {
  if (e.type !== 'ordonnance') return false
  if (e.payload.renouveler !== true) return false
  const fin = e.payload.fin
  if (!isNum(fin)) return true
  return fin <= now + delaiJours * DAY
}

export interface Echeance {
  next: number
  overdue: boolean
  dueSoon: boolean
}

export function preventifEcheance(r: RefEntity, now: number): Echeance | null {
  if (r.kind !== 'preventif' || !r.periodicityDays || !isNum(r.lastDate)) return null
  const next = r.lastDate + r.periodicityDays * DAY
  return { next, overdue: next < startOfDay(now), dueSoon: next <= now + 7 * DAY }
}

export function bandeauItems(events: HealthEvent[], refs: RefEntity[], now = Date.now()): string[] {
  const items: string[] = []
  for (const e of rdvSorted(events)) {
    if (rdvStatut(e, now) !== 'a-venir') continue
    const diff = Math.round(((e.payload.date as number) - startOfDay(now)) / DAY)
    if (diff <= 7) {
      items.push(`RDV « ${e.payload.praticien} » ${diff <= 0 ? 'aujourd’hui' : diff === 1 ? 'demain' : `dans ${diff} jours`} (${fmtDay(e.payload.date as number)})${e.payload.motif ? ` — ${e.payload.motif}` : ''}`)
    }
  }
  for (const e of events.filter((x) => x.type === 'ordonnance')) {
    if (!ordonnanceProcheFin(e, now)) continue
    const fin = e.payload.fin
    items.push(isNum(fin) ? `Ordonnance de ${e.payload.medecin} se termine le ${fmtDay(fin)}` : `Ordonnance de ${e.payload.medecin} à renouveler`)
  }
  for (const r of refs) {
    const ech = preventifEcheance(r, now)
    if (!ech) continue
    if (ech.overdue) items.push(`Examen « ${r.name} » échu (à faire depuis le ${fmtDay(ech.next)})`)
    else if (ech.dueSoon) items.push(`Examen « ${r.name} » à prévoir avant le ${fmtDay(ech.next)}`)
  }
  if (!todayEvents(events, now).some((e) => e.type === 'moral')) items.push('Ton moral du jour n’est pas encore noté')
  return items
}

export async function listQuestions(): Promise<string[]> {
  return (await kv.loadKV<string[]>('questions')) ?? []
}

export async function saveQuestions(q: string[]): Promise<void> {
  await kv.saveKV('questions', q)
}
