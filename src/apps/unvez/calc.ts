export type AngleMode = 'DEG' | 'RAD' | 'GRAD'

const CONSTS: Record<string, number> = { 'π': Math.PI, pi: Math.PI, g: 9.80665, c: 299792458 }

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

export function tokenize(input: string): Tok[] | null {
  const s = input
    .replace(/,/g, '.')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\s/g, '')
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(s[i + 1] ?? ''))) {
      const m = s.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/i)
      if (!m) return null
      toks.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[a-zA-Zπ√]/i.test(ch)) {
      const m = s.slice(i).match(/^[a-zA-Zπ√]+/)
      if (!m) return null
      toks.push({ t: 'id', v: m[0].toLowerCase() })
      i += m[0].length
      continue
    }
    if ('+-*/^%()'.includes(ch)) {
      toks.push({ t: 'op', v: ch })
      i++
      continue
    }
    return null
  }
  return toks
}

export function evaluate(input: string, mode: AngleMode): { ok: true; value: number } | { ok: false } {
  const toks = tokenize(input)
  if (!toks || toks.length === 0) return { ok: false }
  let pos = 0
  const peek = (): Tok | undefined => toks[pos]
  const next = (): Tok | undefined => toks[pos++]
  const toRad = (v: number): number => (mode === 'DEG' ? (v * Math.PI) / 180 : mode === 'GRAD' ? (v * Math.PI) / 200 : v)
  const fromRad = (v: number): number => (mode === 'DEG' ? (v * 180) / Math.PI : mode === 'GRAD' ? (v * 200) / Math.PI : v)

  function parseExpr(): number | null {
    let left = parseTerm()
    if (left === null) return null
    while (peek()?.t === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = next()!.v
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    if (left === null) return null
    for (;;) {
      const p = peek()
      if (p?.t === 'op' && (p.v === '*' || p.v === '/')) {
        next()
        const right = parseFactor()
        if (right === null) return null
        left = p.v === '*' ? left * right : left / right
      } else if (p && (p.t === 'num' || p.t === 'id' || (p.t === 'op' && p.v === '('))) {
        const right = parseFactor()
        if (right === null) return null
        left *= right
      } else break
    }
    return left
  }

  function parseFactor(): number | null {
    const base = parseUnary()
    if (base === null) return null
    if (peek()?.t === 'op' && peek()!.v === '^') {
      next()
      const exp = parseFactor()
      if (exp === null) return null
      return Math.pow(base, exp)
    }
    return base
  }

  function parseUnary(): number | null {
    const p = peek()
    if (p?.t === 'op' && (p.v === '-' || p.v === '+')) {
      next()
      const v = parseUnary()
      return v === null ? null : p.v === '-' ? -v : v
    }
    return parsePostfix()
  }

  function parsePostfix(): number | null {
    let v = parsePrimary()
    if (v === null) return null
    while (peek()?.t === 'op' && peek()!.v === '%') {
      next()
      v /= 100
    }
    return v
  }

  function parsePrimary(): number | null {
    const p = next()
    if (!p) return null
    if (p.t === 'num') return p.v
    if (p.t === 'op' && p.v === '(') {
      const v = parseExpr()
      if (v === null || peek()?.t !== 'op' || peek()!.v !== ')') return null
      next()
      return v
    }
    if (p.t === 'id') {
      const c = CONSTS[p.v]
      if (c !== undefined) return c
      const fns: Record<string, (x: number) => number> = {
        sin: (x) => Math.sin(toRad(x)),
        cos: (x) => Math.cos(toRad(x)),
        tan: (x) => Math.tan(toRad(x)),
        asin: (x) => fromRad(Math.asin(x)),
        acos: (x) => fromRad(Math.acos(x)),
        atan: (x) => fromRad(Math.atan(x)),
        ln: (x) => Math.log(x),
        log: (x) => Math.log10(x),
        sqrt: (x) => Math.sqrt(x),
        '√': (x) => Math.sqrt(x),
        abs: (x) => Math.abs(x)
      }
      const f = fns[p.v]
      if (!f) return null
      if (peek()?.t !== 'op' || peek()!.v !== '(') return null
      next()
      const arg = parseExpr()
      if (arg === null || peek()?.t !== 'op' || peek()!.v !== ')') return null
      next()
      return f(arg)
    }
    return null
  }

  const v = parseExpr()
  if (v === null || pos !== toks.length || !isFinite(v)) return { ok: false }
  return { ok: true, value: v }
}

export function applyPercentVariation(value: number, pct: number): number {
  return value * (1 + pct / 100)
}
