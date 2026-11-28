import { useState } from 'react'
import { snapshotBeforeImport } from '../../shared/backup'
import { notify } from '../../shared/notify'
import {
  ALL_SUIVIS,
  buildBackup,
  fmtSize,
  mergeBackup,
  parseImport,
  todayDay,
  type Attachment,
  type ImportMode,
  type ProfilSante,
  type SalvetoBackup,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs,
  type SuiviId
} from './logic'
import { importBackupData } from './store'

interface Props {
  config: SalvetoConfig
  refs: SalvetoRefs
  profil: ProfilSante
  events: SalvetoEvent[]
  attachments: Attachment[]
  onSaveConfig: (c: SalvetoConfig) => void
  onSaveRefs: (r: SalvetoRefs) => void
  onImported: () => void
}

function downloadJson(text: string, name: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function ParametresView({ config, refs, profil, events, attachments, onSaveConfig, onSaveRefs, onImported }: Props) {
  const [pending, setPending] = useState<SalvetoBackup | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRef, setConfirmRef] = useState<string | null>(null)
  const [rename, setRename] = useState<Record<string, string>>({})

  const poidsPJ = attachments.reduce((a, b) => a + (b.size || 0), 0)

  const toggleSuivi = (id: SuiviId): void => {
    const active = config.activeSuivis.includes(id)
    onSaveConfig({
      ...config,
      activeSuivis: active ? config.activeSuivis.filter((x) => x !== id) : [...config.activeSuivis, id]
    })
  }

  const exporter = (withAttachments: boolean): void => {
    const b = buildBackup({ config, refs, profil, events, attachments }, withAttachments)
    const name = `salveto-sauvegarde-${todayDay()}${withAttachments ? '' : '-sans-pj'}.json`
    try {
      downloadJson(JSON.stringify(b, null, 2), name)
      notify(`Sauvegarde exportée : ${name}${withAttachments ? '' : ' (sans pièces jointes)'}`)
    } catch {
      notify('Téléchargement indisponible dans ce contexte')
    }
  }

  const onImportFile = async (files: FileList | null): Promise<void> => {
    const f = files?.[0]
    if (!f) return
    const text = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => rej(fr.error)
      fr.readAsText(f)
    })
    const r = parseImport(text)
    if (!r.ok) {
      notify(`Import refusé : ${r.error}`)
      return
    }
    setPending(r.backup)
  }

  const appliquerImport = async (mode: ImportMode): Promise<void> => {
    if (!pending) return
    setBusy(true)
    try {
      await snapshotBeforeImport()
      const payload = mergeBackup({ config, refs, profil, events, attachments }, pending, mode)
      await importBackupData(payload, mode)
      setPending(null)
      notify(mode === 'replace' ? 'Sauvegarde restaurée (remplacement)' : 'Sauvegarde fusionnée — snapshot de sécurité pris avant import')
      onImported()
    } catch (e) {
      notify(`Import impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="sa-h1">Paramètres</h1>
      <p className="sa-cooc-note">Pas de compte, pas de réseau — tes données restent sur cet appareil.</p>

      <section className="sa-panel">
        <p className="sa-panel-title">Suivis activés (désactiver masque le suivi, jamais les données)</p>
        <div className="sa-onb-list">
          {ALL_SUIVIS.map((s) => (
            <label key={s.id} className="sa-onb-item">
              <input
                type="checkbox"
                checked={config.activeSuivis.includes(s.id)}
                onChange={() => toggleSuivi(s.id)}
                data-suivi-toggle={s.id}
              />
              <span className="sa-onb-icon" aria-hidden>
                {s.icon}
              </span>
              <span>
                <strong>{s.label}</strong>
                <span className="sa-onb-desc"> — {s.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="sa-field sa-check">
          <input
            type="checkbox"
            checked={config.desktopOnly !== false}
            onChange={(e) => onSaveConfig({ ...config, desktopOnly: e.target.checked })}
          />
          Module réservé au desktop (tuile masquée sur mobile)
        </label>
      </section>

      <section>
        <h2 className="sa-h2">Constantes, traitements & examens suivis ({refs.items.length})</h2>
        {refs.items.length === 0 ? (
          <p className="sa-empty">Aucun élément — créé depuis les écrans correspondants.</p>
        ) : (
          <ul className="sa-cooc-list">
            {refs.items.map((r) => (
              <li key={r.id} className="sa-med-row" data-ref-item={r.id}>
                <span>
                  <em className="sa-badge">{r.kind}</em>{' '}
                  <input
                    className="db-input"
                    type="text"
                    value={rename[r.id] ?? r.label}
                    onChange={(e) => setRename((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    onBlur={() => {
                      const v = (rename[r.id] ?? r.label).trim()
                      if (v && v !== r.label) onSaveRefs({ ...refs, items: refs.items.map((x) => (x.id === r.id ? { ...x, label: v } : x)) })
                    }}
                  />
                  {r.unite ? ` (${r.unite})` : ''}
                  {r.seuil != null ? ` — seuil ${r.seuil}` : ''}
                  {r.periodiciteJours ? ` — tous les ${r.periodiciteJours} j` : ''}
                </span>
                {confirmRef === r.id ? (
                  <button
                    type="button"
                    className="sa-link sa-danger"
                    onClick={() => {
                      onSaveRefs({ ...refs, items: refs.items.filter((x) => x.id !== r.id) })
                      setConfirmRef(null)
                      notify('Élément supprimé — les événements qui le référencent sont conservés')
                    }}
                  >
                    Confirmer la suppression ?
                  </button>
                ) : (
                  <button type="button" className="sa-link sa-danger" onClick={() => setConfirmRef(r.id)}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sa-panel">
        <p className="sa-panel-title">Export / import JSON (sauvegarde manuelle uniquement)</p>
        <p className="sa-cooc-note">
          {events.length} événements · {attachments.length} pièce(s) jointe(s) ({fmtSize(poidsPJ)}). Aucune donnée de santé
          n’est jamais exportée automatiquement.
        </p>
        <div className="sa-panel-row">
          <button type="button" className="db-btn" onClick={() => exporter(true)}>
            ⬇ Exporter JSON complet
          </button>
          <button type="button" className="db-btn" onClick={() => exporter(false)}>
            ⬇ Exporter sans pièces jointes
          </button>
        </div>
        <label className="db-btn sa-file-btn">
          ⬆ Importer une sauvegarde JSON…
          <input type="file" accept="application/json,.json" hidden onChange={(e) => void onImportFile(e.target.files)} />
        </label>
        {pending && (
          <div className="sa-panel" data-pending-import>
            <p>
              Sauvegarde détectée : {pending.events.length} événement(s), {pending.attachments.length} PJ, exportée le{' '}
              {pending.exportedAt.slice(0, 10) || '—'}. Un <strong>snapshot de sécurité</strong> sera pris avant l’import.
            </p>
            <div className="sa-panel-row">
              <button type="button" className="db-btn" disabled={busy} onClick={() => void appliquerImport('merge')}>
                Fusionner avec mes données
              </button>
              <button type="button" className="db-btn sa-badge-retard" disabled={busy} onClick={() => void appliquerImport('replace')}>
                Remplacer tout
              </button>
              <button type="button" className="sa-panel-close" onClick={() => setPending(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
