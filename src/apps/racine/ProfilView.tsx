import { useEffect, useRef, useState } from 'react'
import { notify } from '../../shared/notify'
import { fmtDay } from './events'
import { addAttachment, attachmentUrl, fmtSize, quotaWarning } from './profil'
import { deleteAttachment, listAttachments, saveAttachment, saveProfile, type Attachment, type HealthEvent, type Profile } from './store'

interface Props {
  profile: Profile
  events: HealthEvent[]
  onChanged: () => Promise<void>
}

const FIELDS: [keyof Omit<Profile, 'id' | 'updatedAt'>, string][] = [
  ['antecedents', 'Antécédents'],
  ['maladies', 'Maladies diagnostiquées'],
  ['allergies', 'Allergies'],
  ['groupeSanguin', 'Groupe sanguin'],
  ['traitementsCours', 'Traitements en cours'],
  ['vaccinations', 'Vaccinations (carnet)'],
  ['antecedentsFamiliaux', 'Antécédents familiaux'],
  ['contactUrgence', 'Personne à contacter']
]

export default function ProfilView({ profile, events, onChanged }: Props): JSX.Element {
  const [form, setForm] = useState<Profile>(profile)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [quota, setQuota] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reloadAttachments = async (): Promise<void> => {
    setAttachments(await listAttachments())
    setQuota(await quotaWarning())
  }

  useEffect(() => {
    void reloadAttachments()
  }, [])

  const rattachables = events.filter((e) => e.type === 'rdv' || e.type === 'ordonnance')

  const save = async (): Promise<void> => {
    await saveProfile(form)
    await onChanged()
    notify('Profil santé enregistré')
  }

  const onFile = async (f: File): Promise<void> => {
    const r = await addAttachment(f, null)
    if (!r.ok) {
      notify(r.error)
      return
    }
    await reloadAttachments()
    await onChanged()
    notify(`Pièce jointe « ${f.name} » ajoutée (${fmtSize(r.a.size)})`)
  }

  const setEventId = async (a: Attachment, eventId: string): Promise<void> => {
    await saveAttachment({ ...a, eventId: eventId || null })
    await reloadAttachments()
  }

  const remove = async (a: Attachment): Promise<void> => {
    await deleteAttachment(a.id)
    setArmed(null)
    await reloadAttachments()
    notify(`Pièce jointe « ${a.name} » supprimée`)
  }

  return (
    <section className="ra-view">
      <h2>Profil santé</h2>
      <p className="ra-muted">Dossier personnel, 100 % local, modifiable à tout moment. Sert notamment à la carte d’urgence.</p>
      <div className="ra-profile-form">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="ra-profile-field">
            <span>{label}</span>
            <textarea rows={2} aria-label={label} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
        <button type="button" className="db-btn primary" aria-label="Enregistrer le profil" onClick={() => void save()}>
          Enregistrer le profil
        </button>
      </div>

      <h3>Pièces jointes</h3>
      {quota && <p className="ra-cooc">{quota}</p>}
      <div className="ra-form-row">
        <button type="button" className="db-btn" aria-label="Ajouter une pièce jointe" onClick={() => fileRef.current?.click()}>
          📎 Ajouter une pièce jointe (PDF, image — max 8 Mo)
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          aria-label="Fichier de pièce jointe"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
      </div>
      <ul className="ra-cycle-list">
        {attachments.map((a) => {
          const url = attachmentUrl(a)
          const lie = rattachables.find((e) => e.id === a.eventId)
          return (
            <li key={a.id}>
              {url ? (
                <a href={url} download={a.name} aria-label={`Télécharger ${a.name}`}>
                  {a.name}
                </a>
              ) : (
                a.name
              )}{' '}
              — {fmtSize(a.size)} — {fmtDay(a.createdAt)}
              {lie ? ` — rattachée à : ${lie.type === 'rdv' ? 'RDV' : 'ordonnance'} « ${String(lie.payload.praticien ?? lie.payload.medecin ?? '')} »` : ''}
              <select aria-label={`Rattacher ${a.name} à`} value={a.eventId ?? ''} onChange={(e) => void setEventId(a, e.target.value)}>
                <option value="">Non rattachée</option>
                {rattachables.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.type === 'rdv' ? `RDV ${String(e.payload.praticien ?? '')} (${fmtDay(e.payload.date as number)})` : `Ordonnance ${String(e.payload.medecin ?? '')} (${fmtDay(e.payload.date as number)})`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`unvez-btn${armed === a.id ? ' danger armed' : ''}`}
                aria-label={`Supprimer la pièce jointe ${a.name}`}
                onClick={() => (armed === a.id ? void remove(a) : setArmed(a.id))}
              >
                {armed === a.id ? 'Confirmer la suppression ?' : 'Supprimer'}
              </button>
            </li>
          )
        })}
        {attachments.length === 0 && <li className="ra-muted">Aucune pièce jointe.</li>}
      </ul>
    </section>
  )
}
