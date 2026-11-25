import { useState } from 'react'

const ACCENTS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

export function getTheme(): string {
  return localStorage.getItem('skouar:theme') || 'dark'
}
export function getAccent(): string {
  return localStorage.getItem('skouar:accent') || '#4f46e5'
}
export function applyTheme(theme: string, accent: string): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('--accent', accent)
  localStorage.setItem('skouar:theme', theme)
  localStorage.setItem('skouar:accent', accent)
}

export default function ThemeButton() {
  const [theme, setTheme] = useState(getTheme())
  const [accent, setAccent] = useState(getAccent())
  const [open, setOpen] = useState(false)

  const choose = (t: string, a: string) => {
    applyTheme(t, a)
    setTheme(t)
    setAccent(a)
  }

  return (
    <div className="theme-wrap">
      <button className="blocs-io" title="Thème et couleur d'accent" onClick={() => setOpen((o) => !o)}>
        {theme === 'dark' ? '🌙' : '☀️'} Thème
      </button>
      {open && (
        <div className="theme-pop">
          <div className="theme-row">
            <button className={`db-btn${theme === 'light' ? ' active' : ''}`} onClick={() => choose('light', accent)}>
              ☀️ Clair
            </button>
            <button className={`db-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => choose('dark', accent)}>
              🌙 Sombre
            </button>
          </div>
          <div className="emoji-colors">
            {ACCENTS.map((a) => (
              <button
                key={a}
                className={`emoji-color${accent === a ? ' active' : ''}`}
                style={{ backgroundColor: a }}
                title={a}
                onClick={() => choose(theme, a)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
