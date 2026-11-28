import { useState } from 'react'
import { uid } from '../../shared/db'
import { notify } from '../../shared/notify'
import {
  GROUPES_SANGUINS,
  PJ_MAX_SIZE,
  dayOf,
  fileToDataUrl,
  fmtDay,
  fmtSize,
  todayDay,
  toLocalISO,
  type Attachment,
  type ProfilSante,
  type SalvetoEvent,
  type Vaccin
} from './logic'

interface Props {
  profil: ProfilSante
  events: SalvetoEvent[]
  attachments: Attachment[]
  onSaveProfil: (p: ProfilSante) => void
  onSaveAttachment: (a: Attachment) => void
  onDeleteAttachment: (id: string) => void
  onAttach: (id: string, refId: string, refType: 'rdv' | 'ordonnance' | 'profil') => void
}

export function ProfilView({ profil, events, attachments, onSaveProfil, onSaveAttachment, onDeleteAttachment, onAttach }: Props) {
  const [draft, setDraft] = useState<ProfilSante>(profil)
  const [allergieTxt, setAllergieTxt] = useState('')
  const [vLabel, setVLabel] = useState('')
  const [vDate, setVDate] = useState(todayDay())
  const [vRappel, setVRappel] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const set = (patch: Partial<ProfilSante>): void => setDraft((d) => ({ ...d, ...patch }))

  const addAllergie = (): void => {
    const t = allergieTxt.trim()
    if (!t || draft.allergies.includes(t)) return
    set({ allergies: [...draft.allergies, t] })
    setAllergieTxt('')
  }

  const addVaccin = (): void => {
    if (!vLabel.trim()) return
    const v: Vaccin = {
      id: uid(),
      label: vLabel.trim(),
      date: vDate,
      rappel: vRappel || undefined
    }
    set({ vaccinations: [...draft.vaccinations, v] })
    setVLabel('')
    setVRappel('')
  }

  const onFiles = async (files: FileList | null): Promise<void> => {
    if (!files) return
    for (const f of Array.from(files)) {
      if (f.size > PJ_MAX_SIZE) {
        notify(`« ${f.name} » trop lourd (${fmtSize(f.size)}) — max ${fmtSize(PJ_MAX_SIZE)}. Exporte sans pièces jointes ou compresse.`)
        continue
      }
      const dataUrl = await fileToDataUrl(f)
      onSaveAttachment({
        id: uid(),
        name: f.name,
        mime: f.type || 'application/octet-stream',
        size: f.size,
        dataUrl,
        refType: 'profil',
        createdAt: toLocalISO(new Date())
      })
      notify(`Pièce jointe « ${f.name} » enregistrée (${fmtSize(f.size)})`)
    }
  }

  const rdvs = events.filter((e) => e.type === 'rdv')
  const ords = events.filter((e) => e.type === 'ordonnance')

  return (
    <>
      <h1 className="sa-h1">Profil santé</h1>
      <p className="sa-cooc-note">Dossier personnel, 100 % local — modifiable à tout moment.</p>
      <section className="sa-panel sa-profil-form">
        <div className="sa-panel-row">
          <label className="sa-field">
            Groupe sanguin
            <select className="db-select" value={draft.groupeSanguin ?? ''} onChange={(e) => set({ groupeSanguin: e.target.value || undefined })}>
              <option value="">—</option>
              {GROUPES_SANGUINS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <input
            className="db-input"
            type="text"
            placeholder="Contact d’urgence (nom)"
            value={draft.contactNom ?? ''}
            onChange={(e) => set({ contactNom: e.target.value || undefined })}
          />
          <input
            className="db-input"
            type="text"
            placeholder="Téléphone"
            value={draft.contactTel ?? ''}
            onChange={(e) => set({ contactTel: e.target.value || undefined })}
          />
        </div>
        <label className="sa-field">
          Allergies
          <div className="sa-panel-row">
            <input
              className="db-input"
              type="text"
              placeholder="Ajouter une allergie…"
              value={allergieTxt}
              onChange={(e) => setAllergieTxt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAllergie()
                }
              }}
            />
            <button type="button" className="db-btn" onClick={addAllergie} disabled={!allergieTxt.trim()}>
              +
            </button>
          </div>
        </label>
        {draft.allergies.length > 0 && (
          <div className="sa-chips">
            {draft.allergies.map((a) => (
              <button
                key={a}
                type="button"
                className="sa-chip sa-chip-btn"
                title="Retirer"
                onClick={() => set({ allergies: draft.allergies.filter((x) => x !== a) })}
              >
                {a} ×
              </button>
            ))}
          </div>
        )}
        <label className="sa-field">
          Maladies diagnostiquées
          <textarea className="db-input sa-note-input" rows={2} value={draft.maladies} onChange={(e) => set({ maladies: e.target.value })} />
        </label>
        <label className="sa-field">
          Antécédents
          <textarea className="db-input sa-note-input" rows={2} value={draft.antecedents} onChange={(e) => set({ antecedents: e.target.value })} />
        </label>
        <label className="sa-field">
          Traitements en cours
          <textarea className="db-input sa-note-input" rows={2} value={draft.traitementsEnCours} onChange={(e) => set({ traitementsEnCours: e.target.value })} />
        </label>
        <label className="sa-field">
          Antécédents familiaux
          <textarea className="db-input sa-note-input" rows={2} value={draft.antecedentsFamiliaux} onChange={(e) => set({ antecedentsFamiliaux: e.target.value })} />
        </label>
        <button type="button" className="db-btn sa-panel-save" onClick={() => onSaveProfil(draft)}>
          Enregistrer le profil
        </button>
      </section>

      <section>
        <h2 className="sa-h2">Carnet de vaccination</h2>
        <div className="sa-panel">
          <div className="sa-panel-row">
            <input className="db-input" type="text" placeholder="Vaccin" value={vLabel} onChange={(e) => setVLabel(e.target.value)} />
            <label className="sa-field">
              Date
              <input className="db-input" type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} />
            </label>
            <label className="sa-field">
              Rappel (facultatif)
              <input className="db-input" type="date" value={vRappel} onChange={(e) => setVRappel(e.target.value)} />
            </label>
            <button type="button" className="db-btn" onClick={addVaccin} disabled={!vLabel.trim() || !vDate}>
              Ajouter
            </button>
          </div>
        </div>
        {draft.vaccinations.length > 0 && (
          <ul className="sa-cooc-list">
            {draft.vaccinations.map((v) => (
              <li key={v.id} className="sa-med-row">
                <span>
                  <strong>{v.label}</strong> — {fmtDay(v.date)}
                  {v.rappel ? ` · rappel prévu le ${fmtDay(v.rappel)}` : ''}
                </span>
                <button
                  type="button"
                  className="sa-link"
                  onClick={() => set({ vaccinations: draft.vaccinations.filter((x) => x.id !== v.id) })}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="sa-h2">Pièces jointes ({attachments.length}) — stockage local uniquement</h2>
        <label className="db-btn sa-file-btn">
          ⬆ Importer un document (PDF, image…)
          <input
            type="file"
            hidden
            multiple
            accept="application/pdf,image/*"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
        {attachments.length === 0 ? (
          <p className="sa-empty">Aucune pièce jointe.</p>
        ) : (
          <ul className="sa-cooc-list">
            {attachments.map((a) => (
              <li key={a.id} className="sa-med-row sa-pj-row" data-pj={a.id}>
                <span>
                  <a href={a.dataUrl} download={a.name}>
                    {a.name}
                  </a>{' '}
                  <span className="sa-muted">
                    ({a.mime.split('/')[1] ?? a.mime}, {fmtSize(a.size)}, {fmtDay(dayOf(a.createdAt))})
                  </span>
                </span>
                <span className="sa-panel-row">
                  <select
                    className="db-select"
                    value={a.refType === 'profil' || !a.refId ? 'profil' : `${a.refType}:${a.refId}`}
                    onChange={(e) => {
                      const [rt, rid] = e.target.value.split(':')
                      onAttach(a.id, rid || '', (rt as 'rdv' | 'ordonnance' | 'profil') || 'profil')
                    }}
                  >
                    <option value="profil">Profil santé</option>
                    {rdvs.map((r) => (
                      <option key={r.id} value={`rdv:${r.id}`}>
                        RDV {r.label ?? ''} du {fmtDay(dayOf(r.date))}
                      </option>
                    ))}
                    {ords.map((o) => (
                      <option key={o.id} value={`ordonnance:${o.id}`}>
                        Ordonnance{o.medecin ? ` de ${o.medecin}` : ''} du {fmtDay(dayOf(o.date))}
                      </option>
                    ))}
                  </select>
                  {confirmDel === a.id ? (
                    <button type="button" className="db-btn sa-badge-retard" onClick={() => { onDeleteAttachment(a.id); setConfirmDel(null) }}>
                      Confirmer la suppression ?
                    </button>
                  ) : (
                    <button type="button" className="sa-link" onClick={() => setConfirmDel(a.id)}>
                      Supprimer
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export function UrgenceView({ profil }: { profil: ProfilSante }) {
  return (
    <div className="sa-urgence">
      <div className="sa-urgence-card">
        <h1 className="sa-h1">🚨 Carte d’urgence</h1>
        <p className="sa-cooc-note">
          À montrer en cas d’urgence. Aucune diffusion automatique — Salveto reste 100 % local.
        </p>
        <dl className="sa-urgence-dl">
          <dt>Allergies</dt>
          <dd data-urgence="allergies">{profil.allergies.length ? profil.allergies.join(', ') : '—'}</dd>
          <dt>Groupe sanguin</dt>
          <dd data-urgence="groupe">{profil.groupeSanguin ?? '—'}</dd>
          <dt>Traitements en cours</dt>
          <dd data-urgence="traitements">{profil.traitementsEnCours || '—'}</dd>
          <dt>Maladies / antécédents</dt>
          <dd>{[profil.maladies, profil.antecedents].filter(Boolean).join(' ; ') || '—'}</dd>
          <dt>Contact d’urgence</dt>
          <dd data-urgence="contact">
            {[profil.contactNom, profil.contactTel].filter(Boolean).join(' — ') || '—'}
          </dd>
        </dl>
      </div>
    </div>
  )
}
