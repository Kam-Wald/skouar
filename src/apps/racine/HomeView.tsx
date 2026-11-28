import { useState } from 'react'
import { notify } from '../../shared/notify'
import { allCrisisTriggers, crisisCoOccurrences } from './crise'
import { addEvent, ensureRef, fmtTime, summarize, todayEvents, validatePayload } from './events'
import QuickEntry from './QuickEntry'
import { makeEvent, saveEvent, TRACKER_LABELS, type EventType, type HealthEvent, type RefEntity } from './store'

const QUICK: [EventType, string][] = [
  ['moral', '+ Moral'],
  ['energie', '+ Énergie'],
  ['poids', '+ Poids'],
  ['crise', '+ Crise'],
  ['sommeil', '+ Sommeil'],
  ['symptome', '+ Symptôme'],
  ['habitude', '+ Habitude'],
  ['traitement', '+ Efficacité'],
  ['note', '+ Note']
]

interface Props {
  activeTrackers: EventType[]
  events: HealthEvent[]
  refs: RefEntity[]
  onChanged: () => Promise<void>
}

export default function HomeView({ activeTrackers, events, refs, onChanged }: Props): JSX.Element {
  const [entry, setEntry] = useState<EventType | null>(null)
  const [crise, setCrise] = useState<HealthEvent | null>(null)

  const quick = async (t: EventType): Promise<void> => {
    if (t === 'crise') {
      const e = makeEvent('crise', Date.now(), { intensity: null, zone: null, declencheurs: [] }, '')
      await saveEvent(e)
      setCrise(e)
      setEntry('crise')
      await onChanged()
      notify(`Crise horodatée à ${fmtTime(e.date)}`)
      return
    }
    setCrise(null)
    setEntry(entry === t ? null : t)
  }

  const onSave = async (payload: Record<string, unknown>, note: string): Promise<void> => {
    if (!entry) return
    if (entry === 'habitude' && typeof payload.name === 'string' && payload.name.trim()) {
      const ref = await ensureRef('habitude', payload.name)
      payload = { refId: ref.id, name: ref.name }
    }
    const e = await addEvent(entry, payload, note)
    if (!e) {
      notify(validatePayload(entry, payload) ?? 'Saisie invalide')
      return
    }
    setEntry(null)
    await onChanged()
    notify(`${TRACKER_LABELS[entry]} enregistré`)
  }

  const onSaveCrise = async (ev: HealthEvent, payload: Record<string, unknown>, note: string): Promise<void> => {
    const err = validatePayload('crise', payload)
    if (err) {
      notify(err)
      return
    }
    await saveEvent({ ...ev, payload, note: note || ev.note })
    await onChanged()
    notify('Crise mise à jour')
  }

  const today = todayEvents(events)
  const criseNow = crise ? events.find((e) => e.id === crise.id) ?? crise : null

  return (
    <section className="ra-view">
      <h2>Accueil</h2>
      <p className="ra-muted">{events.length} entrée(s) au total — {today.length} aujourd’hui.</p>
      <div className="ra-quick-grid">
        {QUICK.filter(([t]) => activeTrackers.includes(t)).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={`ra-quick-btn${t === 'crise' ? ' crise' : ''}${entry === t ? ' active' : ''}`}
            onClick={() => void quick(t)}
          >
            {label}
          </button>
        ))}
      </div>
      {entry && (
        <QuickEntry
          type={entry}
          criseEvent={criseNow}
          allTriggers={allCrisisTriggers(events)}
          coOcc={crisisCoOccurrences(events)}
          traitementRefs={refs.filter((r) => r.kind === 'traitement')}
          onSave={(p, n) => void onSave(p, n)}
          onSaveCrise={(ev, p, n) => void onSaveCrise(ev, p, n)}
          onClose={() => {
            setEntry(null)
            setCrise(null)
          }}
        />
      )}
      <h3>Aujourd’hui</h3>
      <ul className="ra-today">
        {today.map((e) => (
          <li key={e.id}>
            <span className="ra-time">{fmtTime(e.date)}</span>
            <span className={`ra-sum ra-${e.type}`}>{summarize(e)}</span>
            {e.note && <span className="ra-note"> — {e.note}</span>}
          </li>
        ))}
        {today.length === 0 && <li className="ra-muted">Rien aujourd’hui — commence par un bouton ci-dessus.</li>}
      </ul>
    </section>
  )
}
