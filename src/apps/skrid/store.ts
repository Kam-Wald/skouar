import { uid } from '../../shared/db'
export { uid }
import Dexie, { type Table } from 'dexie'

export interface SkridDoc {
  id: string
  title: string
  content: string
  parentId?: string | null
  wordTarget?: number
  updatedAt: number
  comments?: Record<string, { text: string; at: number }>
  kind?: 'chapter' | 'fiche' | 'memo'
  ficheType?: string
  fields?: Record<string, string>
  pinned?: boolean
  color?: string
}

export interface FicheType {
  id: string
  label: string
  icon: string
  fields: string[]
}

export const FICHE_TYPES: FicheType[] = [
  { id: 'perso', label: 'Personnage', icon: '🧍', fields: ['Nom', 'Âge', 'Rôle', 'Traits', 'Histoire', 'Notes'] },
  { id: 'lieu', label: 'Lieu', icon: '📍', fields: ['Nom', 'Type', 'Description', 'Ambiance', 'Notes'] },
  { id: 'objet', label: 'Objet', icon: '🎒', fields: ['Nom', 'Description', 'Importance', 'Notes'] },
  { id: 'creature', label: 'Créature', icon: '🐾', fields: ['Nom', 'Espèce', 'Description', 'Pouvoirs', 'Notes'] },
  { id: 'orga', label: 'Organisation', icon: '🏛️', fields: ['Nom', 'Type', 'Membres', 'But', 'Notes'] },
  { id: 'event', label: 'Événement', icon: '📅', fields: ['Nom', 'Date', 'Lieu', 'Résumé', 'Notes'] },
  { id: 'concept', label: 'Concept', icon: '💡', fields: ['Nom', 'Définition', 'Exemples', 'Notes'] },
  { id: 'citation', label: 'Citation', icon: '💬', fields: ['Auteur', 'Texte', 'Source', 'Contexte', 'Notes'] },
  { id: 'intrigue', label: 'Idée d’intrigue', icon: '🎬', fields: ['Accroche', 'Conflit', 'Enjeu', 'Résolution possible', 'Notes'] },
  { id: 'glossaire', label: 'Glossaire', icon: '📖', fields: ['Terme', 'Définition', 'Origine', 'Notes'] },
  { id: 'autre', label: 'Autre', icon: '📌', fields: ['Nom', 'Notes'] }
]

export const ficheTypeOf = (d: SkridDoc): FicheType => FICHE_TYPES.find((t) => t.id === d.ficheType) ?? FICHE_TYPES[0]

export const docIcon = (d: SkridDoc): string => (d.kind === 'memo' ? '🗒️' : d.kind === 'fiche' ? ficheTypeOf(d).icon : '📄')

export interface SkridPdfOpts {
  format?: 'a4' | 'a5' | 'livret'
  margin?: number
  font?: 'sans' | 'serif' | 'mono'
  toc?: boolean
  pageBreak?: boolean
  titlePage?: boolean
  xOfY?: boolean
  footerTitle?: boolean
}

export interface SkridState {
  bookTitle: string
  docs: SkridDoc[]
  currentId: string | null
  daily?: Record<string, number>
  pdfNumTop?: boolean
  pdfNumBottom?: boolean
  pdf?: SkridPdfOpts
}

interface KvRow {
  key: string
  value: unknown
}

class SkridDb extends Dexie {
  kv!: Table<KvRow, string>
  constructor() {
    super('skouar-skrid')
    this.version(1).stores({ kv: 'key' })
  }
}

const db = new SkridDb()


export function createDoc(title: string, parentId: string | null = null): SkridDoc {
  return { id: uid(), title, content: '', parentId, updatedAt: Date.now() }
}

function isState(v: unknown): boolean {
  return !!v && typeof v === 'object' && Array.isArray((v as SkridState).docs)
}

function seedSkrid(): SkridState {
  const d = createDoc('Chapitre 1')
  d.content = '<p>Commence à écrire ici…</p><p>Ctrl+B / I / U pour mettre en forme. Le compteur de mots est en bas.</p>'
  return { bookTitle: 'Mon livre', docs: [d], currentId: d.id }
}

export async function loadSkrid(): Promise<SkridState> {
  try {
    const row = await db.kv.get('state')
    if (row && isState(row.value)) return row.value as SkridState
  } catch {
    // IndexedDB indisponible
  }
  const seed = seedSkrid()
  try {
    await db.kv.put({ key: 'state', value: seed })
  } catch {
    // ignore
  }
  return seed
}

export async function saveSkrid(state: SkridState): Promise<void> {
  await db.kv.put({ key: 'state', value: state })
}

export async function loadSkridHistory(): Promise<{ past: SkridState[]; future: SkridState[] }> {
  const [p, f] = await Promise.all([db.kv.get('hist:past'), db.kv.get('hist:future')])
  return {
    past: Array.isArray(p?.value) ? (p.value as SkridState[]) : [],
    future: Array.isArray(f?.value) ? (f.value as SkridState[]) : []
  }
}

export async function saveSkridHistory(past: SkridState[], future: SkridState[]): Promise<void> {
  await db.kv.put({ key: 'hist:past', value: past })
  await db.kv.put({ key: 'hist:future', value: future })
}

export function orderedDocs(docs: SkridDoc[]): SkridDoc[] {
  const out: SkridDoc[] = []
  const walk = (parentId: string | null) => {
    for (const d of docs.filter((x) => (x.parentId ?? null) === parentId)) {
      out.push(d)
      walk(d.id)
    }
  }
  walk(null)
  return out
}
