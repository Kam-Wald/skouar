import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { apps } from '../registry'
import ConvView from './ConvView'
import { DEFAULT_SETTINGS, kv, type UnvezSettings } from './store'

const app = apps.find((a) => a.id === 'unvez')!

type View = 'calc' | 'conv' | 'memos'

export default function UnvezApp() {
  const [view, setView] = useState<View>('conv')
  const [settings, setSettings] = useState<UnvezSettings | null>(null)

  useEffect(() => {
    let alive = true
    kv.loadKV<Partial<UnvezSettings>>('settings')
      .then((s) => {
        if (alive) setSettings({ ...DEFAULT_SETTINGS, ...(s ?? {}) })
      })
      .catch(() => {
        if (alive) setSettings({ ...DEFAULT_SETTINGS })
      })
    return () => {
      alive = false
    }
  }, [])

  const onSettings = (patch: Partial<UnvezSettings>): void => {
    setSettings((prev) => {
      const next = { ...(prev ?? DEFAULT_SETTINGS), ...patch }
      void kv.saveKV('settings', next).catch(() => {})
      return next
    })
  }

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
      {view === 'conv' &&
        (settings ? (
          <ConvView settings={settings} onSettings={onSettings} />
        ) : (
          <section className="unvez-view">
            <p className="unvez-empty">Chargement…</p>
          </section>
        ))}
      {view === 'memos' && (
        <section className="unvez-view">
          <h2>Mémos enregistrés</h2>
          <p className="unvez-empty">Aucun mémo pour l’instant — étape 3.4.</p>
        </section>
      )}
    </AppShell>
  )
}
