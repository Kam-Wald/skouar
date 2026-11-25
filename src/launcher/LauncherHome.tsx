import { Link } from 'react-router-dom'
import { apps } from '../apps/registry'

export default function LauncherHome() {
  return (
    <div className="launcher">
      <header className="launcher-header">
        <img
          className="launcher-logo-img"
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt="Skouar"
        />
        <div>
          <h1>Skouar</h1>
          <p className="launcher-subtitle">
            Tes applications, réunies sur une seule place.
          </p>
        </div>
      </header>
      <main className="launcher-grid">
        {apps.map((app, i) => {
          const idx = String(i + 1).padStart(2, '0')
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
      </main>
      <footer className="launcher-footer">
        Local-first : tes données restent sur cet appareil.
      </footer>
    </div>
  )
}
