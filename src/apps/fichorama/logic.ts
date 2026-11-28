export type FieldType = 'text' | 'number' | 'date' | 'select'

export type FieldValue = string | number | boolean | string[]

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
  icon: string
  color: string
  fields: FieldDef[]
}

export interface Rating {
  value: number
  date: string
}

export interface Fiche {
  id: string
  categoryId: string
  title: string
  comment: string
  favori: boolean
  image?: string
  values: Record<string, FieldValue>
  ratings: Rating[]
  createdAt: string
  updatedAt: string
}

export interface FichoramaData {
  version: 1
  categories: Category[]
  fiches: Fiche[]
}

export const NOTE_MAX = 10

export function clampNote(n: number): number {
  if (!Number.isFinite(n)) return 0
  const r = Math.round(n * 2) / 2
  return Math.max(0, Math.min(NOTE_MAX, r))
}

export function noteOf(f: Fiche): number {
  return f.ratings.length ? f.ratings[f.ratings.length - 1].value : 0
}

export function fmtNote(n: number): string {
  return String(n).replace('.', ',')
}

export function avg(vals: number[]): number | null {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export function catStats(data: FichoramaData, catId: string): { nb: number; moyenne: number | null } {
  const fs = data.fiches.filter((f) => f.categoryId === catId)
  return { nb: fs.length, moyenne: avg(fs.map(noteOf)) }
}

export function globalStats(data: FichoramaData): { nb: number; moyenne: number | null } {
  return { nb: data.fiches.length, moyenne: avg(data.fiches.map(noteOf)) }
}

export function searchFiches(data: FichoramaData, q: string): Fiche[] {
  const t = q.trim().toLowerCase()
  if (!t) return []
  return data.fiches.filter((f) => f.title.toLowerCase().includes(t) || f.comment.toLowerCase().includes(t))
}

export function categoryOf(data: FichoramaData, catId: string): Category | undefined {
  return data.categories.find((c) => c.id === catId)
}

export function seedData(): FichoramaData {
  const cat = (id: string, name: string, icon: string, color: string, fields: FieldDef[]): Category => ({ id, name, icon, color, fields })
  return {
    version: 1,
    categories: [
      cat('cat-films', 'Films', '🎬', '#e11d48', [
        { id: 'realisateur', label: 'Réalisateur', type: 'text' },
        { id: 'annee', label: 'Année', type: 'number' },
        { id: 'genre', label: 'Genre', type: 'select', options: ['Action', 'Comédie', 'Drame', 'SF', 'Horreur', 'Documentaire', 'Animation', 'Autre'] },
        { id: 'duree', label: 'Durée (min)', type: 'number' }
      ]),
      cat('cat-livres', 'Livres', '📚', '#b45309', [
        { id: 'auteur', label: 'Auteur', type: 'text' },
        { id: 'annee', label: 'Année', type: 'number' },
        { id: 'genre', label: 'Genre', type: 'select', options: ['Roman', 'Essai', 'Poésie', 'BD', 'Documentaire', 'Autre'] },
        { id: 'lu-le', label: 'Lu le', type: 'date' }
      ]),
      cat('cat-albums', 'Albums', '🎵', '#7c3aed', [
        { id: 'artiste', label: 'Artiste', type: 'text' },
        { id: 'annee', label: 'Année', type: 'number' },
        { id: 'genre', label: 'Genre', type: 'select', options: ['Rock', 'Pop', 'Rap', 'Électro', 'Jazz', 'Classique', 'Autre'] }
      ]),
      cat('cat-mangas', 'Mangas / BD', '🗯️', '#0ea5e9', [
        { id: 'auteur', label: 'Auteur', type: 'text' },
        { id: 'tome', label: 'Tome n°', type: 'number' },
        { id: 'annee', label: 'Année', type: 'number' }
      ]),
      cat('cat-jeux', 'Jeux vidéo', '🎮', '#16a34a', [
        { id: 'studio', label: 'Studio', type: 'text' },
        { id: 'plateforme', label: 'Plateforme', type: 'select', options: ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Autre'] },
        { id: 'annee', label: 'Année', type: 'number' }
      ]),
      cat('cat-restos', 'Restaurants', '🍽️', '#dc2626', [
        { id: 'adresse', label: 'Adresse', type: 'text' },
        { id: 'prix', label: 'Prix moyen (€)', type: 'number' },
        { id: 'specialites', label: 'Spécialités', type: 'text' }
      ]),
      cat('cat-bars', 'Bars', '🍸', '#db2777', [
        { id: 'adresse', label: 'Adresse', type: 'text' },
        { id: 'ambiance', label: 'Ambiance', type: 'select', options: ['Chic', 'Convivial', 'Branché', 'Intime', 'Sport', 'Autre'] }
      ]),
      cat('cat-musees', 'Musées / Expos', '🖼️', '#0d9488', [
        { id: 'ville', label: 'Ville', type: 'text' },
        { id: 'date-visite', label: 'Date de visite', type: 'date' },
        { id: 'type-art', label: "Type d'art", type: 'text' }
      ]),
      cat('cat-recettes', 'Recettes', '🍳', '#ea580c', [
        { id: 'type-plat', label: 'Type de plat', type: 'text' },
        { id: 'difficulte', label: 'Difficulté', type: 'select', options: ['Facile', 'Moyen', 'Difficile'] },
        { id: 'temps', label: 'Temps (min)', type: 'number' }
      ])
    ],
    fiches: []
  }
}

export const CAT_COLORS = ['#e11d48', '#b45309', '#7c3aed', '#0ea5e9', '#16a34a', '#dc2626', '#db2777', '#0d9488', '#ea580c', '#eab308', '#64748b', '#0891b2']
export const CAT_ICONS = ['🗂️', '⭐', '🎬', '📚', '🎵', '🎮', '🍽️', '🍸', '🖼️', '🍳', '🎯', '🏷️', '📌', '🧭', '💡', '🛠️']

export function validateData(v: unknown): v is FichoramaData {
  if (!v || typeof v !== 'object') return false
  const d = v as FichoramaData
  return (
    d.version === 1 &&
    Array.isArray(d.categories) &&
    Array.isArray(d.fiches) &&
    d.categories.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.fields)) &&
    d.fiches.every((f) => f && typeof f.id === 'string' && typeof f.categoryId === 'string' && typeof f.title === 'string' && Array.isArray(f.ratings))
  )
}

// ---------- Saisie fiche (S3) ----------

export function fmtDateIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function fmtFieldValue(v: FieldValue | undefined): string {
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return fmtDateIso(v)
  return String(v)
}

export function validateDraft(cat: Category, d: { title: string; values: Record<string, FieldValue> }): string | null {
  if (!d.title.trim()) return 'Titre requis'
  for (const f of cat.fields) {
    if (!f.required) continue
    const v = d.values[f.id]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return `Champ « ${f.label} » obligatoire`
  }
  return null
}

export function fileToDataUrl(file: File, maxW = 400, maxH = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image illisible'))
    }
    img.src = url
  })
}

// ---------- Re-notation (S4) ----------

export function addRating(f: Fiche, value: number, date: string): void {
  f.ratings.push({ value: clampNote(value), date })
}

// ---------- Tri / filtres (S5) ----------

export type SortKey = 'note-desc' | 'note-asc' | 'date-desc' | 'date-asc' | 'titre' | 'fav'

export function sortFiches(fs: Fiche[], key: SortKey): Fiche[] {
  const arr = [...fs]
  switch (key) {
    case 'note-desc':
      return arr.sort((a, b) => noteOf(b) - noteOf(a))
    case 'note-asc':
      return arr.sort((a, b) => noteOf(a) - noteOf(b))
    case 'date-desc':
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'date-asc':
      return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'titre':
      return arr.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
    case 'fav':
      return arr.sort((a, b) => (b.favori ? 1 : 0) - (a.favori ? 1 : 0) || noteOf(b) - noteOf(a))
  }
}

export interface FicheFilter {
  favOnly?: boolean
  min?: number
  max?: number
  q?: string
}

export function filterFiches(fs: Fiche[], f: FicheFilter): Fiche[] {
  let out = fs
  if (f.favOnly) out = out.filter((x) => x.favori)
  if (f.min !== undefined) out = out.filter((x) => noteOf(x) >= f.min!)
  if (f.max !== undefined) out = out.filter((x) => noteOf(x) <= f.max!)
  if (f.q && f.q.trim()) {
    const t = f.q.trim().toLowerCase()
    out = out.filter((x) => x.title.toLowerCase().includes(t) || x.comment.toLowerCase().includes(t))
  }
  return out
}

// ---------- Paramètres catégorie (S6) ----------

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'text', label: 'Texte' },
  { type: 'number', label: 'Nombre' },
  { type: 'date', label: 'Date' },
  { type: 'select', label: 'Liste déroulante' }
]

export function removeField(cat: Category, id: string): void {
  cat.fields = cat.fields.filter((f) => f.id !== id)
}

export function moveField(cat: Category, id: string, dir: -1 | 1): void {
  const i = cat.fields.findIndex((f) => f.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= cat.fields.length) return
  const [f] = cat.fields.splice(i, 1)
  cat.fields.splice(j, 0, f)
}

export function deleteCategory(data: FichoramaData, id: string, moveToId: string | null): void {
  if (moveToId && data.categories.some((c) => c.id === moveToId)) {
    for (const f of data.fiches) if (f.categoryId === id) f.categoryId = moveToId
  } else {
    data.fiches = data.fiches.filter((f) => f.categoryId !== id)
  }
  data.categories = data.categories.filter((c) => c.id !== id)
}
