import type { CellValue, Column, Database, Row } from './types'

export const STATUS_COLORS = [
  '#94a3b8', '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function statusColor(col: Column, value: string): string {
  const opts = col.options ?? []
  const i = opts.indexOf(value)
  return STATUS_COLORS[(i >= 0 ? i : hash(value)) % STATUS_COLORS.length]
}

export function evalFormula(formula: string, db: Database, row: Row): string {
  let expr = formula
  for (const c of db.columns) {
    const v = row.cells[c.id]
    const n =
      typeof v === 'number'
        ? v
        : parseFloat(String(v ?? '').replace(',', '.')) || 0
    expr = expr.split(`{${c.name}}`).join(String(n))
  }
  if (!/^[\d\s+\-*/().,]+$/.test(expr)) return '#ERR'
  try {
    const r = Function(`"use strict"; return (${expr})`)() as unknown
    return typeof r === 'number' && Number.isFinite(r)
      ? String(Math.round(r * 100) / 100)
      : String(r)
  } catch {
    return '#ERR'
  }
}

export interface DbRef {
  id: string
  db: Database
}

export function computedCell(
  db: Database,
  row: Row,
  col: Column,
  allDbs: DbRef[]
): CellValue {
  switch (col.type) {
    case 'formula':
      return col.formula ? evalFormula(col.formula, db, row) : ''
    case 'created':
      return row.createdAt
        ? new Date(row.createdAt).toLocaleString('fr-FR')
        : ''
    case 'edited':
      return row.updatedAt ?? row.createdAt
        ? new Date(row.updatedAt ?? row.createdAt!).toLocaleString('fr-FR')
        : ''
    case 'id':
      return row.cells[col.id] ?? `#${db.rows.indexOf(row) + 1}`
    case 'rollup': {
      const relCol = db.columns.find(
        (c) => c.type === 'relation' && c.relationDbId
      )
      const rollupColId = col.rollupColId
      if (!relCol?.relationDbId || !rollupColId) return ''
      const target = allDbs.find((d) => d.id === relCol.relationDbId)
      if (!target) return ''
      const rel = row.cells[relCol.id]
      const ids = Array.isArray(rel) ? rel.map(String) : rel ? [String(rel)] : []
      const vals = target.db.rows
        .filter((r) => ids.includes(r.id))
        .map((r) => r.cells[rollupColId])
        .filter((v) => v != null && v !== '')
      if (!vals.length) return ''
      const nums = vals.map((v) => Number(v)).filter((n) => !Number.isNaN(n))
      switch (col.rollupAgg ?? 'sum') {
        case 'count':
          return String(vals.length)
        case 'sum':
          return String(nums.reduce((a, b) => a + b, 0))
        case 'avg':
          return nums.length
            ? String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100)
            : ''
        case 'min':
          return String(Math.min(...nums))
        case 'max':
          return String(Math.max(...nums))
        default:
          return String(vals[0])
      }
    }
    default:
      return row.cells[col.id] ?? null
  }
}

export function cellDisplay(v: CellValue): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}
