export type CellValue = number | string | boolean | null | { e: string }

export interface Cell {
  v?: CellValue
  f?: string
  s?: CellStyle
}

export interface Sheet {
  id: string
  name: string
  cells: Record<string, Cell>
  cf?: CfRule[]
  merged?: Record<string, Box>
  validations?: Record<number, string[]>
  widths?: Record<number, number>
  hiddenRows?: Record<number, boolean>
  hiddenCols?: Record<number, boolean>
  charts?: ChartObj[]
}

export interface Workbook {
  sheets: Sheet[]
  activeSheetId: string
  activeCell: string
}

export class CalcError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export const err = (code: string): CellValue => ({ e: code })
export const isErr = (v: CellValue): v is { e: string } => typeof v === 'object' && v !== null && 'e' in v

export function colToIndex(col: string): number {
  let n = 0
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function indexToCol(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function keyOf(col: number, row: number): string {
  return indexToCol(col) + (row + 1)
}

export function parseKey(key: string): { col: number; row: number } | null {
  const m = /^\$?([A-Za-z]+)\$?([0-9]+)$/.exec(key.trim())
  if (!m) return null
  const row = parseInt(m[2], 10)
  if (row < 1 || row > 1048576) return null
  return { col: colToIndex(m[1]), row: row - 1 }
}

export function formatRef(col: number, row: number, absCol = false, absRow = false): string {
  return `${absCol ? '$' : ''}${indexToCol(col)}${absRow ? '$' : ''}${row + 1}`
}

// ---------- Formules : tokenizer ----------

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'err'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'sep' }
  | { t: 'colon' }
  | { t: 'bang' }

const REF_RE = /^\$?[A-Za-z]{1,3}\$?[0-9]+$/

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n') {
      i++
      continue
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^[0-9]+(?:[.,][0-9]+)?|^\.[0-9]+/.exec(src.slice(i))
      if (!m) throw new CalcError('#VALEUR!')
      toks.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')) })
      i += m[0].length
      continue
    }
    if (c === '"') {
      let j = i + 1
      let s = ''
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"'
            j += 2
            continue
          }
          break
        }
        s += src[j]
        j++
      }
      if (j >= src.length) throw new CalcError('#VALEUR!')
      toks.push({ t: 'str', v: s })
      i = j + 1
      continue
    }
    if (c === "'") {
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== "'") {
        s += src[j]
        j++
      }
      if (j >= src.length) throw new CalcError('#VALEUR!')
      toks.push({ t: 'id', v: s })
      i = j + 1
      if (src[i] === '!') {
        toks.push({ t: 'bang' })
        i++
      }
      continue
    }
    if (c === '#') {
      const m = /^#[A-Za-z][A-Za-z0-9/]*[!?]/.exec(src.slice(i))
      if (!m) throw new CalcError('#VALEUR!')
      toks.push({ t: 'err', v: m[0].toUpperCase() })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$.]*/.exec(src.slice(i))
      if (!m) throw new CalcError('#VALEUR!')
      toks.push({ t: 'id', v: m[0] })
      i += m[0].length
      continue
    }
    if (c === '<' && (src[i + 1] === '=' || src[i + 1] === '>')) {
      toks.push({ t: 'op', v: src.slice(i, i + 2) })
      i += 2
      continue
    }
    if (c === '>' && src[i + 1] === '=') {
      toks.push({ t: 'op', v: '>=' })
      i += 2
      continue
    }
    if ('+-*/^&%=<>'.includes(c)) {
      toks.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '(') {
      toks.push({ t: 'lp' })
      i++
      continue
    }
    if (c === ')') {
      toks.push({ t: 'rp' })
      i++
      continue
    }
    if (c === ';' || c === ',') {
      toks.push({ t: 'sep' })
      i++
      continue
    }
    if (c === ':') {
      toks.push({ t: 'colon' })
      i++
      continue
    }
    if (c === '!') {
      toks.push({ t: 'bang' })
      i++
      continue
    }
    throw new CalcError('#VALEUR!')
  }
  return toks
}

// ---------- AST ----------

export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'err'; v: string }
  | { t: 'ref'; sheet: string | null; col: number; row: number; absCol: boolean; absRow: boolean }
  | { t: 'range'; sheet: string | null; c1: number; r1: number; c2: number; r2: number }
  | { t: 'call'; name: string; args: Node[] }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }

export function parseFormula(src: string): Node {
  const toks = tokenize(src)
  let pos = 0
  const peek = (): Tok | undefined => toks[pos]
  const next = (): Tok => {
    const t = toks[pos]
    if (!t) throw new CalcError('#VALEUR!')
    pos++
    return t
  }
  const nextOp = (): string => {
    const t = next()
    if (t.t !== 'op') throw new CalcError('#VALEUR!')
    return t.v
  }

  function parseExpr(): Node {
    return parseCompare()
  }
  function parseCompare(): Node {
    let a = parseConcat()
    const t = peek()
    if (t && t.t === 'op' && ['=', '<>', '<=', '>=', '<', '>'].includes(t.v)) {
      const op = nextOp()
      const b = parseConcat()
      a = { t: 'bin', op, a, b }
    }
    return a
  }
  function parseConcat(): Node {
    let a = parseAdd()
    while (peek()?.t === 'op' && (peek() as { v: string }).v === '&') {
      next()
      a = { t: 'bin', op: '&', a, b: parseAdd() }
    }
    return a
  }
  function parseAdd(): Node {
    let a = parseMul()
    while (peek()?.t === 'op' && ['+', '-'].includes((peek() as { v: string }).v)) {
      const op = nextOp()
      a = { t: 'bin', op, a, b: parseMul() }
    }
    return a
  }
  function parseMul(): Node {
    let a = parsePow()
    while (peek()?.t === 'op' && ['*', '/'].includes((peek() as { v: string }).v)) {
      const op = nextOp()
      a = { t: 'bin', op, a, b: parsePow() }
    }
    return a
  }
  function parsePow(): Node {
    const a = parseUnary()
    if (peek()?.t === 'op' && (peek() as { v: string }).v === '^') {
      next()
      return { t: 'bin', op: '^', a, b: parsePow() }
    }
    return a
  }
  function parseUnary(): Node {
    const t = peek()
    if (t && t.t === 'op' && (t.v === '-' || t.v === '+')) {
      next()
      const a = parseUnary()
      return t.v === '-' ? { t: 'un', op: '-', a } : a
    }
    return parsePostfix()
  }
  function parsePostfix(): Node {
    let a = parsePrimary()
    while (peek()?.t === 'op' && (peek() as { v: string }).v === '%') {
      next()
      a = { t: 'un', op: '%', a }
    }
    return a
  }
  function parsePrimary(): Node {
    const t = next()
    if (t.t === 'num') return { t: 'num', v: t.v }
    if (t.t === 'str') return { t: 'str', v: t.v }
    if (t.t === 'err') return { t: 'err', v: t.v }
    if (t.t === 'lp') {
      const e = parseExpr()
      const c = next()
      if (c.t !== 'rp') throw new CalcError('#VALEUR!')
      return e
    }
    if (t.t === 'id') {
      const up = t.v.toUpperCase()
      if (up === 'VRAI') return { t: 'bool', v: true }
      if (up === 'FAUX') return { t: 'bool', v: false }
      // feuille ! ref
      if (peek()?.t === 'bang') {
        next()
        const r = next()
        if (r.t !== 'id' || !REF_RE.test(r.v)) throw new CalcError('#REF!')
        const ref = parseRefToken(r.v, t.v)
        return maybeRange(ref)
      }
      if (REF_RE.test(t.v)) {
        const ref = parseRefToken(t.v, null)
        return maybeRange(ref)
      }
      // appel de fonction
      if (peek()?.t === 'lp') {
        next()
        const args: Node[] = []
        if (peek()?.t !== 'rp') {
          for (;;) {
            if (peek()?.t === 'sep') {
              args.push({ t: 'num', v: 0 })
              next()
            } else {
              args.push(parseExpr())
            }
            const c = next()
            if (c.t === 'rp') break
            if (c.t !== 'sep') throw new CalcError('#VALEUR!')
          }
        } else {
          next()
        }
        return { t: 'call', name: up, args }
      }
      throw new CalcError('#NOM?')
    }
    throw new CalcError('#VALEUR!')
  }
  function parseRefToken(v: string, sheet: string | null): Node {
    const m = /^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/.exec(v)
    if (!m) throw new CalcError('#REF!')
    return { t: 'ref', sheet, col: colToIndex(m[2]), row: parseInt(m[4], 10) - 1, absCol: m[1] === '$', absRow: m[3] === '$' }
  }
  function maybeRange(first: Node): Node {
    if (first.t !== 'ref') return first
    if (peek()?.t === 'colon') {
      next()
      const r = next()
      if (r.t !== 'id' || !REF_RE.test(r.v)) throw new CalcError('#REF!')
      const m = /^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/.exec(r.v)
      if (!m) throw new CalcError('#REF!')
      const c1 = Math.min(first.col, colToIndex(m[2]))
      const c2 = Math.max(first.col, colToIndex(m[2]))
      const r1 = Math.min(first.row, parseInt(m[4], 10) - 1)
      const r2 = Math.max(first.row, parseInt(m[4], 10) - 1)
      return { t: 'range', sheet: first.sheet, c1, r1, c2, r2 }
    }
    return first
  }

  const node = parseExpr()
  if (pos !== toks.length) throw new CalcError('#VALEUR!')
  return node
}

// ---------- Évaluation ----------

export interface EvalCtx {
  currentSheet: string
  getCell: (sheet: string | null, col: number, row: number) => CellValue
  stack: string[]
}

const FUNCS: Record<string, (args: Node[], ctx: EvalCtx) => CellValue> = {
  SOMME: (args, ctx) => {
    let s = 0
    for (const v of flatValues(args, ctx)) if (typeof v === 'number') s += v
    return s
  },
  MOYENNE: (args, ctx) => {
    const vs = flatValues(args, ctx).filter((v): v is number => typeof v === 'number')
    if (vs.length === 0) return err('#DIV/0!')
    return vs.reduce((a, b) => a + b, 0) / vs.length
  },
  MIN: (args, ctx) => {
    const vs = flatValues(args, ctx).filter((v): v is number => typeof v === 'number')
    return vs.length ? Math.min(...vs) : 0
  },
  MAX: (args, ctx) => {
    const vs = flatValues(args, ctx).filter((v): v is number => typeof v === 'number')
    return vs.length ? Math.max(...vs) : 0
  },
  NB: (args, ctx) => flatValues(args, ctx).filter((v) => typeof v === 'number').length,
  NBVAL: (args, ctx) => flatValues(args, ctx).filter((v) => v !== null).length,
  SI: (args, ctx) => {
    if (args.length < 2) throw new CalcError('#VALEUR!')
    const cond = truthy(evalNode(args[0], ctx))
    return cond ? evalNode(args[1], ctx) : args[2] ? evalNode(args[2], ctx) : false
  },
  ET: (args, ctx) => args.every((a) => truthy(evalNode(a, ctx))),
  OU: (args, ctx) => args.some((a) => truthy(evalNode(a, ctx))),
  NON: (args, ctx) => !truthy(evalNode(args[0], ctx))
}

export function truthy(v: CellValue): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== ''
  return false
}

function flatValues(args: Node[], ctx: EvalCtx): CellValue[] {
  const out: CellValue[] = []
  for (const a of args) {
    if (a.t === 'range') {
      for (let r = a.r1; r <= a.r2; r++) {
        for (let c = a.c1; c <= a.c2; c++) out.push(ctx.getCell(a.sheet, c, r))
      }
    } else {
      out.push(evalNode(a, ctx))
    }
  }
  return out
}

function toNumber(v: CellValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').replace(/\s/g, ''))
    if (v.trim() !== '' && Number.isFinite(n)) return n
  }
  throw new CalcError('#VALEUR!')
}

function rank(v: CellValue): number {
  if (v === null) return -1
  if (typeof v === 'number') return 0
  if (typeof v === 'boolean') return 1
  return 2
}

export function evalNode(n: Node, ctx: EvalCtx): CellValue {
  switch (n.t) {
    case 'num':
    case 'str':
    case 'bool':
      return n.v
    case 'err':
      return err(n.v)
    case 'ref': {
      const full = `${n.sheet ?? ctx.currentSheet}!${keyOf(n.col, n.row)}`
      if (ctx.stack.includes(full)) return err('#CIRC!')
      return ctx.getCell(n.sheet, n.col, n.row)
    }
    case 'range':
      return err('#VALEUR!')
    case 'call': {
      const fn = FUNCS[n.name]
      if (!fn) throw new CalcError('#NOM?')
      for (const a of n.args) if (a.t === 'err') return err(a.v)
      return fn(n.args, ctx)
    }
    case 'un': {
      const a = evalNode(n.a, ctx)
      if (isErr(a)) return a
      if (n.op === '%') return toNumber(a) / 100
      return -toNumber(a)
    }
    case 'bin': {
      const a = evalNode(n.a, ctx)
      const b = evalNode(n.b, ctx)
      if (isErr(a)) return a
      if (isErr(b)) return b
      if (n.op === '&') return strOf(a) + strOf(b)
      if (['=', '<>', '<=', '>=', '<', '>'].includes(n.op)) {
        const ra = rank(a)
        const rb = rank(b)
        if (ra !== rb) {
          const cmp = ra < rb ? -1 : 1
          return applyCmp(n.op, cmp)
        }
        if (typeof a === 'string' && typeof b === 'string') {
          const cmp = a.toLowerCase().localeCompare(b.toLowerCase())
          return applyCmp(n.op, cmp)
        }
        const na = toNumber(a)
        const nb = toNumber(b)
        return applyCmp(n.op, na < nb ? -1 : na > nb ? 1 : 0)
      }
      const na = toNumber(a)
      const nb = toNumber(b)
      switch (n.op) {
        case '+':
          return na + nb
        case '-':
          return na - nb
        case '*':
          return na * nb
        case '/':
          return nb === 0 ? err('#DIV/0!') : na / nb
        case '^':
          return Math.pow(na, nb)
        default:
          throw new CalcError('#VALEUR!')
      }
    }
  }
}

function applyCmp(op: string, cmp: number): boolean {
  switch (op) {
    case '=':
      return cmp === 0
    case '<>':
      return cmp !== 0
    case '<':
      return cmp < 0
    case '<=':
      return cmp <= 0
    case '>':
      return cmp > 0
    case '>=':
      return cmp >= 0
    default:
      throw new CalcError('#VALEUR!')
  }
}

function strOf(v: CellValue): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX'
  if (typeof v === 'object') return v.e
  return String(v)
}

// ---------- Recalcul du classeur ----------

export function recalcWorkbook(wb: Workbook): void {
  const byId = new Map(wb.sheets.map((s) => [s.id, s]))
  const byName = new Map(wb.sheets.map((s) => [s.name.toLowerCase(), s]))
  const memo = new Map<string, CellValue>()
  const stack: string[] = []

  const getCell = (sheet: string | null, col: number, row: number, currentSheet: string): CellValue => {
    const sh = sheet ? byName.get(sheet.toLowerCase()) ?? byId.get(sheet) : byId.get(currentSheet)
    if (!sh) return err('#REF!')
    const full = `${sh.id}!${keyOf(col, row)}`
    if (memo.has(full)) return memo.get(full)!
    if (stack.includes(full)) return err('#CIRC!')
    const cell = sh.cells[keyOf(col, row)]
    if (!cell) return null
    if (cell.f !== undefined) {
      stack.push(full)
      let v: CellValue
      try {
        v = evalNode(parseFormula(cell.f), { currentSheet: sh.id, getCell: (s, c, r) => getCell(s, c, r, sh.id), stack })
      } catch (e) {
        v = e instanceof CalcError ? err(e.code) : err('#VALEUR!')
      }
      stack.pop()
      memo.set(full, v)
      cell.v = v
      return v
    }
    return cell.v ?? null
  }

  for (const sh of wb.sheets) {
    for (const key of Object.keys(sh.cells)) {
      const cell = sh.cells[key]
      if (cell.f === undefined) continue
      memo.delete(`${sh.id}!${key}`)
      const p = parseKey(key)
      if (!p) continue
      getCell(null, p.col, p.row, sh.id)
    }
  }
}

// ---------- Saisie cellule ----------

const NUM_RE = /^[+-]?[0-9]+([.,][0-9]+)?$/

const PCT_RE = /^([+-]?[0-9]+(?:[.,][0-9]+)?)\s*%$/
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DATE_FR_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/

export function parseInput(text: string): Cell {
  const t = text.trim()
  if (t.startsWith('=')) return { f: t.slice(1).trim() }
  if (NUM_RE.test(t)) return { v: parseFloat(t.replace(',', '.')) }
  const pct = PCT_RE.exec(t)
  if (pct) return { v: parseFloat(pct[1].replace(',', '.')) / 100 }
  if (t.toUpperCase() === 'VRAI') return { v: true }
  if (t.toUpperCase() === 'FAUX') return { v: false }
  if (DATE_ISO_RE.test(t) || DATE_FR_RE.test(t)) return { v: t, s: { numFmt: 'date' } }
  return { v: text }
}

export function fmtDisplay(v: CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return v.e
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX'
  if (typeof v === 'number') return String(parseFloat(v.toPrecision(12)))
  return v
}

// ---------- Copier : ajustement des références ----------

export function shiftRefs(n: Node, dc: number, dr: number): Node {
  switch (n.t) {
    case 'ref':
      return { ...n, col: n.absCol ? n.col : n.col + dc, row: n.absRow ? n.row : n.row + dr }
    case 'range':
      return {
        ...n,
        c1: n.c1 + dc,
        c2: n.c2 + dc,
        r1: n.r1 + dr,
        r2: n.r2 + dr
      }
    case 'call':
      return { ...n, args: n.args.map((a) => shiftRefs(a, dc, dr)) }
    case 'un':
      return { ...n, a: shiftRefs(n.a, dc, dr) }
    case 'bin':
      return { ...n, a: shiftRefs(n.a, dc, dr), b: shiftRefs(n.b, dc, dr) }
    default:
      return n
  }
}

function serSheet(s: string): string {
  return /[^A-Za-z0-9_$]/.test(s) ? `'${s.replace(/'/g, "''")}'!` : `${s}!`
}

export function serializeFormula(n: Node): string {
  switch (n.t) {
    case 'num':
      return String(n.v)
    case 'str':
      return `"${n.v.replace(/"/g, '""')}"`
    case 'bool':
      return n.v ? 'VRAI' : 'FAUX'
    case 'err':
      return n.v
    case 'ref':
      return `${n.sheet ? serSheet(n.sheet) : ''}${formatRef(n.col, n.row, n.absCol, n.absRow)}`
    case 'range':
      return `${n.sheet ? serSheet(n.sheet) : ''}${formatRef(n.c1, n.r1)}:${formatRef(n.c2, n.r2)}`
    case 'call':
      return `${n.name}(${n.args.map(serializeFormula).join(';')})`
    case 'un':
      return n.op === '%' ? `${serializeFormula(n.a)}%` : `${n.op}${serializeFormula(n.a)}`
    case 'bin':
      return `${serializeFormula(n.a)}${n.op}${serializeFormula(n.b)}`
  }
}

// ---------- Export CSV (FR : « ; », décimale « , », BOM UTF-8) ----------

export function csvExport(sh: Sheet): string {
  let maxC = 0
  let maxR = 0
  for (const key of Object.keys(sh.cells)) {
    const p = parseKey(key)
    if (!p) continue
    maxC = Math.max(maxC, p.col)
    maxR = Math.max(maxR, p.row)
  }
  const lines: string[] = []
  for (let r = 0; r <= maxR; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxC; c++) {
      const cell = sh.cells[keyOf(c, r)]
      let s = cell ? fmtDisplay(cell.v ?? null) : ''
      if (typeof cell?.v === 'number') s = String(parseFloat(cell.v.toPrecision(12))).replace('.', ',')
      if (/[;"\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
      row.push(s)
    }
    lines.push(row.join(';'))
  }
  return '﻿' + lines.join('\n')
}

export function usedRange(sh: Sheet): { maxC: number; maxR: number } {
  let maxC = 0
  let maxR = 0
  for (const key of Object.keys(sh.cells)) {
    const p = parseKey(key)
    if (!p) continue
    maxC = Math.max(maxC, p.col)
    maxR = Math.max(maxR, p.row)
  }
  return { maxC, maxR }
}

// ---------- Vue : tri + filtres (affichage, les clés A1 ne bougent pas) ----------

export interface ViewState {
  sort: { col: number; dir: 1 | -1 } | null
  filters: Record<number, string[] | null>
}

export function emptyView(): ViewState {
  return { sort: null, filters: {} }
}

export function compareValues(a: CellValue, b: CellValue): number {
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0)
  return String(a ?? '').toLowerCase().localeCompare(String(b ?? '').toLowerCase())
}

export function viewRows(sh: Sheet, view: ViewState): number[] {
  const used = usedRange(sh)
  let rows = Array.from({ length: used.maxR + 1 }, (_, r) => r)
  if (sh.hiddenRows) rows = rows.filter((r) => !sh.hiddenRows![r])
  for (const [cStr, allowed] of Object.entries(view.filters)) {
    if (!allowed) continue
    const c = Number(cStr)
    rows = rows.filter((r) => {
      const cell = sh.cells[keyOf(c, r)]
      const v = cell ? fmtDisplay(cell.v ?? null) : ''
      return allowed.includes(v)
    })
  }
  if (view.sort) {
    const { col, dir } = view.sort
    rows = [...rows].sort((a, b) => {
      const va = sh.cells[keyOf(col, a)]?.v ?? null
      const vb = sh.cells[keyOf(col, b)]?.v ?? null
      return compareValues(va, vb) * dir
    })
  }
  return rows
}

export function columnValues(sh: Sheet, col: number): string[] {
  const used = usedRange(sh)
  const set = new Set<string>()
  for (let r = 0; r <= used.maxR; r++) {
    const cell = sh.cells[keyOf(col, r)]
    set.add(cell ? fmtDisplay(cell.v ?? null) : '')
  }
  return Array.from(set)
}

// ---------- TSV (copier-coller interne et externe) ----------

export function tsvSerializeCell(cell: Cell | undefined): string {
  if (!cell) return ''
  if (cell.f !== undefined) return '=' + cell.f
  const v = cell.v
  if (v === undefined || v === null) return ''
  return String(v).replace(/[\t\n\r]/g, ' ')
}

export function tsvSerializeRange(sh: Sheet, c1: number, r1: number, c2: number, r2: number): string {
  const lines: string[] = []
  for (let r = r1; r <= r2; r++) {
    const cols: string[] = []
    for (let c = c1; c <= c2; c++) cols.push(tsvSerializeCell(sh.cells[keyOf(c, r)]))
    lines.push(cols.join('\t'))
  }
  return lines.join('\n')
}

export function tsvParse(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split('\t'))
}

// ---------- Barre de statut ----------

export function statusOf(vals: CellValue[]): { nb: number; somme: number; moyenne: number | null } {
  const nums = vals.filter((v): v is number => typeof v === 'number')
  const somme = nums.reduce((a, b) => a + b, 0)
  return { nb: nums.length, somme, moyenne: nums.length ? somme / nums.length : null }
}

// ---------- Recherche dans le classeur ----------

export function searchCells(sh: Sheet, q: string): { col: number; row: number }[] {
  const needle = q.toLowerCase()
  if (!needle) return []
  const out: { col: number; row: number }[] = []
  for (const [key, cell] of Object.entries(sh.cells)) {
    const p = parseKey(key)
    if (!p) continue
    const hay = `${cell.f ?? ''} ${fmtDisplay(cell.v ?? null)}`.toLowerCase()
    if (hay.includes(needle)) out.push(p)
  }
  return out
}


// ---------- Mise en forme (PR B) ----------

export type NumFmt = 'general' | 'number' | 'integer' | 'percent' | 'euro' | 'date' | 'time' | 'text'

export interface BorderSpec {
  w: number
  style?: 'solid' | 'dashed' | 'dotted'
  color?: string
}

export type Borders = Partial<Record<'t' | 'b' | 'l' | 'r', BorderSpec>>

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontFamily?: string
  fontSize?: number
  color?: string
  bg?: string
  align?: 'left' | 'center' | 'right'
  numFmt?: NumFmt
  decimals?: number
  spark?: boolean
  comment?: string
  borders?: Borders
}

export interface Box {
  c1: number
  r1: number
  c2: number
  r2: number
}

export type CfOp = '>' | '<' | '=' | '<>' | 'between' | 'contains'

export interface CfRule {
  col?: number
  box?: Box
  op: CfOp
  value: number | string
  value2?: number
  bg: string
  kind?: 'bg' | 'databar'
}

export function fmtNumRaw(n: number): string {
  return String(parseFloat(n.toPrecision(12)))
}

export function fmtWithStyle(v: CellValue, s?: CellStyle): string {
  const fmt = s?.numFmt ?? 'general'
  if (fmt === 'text') return String(v ?? '')
  if (fmt !== 'general' && typeof v === 'number') {
    const dec = s?.decimals
    if (fmt === 'percent') return `${(v * 100).toLocaleString('fr-FR', { minimumFractionDigits: dec ?? 0, maximumFractionDigits: dec ?? 2 })} %`
    if (fmt === 'euro') return `${v.toLocaleString('fr-FR', { minimumFractionDigits: dec ?? 2, maximumFractionDigits: dec ?? 2 })} €`
    if (fmt === 'number') return v.toLocaleString('fr-FR', { minimumFractionDigits: dec ?? 2, maximumFractionDigits: dec ?? 2 })
    if (fmt === 'integer') return Math.round(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    if (fmt === 'date') {
      const { y, m, d } = serialToYmd(v)
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    }
    if (fmt === 'time') {
      const mins = Math.round(v * 1440)
      return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    }
  }
  if (fmt === 'date' && typeof v === 'string') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
    const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v)
    if (fr) return `${fr[1].padStart(2, '0')}/${fr[2].padStart(2, '0')}/${fr[3]}`
  }
  if (fmt === 'time' && typeof v === 'string') return v
  return fmtDisplay(v)
}

export type StylePatch = { [K in keyof CellStyle]?: CellStyle[K] | null }

export function applyStyle(sh: Sheet, box: Box, patch: StylePatch): void {
  for (let r = box.r1; r <= box.r2; r++) {
    for (let c = box.c1; c <= box.c2; c++) {
      const key = keyOf(c, r)
      const cell = sh.cells[key] ?? (sh.cells[key] = {})
      const next: CellStyle = { ...cell.s }
      for (const [k, val] of Object.entries(patch)) {
        if (val === undefined) continue
        if (k === 'borders' && val !== null && typeof val === 'object') {
          next.borders = { ...next.borders, ...(val as Borders) }
          continue
        }
        if (val === null || val === '') delete (next as Record<string, unknown>)[k]
        else (next as Record<string, unknown>)[k] = val
      }
      if (Object.keys(next).length === 0) delete cell.s
      else cell.s = next
    }
  }
}

export function mergeCells(sh: Sheet, box: Box): string {
  const anchor = keyOf(box.c1, box.r1)
  sh.merged = { ...(sh.merged ?? {}), [anchor]: box }
  for (let r = box.r1; r <= box.r2; r++) {
    for (let c = box.c1; c <= box.c2; c++) {
      const key = keyOf(c, r)
      if (key !== anchor) delete sh.cells[key]
    }
  }
  return anchor
}

export function coveredBy(sh: Sheet, c: number, r: number): string | null {
  for (const [k, box] of Object.entries(sh.merged ?? {})) {
    if (c >= box.c1 && c <= box.c2 && r >= box.r1 && r <= box.r2) return k
  }
  return null
}

export function unmergeAt(sh: Sheet, c: number, r: number): void {
  const hit = coveredBy(sh, c, r)
  if (hit && sh.merged) delete sh.merged[hit]
}

export function cfMatch(rule: CfRule, v: CellValue): boolean {
  const val = typeof rule.value === 'number' ? rule.value : String(rule.value)
  switch (rule.op) {
    case '>':
      return typeof v === 'number' && v > Number(rule.value)
    case '<':
      return typeof v === 'number' && v < Number(rule.value)
    case '=':
      return compareValues(v, val) === 0
    case '<>':
      return compareValues(v, val) !== 0
    case 'between':
      return typeof v === 'number' && v >= Number(rule.value) && v <= Number(rule.value2 ?? rule.value)
    case 'contains':
      return typeof v === 'string' && v.toLowerCase().includes(String(rule.value).toLowerCase())
    default:
      return false
  }
}

export function cfBoxOf(sh: Sheet, rule: CfRule): Box | null {
  if (rule.box) return rule.box
  if (rule.col !== undefined) return { c1: rule.col, r1: 0, c2: rule.col, r2: usedRange(sh).maxR }
  return null
}

export function boxMax(sh: Sheet, box: Box): number {
  let max = 0
  for (let r = box.r1; r <= box.r2; r++) {
    for (let c = box.c1; c <= box.c2; c++) {
      const cell = sh.cells[keyOf(c, r)]
      if (cell && typeof cell.v === 'number') max = Math.max(max, Math.abs(cell.v))
    }
  }
  return max
}

export function applyBorders(sh: Sheet, box: Box, mode: 'all' | 'outer' | 'none', b: BorderSpec): void {
  for (let r = box.r1; r <= box.r2; r++) {
    for (let c = box.c1; c <= box.c2; c++) {
      const key = keyOf(c, r)
      const cell = sh.cells[key] ?? (sh.cells[key] = {})
      if (mode === 'none') {
        if (cell.s) {
          delete cell.s.borders
          if (Object.keys(cell.s).length === 0) delete cell.s
        }
        continue
      }
      const sides: (keyof Borders)[] =
        mode === 'all'
          ? ['t', 'b', 'l', 'r']
          : [
              ...(r === box.r1 ? (['t'] as const) : []),
              ...(r === box.r2 ? (['b'] as const) : []),
              ...(c === box.c1 ? (['l'] as const) : []),
              ...(c === box.c2 ? (['r'] as const) : [])
            ]
      const cur: Borders = { ...cell.s?.borders }
      for (const side of sides) cur[side] = { ...b }
      cell.s = { ...cell.s, borders: cur }
    }
  }
}

export function colSparkMax(sh: Sheet, col: number): number {
  let max = 0
  for (const [k, cell] of Object.entries(sh.cells)) {
    const p = parseKey(k)
    if (p && p.col === col && typeof cell.v === 'number') max = Math.max(max, Math.abs(cell.v))
  }
  return max
}

export function setColWidth(sh: Sheet, col: number, w: number | null): void {
  sh.widths = { ...(sh.widths ?? {}) }
  if (w === null || w <= 0) delete sh.widths[col]
  else sh.widths[col] = Math.max(30, Math.min(400, Math.round(w)))
}

// ---------- Structure : insérer / supprimer lignes & colonnes (PR C) ----------

type Axis = 'row' | 'col'

function shiftRefCoord(c: number, at: number, delta: number): number | null {
  if (delta > 0) return c >= at ? c + delta : c
  const n = -delta
  if (c >= at && c < at + n) return null
  return c >= at + n ? c - n : c
}

function shiftEdgeCoord(c: number, at: number, delta: number): number {
  if (delta > 0) return c >= at ? c + delta : c
  const n = -delta
  if (c >= at + n) return c - n
  if (c >= at) return at
  return c
}

export function moveRefs(n: Node, axis: Axis, at: number, delta: number, matchSheet: (s: string | null) => boolean): Node {
  const isDel = delta < 0
  switch (n.t) {
    case 'ref': {
      if (!matchSheet(n.sheet)) return n
      const c = shiftRefCoord(axis === 'row' ? n.row : n.col, at, delta)
      if (c === null) return { t: 'err', v: '#REF!' }
      return axis === 'row' ? { ...n, row: c } : { ...n, col: c }
    }
    case 'range': {
      if (!matchSheet(n.sheet)) return n
      if (isDel) {
        const nd = -delta
        const a1 = axis === 'row' ? n.r1 : n.c1
        const a2 = axis === 'row' ? n.r2 : n.c2
        if (a1 >= at && a2 < at + nd) return { t: 'err', v: '#REF!' }
      }
      const s1 = shiftEdgeCoord(axis === 'row' ? n.r1 : n.c1, at, delta)
      const s2 = shiftEdgeCoord(axis === 'row' ? n.r2 : n.c2, at, delta)
      return axis === 'row' ? { ...n, r1: s1, r2: s2 } : { ...n, c1: s1, c2: s2 }
    }
    case 'call':
      return { ...n, args: n.args.map((a) => moveRefs(a, axis, at, delta, matchSheet)) }
    case 'un':
      return { ...n, a: moveRefs(n.a, axis, at, delta, matchSheet) }
    case 'bin':
      return { ...n, a: moveRefs(n.a, axis, at, delta, matchSheet), b: moveRefs(n.b, axis, at, delta, matchSheet) }
    default:
      return n
  }
}

function shiftAllRefs(wb: Workbook, target: Sheet, axis: Axis, at: number, delta: number): void {
  for (const s of wb.sheets) {
    const isTarget = s.id === target.id
    const match = (refSheet: string | null): boolean =>
      refSheet === null ? isTarget : refSheet.toLowerCase() === target.name.toLowerCase() || refSheet === target.id
    for (const cell of Object.values(s.cells)) {
      if (cell.f === undefined) continue
      try {
        cell.f = serializeFormula(moveRefs(parseFormula(cell.f), axis, at, delta, match))
      } catch {}
    }
  }
}

function remapCells(sh: Sheet, axis: Axis, at: number, delta: number): void {
  const isDel = delta < 0
  const n = Math.abs(delta)
  const next: Record<string, Cell> = {}
  for (const [key, cell] of Object.entries(sh.cells)) {
    const p = parseKey(key)
    if (!p) continue
    const c = axis === 'row' ? p.row : p.col
    if (isDel && c >= at && c < at + n) continue
    const c2 = isDel ? (c >= at + n ? c - n : c) : c >= at ? c + delta : c
    next[keyOf(axis === 'row' ? p.col : c2, axis === 'row' ? c2 : p.row)] = cell
  }
  sh.cells = next
}

function shiftKeyed<T>(rec: Record<number, T> | undefined, at: number, delta: number): Record<number, T> | undefined {
  if (!rec) return undefined
  const isDel = delta < 0
  const n = Math.abs(delta)
  const out: Record<number, T> = {}
  for (const [k, v] of Object.entries(rec)) {
    const c = Number(k)
    if (isDel && c >= at && c < at + n) continue
    const c2 = isDel ? (c >= at + n ? c - n : c) : c >= at ? c + delta : c
    out[c2] = v
  }
  return out
}

function shiftMerged(sh: Sheet, axis: Axis, at: number, delta: number): void {
  if (!sh.merged) return
  const isDel = delta < 0
  const n = Math.abs(delta)
  const out: Record<string, Box> = {}
  for (const box of Object.values(sh.merged)) {
    const a1 = axis === 'row' ? box.r1 : box.c1
    const a2 = axis === 'row' ? box.r2 : box.c2
    if (isDel && a1 >= at && a2 < at + n) continue
    const s1 = shiftEdgeCoord(a1, at, delta)
    const s2 = shiftEdgeCoord(a2, at, delta)
    const nb = axis === 'row' ? { ...box, r1: s1, r2: s2 } : { ...box, c1: s1, c2: s2 }
    out[keyOf(nb.c1, nb.r1)] = nb
  }
  sh.merged = out
}

function shiftSheetMeta(sh: Sheet, axis: Axis, at: number, delta: number): void {
  shiftMerged(sh, axis, at, delta)
  if (axis === 'col') {
    sh.widths = shiftKeyed(sh.widths, at, delta)
    sh.validations = shiftKeyed(sh.validations, at, delta)
    sh.hiddenCols = shiftKeyed(sh.hiddenCols, at, delta)
  } else {
    sh.hiddenRows = shiftKeyed(sh.hiddenRows, at, delta)
  }
  if (sh.charts) {
    const isDel = delta < 0
    const nd = Math.abs(delta)
    const out: ChartObj[] = []
    for (const ch of sh.charts) {
      const a1 = axis === 'row' ? ch.box.r1 : ch.box.c1
      const a2 = axis === 'row' ? ch.box.r2 : ch.box.c2
      if (isDel && a1 >= at && a2 < at + nd) continue
      const box = axis === 'row' ? { ...ch.box, r1: shiftEdgeCoord(ch.box.r1, at, delta), r2: shiftEdgeCoord(ch.box.r2, at, delta) } : { ...ch.box, c1: shiftEdgeCoord(ch.box.c1, at, delta), c2: shiftEdgeCoord(ch.box.c2, at, delta) }
      const ac = shiftRefCoord(axis === 'row' ? ch.anchor.row : ch.anchor.col, at, delta)
      if (ac === null) continue
      out.push({ ...ch, box, anchor: axis === 'row' ? { ...ch.anchor, row: ac } : { ...ch.anchor, col: ac } })
    }
    sh.charts = out
  }
  if (sh.cf) {
    const isDel = delta < 0
    const nd = Math.abs(delta)
    const out: CfRule[] = []
    for (const r of sh.cf) {
      if (r.box) {
        const a1 = axis === 'row' ? r.box.r1 : r.box.c1
        const a2 = axis === 'row' ? r.box.r2 : r.box.c2
        if (isDel && a1 >= at && a2 < at + nd) continue
        const s1 = shiftEdgeCoord(a1, at, delta)
        const s2 = shiftEdgeCoord(a2, at, delta)
        out.push({ ...r, box: axis === 'row' ? { ...r.box, r1: s1, r2: s2 } : { ...r.box, c1: s1, c2: s2 } })
      } else if (r.col !== undefined) {
        if (axis !== 'col') {
          out.push(r)
          continue
        }
        const c = shiftRefCoord(r.col, at, delta)
        if (c !== null) out.push({ ...r, col: c })
      } else {
        out.push(r)
      }
    }
    sh.cf = out
  }
}

function structuralOp(wb: Workbook, sheetId: string, axis: Axis, at: number, delta: number): void {
  const sh = wb.sheets.find((s) => s.id === sheetId)
  if (!sh || delta === 0) return
  shiftAllRefs(wb, sh, axis, at, delta)
  remapCells(sh, axis, at, delta)
  shiftSheetMeta(sh, axis, at, delta)
}

export function insertRowsWb(wb: Workbook, sheetId: string, at: number, count: number): void {
  structuralOp(wb, sheetId, 'row', at, count)
}

export function deleteRowsWb(wb: Workbook, sheetId: string, r1: number, r2: number): void {
  structuralOp(wb, sheetId, 'row', r1, -(r2 - r1 + 1))
}

export function insertColsWb(wb: Workbook, sheetId: string, at: number, count: number): void {
  structuralOp(wb, sheetId, 'col', at, count)
}

export function deleteColsWb(wb: Workbook, sheetId: string, c1: number, c2: number): void {
  structuralOp(wb, sheetId, 'col', c1, -(c2 - c1 + 1))
}

// ---------- Fonctions essentielles (PR D) ----------

function cellsOf(a: Node, ctx: EvalCtx): CellValue[][] | null {
  if (a.t === 'range') {
    const m: CellValue[][] = []
    for (let r = a.r1; r <= a.r2; r++) {
      const row: CellValue[] = []
      for (let c = a.c1; c <= a.c2; c++) row.push(ctx.getCell(a.sheet, c, r))
      m.push(row)
    }
    return m
  }
  if (a.t === 'ref') return [[ctx.getCell(a.sheet, a.col, a.row)]]
  return null
}

function critScalar(s: string): CellValue {
  const t = s.trim()
  if (NUM_RE.test(t)) return parseFloat(t.replace(',', '.'))
  return t
}

export function matchCriteria(v: CellValue, crit: CellValue): boolean {
  if (typeof crit === 'number' || typeof crit === 'boolean') return compareValues(v, crit) === 0
  if (typeof crit === 'string') {
    const t = crit.trim()
    const m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(t)
    if (m) {
      const c = compareValues(v, critScalar(m[2]))
      switch (m[1]) {
        case '=': return c === 0
        case '<>': return c !== 0
        case '<': return c < 0
        case '<=': return c <= 0
        case '>': return c > 0
        case '>=': return c >= 0
      }
    }
    if (t.includes('*') || t.includes('?')) {
      const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp('^' + t.split('*').map((p) => p.split('?').map(esc).join('.')).join('.*') + '$', 'i')
      return typeof v === 'string' && re.test(v)
    }
    if (t === '') return v === null || v === ''
    return typeof v === 'string' && v.toLowerCase() === t.toLowerCase()
  }
  return false
}

function siSimple(args: Node[], ctx: EvalCtx, mode: 'somme' | 'nb' | 'moyenne'): CellValue {
  if (args.length < 2) throw new CalcError('#VALEUR!')
  const m = cellsOf(args[0], ctx)
  if (!m) throw new CalcError('#VALEUR!')
  const crit = evalNode(args[1], ctx)
  const sm = args[2] !== undefined ? cellsOf(args[2], ctx) : m
  if (!sm) throw new CalcError('#VALEUR!')
  let s = 0
  let n = 0
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m[i].length; j++) {
      if (!matchCriteria(m[i][j], crit)) continue
      const sv = sm[Math.min(i, sm.length - 1)]?.[Math.min(j, sm[0].length - 1)]
      if (mode === 'nb') n++
      else if (typeof sv === 'number') {
        s += sv
        n++
      }
    }
  }
  if (mode === 'nb') return n
  if (mode === 'moyenne') return n === 0 ? err('#DIV/0!') : s / n
  return s
}

function siEt(args: Node[], ctx: EvalCtx, start: number): { ranges: CellValue[][][]; crits: CellValue[] } {
  const ranges: CellValue[][][] = []
  const crits: CellValue[] = []
  for (let i = start; i + 1 < args.length; i += 2) {
    const m = cellsOf(args[i], ctx)
    if (!m) throw new CalcError('#VALEUR!')
    ranges.push(m)
    crits.push(evalNode(args[i + 1], ctx))
  }
  if (ranges.length === 0) throw new CalcError('#VALEUR!')
  return { ranges, crits }
}

function siEtMatch(ranges: CellValue[][][], crits: CellValue[], i: number, j: number): boolean {
  for (let k = 0; k < ranges.length; k++) {
    const cell = ranges[k][Math.min(i, ranges[k].length - 1)]?.[Math.min(j, ranges[k][0].length - 1)]
    if (!matchCriteria(cell, crits[k])) return false
  }
  return true
}

const EPOCH = Date.UTC(1899, 11, 30)

export function dateToSerial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000)
}

export function serialToYmd(n: number): { y: number; m: number; d: number } {
  const dt = new Date(EPOCH + Math.round(n) * 86400000)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

function asSerial(v: CellValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim())
    if (iso) return dateToSerial(+iso[1], +iso[2], +iso[3])
    const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim())
    if (fr) return dateToSerial(+fr[3], +fr[2], +fr[1])
  }
  throw new CalcError('#VALEUR!')
}

function decOf(fmt: string): number {
  const m = /[,.]((?:[#0?]+))/.exec(fmt)
  return m ? m[1].length : 0
}

export function formatTexte(v: CellValue, fmtRaw: string): string {
  const fmt = fmtRaw.toUpperCase()
  if (/JJ|AAAA/.test(fmt)) {
    try {
      const { y, m, d } = serialToYmd(asSerial(v))
      return fmt
        .replace(/JJ/g, String(d).padStart(2, '0'))
        .replace(/MM/g, String(m).padStart(2, '0'))
        .replace(/AAAA/g, String(y).padStart(4, '0'))
    } catch {
      return strOf(v)
    }
  }
  if (/HH/.test(fmt) && typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v.trim())) return v.trim()
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return strOf(v)
  const dec = decOf(fmt)
  if (fmt.includes('%')) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec, style: 'percent' })
  }
  const thousands = /[0#][\s  ][0#]/.test(fmt)
  return n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: thousands })
}

Object.assign(FUNCS, {
  RECHERCHEV: (args, ctx) => {
    if (args.length < 3) throw new CalcError('#VALEUR!')
    const lookup = evalNode(args[0], ctx)
    const table = cellsOf(args[1], ctx)
    if (!table || table.length === 0 || table[0].length === 0) return err('#N/A!')
    const colIdx = Math.round(toNumber(evalNode(args[2], ctx)))
    if (colIdx < 1 || colIdx > table[0].length) return err('#REF!')
    const approx = args[3] === undefined ? true : truthy(evalNode(args[3], ctx))
    if (!approx) {
      for (let i = 0; i < table.length; i++) if (compareValues(table[i][0], lookup) === 0) return table[i][colIdx - 1] ?? null
      return err('#N/A!')
    }
    let best = -1
    for (let i = 0; i < table.length; i++) {
      if (compareValues(table[i][0], lookup) <= 0) best = i
      else break
    }
    if (best < 0) return err('#N/A!')
    return table[best][colIdx - 1] ?? null
  },
  'SOMME.SI': (args, ctx) => siSimple(args, ctx, 'somme'),
  'NB.SI': (args, ctx) => siSimple(args, ctx, 'nb'),
  'MOYENNE.SI': (args, ctx) => siSimple(args, ctx, 'moyenne'),
  'SOMME.SI.ET': (args, ctx) => {
    const { ranges, crits } = siEt(args, ctx, 1)
    const sm = cellsOf(args[0], ctx)
    if (!sm) throw new CalcError('#VALEUR!')
    let s = 0
    for (let i = 0; i < ranges[0].length; i++)
      for (let j = 0; j < ranges[0][i].length; j++)
        if (siEtMatch(ranges, crits, i, j)) {
          const sv = sm[Math.min(i, sm.length - 1)]?.[Math.min(j, sm[0].length - 1)]
          if (typeof sv === 'number') s += sv
        }
    return s
  },
  'NB.SI.ET': (args, ctx) => {
    const { ranges, crits } = siEt(args, ctx, 0)
    let n = 0
    for (let i = 0; i < ranges[0].length; i++)
      for (let j = 0; j < ranges[0][i].length; j++) if (siEtMatch(ranges, crits, i, j)) n++
    return n
  },
  'MOYENNE.SI.ET': (args, ctx) => {
    const { ranges, crits } = siEt(args, ctx, 1)
    const sm = cellsOf(args[0], ctx)
    if (!sm) throw new CalcError('#VALEUR!')
    let s = 0
    let n = 0
    for (let i = 0; i < ranges[0].length; i++)
      for (let j = 0; j < ranges[0][i].length; j++)
        if (siEtMatch(ranges, crits, i, j)) {
          const sv = sm[Math.min(i, sm.length - 1)]?.[Math.min(j, sm[0].length - 1)]
          if (typeof sv === 'number') {
            s += sv
            n++
          }
        }
    return n === 0 ? err('#DIV/0!') : s / n
  },
  'SI.CONDITIONS': (args, ctx) => {
    for (let i = 0; i + 1 < args.length; i += 2) {
      if (truthy(evalNode(args[i], ctx))) return evalNode(args[i + 1], ctx)
    }
    if (args.length % 2 === 1) return evalNode(args[args.length - 1], ctx)
    return err('#N/A!')
  },
  TEXTE: (args, ctx) => {
    if (args.length < 2) throw new CalcError('#VALEUR!')
    return formatTexte(evalNode(args[0], ctx), strOf(evalNode(args[1], ctx)))
  },
  AUJOURDHUI: () => {
    const t = new Date()
    return dateToSerial(t.getFullYear(), t.getMonth() + 1, t.getDate())
  },
  DATE: (args, ctx) => {
    if (args.length < 3) throw new CalcError('#VALEUR!')
    return dateToSerial(Math.round(toNumber(evalNode(args[0], ctx))), Math.round(toNumber(evalNode(args[1], ctx))), Math.round(toNumber(evalNode(args[2], ctx))))
  },
  JOUR: (args, ctx) => serialToYmd(asSerial(evalNode(args[0], ctx))).d,
  MOIS: (args, ctx) => serialToYmd(asSerial(evalNode(args[0], ctx))).m,
  ANNEE: (args, ctx) => serialToYmd(asSerial(evalNode(args[0], ctx))).y,
  ARRONDI: (args, ctx) => {
    const n = toNumber(evalNode(args[0], ctx))
    const d = args[1] !== undefined ? Math.round(toNumber(evalNode(args[1], ctx))) : 0
    const f = Math.pow(10, d)
    return (Math.sign(n) * Math.round(Math.abs(n) * f)) / f
  },
  'ARRONDI.SUP': (args, ctx) => {
    const n = toNumber(evalNode(args[0], ctx))
    const d = args[1] !== undefined ? Math.round(toNumber(evalNode(args[1], ctx))) : 0
    const f = Math.pow(10, d)
    return (Math.sign(n) * Math.ceil(Math.abs(n) * f - 1e-9)) / f
  },
  'ARRONDI.INF': (args, ctx) => {
    const n = toNumber(evalNode(args[0], ctx))
    const d = args[1] !== undefined ? Math.round(toNumber(evalNode(args[1], ctx))) : 0
    const f = Math.pow(10, d)
    return (Math.sign(n) * Math.floor(Math.abs(n) * f + 1e-9)) / f
  },
  ENT: (args, ctx) => Math.floor(toNumber(evalNode(args[0], ctx))),
  MOD: (args, ctx) => {
    const n = toNumber(evalNode(args[0], ctx))
    const d = toNumber(evalNode(args[1], ctx))
    if (d === 0) return err('#DIV/0!')
    return n - d * Math.floor(n / d)
  },
  ABS: (args, ctx) => Math.abs(toNumber(evalNode(args[0], ctx))),
  PUISSANCE: (args, ctx) => Math.pow(toNumber(evalNode(args[0], ctx)), toNumber(evalNode(args[1], ctx))),
  ESTNUM: (args, ctx) => typeof evalNode(args[0], ctx) === 'number',
  ESTVIDE: (args, ctx) => evalNode(args[0], ctx) === null,
  ESTTEXTE: (args, ctx) => typeof evalNode(args[0], ctx) === 'string',
  ESTERREUR: (args, ctx) => isErr(evalNode(args[0], ctx)),
  JOINDRE: (args, ctx) => {
    if (args.length < 1) throw new CalcError('#VALEUR!')
    const d = strOf(evalNode(args[0], ctx))
    return flatValues(args.slice(1), ctx)
      .filter((v) => v !== null && v !== '')
      .map(strOf)
      .join(d)
  },
  CONCAT: (args, ctx) => flatValues(args, ctx).map(strOf).join(''),
  NBCAR: (args, ctx) => strOf(evalNode(args[0], ctx)).length,
  GAUCHE: (args, ctx) => {
    const s = strOf(evalNode(args[0], ctx))
    const n = args[1] !== undefined ? Math.max(0, Math.round(toNumber(evalNode(args[1], ctx)))) : 1
    return s.slice(0, n)
  },
  DROITE: (args, ctx) => {
    const s = strOf(evalNode(args[0], ctx))
    const n = args[1] !== undefined ? Math.max(0, Math.round(toNumber(evalNode(args[1], ctx)))) : 1
    return n >= s.length ? s : s.slice(s.length - n)
  },
  STXT: (args, ctx) => {
    if (args.length < 3) throw new CalcError('#VALEUR!')
    const s = strOf(evalNode(args[0], ctx))
    const start = Math.max(1, Math.round(toNumber(evalNode(args[1], ctx))))
    const n = Math.round(toNumber(evalNode(args[2], ctx)))
    return s.slice(start - 1, start - 1 + n)
  }
} as Record<string, (args: Node[], ctx: EvalCtx) => CellValue>)

// ---------- Confort de saisie (PR E) : remplacer, lignes/colonnes masquées ----------

export function replaceCells(sh: Sheet, q: string, rep: string, box?: Box): number {
  if (!q) return 0
  let n = 0
  for (const [key, cell] of Object.entries(sh.cells)) {
    if (box) {
      const p = parseKey(key)
      if (!p || p.col < box.c1 || p.col > box.c2 || p.row < box.r1 || p.row > box.r2) continue
    }
    if (cell.f !== undefined) {
      const nf = cell.f.split(q).join(rep)
      if (nf !== cell.f) {
        cell.f = nf
        n++
      }
    } else if (typeof cell.v === 'string' && cell.v.includes(q)) {
      cell.v = cell.v.split(q).join(rep)
      n++
    }
  }
  return n
}

export function toggleHidden(sh: Sheet, axis: 'row' | 'col', idx: number): void {
  const rec = axis === 'row' ? (sh.hiddenRows ??= {}) : (sh.hiddenCols ??= {})
  if (rec[idx]) delete rec[idx]
  else rec[idx] = true
}

export function unhideAll(sh: Sheet, axis: 'row' | 'col'): void {
  if (axis === 'row') sh.hiddenRows = undefined
  else sh.hiddenCols = undefined
}

// ---------- Graphiques (phase 3) ----------

export type ChartType = 'line' | 'bar' | 'pie'

export interface ChartObj {
  id: string
  type: ChartType
  box: Box
  anchor: { col: number; row: number }
  w: number
  h: number
  title: string
  header: boolean
  firstColLabels: boolean
  seriesInRows: boolean
}

export interface ChartData {
  labels: string[]
  series: { name: string; values: number[] }[]
}

export function chartData(sh: Sheet, box: Box, opts: { header?: boolean; firstColLabels?: boolean; seriesInRows?: boolean } = {}): ChartData {
  const header = opts.header ?? true
  const firstColLabels = opts.firstColLabels ?? true
  const seriesInRows = opts.seriesInRows ?? false
  const cell = (c: number, r: number): CellValue => sh.cells[keyOf(c, r)]?.v ?? null
  if (!seriesInRows) {
    const dataC1 = firstColLabels ? box.c1 + 1 : box.c1
    const dataR1 = header ? box.r1 + 1 : box.r1
    const labels: string[] = []
    for (let r = dataR1; r <= box.r2; r++) labels.push(firstColLabels && dataR1 <= box.r2 ? strOf(cell(box.c1, r)) : String(r - dataR1 + 1))
    const series: ChartData['series'] = []
    for (let c = dataC1; c <= box.c2; c++) {
      const name = header ? strOf(cell(c, box.r1)) : indexToCol(c)
      const values: number[] = []
      for (let r = dataR1; r <= box.r2; r++) {
        const v = cell(c, r)
        values.push(typeof v === 'number' ? v : 0)
      }
      series.push({ name: name === '' ? indexToCol(c) : name, values })
    }
    return { labels, series }
  }
  const dataC1 = firstColLabels ? box.c1 + 1 : box.c1
  const dataR1 = header ? box.r1 + 1 : box.r1
  const labels: string[] = []
  for (let c = dataC1; c <= box.c2; c++) labels.push(header ? strOf(cell(c, box.r1)) : indexToCol(c))
  const series: ChartData['series'] = []
  for (let r = dataR1; r <= box.r2; r++) {
    const name = firstColLabels ? strOf(cell(box.c1, r)) : `Série ${r - dataR1 + 1}`
    const values: number[] = []
    for (let c = dataC1; c <= box.c2; c++) {
      const v = cell(c, r)
      values.push(typeof v === 'number' ? v : 0)
    }
    series.push({ name: name === '' ? `Série ${r - dataR1 + 1}` : name, values })
  }
  return { labels, series }
}

export function niceScale(max: number, ticks = 5): { max: number; step: number } {
  if (!Number.isFinite(max) || max <= 0) return { max: 1, step: 0.2 }
  const raw = max / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  return { max: parseFloat((Math.ceil(max / step) * step).toPrecision(12)), step: parseFloat(step.toPrecision(12)) }
}

export function niceFloor(min: number, ticks = 5): { min: number; step: number } {
  if (!Number.isFinite(min) || min >= 0) return { min: 0, step: niceScale(1, ticks).step }
  const raw = min / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(-raw)))
  const norm = -raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  return { min: parseFloat((Math.floor(min / step) * step).toPrecision(12)), step: parseFloat(step.toPrecision(12)) }
}
