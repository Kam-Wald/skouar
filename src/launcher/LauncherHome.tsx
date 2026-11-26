import { Link } from 'react-router-dom'
import { apps } from '../apps/registry'
import ThemeButton from '../ThemeButton'

export default function LauncherHome() {
  return (
    <div className="launcher">
      <div className="launcher-theme">
        <ThemeButton />
      </div>
      <header className="launcher-header">
        <img
          className="launcher-logo-img launcher-mark"
          src={`${import.meta.env.BASE_URL}icon.svg`}
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
