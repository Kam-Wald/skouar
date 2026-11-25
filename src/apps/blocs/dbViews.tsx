import { useMemo, useState } from 'react'
import type { CellValue, Column, Database, Row } from './types'

export function primaryColumn(db: Database): Column | undefined {
  return db.columns.find((c) => c.type === 'text') ?? db.columns[0]
}

function cellText(v: CellValue): string {
  if (v == null) return ''
  return String(v)
}

interface ViewProps {
  db: Database
  rows: Row[]
  onUpdateCell: (rowId: string, colId: string, value: CellValue) => void
}

export function BoardView({ db, rows, onUpdateCell }: ViewProps) {
  const groupCol =
    db.columns.find((c) => c.id === db.groupBy) ??
    db.columns.find((c) => c.type === 'select') ??
    db.columns.find((c) => c.type === 'text')
  const primary = primaryColumn(db)

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>()
    if (!groupCol) return map
    for (const r of rows) {
      const key = cellText(r.cells[groupCol.id]) || 'Sans étiquette'
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return map
  }, [rows, groupCol])

  if (!groupCol) {
    return (
      <p className="db-empty">
        Ajoute une colonne « Sélection » ou « Texte » pour grouper le board.
      </p>
    )
  }

  const order: string[] = []
  if (groupCol.type === 'select' && groupCol.options) order.push(...groupCol.options)
  for (const k of groups.keys()) if (!order.includes(k)) order.push(k)

  return (
    <div className="db-board">
      {order.map((g) => (
        <div className="db-board-col" key={g}>
          <div className="db-board-col-head">
            {g} <span className="db-count">{groups.get(g)?.length ?? 0}</span>
          </div>
          {(groups.get(g) ?? []).map((r) => (
            <div className="db-card" key={r.id}>
              <div className="db-card-title">
                {primary ? cellText(r.cells[primary.id]) || 'Sans titre' : 'Ligne'}
              </div>
              {groupCol.type === 'select' && (
                <select
                  className="db-select"
                  value={cellText(r.cells[groupCol.id])}
                  onChange={(e) =>
                    onUpdateCell(r.id, groupCol.id, e.target.value || null)
                  }
                >
                  <option value="">Sans étiquette</option>
                  {(groupCol.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function GalleryView({ db, rows }: ViewProps) {
  const primary = primaryColumn(db)
  if (rows.length === 0) return <p className="db-empty">Aucune ligne</p>
  return (
    <div className="db-gallery">
      {rows.map((r) => (
        <div className="db-card db-gallery-card" key={r.id}>
          <div className="db-card-title">
            {primary ? cellText(r.cells[primary.id]) || 'Sans titre' : 'Ligne'}
          </div>
          {db.columns
            .filter((c) => c !== primary)
            .map((c) => {
              const v = r.cells[c.id]
              if (v == null || v === '' || v === false) return null
              return (
                <div className="db-gallery-line" key={c.id}>
                  <span className="db-gallery-k">{c.name}</span> {cellText(v)}
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )
}

export function CalendarView({ db, rows }: ViewProps) {
  const dateCol = db.columns.find((c) => c.type === 'date')
  const primary = primaryColumn(db)
  const today = new Date()
  const [ym, setYm] = useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth()
  })

  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>()
    if (!dateCol) return map
    for (const r of rows) {
      const d = r.cells[dateCol.id]
      if (typeof d === 'string' && d) {
        const arr = map.get(d) ?? []
        arr.push(r)
        map.set(d, arr)
      }
    }
    return map
  }, [rows, dateCol])

  if (!dateCol) {
    return (
      <p className="db-empty">
        Ajoute une colonne « Date » pour utiliser la vue calendrier.
      </p>
    )
  }

  const first = new Date(ym.y, ym.m, 1)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthLabel = first.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  })
  const isToday = (d: number | null) =>
    d === today.getDate() && ym.m === today.getMonth() && ym.y === today.getFullYear()

  return (
    <div className="db-cal">
      <div className="db-cal-head">
        <button
          className="db-btn"
          onClick={() =>
            setYm((s) => ({ y: s.m === 0 ? s.y - 1 : s.y, m: s.m === 0 ? 11 : s.m - 1 }))
          }
        >
          ←
        </button>
        <strong>{monthLabel}</strong>
        <button
          className="db-btn"
          onClick={() =>
            setYm((s) => ({ y: s.m === 11 ? s.y + 1 : s.y, m: s.m === 11 ? 0 : s.m + 1 }))
          }
        >
          →
        </button>
      </div>
      <div className="db-cal-grid">
        {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d) => (
          <div key={d} className="db-cal-dow">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const key = d ? `${ym.y}-${pad(ym.m + 1)}-${pad(d)}` : null
          const dayRows = key ? (byDay.get(key) ?? []) : []
          return (
            <div key={i} className={`db-cal-day${isToday(d) ? ' today' : ''}`}>
              {d && <div className="db-cal-num">{d}</div>}
              {dayRows.slice(0, 3).map((r) => (
                <div key={r.id} className="db-cal-ev">
                  {primary ? cellText(r.cells[primary.id]) || 'Sans titre' : 'Ligne'}
                </div>
              ))}
              {dayRows.length > 3 && (
                <div className="db-cal-more">+{dayRows.length - 3}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
