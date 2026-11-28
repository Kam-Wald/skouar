import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { apps } from '../registry'
import { listEvents } from './store'

const app = apps.find((a) => a.id === 'racine')!

type View = 'home' | 'journal' | 'courbes' | 'cycle' | 'rdv' | 'traitements' | 'profil' | 'preventif' | 'rapports'

const LABELS: [View, string][] = [
  ['home', 'Accueil'],
  ['journal', 'Journal'],
  ['courbes', 'Courbes'],
  ['cycle', 'Cycle'],
  ['rdv', 'RDV & ordonnances'],
  ['traitements', 'Traitements'],
  ['profil', 'Profil santé'],
  ['preventif', 'Préventif'],
  ['rapports', 'Rapports']
]

export default function RacineApp() {
  const [view, setView] = useState<View>('home')
  const [toast, setToast] = useState('')
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    void listEvents()
      .then((ev) => {
        if (alive) setCount(ev.length)
      })
      .catch(() => {
        if (alive) notify('Lecture impossible — état vide en mémoire, rien n’est écrit')
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

  const sidebar = (
    <>
      <p className="ra-side-label">Racine</p>
      {LABELS.map(([v, label]) => (
        <button key={v} type="button" className={`ra-side-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
          {label}
        </button>
      ))}
    </>
  )

  return (
    <AppShell appId="racine" appName="Racine" logo={app.logo!} sidebar={sidebar}>
      <section className="ra-view">
        <h2>{LABELS.find(([v]) => v === view)?.[1] ?? 'Racine'}</h2>
        {view === 'home' ? (
          <p className="ra-muted">{count} entrée(s) dans le journal. La saisie rapide, les courbes, le profil et les rapports arrivent par sous-parties.</p>
        ) : (
          <p className="ra-muted">Cette vue arrive dans une prochaine sous-partie.</p>
        )}
      </section>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
