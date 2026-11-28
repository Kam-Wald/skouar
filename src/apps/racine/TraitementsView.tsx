import { useState } from 'react'
import { notify } from '../../shared/notify'
import { uid } from '../../shared/db'
import { addEvent } from './events'
import { EFFETS, EFFET_LABELS, efficaciteStats, fmtCounts, fmtScore } from './traitement'
import { deleteRef, saveRef, type HealthEvent, type RefEntity } from './store'

interface Props {
  events: HealthEvent[]
  refs: RefEntity[]
  onChanged: () => Promise<void>
}

export default function TraitementsView({ events, refs, onChanged }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [armed, setArmed] = useState<string | null>(null)
  const traitements = refs.filter((r) => r.kind === 'traitement')
  const stats = efficaciteStats(events, refs)

  const addTraitement = async (): Promise<void> => {
    const n = name.trim()
    if (!n) {
      notify('Nom du traitement requis')
      return
    }
    if (traitements.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      notify('Ce traitement existe déjà')
      return
    }
    await saveRef({ id: uid(), kind: 'traitement', name: n, unit: '', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: Date.now() })
    setName('')
    await onChanged()
    notify(`Traitement « ${n} » ajouté`)
  }

  const effet = async (r: RefEntity, effet: string): Promise<void> => {
    const e = await addEvent('traitement', { refId: r.id, name: r.name, effet }, '')
    if (!e) {
      notify('Saisie invalide')
      return
    }
    await onChanged()
    notify(`Effet « ${EFFET_LABELS[effet as keyof typeof EFFET_LABELS]} » noté pour « ${r.name} »`)
  }

  const remove = async (r: RefEntity): Promise<void> => {
    await deleteRef(r.id)
    setArmed(null)
    await onChanged()
    notify(`Traitement « ${r.name} » supprimé — ses retours sont conservés`)
  }

  return (
    <section className="ra-view">
      <h2>Traitements</h2>
      <p className="ra-muted">Traitements, suppléments et activités supposés aider. Note l’effet ressenti à chaque prise — observation passive, aucun conseil (cf. CDC §5.C).</p>
      <div className="ra-form-row">
        <input aria-label="Nouveau traitement" placeholder="ex. magnésium, tisane, sport…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Ajouter le traitement" onClick={() => void addTraitement()}>
          + Ajouter
        </button>
      </div>
      <ul className="ra-ref-list">
        {traitements.map((r) => (
          <li key={r.id} className="ra-ref-item">
            <div className="ra-ref-head">
              <strong>{r.name}</strong>
              <button
                type="button"
                className={`unvez-btn${armed === r.id ? ' danger armed' : ''}`}
                aria-label={`Supprimer le traitement ${r.name}`}
                onClick={() => (armed === r.id ? void remove(r) : setArmed(r.id))}
              >
                {armed === r.id ? 'Confirmer la suppression ?' : 'Supprimer'}
              </button>
            </div>
            <div className="ra-levels">
              {EFFETS.map((e) => (
                <button key={e} type="button" className="ra-level-btn" aria-label={`Effet ${EFFET_LABELS[e]} pour ${r.name}`} onClick={() => void effet(r, e)}>
                  {EFFET_LABELS[e]}
                </button>
              ))}
            </div>
          </li>
        ))}
        {traitements.length === 0 && <li className="ra-muted">Aucun traitement suivi pour l’instant.</li>}
      </ul>
      <h3>Ce qui me fait du bien</h3>
      <p className="ra-muted">Classé selon tes retours uniquement — aucun conseil, aucune alerte (CDC §5.B/5.C).</p>
      <ol className="ra-ranking">
        {stats.map((s) => (
          <li key={s.refId}>
            <strong>{s.name}</strong> — score {fmtScore(s.score)} ({fmtCounts(s.counts)})
          </li>
        ))}
        {stats.length === 0 && <li className="ra-muted">Aucun retour d’efficacité pour l’instant.</li>}
      </ol>
    </section>
  )
}
