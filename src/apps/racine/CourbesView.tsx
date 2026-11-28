import { useState } from 'react'
import { notify } from '../../shared/notify'
import { addEvent, fmtDay } from './events'
import { markersIn, PERIODS, seriesFor, suiviOptions, windowBounds, type PeriodId } from './vues'
import type { HealthEvent, RefEntity } from './store'

interface Props {
  events: HealthEvent[]
  refs: RefEntity[]
  onChanged: () => Promise<void>
}

const W = 640
const H = 240
const PAD = 30

export default function CourbesView({ events, refs, onChanged }: Props): JSX.Element {
  const options = suiviOptions(refs)
  const [suivi, setSuivi] = useState(options[0]?.id ?? 'poids')
  const [period, setPeriod] = useState<PeriodId>('3m')
  const [mkLabel, setMkLabel] = useState('')
  const [mkDate, setMkDate] = useState('')
  const [showMk, setShowMk] = useState(false)

  const opt = options.find((o) => o.id === suivi) ?? options[0]
  const per = PERIODS.find((p) => p.id === period) ?? PERIODS[1]
  const { from, to } = windowBounds(per.days)
  const points = opt ? seriesFor(opt.filter, events, from, to) : []
  const markers = markersIn(events, from, to)

  const addMarker = async (): Promise<void> => {
    const label = mkLabel.trim()
    const t = mkDate ? Date.parse(`${mkDate}T12:00:00`) : Date.now()
    if (!label || !isFinite(t)) {
      notify('Libellé et date du marqueur requis')
      return
    }
    await addEvent('marqueur', { label, date: t }, '')
    setMkLabel('')
    setMkDate('')
    setShowMk(false)
    await onChanged()
    notify(`Marqueur « ${label} » épinglé`)
  }

  const minY = points.length ? Math.min(...points.map((p) => p.value)) : 0
  const maxY = points.length ? Math.max(...points.map((p) => p.value)) : 0
  const span = maxY - minY || 1
  const xAt = (i: number): number => PAD + (i / Math.max(1, points.length - 1)) * (W - 2 * PAD)
  const yAt = (v: number): number => H - PAD - ((v - minY) / span) * (H - 2 * PAD)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ')

  const xOf = (ts: number): number => PAD + ((ts - from) / (to - from)) * (W - 2 * PAD)

  return (
    <section className="ra-view">
      <h2>Courbes</h2>
      <div className="ra-form-row">
        <select aria-label="Suivi à tracer" value={opt?.id ?? ''} onChange={(e) => setSuivi(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)}>
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button type="button" className="unvez-btn" aria-label="Ajouter un marqueur" onClick={() => setShowMk(!showMk)}>
          📌 Épingler un marqueur
        </button>
      </div>
      {showMk && (
        <div className="ra-form-row">
          <input aria-label="Libellé du marqueur" placeholder="ex. début traitement…" value={mkLabel} onChange={(e) => setMkLabel(e.target.value)} />
          <input aria-label="Date du marqueur" type="date" value={mkDate} onChange={(e) => setMkDate(e.target.value)} />
          <button type="button" className="db-btn primary" aria-label="Enregistrer le marqueur" onClick={() => void addMarker()}>
            Enregistrer
          </button>
        </div>
      )}
      {points.length === 0 ? (
        <p className="ra-muted">Aucune donnée « {opt?.label} » sur cette période.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="ra-chart" role="img" aria-label={`Courbe ${opt?.label} sur ${per.label}`}>
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="ra-axis" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="ra-axis" />
          <text x={4} y={PAD + 4} className="ra-axis-label">
            {maxY}
          </text>
          <text x={4} y={H - PAD} className="ra-axis-label">
            {minY}
          </text>
          <text x={PAD} y={H - 8} className="ra-axis-label">
            {fmtDay(from)}
          </text>
          <text x={W - PAD - 60} y={H - 8} className="ra-axis-label">
            {fmtDay(to - 1)}
          </text>
          {markers.map((m) => (
            <g key={m.id}>
              <line x1={xOf(m.date)} y1={PAD} x2={xOf(m.date)} y2={H - PAD} className="ra-marker" />
              <text x={xOf(m.date) + 3} y={PAD + 12} className="ra-marker-label">
                {String(m.payload.label)}
              </text>
            </g>
          ))}
          <polyline points={line.split(' ').map((s) => s.slice(1)).join(' ')} className="ra-line" fill="none" />
          {points.map((p, i) => (
            <circle key={p.date} cx={xAt(i)} cy={yAt(p.value)} r={4} className="ra-point">
              <title>{`${fmtDay(p.date)} : ${String(p.value).replace('.', ',')}`}</title>
            </circle>
          ))}
        </svg>
      )}
      <p className="ra-muted">
        {points.length} point(s) — {markers.length} marqueur(s) sur la période. Les croisements de courbes sont hors périmètre v1 (12.D).
      </p>
    </section>
  )
}
