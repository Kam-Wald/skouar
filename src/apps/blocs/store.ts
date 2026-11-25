import Dexie, { type Table } from 'dexie'
import type {
  Block,
  BlockType,
  BlocsState,
  CellValue,
  Column,
  Database,
  Page,
  PropType,
  Row
} from './types'

const LEGACY_KEY = 'skouar:blocs:v1'
const STATE_KEY = 'blocs'

interface KvRow {
  key: string
  value: BlocsState
}

class BlocsDatabase extends Dexie {
  kv!: Table<KvRow, string>
  constructor() {
    super('skouar')
    this.version(1).stores({ kv: 'key' })
  }
}

const db = new BlocsDatabase()

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function createBlock(type: BlockType = 'paragraph', text = ''): Block {
  return {
    id: uid(),
    type,
    text,
    done: type === 'todo' ? false : undefined,
    children: type === 'toggle' ? [] : undefined
  }
}

export function createPage(title: string, parentId: string | null = null): Page {
  return { id: uid(), title, blocks: [createBlock()], updatedAt: Date.now(), parentId }
}

export function createColumn(name: string, type: PropType): Column {
  return { id: uid(), name, type, options: type === 'select' ? [] : undefined }
}

export function createRow(columns: Column[]): Row {
  const cells: Record<string, CellValue> = {}
  for (const c of columns) cells[c.id] = c.type === 'checkbox' ? false : null
  return { id: uid(), cells, createdAt: Date.now() }
}

export function createDatabase(): Database {
  return {
    id: uid(),
    title: '',
    columns: [createColumn('Nom', 'text')],
    rows: []
  }
}

function migrateState(s: BlocsState): BlocsState {
  return {
    ...s,
    pages: s.pages.map((p) => {
      const legacy = p as Page & { cover?: unknown }
      let cover = p.cover
      if (typeof legacy.cover === 'string') {
        cover = {
          kind: (legacy.cover as string).startsWith('data:') ? 'file' : 'url',
          value: legacy.cover as string
        } as Page['cover']
      }
      return { ...p, cover: cover ?? null }
    })
  }
}

export function seedState(): BlocsState {
  const page = createPage('Bienvenue dans Carnet')
  page.icon = '▦'
  page.iconColor = '#4f46e5'
  page.blocks = [
    createBlock('h1', 'Bienvenue dans Carnet 🗒'),
    createBlock(
      'paragraph',
      "Une page est une suite de blocs. Appuie sur Entrée pour créer un nouveau bloc."
    ),
    createBlock('bullet', 'Backspace au début d’un bloc vide le supprime.'),
    createBlock('todo', 'Coche cette tâche pour la marquer faite'),
    createBlock(
      'paragraph',
      'Les boutons de la barre changent le type du bloc actif. Tape / pour le menu des blocs (vidéo, PDF, colonnes, dépliant…).'
    ),
    createBlock(
      'paragraph',
      'Barre latérale : ↓ Exporter / ↑ Importer (fichier JSON), ⇄ Sync (P2P). Icône 🐰 et couverture 🖼 en haut de page. Données dans IndexedDB.'
    )
  ]
  return { pages: [page], currentPageId: page.id }
}

function isValidState(x: unknown): x is BlocsState {
  if (typeof x !== 'object' || x === null) return false
  const s = x as BlocsState
  return (
    Array.isArray(s.pages) &&
    s.pages.every(
      (p) =>
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        Array.isArray(p.blocks)
    )
  )
}

export async function loadState(): Promise<BlocsState> {
  try {
    const row = await db.kv.get(STATE_KEY)
    if (row && isValidState(row.value)) return migrateState(row.value)
  } catch {
    // IndexedDB indisponible : on tente la migration puis le seed
  }
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isValidState(parsed)) {
        const migrated = migrateState(parsed)
        await db.kv.put({ key: STATE_KEY, value: migrated })
        localStorage.removeItem(LEGACY_KEY)
        return migrated
      }
    }
  } catch {
    // ignore
  }
  const seeded = seedState()
  try {
    await db.kv.put({ key: STATE_KEY, value: seeded })
  } catch {
    // ignore
  }
  return seeded
}

export async function saveState(state: BlocsState): Promise<void> {
  await db.kv.put({ key: STATE_KEY, value: state })
}
