import { useEffect, useRef, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { loadWorkbook, saveWorkbook, uid } from './store'
import {
  columnValues,
  csvExport,
  emptyView,
  fmtDisplay,
  indexToCol,
  keyOf,
  parseFormula,
  parseInput,
  parseKey,
  recalcWorkbook,
  searchCells,
  serializeFormula,
  shiftRefs,
  statusOf,
  tsvParse,
  tsvSerializeRange,
  usedRange,
  viewRows,
  type Cell,
  type CellValue,
  type Sheet,
  type ViewState,
  type Workbook
} from './logic'

const COLS = 30
const ROWS = 80

function rawOf(cell: Cell | undefined): string {
  if (!cell) return ''
  if (cell.f !== undefined) return '=' + cell.f
  if (cell.v === undefined || cell.v === null) return ''
  return typeof cell.v === 'string' ? cell.v : fmtDisplay(cell.v)
}

interface Clip {
  text: string
  c1: number
  r1: number
  c2: number
  r2: number
}

interface Pos {
  col: number
  row: number
}

export default function TaolApp(): JSX.Element {
  const [wb, setWb] = useState<Workbook | null>(null)
  const [sel, setSel] = useState<Pos>({ col: 0, row: 0 })
  const [anchor, setAnchor] = useState<Pos>({ col: 0, row: 0 })
  const [range, setRange] = useState<{ c1: number; r1: number; c2: number; r2: number } | null>(null)
  const [edit, setEdit] = useState<string | null>(null)
  const [clip, setClip] = useState<Clip | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [views, setViews] = useState<Record<string, ViewState>>({})
  const [colMenu, setColMenu] = useState<number | null>(null)
  const [filterDraft, setFilterDraft] = useState<string[] | null>(null)
  const [search, setSearch] = useState<{ q: string; matches: Pos[]; idx: number } | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [fillTo, setFillTo] = useState<Pos | null>(null)
  const [frozen, setFrozen] = useState({ rows: true, cols: false })
  const past = useRef<Workbook[]>([])
  const future = useRef<Workbook[]>([])
  const mainRef = useRef<HTMLDivElement>(null)
  const formulaRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const fillDrag = useRef(false)

  useEffect(() => {
    void loadWorkbook().then((w) => {
      setWb(w)
      const p = parseKey(w.activeCell)
      if (p) {
        setSel(p)
        setAnchor(p)
      }
    })
  }, [])

  useEffect(() => {
    if (wb) saveWorkbook(wb)
  }, [wb])

  useEffect(() => {
    if (search) setTimeout(() => searchRef.current?.focus(), 0)
  }, [search !== null])

  useEffect(() => {
    if (pasteOpen) setTimeout(() => pasteRef.current?.focus(), 0)
  }, [pasteOpen])

  const sheet: Sheet | undefined = wb?.sheets.find((s) => s.id === wb.activeSheetId) ?? wb?.sheets[0]
  const view = (sheet && views[sheet.id]) || emptyView()
  const selKey = keyOf(sel.col, sel.row)
  const selCell = sheet?.cells[selKey]
  const used = sheet ? usedRange(sheet) : { maxC: 0, maxR: 0 }
  const nCols = Math.max(26, Math.min(COLS, used.maxC + 3))
  const nRows = Math.max(50, Math.min(ROWS, used.maxR + 6))
  const displayRows = sheet ? viewRows(sheet, view) : []

  const mutate = (fn: (w: Workbook) => void): void => {
    if (!wb) return
    past.current.push(structuredClone(wb))
    if (past.current.length > 100) past.current.shift()
    future.current = []
    const next = structuredClone(wb)
    fn(next)
    next.activeCell = selKey
    recalcWorkbook(next)
    setWb(next)
    setEdit(null)
  }

  const setCell = (col: number, row: number, cell: Cell | undefined): void => {
    mutate((w) => {
      const sh = w.sheets.find((s) => s.id === w.activeSheetId) ?? w.sheets[0]
      const key = keyOf(col, row)
      if (cell === undefined || (cell.f === undefined && (cell.v === undefined || cell.v === null || cell.v === ''))) delete sh.cells[key]
      else sh.cells[key] = cell
    })
  }

  const commitEdit = (text: string, advance = true): void => {
    const parsed = parseInput(text)
    setCell(sel.col, sel.row, text.trim() === '' ? undefined : parsed)
    if (advance) setSel((s) => ({ col: s.col, row: Math.min(s.row + 1, nRows - 1) }))
  }

  const undo = (): void => {
    const p = past.current.pop()
    if (!p || !wb) return
    future.current.push(structuredClone(wb))
    setWb(p)
    setEdit(null)
    const pk = parseKey(p.activeCell)
    if (pk) {
      setSel(pk)
      setAnchor(pk)
    }
  }
  const redo = (): void => {
    const f = future.current.pop()
    if (!f || !wb) return
    past.current.push(structuredClone(wb))
    setWb(f)
    setEdit(null)
    const pk = parseKey(f.activeCell)
    if (pk) {
      setSel(pk)
      setAnchor(pk)
    }
  }

  const addSheet = (): void => {
    if (!wb) return
    const sh: Sheet = { id: uid(), name: `Feuil ${wb.sheets.length + 1}`, cells: {} }
    past.current.push(structuredClone(wb))
    future.current = []
    const next = structuredClone(wb)
    next.sheets.push(sh)
    next.activeSheetId = sh.id
    setWb(next)
  }
  const delSheet = (id: string): void => {
    if (!wb || wb.sheets.length <= 1) return
    mutate((w) => {
      w.sheets = w.sheets.filter((s) => s.id !== id)
      if (w.activeSheetId === id) w.activeSheetId = w.sheets[0].id
    })
  }
  const renameSheet = (id: string, name: string): void => {
    const n = name.trim()
    if (!n || !wb) return
    mutate((w) => {
      const sh = w.sheets.find((s) => s.id === id)
      if (sh) sh.name = n
    })
    setRenaming(null)
  }

  const doExport = (): void => {
    if (!sheet) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csvExport(sheet)], { type: 'text/csv;charset=utf-8' }))
    a.download = `${sheet.name.replace(/[^a-z0-9_-]+/gi, '_') || 'classeur'}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    notify(`Feuille « ${sheet.name} » exportée en CSV`)
  }

  const selectCell = (c: number, r: number, extend: boolean): void => {
    if (extend) {
      setSel({ col: c, row: r })
      setRange({ c1: Math.min(anchor.col, c), r1: Math.min(anchor.row, r), c2: Math.max(anchor.col, c), r2: Math.max(anchor.row, r) })
    } else {
      setSel({ col: c, row: r })
      setAnchor({ col: c, row: r })
      setRange(null)
    }
    setEdit(null)
  }

  const copySelection = (): void => {
    if (!sheet) return
    const box = range ?? { c1: sel.col, r1: sel.row, c2: sel.col, r2: sel.row }
    const text = tsvSerializeRange(sheet, box.c1, box.r1, box.c2, box.r2)
    setClip({ text, ...box })
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {})
    notify('Copié')
  }

  const pasteText = (text: string): void => {
    if (!sheet || !wb) return
    const grid = tsvParse(text)
    if (grid.length === 0) return
    const dc0 = sel.col
    const dr0 = sel.row
    mutate((w) => {
      const sh = w.sheets.find((s) => s.id === w.activeSheetId) ?? w.sheets[0]
      grid.forEach((row, i) => {
        row.forEach((val, j) => {
          const key = keyOf(dc0 + j, dr0 + i)
          if (val.trim() === '') {
            delete sh.cells[key]
            return
          }
          if (val.startsWith('=')) {
            try {
              const shifted = shiftRefs(parseFormula(val.slice(1)), j, i)
              sh.cells[key] = { f: serializeFormula(shifted) }
              return
            } catch {
              sh.cells[key] = { v: val }
              return
            }
          }
          sh.cells[key] = parseInput(val)
        })
      })
    })
    notify('Collé')
  }

  const paste = (): void => {
    if (clip) {
      pasteText(clip.text)
      return
    }
    if (navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((t) => {
          if (t.trim()) pasteText(t)
        })
        .catch(() => setPasteOpen(true))
    } else {
      setPasteOpen(true)
    }
  }

  const applyFill = (to: Pos): void => {
    if (!sheet) return
    const src = sel
    const cell = sheet.cells[keyOf(src.col, src.row)]
    if (!cell) return
    const c1 = Math.min(src.col, to.col)
    const c2 = Math.max(src.col, to.col)
    const r1 = Math.min(src.row, to.row)
    const r2 = Math.max(src.row, to.row)
    mutate((w) => {
      const sh = w.sheets.find((s) => s.id === w.activeSheetId) ?? w.sheets[0]
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (c === src.col && r === src.row) continue
          const dc = c - src.col
          const dr = r - src.row
          const key = keyOf(c, r)
          if (cell.f !== undefined) {
            try {
              sh.cells[key] = { f: serializeFormula(shiftRefs(parseFormula(cell.f), dc, dr)) }
            } catch {
              delete sh.cells[key]
            }
          } else if (cell.v !== undefined && cell.v !== null) {
            sh.cells[key] = { v: cell.v }
          } else {
            delete sh.cells[key]
          }
        }
      }
    })
  }

  const onFillDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    fillDrag.current = true
    setFillTo(sel)
    const move = (ev: MouseEvent): void => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const td = el?.closest('td.taol-cell') as HTMLTableCellElement | null
      const key = td?.dataset.key
      if (key) {
        const p = parseKey(key)
        if (p) setFillTo(p)
      }
    }
    const up = (ev: MouseEvent): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      fillDrag.current = false
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const td = el?.closest('td.taol-cell') as HTMLTableCellElement | null
      const key = td?.dataset.key
      const p = key ? parseKey(key) : null
      if (p && (p.col !== sel.col || p.row !== sel.row)) applyFill(p)
      setFillTo(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const setView = (fn: (v: ViewState) => void): void => {
    if (!sheet) return
    setViews((vs) => {
      const v = { ...(vs[sheet.id] ?? emptyView()), sort: vs[sheet.id]?.sort ?? null, filters: { ...(vs[sheet.id]?.filters ?? {}) } }
      fn(v)
      return { ...vs, [sheet.id]: v }
    })
  }

  const openColMenu = (c: number): void => {
    setColMenu(c)
    const cur = view.filters[c] ?? null
    setFilterDraft(cur ? [...cur] : columnValues(sheet!, c))
  }

  const statusVals = (): CellValue[] => {
    if (!sheet) return []
    const box = range ?? { c1: sel.col, r1: sel.row, c2: sel.col, r2: sel.row }
    const out: CellValue[] = []
    for (let r = box.r1; r <= box.r2; r++) {
      for (let c = box.c1; c <= box.c2; c++) {
        const cell = sheet.cells[keyOf(c, r)]
        out.push(cell ? (cell.v ?? null) : null)
      }
    }
    return out
  }
  const status = statusOf(statusVals())

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const t = e.target as HTMLElement
    if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    if (!wb || !sheet) return
    const k = e.key
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'f') {
      e.preventDefault()
      setSearch({ q: '', matches: [], idx: 0 })
      return
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') {
      copySelection()
      e.preventDefault()
      return
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'v') {
      paste()
      e.preventDefault()
      return
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (k === 'Enter') {
      e.preventDefault()
      if (edit !== null) commitEdit(edit)
      else setSel((s) => ({ col: s.col, row: Math.min(s.row + 1, nRows - 1) }))
      return
    }
    if (k === 'Tab') {
      e.preventDefault()
      if (edit !== null) commitEdit(edit, false)
      setSel((s) => ({ col: Math.max(0, Math.min(nCols - 1, s.col + (e.shiftKey ? -1 : 1))), row: s.row }))
      return
    }
    if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault()
      if (range) {
        const box = range
        mutate((w) => {
          const sh = w.sheets.find((s) => s.id === w.activeSheetId) ?? w.sheets[0]
          for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) delete sh.cells[keyOf(c, r)]
        })
        setRange(null)
      } else {
        setCell(sel.col, sel.row, undefined)
      }
      return
    }
    if (k === 'F2') {
      e.preventDefault()
      setEdit(rawOf(selCell))
      setTimeout(() => formulaRef.current?.focus(), 0)
      return
    }
    if (k === 'Escape') {
      setEdit(null)
      setColMenu(null)
      setSearch(null)
      return
    }
    if (k.startsWith('Arrow')) {
      e.preventDefault()
      if (edit !== null) return
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k] as [number, number]
      const next = { col: Math.max(0, Math.min(nCols - 1, sel.col + d[0])), row: Math.max(0, Math.min(nRows - 1, sel.row + d[1])) }
      if (e.shiftKey) {
        setSel(next)
        setRange({ c1: Math.min(anchor.col, next.col), r1: Math.min(anchor.row, next.row), c2: Math.max(anchor.col, next.col), r2: Math.max(anchor.row, next.row) })
      } else {
        setSel(next)
        setAnchor(next)
        setRange(null)
      }
      return
    }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setEdit(k)
      setTimeout(() => formulaRef.current?.focus(), 0)
    }
  }

  if (!wb || !sheet) return <div className="taol-main" ref={mainRef} />

  const cols = Array.from({ length: nCols }, (_, c) => c)
  const inRange = (c: number, r: number): boolean => !!range && c >= range.c1 && c <= range.c2 && r >= range.r1 && r <= range.r2
  const inFill = (c: number, r: number): boolean =>
    !!fillTo && c >= Math.min(sel.col, fillTo.col) && c <= Math.max(sel.col, fillTo.col) && r >= Math.min(sel.row, fillTo.row) && r <= Math.max(sel.row, fillTo.row)

  return (
    <AppShell
      appId="taol"
      appName="Taol"
      logo={`${import.meta.env.BASE_URL}app-icons/taol.svg`}
      sidebar={
        <div className="taol-side">
          <p className="taol-side-title">Feuilles</p>
          {wb.sheets.map((s) => (
            <div key={s.id} className={`taol-sheet-row${s.id === wb.activeSheetId ? ' active' : ''}`}>
              {renaming === s.id ? (
                <input
                  className="taol-rename"
                  defaultValue={s.name}
                  autoFocus
                  onBlur={(e) => renameSheet(s.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameSheet(s.id, (e.target as HTMLInputElement).value)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="taol-sheet-name"
                  onClick={() => {
                    past.current.push(structuredClone(wb))
                    setWb({ ...wb, activeSheetId: s.id, activeCell: 'A1' })
                    setSel({ col: 0, row: 0 })
                    setAnchor({ col: 0, row: 0 })
                    setRange(null)
                    setEdit(null)
                  }}
                  onDoubleClick={() => setRenaming(s.id)}
                  title="Double-clic pour renommer"
                >
                  {s.name}
                </button>
              )}
              {wb.sheets.length > 1 && (
                <button type="button" className="taol-sheet-del" title="Supprimer la feuille" onClick={() => delSheet(s.id)}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="db-btn" onClick={addSheet}>
            + Nouvelle feuille
          </button>
          <p className="taol-side-title">Actions</p>
          <button type="button" className="db-btn" onClick={doExport}>
            ⬇ Exporter la feuille en CSV
          </button>
          <button type="button" className="db-btn" onClick={() => window.print()}>
            🖨 Imprimer / PDF
          </button>
          <p className="taol-hint">
            « = » = formule (SOMME, MOYENNE, MIN, MAX, NB, NBVAL, SI, ET, OU, NON ; plages A1:B9 ; $A$1 ; 'Feuil 2'!A1).
            Flèches/Entrée/Tab, Shift pour sélectionner une plage, F2 édite, Ctrl+C/V copie-colle (TSV), Ctrl+F recherche,
            Ctrl+Z/Y annuler/rétablir. ▼ en tête de colonne : trier / filtrer. Poignée ⬊ en bas à droite de la cellule active : recopier.
          </p>
        </div>
      }
    >
      <div className="taol-main" ref={mainRef} onKeyDown={onKeyDown} tabIndex={0}>
        <div className="taol-toolbar">
          <button type="button" className="db-btn" onClick={undo} disabled={past.current.length === 0} title="Annuler (Ctrl+Z)">
            ↶
          </button>
          <button type="button" className="db-btn" onClick={redo} disabled={future.current.length === 0} title="Rétablir (Ctrl+Shift+Z)">
            ↷
          </button>
          <span className="taol-sep" />
          <label className="taol-freeze">
            <input type="checkbox" checked={frozen.rows} onChange={(e) => setFrozen((f) => ({ ...f, rows: e.target.checked }))} />
            Figer ligne 1
          </label>
          <label className="taol-freeze">
            <input type="checkbox" checked={frozen.cols} onChange={(e) => setFrozen((f) => ({ ...f, cols: e.target.checked }))} />
            Figer colonne A
          </label>
          <span className="taol-sep" />
          <span className="taol-wb-name">
            {sheet.name}
            {view.sort ? ` — tri ${indexToCol(view.sort.col)} ${view.sort.dir === 1 ? '↑' : '↓'}` : ''}
            {Object.keys(view.filters).length ? ` — ${Object.keys(view.filters).length} filtre(s)` : ''}
          </span>
        </div>
        <div className="taol-formula-bar">
          <span className="taol-ref">{selKey}</span>
          <input
            ref={formulaRef}
            className="taol-formula"
            aria-label="Barre de formule"
            value={edit ?? rawOf(selCell)}
            onChange={(e) => setEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitEdit((e.target as HTMLInputElement).value)
              } else if (e.key === 'Escape') setEdit(null)
            }}
          />
        </div>
        <div className="taol-grid-wrap">
          <table className={`taol-table${frozen.rows ? ' freeze-r' : ''}${frozen.cols ? ' freeze-c' : ''}`}>
            <thead>
              <tr>
                <th className="taol-corner" />
                {cols.map((c) => (
                  <th key={c} className="taol-col-head">
                    <span>{indexToCol(c)}</span>
                    <button
                      type="button"
                      className="taol-col-menu-btn"
                      title="Trier / filtrer cette colonne"
                      onClick={(e) => {
                        e.stopPropagation()
                        setColMenu(colMenu === c ? null : c)
                        if (colMenu !== c) openColMenu(c)
                      }}
                    >
                      ▼
                    </button>
                    {colMenu === c && sheet && (
                      <div className="taol-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setView((v) => (v.sort = { col: c, dir: 1 }))
                            setColMenu(null)
                          }}
                        >
                          Trier croissant (A→Z)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setView((v) => (v.sort = { col: c, dir: -1 }))
                            setColMenu(null)
                          }}
                        >
                          Trier décroissant (Z→A)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setView((v) => (v.sort = null))
                            setColMenu(null)
                          }}
                        >
                          Effacer le tri
                        </button>
                        <div className="taol-menu-sep" />
                        <p className="taol-menu-label">Filtrer (valeurs visibles) :</p>
                        <div className="taol-menu-filters">
                          {(filterDraft ?? []).map((val) => (
                            <label key={val} className="taol-menu-check">
                              <input
                                type="checkbox"
                                checked={filterDraft!.includes(val)}
                                onChange={(e) => {
                                  setFilterDraft((d) => (d ?? []).filter((x) => x !== val).concat(e.target.checked ? [val] : []))
                                }}
                              />
                              <span>{val === '' ? '(vide)' : val}</span>
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const all = columnValues(sheet, c)
                            const selected = filterDraft ?? []
                            setView((v) => {
                              if (selected.length >= all.length) delete v.filters[c]
                              else v.filters[c] = selected
                            })
                            setColMenu(null)
                          }}
                        >
                          Appliquer le filtre
                        </button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => (
                <tr key={r}>
                  <th className="taol-row-head">{r + 1}</th>
                  {cols.map((c) => {
                    const key = keyOf(c, r)
                    const cell = sheet.cells[key]
                    const active = c === sel.col && r === sel.row
                    return (
                      <td
                        key={key}
                        data-key={key}
                        className={`taol-cell${active ? ' active' : ''}${inRange(c, r) ? ' in-range' : ''}${inFill(c, r) && !active ? ' in-fill' : ''}${cell?.f !== undefined ? ' is-formula' : ''}`}
                        onClick={(e) => selectCell(c, r, e.shiftKey)}
                        onDoubleClick={() => {
                          selectCell(c, r, false)
                          setEdit(rawOf(cell))
                          setTimeout(() => formulaRef.current?.focus(), 0)
                        }}
                      >
                        {cell ? fmtDisplay(cell.v ?? null) : ''}
                        {active && <span className="taol-fill-handle" title="Recopier vers le bas/droite" onMouseDown={onFillDown} />}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="taol-status">
          {range ? (
            <span>
              Plage {keyOf(range.c1, range.r1)}:{keyOf(range.c2, range.r2)} — Nb : {status.nb} · Somme : {fmtDisplay(status.somme)} · Moyenne :{' '}
              {status.moyenne === null ? '—' : fmtDisplay(status.moyenne)}
            </span>
          ) : (
            <span>
              Cellule {selKey} — Nb : {status.nb} · Somme : {fmtDisplay(status.somme)} · Moyenne : {status.moyenne === null ? '—' : fmtDisplay(status.moyenne)}
            </span>
          )}
          <span className="taol-status-right">Ctrl+F recherche · Ctrl+C/V copie-colle</span>
        </div>
        {search && (
          <div className="taol-search">
            <input
              ref={searchRef}
              className="taol-search-input"
              placeholder="Rechercher dans la feuille…"
              value={search.q}
              onChange={(e) => {
                const q = e.target.value
                setSearch({ q, matches: sheet ? searchCells(sheet, q) : [], idx: 0 })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.matches.length) {
                  e.preventDefault()
                  const m = search.matches[search.idx % search.matches.length]
                  setSel(m)
                  setAnchor(m)
                  setRange(null)
                  setSearch((s) => (s ? { ...s, idx: s.idx + 1 } : s))
                } else if (e.key === 'Escape') setSearch(null)
              }}
            />
            <span className="taol-search-count">
              {search.matches.length ? `${(search.idx % search.matches.length) + 1}/${search.matches.length}` : '0'}
            </span>
            <button type="button" className="db-btn" onClick={() => setSearch(null)}>
              ×
            </button>
          </div>
        )}
        {pasteOpen && (
          <div className="taol-modal-overlay" onClick={() => setPasteOpen(false)}>
            <div className="taol-modal" onClick={(e) => e.stopPropagation()}>
              <p className="taol-modal-title">Coller des données externes (TSV / CSV copié depuis Excel, Sheets…)</p>
              <textarea ref={pasteRef} className="taol-paste-area" placeholder="Ctrl+V ici…" rows={8} />
              <div className="taol-modal-actions">
                <button type="button" className="db-btn" onClick={() => setPasteOpen(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="db-btn"
                  onClick={() => {
                    const t = pasteRef.current?.value ?? ''
                    setPasteOpen(false)
                    if (t.trim()) pasteText(t)
                  }}
                >
                  Coller à {selKey}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
