import { useState } from 'react'
import { DEFAULT_RACINE_SETTINGS, TRACKERS, TRACKER_LABELS } from './store'

interface Props {
  onDone: (trackers: Record<string, boolean>) => void
}

export default function Onboarding({ onDone }: Props): JSX.Element {
  const [sel, setSel] = useState<Record<string, boolean>>(() => ({ ...DEFAULT_RACINE_SETTINGS.trackers }))
  const any = TRACKERS.some((t) => sel[t] !== false)
  return (
    <div className="ra-onboard">
      <h1>Racine</h1>
      <p className="ra-muted">Journal de suivi santé et humeur, 100 % local. Quels suivis veux-tu activer ? (Modifiable plus tard dans ⚙️.)</p>
      <div className="ra-onboard-list">
        {TRACKERS.map((t) => (
          <label key={t} className="ra-onboard-item">
            <input
              type="checkbox"
              aria-label={`Suivi ${TRACKER_LABELS[t]}`}
              checked={sel[t] !== false}
              onChange={(e) => setSel({ ...sel, [t]: e.target.checked })}
            />
            <span>{TRACKER_LABELS[t]}</span>
          </label>
        ))}
      </div>
      <button type="button" className="db-btn primary" disabled={!any} onClick={() => onDone(sel)}>
        Commencer
      </button>
    </div>
  )
}
