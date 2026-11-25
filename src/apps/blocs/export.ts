import type { BlocsState } from './types'

export function isBlocsState(x: unknown): x is BlocsState {
  if (typeof x !== 'object' || x === null) return false
  const s = x as BlocsState
  return (
    Array.isArray(s.pages) &&
    s.pages.every(
      (p) =>
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        Array.isArray(p.blocks) &&
        p.blocks.every(
          (b) => typeof b.id === 'string' && typeof b.type === 'string' && typeof b.text === 'string'
        )
    )
  )
}

export function exportStateToFile(state: BlocsState): void {
  const payload = {
    app: 'skouar',
    kind: 'blocs-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
  a.href = url
  a.download = `skouar-blocs-${ts}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function parseImportFile(file: File): Promise<BlocsState> {
  const parsed: unknown = JSON.parse(await file.text())
  const state =
    typeof parsed === 'object' && parsed !== null && 'state' in parsed
      ? (parsed as { state: unknown }).state
      : parsed
  if (!isBlocsState(state)) throw new Error('Format de fichier invalide')
  return state
}
