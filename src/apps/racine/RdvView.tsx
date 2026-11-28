import { useEffect, useState } from 'react'
import { notify } from '../../shared/notify'
import { addEvent, fmtDay } from './events'
import { listQuestions, ordonnanceProcheFin, rdvSorted, rdvStatut, saveQuestions, validateOrdonnance, validateRdv } from './agenda'
import { saveEvent, type HealthEvent } from './store'

interface Props {
  events: HealthEvent[]
  onChanged: () => Promise<void>
}

const toTs = (v: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const t = Date.parse(`${v}T00:00:00`)
  return isFinite(t) ? t : null
}

export default function RdvView({ events, onChanged }: Props): JSX.Element {
  const [date, setDate] = useState('')
  const [heure, setHeure] = useState('')
  const [praticien, setPraticien] = useState('')
  const [lieu, setLieu] = useState('')
  const [motif, setMotif] = useState('')
  const [note, setNote] = useState('')
  const [crId, setCrId] = useState<string | null>(null)
  const [crDiag, setCrDiag] = useState('')
  const [crExam, setCrExam] = useState('')
  const [crNext, setCrNext] = useState('')
  const [oDate, setODate] = useState('')
  const [oMed, setOMed] = useState('')
  const [oContenu, setOContenu] = useState('')
  const [oRenew, setORenew] = useState(false)
  const [oFin, setOFin] = useState('')
  const [question, setQuestion] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [armedQ, setArmedQ] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void listQuestions().then((q) => {
      if (alive) setQuestions(q)
    })
    return () => {
      alive = false
    }
  }, [])

  const rdvs = rdvSorted(events)
  const ordonnances = events.filter((e) => e.type === 'ordonnance').sort((a, b) => (b.payload.date as number) - (a.payload.date as number))
  const now = Date.now()

  const addRdv = async (): Promise<void> => {
    const d = toTs(date)
    const payload = { date: d, heure, praticien, lieu, motif }
    if (validateRdv({ ...payload, date: d ?? NaN })) {
      notify(validateRdv({ ...payload, date: d ?? NaN }) ?? 'Saisie invalide')
      return
    }
    const e = await addEvent('rdv', { ...payload, date: d }, note.trim())
    if (!e) return
    setDate('')
    setHeure('')
    setPraticien('')
    setLieu('')
    setMotif('')
    setNote('')
    await onChanged()
    notify('RDV ajouté')
  }

  const saveCompteRendu = async (e: HealthEvent): Promise<void> => {
    await saveEvent({ ...e, payload: { ...e.payload, compteRendu: { diagnostic: crDiag, examens: crExam, prochaineEtape: crNext } } })
    setCrId(null)
    await onChanged()
    notify('Compte-rendu enregistré')
  }

  const addOrdonnance = async (): Promise<void> => {
    const d = toTs(oDate)
    const f = oFin ? toTs(oFin) : null
    const payload = { date: d, medecin: oMed, contenu: oContenu, renouveler: oRenew, fin: f }
    if (validateOrdonnance({ ...payload, date: d ?? NaN })) {
      notify(validateOrdonnance({ ...payload, date: d ?? NaN }) ?? 'Saisie invalide')
      return
    }
    const e = await addEvent('ordonnance', { ...payload, date: d }, '')
    if (!e) return
    setODate('')
    setOMed('')
    setOContenu('')
    setORenew(false)
    setOFin('')
    await onChanged()
    notify('Ordonnance ajoutée')
  }

  const addQuestion = async (): Promise<void> => {
    const q = question.trim()
    if (!q) return
    const next = [...questions, q]
    await saveQuestions(next)
    setQuestions(next)
    setQuestion('')
  }

  const delQuestion = async (i: number): Promise<void> => {
    const next = questions.filter((_, j) => j !== i)
    await saveQuestions(next)
    setQuestions(next)
    setArmedQ(null)
  }

  return (
    <section className="ra-view">
      <h2>RDV &amp; ordonnances</h2>
      <h3>Nouveau RDV</h3>
      <div className="ra-form-row">
        <input aria-label="Date du RDV" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input aria-label="Heure du RDV" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
        <input aria-label="Praticien" placeholder="Praticien" value={praticien} onChange={(e) => setPraticien(e.target.value)} />
        <input aria-label="Lieu" placeholder="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} />
        <input aria-label="Motif" placeholder="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
        <input aria-label="Notes du RDV" placeholder="Notes…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Ajouter le RDV" onClick={() => void addRdv()}>
          + Ajouter
        </button>
      </div>
      <ul className="ra-cycle-list">
        {rdvs.map((e) => {
          const statut = rdvStatut(e, now)
          const cr = e.payload.compteRendu as { diagnostic?: string; examens?: string; prochaineEtape?: string } | undefined
          return (
            <li key={e.id}>
              <strong>{fmtDay(e.payload.date as number)}</strong>
              {e.payload.heure ? ` à ${String(e.payload.heure)}` : ''} — {String(e.payload.praticien ?? '')}
              {e.payload.lieu ? ` (${e.payload.lieu})` : ''}
              {e.payload.motif ? ` — ${e.payload.motif}` : ''}{' '}
              <span className={`ra-badge ${statut}`}>{statut === 'a-venir' ? 'À venir' : 'Passé'}</span>
              {e.note ? ` — ${e.note}` : ''}
              {statut === 'passe' && (
                <div>
                  <button type="button" className="unvez-btn" aria-label={`Compte-rendu du RDV ${e.payload.praticien}`} onClick={() => setCrId(crId === e.id ? null : e.id)}>
                    {cr ? 'Voir le compte-rendu' : 'Ajouter un compte-rendu'}
                  </button>
                  {crId === e.id && (
                    <div className="ra-form-row">
                      <input aria-label="Diagnostic évoqué" placeholder="Diagnostic évoqué…" value={crDiag} onChange={(e) => setCrDiag(e.target.value)} />
                      <input aria-label="Examens prescrits" placeholder="Examens prescrits…" value={crExam} onChange={(e) => setCrExam(e.target.value)} />
                      <input aria-label="Prochaine étape" placeholder="Prochaine étape…" value={crNext} onChange={(e) => setCrNext(e.target.value)} />
                      <button type="button" className="db-btn primary" aria-label="Enregistrer le compte-rendu" onClick={() => void saveCompteRendu(e)}>
                        Enregistrer
                      </button>
                    </div>
                  )}
                  {cr && crId !== e.id && (
                    <p className="ra-muted">
                      {cr.diagnostic ? `Diagnostic : ${cr.diagnostic}. ` : ''}
                      {cr.examens ? `Examens : ${cr.examens}. ` : ''}
                      {cr.prochaineEtape ? `Prochaine étape : ${cr.prochaineEtape}.` : ''}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
        {rdvs.length === 0 && <li className="ra-muted">Aucun RDV.</li>}
      </ul>

      <h3>Ordonnances</h3>
      <div className="ra-form-row">
        <input aria-label="Date de l’ordonnance" type="date" value={oDate} onChange={(e) => setODate(e.target.value)} />
        <input aria-label="Médecin" placeholder="Médecin" value={oMed} onChange={(e) => setOMed(e.target.value)} />
        <input aria-label="Contenu de l’ordonnance" placeholder="Contenus/médicaments…" value={oContenu} onChange={(e) => setOContenu(e.target.value)} />
        <label className="ra-check">
          <input type="checkbox" aria-label="À renouveler" checked={oRenew} onChange={(e) => setORenew(e.target.checked)} />
          <span>À renouveler</span>
        </label>
        <input aria-label="Date de fin (si connue)" type="date" value={oFin} onChange={(e) => setOFin(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Ajouter l’ordonnance" onClick={() => void addOrdonnance()}>
          + Ajouter
        </button>
      </div>
      <ul className="ra-cycle-list">
        {ordonnances.map((e) => (
          <li key={e.id}>
            <strong>{fmtDay(e.payload.date as number)}</strong> — {String(e.payload.medecin ?? '')} : {String(e.payload.contenu ?? '').slice(0, 80)}
            {e.payload.renouveler === true && (
              <span className={`ra-badge ${ordonnanceProcheFin(e, now) ? 'a-venir' : ''}`}> {ordonnanceProcheFin(e, now) ? 'À renouveler — termine bientôt' : 'À renouveler'}</span>
            )}
            {typeof e.payload.fin === 'number' ? ` — fin le ${fmtDay(e.payload.fin)}` : ''}
          </li>
        ))}
        {ordonnances.length === 0 && <li className="ra-muted">Aucune ordonnance.</li>}
      </ul>

      <h3>Questions à poser au prochain RDV</h3>
      <div className="ra-form-row">
        <input aria-label="Nouvelle question à poser" placeholder="ex. et si le traitement ne marche pas ?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Ajouter la question" onClick={() => void addQuestion()}>
          + Ajouter
        </button>
        {questions.length > 0 && (
          <button type="button" className="unvez-btn" aria-label="Archiver les questions" onClick={() => void (async () => { await saveQuestions([]); setQuestions([]) })()}>
            Archiver
          </button>
        )}
      </div>
      <ul className="ra-cycle-list">
        {questions.map((q, i) => (
          <li key={i}>
            {q}{' '}
            <button
              type="button"
              className={`unvez-btn${armedQ === i ? ' danger armed' : ''}`}
              aria-label={`Supprimer la question ${i + 1}`}
              onClick={() => (armedQ === i ? void delQuestion(i) : setArmedQ(i))}
            >
              {armedQ === i ? 'Confirmer ?' : '✕'}
            </button>
          </li>
        ))}
        {questions.length === 0 && <li className="ra-muted">Aucune question en préparation.</li>}
      </ul>
    </section>
  )
}
