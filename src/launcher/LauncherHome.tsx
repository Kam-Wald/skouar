import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apps } from '../apps/registry'
import ThemeButton from '../ThemeButton'

const RECENTS_KEY = 'skouar:recents'

function loadRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function pushRecent(id: string): void {
  const r = [id, ...loadRecents().filter((x) => x !== id)].slice(0, 4)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(r))
}

export default function LauncherHome() {
  const [q, setQ] = useState('')
  const recents = useMemo(() => loadRecents(), [])
  const recentApps = apps.filter((a) => recents.includes(a.id) && a.component)
  const query = q.trim().toLowerCase()
  const visible = query
    ? apps.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(query))
    : apps

  return (
    <div className="launcher">
      <a className="skip-link" href="#launcher-main">
        Aller au contenu
      </a>
      <div className="launcher-theme">
        <ThemeButton />
      </div>
      <header className="launcher-header">
        <img
          className="launcher-logo-img launcher-mark"
          src={`${import.meta.env.BASE_URL}icons/icon-512.png`}
          alt="Skouar"
        />
        <div>
          <span className="launcher-kicker mono">Launcher local-first · 100 % offline</span>
          <h1 className="launcher-title" data-text="Skouar">
            Skouar<span className="launcher-title-dot">.</span>
          </h1>
          <p className="launcher-subtitle">
            Tes applications, réunies sur une seule place.
          </p>
        </div>
      </header>
      <input
        className="launcher-search"
        type="search"
        aria-label="Rechercher une application"
        placeholder="Rechercher une app… (ex. : code, pdf, écriture)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!query && recentApps.length > 0 && (
        <div className="launcher-recents">
          <span className="launcher-recents-label">Récents</span>
          {recentApps.map((a) => (
            <Link key={a.id} to={`/app/${a.id}`} className="launcher-recent-chip" onClick={() => pushRecent(a.id)}>
              {a.logo && <img src={a.logo} alt="" />}
              {a.name}
            </Link>
          ))}
        </div>
      )}
      <main className="launcher-grid" id="launcher-main">
        {visible.map((app, i) => {
          const idx = String(apps.indexOf(app) + 1).padStart(2, '0')
          return app.soon ? (
            <div key={app.id} className="app-tile soon" aria-disabled="true">
              <span className="app-tile-index">{idx}</span>
              <span className="app-tile-icon" aria-hidden>
                {app.icon}
              </span>
              <span className="app-tile-name">{app.name}</span>
              <span className="app-tile-desc">{app.description}</span>
              <span className="app-tile-badge">Bientôt</span>
            </div>
          ) : (
            <Link key={app.id} to={`/app/${app.id}`} className="app-tile" onClick={() => pushRecent(app.id)}>
              <span className="app-tile-index">{idx}</span>
              {app.logo ? (
                <img className="app-tile-logo" src={app.logo} alt="" />
              ) : (
                <span className="app-tile-icon" aria-hidden>
                  {app.icon}
                </span>
              )}
              <span className="app-tile-name">{app.name}</span>
              <span className="app-tile-desc">{app.description}</span>
            </Link>
          )
        })}
        {visible.length === 0 && <p className="launcher-subtitle">Aucune app ne correspond à « {q} ».</p>}
      </main>
      <footer className="launcher-footer">
        Local-first : tes données restent sur cet appareil.
      </footer>
    </div>
  )
}
