import { createAppDb, kvOf, uid } from '../../shared/db'

export const db = createAppDb('skouar-racine', [
  { version: 1, stores: { kv: 'id', events: 'id', refs: 'id', profile: 'id', attachments: 'id' } }
])

export const kv = kvOf(db)

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

export interface HealthEvent {
  id: string
  type: EventType
  date: number
  payload: Record<string, unknown>
  note: string
  createdAt: number
  updatedAt: number
}

export type RefKind = 'constante' | 'traitement' | 'habitude' | 'preventif'

export interface RefEntity {
  id: string
  kind: RefKind
  name: string
  unit: string
  threshold: number | null
  periodicityDays: number | null
  lastDate: number | null
  active: boolean
  createdAt: number
}

export interface Profile {
  id: 'profile'
  antecedents: string
  maladies: string
  allergies: string
  groupeSanguin: string
  traitementsCours: string
  vaccinations: string
  antecedentsFamiliaux: string
  contactUrgence: string
  updatedAt: number
}

export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  blob: Blob
  eventId: string | null
  createdAt: number
}

export const TRACKERS: EventType[] = ['moral', 'energie', 'poids', 'crise', 'sommeil', 'symptome', 'habitude', 'note', 'cycle']

export const TRACKER_LABELS: Record<EventType, string> = {
  moral: 'Moral',
  energie: 'Énergie',
  poids: 'Poids',
  crise: 'Crise / douleur',
  sommeil: 'Sommeil',
  symptome: 'Symptôme',
  constante: 'Constante',
  cycle: 'Cycle',
  traitement: 'Traitement / efficacité',
  habitude: 'Habitude',
  rdv: 'RDV',
  ordonnance: 'Ordonnance',
  marqueur: 'Marqueur',
  note: 'Note libre'
}

export interface RacineSettings {
  onboarded: boolean
  trackers: Record<string, boolean>
}

export const DEFAULT_RACINE_SETTINGS: RacineSettings = {
  onboarded: false,
  trackers: Object.fromEntries(TRACKERS.map((t) => [t, true]))
}

export function emptyProfile(): Profile {
  return {
    id: 'profile',
    antecedents: '',
    maladies: '',
    allergies: '',
    groupeSanguin: '',
    traitementsCours: '',
    vaccinations: '',
    antecedentsFamiliaux: '',
    contactUrgence: '',
    updatedAt: 0
  }
}

export function makeEvent(type: EventType, date: number, payload: Record<string, unknown> = {}, note = ''): HealthEvent {
  const now = Date.now()
  return { id: uid(), type, date, payload, note, createdAt: now, updatedAt: now }
}

export async function listEvents(type?: EventType): Promise<HealthEvent[]> {
  const all = await db.table<HealthEvent, string>('events').toArray()
  return all.filter((e) => !type || e.type === type).sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)
}

export async function saveEvent(e: HealthEvent): Promise<void> {
  e.updatedAt = Date.now()
  await db.table<HealthEvent, string>('events').put(e)
}

export async function deleteEvent(id: string): Promise<void> {
  await db.table<HealthEvent, string>('events').delete(id)
}

export async function listRefs(kind?: RefKind): Promise<RefEntity[]> {
  const all = await db.table<RefEntity, string>('refs').toArray()
  return all.filter((r) => !kind || r.kind === kind).sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveRef(r: RefEntity): Promise<void> {
  await db.table<RefEntity, string>('refs').put(r)
}

export async function deleteRef(id: string): Promise<void> {
  await db.table<RefEntity, string>('refs').delete(id)
}

export async function getProfile(): Promise<Profile> {
  return (await db.table<Profile, string>('profile').get('profile')) ?? emptyProfile()
}

export async function saveProfile(p: Profile): Promise<void> {
  await db.table<Profile, string>('profile').put({ ...p, id: 'profile', updatedAt: Date.now() })
}

export async function listAttachments(eventId?: string | null): Promise<Attachment[]> {
  const all = await db.table<Attachment, string>('attachments').toArray()
  return all.filter((a) => eventId === undefined || a.eventId === eventId).sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveAttachment(a: Attachment): Promise<void> {
  await db.table<Attachment, string>('attachments').put(a)
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.table<Attachment, string>('attachments').delete(id)
}

export function dbName(): string {
  return db.name
}
