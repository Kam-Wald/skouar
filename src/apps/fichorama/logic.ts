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
