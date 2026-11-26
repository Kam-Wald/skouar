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

export function launcherBgCss(bg: LauncherBg | null): string | undefined {
  if (!bg) return undefined
  if (bg.type === 'solid') return bg.c1
  if (bg.type === 'gradient') return `linear-gradient(${bg.angle}deg, ${bg.c1}, ${bg.c2})`
  if (bg.type === 'dots') return `radial-gradient(circle, ${bg.c1} 1.6px, transparent 1.8px) 0 0 / 22px 22px, ${bg.c2}`
  return `linear-gradient(${bg.c1} 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, ${bg.c1} 1px, transparent 1px) 0 0 / 28px 28px, ${bg.c2}`
}
