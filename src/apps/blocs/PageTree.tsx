import type { Page } from './types'

export default function PageTree({
  pages,
  parentId,
  depth,
  currentId,
  onSelect,
  onDelete,
  onAddChild,
  onPromote
}: {
  pages: Page[]
  parentId: string | null
  depth: number
  currentId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onAddChild: (id: string) => void
  onPromote: (id: string) => void
}) {
  return (
    <>
      {pages
        .filter((p) => (p.parentId ?? null) === parentId)
        .map((p) => (
          <li key={p.id}>
            <div className="blocs-page-row" style={{ paddingLeft: depth * 14 }}>
              <button
                className={`blocs-page-item${p.id === currentId ? ' selected' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                {p.icon && <span className="blocs-page-icon">{p.icon}</span>}
                {p.title.trim() || 'Sans titre'}
              </button>
              <button
                className="blocs-page-act"
                title="Nouvelle sous-page"
                onClick={() => onAddChild(p.id)}
              >
                ＋
              </button>
              {depth > 0 && (
                <button
                  className="blocs-page-act"
                  title="Remonter d’un niveau"
                  onClick={() => onPromote(p.id)}
                >
                  ⇤
                </button>
              )}
              <button
                className="blocs-page-del"
                title="Supprimer la page"
                onClick={() => onDelete(p.id)}
              >
                ×
              </button>
            </div>
            <PageTree
              pages={pages}
              parentId={p.id}
              depth={depth + 1}
              currentId={currentId}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onPromote={onPromote}
            />
          </li>
        ))}
    </>
  )
}
