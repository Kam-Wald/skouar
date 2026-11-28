import { deleteDatabaseSafe } from '../../shared/db'
import { db, kv, type Category, type FieldDef, type Sheet } from './store'

export const IO_VERSION = 1

export type ImportMode = 'fusion' | 'remplacer'

export interface FichoramaBackup {
  app: 'fichorama'
  version: number
  exportedAt: number
  categories: Category[]
  sheets: Sheet[]
}

const FIELD_TYPES = new Set(['texte', 'texte-long', 'nombre', 'date', 'liste', 'case'])

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

const isBlob = (v: unknown): v is Blob =>
  !!v && typeof v === 'object' && typeof (v as Blob).arrayBuffer === 'function' && typeof (v as Blob).size === 'number'

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

export async function exportData(categories: Category[], sheets: Sheet[]): Promise<string> {
  const ser = await Promise.all(
    sheets.map(async (s) => ({ ...s, image: s.image ? ((await serializeValue(s.image)) as Sheet['image']) : null }))
  )
  const data: FichoramaBackup = { app: 'fichorama', version: IO_VERSION, exportedAt: Date.now(), categories, sheets: ser }
  return JSON.stringify(data, null, 2)
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

function checkField(f: unknown, where: string): asserts f is FieldDef {
  if (!f || typeof f !== 'object') throw new Error(`Sauvegarde invalide : champ mal formé (${where})`)
  const o = f as Record<string, unknown>
  if (!isStr(o.id) || !isStr(o.label) || typeof o.type !== 'string' || !FIELD_TYPES.has(o.type)) throw new Error(`Sauvegarde invalide : type de champ inconnu (${where})`)
  if (o.options !== undefined && (!Array.isArray(o.options) || o.options.some((x) => typeof x !== 'string'))) throw new Error(`Sauvegarde invalide : options de champ (${where})`)
  if (o.required !== undefined && !isBool(o.required)) throw new Error(`Sauvegarde invalide : champ obligatoire (${where})`)
}

export async function parseBackup(json: string): Promise<FichoramaBackup> {
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    throw new Error('JSON illisible')
  }
  const b = v as Partial<FichoramaBackup> | null
  if (!b || typeof b !== 'object' || b.app !== 'fichorama' || !Array.isArray(b.categories) || !Array.isArray(b.sheets)) {
    throw new Error('Fichier non reconnu : pas une sauvegarde Fichorama')
  }
  if (!isNum(b.version) || b.version > IO_VERSION) throw new Error(`Version non supportée : ${String(b.version)}`)
  for (const c of b.categories) {
    if (!c || typeof c !== 'object') throw new Error('Sauvegarde invalide : catégorie mal formée')
    const o = c as unknown as Record<string, unknown>
    if (!isStr(o.id) || !isStr(o.name) || !Array.isArray(o.fields) || !Array.isArray(o.removedFields) || !isNum(o.createdAt)) {
      throw new Error('Sauvegarde invalide : catégorie mal formée')
    }
    for (const f of o.fields) checkField(f, `catégorie ${o.name}`)
    for (const f of o.removedFields) checkField(f, `catégorie ${o.name} (champs retirés)`)
  }
  for (const s of b.sheets) {
    if (!s || typeof s !== 'object') throw new Error('Sauvegarde invalide : fiche mal formée')
    const o = s as unknown as Record<string, unknown>
    if (!isStr(o.id) || !isStr(o.categoryId) || !isStr(o.title)) throw new Error('Sauvegarde invalide : fiche mal formée (id/catégorie/titre)')
    if (!isNum(o.note) || o.note < 0 || o.note > 10) throw new Error('Sauvegarde invalide : note hors 0–10')
    if (!Array.isArray(o.notes) || o.notes.some((n) => !n || typeof n !== 'object' || !isNum((n as { value?: unknown }).value) || !isNum((n as { date?: unknown }).date))) {
      throw new Error('Sauvegarde invalide : historique de notes')
    }
    if (!isBool(o.fav) || typeof o.comment !== 'string' || !isNum(o.createdAt) || !isNum(o.updatedAt)) throw new Error('Sauvegarde invalide : fiche mal formée (fav/commentaire/dates)')
    if (!o.values || typeof o.values !== 'object' || Array.isArray(o.values)) throw new Error('Sauvegarde invalide : valeurs de champs')
    if (o.image !== null && o.image !== undefined && (typeof o.image !== 'object' || (o.image as { __blob?: unknown }).__blob !== true)) {
      throw new Error('Sauvegarde invalide : image mal formée')
    }
  }
  const sheets = b.sheets.map((s) => ({ ...(s as Sheet), image: (deserializeValue((s as Sheet).image) as Blob | null) ?? null }))
  return { ...(b as FichoramaBackup), sheets }
}

export async function importData(json: string, mode: ImportMode): Promise<{ categories: number; sheets: number }> {
  const b = await parseBackup(json)
  if (mode === 'remplacer') {
    const ok = await deleteDatabaseSafe(db.name)
    if (!ok) throw new Error(`suppression de « ${db.name} » bloquée — import interrompu, données actuelles intactes`)
    await db.open()
  }
  if (b.categories.length) await db.table<Category, string>('categories').bulkPut(b.categories)
  if (b.sheets.length) await db.table<Sheet, string>('sheets').bulkPut(b.sheets)
  await kv.saveKV('seeded', true)
  return { categories: b.categories.length, sheets: b.sheets.length }
}

export function backupFileName(d = new Date()): string {
  return `fichorama-sauvegarde-${d.toISOString().slice(0, 10)}.json`
}
