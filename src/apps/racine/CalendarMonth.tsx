import { useState } from 'react'
import { fmtDay, fmtTime, summarize } from './events'
import { DAYS_FR, dayEvents, MONTHS_FR, monthGrid } from './vues'
import type { HealthEvent } from './store'

interface Props {
  events: HealthEvent[]
}

export default function CalendarMonth({ events }: Props): JSX.Element {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<number | null>(null)

  const cells = monthGrid(year, month, events)
  const selectedEvents = selected !== null ? dayEvents(events, selected) : []

  const shift = (d: number): void => {
    const d2 = new Date(year, month + d, 1)
    setYear(d2.getFullYear())
    setMonth(d2.getMonth())
    setSelected(null)
  }

  return (
    <div className="ra-cal">
      <div className="ra-cal-head">
        <button type="button" className="unvez-btn" aria-label="Mois précédent" onClick={() => shift(-1)}>
          ←
        </button>
        <strong aria-live="polite">
          {MONTHS_FR[month]} {year}
        </strong>
        <button type="button" className="unvez-btn" aria-label="Mois suivant" onClick={() => shift(1)}>
          →
        </button>
      </div>
      <div className="ra-cal-grid" role="grid" aria-label="Calendrier mensuel">
        {DAYS_FR.map((d) => (
          <span key={d} className="ra-cal-dow">
            {d}
          </span>
        ))}
        {cells.map((c) => (
          <button
            key={c.start}
            type="button"
            className={`ra-cal-day${c.inMonth ? '' : ' out'}${c.hasAny ? ' has' : ''}${c.hasCrise ? ' crise' : ''}${c.hasCycle ? ' cycle' : ''}${selected === c.start ? ' selected' : ''}`}
            aria-label={`Jour ${c.day}${c.hasCrise ? ' (crise)' : ''}${c.hasCycle ? ' (règles)' : ''}${!c.hasAny ? ' (sans saisie)' : ''}`}
            aria-pressed={selected === c.start}
            onClick={() => setSelected(selected === c.start ? null : c.start)}
          >
            {c.day}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="ra-cal-day-events" aria-label="Entrées du jour">
          <h3>{fmtDay(selected)}</h3>
          <ul className="ra-today">
            {selectedEvents.map((e) => (
              <li key={e.id}>
                <span className="ra-time">{fmtTime(e.date)}</span>
                <span className={`ra-sum ra-${e.type}`}>{summarize(e)}</span>
                {e.note && <span className="ra-note"> — {e.note}</span>}
              </li>
            ))}
            {selectedEvents.length === 0 && <li className="ra-muted">Aucune saisie ce jour.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
