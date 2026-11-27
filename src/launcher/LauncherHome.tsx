import { useEffect, useRef, useState } from 'react'
import AppTile from '../shared/AppTile'
import { launcherBgCss, loadLauncherBg, type LauncherBg } from '../shared/launcherBg'
import { apps } from '../apps/registry'
import ThemeButton from '../ThemeButton'
import SettingsButton from '../Settings'

export default function LauncherHome() {
  const [q, setQ] = useState('')
  const [bg, setBg] = useState<LauncherBg | null>(() => loadLauncherBg())
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const on = () => setBg(loadLauncherBg())
    window.addEventListener('skouar:settings', on)
    return () => window.removeEventListener('skouar:settings', on)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && t === searchRef.current) {
        if (q) setQ('')
        else searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q])
  const query = q.trim().toLowerCase()
  const visible = query
    ? apps.filter((a) => `${a.name} ${a.description} ${a.tag}`.toLowerCase().includes(query))
    : apps

  return (
    <div className="launcher" style={bg ? { background: launcherBgCss(bg) } : undefined}>
      <a className="skip-link" href="#launcher-main">
        Aller au contenu
      </a>
      <div className="launcher-theme">
        <ThemeButton />
        <SettingsButton />
      </div>
      <header className="launcher-header">
        <img
          className="launcher-logo-img launcher-mark"
          src={`${import.meta.env.BASE_URL}icons/icon-512.png`}
          alt="Skouar"
        />
        <div>
          <h1 className="launcher-title" data-text="Skouar">
            Skouar<span className="launcher-title-dot">.</span>
          </h1>
          <p className="launcher-subtitle">
            Plein d’applications. Une seule place.
          </p>
        </div>
      </header>
      <input
        ref={searchRef}
        className="launcher-search"
        type="search"
        aria-label="Rechercher une application"
        placeholder="Rechercher une app… ( / )"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {query && (
        <p className="launcher-count" role="status" aria-live="polite">
          {visible.length === 0 ? 'Aucune app' : `${visible.length} app${visible.length > 1 ? 's' : ''}`}
        </p>
      )}
      <main className="launcher-grid" id="launcher-main">
        {visible.map((app) => (
          <AppTile key={app.id} app={app} idx={String(apps.indexOf(app) + 1).padStart(2, '0')} />
        ))}
        {visible.length === 0 && <p className="launcher-subtitle">Aucune app ne correspond à « {q} ».</p>}
      </main>
      <footer className="launcher-footer">
        Local-first : tes données restent sur cet appareil.
      </footer>
    </div>
  )
}
