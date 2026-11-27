import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import {
  CONV,
  RATES_NOTE,
  calcBack,
  calcConst,
  calcDigit,
  calcDot,
  calcEquals,
  calcFunc,
  calcInit,
  calcNegate,
  calcOp,
  calcPercent,
  convert,
  fmtConv,
  type CalcState,
  type ConvCat
} from './logic'

type Mode = 'calc' | 'conv'

const MODE_KEY = 'skouar:unvez:mode'
const CAT_KEY = 'skouar:unvez:cat'
const FROM_KEY = 'skouar:unvez:from'
const TO_KEY = 'skouar:unvez:to'

function get<T extends string>(key: string, fallback: T): T {
  const v = localStorage.getItem(key)
  return (v as T) || fallback
}

export default function UnvezApp(): JSX.Element {
  const [mode, setMode] = useState<Mode>(() => get(MODE_KEY, 'calc'))
  const pick = (m: Mode): void => {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
  }
  return (
    <AppShell
      appId="unvez"
      appName="Unvez"
      logo={`${import.meta.env.BASE_URL}app-icons/unvez.svg`}
      sidebar={
        <nav className="unvez-side">
          <button type="button" className={`unvez-side-btn${mode === 'calc' ? ' active' : ''}`} onClick={() => pick('calc')}>
            🧮 Calculatrice
          </button>
          <button type="button" className={`unvez-side-btn${mode === 'conv' ? ' active' : ''}`} onClick={() => pick('conv')}>
            📏 Convertisseur
          </button>
        </nav>
      }
    >
      {mode === 'calc' ? <Calculator /> : <Converter />}
    </AppShell>
  )
}

function Calculator(): JSX.Element {
  const [s, setS] = useState<CalcState>(calcInit())
  const [sci, setSci] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key
      if (/^[0-9]$/.test(k)) setS((x) => calcDigit(x, k))
      else if (k === '.') setS(calcDot)
      else if (k === '+') setS((x) => calcOp(x, '+'))
      else if (k === '-') setS((x) => calcOp(x, '-'))
      else if (k === '*') setS((x) => calcOp(x, '×'))
      else if (k === '/') {
        e.preventDefault()
        setS((x) => calcOp(x, '÷'))
      } else if (k === 'Enter' || k === '=') setS(calcEquals)
      else if (k === 'Escape') setS(calcInit())
      else if (k === 'Backspace') setS(calcBack)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const btn = (label: string, onClick: () => void, cls = ''): JSX.Element => (
    <button type="button" className={`unvez-btn${cls ? ` ${cls}` : ''}`} onClick={onClick}>
      {label}
    </button>
  )

  return (
    <div className="unvez-wrap">
      <div className="unvez-calc">
        <div className="unvez-pending">{s.acc !== null && s.op ? `${s.acc} ${s.op}` : ''}</div>
        <div className="unvez-display" data-testid="unvez-display">
          {s.display}
        </div>
        {sci && (
          <div className="unvez-grid unvez-sci">
            {btn('sin', () => setS((x) => calcFunc(x, 'sin')))}
            {btn('cos', () => setS((x) => calcFunc(x, 'cos')))}
            {btn('tan', () => setS((x) => calcFunc(x, 'tan')))}
            {btn('1/x', () => setS((x) => calcFunc(x, 'inv')))}
            {btn('√', () => setS((x) => calcFunc(x, 'sqrt')))}
            {btn('x²', () => setS((x) => calcFunc(x, 'sq')))}
            {btn('π', () => setS(calcConst('pi')))}
            {btn('e', () => setS(calcConst('e')))}
          </div>
        )}
        <div className="unvez-grid">
          {btn('C', () => setS(calcInit()), 'danger')}
          {btn('⌫', () => setS(calcBack))}
          {btn('%', () => setS(calcPercent))}
          {btn('÷', () => setS((x) => calcOp(x, '÷')), 'op')}
          {btn('7', () => setS((x) => calcDigit(x, '7')))}
          {btn('8', () => setS((x) => calcDigit(x, '8')))}
          {btn('9', () => setS((x) => calcDigit(x, '9')))}
          {btn('×', () => setS((x) => calcOp(x, '×')), 'op')}
          {btn('4', () => setS((x) => calcDigit(x, '4')))}
          {btn('5', () => setS((x) => calcDigit(x, '5')))}
          {btn('6', () => setS((x) => calcDigit(x, '6')))}
          {btn('−', () => setS((x) => calcOp(x, '-')), 'op')}
          {btn('1', () => setS((x) => calcDigit(x, '1')))}
          {btn('2', () => setS((x) => calcDigit(x, '2')))}
          {btn('3', () => setS((x) => calcDigit(x, '3')))}
          {btn('+', () => setS((x) => calcOp(x, '+')), 'op')}
          {btn('±', () => setS(calcNegate))}
          {btn('0', () => setS((x) => calcDigit(x, '0')))}
          {btn('.', () => setS(calcDot))}
          {btn('=', () => setS(calcEquals), 'eq')}
        </div>
        <button type="button" className="unvez-sci-toggle" onClick={() => setSci((o) => !o)}>
          {sci ? 'Masquer les fonctions' : 'Fonctions scientifiques (fx)'}
        </button>
      </div>
    </div>
  )
}

function Converter(): JSX.Element {
  const [cat, setCat] = useState<ConvCat>(() => get(CAT_KEY, 'longueur'))
  const [from, setFrom] = useState<string>(() => get(FROM_KEY, 'm'))
  const [to, setTo] = useState<string>(() => get(TO_KEY, 'ft'))
  const [val, setVal] = useState('')
  const units = CONV[cat].units
  const fromU = units.find((u) => u.id === from) ?? units[1] ?? units[0]
  const toU = units.find((u) => u.id === to) ?? units[0]
  const out = val.trim() === '' ? NaN : convert(parseFloat(val), fromU.id, toU.id, cat)

  const pickCat = (c: ConvCat): void => {
    setCat(c)
    localStorage.setItem(CAT_KEY, c)
  }
  const pickFrom = (id: string): void => {
    setFrom(id)
    localStorage.setItem(FROM_KEY, id)
  }
  const pickTo = (id: string): void => {
    setTo(id)
    localStorage.setItem(TO_KEY, id)
  }
  const swap = (): void => {
    pickFrom(toU.id)
    pickTo(fromU.id)
  }

  const cats = (Object.keys(CONV) as ConvCat[]).map((c) => (
    <button
      key={c}
      type="button"
      className={`unvez-tab${cat === c ? ' active' : ''}`}
      onClick={() => pickCat(c)}
    >
      {CONV[c].label}
    </button>
  ))

  return (
    <div className="unvez-wrap">
      <div className="unvez-conv">
        <div className="unvez-tabs">{cats}</div>
        <div className="unvez-row">
          <input
            className="unvez-input"
            type="number"
            inputMode="decimal"
            placeholder="Valeur…"
            aria-label="Valeur à convertir"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <select className="unvez-select" aria-label="Unité de départ" value={fromU.id} onChange={(e) => pickFrom(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>
        <div className="unvez-row unvez-mid">
          <div className="unvez-out" data-testid="unvez-out">
            {fmtConv(out)} <span className="unvez-out-unit">{toU.label.split(' ').pop()}</span>
          </div>
          <button type="button" className="unvez-btn unvez-swap" title="Inverser" onClick={swap}>
            ⇅
          </button>
        </div>
        <div className="unvez-row">
          <select className="unvez-select" aria-label="Unité d’arrivée" value={toU.id} onChange={(e) => pickTo(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>
        {cat === 'devise' && <p className="unvez-note">{RATES_NOTE}</p>}
      </div>
    </div>
  )
}
