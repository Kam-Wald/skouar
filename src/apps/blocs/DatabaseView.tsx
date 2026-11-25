import { useMemo, useState } from 'react'
import type { CellValue, Column, Database, PropType, Row } from './types'
import { createColumn, createRow } from './store'

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

  const addColumn = () => {
    const name = window.prompt('Nom de la colonne :', 'Nouvelle colonne')
    if (!name) return
    const raw = window.prompt(
      'Type : text | number | select | date | checkbox',
      'text'
    )
    const type = PROP_TYPES.includes(raw as PropType)
      ? (raw as PropType)
      : 'text'
    const col = createColumn(name, type)
    if (type === 'select') {
      const opts = window.prompt(
        'Options de la sélection (séparées par des virgules) :',
        ''
      )
      col.options = (opts ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    patch({ columns: [...db.columns, col] })
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
        <button className="db-btn" onClick={addRow}>
          + Ligne
        </button>
        <button className="db-btn" onClick={addColumn}>
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
      <div className="db-scroll">
        <table className="db-table">
          <thead>
            <tr>
              {db.columns.map((c) => (
                <th key={c.id}>
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
    </div>
  )
}
