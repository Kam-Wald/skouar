import { type FamilyDef, type UnitDef } from './units'

const TH_C = [140, 150, 165, 180, 190, 200, 220, 230, 240, 260]

export function toCelsius(unitId: string, v: number): number | null {
  if (unitId === 'c') return v
  if (unitId === 'f') return ((v - 32) * 5) / 9
  if (unitId === 'k') return v - 273.15
  if (unitId === 'th') {
    if (v < 1 || v > 10) return null
    const n = Math.floor(v)
    const frac = v - n
    const a = TH_C[n - 1]
    const b = n < 10 ? TH_C[n] : TH_C[9] + (TH_C[9] - TH_C[8])
    return a + (b - a) * frac
  }
  return null
}

export function fromCelsius(unitId: string, c: number): number | null {
  if (unitId === 'c') return c
  if (unitId === 'f') return (c * 9) / 5 + 32
  if (unitId === 'k') return c + 273.15
  if (unitId === 'th') {
    if (c < TH_C[0]) return null
    for (let i = 0; i < TH_C.length - 1; i++) {
      const a = TH_C[i]
      const b = TH_C[i + 1]
      if (c <= b) return i + 1 + (c - a) / (b - a)
    }
    return 10 + (c - TH_C[9]) / (TH_C[9] - TH_C[8])
  }
  return null
}

export function toBase(fam: FamilyDef, unit: UnitDef, value: number): number | null {
  if (!isFinite(value)) return null
  if (fam.special === 'temperature') return toCelsius(unit.id, value)
  return value * unit.toBase
}

export function fromBase(fam: FamilyDef, unit: UnitDef, base: number): number | null {
  if (!isFinite(base)) return null
  if (fam.special === 'temperature') return fromCelsius(unit.id, base)
  return base / unit.toBase
}

export function convert(fam: FamilyDef, from: UnitDef, to: UnitDef, value: number): number | null {
  if (from.kind && to.kind && from.kind !== to.kind) return null
  const base = toBase(fam, from, value)
  return base === null ? null : fromBase(fam, to, base)
}

export function allConversions(fam: FamilyDef, base: number): { unit: UnitDef; value: number | null }[] {
  return fam.units.map((unit) => ({ unit, value: fromBase(fam, unit, base) }))
}

export function parseAmount(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(',', '.')
  if (!t || !/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(t)) return null
  const v = Number(t)
  return isFinite(v) ? v : null
}

const DUR_ORDER = ['sem', 'j', 'h', 'min', 's']
const DUR_FACTORS: Record<string, number> = { s: 1, min: 60, h: 3600, j: 86400, sem: 604800 }
const DUR_TOKEN = /(\d+(?:[.,]\d+)?)\s*(semaines?|jours?|heures?|hrs?|minutes?|mins?|mn|secondes?|secs?|sem|j|h|s)?/gi

export function parseDuration(text: string): number | null {
  const hm = text.trim().match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/)
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2]) * 60 + Number(hm[3] ?? 0)
  let prev: string | null = null
  let total = 0
  let matched = false
  for (const tk of text.matchAll(DUR_TOKEN)) {
    const raw = tk[2]?.toLowerCase()
    let unit: string | null = null
    if (raw) {
      if (/^semaines?$|^sem$/.test(raw)) unit = 'sem'
      else if (/^jours?$|^j$/.test(raw)) unit = 'j'
      else if (/^heures?$|^hrs?$|^h$/.test(raw)) unit = 'h'
      else if (/^minutes?$|^mins?$|^mn$/.test(raw)) unit = 'min'
      else if (/^secondes?$|^secs?$|^s$/.test(raw)) unit = 's'
    } else if (prev) {
      const idx = DUR_ORDER.indexOf(prev)
      unit = idx < DUR_ORDER.length - 1 ? DUR_ORDER[idx + 1] : 's'
    } else {
      unit = 's'
    }
    if (!unit || !DUR_FACTORS[unit]) return null
    total += Number(tk[1].replace(',', '.')) * DUR_FACTORS[unit]
    prev = unit
    matched = true
  }
  return matched ? total : null
}

export function formatFR(v: number, decimals: number): string {
  if (!isFinite(v)) return '—'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e9 || a < 1e-6) {
    const [mant, exp] = v.toExponential(6).split('e')
    const m = mant.replace('.', ',').replace(/0+$/, '').replace(/,$/, '')
    return `${m}e${exp.replace('+', '')}`
  }
  let s = v.toFixed(Math.min(decimals, 20))
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const [i, d] = body.split('.')
  const gi = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (neg ? '-' : '') + gi + (d ? ',' + d : '')
}

export function factorLabel(fam: FamilyDef, from: UnitDef, to: UnitDef): string {
  if (fam.special === 'temperature') {
    const rules: Record<string, string> = {
      'c>f': '°F = °C × 9/5 + 32',
      'f>c': '°C = (°F − 32) × 5/9',
      'c>k': 'K = °C + 273,15',
      'k>c': '°C = K − 273,15',
      'f>k': 'K = (°F − 32) × 5/9 + 273,15',
      'k>f': '°F = (K − 273,15) × 9/5 + 32'
    }
    const key = `${from.id}>${to.id}`
    if (rules[key]) return rules[key]
    if (from.id === 'th' || to.id === 'th') return 'thermostat : table gaz (th 1 = 140 °C … th 10 = 260 °C)'
    return `1 ${from.symbol} = ${formatFR(convert(fam, from, to, 1) ?? 0, 6)} ${to.symbol}`
  }
  return `1 ${from.symbol} = ${formatFR(from.toBase / to.toBase, 6)} ${to.symbol}`
}
