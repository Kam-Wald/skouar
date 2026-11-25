import { useState, type DragEvent } from 'react'
import type { Page } from './types'

export default function PageTree({
  pages,
  parentId,
  depth,
  currentId,
  onSelect,
  onDelete,
  onAddChild,
  onPromote,
  onMovePage,
  onDuplicate,
  onContextMenuPage,
  fmtTime
}: {
  pages: Page[]
  parentId: string | null
  depth: number
  currentId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onAddChild: (id: string) => void
  onPromote: (id: string) => void
  onMovePage: (id: string, targetId: string) => void
  onDuplicate: (id: string) => void
  onContextMenuPage: (id: string, e: React.MouseEvent) => void
  fmtTime: (ts: number) => string
}) {
  const [overId, setOverId] = useState<string | null>(null)

  const rowDragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setOverId(id)
    },
    onDragLeave: () => setOverId(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setOverId(null)
      const dragged = e.dataTransfer.getData('text/plain')
      if (dragged) onMovePage(dragged, id)
    }
  })

  return (
    <>
      {pages
        .filter((p) => (p.parentId ?? null) === parentId)
        .map((p) => (
          <li key={p.id}>
            <div
              className={`blocs-page-row${overId === p.id ? ' drag-over' : ''}`}
              style={{ paddingLeft: depth * 14 }}
              title={p.lastOpened ? fmtTime(p.lastOpened) : undefined}
              onContextMenu={(e) => onContextMenuPage(p.id, e)}
              {...rowDragProps(p.id)}
            >
              <span className="drag-handle" title="Déplacer la page">
                ⠿
              </span>
              <button
                className={`blocs-page-item${p.id === currentId ? ' selected' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                {p.icon && (
                  <span
                    className="blocs-page-icon"
                    style={p.iconColor ? { backgroundColor: p.iconColor } : undefined}
                  >
                    {p.icon}
                  </span>
                )}
                {p.title.trim() || 'Sans titre'}
              </button>
              <button className="blocs-page-act" title="Nouvelle sous-page" onClick={() => onAddChild(p.id)}>
                ＋
              </button>
              <button className="blocs-page-act" title="Dupliquer la page" onClick={() => onDuplicate(p.id)}>
                ⧉
              </button>
              {depth > 0 && (
                <button className="blocs-page-act" title="Remonter d’un niveau" onClick={() => onPromote(p.id)}>
                  ⇤
                </button>
              )}
              <button className="blocs-page-del" title="Supprimer la page" onClick={() => onDelete(p.id)}>
                ×
              </button>
            </div>
            <ul className="blocs-page-sub">
              <PageTree
                pages={pages}
                parentId={p.id}
                depth={depth + 1}
                currentId={currentId}
                onSelect={onSelect}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onPromote={onPromote}
                onMovePage={onMovePage}
                onDuplicate={onDuplicate}
                onContextMenuPage={onContextMenuPage}
                fmtTime={fmtTime}
              />
            </ul>
          </li>
        ))}
    </>
  )
}
