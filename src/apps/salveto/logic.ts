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
  questionsRdv?: string[]
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
    activeSuivis: active,
    questionsRdv: Array.isArray(r.questionsRdv) ? r.questionsRdv.filter((x): x is string => typeof x === 'string') : []
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
  fin?: string
  flux?: string
  lieu?: string
  motif?: string
  statut?: string
  medecin?: string
  contenu?: string
  aRenouveler?: boolean
  crDiag?: string
  crExamens?: string
  crProchaine?: string
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
      return `Règles ${fmtDay(dayOf(e.date))}${e.fin ? ` → ${fmtDay(dayOf(e.fin))}` : ''}${e.flux ? ` · flux ${e.flux}` : ''}${e.notes ? ` · ${e.notes}` : ''}`
    case 'rdv':
      return `RDV ${e.label ?? ''} le ${fmtDay(dayOf(e.date))} à ${timeOf(e.date)}${e.lieu ? ` · ${e.lieu}` : ''}${e.motif ? ` · ${e.motif}` : ''}`
    case 'ordonnance':
      return `Ordonnance${e.medecin ? ` de ${e.medecin}` : ''}${e.aRenouveler ? ' · à renouveler' : ''}${e.fin ? ` · fin le ${fmtDay(dayOf(e.fin))}` : ''}`
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

/* ---------- Jours (arithmétique locale, sans fuseau) ---------- */

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

export function toDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return toDay(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
}

export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

/* ---------- Cycle menstruel (7) — calculs 100 % locaux, indicatifs ---------- */

export const FLUX_SUGGESTIONS = ['léger', 'moyen', 'abondant', 'glaires cervicales', 'spotting', 'autre']

export interface CycleInfo {
  eventId: string
  debut: string
  fin?: string
  dureeRegles: number
  dureeCycle?: number
  flux?: string
  notes?: string
}

export function cyclesOf(events: SalvetoEvent[]): CycleInfo[] {
  const evs = sortEventsDesc(eventsOfType(events, 'cycle')).reverse()
  const out: CycleInfo[] = []
  let prevDebut: string | undefined
  for (const e of evs) {
    const debut = dayOf(e.date)
    const finRaw = e.fin ? dayOf(e.fin) : undefined
    const fin = finRaw && diffDays(debut, finRaw) >= 0 ? finRaw : undefined
    const dureeRegles = fin ? Math.max(1, diffDays(debut, fin) + 1) : 1
    out.push({
      eventId: e.id,
      debut,
      fin,
      dureeRegles,
      dureeCycle: prevDebut ? diffDays(prevDebut, debut) : undefined,
      flux: e.flux,
      notes: e.notes
    })
    prevDebut = debut
  }
  return out
}

export interface Prevision {
  nbPeriodes: number
  baseCycles: number
  moyCycle?: number
  moyRegles?: number
  prochaineRegles?: string
  ovulation?: string
  fenetreDebut?: string
  fenetreFin?: string
}

export function prevision(cycles: CycleInfo[]): Prevision {
  const durees = cycles.map((c) => c.dureeCycle).filter((d): d is number => d != null && d >= 15 && d <= 60)
  const regles = cycles.map((c) => c.dureeRegles)
  const moyCycle = durees.length ? Math.round(durees.reduce((a, b) => a + b, 0) / durees.length) : undefined
  const moyRegles = regles.length
    ? Math.round((regles.reduce((a, b) => a + b, 0) / regles.length) * 10) / 10
    : undefined
  const dernier = cycles[cycles.length - 1]
  let prochaineRegles: string | undefined
  let ovulation: string | undefined
  let fenetreDebut: string | undefined
  let fenetreFin: string | undefined
  if (dernier && moyCycle) {
    prochaineRegles = addDays(dernier.debut, moyCycle)
    ovulation = addDays(prochaineRegles, -14)
    fenetreDebut = addDays(ovulation, -2)
    fenetreFin = addDays(ovulation, 2)
  }
  return {
    nbPeriodes: cycles.length,
    baseCycles: durees.length,
    moyCycle,
    moyRegles,
    prochaineRegles,
    ovulation,
    fenetreDebut,
    fenetreFin
  }
}

export function phaseOfDay(cycles: CycleInfo[], day: string): string {
  if (cycles.length === 0) return ''
  for (const c of cycles) {
    if (day >= c.debut && (c.fin ? day <= c.fin : day === c.debut)) return 'règles'
  }
  const p = prevision(cycles)
  if (p.fenetreDebut && p.fenetreFin && day >= p.fenetreDebut && day <= p.fenetreFin) return 'ovulatoire (indicatif)'
  if (p.prochaineRegles && day < p.prochaineRegles) {
    const dernier = cycles[cycles.length - 1]
    const ovul = p.ovulation ?? ''
    if (day > dernier.debut && ovul && day < ovul) return 'folliculaire'
    if (ovul && day > ovul) return 'lutéale'
  }
  return ''
}

/* ---------- RDV, ordonnances, échéancier préventif (8, 10, 11) ---------- */

export function rdvTries(events: SalvetoEvent[]): { aVenir: SalvetoEvent[]; passes: SalvetoEvent[] } {
  const today = todayDay()
  const rdvs = eventsOfType(events, 'rdv')
  const aVenir = rdvs.filter((e) => dayOf(e.date) >= today).sort((a, b) => (a.date < b.date ? -1 : 1))
  const passes = sortEventsDesc(rdvs.filter((e) => dayOf(e.date) < today))
  return { aVenir, passes }
}

export interface EcheancePreventif {
  ref: RefItem
  derniere: string
  prochaine: string
  enRetard: boolean
  dansJours: number
}

export function echeancesPreventives(refs: SalvetoRefs): EcheancePreventif[] {
  const today = todayDay()
  return refs.items
    .filter((r) => r.kind === 'preventif' && r.derniereVisite && r.periodiciteJours && r.periodiciteJours > 0)
    .map((r) => {
      const prochaine = addDays(r.derniereVisite!, r.periodiciteJours!)
      return {
        ref: r,
        derniere: r.derniereVisite!,
        prochaine,
        enRetard: prochaine < today,
        dansJours: diffDays(today, prochaine)
      }
    })
    .sort((a, b) => a.prochaine.localeCompare(b.prochaine))
}

export interface BandeauItem {
  kind: 'rdv' | 'ordonnance' | 'preventif' | 'saisie'
  texte: string
}

export function bandeauAccueil(events: SalvetoEvent[], refs: SalvetoRefs, config: SalvetoConfig): BandeauItem[] {
  const out: BandeauItem[] = []
  const today = todayDay()
  const { aVenir } = rdvTries(events)
  const prochain = aVenir[0]
  if (prochain) {
    const j = diffDays(today, dayOf(prochain.date))
    const qui = prochain.label ?? 'sans nom'
    out.push({
      kind: 'rdv',
      texte:
        j <= 0
          ? `RDV ${qui} aujourd’hui à ${timeOf(prochain.date)}`
          : j === 1
            ? `RDV ${qui} demain (${fmtDay(dayOf(prochain.date))})`
            : `RDV ${qui} dans ${j} jours (${fmtDay(dayOf(prochain.date))})`
    })
  }
  for (const o of sortEventsDesc(eventsOfType(events, 'ordonnance'))) {
    const qui = o.medecin ? ` de ${o.medecin}` : ''
    if (o.aRenouveler) {
      out.push({
        kind: 'ordonnance',
        texte: `Ordonnance${qui} à renouveler${o.fin ? ` (fin le ${fmtDay(dayOf(o.fin))})` : ''}`
      })
    } else if (o.fin) {
      const j = diffDays(today, dayOf(o.fin))
      if (j >= 0 && j <= 14) {
        out.push({
          kind: 'ordonnance',
          texte: `Ordonnance${qui} se termine dans ${j} j (${fmtDay(dayOf(o.fin))})`
        })
      }
    }
  }
  for (const e of echeancesPreventives(refs)) {
    if (e.enRetard || e.dansJours <= 7) {
      out.push({
        kind: 'preventif',
        texte: `${e.ref.label} : dernière visite le ${fmtDay(e.derniere)}, échéance ${e.enRetard ? 'dépassée' : `dans ${e.dansJours} j`} (${fmtDay(e.prochaine)})`
      })
    }
  }
  if (config.activeSuivis.includes('moral') && !eventsOnDay(events, today).some((e) => e.type === 'moral')) {
    out.push({ kind: 'saisie', texte: 'Ton moral du jour n’est pas encore noté' })
  }
  return out
}

/* ---------- Entités de référence (16.C) : traitements, constantes ---------- */

export type RefKind = 'traitement' | 'constante' | 'preventif'

export interface RefItem {
  id: string
  kind: RefKind
  label: string
  unite?: string
  seuil?: number
  periodiciteJours?: number
  derniereVisite?: string
  createdAt: string
}

export interface SalvetoRefs {
  version: 1
  items: RefItem[]
}

export const REF_KINDS: RefKind[] = ['traitement', 'constante', 'preventif']

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
