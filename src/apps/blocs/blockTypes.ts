import type { BlockType } from './types'

export const BLOCK_TYPES = [
  { type: 'paragraph', label: '¶', title: 'Paragraphe' },
  { type: 'h1', label: 'H1', title: 'Titre 1' },
  { type: 'h2', label: 'H2', title: 'Titre 2' },
  { type: 'h3', label: 'H3', title: 'Titre 3' },
  { type: 'bullet', label: '•', title: 'Liste à puces' },
  { type: 'todo', label: '☑', title: 'Tâche' },
  { type: 'quote', label: '❝', title: 'Citation' },
  { type: 'code', label: '</>', title: 'Bloc de code' },
  { type: 'divider', label: '―', title: 'Séparateur' },
  { type: 'toggle', label: '▸', title: 'Menu dépliant' },
  { type: 'image', label: '🖼', title: 'Image' },
  { type: 'video', label: '🎬', title: 'Vidéo (embed)' },
  { type: 'audio', label: '🔊', title: 'Audio' },
  { type: 'pdf', label: '📕', title: 'PDF' },
  { type: 'file', label: '📎', title: 'Fichier' },
  { type: 'archive', label: '📦', title: 'Archive' },
  { type: 'button', label: '🔘', title: 'Bouton' },
  { type: 'toc', label: '☰', title: 'Table des matières' },
  { type: 'database', label: '▦', title: 'Base de données' }
] as const

export type BlockTypeDef = (typeof BLOCK_TYPES)[number]

export const PLACEHOLDERS: Record<BlockType, string> = {
  paragraph: 'Écris quelque chose… (Entrée = nouveau bloc, / = menu)',
  h1: 'Titre 1',
  h2: 'Titre 2',
  h3: 'Titre 3',
  bullet: 'Élément de liste',
  todo: 'Tâche à faire',
  quote: 'Citation',
  code: 'Code…',
  divider: '',
  image: '',
  video: '',
  audio: '',
  pdf: '',
  file: '',
  archive: '',
  toggle: 'Titre du menu dépliant',
  toc: '',
  button: 'Texte du bouton',
  database: 'Base de données'
}
