import { deleteDatabaseSafe } from '../../shared/db'
import { db, kv, type Attachment, type HealthEvent, type Profile, type RefEntity } from './store'

export const IO_VERSION = 1

export type ImportMode = 'fusion' | 'remplacer'

export interface RacineBackup {
  app: 'racine'
  version: number
  exportedAt: number
  events: HealthEvent[]
  refs: RefEntity[]
  profile: Profile
  attachments: Attachment[]
  questions: string[]
}

const EVENT_TYPES = new Set(['moral', 'energie', 'poids', 'crise', 'sommeil', 'symptome', 'constante', 'cycle', 'traitement', 'habitude', 'rdv', 'ordonnance', 'marqueur', 'note'])
const REF_KINDS = new Set(['constante', 'traitement', 'habitude', 'preventif'])

const b64encode = (buf: ArrayBufferLike): string => {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const b64decode = (b64: string): Uint8Array => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const isBlob = (v: unknown): v is Blob => !!v && typeof v === 'object' && typeof (v as Blob).arrayBuffer === 'function' && typeof (v as Blob).size === 'number'

const serializeValue = async (v: unknown): Promise<unknown> => {
  if (isBlob(v)) return { __blob: true, type: v.type, b64: b64encode(await v.arrayBuffer()) }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = await serializeValue(val)
    return out
  }
  if (Array.isArray(v)) {
    const out: unknown[] = []
    for (const item of v) out.push(await serializeValue(item))
    return out
  }
  return v
}

const deserializeValue = (v: unknown): unknown => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    if (o.__blob === true && typeof o.b64 === 'string') return new Blob([b64decode(o.b64) as BlobPart], { type: String(o.type ?? 'application/octet-stream') })
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) out[k] = deserializeValue(val)
    return out
  }
  if (Array.isArray(v)) return v.map((item) => deserializeValue(item))
  return v
}

export async function exportData(
  events: HealthEvent[],
  refs: RefEntity[],
  profile: Profile,
  attachments: Attachment[],
  questions: string[],
  includeAttachments = true
): Promise<string> {
  const serAtt = includeAttachments
    ? await Promise.all(attachments.map(async (a) => ({ ...a, blob: (await serializeValue(a.blob)) as Attachment['blob'] })))
    : []
  const data: RacineBackup = {
    app: 'racine',
    version: IO_VERSION,
    exportedAt: Date.now(),
    events,
    refs,
    profile,
    attachments: serAtt,
    questions
  }
  return JSON.stringify(data, null, 2)
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

export async function parseBackup(json: string): Promise<RacineBackup> {
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    throw new Error('JSON illisible')
  }
  const b = v as Partial<RacineBackup> | null
  if (!b || typeof b !== 'object' || b.app !== 'racine' || !Array.isArray(b.events) || !Array.isArray(b.refs) || !b.profile || !Array.isArray(b.attachments)) {
    throw new Error('Fichier non reconnu : pas une sauvegarde Racine')
  }
  if (!isNum(b.version) || b.version > IO_VERSION) throw new Error(`Version non supportée : ${String(b.version)}`)
  for (const e of b.events) {
    const o = e as unknown as Record<string, unknown>
    if (!o || typeof o !== 'object' || !isStr(o.id) || typeof o.type !== 'string' || !EVENT_TYPES.has(o.type) || !isNum(o.date) || !o.payload || typeof o.payload !== 'object' || typeof o.note !== 'string') {
      throw new Error('Sauvegarde invalide : événement mal formé')
    }
  }
  for (const r of b.refs) {
    const o = r as unknown as Record<string, unknown>
    if (!o || typeof o !== 'object' || !isStr(o.id) || !isStr(o.name) || typeof o.kind !== 'string' || !REF_KINDS.has(o.kind)) {
      throw new Error('Sauvegarde invalide : entité de référence mal formée')
    }
  }
  for (const a of b.attachments) {
    const o = a as unknown as Record<string, unknown>
    if (!o || typeof o !== 'object' || !isStr(o.id) || !isStr(o.name) || !isNum(o.size) || !o.blob || typeof o.blob !== 'object' || (o.blob as { __blob?: unknown }).__blob !== true) {
      throw new Error('Sauvegarde invalide : pièce jointe mal formée')
    }
  }
  if (!Array.isArray(b.questions) || b.questions.some((q) => typeof q !== 'string')) throw new Error('Sauvegarde invalide : questions mal formées')
  const attachments = b.attachments.map((a) => ({ ...(a as Attachment), blob: deserializeValue((a as Attachment).blob) as Blob }))
  return { ...(b as RacineBackup), attachments }
}

export async function importData(json: string, mode: ImportMode): Promise<{ events: number; refs: number; attachments: number }> {
  const b = await parseBackup(json)
  if (mode === 'remplacer') {
    const ok = await deleteDatabaseSafe(db.name)
    if (!ok) throw new Error(`suppression de « ${db.name} » bloquée — import interrompu, données actuelles intactes`)
    await db.open()
  }
  if (b.events.length) await db.table<HealthEvent, string>('events').bulkPut(b.events)
  if (b.refs.length) await db.table<RefEntity, string>('refs').bulkPut(b.refs)
  if (b.attachments.length) await db.table<Attachment, string>('attachments').bulkPut(b.attachments)
  await db.table<Profile, string>('profile').put(b.profile)
  await kv.saveKV('questions', b.questions)
  return { events: b.events.length, refs: b.refs.length, attachments: b.attachments.length }
}

export function backupFileName(d = new Date()): string {
  return `salveto-sauvegarde-${d.toISOString().slice(0, 10)}.json`
}
