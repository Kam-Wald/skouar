import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { loadAppSettings, saveAppSettings, SETTINGS_EVENT } from '../../shared/Settings'
import { apps } from '../registry'
import CycleView from './CycleView'
import HomeView from './HomeView'
import Onboarding from './Onboarding'
import PreventifView from './PreventifView'
import RdvView from './RdvView'
import TraitementsView from './TraitementsView'
import { DEFAULT_RACINE_SETTINGS, listEvents, listRefs, TRACKERS, type EventType, type HealthEvent, type RacineSettings, type RefEntity } from './store'

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

function loadSettings(): RacineSettings {
  const raw = loadAppSettings('racine') as Partial<RacineSettings>
  return {
    onboarded: raw.onboarded === true,
    trackers: { ...DEFAULT_RACINE_SETTINGS.trackers, ...(raw.trackers ?? {}) }
  }
}

export default function RacineApp() {
  const [view, setView] = useState<View>('home')
  const [toast, setToast] = useState('')
  const [events, setEvents] = useState<HealthEvent[]>([])
  const [refs, setRefs] = useState<RefEntity[]>([])
  const [settings, setSettings] = useState<RacineSettings>(loadSettings)

  const reload = async (): Promise<void> => {
    const [ev, rf] = await Promise.all([listEvents(), listRefs()])
    setEvents(ev)
    setRefs(rf)
  }

  useEffect(() => {
    let alive = true
    void Promise.all([listEvents(), listRefs()])
      .then(([ev, rf]) => {
        if (alive) {
          setEvents(ev)
          setRefs(rf)
        }
      })
      .catch(() => {
        if (alive) notify('Lecture impossible — état vide en mémoire, rien n’est écrit')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const on = () => setSettings(loadSettings())
    window.addEventListener(SETTINGS_EVENT, on)
    return () => window.removeEventListener(SETTINGS_EVENT, on)
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

  const persist = (s: RacineSettings): void => {
    setSettings(s)
    saveAppSettings('racine', { onboarded: s.onboarded, trackers: s.trackers }, true)
  }

  if (!settings.onboarded) {
    return (
      <>
        <Onboarding
          onDone={(trackers) => persist({ onboarded: true, trackers })}
        />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    )
  }

  const activeTrackers = TRACKERS.filter((t) => settings.trackers[t] !== false)

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
      {view === 'home' ? (
        <HomeView activeTrackers={activeTrackers} events={events} refs={refs} onChanged={reload} />
      ) : view === 'traitements' ? (
        <TraitementsView events={events} refs={refs} onChanged={reload} />
      ) : view === 'cycle' ? (
        <CycleView events={events} onChanged={reload} />
      ) : view === 'rdv' ? (
        <RdvView events={events} onChanged={reload} />
      ) : view === 'preventif' ? (
        <PreventifView refs={refs} onChanged={reload} />
      ) : (
        <section className="ra-view">
          <h2>{LABELS.find(([v]) => v === view)?.[1] ?? 'Racine'}</h2>
          <p className="ra-muted">Cette vue arrive dans une prochaine sous-partie.</p>
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
