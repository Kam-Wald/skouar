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

export function parseInput(text: string): Cell {
  const t = text.trim()
  if (t.startsWith('=')) return { f: t.slice(1).trim() }
  if (NUM_RE.test(t)) return { v: parseFloat(t.replace(',', '.')) }
  if (t.toUpperCase() === 'VRAI') return { v: true }
  if (t.toUpperCase() === 'FAUX') return { v: false }
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

export type NumFmt = 'general' | 'number' | 'percent' | 'euro' | 'date' | 'text'

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
  spark?: boolean
  comment?: string
}

export interface Box {
  c1: number
  r1: number
  c2: number
  r2: number
}

export interface CfRule {
  col: number
  op: '>' | '<'
  value: number
  bg: string
}

export function fmtNumRaw(n: number): string {
  return String(parseFloat(n.toPrecision(12)))
}

export function fmtWithStyle(v: CellValue, s?: CellStyle): string {
  if (s?.numFmt && s.numFmt !== 'general' && typeof v === 'number') {
    if (s.numFmt === 'percent') return `${fmtNumRaw(v * 100)} %`
    if (s.numFmt === 'euro') return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
    if (s.numFmt === 'number') return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (s.numFmt === 'text') return String(v)
  }
  if (s?.numFmt === 'date' && typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
  }
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
  if (typeof v !== 'number') return false
  return rule.op === '>' ? v > rule.value : v < rule.value
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
    if (sh.cf) {
      const out: CfRule[] = []
      for (const r of sh.cf) {
        const c = shiftRefCoord(r.col, at, delta)
        if (c !== null) out.push({ ...r, col: c })
      }
      sh.cf = out
    }
  } else {
    sh.hiddenRows = shiftKeyed(sh.hiddenRows, at, delta)
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
