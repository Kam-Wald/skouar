import { useState } from 'react'
import { notify } from '../../shared/notify'
import BodyMap from './BodyMap'
import { crisisTriggers, toggleTrigger, type CoOcc } from './crise'
import { LEVEL_LABELS, validatePayload } from './events'
import { TRACKER_LABELS, type EventType, type HealthEvent } from './store'

interface Props {
  type: EventType
  criseEvent: HealthEvent | null
  allTriggers: string[]
  coOcc: CoOcc[]
  onSave: (payload: Record<string, unknown>, note: string) => void
  onSaveCrise: (ev: HealthEvent, payload: Record<string, unknown>, note: string) => void
  onClose: () => void
}

export default function QuickEntry({ type, criseEvent, allTriggers, coOcc, onSave, onSaveCrise, onClose }: Props): JSX.Element {
  const [note, setNote] = useState('')
  const [poids, setPoids] = useState('')
  const [coucher, setCoucher] = useState('')
  const [reveil, setReveil] = useState('')
  const [symType, setSymType] = useState('')
  const [duree, setDuree] = useState('')
  const [habit, setHabit] = useState('')
  const [noteLibre, setNoteLibre] = useState('')
  const [newTrig, setNewTrig] = useState('')

  const label = TRACKER_LABELS[type]
  const submit = async (payload: Record<string, unknown>): Promise<void> => {
    if (criseEvent) {
      onSaveCrise(criseEvent, payload, note)
    } else {
      const err = validatePayload(type, payload)
      if (err) {
        notify(err)
        return
      }
      onSave(payload, type === 'note' ? noteLibre : note)
    }
    setNote('')
    setNoteLibre('')
  }

  const triggers = criseEvent ? crisisTriggers(criseEvent) : []
  const zone = criseEvent ? String(criseEvent.payload.zone ?? '') || null : null

  return (
    <div className="ra-entry" role="group" aria-label={`Saisie ${label}`}>
      <div className="ra-entry-head">
        <strong>{label}</strong>
        <button type="button" className="unvez-btn" aria-label="Fermer la saisie" onClick={onClose}>
          ✕
        </button>
      </div>
      {(type === 'moral' || type === 'energie') && (
        <>
          <div className="ra-levels">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="ra-level-btn"
                aria-label={`${label} niveau ${n}`}
                onClick={() => void submit({ level: n })}
              >
                {n} · {LEVEL_LABELS[type][n - 1]}
              </button>
            ))}
          </div>
          <input aria-label="Note (facultatif)" placeholder="Note facultative…" value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}
      {type === 'poids' && (
        <div className="ra-form-row">
          <input aria-label="Poids (kg)" type="number" min={0} step={0.1} placeholder="kg" value={poids} onChange={(e) => setPoids(e.target.value)} />
          <button type="button" className="db-btn primary" aria-label="Enregistrer le poids" onClick={() => void submit({ kg: Number(poids.replace(',', '.')) })}>
            Enregistrer
          </button>
        </div>
      )}
      {type === 'crise' && criseEvent && (
        <>
          <p className="ra-muted">Crise horodatée — localise-la, note l’intensité et les facteurs suspects :</p>
          <BodyMap
            selected={zone}
            onPick={(z) => void submit({ ...criseEvent.payload, zone: z })}
          />
          <div className="ra-levels">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button key={n} type="button" className="ra-level-btn" aria-label={`Intensité ${n}`} onClick={() => void submit({ ...criseEvent.payload, intensity: n })}>
                {n}
              </button>
            ))}
          </div>
          <div className="ra-triggers">
            {allTriggers.map((t) => (
              <button
                key={t}
                type="button"
                className={`ra-trig-btn${triggers.includes(t) ? ' active' : ''}`}
                aria-label={`Déclencheur ${t}`}
                aria-pressed={triggers.includes(t)}
                onClick={() => void submit({ ...criseEvent.payload, declencheurs: toggleTrigger(triggers, t) })}
              >
                {t}
              </button>
            ))}
            <input aria-label="Nouveau déclencheur" placeholder="Nouveau facteur…" value={newTrig} onChange={(e) => setNewTrig(e.target.value)} />
            <button
              type="button"
              className="db-btn"
              aria-label="Ajouter le déclencheur"
              onClick={() => {
                if (!newTrig.trim()) return
                void submit({ ...criseEvent.payload, declencheurs: toggleTrigger(triggers, newTrig) })
                setNewTrig('')
              }}
            >
              +
            </button>
          </div>
          {coOcc.length > 0 && (
            <p className="ra-cooc">
              Sur tes {coOcc[0].total} dernières crises avec déclencheurs :{' '}
              {coOcc.map((c) => `${c.name} (${c.count}/${c.total})`).join(', ')} — observation statistique uniquement, aucune conclusion médicale.
            </p>
          )}
          <div className="ra-form-row">
            <input aria-label="Note de la crise" placeholder="Note facultative…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="db-btn" aria-label="Enregistrer la note de la crise" onClick={() => void submit(criseEvent.payload)}>
              OK
            </button>
          </div>
        </>
      )}
      {type === 'sommeil' && (
        <>
          <div className="ra-form-row">
            <input aria-label="Heure de coucher" type="time" value={coucher} onChange={(e) => setCoucher(e.target.value)} />
            <input aria-label="Heure de réveil" type="time" value={reveil} onChange={(e) => setReveil(e.target.value)} />
          </div>
          <div className="ra-levels">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="ra-level-btn"
                aria-label={`Qualité du sommeil ${n}`}
                onClick={() => void submit({ coucher, reveil, qualite: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      {type === 'symptome' && (
        <>
          <div className="ra-form-row">
            <input aria-label="Type de symptôme" placeholder="ex. fièvre, fatigue…" value={symType} onChange={(e) => setSymType(e.target.value)} />
            <input aria-label="Durée (facultative)" placeholder="ex. 2 h" value={duree} onChange={(e) => setDuree(e.target.value)} />
          </div>
          <div className="ra-levels">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                className="ra-level-btn"
                aria-label={`Intensité du symptôme ${n}`}
                onClick={() => void submit({ type: symType, intensite: n, duree: duree.trim() })}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      {type === 'habitude' && (
        <div className="ra-form-row">
          <input aria-label="Habitude" placeholder="ex. sport, sortie…" value={habit} onChange={(e) => setHabit(e.target.value)} />
          <button type="button" className="db-btn primary" aria-label="Enregistrer l’habitude" onClick={() => void submit({ name: habit })}>
            Enregistrer
          </button>
        </div>
      )}
      {type === 'note' && (
        <>
          <textarea aria-label="Note du jour" rows={3} value={noteLibre} onChange={(e) => setNoteLibre(e.target.value)} />
          <button type="button" className="db-btn primary" aria-label="Enregistrer la note" onClick={() => void submit({})}>
            Enregistrer
          </button>
        </>
      )}
    </div>
  )
}
