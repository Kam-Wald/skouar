import { useRef, useState } from 'react'
import { notify } from '../../shared/notify'
import { uid } from '../../shared/db'
import { snapshotBeforeImport } from '../../shared/backup'
import { backupFileName, exportData, importData, type ImportMode } from './io'
import { deleteRef, listAttachments, saveRef, TRACKERS, TRACKER_LABELS, type Attachment, type HealthEvent, type Profile, type RacineSettings, type RefEntity } from './store'
import { listQuestions } from './agenda'

interface Props {
  events: HealthEvent[]
  refs: RefEntity[]
  profile: Profile
  settings: RacineSettings
  onSettings: (patch: Partial<RacineSettings>) => void
  onReload: () => Promise<void>
}

export default function SettingsPanel({ events, refs, profile, settings, onSettings, onReload }: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  const [mode, setMode] = useState<ImportMode>('fusion')
  const fileRef = useRef<HTMLInputElement>(null)
  const [cName, setCName] = useState('')
  const [cUnit, setCUnit] = useState('')
  const [armedRef, setArmedRef] = useState<string | null>(null)
  const constantes = refs.filter((r) => r.kind === 'constante')

  const doExport = async (withAttachments: boolean): Promise<void> => {
    try {
      const attachments: Attachment[] = withAttachments ? await listAttachments() : []
      const questions = await listQuestions()
      const json = await exportData(events, refs, profile, attachments, questions, withAttachments)
      const blob = new Blob([json], { type: 'application/json' })
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = backupFileName()
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      }
      notify(withAttachments ? 'Sauvegarde JSON exportée (avec pièces jointes)' : 'Sauvegarde JSON exportée (sans pièces jointes)')
    } catch {
      notify('Export impossible')
    }
  }

  const doImport = async (f: File): Promise<void> => {
    try {
      const text = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result))
        fr.onerror = () => rej(fr.error)
        fr.readAsText(f)
      })
      const how = await snapshotBeforeImport()
      notify(how === 'localStorage' ? 'Snapshot de sécurité enregistré avant import' : 'Snapshot de sécurité téléchargé (ZIP) avant import')
      const r = await importData(text, mode)
      await onReload()
      notify(`Import OK (${mode === 'fusion' ? 'fusion' : 'remplacement'}) : ${r.events} événement(s), ${r.refs} entité(s), ${r.attachments} PJ`)
    } catch (e) {
      notify(`Import interrompu (${e instanceof Error ? e.message : 'fichier illisible'}) — données actuelles intactes, snapshot fait avant`)
    }
  }

  const addConstante = async (): Promise<void> => {
    const n = cName.trim()
    if (!n) {
      notify('Nom de la constante requis')
      return
    }
    if (constantes.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
      notify('Cette constante existe déjà')
      return
    }
    await saveRef({ id: uid(), kind: 'constante', name: n, unit: cUnit.trim(), threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: Date.now() })
    setCName('')
    setCUnit('')
    await onReload()
    notify(`Constante « ${n} » créée`)
  }

  const removeConstante = async (r: RefEntity): Promise<void> => {
    await deleteRef(r.id)
    setArmedRef(null)
    await onReload()
    notify(`Constante « ${r.name} » supprimée — ses valeurs sont conservées`)
  }

  return (
    <>
      <h4>Suivis actifs</h4>
      {TRACKERS.map((t) => (
        <label key={t} className="settings-check">
          <input
            type="checkbox"
            aria-label={`Racine — suivi ${TRACKER_LABELS[t]}`}
            checked={settings.trackers[t] !== false}
            onChange={(e) => onSettings({ trackers: { ...settings.trackers, [t]: e.target.checked } })}
          />
          <span>{TRACKER_LABELS[t]}</span>
        </label>
      ))}
      <div className="settings-sep" />
      <h4>Constantes personnalisées</h4>
      <div className="ra-form-row">
        <input aria-label="Nom de la constante" placeholder="ex. tension" value={cName} onChange={(e) => setCName(e.target.value)} />
        <input aria-label="Unité de la constante" placeholder="ex. mmHg" value={cUnit} onChange={(e) => setCUnit(e.target.value)} />
        <button type="button" className="db-btn primary" aria-label="Ajouter la constante" onClick={() => void addConstante()}>
          + Ajouter
        </button>
      </div>
      <ul className="ra-cycle-list">
        {constantes.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>
            {c.unit ? ` (${c.unit})` : ''}{' '}
            <button
              type="button"
              className={`unvez-btn${armedRef === c.id ? ' danger armed' : ''}`}
              aria-label={`Supprimer la constante ${c.name}`}
              onClick={() => (armedRef === c.id ? void removeConstante(c) : setArmedRef(c.id))}
            >
              {armedRef === c.id ? 'Confirmer la suppression ?' : 'Supprimer'}
            </button>
          </li>
        ))}
        {constantes.length === 0 && <li className="ra-muted">Aucune constante.</li>}
      </ul>
      <div className="settings-sep" />
      <button type="button" className="db-btn" onClick={() => void doExport(true)}>
        💾 Exporter mes données Racine (JSON, avec pièces jointes)
      </button>
      <button type="button" className="db-btn" onClick={() => void doExport(false)}>
        💾 Exporter sans les pièces jointes (JSON léger)
      </button>
      <label className="settings-field">
        <span>Mode d’import</span>
        <select aria-label="Racine — mode d’import" value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
          <option value="fusion">Fusion (ajoute / met à jour par id, garde le reste)</option>
          <option value="remplacer">Remplacer (efface tout avant d’importer)</option>
        </select>
      </label>
      <button
        type="button"
        className={`db-btn danger${armed ? ' armed' : ''}`}
        onClick={() => {
          if (!armed) {
            setArmed(true)
            return
          }
          fileRef.current?.click()
        }}
      >
        {armed ? `⚠️ Confirmer l’import (${mode === 'fusion' ? 'fusion' : 'remplacement total'}) ?` : '📥 Importer une sauvegarde Racine (JSON)'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Fichier de sauvegarde Racine"
        onChange={(e) => {
          const f = e.target.files?.[0]
          setArmed(false)
          if (f) void doImport(f)
          e.target.value = ''
        }}
      />
    </>
  )
}
