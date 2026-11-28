import { useState } from 'react'
import { uid } from '../../shared/db'
import {
  addDays,
  bandeauAccueil,
  dayOf,
  echeancesPreventives,
  fmtDay,
  makeEvent,
  rdvTries,
  sortEventsDesc,
  timeOf,
  todayDay,
  toLocalISO,
  type RefItem,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs
} from './logic'

interface CommonProps {
  events: SalvetoEvent[]
  refs: SalvetoRefs
  config: SalvetoConfig
  onSaveEvent: (e: SalvetoEvent) => void
  onUpdateEvent: (e: SalvetoEvent) => void
  onUpsertRef: (r: RefItem) => void
  onSaveConfig: (c: SalvetoConfig) => void
}

export function RdvView({ events, config, onSaveEvent, onUpdateEvent, onSaveConfig }: CommonProps) {
  const [date, setDate] = useState(todayDay())
  const [heure, setHeure] = useState('')
  const [praticien, setPraticien] = useState('')
  const [lieu, setLieu] = useState('')
  const [motif, setMotif] = useState('')
  const [notes, setNotes] = useState('')
  const [qTxt, setQTxt] = useState('')
  const [crOpen, setCrOpen] = useState<string | null>(null)
  const [crDiag, setCrDiag] = useState('')
  const [crExamens, setCrExamens] = useState('')
  const [crProchaine, setCrProchaine] = useState('')

  const { aVenir, passes } = rdvTries(events)
  const questions = config.questionsRdv ?? []

  const ajouter = (): void => {
    if (!praticien.trim()) return
    onSaveEvent(
      makeEvent('rdv', {
        date: `${date}T${heure || '00:00'}:00`,
        label: praticien.trim(),
        lieu: lieu.trim() || undefined,
        motif: motif.trim() || undefined,
        notes: notes.trim() || undefined,
        statut: 'a-venir'
      })
    )
    setPraticien('')
    setLieu('')
    setMotif('')
    setNotes('')
  }

  const addQuestion = (): void => {
    const t = qTxt.trim()
    if (!t) return
    onSaveConfig({ ...config, questionsRdv: [...questions, t] })
    setQTxt('')
  }

  const row = (e: SalvetoEvent, passe: boolean) => (
    <li key={e.id} className="sa-med-row" data-rdv={e.id}>
      <span>
        <strong>{fmtDay(dayOf(e.date))}</strong> à {timeOf(e.date)} — <strong>{e.label ?? 'RDV'}</strong>
        {e.lieu ? ` · ${e.lieu}` : ''}
        {e.motif ? ` · ${e.motif}` : ''}
        {e.notes ? ` · ${e.notes}` : ''}
        {passe && (e.crDiag || e.crExamens || e.crProchaine) ? (
          <span className="sa-muted">
            {' '}
            — compte-rendu : {[e.crDiag, e.crExamens, e.crProchaine].filter(Boolean).join(' / ')}
          </span>
        ) : null}
      </span>
      {passe && (
        <button
          type="button"
          className="sa-link"
          onClick={() => {
            setCrOpen(crOpen === e.id ? null : e.id)
            setCrDiag(e.crDiag ?? '')
            setCrExamens(e.crExamens ?? '')
            setCrProchaine(e.crProchaine ?? '')
          }}
        >
          {crOpen === e.id ? 'Fermer' : 'Compte-rendu'}
        </button>
      )}
      {passe && crOpen === e.id && (
        <div className="sa-cr">
          <input
            className="db-input"
            type="text"
            placeholder="Diagnostic évoqué"
            value={crDiag}
            onChange={(ev) => setCrDiag(ev.target.value)}
          />
          <input
            className="db-input"
            type="text"
            placeholder="Examens prescrits"
            value={crExamens}
            onChange={(ev) => setCrExamens(ev.target.value)}
          />
          <input
            className="db-input"
            type="text"
            placeholder="Prochaine étape"
            value={crProchaine}
            onChange={(ev) => setCrProchaine(ev.target.value)}
          />
          <button
            type="button"
            className="db-btn"
            onClick={() => {
              onUpdateEvent({ ...e, crDiag: crDiag.trim() || undefined, crExamens: crExamens.trim() || undefined, crProchaine: crProchaine.trim() || undefined })
              setCrOpen(null)
            }}
          >
            Enregistrer le compte-rendu
          </button>
        </div>
      )}
    </li>
  )

  return (
    <>
      <h1 className="sa-h1">Rendez-vous médicaux</h1>
      <section className="sa-panel">
        <p className="sa-panel-title">Nouveau RDV</p>
        <div className="sa-panel-row">
          <label className="sa-field">
            Date
            <input className="db-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="sa-field">
            Heure
            <input className="db-input" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
          </label>
          <input
            className="db-input"
            type="text"
            placeholder="Praticien"
            value={praticien}
            onChange={(e) => setPraticien(e.target.value)}
          />
        </div>
        <div className="sa-panel-row">
          <input
            className="db-input"
            type="text"
            placeholder="Lieu"
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
          />
          <input
            className="db-input"
            type="text"
            placeholder="Motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </div>
        <textarea
          className="db-input sa-note-input"
          rows={2}
          placeholder="Notes (facultatif)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="button" className="db-btn sa-panel-save" disabled={!praticien.trim() || !date} onClick={ajouter}>
          Ajouter le RDV
        </button>
      </section>

      <section>
        <h2 className="sa-h2">Questions à poser au prochain RDV</h2>
        <div className="sa-panel-row">
          <input
            className="db-input"
            type="text"
            placeholder="Ajouter une question…"
            value={qTxt}
            onChange={(e) => setQTxt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addQuestion()
              }
            }}
          />
          <button type="button" className="db-btn" onClick={addQuestion} disabled={!qTxt.trim()}>
            +
          </button>
          {questions.length > 0 && (
            <button type="button" className="sa-link" onClick={() => onSaveConfig({ ...config, questionsRdv: [] })}>
              Tout archiver (après le RDV)
            </button>
          )}
        </div>
        {questions.length > 0 && (
          <div className="sa-chips">
            {questions.map((q, i) => (
              <button
                key={`${q}-${i}`}
                type="button"
                className="sa-chip sa-chip-btn"
                title="Retirer"
                onClick={() => onSaveConfig({ ...config, questionsRdv: questions.filter((_, j) => j !== i) })}
              >
                {q} ×
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="sa-h2">À venir ({aVenir.length})</h2>
        {aVenir.length === 0 ? (
          <p className="sa-empty">Aucun RDV à venir.</p>
        ) : (
          <ul className="sa-cooc-list">{aVenir.map((e) => row(e, false))}</ul>
        )}
      </section>
      <section>
        <h2 className="sa-h2">Passés ({passes.length}) — historique conservé</h2>
        {passes.length === 0 ? (
          <p className="sa-empty">Aucun RDV passé.</p>
        ) : (
          <ul className="sa-cooc-list">{passes.map((e) => row(e, true))}</ul>
        )}
      </section>
    </>
  )
}

export function OrdonnancesView({ events, onSaveEvent }: CommonProps) {
  const [date, setDate] = useState(todayDay())
  const [medecin, setMedecin] = useState('')
  const [contenu, setContenu] = useState('')
  const [renouveler, setRenouveler] = useState(false)
  const [fin, setFin] = useState('')

  const ajouter = (): void => {
    if (!contenu.trim()) return
    onSaveEvent(
      makeEvent('ordonnance', {
        date: `${date}T09:00:00`,
        medecin: medecin.trim() || undefined,
        contenu: contenu.trim(),
        aRenouveler: renouveler || undefined,
        fin: fin ? `${fin}T23:00:00` : undefined,
        label: medecin.trim() || 'ordonnance'
      })
    )
    setMedecin('')
    setContenu('')
    setRenouveler(false)
    setFin('')
  }

  const today = todayDay()
  const liste = sortEventsDesc(events.filter((e) => e.type === 'ordonnance'))

  return (
    <>
      <h1 className="sa-h1">Ordonnances</h1>
      <p className="sa-cooc-note">Notes de référence uniquement — pas un outil de prise de médicaments.</p>
      <section className="sa-panel">
        <p className="sa-panel-title">Nouvelle ordonnance</p>
        <div className="sa-panel-row">
          <label className="sa-field">
            Date
            <input className="db-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <input
            className="db-input"
            type="text"
            placeholder="Médecin"
            value={medecin}
            onChange={(e) => setMedecin(e.target.value)}
          />
          <label className="sa-field">
            Date de fin (facultative)
            <input className="db-input" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
          <label className="sa-field sa-check">
            <input type="checkbox" checked={renouveler} onChange={(e) => setRenouveler(e.target.checked)} /> À renouveler
          </label>
        </div>
        <textarea
          className="db-input sa-note-input"
          rows={3}
          placeholder="Contenu / médicaments…"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
        />
        <button type="button" className="db-btn sa-panel-save" disabled={!contenu.trim() || !date} onClick={ajouter}>
          Ajouter l’ordonnance
        </button>
      </section>
      <section>
        <h2 className="sa-h2">Liste ({liste.length})</h2>
        {liste.length === 0 ? (
          <p className="sa-empty">Aucune ordonnance.</p>
        ) : (
          <ul className="sa-cooc-list">
            {liste.map((o) => {
              const finJ = o.fin ? diffDaysSafe(today, dayOf(o.fin)) : undefined
              return (
                <li key={o.id} className="sa-med-row" data-ordonnance={o.id}>
                  <span>
                    <strong>{fmtDay(dayOf(o.date))}</strong>
                    {o.medecin ? ` — Dr ${o.medecin}` : ''} — {o.contenu}
                  </span>
                  <span className="sa-badges">
                    {o.aRenouveler && <em className="sa-badge sa-badge-renouveler">à renouveler</em>}
                    {o.fin && <em className="sa-badge">fin le {fmtDay(dayOf(o.fin))}</em>}
                    {finJ != null && finJ >= 0 && finJ <= 14 && !o.aRenouveler && (
                      <em className="sa-badge sa-badge-proche">se termine dans {finJ} j</em>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function diffDaysSafe(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export function PreventifView({ refs, onUpsertRef }: CommonProps) {
  const [label, setLabel] = useState('')
  const [periodicite, setPeriodicite] = useState('')
  const [derniere, setDerniere] = useState('')

  const ajouter = (): void => {
    if (!label.trim()) return
    const p = Number(periodicite)
    onUpsertRef({
      id: uid(),
      kind: 'preventif',
      label: label.trim(),
      periodiciteJours: Number.isFinite(p) && p > 0 ? Math.round(p) : undefined,
      derniereVisite: derniere || undefined,
      createdAt: toLocalISO(new Date())
    })
    setLabel('')
    setPeriodicite('')
    setDerniere('')
  }

  const echeances = echeancesPreventives(refs)
  const tous = refs.items.filter((r) => r.kind === 'preventif')

  return (
    <>
      <h1 className="sa-h1">Échéancier préventif</h1>
      <section className="sa-panel">
        <p className="sa-panel-title">Ajouter un examen de routine</p>
        <div className="sa-panel-row">
          <input
            className="db-input"
            type="text"
            placeholder="Type d’examen (dentiste, ophtalmo, bilan…)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="db-input sa-unit-input"
            type="number"
            placeholder="Périodicité (jours)"
            value={periodicite}
            onChange={(e) => setPeriodicite(e.target.value)}
          />
          <label className="sa-field">
            Dernière visite
            <input className="db-input" type="date" value={derniere} onChange={(e) => setDerniere(e.target.value)} />
          </label>
          <button type="button" className="db-btn" disabled={!label.trim()} onClick={ajouter}>
            Ajouter
          </button>
        </div>
      </section>
      <section>
        <h2 className="sa-h2">Échéances ({echeances.length})</h2>
        {tous.length === 0 ? (
          <p className="sa-empty">Aucun examen de routine enregistré.</p>
        ) : (
          <ul className="sa-cooc-list">
            {tous.map((r) => {
              const e = echeances.find((x) => x.ref.id === r.id)
              return (
                <li key={r.id} className="sa-med-row" data-preventif={r.id}>
                  <span>
                    <strong>{r.label}</strong>
                    {r.periodiciteJours ? ` — tous les ${r.periodiciteJours} j` : ''}
                    {r.derniereVisite ? ` — dernière visite le ${fmtDay(r.derniereVisite)}` : ''}
                    {e ? ` — prochaine échéance le ${fmtDay(e.prochaine)}` : ''}
                  </span>
                  {e && (e.enRetard || e.dansJours <= 7) && (
                    <em className={`sa-badge ${e.enRetard ? 'sa-badge-retard' : 'sa-badge-proche'}`}>
                      {e.enRetard ? 'échéance dépassée' : `dans ${e.dansJours} j`}
                    </em>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

export { bandeauAccueil, addDays }
