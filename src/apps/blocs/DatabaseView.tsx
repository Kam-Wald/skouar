import { useMemo, useRef, useState, type DragEvent } from 'react'
import type { AggType, CellValue, Column, Database, PropType, Row, ViewType } from './types'
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
import MapView from './MapView'
import GanttView from './GanttView'
import {
  cellDisplay,
  computedCell,
  statusColor,
  type DbRef
} from './fields'

const PROP_LABELS: Record<PropType, string> = {
  text: 'Texte',
  number: 'Nombre',
  select: 'Sélection',
  multi: 'Multi-sélection',
  date: 'Date',
  checkbox: 'Case',
  url: 'URL',
  email: 'E-mail',
  phone: 'Téléphone',
  status: 'Statut',
  formula: 'Formule',
  relation: 'Relation',
  rollup: 'Rollup',
  location: 'Lieu (carte)',
  id: 'ID unique',
  created: 'Créé le',
  edited: 'Modifié le'
}

const PROP_TYPES: PropType[] = [
  'text', 'number', 'select', 'multi', 'date', 'checkbox', 'status',
  'url', 'email', 'phone', 'location', 'formula', 'relation', 'rollup',
  'id', 'created', 'edited'
]

const OPERATORS: Record<string, { op: string; label: string }[]> = {
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
  multi: [{ op: 'is', label: 'contient' }],
  status: [{ op: 'is', label: 'est' }],
  checkbox: [
    { op: 'checked', label: 'cochée' },
    { op: 'unchecked', label: 'non cochée' }
  ]
}

function matchCell(cell: CellValue, type: string, op: string, val: string): boolean {
  if (type === 'checkbox') return op === 'checked' ? cell === true : cell !== true
  if (type === 'multi') {
    const arr = Array.isArray(cell) ? cell : []
    return arr.includes(val)
  }
  if (type === 'number') {
    const n = Number(cell)
    const v = Number(val)
    if (cell == null || Number.isNaN(n) || Number.isNaN(v)) return false
    if (op === 'eq') return n === v
    if (op === 'gt') return n > v
    return n < v
  }
  if (type === 'date') {
    const a = typeof cell === 'string' ? cell : ''
    if (!a) return false
    if (op === 'eq') return a === val
    if (op === 'gt') return a > val
    return a < val
  }
  const s = cellDisplay(cell)
  if (op === 'is') return s === val
  return s.toLowerCase().includes(val.toLowerCase())
}

function compareCells(a: CellValue, b: CellValue): number {
  const sa = cellDisplay(a)
  const sb = cellDisplay(b)
  if (sa === '' && sb === '') return 0
  if (sa === '') return 1
  if (sb === '') return -1
  const na = Number(sa)
  const nb = Number(sb)
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  return sa.localeCompare(sb)
}

function CellEditor({
  col,
  value,
  db,
  allDbs,
  onChange
}: {
  col: Column
  value: CellValue
  db: Database
  allDbs: DbRef[]
  onChange: (v: CellValue) => void
}) {
  const [multiOpen, setMultiOpen] = useState(false)

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
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
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
    case 'status': {
      const opts = col.options ?? []
      const sel = (
        <>
          <select
            className="db-select db-cell-select"
            value={typeof value === 'string' ? value : ''}
            style={
              col.type === 'status' && typeof value === 'string' && value
                ? { backgroundColor: statusColor(col, value), color: '#fff', border: 'none' }
                : undefined
            }
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">—</option>
            {opts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <input
            className="db-cell-input"
            list={`opts-${col.id}`}
            placeholder="+ option…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                onChange(e.currentTarget.value.trim())
                e.currentTarget.value = ''
              }
            }}
          />
          <datalist id={`opts-${col.id}`}>
            {opts.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      )
      return sel
    }
    case 'multi': {
      const arr = Array.isArray(value) ? value : []
      const opts = col.options ?? []
      const toggle = (o: string) =>
        onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])
      return (
        <span className="db-multi-wrap">
          {arr.map((v) => (
            <span key={v} className="tag-chip" style={{ backgroundColor: statusColor(col, v) }}>
              {v}
            </span>
          ))}
          <button className="db-btn" onClick={() => setMultiOpen((o) => !o)}>
            +
          </button>
          {multiOpen && (
            <span className="db-multi-pop">
              {(opts.length ? opts : arr).map((o) => (
                <label key={o} className="db-multi-opt">
                  <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} />
                  {o}
                </label>
              ))}
              <input
                className="db-input"
                placeholder="nouvelle option + Entrée"
                onKeyDown={(e) => {
                  const v = e.currentTarget.value.trim()
                  if (e.key === 'Enter' && v) {
                    onChange([...new Set([...arr, v])])
                    e.currentTarget.value = ''
                  }
                }}
              />
            </span>
          )}
        </span>
      )
    }
    case 'relation': {
      const target = allDbs.find((d) => d.id === col.relationDbId)
      const rows = target?.db.rows ?? []
      const relPrimary = target ? target.db.columns.find((c) => c.type === 'text') ?? target.db.columns[0] : undefined
      return (
        <select
          className="db-select db-cell-select"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {relPrimary ? cellDisplay(r.cells[relPrimary.id]) || 'Sans titre' : r.id}
            </option>
          ))}
        </select>
      )
    }
    default:
      return (
        <input
          className="db-cell-input"
          type={col.type === 'email' ? 'email' : col.type === 'url' || col.type === 'phone' ? 'text' : 'text'}
          placeholder={col.type === 'url' ? 'https://…' : col.type === 'email' ? '…@…' : col.type === 'phone' ? '+33…' : col.type === 'location' ? 'Adresse…' : ''}
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
  allDbs: DbRef[]
}

export default function DatabaseView({ db, title, onTitle, onChange, allDbs }: Props) {
  const [filterCol, setFilterCol] = useState('')
  const [filterOp, setFilterOp] = useState('')
  const [filterVal, setFilterVal] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [colForm, setColForm] = useState(false)
  const [colName, setColName] = useState('')
  const [colType, setColType] = useState<PropType>('text')
  const [colOpts, setColOpts] = useState('')
  const [colFormula, setColFormula] = useState('')
  const [colRelDb, setColRelDb] = useState('')
  const [colRollupDb, setColRollupDb] = useState('')
  const [colRollupCol, setColRollupCol] = useState('')
  const [colRollupAgg, setColRollupAgg] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('sum')
  const colDragId = useRef<string | null>(null)
  const [colOverId, setColOverId] = useState<string | null>(null)

  const patch = (p: Partial<Database>) => onChange({ ...db, ...p })
  const view: ViewType = db.view ?? 'table'

  const switchView = (v: ViewType) => {
    const extra: Partial<Database> = { view: v }
    if (v === 'board' && !db.groupBy) {
      const g =
        db.columns.find((c) => c.type === 'select' || c.type === 'status') ??
        db.columns.find((c) => c.type === 'text')
      if (g) extra.groupBy = g.id
    }
    patch(extra)
  }

  const submitColumn = () => {
    const name = colName.trim()
    if (!name) return
    const col = createColumn(name, colType)
    if (['select', 'multi', 'status'].includes(colType)) {
      col.options = colOpts.split(',').map((s) => s.trim()).filter(Boolean)
    }
    if (colType === 'formula') col.formula = colFormula
    if (colType === 'relation') col.relationDbId = colRelDb || undefined
    if (colType === 'rollup') {
      col.relationDbId = colRollupDb || undefined
      col.rollupColId = colRollupCol || undefined
      col.rollupAgg = colRollupAgg
    }
    patch({ columns: [...db.columns, col] })
    setColForm(false)
    setColName('')
    setColType('text')
    setColOpts('')
    setColFormula('')
    setColRelDb('')
    setColRollupDb('')
    setColRollupCol('')
  }

  const addRow = () => patch({ rows: [...db.rows, createRow(db.columns)] })

  const updateCell = (rowId: string, colId: string, value: CellValue) =>
    patch({
      rows: db.rows.map((r) =>
        r.id === rowId
          ? { ...r, updatedAt: Date.now(), cells: { ...r.cells, [colId]: value } }
          : r
      )
    })

  const deleteRow = (rowId: string) =>
    patch({ rows: db.rows.filter((r) => r.id !== rowId) })

  const renameColumn = (colId: string, name: string) =>
    patch({ columns: db.columns.map((c) => (c.id === colId ? { ...c, name } : c)) })

  const deleteColumn = (colId: string) =>
    patch({ columns: db.columns.filter((c) => c.id !== colId) })

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

  const aggOptions = (c: Column): { v: AggType; label: string }[] => {
    const base: { v: AggType; label: string }[] = [
      { v: 'countAll', label: 'Compter tout' },
      { v: 'count', label: 'Compter (non vides)' }
    ]
    if (c.type === 'number') return [...base, { v: 'sum', label: 'Somme' }, { v: 'avg', label: 'Moyenne' }, { v: 'min', label: 'Min' }, { v: 'max', label: 'Max' }]
    if (c.type === 'checkbox') return [...base, { v: 'checked', label: 'Cochées' }]
    return base
  }

  const aggValue = (c: Column, agg: AggType | undefined): string => {
    if (!agg) return ''
    const vals = db.rows.map((r) => r.cells[c.id])
    const nonEmpty = vals.filter((v) => v != null && cellDisplay(v) !== '')
    switch (agg) {
      case 'countAll': return String(db.rows.length)
      case 'count': return String(nonEmpty.length)
      case 'checked': return String(vals.filter((v) => v === true).length)
      case 'sum': return String(nonEmpty.reduce<number>((a, v) => a + Number(v ?? 0), 0))
      case 'avg': {
        const nums = nonEmpty.map(Number).filter((n) => !Number.isNaN(n))
        return nums.length ? String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100) : '—'
      }
      case 'min': return String(nonEmpty.length ? Math.min(...nonEmpty.map(Number)) : '—')
      case 'max': return String(nonEmpty.length ? Math.max(...nonEmpty.map(Number)) : '—')
      default: return ''
    }
  }

  const setAgg = (colId: string, agg: AggType | undefined) => {
    const aggs = { ...(db.aggs ?? {}) }
    if (agg) aggs[colId] = agg
    else delete aggs[colId]
    patch({ aggs })
  }

  const filterColumn = db.columns.find((c) => c.id === filterCol)
  const filterNeedsValue =
    filterColumn && filterColumn.type !== 'checkbox' && filterOp

  const visibleRows = useMemo(() => {
    let rows: Row[] = db.rows
    if (filterColumn && filterOp) {
      rows = rows.filter((r) =>
        matchCell(computedCell(db, r, filterColumn, allDbs), filterColumn.type, filterOp, filterVal)
      )
    }
    if (sortCol) {
      const sc = db.columns.find((c) => c.id === sortCol)
      if (sc) {
        rows = [...rows].sort(
          (a, b) =>
            compareCells(computedCell(db, a, sc, allDbs), computedCell(db, b, sc, allDbs)) *
            (sortDir === 'asc' ? 1 : -1)
        )
      }
    }
    return rows
  }, [db, allDbs, filterColumn, filterOp, filterVal, sortCol, sortDir])

  const rollupDb = allDbs.find((d) => d.id === colRollupDb)

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
          <option value="feed">📰 Fil d'actus</option>
          <option value="chart">📊 Graphique</option>
          <option value="map">🗺 Carte</option>
          <option value="gantt">🗓 Frise (Gantt)</option>
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
              .filter((c) => ['select', 'status', 'multi', 'text'].includes(c.type))
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        )}
        <button className="db-btn" onClick={addRow}>
          + Ligne
        </button>
        <span className="db-type">{db.rows.length} ligne(s)</span>
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
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {filterColumn && (
          <select
            className="db-select"
            value={filterOp}
            onChange={(e) => setFilterOp(e.target.value)}
          >
            <option value="">opérateur…</option>
            {(OPERATORS[filterColumn.type] ?? OPERATORS.text).map((o) => (
              <option key={o.op} value={o.op}>{o.label}</option>
            ))}
          </select>
        )}
        {filterNeedsValue && (
          <input
            className="db-input"
            type={filterColumn?.type === 'number' ? 'number' : filterColumn?.type === 'date' ? 'date' : 'text'}
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
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {sortCol && (
          <button className="db-btn" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
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
              <option key={t} value={t}>{PROP_LABELS[t]}</option>
            ))}
          </select>
          {['select', 'multi', 'status'].includes(colType) && (
            <input
              className="db-input"
              placeholder="Options séparées par des virgules"
              value={colOpts}
              onChange={(e) => setColOpts(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitColumn() }}
            />
          )}
          {colType === 'formula' && (
            <input
              className="db-input"
              placeholder="Formule : {Prix} * {Quantité}"
              value={colFormula}
              onChange={(e) => setColFormula(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitColumn() }}
            />
          )}
          {colType === 'relation' && (
            <select className="db-select" value={colRelDb} onChange={(e) => setColRelDb(e.target.value)}>
              <option value="">Lier à une BDD…</option>
              {allDbs.filter((d) => d.id !== db.id).map((d) => (
                <option key={d.id} value={d.id}>{d.db.title || 'Sans titre'}</option>
              ))}
            </select>
          )}
          {colType === 'rollup' && (
            <>
              <select className="db-select" value={colRollupDb} onChange={(e) => { setColRollupDb(e.target.value); setColRollupCol('') }}>
                <option value="">BDD source…</option>
                {allDbs.filter((d) => d.id !== db.id).map((d) => (
                  <option key={d.id} value={d.id}>{d.db.title || 'Sans titre'}</option>
                ))}
              </select>
              <select className="db-select" value={colRollupCol} onChange={(e) => setColRollupCol(e.target.value)} disabled={!rollupDb}>
                <option value="">Champ…</option>
                {(rollupDb?.db.columns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="db-select" value={colRollupAgg} onChange={(e) => setColRollupAgg(e.target.value as typeof colRollupAgg)}>
                <option value="sum">somme</option>
                <option value="avg">moyenne</option>
                <option value="min">min</option>
                <option value="max">max</option>
                <option value="count">compte</option>
              </select>
            </>
          )}
          <button className="db-btn" onClick={submitColumn}>Ajouter</button>
          <button className="db-btn" onClick={() => setColForm(false)}>Annuler</button>
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
                    <button className="db-col-del" title="Supprimer la colonne" onClick={() => deleteColumn(c.id)}>×</button>
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
                      {['formula', 'rollup', 'created', 'edited', 'id'].includes(c.type) ? (
                        <span className="db-readonly">{cellDisplay(computedCell(db, r, c, allDbs))}</span>
                      ) : (
                        <CellEditor
                          col={c}
                          value={r.cells[c.id] ?? null}
                          db={db}
                          allDbs={allDbs}
                          onChange={(v) => updateCell(r.id, c.id, v)}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button className="db-row-del" title="Supprimer la ligne" onClick={() => deleteRow(r.id)}>×</button>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td className="db-empty" colSpan={db.columns.length + 1}>
                    Aucune ligne — <button className="db-btn" onClick={addRow}>＋ Nouvelle ligne</button>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                {db.columns.map((c) => (
                  <td key={c.id} className="db-agg-cell">
                    <select
                      className="db-select"
                      value={db.aggs?.[c.id] ?? ''}
                      onChange={(e) => setAgg(c.id, (e.target.value || undefined) as AggType | undefined)}
                      title="Calcul sur cette colonne"
                    >
                      <option value="">—</option>
                      {aggOptions(c).map((o) => (
                        <option key={o.v} value={o.v}>{o.label}</option>
                      ))}
                    </select>
                    {db.aggs?.[c.id] && <span className="db-agg-val">= {aggValue(c, db.aggs[c.id])}</span>}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {view === 'board' && <BoardView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'gallery' && <GalleryView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'calendar' && <CalendarView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'list' && <ListView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'timeline' && <TimelineView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'feed' && <FeedView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'chart' && <ChartView db={db} rows={visibleRows} onUpdateCell={updateCell} onPatch={patch} />}
      {view === 'map' && <MapView db={db} rows={visibleRows} />}
      {view === 'gantt' && <GanttView db={db} rows={visibleRows} onPatch={patch} />}
    </div>
  )
}
