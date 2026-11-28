import { uid } from '../../shared/db'

export const SCHEMA_VERSION = 1

export type SuiviId =
  | 'moral'
  | 'energie'
  | 'poids'
  | 'crise'
  | 'sommeil'
  | 'symptome'
  | 'habitude'
  | 'note'
  | 'constante'
  | 'traitement'
  | 'cycle'
  | 'rdv'
  | 'marqueur'

export interface SuiviDef {
  id: SuiviId
  label: string
  desc: string
  icon: string
}

export const ALL_SUIVIS: SuiviDef[] = [
  { id: 'moral', label: 'Moral', desc: 'Ton humeur du jour, de 1 à 5', icon: '🙂' },
  { id: 'energie', label: 'Énergie', desc: 'Ton niveau d’énergie, de 1 à 5', icon: '⚡' },
  { id: 'poids', label: 'Poids', desc: 'Ta courbe de poids', icon: '⚖️' },
  { id: 'crise', label: 'Crises & douleurs', desc: 'Bouton « + crise », intensité et localisation', icon: '💥' },
  { id: 'sommeil', label: 'Sommeil', desc: 'Heures de coucher/réveil et qualité', icon: '🌙' },
  { id: 'symptome', label: 'Symptômes', desc: 'Fièvre, fatigue, digestion, vertiges…', icon: '🤒' },
  { id: 'habitude', label: 'Habitudes & activités', desc: 'Sport, sorties, écran, aliment inhabituel…', icon: '🏃' },
  { id: 'note', label: 'Note libre', desc: 'Une pensée, un contexte, daté', icon: '✏️' },
  { id: 'constante', label: 'Constantes', desc: 'Tension, température, glycémie… à la carte', icon: '🌡️' },
  { id: 'traitement', label: 'Traitements & efficacité', desc: 'Ce qui te fait du bien, effet ressenti', icon: '💊' },
  { id: 'cycle', label: 'Cycle menstruel', desc: 'Périodes et prévisions indicatives', icon: '🌸' },
  { id: 'rdv', label: 'RDV & ordonnances', desc: 'Rendez-vous, comptes-rendus, ordonnances', icon: '🗓️' },
  { id: 'marqueur', label: 'Marqueurs', desc: 'Événements épinglés sur les courbes', icon: '📌' }
]

export const SUIVI_IDS: SuiviId[] = ALL_SUIVIS.map((s) => s.id)

export interface SalvetoConfig {
  version: 1
  onboarded: boolean
  desktopOnly: boolean
  activeSuivis: SuiviId[]
}

export function seedConfig(): SalvetoConfig {
  return { version: 1, onboarded: false, desktopOnly: true, activeSuivis: [...SUIVI_IDS] }
}

export function migrateConfig(raw: unknown): SalvetoConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.version !== 'number' || r.version < 1 || r.version > SCHEMA_VERSION) return undefined
  const known = new Set<string>(SUIVI_IDS)
  const active = Array.isArray(r.activeSuivis)
    ? r.activeSuivis.filter((x): x is SuiviId => typeof x === 'string' && known.has(x))
    : [...SUIVI_IDS]
  return {
    ...(r as object),
    version: 1,
    onboarded: r.onboarded === true,
    desktopOnly: r.desktopOnly !== false,
    activeSuivis: active
  } as SalvetoConfig
}

export function isSuiviActive(config: SalvetoConfig, id: SuiviId): boolean {
  return config.activeSuivis.includes(id)
}

/* ---------- Événements datés (16.A / 16.B) ---------- */

export type EventType =
  | 'moral'
  | 'energie'
  | 'poids'
  | 'crise'
  | 'sommeil'
  | 'symptome'
  | 'constante'
  | 'cycle'
  | 'traitement'
  | 'habitude'
  | 'rdv'
  | 'ordonnance'
  | 'marqueur'
  | 'note'

export const EVENT_TYPES: EventType[] = [
  'moral',
  'energie',
  'poids',
  'crise',
  'sommeil',
  'symptome',
  'constante',
  'cycle',
  'traitement',
  'habitude',
  'rdv',
  'ordonnance',
  'marqueur',
  'note'
]

export interface SalvetoEvent {
  id: string
  type: EventType
  date: string
  value?: number
  label?: string
  heureCoucher?: string
  heureReveil?: string
  dureeMin?: number
  zones?: string[]
  declencheurs?: string[]
  refId?: string
  effet?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

export function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

export function todayDay(): string {
  return dayOf(toLocalISO(new Date()))
}

export function clampInt(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function clampNum(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  return Math.max(min, Math.min(max, n))
}

export const MORAL_LABELS = ['Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Très bon'] as const

export function makeEvent(type: EventType, patch: Partial<SalvetoEvent> = {}): SalvetoEvent {
  const now = toLocalISO(new Date())
  return { id: uid(), type, date: now, createdAt: now, updatedAt: now, ...patch }
}

export function touchEvent(e: SalvetoEvent): SalvetoEvent {
  return { ...e, updatedAt: toLocalISO(new Date()) }
}

export function validateEvent(raw: unknown): SalvetoEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  if (typeof r.type !== 'string' || !EVENT_TYPES.includes(r.type as EventType)) return null
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.date)) return null
  const e = { ...r, type: r.type as EventType } as unknown as SalvetoEvent
  if (e.type === 'moral' || e.type === 'energie' || e.type === 'sommeil') e.value = clampInt(e.value, 1, 5)
  else if (e.type === 'crise' || e.type === 'symptome') e.value = clampInt(e.value, 1, 10)
  else if (e.type === 'poids') {
    const p = typeof e.value === 'number' ? e.value : Number(e.value)
    e.value = Number.isFinite(p) && p > 0 && p < 1000 ? Math.round(p * 10) / 10 : undefined
  }
  if (typeof e.createdAt !== 'string') e.createdAt = e.date
  if (typeof e.updatedAt !== 'string') e.updatedAt = e.date
  return e
}

export function migrateEvents(raw: unknown): SalvetoEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map(validateEvent).filter((e): e is SalvetoEvent => e !== null)
}

export function sortEventsDesc(events: SalvetoEvent[]): SalvetoEvent[] {
  return [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)))
}

export function eventsOfType(events: SalvetoEvent[], type: EventType): SalvetoEvent[] {
  return events.filter((e) => e.type === type)
}

export function eventsOnDay(events: SalvetoEvent[], day: string): SalvetoEvent[] {
  return sortEventsDesc(events.filter((e) => dayOf(e.date) === day))
}

export function fmtDuree(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return ''
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function labelOfEvent(e: SalvetoEvent): string {
  switch (e.type) {
    case 'moral':
      return `Moral ${e.value ?? '?'}/5${e.notes ? ` — ${e.notes}` : ''}`
    case 'energie':
      return `Énergie ${e.value ?? '?'}/5${e.notes ? ` — ${e.notes}` : ''}`
    case 'poids':
      return `Poids ${e.value ?? '?'} kg`
    case 'crise':
      return `Crise ${e.value ?? '?'}/10${e.label ? ` — ${e.label}` : ''}`
    case 'sommeil':
      return `Sommeil ${e.heureCoucher || '—'} → ${e.heureReveil || '—'}, qualité ${e.value ?? '?'}/5`
    case 'symptome':
      return `Symptôme ${e.label ?? ''} ${e.value ?? '?'}/10${e.dureeMin ? `, ${fmtDuree(e.dureeMin)}` : ''}`
    case 'habitude':
      return `Habitude : ${e.label ?? ''}`
    case 'note':
      return `Note : ${(e.notes ?? '').slice(0, 80)}`
    case 'constante':
      return `Constante ${e.label ?? ''} : ${e.value ?? '?'}`
    case 'traitement':
      return `Prise ${e.label ?? ''} — effet ${e.effet ?? '?'}`
    case 'cycle':
      return `Cycle ${e.label ?? ''}`
    case 'rdv':
      return `RDV ${e.label ?? ''}`
    case 'ordonnance':
      return `Ordonnance ${e.label ?? ''}`
    case 'marqueur':
      return `📌 ${e.label ?? ''}`
    default:
      return e.type
  }
}

export const HABITUDE_SUGGESTIONS = ['Sport', 'Sortie', 'Temps d’écran élevé', 'Vie sociale', 'Aliment inhabituel']

export const EFFETS = ['aucun', 'léger', 'marqué', 'négatif'] as const
export type Effet = (typeof EFFETS)[number]

/* ---------- Carte du corps (4.E) ---------- */

export interface BodyZone {
  id: string
  label: string
}

export const BODY_ZONES: BodyZone[] = [
  { id: 'tete', label: 'Tête' },
  { id: 'cou', label: 'Cou' },
  { id: 'epaule', label: 'Épaules' },
  { id: 'bras', label: 'Bras' },
  { id: 'main', label: 'Mains' },
  { id: 'poitrine', label: 'Poitrine' },
  { id: 'ventre', label: 'Ventre' },
  { id: 'dos', label: 'Dos' },
  { id: 'hanche', label: 'Hanches / fesses' },
  { id: 'cuisse', label: 'Cuisses' },
  { id: 'genou', label: 'Genoux' },
  { id: 'mollet', label: 'Mollets' },
  { id: 'pied', label: 'Pieds' }
]

export const DECLENCHEUR_SUGGESTIONS = [
  'Aliment',
  'Manque de sommeil',
  'Stress',
  'Météo',
  'Effort physique',
  'Temps d’écran',
  'Autre'
]

/* ---------- Co-occurrences (4.I) — observation statistique uniquement ---------- */

export interface Cooc {
  trigger: string
  crises: number
  total: number
  ratio: number
}

export function normalizeTrigger(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function cooccurrences(events: SalvetoEvent[]): Cooc[] {
  const crises = eventsOfType(events, 'crise')
  if (crises.length === 0) return []
  const crisesByDay = new Map<string, number>()
  for (const c of crises) {
    const d = dayOf(c.date)
    crisesByDay.set(d, (crisesByDay.get(d) ?? 0) + 1)
  }
  const map = new Map<string, { label: string; crises: number }>()
  const bump = (raw: string, n: number): void => {
    const k = normalizeTrigger(raw)
    if (!k || n <= 0) return
    const cur = map.get(k)
    if (cur) cur.crises += n
    else map.set(k, { label: raw.trim(), crises: n })
  }
  for (const c of crises) {
    for (const d of c.declencheurs ?? []) bump(d, 1)
  }
  for (const h of eventsOfType(events, 'habitude')) {
    if (!h.label) continue
    bump(h.label, crisesByDay.get(dayOf(h.date)) ?? 0)
  }
  return [...map.values()]
    .map((v) => ({ trigger: v.label, crises: v.crises, total: crises.length, ratio: v.crises / crises.length }))
    .sort((a, b) => b.crises - a.crises || b.ratio - a.ratio || a.trigger.localeCompare(b.trigger))
}

export function fmtPct(r: number): string {
  return `${Math.round(r * 100)} %`
}

/* ---------- Entités de référence (16.C) : traitements, constantes ---------- */

export type RefKind = 'traitement' | 'constante'

export interface RefItem {
  id: string
  kind: RefKind
  label: string
  unite?: string
  seuil?: number
  createdAt: string
}

export interface SalvetoRefs {
  version: 1
  items: RefItem[]
}

export const REF_KINDS: RefKind[] = ['traitement', 'constante']

export function seedRefs(): SalvetoRefs {
  return { version: 1, items: [] }
}

export function migrateRefs(raw: unknown): SalvetoRefs | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || !Array.isArray(r.items)) return undefined
  const items: RefItem[] = []
  for (const it of r.items) {
    if (!it || typeof it !== 'object') continue
    const x = it as Record<string, unknown>
    if (typeof x.id !== 'string' || !x.id) continue
    if (typeof x.kind !== 'string' || !REF_KINDS.includes(x.kind as RefKind)) continue
    if (typeof x.label !== 'string' || !x.label.trim()) continue
    items.push({
      ...(x as object),
      kind: x.kind as RefKind,
      label: x.label,
      createdAt: typeof x.createdAt === 'string' ? x.createdAt : toLocalISO(new Date())
    } as RefItem)
  }
  return { ...(r as object), version: 1, items }
}

export function upsertRef(refs: SalvetoRefs, item: RefItem): SalvetoRefs {
  const i = refs.items.findIndex((x) => x.id === item.id)
  const items = i >= 0 ? refs.items.map((x) => (x.id === item.id ? { ...x, ...item } : x)) : [...refs.items, item]
  return { ...refs, items }
}

export function labelOfRef(refs: SalvetoRefs, id: string): string | undefined {
  return refs.items.find((x) => x.id === id)?.label
}

/* ---------- Efficacité ressentie (5.A / 5.B) — observation passive uniquement ---------- */

export const EFFET_SCORE: Record<Effet, number> = { marqué: 3, léger: 2, aucun: 0, négatif: -3 }

export interface Bienfait {
  refId: string
  label: string
  prises: number
  effetCounts: Record<Effet, number>
  score: number
}

export function emptyEffetCounts(): Record<Effet, number> {
  return { aucun: 0, léger: 0, marqué: 0, négatif: 0 }
}

export function bienfaits(events: SalvetoEvent[], refs: SalvetoRefs): Bienfait[] {
  const map = new Map<string, Bienfait>()
  for (const e of eventsOfType(events, 'traitement')) {
    const refId = e.refId ?? e.label ?? '?'
    const label = e.label ?? labelOfRef(refs, refId) ?? refId
    const cur = map.get(refId) ?? { refId, label, prises: 0, effetCounts: emptyEffetCounts(), score: 0 }
    cur.prises += 1
    if (e.effet && (EFFETS as readonly string[]).includes(e.effet)) {
      const eff = e.effet as Effet
      cur.effetCounts[eff] += 1
      cur.score += EFFET_SCORE[eff]
    }
    map.set(refId, cur)
  }
  return [...map.values()].sort((a, b) => b.score - a.score || b.prises - a.prises || a.label.localeCompare(b.label))
}

export interface DerniereValeur {
  refId: string
  label: string
  unite?: string
  value?: number
  date?: string
}

export function dernieresValeurs(events: SalvetoEvent[], refs: SalvetoRefs): DerniereValeur[] {
  const last = new Map<string, SalvetoEvent>()
  for (const e of eventsOfType(events, 'constante')) {
    const id = e.refId ?? e.label ?? '?'
    const cur = last.get(id)
    if (!cur || e.date > cur.date) last.set(id, e)
  }
  return refs.items
    .filter((r) => r.kind === 'constante')
    .map((r) => {
      const e = last.get(r.id)
      return { refId: r.id, label: r.label, unite: r.unite, value: e?.value, date: e?.date }
    })
}
