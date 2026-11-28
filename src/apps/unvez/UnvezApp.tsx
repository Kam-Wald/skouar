import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { apps } from '../registry'
import CalcView from './CalcView'
import ConvView from './ConvView'
import { DEFAULT_SETTINGS, kv, type UnvezSettings } from './store'

const app = apps.find((a) => a.id === 'unvez')!

type View = 'calc' | 'conv' | 'memos'

export default function UnvezApp() {
  const [view, setView] = useState<View>('conv')
  const [settings, setSettings] = useState<UnvezSettings | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let alive = true
    kv.loadKV<Partial<UnvezSettings>>('settings')
      .then((s) => {
        if (!alive) return
        const loaded = { ...DEFAULT_SETTINGS, ...(s ?? {}) }
        loaded.tape = (loaded.tape ?? []).filter((e) => e && typeof e === 'object')
        setSettings(loaded)
      })
      .catch(() => {
        if (alive) setSettings({ ...DEFAULT_SETTINGS })
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const on = (e: Event) => setToast((e as CustomEvent<string>).detail ?? '')
    window.addEventListener('skouar:toast', on)
    return () => window.removeEventListener('skouar:toast', on)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

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
      {view === 'calc' &&
        (settings ? (
          <CalcView settings={settings} onSettings={onSettings} />
        ) : (
          <section className="unvez-view">
            <p className="unvez-empty">Chargement…</p>
          </section>
        ))}
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
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
