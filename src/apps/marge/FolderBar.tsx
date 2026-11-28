import { useState, type DragEvent as ReactDragEvent } from 'react'
import ColorSwatches from '../../shared/ColorSwatches'
import IconPicker, { IconView } from '../../shared/IconPicker'
import { useDismiss } from '../../shared/useDismiss'
import type { MargeDoc, MargeFolder } from './store'

interface Props {
  folders: MargeFolder[]
  docs: MargeDoc[]
  folderSel: 'all' | 'none' | string
  dragDocId: string | null
  onSelect: (sel: 'all' | 'none' | string) => void
  onDropDoc: (folderId: string | null) => void
  onCreate: (name: string, icon: string, color: string) => void
  onDeleteFolder: (id: string) => void
  onNewFolderClick?: () => void
}

const countIn = (docs: MargeDoc[], folderId: string | null): number =>
  docs.filter((d) => (d.folderId ?? null) === folderId).length


export default function FolderBar({ folders, docs, folderSel, dragDocId, onSelect, onDropDoc, onCreate, onDeleteFolder }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('book')
  const [color, setColor] = useState('#7ec8ff')
  useDismiss('margefolder', open, () => setOpen(false))

  const submit = (): void => {
    const n = name.trim()
    if (!n) return
    onCreate(n, icon, color)
    setName('')
    setOpen(false)
  }

  const dropOn = (e: ReactDragEvent, folderId: string | null): void => {
    e.preventDefault()
    if (dragDocId) onDropDoc(folderId)
  }

  return (
    <div className="marge-side">
      <div className="marge-side-label">Dossiers</div>
      <button
        className={`marge-folder${folderSel === 'all' ? ' on' : ''}`}
        onClick={() => onSelect('all')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => dropOn(e, null)}
      >
        <span className="marge-folder-ic">🗂️</span>
        <span className="marge-folder-name">Tous les documents</span>
        <span className="marge-folder-count">{docs.length}</span>
      </button>
      <button
        className={`marge-folder${folderSel === 'none' ? ' on' : ''}`}
        onClick={() => onSelect('none')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => dropOn(e, null)}
      >
        <span className="marge-folder-ic">📄</span>
        <span className="marge-folder-name">Sans dossier</span>
        <span className="marge-folder-count">{countIn(docs, null)}</span>
      </button>
      {folders.map((f) => (
        <div
          key={f.id}
          className={`marge-folder${folderSel === f.id ? ' on' : ''}`}
          onClick={() => onSelect(f.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => dropOn(e, f.id)}
        >
          <span className="marge-folder-ic" style={{ color: f.color }}>
            <IconView name={f.icon} />
          </span>
          <span className="marge-folder-name">{f.name}</span>
          <span className="marge-folder-count">{countIn(docs, f.id)}</span>
          <button
            className="marge-folder-del"
            title="Supprimer le dossier (les documents restent, sans dossier)"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteFolder(f.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="db-btn marge-side-btn" onClick={() => setOpen(true)}>
        ＋ Nouveau dossier
      </button>
      {open && (
        <div className="marge-folder-pop" data-pop="margefolder">
          <strong>Nouveau dossier</strong>
          <input
            className="db-input"
            autoFocus
            placeholder="Nom du dossier…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <IconPicker value={icon} onChange={setIcon} />
          <ColorSwatches value={color} onChange={setColor} title="Couleur du dossier" />
          <div className="marge-folder-pop-actions">
            <button className="db-btn" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button className="db-btn" disabled={!name.trim()} onClick={submit}>
              Créer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
