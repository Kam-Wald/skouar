import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apps } from '../apps/registry'
import ThemeButton from '../ThemeButton'
import SettingsButton from '../Settings'

export default function LauncherHome() {
  const [q, setQ] = useState('')
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
            <Link key={app.id} to={`/app/${app.id}`} className="app-tile">
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
