import { useState } from 'react'
import AppTile from '../shared/AppTile'
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
            <strong>Plein d’applications. Une seule place.</strong>
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
