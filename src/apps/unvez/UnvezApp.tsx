import { useState } from 'react'
import AppShell from '../../shared/AppShell'
import { apps } from '../registry'

const app = apps.find((a) => a.id === 'unvez')!

type View = 'calc' | 'conv' | 'memos'

export default function UnvezApp() {
  const [view, setView] = useState<View>('conv')
  const sidebar = (
    <>
      <p className="unvez-side-label">Calculer</p>
      <button
        type="button"
        className={`unvez-side-btn${view === 'calc' ? ' active' : ''}`}
        onClick={() => setView('calc')}
      >
        Calculatrice
      </button>
      <button
        type="button"
        className={`unvez-side-btn${view === 'conv' ? ' active' : ''}`}
        onClick={() => setView('conv')}
      >
        Conversion
      </button>
      <p className="unvez-side-label">
        Mémos enregistrés
        <button type="button" className="unvez-side-add" title="Nouveau dossier" aria-label="Nouveau dossier">
          +
        </button>
      </p>
      <button
        type="button"
        className={`unvez-side-btn${view === 'memos' ? ' active' : ''}`}
        onClick={() => setView('memos')}
      >
        Sans dossier
      </button>
    </>
  )
  return (
    <AppShell appId="unvez" appName="Unvez" logo={app.logo!} sidebar={sidebar}>
      {view === 'calc' && (
        <section className="unvez-view">
          <h2>Calculatrice</h2>
          <p className="unvez-empty">Pavé simple/scientifique — étape 3.3.</p>
        </section>
      )}
      {view === 'conv' && (
        <section className="unvez-view">
          <h2>Conversion</h2>
          <p className="unvez-empty">Convertisseur d’unités — étape 3.2.</p>
        </section>
      )}
      {view === 'memos' && (
        <section className="unvez-view">
          <h2>Mémos enregistrés</h2>
          <p className="unvez-empty">Aucun mémo pour l’instant — étape 3.4.</p>
        </section>
      )}
    </AppShell>
  )
}
