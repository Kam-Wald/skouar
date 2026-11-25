import { useMemo, useState } from 'react'
import type { Database, Row } from './types'
import { primaryColumn } from './dbViews'
import { cellDisplay } from './fields'

const pad = (n: number) => String(n).padStart(2, '0')

export default function GanttView({
  db,
  rows,
  onPatch
}: {
  db: Database
  rows: Row[]
  onPatch: (p: Partial<Database>) => void
}) {
  const dateCols = db.columns.filter((c) => c.type === 'date')
  const startCol =
    db.columns.find((c) => c.id === db.ganttStart) ?? dateCols[0]
  const endCol =
    db.columns.find((c) => c.id === db.ganttEnd) ?? dateCols[1] ?? dateCols[0]
  const primary = primaryColumn(db)

  const today = new Date()
  const [ym, setYm] = useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth()
  })

  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
  const monthStart = new Date(ym.y, ym.m, 1).getTime()
  const monthEnd = new Date(ym.y, ym.m + 1, 1).getTime()

  const bars = useMemo(() => {
    if (!startCol) return []
    return rows
      .map((r) => {
        const s = cellDisplay(r.cells[startCol.id])
        if (!s) return null
        const e = endCol ? cellDisplay(r.cells[endCol.id]) : s
        const t0 = new Date(s).getTime()
        const t1 = new Date(e).getTime() + 86400000
        if (Number.isNaN(t0) || t1 < monthStart || t0 >= monthEnd) return null
        const left = Math.max(0, (t0 - monthStart) / (monthEnd - monthStart))
        const width = Math.min(1 - left, (t1 - Math.max(t0, monthStart)) / (monthEnd - monthStart))
        return {
          id: r.id,
          label: primary ? cellDisplay(r.cells[primary.id]) || 'Sans titre' : 'Ligne',
          left: left * 100,
          width: Math.max(2, width * 100)
        }
      })
      .filter(Boolean) as { id: string; label: string; left: number; width: number }[]
  }, [rows, startCol, endCol, monthStart, monthEnd, primary])

  if (dateCols.length === 0) {
    return (
      <p className="db-empty">
        Ajoute une colonne « Date » (début) — et une deuxième pour la fin — pour la frise Gantt.
      </p>
    )
  }

  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="db-gantt">
      <div className="db-toolbar">
        <select
          className="db-select"
          value={startCol?.id ?? ''}
          onChange={(e) => onPatch({ ganttStart: e.target.value })}
        >
          <option value="">Début…</option>
          {dateCols.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="db-select"
          value={endCol?.id ?? ''}
          onChange={(e) => onPatch({ ganttEnd: e.target.value })}
        >
          <option value="">Fin…</option>
          {dateCols.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="db-btn" onClick={() => setYm((s) => ({ y: s.m === 0 ? s.y - 1 : s.y, m: s.m === 0 ? 11 : s.m - 1 }))}>←</button>
        <strong style={{ textTransform: 'capitalize' }}>{monthLabel}</strong>
        <button className="db-btn" onClick={() => setYm((s) => ({ y: s.m === 11 ? s.y + 1 : s.y, m: s.m === 11 ? 0 : s.m + 1 }))}>→</button>
      </div>
      <div className="db-gantt-grid">
        <div className="db-gantt-head">
          <div className="db-gantt-label-head" />
          <div className="db-gantt-days">
            {Array.from({ length: daysInMonth }, (_, i) => (
              <span key={i} className={`db-gantt-day${i + 1 === today.getDate() && ym.m === today.getMonth() && ym.y === today.getFullYear() ? ' today' : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
        {bars.map((b) => (
          <div className="db-gantt-row" key={b.id}>
            <div className="db-gantt-label" title={b.label}>{b.label}</div>
            <div className="db-gantt-track">
              <div
                className="db-gantt-bar"
                style={{ left: `${b.left}%`, width: `${b.width}%` }}
                title={b.label}
              />
            </div>
          </div>
        ))}
        {bars.length === 0 && <p className="db-empty">Aucune tâche sur ce mois</p>}
      </div>
    </div>
  )
}

export function ganttDummy(): string {
  return pad(0)
}
