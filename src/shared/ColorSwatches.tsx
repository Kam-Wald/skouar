import { useState } from 'react'

export const PALETTE: string[] = [
  '#111827', '#4b5563', '#9ca3af', '#e5e7eb', '#fafaf9', '#ffffff',
  '#7f1d1d', '#dc2626', '#ea580c', '#d97706', '#eab308', '#16a34a',
  '#0d9488', '#0ea5e9', '#2563eb', '#4f46e5', '#7c3aed', '#db2777', '#92400e'
]

const KEY = 'skouar:colorHistory'

export function recentColors(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((c) => typeof c === 'string').slice(0, 10) : []
  } catch {
    return []
  }
}

export function pushRecentColor(c: string): void {
  const next = [c.toLowerCase(), ...recentColors().filter((x) => x !== c.toLowerCase())].slice(0, 10)
  localStorage.setItem(KEY, JSON.stringify(next))
}

export default function ColorSwatches({ value, onChange, title }: { value: string; onChange: (c: string) => void; title?: string }): JSX.Element {
  const [recents, setRecents] = useState<string[]>(() => recentColors())
  const pick = (c: string): void => {
    pushRecentColor(c)
    setRecents(recentColors())
    onChange(c)
  }
  const cur = value.toLowerCase()
  return (
    <span className="cs-wrap" title={title}>
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`cs-swatch${cur === c ? ' active' : ''}`}
          style={{ background: c }}
          aria-label={c}
          onClick={() => pick(c)}
        />
      ))}
      {recents.map((c) => (
        <button
          key={`r${c}`}
          type="button"
          className={`cs-swatch cs-recent${cur === c ? ' active' : ''}`}
          style={{ background: c }}
          aria-label={`r\u00e9cent ${c}`}
          title={`${c} (r\u00e9cemment utilis\u00e9)`}
          onClick={() => pick(c)}
        />
      ))}
      <input type="color" className="cs-custom" value={value} title={title ?? 'Couleur personnalis\u00e9e'} onChange={(e) => pick(e.target.value)} />
    </span>
  )
}
