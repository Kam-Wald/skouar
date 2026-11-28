import { useState } from 'react'
import DocThumb from './Thumb'
import { progressOf, relTime, type SortMode } from './logic'
import type { MargeDoc } from './store'

interface Props {
  docs: MargeDoc[]
  query: string
  sort: SortMode
  onQuery: (q: string) => void
  onSort: (s: SortMode) => void
  mergeSel: string[]
  onToggleMerge: (id: string) => void
  onImportClick: () => void
  onMerge: () => void
  onOpen?: (doc: MargeDoc) => void
  onRename: (id: string, title: string) => void
  onDelete: (doc: MargeDoc) => void
  onDuplicate: (doc: MargeDoc) => void
  onDragDocStart: (id: string) => void
}

export default function LibraryView({
  docs,
  query,
  sort,
  onQuery,
  onSort,
  mergeSel,
  onToggleMerge,
  onImportClick,
  onMerge,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  onDragDocStart
}: Props) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  return (
    <div className="marge-lib">
      <div className="marge-lib-head">
        <span className="marge-lib-title">Bibliothèque PDF</span>
        <div className="marge-lib-actions">
          <input
            className="db-input marge-lib-search"
            placeholder="Rechercher un document…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          <select className="db-input marge-lib-sort" value={sort} onChange={(e) => onSort(e.target.value as SortMode)} title="Tri">
            <option value="date">Plus récent</option>
            <option value="titre">Titre A–Z</option>
            <option value="pages">Nb de pages</option>
          </select>
          <button className="db-btn" disabled={mergeSel.length < 2} onClick={onMerge}>
            📚 Fusionner ({mergeSel.length})
          </button>
          <button className="db-btn" onClick={onImportClick}>
            ↑ Importer
          </button>
        </div>
      </div>
      <p className="marge-lib-hint">
        Glisse-dépose des fichiers .pdf n'importe où ici, ou importe-les. Coche plusieurs documents pour les fusionner, ou glisse une carte sur un dossier. Tout reste local.
      </p>
      {docs.length === 0 ? (
        <div className="marge-empty-cta" onClick={onImportClick}>
          <span className="marge-empty-ic">📕</span>
          <strong>Aucun PDF pour l'instant</strong>
          <span>clique ou glisse-dépose des fichiers .pdf ici</span>
        </div>
      ) : (
        <div className="marge-grid">
          {docs.map((d) => (
            <div
              key={d.id}
              className="marge-card"
              draggable
              onDragStart={(e) => {
                onDragDocStart(d.id)
                e.dataTransfer?.setData('text/plain', d.id)
              }}
              onClick={() => onOpen?.(d)}
            >
              <input
                type="checkbox"
                className="marge-card-check"
                checked={mergeSel.includes(d.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleMerge(d.id)}
                title="Cocher pour fusionner"
              />
              <div className="marge-card-thumb">
                <DocThumb doc={d} />
              </div>
              <div className="marge-card-body">
                {editId === d.id ? (
                  <input
                    className="db-input"
                    autoFocus
                    value={draft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRename(d.id, draft.trim() || d.title)
                        setEditId(null)
                      }
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    onBlur={() => {
                      onRename(d.id, draft.trim() || d.title)
                      setEditId(null)
                    }}
                  />
                ) : (
                  <strong
                    title="Double-clic pour renommer"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditId(d.id)
                      setDraft(d.title)
                    }}
                  >
                    {d.title}
                  </strong>
                )}
                <span className="marge-card-meta">
                  {d.pages} page{d.pages > 1 ? 's' : ''} · {relTime(d.updatedAt)}
                </span>
                <span className="marge-progress" title={`Lu jusqu'à la page ${d.lastPage ?? 0} / ${d.pages}`}>
                  <span style={{ width: `${progressOf(d) * 100}%` }} />
                </span>
              </div>
              <div className="marge-card-tools">
                <button
                  className="marge-card-dup"
                  title="Dupliquer (copie de travail)"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(d)
                  }}
                >
                  ⧉
                </button>
                <button
                  className="marge-card-del"
                  title="Supprimer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(d)
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
