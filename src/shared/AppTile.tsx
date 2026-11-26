import { Link } from 'react-router-dom'
import type { AppMeta } from '../apps/registry'

export default function AppTile({ app, idx }: { app: AppMeta; idx: string }): JSX.Element {
  return app.soon ? (
    <div className="app-tile soon" aria-disabled="true">
      <span className="app-tile-index">{idx}</span>
      <span className="app-tile-icon" aria-hidden>
        {app.icon}
      </span>
      <span className="app-tile-name">{app.name}</span>
      <span className="app-tile-desc">{app.description}</span>
      <span className="app-tile-badge">Bientôt</span>
    </div>
  ) : (
    <Link to={`/app/${app.id}`} className="app-tile">
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
}
