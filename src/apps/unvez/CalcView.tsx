import { useEffect, useRef, useState } from 'react'
import { applyPercentVariation, evaluate, type AngleMode } from './calc'
import { formatFR } from './logic'
import { notify } from '../../shared/notify'
import type { TapeEntry, UnvezSettings } from './store'

interface Props {
  settings: UnvezSettings
  onSettings: (patch: Partial<UnvezSettings>) => void
  seed: { expr: string; raw: number } | null
  onSaveMemo: (p: { expr: string; result: string }) => void
}

export default function CalcView({ settings, onSettings, seed, onSaveMemo }: Props) {
  const [expr, setExprState] = useState('')
  const exprRef = useRef('')
  const setExpr = (u: string | ((e: string) => string)): void => {
    const next = typeof u === 'function' ? u(exprRef.current) : u
    exprRef.current = next
    setExprState(next)
  }
  const [raw, setRawState] = useState<number | null>(null)
  const rawRef = useRef<number | null>(null)
  const setRaw = (v: number | null): void => {
    rawRef.current = v
    setRawState(v)
  }
  const [justEval, setJustEvalState] = useState(false)
  const justEvalRef = useRef(false)
  const setJustEval = (v: boolean): void => {
    justEvalRef.current = v
    setJustEvalState(v)
  }
  const [mem, setMemState] = useState(0)
  const memRef = useRef(0)
  const setMem = (u: number | ((m: number) => number)): void => {
    const next = typeof u === 'function' ? u(memRef.current) : u
    memRef.current = next
    setMemState(next)
  }
  const [tab, setTab] = useState<'simple' | 'sci'>('simple')
  const mode: AngleMode = settings.angle
  const modeRef = useRef(mode)
  modeRef.current = mode
  const decimals = settings.decimals
  const tape = settings.tape

  const display = justEval && raw !== null ? formatFR(raw, decimals) : expr || '0'

  const currentNumber = (): number | null => {
    if (justEvalRef.current && rawRef.current !== null) return rawRef.current
    if (!exprRef.current) return null
    const r = evaluate(exprRef.current, modeRef.current)
    return r.ok ? r.value : null
  }

  const pushTape = (e: string, value: number): void => {
    const entry: TapeEntry = { expr: e, result: formatFR(value, decimals), raw: String(value) }
    onSettings({ tape: [entry, ...tape].slice(0, 50) })
  }

  const equals = (): void => {
    const e = exprRef.current
    if (!e) return
    const r = evaluate(e, modeRef.current)
    if (!r.ok) {
      notify('Expression invalide')
      return
    }
    pushTape(e, r.value)
    setRaw(r.value)
    setExpr(String(r.value))
    setJustEval(true)
  }

  const digit = (d: string): void => {
    if (justEvalRef.current) {
      setExpr(d)
      setRaw(null)
      setJustEval(false)
    } else setExpr((e) => e + d)
  }

  const dot = (): void => {
    if (justEvalRef.current) {
      setExpr('0.')
      setRaw(null)
      setJustEval(false)
      return
    }
    setExpr((e) => (/\d$/.test(e) && !/\.\d*$/.test(e) ? e + '.' : e || '0.'))
  }

  const op = (o: string): void => {
    if (justEvalRef.current && rawRef.current !== null) {
      setExpr(String(rawRef.current) + o)
      setJustEval(false)
    } else setExpr((e) => (e === '' ? (o === '-' ? '-' : '') : e + o))
  }

  const paren = (o: string): void => {
    if (justEvalRef.current && o === '(' && rawRef.current !== null) {
      setExpr(String(rawRef.current) + '*(')
      setJustEval(false)
    } else op(o)
  }

  const fn = (name: string): void => {
    if (justEvalRef.current && rawRef.current !== null) {
      setExpr(`${name}(${String(rawRef.current)})`)
      setJustEval(false)
    } else setExpr((e) => e + `${name}(`)
  }

  const konst = (sym: string): void => {
    if (justEvalRef.current) {
      setExpr(sym)
      setRaw(null)
      setJustEval(false)
    } else setExpr((e) => e + sym)
  }

  const variation = (pct: number): void => {
    const v = currentNumber() ?? 0
    const nv = applyPercentVariation(v, pct)
    pushTape(`${formatFR(v, decimals)} ${pct > 0 ? '+' : ''}${pct} %`, nv)
    setRaw(nv)
    setExpr(String(nv))
    setJustEval(true)
  }

  const clear = (): void => {
    setExpr('')
    setRaw(null)
    setJustEval(false)
  }

  const clearEntry = (): void => {
    setExpr('')
  }

  const back = (): void => {
    if (justEvalRef.current) {
      clear()
      return
    }
    setExpr((e) => e.slice(0, -1))
  }

  const memAdd = (sign: 1 | -1): void => {
    setMem((m) => m + sign * (currentNumber() ?? 0))
  }

  const memRecall = (): void => {
    if (justEvalRef.current) {
      setExpr(String(memRef.current))
      setRaw(null)
      setJustEval(false)
    } else setExpr((e) => e + String(memRef.current))
  }

  const copy = (): void => {
    const text = display
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(
        () => notify('Résultat copié'),
        () => notify('Copie impossible')
      )
    } else notify(text)
  }

  const reuseTape = (t: TapeEntry): void => {
    setExpr(t.raw)
    setRaw(Number(t.raw))
    setJustEval(true)
  }

  useEffect(() => {
    if (seed) {
      setExpr(seed.expr)
      setRaw(seed.raw)
      setJustEval(true)
    }
  }, [seed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target
      if (t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key
      if (/^[0-9]$/.test(k)) digit(k)
      else if (k === '.' || k === ',') dot()
      else if (k === '+' || k === '-' || k === '*' || k === '/' || k === '^' || k === '%') op(k)
      else if (k === '(' || k === ')') paren(k)
      else if (k === 'Enter' || k === '=') {
        e.preventDefault()
        equals()
      } else if (k === 'Backspace') back()
      else if (k === 'Escape') clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sci = settings.sci !== false

  return (
    <section className="unvez-view unvez-calc">
      <div className="calc-tabs">
        <button type="button" className={`unvez-btn${tab === 'simple' ? ' active' : ''}`} onClick={() => setTab('simple')}>
          Simple
        </button>
        {sci && (
          <button type="button" className={`unvez-btn${tab === 'sci' ? ' active' : ''}`} onClick={() => setTab('sci')}>
            Scientifique
          </button>
        )}
        {tab === 'sci' && (
          <span className="calc-mode" role="group" aria-label="Mode d'angle">
            {(['DEG', 'RAD', 'GRAD'] as const).map((m) => (
              <button key={m} type="button" className={`unvez-btn${mode === m ? ' active' : ''}`} onClick={() => onSettings({ angle: m })}>
                {m}
              </button>
            ))}
          </span>
        )}
      </div>
      <ol className="calc-tape" aria-label="Historique des calculs">
        {tape.length === 0 && <li className="unvez-empty">Aucun calcul pour l’instant.</li>}
        {tape.map((t, i) => (
          <li key={`${t.raw}-${i}`}>
            <button type="button" className="calc-tape-row" onClick={() => reuseTape(t)} title="Réutiliser ce résultat">
              <small>{t.expr} =</small>
              <strong>{t.result}</strong>
            </button>
          </li>
        ))}
      </ol>
      <div className="calc-display">
        <div className="calc-expr">{justEval && expr ? `${expr} =` : ' '}</div>
        <div className="calc-out" aria-live="polite">{display}</div>
        <button type="button" className="calc-copy" aria-label="Copier le résultat" onClick={copy}>
          ⧉ Copier
        </button>
        <button type="button" className="calc-save" onClick={() => onSaveMemo({ expr, result: display })}>
          ★ Enregistrer un mémo
        </button>
      </div>
      <div className="calc-pct" role="group" aria-label="Variations en chaîne">
        {[-20, -10, 10, 20].map((p) => (
          <button key={p} type="button" className="unvez-btn" onClick={() => variation(p)}>
            {p > 0 ? `+${p}` : `−${Math.abs(p)}`} %
          </button>
        ))}
      </div>
      <div className="calc-mem" role="group" aria-label="Mémoire">
        {['MC', 'MR', 'M+', 'M−'].map((m) => (
          <button
            key={m}
            type="button"
            className="unvez-btn"
            onClick={() => (m === 'MC' ? setMem(0) : m === 'MR' ? memRecall() : memAdd(m === 'M+' ? 1 : -1))}
          >
            {m}
          </button>
        ))}
      </div>
      {tab === 'sci' && (
        <div className="calc-pad calc-pad-sci">
          {['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', '√(', 'abs(', 'π', 'g', 'c'].map((b) => (
            <button key={b} type="button" className="calc-key" onClick={() => (b === 'π' || b === 'g' || b === 'c' ? konst(b) : fn(b.replace('(', '')))}>
              {b === '√(' ? '√' : b === 'abs(' ? 'abs' : b}
            </button>
          ))}
        </div>
      )}
      <div className="calc-pad">
        {['C', 'CE', '⌫', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '%', '(', ')', '='].map((k) => (
          <button
            key={k}
            type="button"
            className={`calc-key${k === '=' ? ' calc-eq' : ''}`}
            onClick={() =>
              k === 'C' ? clear() : k === 'CE' ? clearEntry() : k === '⌫' ? back() : k === '=' ? equals() : k === '.' ? dot() : k === '÷' ? op('/') : k === '×' ? op('*') : k === '−' ? op('-') : k === '%' ? op('%') : k === '(' || k === ')' ? paren(k) : digit(k)
            }
          >
            {k}
          </button>
        ))}
      </div>
    </section>
  )
}
