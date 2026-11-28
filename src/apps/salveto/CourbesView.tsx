import { useMemo, useState } from 'react'
import {
  PERIODES_COURBE,
  addDays,
  dayOf,
  fmtDay,
  inWindow,
  makeEvent,
  marqueursOf,
  niceScale,
  parseDay,
  serieOf,
  todayDay,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs,
  type SeriePoint
} from './logic'

interface Props {
  events: SalvetoEvent[]
  refs: SalvetoRefs
  config: SalvetoConfig
  onSaveEvent: (e: SalvetoEvent) => void
}

interface CourbeProps {
  points: SeriePoint[]
  markers: { day: string; label: string }[]
  unit?: string
  fixedMin?: number
  fixedMax?: number
  seuil?: number
  fromDay: string
  toDay: string
}

function Courbe({ points, markers, unit, fixedMin, fixedMax, seuil, fromDay, toDay }: CourbeProps) {
  const W = 660
  const H = 250
  const padL = 44
  const padR = 14
  const padT = 26
  const padB = 26
  const t0 = parseDay(fromDay).getTime()
  const t1 = parseDay(toDay).getTime() + 86400000
  const x = (day: string): number => padL + ((parseDay(day).getTime() - t0) / (t1 - t0)) * (W - padL - padR)
  const vals = points.map((p) => p.value)
  const scale =
    fixedMin != null && fixedMax != null
      ? { min: fixedMin, max: fixedMax, ticks: Array.from({ length: fixedMax - fixedMin + 1 }, (_, i) => fixedMin + i) }
      : niceScale(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 1)
  const y = (v: number): number => padT + (1 - (v - scale.min) / (scale.max - scale.min)) * (H - padT - padB)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const xTicks: string[] = []
  const span = t1 - t0
  for (let i = 0; i <= 4; i++) {
    const t = t0 + (span * i) / 4
    const d = new Date(t)
    xTicks.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return (
    <svg className="sa-courbe" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Courbe">
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="sa-courbe-grid" />
          <text x={padL - 6} y={y(t) + 4} className="sa-courbe-tick" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {xTicks.map((d) => (
        <text key={d} x={x(d)} y={H - 8} className="sa-courbe-tick" textAnchor="middle">
          {fmtDay(d)}
        </text>
      ))}
      {seuil != null && seuil >= scale.min && seuil <= scale.max && (
        <line x1={padL} x2={W - padR} y1={y(seuil)} y2={y(seuil)} className="sa-courbe-seuil">
          <title>Seuil indicatif : {seuil}{unit ? ` ${unit}` : ''}</title>
        </line>
      )}
      {markers.map((m) => (
        <g key={m.day + m.label}>
          <line x1={x(m.day)} x2={x(m.day)} y1={padT - 6} y2={H - padB} className="sa-mark" />
          <text x={x(m.day)} y={padT - 10} className="sa-mark-label" textAnchor="middle">
            📌 {m.label.length > 14 ? `${m.label.slice(0, 14)}…` : m.label}
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={path} className="sa-courbe-line" />}
      {points.map((p) => (
        <circle key={p.id} cx={x(p.day)} cy={y(p.value)} r={4} className="sa-courbe-pt">
          <title>
            {fmtDay(p.day)} — {p.value}
            {unit ?? ''}
          </title>
        </circle>
      ))}
    </svg>
  )
}

interface TabDef {
  key: string
  label: string
  icon: string
  type: SalvetoEvent['type']
  refId?: string
  unit?: string
  fixedMin?: number
  fixedMax?: number
  seuil?: number
}

export default function CourbesView({ events, refs, config, onSaveEvent }: Props) {
  const tabs: TabDef[] = []
  const push = (id: string, def: Omit<TabDef, 'key'>): void => {
    if (config.activeSuivis.includes(id as never)) tabs.push({ key: id, ...def })
  }
  push('poids', { label: 'Poids', icon: '⚖️', type: 'poids', unit: ' kg' })
  push('moral', { label: 'Moral', icon: '🙂', type: 'moral', fixedMin: 1, fixedMax: 5 })
  push('energie', { label: 'Énergie', icon: '⚡', type: 'energie', fixedMin: 1, fixedMax: 5 })
  push('sommeil', { label: 'Sommeil (qualité)', icon: '🌙', type: 'sommeil', fixedMin: 1, fixedMax: 5 })
  push('crise', { label: 'Crises (intensité)', icon: '💥', type: 'crise', fixedMin: 1, fixedMax: 10 })
  push('symptome', { label: 'Symptômes (intensité)', icon: '🤒', type: 'symptome', fixedMin: 1, fixedMax: 10 })
  for (const r of refs.items.filter((r) => r.kind === 'constante')) {
    if (config.activeSuivis.includes('constante')) {
      tabs.push({ key: `constante:${r.id}`, label: r.label, icon: '🌡️', type: 'constante', refId: r.id, unit: r.unite ? ` ${r.unite}` : undefined, seuil: r.seuil })
    }
  }

  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? 'poids')
  const [jours, setJours] = useState(90)
  const [mLabel, setMLabel] = useState('')
  const [mDate, setMDate] = useState(todayDay())

  const tab = tabs.find((t) => t.key === tabKey) ?? tabs[0]
  const today = todayDay()
  const from = addDays(today, -(jours - 1))
  const points = tab ? inWindow(serieOf(events, tab.type, tab.refId), jours) : []
  const markers = inWindow(marqueursOf(events).map((m) => ({ ...m, day: dayOf(m.date) })), jours).map((m) => ({
    day: m.day,
    label: m.label ?? 'marqueur'
  }))

  const addMarqueur = (): void => {
    if (!mLabel.trim()) return
    onSaveEvent(makeEvent('marqueur', { label: mLabel.trim(), date: `${mDate}T12:00:00` }))
    setMLabel('')
  }

  return (
    <>
      <h1 className="sa-h1">Courbes</h1>
      <div className="sa-panel-row sa-journal-toolbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`sa-tab${tab?.key === t.key ? ' active' : ''}`}
            data-tab={t.key}
            onClick={() => setTabKey(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <span className="sa-bodymap-switch">
          {PERIODES_COURBE.map((p) => (
            <button
              key={p.jours}
              type="button"
              className={jours === p.jours ? 'active' : ''}
              onClick={() => setJours(p.jours)}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>
      {tab && (
        <section>
          <h2 className="sa-h2">
            {tab.icon} {tab.label} — {points.length} point{points.length > 1 ? 's' : ''}
          </h2>
          {points.length === 0 ? (
            <p className="sa-empty">Pas encore de données pour ce suivi sur cette période.</p>
          ) : (
            <Courbe
              points={points}
              markers={markers}
              unit={tab.unit}
              fixedMin={tab.fixedMin}
              fixedMax={tab.fixedMax}
              seuil={tab.seuil}
              fromDay={from}
              toDay={today}
            />
          )}
        </section>
      )}
      <section className="sa-panel">
        <p className="sa-panel-title">📌 Épingler un marqueur d’événement (trait vertical sur toutes les courbes)</p>
        <div className="sa-panel-row">
          <input
            className="db-input"
            type="text"
            placeholder="Libellé (ex. « début traitement »)"
            value={mLabel}
            onChange={(e) => setMLabel(e.target.value)}
          />
          <label className="sa-field">
            Date
            <input className="db-input" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
          </label>
          <button type="button" className="db-btn" disabled={!mLabel.trim() || !mDate} onClick={addMarqueur}>
            Épingler
          </button>
        </div>
        {marqueursOf(events).length > 0 && (
          <div className="sa-chips">
            {marqueursOf(events).map((m) => (
              <span key={m.id} className="sa-chip">
                📌 {m.label} ({fmtDay(dayOf(m.date))})
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
