import { useState } from 'react'

export const SIDEBAR_W_KEY = 'skouar:sidebarW'
export const SIDEBAR_MIN = 180
export const SIDEBAR_MAX = 440

export function useSidebarWidth(defaultW = 240): { sideW: number; setSideW: (w: number) => void } {
  const [sideW, setSideWState] = useState(() => {
    const v = Number(localStorage.getItem(SIDEBAR_W_KEY))
    return Number.isFinite(v) && v >= SIDEBAR_MIN && v <= SIDEBAR_MAX ? v : defaultW
  })
  const setSideW = (w: number): void => {
    const c = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w))
    setSideWState(c)
    localStorage.setItem(SIDEBAR_W_KEY, String(c))
  }
  return { sideW, setSideW }
}

export function SidebarResizer({ sideW, onChange }: { sideW: number; onChange: (w: number) => void }): JSX.Element {
  return (
    <div
      className="sidebar-resizer"
      title="Redimensionner le menu"
      onMouseDown={(e) => {
        e.preventDefault()
        const startX = e.clientX
        const startW = sideW
        const onMove = (ev: MouseEvent) => onChange(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX)))
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
    >
      <span className="resizer-arrow">⇆</span>
    </div>
  )
}
