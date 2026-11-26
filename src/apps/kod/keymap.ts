export const comboOf = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; key: string }): string => {
  const flags = `${e.ctrlKey || e.metaKey ? 'C' : ''}${e.shiftKey ? 'S' : ''}${e.altKey ? 'A' : ''}`
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key
  return flags ? `${flags}-${k}` : k
}

export const DEFAULT_KEYMAP: Record<string, string> = {
  save: 'C-S',
  find: 'C-F',
  replace: 'C-H',
  gfind: 'C-S-F',
  quickopen: 'C-P',
  palette: 'C-K',
  goto: 'C-G',
  reopenTab: 'C-S-T',
  dupOcc: 'C-D',
  selAllOcc: 'C-S-L',
  comment: 'C-/',
  dupLine: 'C-S-D',
  moveUp: 'A-ArrowUp',
  moveDown: 'A-ArrowDown',
  gotoDef: 'C-F12'
}

export const KEYMAP_ACTIONS: { id: string; label: string }[] = [
  { id: 'save', label: 'Enregistrer' },
  { id: 'find', label: 'Rechercher dans le fichier' },
  { id: 'replace', label: 'Rechercher-remplacer dans le fichier' },
  { id: 'gfind', label: 'Rechercher dans tout le projet' },
  { id: 'quickopen', label: 'Aller au fichier' },
  { id: 'palette', label: 'Palette de commandes' },
  { id: 'goto', label: 'Aller à la ligne' },
  { id: 'reopenTab', label: 'Rouvrir l’onglet fermé' },
  { id: 'dupOcc', label: 'Ajouter l’occurrence suivante' },
  { id: 'selAllOcc', label: 'Sélectionner toutes les occurrences' },
  { id: 'comment', label: 'Commenter / décommenter' },
  { id: 'dupLine', label: 'Dupliquer la ligne' },
  { id: 'moveUp', label: 'Monter la ligne' },
  { id: 'moveDown', label: 'Descendre la ligne' },
  { id: 'gotoDef', label: 'Aller à la définition' }
]

const normCombo = (raw: string): string | null => {
  const s = raw.trim().toUpperCase()
  const parts = s.split('-')
  const key = parts.pop() ?? ''
  const flags = parts.join('')
  if (!/^[CSA]*$/.test(flags)) return null
  if (!/^[A-Z0-9]$/.test(key) && !/^F([1-9]|1[0-2])$/.test(key) && !['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'ENTER', 'TAB', 'ESCAPE', 'BACKSPACE', 'DELETE', 'SPACE', '/', '\\', '`', ',', '.', ';', "'"].includes(key)) return null
  return flags ? `${flags}-${key}` : key
}

export const parseKeymapText = (text: string): Record<string, string> => {
  const out: Record<string, string> = {}
  const ids = new Map(KEYMAP_ACTIONS.map((a) => [a.id.toLowerCase(), a.id]))
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z]+)\s*[:=]\s*(.+?)\s*$/)
    if (!m) continue
    const id = ids.get(m[1].toLowerCase())
    if (!id) continue
    const c = normCombo(m[2])
    if (c) out[id] = c
  }
  return out
}

export const keymapToText = (km: Record<string, unknown>): string =>
  KEYMAP_ACTIONS.filter((a) => typeof km[a.id] === 'string').map((a) => `${a.id}: ${String(km[a.id])}`).join('\n')
