import { useState } from 'react'
import { notify } from '../../shared/notify'
import { uid } from '../../shared/db'
import { fmtDay } from './events'
import { preventifEcheance } from './agenda'
import { deleteRef, saveRef, type RefEntity } from './store'

interface Props {
  refs: RefEntity[]
  onChanged: () => Promise<void>
}

const toTs = (v: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const t = Date.parse(`${v}T00:00:00`)
  return isFinite(t) ? t : null
}

export default function PreventifView({ refs, onChanged }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [period, setPeriod] = useState('')
  const [last, setLast] = useState('')
  const [armed, setArmed] = useState<string | null>(null)
  const items = refs.filter((r) => r.kind === 'preventif')
  const now = Date.now()

  const add = async (): Promise<void> => {
    const n = name.trim()
    const per = Number(period)
    const l = toTs(last)
    if (!n || !isFinite(per) || per <= 0 || !l) {
      notify('Nom, périodicité (jours) et date de dernière visite requis')
      return
    }
    await saveRef({ id: uid(), kind: 'preventif', name: n, unit: '', threshold: null, periodicityDays: per, lastDate: l, active: true, createdAt: Date.now() })
    setName('')
    setPeriod('')
    setLast('')
    await onChanged()
    notify(`Examen « ${n} » ajouté`)
  }

  const remove = async (r: RefEntity): Promise<void> => {
    await deleteRef(r.id)
    setArmed(null)
    await onChanged()
  }

  return (
    <section className="ra-view">
      <h2>Préventif</h2>
      <p className="ra-muted">Examens de routine : type, périodicité conseillée, date de dernière visite. L’échéance proche apparaît dans le bandeau d’accueil (rappel passif uniquement).</p>
      <div className="ra-form-row">
        <input aria-label="Nouvel examen préventif" placeholder="ex. dentiste, bilan sanguin…" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Périodicité (jours)" type="number" min={1} placeholder="jours" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <input aria-label="Date de dernière visite" type="date" value={last} onChange={(e) => setLast(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Ajouter l’examen préventif" onClick={() => void add()}>
          + Ajouter
        </button>
      </div>
      <ul className="ra-ref-list">
        {items.map((r) => {
          const ech = preventifEcheance(r, now)
          return (
            <li key={r.id} className="ra-ref-item">
              <div className="ra-ref-head">
                <strong>{r.name}</strong>
                <button
                  type="button"
                  className={`unvez-btn${armed === r.id ? ' danger armed' : ''}`}
                  aria-label={`Supprimer l’examen ${r.name}`}
                  onClick={() => (armed === r.id ? void remove(r) : setArmed(r.id))}
                >
                  {armed === r.id ? 'Confirmer la suppression ?' : 'Supprimer'}
                </button>
              </div>
              <span className="ra-muted">
                tous les {r.periodicityDays} j — dernière visite le {r.lastDate ? fmtDay(r.lastDate) : '?'}
              </span>
              {ech && (
                <span className={`ra-badge ${ech.overdue ? 'passe' : ech.dueSoon ? 'a-venir' : ''}`}>
                  {' '}
                  {ech.overdue ? `Échu depuis le ${fmtDay(ech.next)}` : ech.dueSoon ? `À prévoir avant le ${fmtDay(ech.next)}` : `Prochaine échéance le ${fmtDay(ech.next)}`}
                </span>
              )}
            </li>
          )
        })}
        {items.length === 0 && <li className="ra-muted">Aucun examen de routine suivi.</li>}
      </ul>
    </section>
  )
}
