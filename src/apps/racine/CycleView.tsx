import { useState } from 'react'
import { notify } from '../../shared/notify'
import { fmtDay } from './events'
import { addEvent } from './events'
import { cyclePhaseAt, cyclesFromEvents, cycleStats, fmtCycleRange, PHASE_LABELS, predictNextPeriod, predictOvulation, type CycleInfo } from './mesures'
import type { HealthEvent } from './store'

interface Props {
  events: HealthEvent[]
  onChanged: () => Promise<void>
}

const toTs = (v: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const t = Date.parse(`${v}T00:00:00`)
  return isFinite(t) ? t : null
}

export default function CycleView({ events, onChanged }: Props): JSX.Element {
  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState('')
  const [flux, setFlux] = useState('')
  const [note, setNote] = useState('')

  const cycles: CycleInfo[] = cyclesFromEvents(events)
  const st = cycleStats(cycles)
  const next = predictNextPeriod(cycles)
  const ovu = predictOvulation(cycles)
  const phaseToday = cyclePhaseAt(cycles, Date.now())

  const save = async (): Promise<void> => {
    const d = toTs(debut)
    const f = toTs(fin)
    if (!d || !f || f < d) {
      notify('Dates de début/fin requises (début ≤ fin)')
      return
    }
    const e = await addEvent('cycle', { debut: d, fin: f, flux }, note.trim())
    if (!e) {
      notify('Saisie invalide')
      return
    }
    setDebut('')
    setFin('')
    setFlux('')
    setNote('')
    await onChanged()
    notify('Cycle enregistré')
  }

  return (
    <section className="ra-view">
      <h2>Cycle</h2>
      <p className="ra-muted">Calculs locaux, purement indicatifs — aucune donnée ne sort de la machine.</p>
      <div className="ra-form-row">
        <input aria-label="Début des règles" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        <input aria-label="Fin des règles" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        <select aria-label="Flux" value={flux} onChange={(e) => setFlux(e.target.value)}>
          <option value="">Flux…</option>
          <option value="léger">Léger</option>
          <option value="moyen">Moyen</option>
          <option value="abondant">Abondant</option>
        </select>
        <input aria-label="Note du cycle" placeholder="Note facultative…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Enregistrer le cycle" onClick={() => void save()}>
          Enregistrer
        </button>
      </div>
      {st.count > 0 && (
        <div className="ra-cycle-stats">
          <p>
            {st.count} cycle{st.count > 1 ? 's' : ''} — règles moy. {st.avgRegles} j
            {st.avgCycle !== null ? ` — cycle moy. ${st.avgCycle} j` : ''}
          </p>
          {phaseToday && <p>Phase aujourd’hui : <strong>{PHASE_LABELS[phaseToday]}</strong></p>}
          {next && <p className="ra-predict">Prochaine période prévue {fmtCycleRange(next.start, next.end)} (indicatif)</p>}
          {ovu !== null && <p className="ra-predict">Fenêtre ovulatoire indicative autour du {fmtDay(ovu)} (indicatif)</p>}
        </div>
      )}
      <h3>Historique</h3>
      <ul className="ra-cycle-list">
        {cycles.map((c) => (
          <li key={c.id}>
            {fmtCycleRange(c.debut, c.fin)} — règles {c.dureeRegles} j
            {c.dureeCycle !== null ? `, cycle ${c.dureeCycle} j` : ''}
            {c.flux ? `, flux ${c.flux}` : ''}
            {c.note ? ` — ${c.note}` : ''}
          </li>
        ))}
        {cycles.length === 0 && <li className="ra-muted">Aucune période enregistrée.</li>}
      </ul>
    </section>
  )
}
