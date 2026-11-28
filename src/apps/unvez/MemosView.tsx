import { useState } from 'react'
import { notify } from '../../shared/notify'
import type { Folder, Memo } from './store'
import { searchMemos } from './memos'

interface Props {
  memos: Memo[]
  folders: Folder[]
  folderId: string | null
  onReuse: (m: Memo) => void
  onEdit: (m: Memo) => void
  onDelete: (m: Memo) => void
  onDragMemoStart: (id: string) => void
  onRenameFolder: (f: Folder) => void
  onDeleteFolder: (f: Folder) => void
}

export default function MemosView({
  memos,
  folders,
  folderId,
  onReuse,
  onEdit,
  onDelete,
  onDragMemoStart,
  onRenameFolder,
  onDeleteFolder
}: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [armedMemo, setArmedMemo] = useState<string | null>(null)
  const [armedFolder, setArmedFolder] = useState(false)
  const folder = folders.find((f) => f.id === folderId) ?? null
  const inFolder = memos.filter((m) => (folderId === null ? m.folderId === null : m.folderId === folderId))
  const visible = searchMemos(inFolder, query)

  const copy = (m: Memo): void => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(m.result).then(
        () => notify('Résultat copié'),
        () => notify('Copie impossible')
      )
    } else notify(m.result)
  }

  return (
    <section className="unvez-view unvez-memos">
      <div className="memos-head">
        <h2>{folder ? folder.name : 'Sans dossier'}</h2>
        <input
          aria-label="Rechercher dans les mémos"
          className="conv-search"
          placeholder="Rechercher (nom, note, valeur)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {folder && (
          <span className="memos-folder-actions">
            <button type="button" className="unvez-btn" onClick={() => onRenameFolder(folder)}>
              Renommer
            </button>
            <button
              type="button"
              className={`unvez-btn${armedFolder ? ' danger armed' : ''}`}
              onClick={() => {
                if (!armedFolder) {
                  setArmedFolder(true)
                  return
                }
                onDeleteFolder(folder)
                setArmedFolder(false)
              }}
            >
              {armedFolder ? 'Confirmer la suppression du dossier ?' : 'Supprimer le dossier'}
            </button>
          </span>
        )}
      </div>
      {visible.length === 0 && <p className="unvez-empty">Aucun mémo ici.</p>}
      <div className="memos-grid">
        {visible.map((m) => (
          <article
            key={m.id}
            className="memo-card"
            draggable
            onDragStart={(e) => {
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              onDragMemoStart(m.id)
            }}
            onClick={() => onReuse(m)}
            style={m.bg ? { background: m.bg } : undefined}
            title="Cliquer pour recharger dans l’outil"
          >
            <div className="memo-card-top">
              <span className={`memo-badge memo-${m.kind}`}>{m.kind === 'calc' ? 'calc' : 'conv'}</span>
              <strong className="memo-name">{m.name}</strong>
            </div>
            {m.note && <p className="memo-note">{m.note}</p>}
            <p className="memo-expr">{m.kind === 'calc' ? m.expr : `${m.input} ${m.fromUnit} → ${m.toUnit}`}</p>
            <p className="memo-result">{m.result}</p>
            <div className="memo-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="unvez-btn" onClick={() => copy(m)}>
                Copier
              </button>
              <button type="button" className="unvez-btn" onClick={() => onEdit(m)}>
                Modifier
              </button>
              <button
                type="button"
                className={`unvez-btn${armedMemo === m.id ? ' danger armed' : ''}`}
                onClick={() => {
                  if (armedMemo !== m.id) {
                    setArmedMemo(m.id)
                    return
                  }
                  onDelete(m)
                  setArmedMemo(null)
                }}
              >
                {armedMemo === m.id ? 'Confirmer ?' : 'Supprimer'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
