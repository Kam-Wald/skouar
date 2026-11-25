import type { Block, BlockType, BlocsState, Page } from './types'

const STORAGE_KEY = 'skouar:blocs:v1'

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function createBlock(type: BlockType = 'paragraph', text = ''): Block {
  return { id: uid(), type, text, done: type === 'todo' ? false : undefined }
}

export function createPage(title: string): Page {
  return { id: uid(), title, blocks: [createBlock()], updatedAt: Date.now() }
}

function seedState(): BlocsState {
  const page = createPage('Bienvenue dans Blocs')
  page.blocks = [
    createBlock('h1', 'Bienvenue dans Blocs ▦'),
    createBlock(
      'paragraph',
      "Une page est une suite de blocs. Appuie sur Entrée pour créer un nouveau bloc."
    ),
    createBlock('bullet', 'Backspace au début d’un bloc vide le supprime.'),
    createBlock('todo', 'Coche cette tâche pour la marquer faite'),
    createBlock(
      'paragraph',
      'Les boutons de la barre changent le type du bloc actif (titre, liste, tâche…).'
    )
  ]
  return { pages: [page], currentPageId: page.id }
}

export function loadState(): BlocsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BlocsState
      if (Array.isArray(parsed.pages)) return parsed
    }
  } catch {
    // stockage indisponible ou corrompu : on repart d'un état sain
  }
  return seedState()
}

export function saveState(state: BlocsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota dépassé : on ignore silencieusement pour l'instant
  }
}
