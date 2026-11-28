import { useState } from 'react'
import { HABITUDE_SUGGESTIONS, MORAL_LABELS, clampInt, clampNum, makeEvent, type SalvetoEvent, type SuiviId } from './logic'

interface Props {
  suivi: SuiviId
  onSave: (e: SalvetoEvent) => void
  onClose: () => void
}

export default function QuickSaisie({ suivi, onSave, onClose }: Props) {
  const [txt, setTxt] = useState('')
  const [coucher, setCoucher] = useState('')
  const [reveil, setReveil] = useState('')
  const [duree, setDuree] = useState('')
  const [intensite, setIntensite] = useState<number | undefined>()

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
        <input
          className="db-input"
          type="text"
          placeholder="Localisation (ex. tête, ventre)…"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
        />
        <button
          type="button"
          className="db-btn sa-panel-save"
          disabled={!intensite}
          onClick={() => save({ value: intensite, label: txt.trim() || undefined })}
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
