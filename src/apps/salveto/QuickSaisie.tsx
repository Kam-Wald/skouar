import { useState } from 'react'
import { uid } from '../../shared/db'
import BodyMap from './BodyMap'
import {
  DECLENCHEUR_SUGGESTIONS,
  EFFETS,
  FLUX_SUGGESTIONS,
  HABITUDE_SUGGESTIONS,
  MORAL_LABELS,
  clampInt,
  clampNum,
  makeEvent,
  toLocalISO,
  todayDay,
  type Effet,
  type RefItem,
  type SalvetoEvent,
  type SalvetoRefs,
  type SuiviId
} from './logic'

interface Props {
  suivi: SuiviId
  refs: SalvetoRefs
  onSave: (e: SalvetoEvent) => void
  onUpsertRef: (r: RefItem) => void
  onClose: () => void
}

export default function QuickSaisie({ suivi, refs, onSave, onUpsertRef, onClose }: Props) {
  const [txt, setTxt] = useState('')
  const [coucher, setCoucher] = useState('')
  const [reveil, setReveil] = useState('')
  const [duree, setDuree] = useState('')
  const [intensite, setIntensite] = useState<number | undefined>()
  const [zones, setZones] = useState<string[]>([])
  const [decl, setDecl] = useState<string[]>([])
  const [declTxt, setDeclTxt] = useState('')
  const [selRef, setSelRef] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newUnite, setNewUnite] = useState('')
  const [newSeuil, setNewSeuil] = useState('')
  const [debut, setDebut] = useState(todayDay())
  const [fin, setFin] = useState('')
  const [flux, setFlux] = useState('')

  const save = (patch: Partial<SalvetoEvent>): void => {
    onSave(makeEvent(suivi, patch))
  }

  if (suivi === 'moral' || suivi === 'energie') {
    return (
      <div className="sa-panel" data-panel={suivi}>
        <p className="sa-panel-title">{suivi === 'moral' ? 'Ton moral maintenant ?' : 'Ton énergie maintenant ?'}</p>
        <div className="sa-scale">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="sa-scale-btn"
              onClick={() => save({ value: n })}
              title={MORAL_LABELS[n - 1]}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="sa-panel-hint">{MORAL_LABELS[0]} ← → {MORAL_LABELS[4]}</p>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'poids') {
    return (
      <div className="sa-panel" data-panel="poids">
        <p className="sa-panel-title">Ton poids aujourd’hui (kg) ?</p>
        <div className="sa-panel-row">
          <input
            className="db-input sa-poids-input"
            type="number"
            step="0.1"
            min="0"
            placeholder="72,5"
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
          />
          <button
            type="button"
            className="db-btn"
            disabled={!clampNum(txt, 0.1, 999)}
            onClick={() => save({ value: clampNum(txt, 0.1, 999) })}
          >
            Noter
          </button>
        </div>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'crise') {
    const toggleZone = (id: string): void => {
      setZones((z) => (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]))
    }
    const addDecl = (): void => {
      const t = declTxt.trim()
      if (t && !decl.some((d) => d.toLowerCase() === t.toLowerCase())) setDecl([...decl, t])
      setDeclTxt('')
    }
    return (
      <div className="sa-panel sa-panel-crise" data-panel="crise">
        <p className="sa-panel-title">Crise / douleur — intensité ?</p>
        <div className="sa-scale">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`sa-scale-btn${intensite === n ? ' active' : ''}`}
              onClick={() => setIntensite(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="sa-panel-hint">Localisation sur la carte du corps :</p>
        <BodyMap selected={zones} onToggle={toggleZone} />
        <input
          className="db-input"
          type="text"
          placeholder="Précision texte (facultatif, ex. « côté gauche »)"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
        />
        <p className="sa-panel-hint">Déclencheurs suspectés :</p>
        <div className="sa-panel-row">
          <input
            className="db-input"
            type="text"
            list="sa-declencheurs"
            placeholder="Ajouter un facteur…"
            value={declTxt}
            onChange={(e) => setDeclTxt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDecl()
              }
            }}
          />
          <datalist id="sa-declencheurs">
            {DECLENCHEUR_SUGGESTIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button type="button" className="db-btn" onClick={addDecl} disabled={!declTxt.trim()}>
            +
          </button>
        </div>
        {decl.length > 0 && (
          <div className="sa-chips">
            {decl.map((d) => (
              <button
                key={d}
                type="button"
                className="sa-chip sa-chip-btn"
                title="Retirer"
                onClick={() => setDecl(decl.filter((x) => x !== d))}
              >
                {d} ×
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="db-btn sa-panel-save"
          disabled={!intensite}
          onClick={() =>
            save({
              value: intensite,
              label: txt.trim() || undefined,
              zones: zones.length ? zones : undefined,
              declencheurs: decl.length ? decl : undefined
            })
          }
        >
          Enregistrer la crise
        </button>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'sommeil') {
    return (
      <div className="sa-panel" data-panel="sommeil">
        <p className="sa-panel-title">Ton sommeil ?</p>
        <div className="sa-panel-row">
          <label className="sa-field">
            Couché
            <input className="db-input" type="time" value={coucher} onChange={(e) => setCoucher(e.target.value)} />
          </label>
          <label className="sa-field">
            Réveil
            <input className="db-input" type="time" value={reveil} onChange={(e) => setReveil(e.target.value)} />
          </label>
        </div>
        <p className="sa-panel-hint">Qualité perçue :</p>
        <div className="sa-scale">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="sa-scale-btn"
              onClick={() =>
                save({
                  value: n,
                  heureCoucher: coucher || undefined,
                  heureReveil: reveil || undefined
                })
              }
            >
              {n}
            </button>
          ))}
        </div>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'symptome') {
    return (
      <div className="sa-panel" data-panel="symptome">
        <p className="sa-panel-title">Quel symptôme ?</p>
        <input
          className="db-input"
          type="text"
          placeholder="Type (fièvre, fatigue, vertiges…)"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
        />
        <p className="sa-panel-hint">Intensité :</p>
        <div className="sa-scale">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`sa-scale-btn${intensite === n ? ' active' : ''}`}
              onClick={() => setIntensite(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="sa-panel-row">
          <input
            className="db-input"
            type="number"
            min="0"
            placeholder="Durée (min)"
            value={duree}
            onChange={(e) => setDuree(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="db-btn sa-panel-save"
          disabled={!txt.trim() || !intensite}
          onClick={() =>
            save({
              label: txt.trim(),
              value: intensite,
              dureeMin: clampInt(duree, 0, 100000)
            })
          }
        >
          Enregistrer
        </button>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'habitude') {
    return (
      <div className="sa-panel" data-panel="habitude">
        <p className="sa-panel-title">Une habitude / activité aujourd’hui ?</p>
        <input
          className="db-input"
          type="text"
          list="sa-habitudes"
          placeholder="Sport, sortie, écran…"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
        />
        <datalist id="sa-habitudes">
          {HABITUDE_SUGGESTIONS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <button
          type="button"
          className="db-btn sa-panel-save"
          disabled={!txt.trim()}
          onClick={() => save({ label: txt.trim() })}
        >
          Enregistrer
        </button>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'traitement') {
    const traitements = refs.items.filter((r) => r.kind === 'traitement')
    const cur = traitements.find((r) => r.id === selRef) ?? traitements[0]
    const create = (): void => {
      const label = newLabel.trim()
      if (!label) return
      const item: RefItem = { id: uid(), kind: 'traitement', label, createdAt: toLocalISO(new Date()) }
      onUpsertRef(item)
      setSelRef(item.id)
      setCreating(false)
      setNewLabel('')
    }
    return (
      <div className="sa-panel" data-panel="traitement">
        <p className="sa-panel-title">Quelle prise / activité ?</p>
        {traitements.length > 0 && !creating ? (
          <select className="db-select" value={cur?.id ?? ''} onChange={(e) => setSelRef(e.target.value)}>
            {traitements.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="sa-panel-row">
            <input
              className="db-input"
              type="text"
              placeholder="Nom du traitement / activité…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button type="button" className="db-btn" onClick={create} disabled={!newLabel.trim()}>
              Créer
            </button>
          </div>
        )}
        {traitements.length > 0 && creating && (
          <div className="sa-panel-row">
            <input
              className="db-input"
              type="text"
              placeholder="Nom du traitement / activité…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button type="button" className="db-btn" onClick={create} disabled={!newLabel.trim()}>
              Créer
            </button>
          </div>
        )}
        {traitements.length > 0 && !creating && (
          <button type="button" className="sa-link" onClick={() => setCreating(true)}>
            + nouveau traitement / activité
          </button>
        )}
        {cur && (
          <>
            <p className="sa-panel-hint">Effet ressenti pour « {cur.label} » :</p>
            <div className="sa-scale sa-effets">
              {EFFETS.map((eff) => (
                <button
                  key={eff}
                  type="button"
                  className="sa-scale-btn sa-effet-btn"
                  data-effet={eff}
                  onClick={() => save({ refId: cur.id, label: cur.label, effet: eff as Effet })}
                >
                  {eff}
                </button>
              ))}
            </div>
          </>
        )}
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'constante') {
    const constantes = refs.items.filter((r) => r.kind === 'constante')
    const cur = constantes.find((r) => r.id === selRef) ?? constantes[0]
    const create = (): void => {
      const label = newLabel.trim()
      if (!label) return
      const item: RefItem = {
        id: uid(),
        kind: 'constante',
        label,
        unite: newUnite.trim() || undefined,
        seuil: clampNum(newSeuil, 0, 1e9),
        createdAt: toLocalISO(new Date())
      }
      onUpsertRef(item)
      setSelRef(item.id)
      setCreating(false)
      setNewLabel('')
      setNewUnite('')
      setNewSeuil('')
    }
    return (
      <div className="sa-panel" data-panel="constante">
        <p className="sa-panel-title">Quelle constante ?</p>
        {constantes.length > 0 && !creating ? (
          <select className="db-select" value={cur?.id ?? ''} onChange={(e) => setSelRef(e.target.value)}>
            {constantes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.unite ? ` (${c.unite})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <>
            <div className="sa-panel-row">
              <input
                className="db-input"
                type="text"
                placeholder="Nom (tension, température…)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <input
                className="db-input sa-unit-input"
                type="text"
                placeholder="Unité"
                value={newUnite}
                onChange={(e) => setNewUnite(e.target.value)}
              />
              <input
                className="db-input sa-unit-input"
                type="number"
                placeholder="Seuil indicatif"
                value={newSeuil}
                onChange={(e) => setNewSeuil(e.target.value)}
              />
              <button type="button" className="db-btn" onClick={create} disabled={!newLabel.trim()}>
                Créer
              </button>
            </div>
          </>
        )}
        {constantes.length > 0 && !creating && (
          <button type="button" className="sa-link" onClick={() => setCreating(true)}>
            + nouvelle constante
          </button>
        )}
        {cur && (
          <>
            <p className="sa-panel-hint">
              Valeur{cur.unite ? ` (${cur.unite})` : ''}
              {cur.seuil != null ? ` — seuil indicatif : ${cur.seuil}` : ''} :
            </p>
            <div className="sa-panel-row">
              <input
                className="db-input sa-poids-input"
                type="number"
                step="any"
                placeholder="Valeur"
                value={txt}
                onChange={(e) => setTxt(e.target.value)}
              />
              <button
                type="button"
                className="db-btn"
                disabled={!clampNum(txt, 0, 1e9)}
                onClick={() => save({ refId: cur.id, label: cur.label, value: clampNum(txt, 0, 1e9) })}
              >
                Noter
              </button>
            </div>
          </>
        )}
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  if (suivi === 'cycle') {
    return (
      <div className="sa-panel" data-panel="cycle">
        <p className="sa-panel-title">Enregistrer une période</p>
        <div className="sa-panel-row">
          <label className="sa-field">
            Premier jour
            <input className="db-input" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </label>
          <label className="sa-field">
            Dernier jour (facultatif)
            <input className="db-input" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>
        <input
          className="db-input"
          type="text"
          list="sa-flux"
          placeholder="Flux observé (léger, abondant, glaires…)"
          value={flux}
          onChange={(e) => setFlux(e.target.value)}
        />
        <datalist id="sa-flux">
          {FLUX_SUGGESTIONS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <textarea
          className="db-input sa-note-input"
          rows={2}
          placeholder="Notes sur ce cycle (facultatif)"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
        />
        <button
          type="button"
          className="db-btn sa-panel-save"
          disabled={!debut}
          onClick={() =>
            save({
              label: 'règles',
              date: `${debut}T08:00:00`,
              fin: fin ? `${fin}T22:00:00` : undefined,
              flux: flux.trim() || undefined,
              notes: txt.trim() || undefined
            })
          }
        >
          Enregistrer la période
        </button>
        <button type="button" className="sa-panel-close" onClick={onClose}>
          Annuler
        </button>
      </div>
    )
  }

  // note libre
  return (
    <div className="sa-panel" data-panel="note">
      <p className="sa-panel-title">Note du jour</p>
      <textarea
        className="db-input sa-note-input"
        rows={3}
        placeholder="Une pensée, un contexte…"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
      />
      <button
        type="button"
        className="db-btn sa-panel-save"
        disabled={!txt.trim()}
        onClick={() => save({ notes: txt.trim() })}
      >
        Enregistrer
      </button>
      <button type="button" className="sa-panel-close" onClick={onClose}>
        Annuler
      </button>
    </div>
  )
}
