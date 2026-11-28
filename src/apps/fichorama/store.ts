import { createAppDb, kvOf, uid } from '../../shared/db'

export const db = createAppDb('skouar-fichorama', [
  { version: 1, stores: { kv: 'id', categories: 'id', sheets: 'id' } }
])

export const kv = kvOf(db)

export type FieldType = 'texte' | 'texte-long' | 'nombre' | 'date' | 'liste' | 'case'

export interface FieldDef {
  id: string
  label: string
  type: FieldType
  options?: string[]
  required?: boolean
}

export interface Category {
  id: string
  name: string
  fields: FieldDef[]
  removedFields: FieldDef[]
  createdAt: number
}

export type SheetValues = Record<string, unknown>

export interface NoteEntry {
  value: number
  date: number
}

export interface Sheet {
  id: string
  categoryId: string
  title: string
  note: number
  notes: NoteEntry[]
  fav: boolean
  comment: string
  image: Blob | null
  values: SheetValues
  createdAt: number
  updatedAt: number
}

interface CategorySeed {
  name: string
  fields: { label: string; type: FieldType; options?: string[] }[]
}

const GENRES = ['Action', 'Aventure', 'Comédie', 'Drame', 'Fantastique', 'Horreur', 'Romance', 'Science-fiction', 'Thriller', 'Documentaire']
const PLATS = ['Entrée', 'Plat', 'Dessert', 'Apéro', 'Boisson', 'Autre']
const DIFF = ['Facile', 'Moyen', 'Difficile']
const AMBIANCES = ['Chic', 'Convivial', 'Bruyant', 'Intime', 'Branché', 'Familial']
const ARTS = ['Peinture', 'Sculpture', 'Photo', 'Installation', 'Art contemporain', 'Autre']
const PLATEFORMES = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Autre']

export const DEFAULT_CATEGORY_SEEDS: CategorySeed[] = [
  { name: 'Films', fields: [{ label: 'Réalisateur', type: 'texte' }, { label: 'Année', type: 'nombre' }, { label: 'Genre', type: 'liste', options: GENRES }, { label: 'Durée (min)', type: 'nombre' }] },
  { name: 'Livres', fields: [{ label: 'Auteur', type: 'texte' }, { label: 'Année', type: 'nombre' }, { label: 'Genre', type: 'liste', options: GENRES }, { label: 'Lu le', type: 'date' }] },
  { name: 'Albums', fields: [{ label: 'Artiste', type: 'texte' }, { label: 'Année', type: 'nombre' }, { label: 'Genre', type: 'liste', options: ['Rock', 'Pop', 'Jazz', 'Électro', 'Hip-hop', 'Classique', 'Autre'] }] },
  { name: 'Mangas/BD', fields: [{ label: 'Auteur', type: 'texte' }, { label: 'Tome', type: 'nombre' }, { label: 'Année', type: 'nombre' }] },
  { name: 'Jeux vidéo', fields: [{ label: 'Studio', type: 'texte' }, { label: 'Plateforme', type: 'liste', options: PLATEFORMES }, { label: 'Année', type: 'nombre' }] },
  { name: 'Restaurants', fields: [{ label: 'Adresse', type: 'texte' }, { label: 'Prix moyen (€)', type: 'nombre' }, { label: 'Spécialités', type: 'liste', options: [] }] },
  { name: 'Bars', fields: [{ label: 'Adresse', type: 'texte' }, { label: 'Ambiance', type: 'liste', options: AMBIANCES }] },
  { name: 'Musées/Expos', fields: [{ label: 'Ville', type: 'texte' }, { label: 'Date de visite', type: 'date' }, { label: "Type d'art", type: 'liste', options: ARTS }] },
  { name: 'Recettes', fields: [{ label: 'Type de plat', type: 'liste', options: PLATS }, { label: 'Difficulté', type: 'liste', options: DIFF }, { label: 'Temps (min)', type: 'nombre' }] }
]

export async function seedDefaultCategories(): Promise<void> {
  if (await kv.loadKV('seeded')) return
  const count = await db.table<Category, string>('categories').count()
  if (count > 0) {
    await kv.saveKV('seeded', true)
    return
  }
  const now = Date.now()
  const rows: Category[] = DEFAULT_CATEGORY_SEEDS.map((c, i) => ({
    id: uid(),
    name: c.name,
    fields: c.fields.map((f) => ({ id: uid(), label: f.label, type: f.type, options: f.options ? [...f.options] : undefined })),
    removedFields: [],
    createdAt: now + i
  }))
  await db.table<Category, string>('categories').bulkPut(rows)
  await kv.saveKV('seeded', true)
}

export async function listCategories(): Promise<Category[]> {
  const all = await db.table<Category, string>('categories').toArray()
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function listSheets(): Promise<Sheet[]> {
  return db.table<Sheet, string>('sheets').toArray()
}

export function sheetAvgNote(s: Sheet): number {
  return s.note
}

export function categoryStats(sheets: Sheet[], categoryId: string): { count: number; avg: number | null } {
  const inCat = sheets.filter((s) => s.categoryId === categoryId)
  const count = inCat.length
  const avg = count === 0 ? null : inCat.reduce((a, s) => a + s.note, 0) / count
  return { count, avg }
}

export function dbName(): string {
  return db.name
}
