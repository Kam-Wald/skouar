import { useEffect, useMemo, useState } from 'react'
import { allUnits, families, findFamily, findUnit } from './units'
import { allConversions, factorLabel, formatFR, fromBase, parseAmount, parseDuration, toBase } from './logic'
import type { UnvezSettings } from './store'

interface Props {
  settings: UnvezSettings
  onSettings: (patch: Partial<UnvezSettings>) => void
  seed: { family: string; from: string; to: string; value: string } | null
  onSaveMemo: (p: { familyId: string; fromUnit: string; toUnit: string; input: string; result: string }) => void
}

export default function ConvView({ settings, onSettings, seed, onSaveMemo }: Props) {
  const fams = useMemo(() => families(settings.cook), [settings.cook])
  const [familyId, setFamilyId] = useState(() => settings.lastFamily ?? 'distance')
  const fam = findFamily(familyId, settings.cook) ?? fams[0]
  const [fromId, setFromId] = useState(() => settings.lastFrom ?? fam.units[0].id)
  const [toId, setToId] = useState(() => settings.lastTo ?? fam.units[1]?.id ?? fam.units[0].id)
  const [aText, setAText] = useState('')
  const [bText, setBText] = useState('')
  const [base, setBase] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [query, setQuery] = useState('')

  const from = findUnit(fam, fromId) ?? fam.units[0]
  const to = findUnit(fam, toId) ?? fam.units[0]
  const pairKey = `${fam.id}:${from.id}>${to.id}`
  const decimals = settings.decimals
  const fmt = (v: number | null): string => (v === null ? '' : formatFR(v, decimals))

  useEffect(() => {
    onSettings({
      lastFamily: fam.id,
      lastFrom: from.id,
      lastTo: to.id,
      recentPairs: [pairKey, ...settings.recentPairs.filter((p) => p !== pairKey)].slice(0, 8)
    })
  }, [fam.id, from.id, to.id, pairKey])

  useEffect(() => {
    if (!seed) return
    const sf = findFamily(seed.family, settings.cook)
    if (!sf) return
    const su = findUnit(sf, seed.from)
    if (!su) return
    setFamilyId(sf.id)
    setFromId(su.id)
    setToId(findUnit(sf, seed.to)?.id ?? sf.units.find((u) => u.id !== su.id)?.id ?? su.id)
    setAText(seed.value)
    const b = computeBase(seed.value, su)
    setBase(b)
    const stu = findUnit(sf, seed.to) ?? sf.units[0]
    setBText(fmt(b === null ? null : fromBase(sf, stu, b)))
  }, [seed])

  useEffect(() => {
    setBText(fmt(base === null ? null : fromBase(fam, to, base)))
  }, [from.id, to.id, fam.id])

  const computeBase = (text: string, unit: typeof from): number | null => {
    if (fam.special === 'duration' && /[a-zà-ÿ]/i.test(text)) return parseDuration(text)
    const v = parseAmount(text)
    return v === null ? null : toBase(fam, unit, v)
  }

  const onA = (t: string): void => {
    setAText(t)
    const b = computeBase(t, from)
    setBase(b)
    setBText(fmt(b === null ? null : fromBase(fam, to, b)))
  }

  const onB = (t: string): void => {
    setBText(t)
    const b = computeBase(t, to)
    setBase(b)
    setAText(fmt(b === null ? null : fromBase(fam, from, b)))
  }

  const swap = (): void => {
    setFromId(to.id)
    setToId(from.id)
    setAText(bText)
    setBText(aText)
  }

  const pickFamily = (fid: string): void => {
    const f = findFamily(fid, settings.cook)
    if (!f) return
    setFamilyId(fid)
    setFromId(f.units[0].id)
    setToId(f.units[1]?.id ?? f.units[0].id)
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allUnits(settings.cook)
      .filter(({ unit }) => `${unit.label} ${unit.symbol} ${unit.id}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, settings.cook])

  const rows = base === null ? [] : allConversions(fam, base)
  const fav = settings.favPairs.includes(pairKey)

  return (
    <section className="unvez-view unvez-conv">
      <div className="conv-top">
        <select aria-label="Famille d'unités" value={fam.id} onChange={(e) => pickFamily(e.target.value)}>
          {fams.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <input
          aria-label="Rechercher une unité"
          className="conv-search"
          placeholder="Rechercher une unité… (ex. km, livre)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Précision (décimales)"
          value={settings.decimals}
          onChange={(e) => onSettings({ decimals: Number(e.target.value) })}
        >
          {[2, 4, 6, 8, 10].map((d) => (
            <option key={d} value={d}>{d} déc.</option>
          ))}
        </select>
      </div>
      {results.length > 0 && (
        <ul className="conv-results">
          {results.map(({ fam: rf, unit }) => (
            <li key={`${rf.id}:${unit.id}`}>
              <button
                type="button"
                onClick={() => {
                  setFamilyId(rf.id)
                  setFromId(unit.id)
                  const f = findFamily(rf.id, settings.cook)
                  setToId(f?.units.find((u) => u.id !== unit.id)?.id ?? unit.id)
                  setQuery('')
                }}
              >
                {unit.label} ({unit.symbol}) — {rf.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="conv-pair">
        <div className="conv-field">
          <input aria-label="Valeur source" inputMode="decimal" value={aText} onChange={(e) => onA(e.target.value)} />
          <select aria-label="Unité source" value={from.id} onChange={(e) => setFromId(e.target.value)}>
            {fam.units.map((u) => (
              <option key={u.id} value={u.id}>{u.symbol} — {u.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="conv-swap" aria-label="Échanger source et cible" title="Échanger (swap)" onClick={swap}>
          ⇄
        </button>
        <div className="conv-field">
          <input aria-label="Valeur convertie" inputMode="decimal" value={bText} onChange={(e) => onB(e.target.value)} />
          <select aria-label="Unité cible" value={to.id} onChange={(e) => setToId(e.target.value)}>
            {fam.units.map((u) => (
              <option key={u.id} value={u.id}>{u.symbol} — {u.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={`conv-fav${fav ? ' active' : ''}`}
          aria-label="Épingler cette paire"
          aria-pressed={fav}
          title="Épingler / retirer des favoris"
          onClick={() => onSettings({ favPairs: fav ? settings.favPairs.filter((p) => p !== pairKey) : [...settings.favPairs, pairKey] })}
        >
          ★
        </button>
      </div>
      <p className="conv-formula">
        {factorLabel(fam, from, to)}
        {fam.id === 'cuisine' ? ` — convention ${settings.cook === 'us' ? 'US' : 'métrique'}` : ''}
      </p>
      <div className="conv-actions">
        <button type="button" className="unvez-btn" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Masquer les unités' : 'Toutes les unités'}
        </button>
        <button
          type="button"
          className="unvez-btn"
          onClick={() => onSaveMemo({ familyId: fam.id, fromUnit: from.id, toUnit: to.id, input: aText, result: bText })}
        >
          ★ Enregistrer un mémo
        </button>
      </div>
      {showAll && (
        <ul className="conv-all">
          {rows.map(({ unit, value }) => (
            <li key={unit.id}>
              <button type="button" className="conv-unit-row" onClick={() => setToId(unit.id)}>
                <span className="conv-unit-sym">{unit.symbol}</span>
                <span className="conv-unit-label">{unit.label}</span>
                <span className="conv-unit-val">{fmt(value)}</span>
              </button>
              {unit.note && <small className="conv-unit-note">{unit.note}</small>}
            </li>
          ))}
        </ul>
      )}
      {settings.recentPairs.length > 0 && (
        <p className="conv-recents">
          Récentes :{' '}
          {settings.recentPairs.map((pk) => {
            const [fid, rest] = pk.split(':')
            const [fId, tId] = rest.split('>')
            const rf = findFamily(fid, settings.cook)
            const fu = rf ? findUnit(rf, fId) : undefined
            const tu = rf ? findUnit(rf, tId) : undefined
            if (!rf || !fu || !tu) return null
            return (
              <button key={pk} type="button" className="conv-chip" onClick={() => { setFamilyId(fid); setFromId(fId); setToId(tId) }}>
                {fu.symbol} → {tu.symbol}
              </button>
            )
          })}
        </p>
      )}
    </section>
  )
}
