export type Op = '+' | '-' | '×' | '÷'

export interface CalcState {
  display: string
  acc: number | null
  op: Op | null
  fresh: boolean
}

export function calcInit(): CalcState {
  return { display: '0', acc: null, op: null, fresh: true }
}

function toNum(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return 'Erreur'
  return String(Math.round(n * 1e10) / 1e10)
}

export function applyOp(a: number, b: number, op: Op): number {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '×') return a * b
  return b === 0 ? NaN : a / b
}

export function calcDigit(s: CalcState, d: string): CalcState {
  if (s.display === 'Erreur') return { ...calcInit(), display: d, fresh: false }
  if (s.fresh) return { ...s, display: d, fresh: false }
  if (s.display.replace(/[-.]/g, '').length >= 12) return s
  if (s.display === '0') return { ...s, display: d }
  if (s.display === '-0') return { ...s, display: '-' + d }
  return { ...s, display: s.display + d }
}

export function calcDot(s: CalcState): CalcState {
  if (s.display === 'Erreur') return { ...calcInit(), display: '0.', fresh: false }
  if (s.fresh) return { ...s, display: '0.', fresh: false }
  if (s.display.includes('.')) return s
  return { ...s, display: s.display + '.' }
}

export function calcOp(s: CalcState, op: Op): CalcState {
  const cur = toNum(s.display)
  if (s.acc !== null && s.op !== null && !s.fresh) {
    const r = applyOp(s.acc, cur, s.op)
    return Number.isFinite(r)
      ? { display: fmtNum(r), acc: r, op, fresh: true }
      : { ...calcInit(), display: 'Erreur', fresh: true }
  }
  return { ...s, acc: cur, op, fresh: true }
}

export function calcEquals(s: CalcState): CalcState {
  if (s.op === null || s.acc === null) return s
  const r = applyOp(s.acc, toNum(s.display), s.op)
  return { display: fmtNum(r), acc: null, op: null, fresh: true }
}

export function calcBack(s: CalcState): CalcState {
  if (s.fresh || s.display === 'Erreur') return s
  const next = s.display.length > 1 ? s.display.slice(0, -1) : '0'
  return { ...s, display: next === '-' ? '0' : next }
}

export function calcNegate(s: CalcState): CalcState {
  if (s.display === 'Erreur' || s.display === '0') return s
  return { ...s, display: s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display }
}

export function calcPercent(s: CalcState): CalcState {
  return { ...s, display: fmtNum(toNum(s.display) / 100), fresh: true }
}

export type CalcFn = 'sqrt' | 'sq' | 'inv' | 'sin' | 'cos' | 'tan'

export function calcFunc(s: CalcState, fn: CalcFn): CalcState {
  const n = toNum(s.display)
  let r: number
  if (fn === 'sqrt') r = n < 0 ? NaN : Math.sqrt(n)
  else if (fn === 'sq') r = n * n
  else if (fn === 'inv') r = n === 0 ? NaN : 1 / n
  else if (fn === 'sin') r = Math.sin((n * Math.PI) / 180)
  else if (fn === 'cos') r = Math.cos((n * Math.PI) / 180)
  else r = Math.tan((n * Math.PI) / 180)
  return { ...s, display: fmtNum(r), fresh: true }
}

export function calcConst(which: 'pi' | 'e'): CalcState {
  return { display: fmtNum(which === 'pi' ? Math.PI : Math.E), acc: null, op: null, fresh: true }
}

export type ConvCat = 'longueur' | 'poids' | 'devise'

export interface UnitDef {
  id: string
  label: string
  f: number
}

export const RATES_NOTE = 'Taux indicatifs hors ligne (nov. 2026), pour 1 EUR.'

export const CONV: Record<ConvCat, { label: string; units: UnitDef[] }> = {
  longueur: {
    label: 'Longueur',
    units: [
      { id: 'km', label: 'kilomètre (km)', f: 1000 },
      { id: 'm', label: 'mètre (m)', f: 1 },
      { id: 'cm', label: 'centimètre (cm)', f: 0.01 },
      { id: 'mm', label: 'millimètre (mm)', f: 0.001 },
      { id: 'mi', label: 'mile (mi)', f: 1609.344 },
      { id: 'yd', label: 'yard (yd)', f: 0.9144 },
      { id: 'ft', label: 'pied (ft)', f: 0.3048 },
      { id: 'in', label: 'pouce (in)', f: 0.0254 }
    ]
  },
  poids: {
    label: 'Poids',
    units: [
      { id: 't', label: 'tonne (t)', f: 1000 },
      { id: 'kg', label: 'kilogramme (kg)', f: 1 },
      { id: 'g', label: 'gramme (g)', f: 0.001 },
      { id: 'mg', label: 'milligramme (mg)', f: 1e-6 },
      { id: 'lb', label: 'livre (lb)', f: 0.45359237 },
      { id: 'oz', label: 'once (oz)', f: 0.028349523125 }
    ]
  },
  devise: {
    label: 'Devise',
    units: [
      { id: 'EUR', label: 'Euro (EUR)', f: 1 },
      { id: 'USD', label: 'Dollar US (USD)', f: 1 / 1.08 },
      { id: 'GBP', label: 'Livre sterling (GBP)', f: 1 / 0.85 },
      { id: 'JPY', label: 'Yen (JPY)', f: 1 / 160.5 },
      { id: 'CHF', label: 'Franc suisse (CHF)', f: 1 / 0.94 },
      { id: 'CAD', label: 'Dollar canadien (CAD)', f: 1 / 1.47 },
      { id: 'AUD', label: 'Dollar australien (AUD)', f: 1 / 1.64 },
      { id: 'CNY', label: 'Yuan (CNY)', f: 1 / 7.85 },
      { id: 'SEK', label: 'Couronne suédoise (SEK)', f: 1 / 11.3 },
      { id: 'NOK', label: 'Couronne norvégienne (NOK)', f: 1 / 11.6 },
      { id: 'DKK', label: 'Couronne danoise (DKK)', f: 1 / 7.46 },
      { id: 'PLN', label: 'Zloty (PLN)', f: 1 / 4.32 }
    ]
  }
}

export function convert(v: number, from: string, to: string, cat: ConvCat): number {
  const units = CONV[cat].units
  const a = units.find((u) => u.id === from)
  const b = units.find((u) => u.id === to)
  if (!a || !b || !Number.isFinite(v)) return NaN
  return (v * a.f) / b.f
}

export function fmtConv(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4)) return n.toExponential(3)
  return String(parseFloat(n.toPrecision(6)))
}
