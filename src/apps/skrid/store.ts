import Dexie, { type Table } from 'dexie'

export interface SkridDoc {
  id: string
  title: string
  content: string
  parentId?: string | null
  wordTarget?: number
  updatedAt: number
  comments?: Record<string, { text: string; at: number }>
}

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

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

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
