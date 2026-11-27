export interface LauncherBg {
  type: 'solid' | 'gradient' | 'dots' | 'grid'
  c1: string
  c2: string
  angle: number
}

const KEY = 'skouar:launcherBg'

export function loadLauncherBg(): LauncherBg | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!v || typeof v !== 'object') return null
    if (!['solid', 'gradient', 'dots', 'grid'].includes(v.type)) return null
    return { type: v.type, c1: String(v.c1 ?? '#0b0f19'), c2: String(v.c2 ?? '#155b60'), angle: Number(v.angle ?? 135) }
  } catch {
    return null
  }
}

export function saveLauncherBg(bg: LauncherBg | null): void {
  if (bg) localStorage.setItem(KEY, JSON.stringify(bg))
  else localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent('skouar:settings'))
}

export interface BgPreset {
  name: string
  bg: LauncherBg
}

export const BG_PRESETS: BgPreset[] = [
  { name: 'Nuit teal', bg: { type: 'gradient', c1: '#0b0f19', c2: '#155b60', angle: 135 } },
  { name: 'Brume', bg: { type: 'gradient', c1: '#1a2334', c2: '#0b0f19', angle: 160 } },
  { name: 'Aube', bg: { type: 'gradient', c1: '#c7d2fe', c2: '#f4f6fb', angle: 120 } },
  { name: 'Sunset', bg: { type: 'gradient', c1: '#3b0764', c2: '#9a3412', angle: 120 } },
  { name: 'Forêt', bg: { type: 'gradient', c1: '#052e16', c2: '#14532d', angle: 140 } },
  { name: 'Encre', bg: { type: 'solid', c1: '#0b0f19', c2: '#155b60', angle: 135 } },
  { name: 'Points violets', bg: { type: 'dots', c1: '#a78bfa', c2: '#17101f', angle: 0 } },
  { name: 'Grille ardoise', bg: { type: 'grid', c1: '#334155', c2: '#0f172a', angle: 0 } }
]

export function launcherBgCss(bg: LauncherBg | null): string | undefined {
  if (!bg) return undefined
  const scrim = 'linear-gradient(var(--launcher-scrim), var(--launcher-scrim))'
  if (bg.type === 'solid') return `${scrim}, ${bg.c1}`
  if (bg.type === 'gradient') return `${scrim}, linear-gradient(${bg.angle}deg, ${bg.c1}, ${bg.c2})`
  if (bg.type === 'dots') return `${scrim}, radial-gradient(circle, ${bg.c1} 1.6px, transparent 1.8px) 0 0 / 22px 22px, ${bg.c2}`
  return `${scrim}, linear-gradient(${bg.c1} 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, ${bg.c1} 1px, transparent 1px) 0 0 / 28px 28px, ${bg.c2}`
}
