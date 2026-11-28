import { uid } from '../../shared/db'
import { effetLabel, isEffet } from './traitement'
import { listRefs, makeEvent, saveEvent, saveRef, type EventType, type HealthEvent, type RefEntity } from './store'

export const LEVEL_LABELS: Record<'moral' | 'energie', string[]> = {
  moral: ['Mauvais', 'Faible', 'Moyen', 'Bon', 'Très bon'],
  energie: ['Épuisé', 'Faible', 'Moyen', 'Bonne', 'Pleine']
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

export function validatePayload(type: EventType, p: Record<string, unknown>): string | null {
  switch (type) {
    case 'moral':
    case 'energie':
      return isNum(p.level) && p.level >= 1 && p.level <= 5 ? null : 'Niveau 1 à 5 requis'
    case 'poids':
      return isNum(p.kg) && p.kg > 0 && p.kg < 1000 ? null : 'Poids en kg requis (ex. 72,5)'
    case 'crise':
      return p.intensity === null || p.intensity === undefined || (isNum(p.intensity) && p.intensity >= 1 && p.intensity <= 10) ? null : 'Intensité 1 à 10 requise'
    case 'sommeil': {
      const c = String(p.coucher ?? '')
      const r = String(p.reveil ?? '')
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r)) return 'Heures de coucher/réveil au format HH:MM'
      return isNum(p.qualite) && p.qualite >= 1 && p.qualite <= 5 ? null : 'Qualité 1 à 5 requise'
    }
    case 'symptome':
      if (!String(p.type ?? '').trim()) return 'Type de symptôme requis'
      return isNum(p.intensite) && p.intensite >= 1 && p.intensite <= 10 ? null : 'Intensité 1 à 10 requise'
    case 'habitude':
      return String(p.name ?? '').trim() ? null : 'Nom de l’habitude requis'
    case 'traitement':
      if (!String(p.refId ?? '').trim()) return 'Traitement requis'
      return isEffet(p.effet) ? null : 'Effet requis (aucun / léger / marqué / négatif)'
    case 'constante': {
      if (!String(p.refId ?? '').trim()) return 'Constante requise'
      const v = p.valeur
      if (typeof v === 'number' && isFinite(v)) return null
      if (typeof v === 'string' && v.trim()) return null
      return 'Valeur requise'
    }
    case 'rdv':
      if (typeof p.date !== 'number' || !isFinite(p.date)) return 'Date du RDV requise'
      return String(p.praticien ?? '').trim() ? null : 'Praticien requis'
    case 'ordonnance':
      if (typeof p.date !== 'number' || !isFinite(p.date)) return 'Date de l’ordonnance requise'
      if (!String(p.medecin ?? '').trim()) return 'Médecin requis'
      return String(p.contenu ?? '').trim() ? null : 'Contenu requis'
    case 'marqueur':
      return String(p.label ?? '').trim() ? null : 'Libellé du marqueur requis'
    default:
      return null
  }
}

export function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR')
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function summarize(e: HealthEvent): string {
  const p = e.payload
  switch (e.type) {
    case 'moral':
      return `Moral ${p.level}/5`
    case 'energie':
      return `Énergie ${p.level}/5`
    case 'poids':
      return `Poids ${String(p.kg).replace('.', ',')} kg`
    case 'crise':
      return p.intensity === null || p.intensity === undefined ? 'Crise (intensité à définir)' : `Crise — intensité ${p.intensity}/10${p.zone ? ` — ${p.zone}` : ''}`
    case 'sommeil':
      return `Sommeil ${p.coucher} → ${p.reveil} — qualité ${p.qualite}/5`
    case 'symptome':
      return `Symptôme « ${p.type} » — ${p.intensite}/10${p.duree ? `, ${p.duree}` : ''}`
    case 'habitude':
      return `Habitude « ${p.name} »`
    case 'constante':
      return `${p.name ?? 'Constante'} : ${p.valeur}${p.unit ? ` ${p.unit}` : ''}`
    case 'cycle':
      return `Cycle du ${fmtDay(Number(p.debut))} au ${fmtDay(Number(p.fin))}`
    case 'traitement':
      return `Effet « ${p.name} » : ${effetLabel(String(p.effet ?? ''))}`
    case 'rdv':
      return `RDV ${p.praticien}${p.motif ? ` — ${p.motif}` : ''}`
    case 'ordonnance':
      return `Ordonnance — ${p.medecin}`
    case 'marqueur':
      return `Marqueur « ${p.label} »`
    case 'note':
      return 'Note libre'
    default:
      return e.type
  }
}

export function todayEvents(events: HealthEvent[], now = Date.now()): HealthEvent[] {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const end = start + 86400000
  return events.filter((e) => e.date >= start && e.date < end).sort((a, b) => a.date - b.date)
}

export async function ensureRef(kind: RefEntity['kind'], name: string): Promise<RefEntity> {
  const n = name.trim()
  const existing = (await listRefs(kind)).find((r) => r.name.toLowerCase() === n.toLowerCase())
  if (existing) return existing
  const r: RefEntity = { id: uid(), kind, name: n, unit: '', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: Date.now() }
  await saveRef(r)
  return r
}

export async function addEvent(type: EventType, payload: Record<string, unknown>, note = '', date = Date.now()): Promise<HealthEvent | null> {
  const err = validatePayload(type, payload)
  if (err) return null
  const e = makeEvent(type, date, payload, note)
  await saveEvent(e)
  return e
}
