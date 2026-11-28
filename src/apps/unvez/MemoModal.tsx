import { useState } from 'react'
import ColorSwatches from '../../shared/ColorSwatches'
import IconPicker from '../../shared/IconPicker'
import { useDismiss } from '../../shared/useDismiss'
import type { Folder } from './store'

export interface MemoDraft {
  id?: string
  name: string
  note: string
  folderId: string | null
  bg: string | null
}

export function MemoModal({
  initial,
  folders,
  onSave,
  onClose
}: {
  initial: MemoDraft
  folders: Folder[]
  onSave: (d: MemoDraft) => void
  onClose: () => void
}): JSX.Element {
  const [name, setName] = useState(initial.name)
  const [note, setNote] = useState(initial.note)
  const [folderId, setFolderId] = useState<string | null>(initial.folderId)
  const [bg, setBg] = useState<string | null>(initial.bg)
  useDismiss('unvez-memo', true, onClose)
  const valid = name.trim().length > 0
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={initial.id ? 'Modifier le mémo' : 'Enregistrer un mémo'}>
        <div className="modal-head">
          <strong>{initial.id ? 'Modifier le mémo' : 'Enregistrer un mémo'}</strong>
          <button type="button" className="db-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <label className="settings-field">
          <span>Nom</span>
          <input aria-label="Nom du mémo" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="settings-field">
          <span>Note (facultative)</span>
          <textarea aria-label="Note du mémo" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Dossier</span>
          <select aria-label="Dossier du mémo" value={folderId ?? ''} onChange={(e) => setFolderId(e.target.value || null)}>
            <option value="">Sans dossier</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <div className="settings-field">
          <span>Fond</span>
          <div className="memo-bg-row">
            <button type="button" className={`unvez-btn${bg === null ? ' active' : ''}`} onClick={() => setBg(null)}>
              Aucun
            </button>
            <ColorSwatches value={bg ?? '#888888'} onChange={(c) => setBg(c)} title="Fond du mémo" />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="db-btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="db-btn primary"
            disabled={!valid}
            onClick={() => onSave({ id: initial.id, name: name.trim(), note, folderId, bg })}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export function FolderModal({
  initial,
  onSave,
  onClose
}: {
  initial?: { id: string; name: string; icon: string; color: string }
  onSave: (f: { id?: string; name: string; icon: string; color: string }) => void
  onClose: () => void
}): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'star')
  const [color, setColor] = useState(initial?.color ?? '#14b8a6')
  useDismiss('unvez-folder', true, onClose)
  const valid = name.trim().length > 0
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={initial ? 'Renommer le dossier' : 'Nouveau dossier'}>
        <div className="modal-head">
          <strong>{initial ? 'Modifier le dossier' : 'Nouveau dossier'}</strong>
          <button type="button" className="db-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <label className="settings-field">
          <span>Nom</span>
          <input aria-label="Nom du dossier" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="settings-field">
          <span>Icône</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="settings-field">
          <span>Couleur</span>
          <ColorSwatches value={color} onChange={setColor} title="Couleur du dossier" />
        </div>
        <div className="modal-actions">
          <button type="button" className="db-btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="db-btn primary"
            aria-label="Enregistrer le dossier"
            disabled={!valid}
            onClick={() => onSave({ id: initial?.id, name: name.trim(), icon, color })}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
