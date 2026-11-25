import { useMemo, useRef, useState, type DragEvent } from 'react'
import type { CellValue, Column, Database, PropType, Row, ViewType } from './types'
import { createColumn, createRow } from './store'
import {
  BoardView,
  CalendarView,
  ChartView,
  FeedView,
  GalleryView,
  ListView,
  TimelineView
} from './dbViews'

const PROP_LABELS: Record<PropType, string> = {
  text: 'Texte',
  number: 'Nombre',
  select: 'Sélection',
  date: 'Date',
  checkbox: 'Case'
}

const PROP_TYPES: PropType[] = ['text', 'number', 'select', 'date', 'checkbox']

const OPERATORS: Record<PropType, { op: string; label: string }[]> = {
  text: [
    { op: 'contains', label: 'contient' },
    { op: 'is', label: 'est' }
  ],
  number: [
    { op: 'eq', label: '=' },
    { op: 'gt', label: '>' },
    { op: 'lt', label: '<' }
  ],
  date: [
    { op: 'eq', label: '=' },
    { op: 'gt', label: 'après' },
    { op: 'lt', label: 'avant' }
  ],
  select: [{ op: 'is', label: 'est' }],
  checkbox: [
    { op: 'checked', label: 'cochée' },
    { op: 'unchecked', label: 'non cochée' }
  ]
}

function matchCell(
  cell: CellValue,
  type: PropType,
  op: string,
  val: string
): boolean {
  switch (type) {
    case 'checkbox':
      return op === 'checked' ? cell === true : cell !== true
    case 'number': {
      const n = Number(cell)
      const v = Number(val)
      if (cell == null || Number.isNaN(n) || Number.isNaN(v)) return false
      if (op === 'eq') return n === v
      if (op === 'gt') return n > v
      return n < v
    }
    case 'date': {
      const a = typeof cell === 'string' ? cell : ''
      if (!a) return false
      if (op === 'eq') return a === val
      if (op === 'gt') return a > val
      return a < val
    }
    default: {
      const s = String(cell ?? '')
      if (op === 'is') return s === val
      return s.toLowerCase().includes(val.toLowerCase())
    }
  }
}

function compareCells(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function CellEditor({
  col,
  value,
  onChange
}: {
  col: Column
  value: CellValue
  onChange: (v: CellValue) => void
}) {
  switch (col.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className="db-cell-input"
          value={value == null ? '' : String(value)}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
        />
      )
    case 'date':
      return (
        <input
          type="date"
          className="db-cell-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case 'select':
      return (
        <>
          <input
            className="db-cell-input"
            list={`opts-${col.id}`}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
          <datalist id={`opts-${col.id}`}>
            {(col.options ?? []).map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      )
    default:
      return (
        <input
          className="db-cell-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
  }
}

interface Props {
  db: Database
  title: string
  onTitle: (t: string) => void
  onChange: (db: Database) => void
}

export default function DatabaseView({ db, title, onTitle, onChange }: Props) {
  const [filterCol, setFilterCol] = useState('')
  const [filterOp, setFilterOp] = useState('')
  const [filterVal, setFilterVal] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const patch = (p: Partial<Database>) => onChange({ ...db, ...p })

  const view: ViewType = db.view ?? 'table'

  const switchView = (v: ViewType) => {
    const extra: Partial<Database> = { view: v }
    if (v === 'board' && !db.groupBy) {
      const g =
        db.columns.find((c) => c.type === 'select') ??
        db.columns.find((c) => c.type === 'text')
      if (g) extra.groupBy = g.id
    }
    patch(extra)
  }

  const colDragId = useRef<string | null>(null)
  const [colOverId, setColOverId] = useState<string | null>(null)

  const moveColumn = (id: string, targetId: string) => {
    if (id === targetId) return
    const idx = db.columns.findIndex((c) => c.id === id)
    const tidx = db.columns.findIndex((c) => c.id === targetId)
    if (idx < 0 || tidx < 0) return
    const columns = [...db.columns]
    const [c] = columns.splice(idx, 1)
    columns.splice(tidx, 0, c)
    patch({ columns })
  }

  const colDragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      colDragId.current = id
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setColOverId(id)
    },
    onDragLeave: () => setColOverId(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setColOverId(null)
      const dragged = colDragId.current ?? e.dataTransfer.getData('text/plain')
      colDragId.current = null
      if (dragged) moveColumn(dragged, id)
    }
  })

  const [colForm, setColForm] = useState(false)
  const [colName, setColName] = useState('')
  const [colType, setColType] = useState<PropType>('text')
  const [colOpts, setColOpts] = useState('')

  const submitColumn = () => {
    const name = colName.trim()
    if (!name) return
    const col = createColumn(name, colType)
    if (colType === 'select') {
      col.options = colOpts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    patch({ columns: [...db.columns, col] })
    setColForm(false)
    setColName('')
    setColType('text')
    setColOpts('')
  }

  const addRow = () => patch({ rows: [...db.rows, createRow(db.columns)] })

  const updateCell = (rowId: string, colId: string, value: CellValue) =>
    patch({
      rows: db.rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      )
    })

  const deleteRow = (rowId: string) =>
    patch({ rows: db.rows.filter((r) => r.id !== rowId) })

  const renameColumn = (colId: string, name: string) =>
    patch({
      columns: db.columns.map((c) => (c.id === colId ? { ...c, name } : c))
    })

  const deleteColumn = (colId: string) =>
    patch({ columns: db.columns.filter((c) => c.id !== colId) })

  const filterColumn = db.columns.find((c) => c.id === filterCol)
  const filterNeedsValue =
    filterColumn && filterColumn.type !== 'checkbox' && filterOp

  const visibleRows = useMemo(() => {
    let rows: Row[] = db.rows
    if (filterColumn && filterOp) {
      rows = rows.filter((r) =>
        matchCell(r.cells[filterColumn.id], filterColumn.type, filterOp, filterVal)
      )
    }
    if (sortCol) {
      const sc = db.columns.find((c) => c.id === sortCol)
      if (sc) {
        rows = [...rows].sort(
          (a, b) =>
            compareCells(a.cells[sc.id], b.cells[sc.id]) *
            (sortDir === 'asc' ? 1 : -1)
        )
      }
    }
    return rows
  }, [db, filterColumn, filterOp, filterVal, sortCol, sortDir])

  return (
    <div className="db" onFocus={(e) => e.stopPropagation()}>
      <input
        className="db-title"
        value={title}
        placeholder="Nom de la base de données"
        onChange={(e) => onTitle(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div className="db-toolbar">
        <select
          className="db-select"
          value={view}
          onChange={(e) => switchView(e.target.value as ViewType)}
          title="Changer de vue"
        >
          <option value="table">▦ Tableau</option>
          <option value="board">▮ Board</option>
          <option value="gallery">▤ Galerie</option>
          <option value="calendar">▦ Calendrier</option>
          <option value="list">☰ Liste</option>
          <option value="timeline">🕒 Chronologie</option>
          <option value="feed">📰 Fil d’actus</option>
          <option value="chart">📊 Graphique</option>
        </select>
        {view === 'board' && (
          <select
            className="db-select"
            value={db.groupBy ?? ''}
            onChange={(e) => patch({ groupBy: e.target.value || undefined })}
            title="Colonne de groupement"
          >
            <option value="">Grouper par…</option>
            {db.columns
              .filter((c) => c.type === 'select' || c.type === 'text')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
        <button className="db-btn" onClick={addRow}>
          + Ligne
        </button>
        <button className="db-btn" onClick={() => setColForm(true)}>
          + Colonne
        </button>
        <select
          className="db-select"
          value={filterCol}
          onChange={(e) => {
            setFilterCol(e.target.value)
            setFilterOp('')
            setFilterVal('')
          }}
        >
          <option value="">Filtrer…</option>
          {db.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filterColumn && (
          <select
            className="db-select"
            value={filterOp}
            onChange={(e) => setFilterOp(e.target.value)}
          >
            <option value="">opérateur…</option>
            {OPERATORS[filterColumn.type].map((o) => (
              <option key={o.op} value={o.op}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {filterNeedsValue && (
          <input
            className="db-input"
            type={
              filterColumn?.type === 'number'
                ? 'number'
                : filterColumn?.type === 'date'
                  ? 'date'
                  : 'text'
            }
            value={filterVal}
            onChange={(e) => setFilterVal(e.target.value)}
            placeholder="valeur…"
          />
        )}
        <select
          className="db-select"
          value={sortCol}
          onChange={(e) => setSortCol(e.target.value)}
        >
          <option value="">Trier…</option>
          {db.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {sortCol && (
          <button
            className="db-btn"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDir === 'asc' ? '↑ croissant' : '↓ décroissant'}
          </button>
        )}
      </div>
      {colForm && (
        <div className="db-col-form">
          <input
            className="db-input"
            placeholder="Nom de la colonne"
            value={colName}
            autoFocus
            onChange={(e) => setColName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitColumn()
              if (e.key === 'Escape') setColForm(false)
            }}
          />
          <select
            className="db-select"
            value={colType}
            onChange={(e) => setColType(e.target.value as PropType)}
          >
            {PROP_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROP_LABELS[t]}
              </option>
            ))}
          </select>
          {colType === 'select' && (
            <input
              className="db-input"
              placeholder="Options séparées par des virgules"
              value={colOpts}
              onChange={(e) => setColOpts(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitColumn()
              }}
            />
          )}
          <button className="db-btn" onClick={submitColumn}>
            Ajouter
          </button>
          <button className="db-btn" onClick={() => setColForm(false)}>
            Annuler
          </button>
        </div>
      )}
      {view === 'table' && (
      <div className="db-scroll">
        <table className="db-table">
          <thead>
            <tr>
              {db.columns.map((c) => (
                <th key={c.id} className={colOverId === c.id ? 'drag-over' : ''} {...colDragProps(c.id)}>
                  <input
                    className="db-col-name"
                    value={c.name}
                    onChange={(e) => renameColumn(c.id, e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <span className="db-type">{PROP_LABELS[c.type]}</span>
                  <button
                    className="db-col-del"
                    title="Supprimer la colonne"
                    onClick={() => deleteColumn(c.id)}
                  >
                    ×
                  </button>
                </th>
              ))}
              <th className="db-row-del-head" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id}>
                {db.columns.map((c) => (
                  <td key={c.id}>
                    <CellEditor
                      col={c}
                      value={r.cells[c.id] ?? null}
                      onChange={(v) => updateCell(r.id, c.id, v)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    className="db-row-del"
                    title="Supprimer la ligne"
                    onClick={() => deleteRow(r.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td className="db-empty" colSpan={db.columns.length + 1}>
                  Aucune ligne
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      {view === 'board' && (
        <BoardView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
      {view === 'gallery' && (
        <GalleryView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
      {view === 'calendar' && (
        <CalendarView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
      {view === 'list' && (
        <ListView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
      {view === 'timeline' && (
        <TimelineView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
      {view === 'feed' && (
        <FeedView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
      {view === 'chart' && (
        <ChartView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />
      )}
    </div>
  )
}
