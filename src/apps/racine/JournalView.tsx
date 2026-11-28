import { useState } from 'react'
import { notify } from '../../shared/notify'
import { fmtDay, fmtTime, summarize } from './events'
import { deleteEvent, saveEvent, TRACKER_LABELS, type EventType, type HealthEvent } from './store'
import CalendarMonth from './CalendarMonth'
import { filterEvents } from './vues'

interface Props {
  events: HealthEvent[]
  onChanged: () => Promise<void>
}

const toDateInput = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function JournalView({ events, onChanged }: Props): JSX.Element {
  const [types, setTypes] = useState<EventType[]>([])
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'list' | 'cal'>('list')
  const [editing, setEditing] = useState<HealthEvent | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [armed, setArmed] = useState<string | null>(null)

  const shown = filterEvents(events, types.length ? types : null, q)

  const toggleType = (t: EventType): void => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const startEdit = (e: HealthEvent): void => {
    setEditing(e)
    setEditDate(toDateInput(e.date))
    setEditNote(e.note)
    setArmed(null)
  }

  const saveEdit = async (): Promise<void> => {
    if (!editing) return
    const t = Date.parse(`${editDate}T12:00:00`)
    if (!isFinite(t)) {
      notify('Date invalide')
      return
    }
    await saveEvent({ ...editing, date: t, note: editNote })
    setEditing(null)
    await onChanged()
    notify('Entrée modifiée')
  }

  const remove = async (e: HealthEvent): Promise<void> => {
    await deleteEvent(e.id)
    setArmed(null)
    await onChanged()
    notify('Entrée supprimée')
  }

  return (
    <section className="ra-view">
      <div className="ra-cat-head">
        <h2>Journal</h2>
        <button type="button" className="unvez-btn" aria-label="Basculer calendrier" onClick={() => setMode(mode === 'list' ? 'cal' : 'list')}>
          {mode === 'list' ? '📅 Calendrier' : '🧾 Timeline'}
        </button>
      </div>
      {mode === 'cal' ? (
        <CalendarMonth events={events} />
      ) : (
        <>
          <div className="ra-toolbar">
            <input aria-label="Rechercher dans les notes" placeholder="Rechercher dans les notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ra-triggers">
            {Object.keys(TRACKER_LABELS).map((t) => {
              const et = t as EventType
              return (
                <button
                  key={t}
                  type="button"
                  className={`ra-trig-btn${types.includes(et) ? ' active' : ''}`}
                  aria-label={`Filtrer ${TRACKER_LABELS[et]}`}
                  aria-pressed={types.includes(et)}
                  onClick={() => toggleType(et)}
                >
                  {TRACKER_LABELS[et]}
                </button>
              )
            })}
          </div>
          <p className="ra-muted">
            {shown.length} entrée(s){types.length ? ` — filtres : ${types.map((t) => TRACKER_LABELS[t]).join(', ')}` : ''}
          </p>
          <ul className="ra-journal">
            {shown.map((e) => (
              <li key={e.id} className="ra-journal-item">
                <div className="ra-journal-line">
                  <span className="ra-time">{fmtDay(e.date)} {fmtTime(e.date)}</span>
                  <span className={`ra-sum ra-${e.type}`}>{summarize(e)}</span>
                  <span className="ra-badge">{TRACKER_LABELS[e.type]}</span>
                </div>
                {e.note && <p className="ra-note">{e.note}</p>}
                {editing?.id === e.id ? (
                  <div className="ra-form-row">
                    <input aria-label="Modifier la date" type="date" value={editDate} onChange={(ev) => setEditDate(ev.target.value)} />
                    <input aria-label="Modifier la note" value={editNote} onChange={(ev) => setEditNote(ev.target.value)} />
                    <button type="button" className="db-btn primary" aria-label="Enregistrer la modification" onClick={() => void saveEdit()}>
                      Enregistrer
                    </button>
                    <button type="button" className="unvez-btn" aria-label="Annuler la modification" onClick={() => setEditing(null)}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  <div className="ra-form-row">
                    <button type="button" className="unvez-btn" aria-label={`Modifier l’entrée ${summarize(e)}`} onClick={() => startEdit(e)}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className={`unvez-btn${armed === e.id ? ' danger armed' : ''}`}
                      aria-label={`Supprimer l’entrée ${summarize(e)}`}
                      onClick={() => (armed === e.id ? void remove(e) : setArmed(e.id))}
                    >
                      {armed === e.id ? 'Confirmer la suppression ?' : 'Supprimer'}
                    </button>
                  </div>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className="ra-muted">Aucune entrée.</li>}
          </ul>
        </>
      )}
    </section>
  )
}
