import { useEffect, useRef, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { loadWorkbook, saveWorkbook, uid } from './store'
import {
  csvExport,
  fmtDisplay,
  indexToCol,
  keyOf,
  parseFormula,
  parseInput,
  parseKey,
  recalcWorkbook,
  serializeFormula,
  shiftRefs,
  usedRange,
  type Cell,
  type Sheet,
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

export default function TaolApp(): JSX.Element {
  const [wb, setWb] = useState<Workbook | null>(null)
  const [sel, setSel] = useState({ col: 0, row: 0 })
  const [edit, setEdit] = useState<string | null>(null)
  const [clip, setClip] = useState<{ cell: Cell; key: string } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const past = useRef<Workbook[]>([])
  const future = useRef<Workbook[]>([])
  const mainRef = useRef<HTMLDivElement>(null)
  const formulaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadWorkbook().then((w) => {
      setWb(w)
      const p = parseKey(w.activeCell)
      if (p) setSel(p)
    })
  }, [])

  useEffect(() => {
    if (wb) saveWorkbook(wb)
  }, [wb])

  const sheet: Sheet | undefined = wb?.sheets.find((s) => s.id === wb.activeSheetId) ?? wb?.sheets[0]
  const selKey = keyOf(sel.col, sel.row)
  const selCell = sheet?.cells[selKey]
  const used = sheet ? usedRange(sheet) : { maxC: 0, maxR: 0 }
  const nCols = Math.max(26, Math.min(COLS, used.maxC + 3))
  const nRows = Math.max(50, Math.min(ROWS, used.maxR + 6))

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
    if (pk) setSel(pk)
  }
  const redo = (): void => {
    const f = future.current.pop()
    if (!f || !wb) return
    past.current.push(structuredClone(wb))
    setWb(f)
    setEdit(null)
    const pk = parseKey(f.activeCell)
    if (pk) setSel(pk)
  }

  const addSheet = (): void => {
    if (!wb) return
    const n = wb.sheets.length + 1
    const sh: Sheet = { id: uid(), name: `Feuil ${n}`, cells: {} }
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

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const t = e.target as HTMLElement
    if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    if (!wb) return
    const k = e.key
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') {
      if (selCell) setClip({ cell: structuredClone(selCell), key: selKey })
      e.preventDefault()
      return
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'v') {
      if (!clip) return
      e.preventDefault()
      const src = parseKey(clip.key)
      if (!src) return
      const dc = sel.col - src.col
      const dr = sel.row - src.row
      const cell: Cell = clip.cell.f !== undefined
        ? { f: serializeFormula(shiftRefs(parseFormula(clip.cell.f), dc, dr)) }
        : { v: clip.cell.v }
      setCell(sel.col, sel.row, cell)
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
      setCell(sel.col, sel.row, undefined)
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
      return
    }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault()
      if (edit !== null) return
      setSel((s) => ({
        col: Math.max(0, Math.min(nCols - 1, s.col + (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0))),
        row: Math.max(0, Math.min(nRows - 1, s.row + (k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0)))
      }))
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
  const rows = Array.from({ length: nRows }, (_, r) => r)

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
            « = » devant une saisie = formule (SOMME, MOYENNE, MIN, MAX, NB, NBVAL, SI, ET, OU, NON ; plages A1:B9 ; $A$1 absolu).
            Flèches/Entrée/Tab pour naviguer, F2 pour éditer, Ctrl+C/V pour copier-coller, Ctrl+Z/Y annuler/rétablir.
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
          <span className="taol-wb-name">Classeur Skouar — feuille « {sheet.name} »</span>
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
          <table className="taol-table">
            <thead>
              <tr>
                <th className="taol-corner" />
                {cols.map((c) => (
                  <th key={c} className="taol-col-head">
                    {indexToCol(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <th className="taol-row-head">{r + 1}</th>
                  {cols.map((c) => {
                    const key = keyOf(c, r)
                    const cell = sheet.cells[key]
                    const active = c === sel.col && r === sel.row
                    return (
                      <td
                        key={key}
                        className={`taol-cell${active ? ' active' : ''}${cell?.f !== undefined ? ' is-formula' : ''}`}
                        onClick={() => {
                          setSel({ col: c, row: r })
                          setEdit(null)
                        }}
                        onDoubleClick={() => {
                          setSel({ col: c, row: r })
                          setEdit(rawOf(cell))
                          setTimeout(() => formulaRef.current?.focus(), 0)
                        }}
                      >
                        {cell ? fmtDisplay(cell.v ?? null) : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
