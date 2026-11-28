import AppShell from '../../shared/AppShell'

const BASE = import.meta.env.BASE_URL

export default function MargeApp() {
  return (
    <AppShell
      appId="marge"
      appName="Marge"
      logo={`${BASE}app-icons/marge.svg`}
      mainClass="marge-main"
      sidebar={
        <div className="blocs-sidebar-scroll">
          <div className="blocs-sidebar-head">
            <span>Bibliothèque</span>
          </div>
          <p className="mono skrid-com-empty">En construction — voir les prochaines sous-parties du CDC.</p>
        </div>
      }
    >
      <div className="marge-placeholder">
        <h1>Marge.</h1>
        <p>Visionneuse et annotatrice de PDF — développement en cours (CDC Marge).</p>
      </div>
    </AppShell>
  )
}
