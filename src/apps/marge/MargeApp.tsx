import { useEffect } from 'react'
import AppShell from '../../shared/AppShell'
import { db } from './store'

const BASE = import.meta.env.BASE_URL

export default function MargeApp() {
  useEffect(() => {
    void db.table('docs').count()
  }, [])
  return (
    <AppShell
      appId="marge"
      appName="Marge"
      logo={`${BASE}app-icons/marge.svg`}
      mainClass="marge-main"
      sidebar={
        <div className="marge-side">
          <div className="marge-side-label">Bibliothèque</div>
          <p className="marge-empty">En construction — sous-parties suivantes du CDC (docs/cdc-marge.md).</p>
        </div>
      }
    >
      <div className="marge-placeholder">
        <h1>Marge.</h1>
        <p>Visionneuse et annotatrice de PDF — développement en cours.</p>
      </div>
    </AppShell>
  )
}
