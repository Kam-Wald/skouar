import { useMemo, useState } from 'react'
import type { CellValue, Column, Database, Row } from './types'

export function primaryColumn(db: Database): Column | undefined {
  return db.columns.find((c) => c.type === 'text') ?? db.columns[0]
}

export function cellText(v: CellValue): string {
  if (v == null) return ''
  return String(v)
}

interface ViewProps {
  db: Database
  rows: Row[]
  onUpdateCell: (rowId: string, colId: string, value: CellValue) => void
  onPatch: (p: Partial<Database>) => void
}

function propsLine(db: Database, r: Row, primary: Column | undefined): string {
  return db.columns
    .filter(
      (c) =>
        c !== primary &&
        r.cells[c.id] != null &&
        r.cells[c.id] !== '' &&
        r.cells[c.id] !== false
    )
    .map((c) => `${c.name} : ${cellText(r.cells[c.id])}`)
    .join(' · ')
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
          {propsLine(db, r, primary) && (
            <div className="db-gallery-line">{propsLine(db, r, primary)}</div>
          )}
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
    d === today.getDate() &&
    ym.m === today.getMonth() &&
    ym.y === today.getFullYear()

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

export function ListView({ db, rows }: ViewProps) {
  const primary = primaryColumn(db)
  if (rows.length === 0) return <p className="db-empty">Aucune ligne</p>
  return (
    <div className="db-list">
      {rows.map((r) => (
        <div className="db-list-row" key={r.id}>
          <span className="db-card-title">
            {primary ? cellText(r.cells[primary.id]) || 'Sans titre' : 'Ligne'}
          </span>
          <span className="db-list-props">{propsLine(db, r, primary)}</span>
        </div>
      ))}
    </div>
  )
}

export function TimelineView({ db, rows }: ViewProps) {
  const dateCol = db.columns.find((c) => c.type === 'date')
  const primary = primaryColumn(db)
  if (!dateCol) {
    return (
      <p className="db-empty">
        Ajoute une colonne « Date » pour utiliser la vue chronologie.
      </p>
    )
  }
  const sorted = [...rows]
    .filter((r) => typeof r.cells[dateCol.id] === 'string')
    .sort((a, b) =>
      String(a.cells[dateCol.id]).localeCompare(String(b.cells[dateCol.id]))
    )
  if (sorted.length === 0) return <p className="db-empty">Aucune entrée datée</p>
  return (
    <div className="db-timeline">
      {sorted.map((r) => (
        <div className="db-tl-item" key={r.id}>
          <span className="db-tl-dot" />
          <div className="db-tl-body">
            <span className="db-tl-date">
              {new Date(String(r.cells[dateCol.id])).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
            <span className="db-card-title">
              {primary ? cellText(r.cells[primary.id]) || 'Sans titre' : 'Ligne'}
            </span>
            {propsLine(db, r, primary) && (
              <span className="db-list-props">{propsLine(db, r, primary)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function FeedView({ db, rows }: ViewProps) {
  const primary = primaryColumn(db)
  const sorted = [...rows].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  if (sorted.length === 0) return <p className="db-empty">Aucune ligne</p>
  return (
    <div className="db-feed">
      {sorted.map((r) => (
        <div className="db-feed-row" key={r.id}>
          <span className="db-feed-date">
            {r.createdAt
              ? new Date(r.createdAt).toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : ''}
          </span>
          <div>
            <div className="db-card-title">
              {primary ? cellText(r.cells[primary.id]) || 'Sans titre' : 'Ligne'}
            </div>
            {propsLine(db, r, primary) && (
              <div className="db-list-props">{propsLine(db, r, primary)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChartView({ db, rows, onPatch }: ViewProps) {
  const groupCol =
    db.columns.find((c) => c.id === db.groupBy) ??
    db.columns.find((c) => c.type === 'select') ??
    db.columns.find((c) => c.type === 'text')
  const numCol = db.columns.find((c) => c.type === 'number')
  const agg = db.chartAgg ?? 'count'

  const data = useMemo(() => {
    const map = new Map<string, number>()
    if (!groupCol) return map
    for (const r of rows) {
      const key = cellText(r.cells[groupCol.id]) || 'Sans étiquette'
      const v = agg === 'sum' && numCol ? Number(r.cells[numCol.id] ?? 0) : 1
      map.set(key, (map.get(key) ?? 0) + v)
    }
    return map
  }, [rows, groupCol, agg, numCol])

  if (!groupCol) {
    return (
      <p className="db-empty">
        Ajoute une colonne « Sélection » ou « Texte » pour l’axe du graphique.
      </p>
    )
  }

  const entries = [...data.entries()]
  const max = Math.max(1, ...entries.map((e) => e[1]))

  return (
    <div className="db-chart">
      <div className="db-toolbar">
        <select
          className="db-select"
          value={agg}
          onChange={(e) => onPatch({ chartAgg: e.target.value as 'count' | 'sum' })}
        >
          <option value="count">Compter les lignes</option>
          <option value="sum" disabled={!numCol}>
            Somme de {numCol?.name ?? '…'}
          </option>
        </select>
      </div>
      {entries.map(([k, v]) => (
        <div className="db-chart-row" key={k}>
          <span className="db-chart-label">{k}</span>
          <div className="db-chart-bar-wrap">
            <div
              className="db-chart-bar"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
          <span className="db-chart-val">{v}</span>
        </div>
      ))}
      {entries.length === 0 && <p className="db-empty">Aucune donnée</p>}
    </div>
  )
}
