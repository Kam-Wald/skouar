import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AppMeta } from '../apps/registry'

interface DndProps {
  edit?: boolean
  dragging?: boolean
  dropBefore?: boolean
  onGripDragStart?: (id: string) => void
  onTileDragOver?: (id: string) => void
  onTileDrop?: (id: string) => void
  onDragEnd?: () => void
  onTileKeyDown?: (id: string, e: ReactKeyboardEvent) => void
}

export default function AppTile({ app, idx, ...dnd }: { app: AppMeta; idx: string } & DndProps): JSX.Element {
  const wip = !app.soon && !app.component
  const cls = `app-tile${app.soon ? ' soon' : ''}${wip ? ' wip' : ''}${dnd.dragging ? ' dragging' : ''}${dnd.dropBefore ? ' drop-before' : ''}`
  const grip = dnd.edit ? (
    <span
      className="app-tile-grip"
      draggable
      title="Glisser pour réordonner"
      aria-label={`Déplacer ${app.name}`}
      onDragStart={(e) => {
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        dnd.onGripDragStart?.(app.id)
      }}
      onDragEnd={() => dnd.onDragEnd?.()}
    >
      ⋮⋮
    </span>
  ) : null
  const dndHandlers = dnd.edit
    ? {
        onDragOver: (e: ReactDragEvent) => {
          e.preventDefault()
          dnd.onTileDragOver?.(app.id)
        },
        onDrop: (e: ReactDragEvent) => {
          e.preventDefault()
          e.stopPropagation()
          dnd.onTileDrop?.(app.id)
        },
        onKeyDown: (e: ReactKeyboardEvent) => dnd.onTileKeyDown?.(app.id, e)
      }
    : {}
  const inner = (
    <>
      {grip}
      <span className="app-tile-index">{idx}</span>
      {app.logo ? (
        <img className="app-tile-logo" src={app.logo} alt="" draggable={false} />
      ) : (
        <span className="app-tile-icon" aria-hidden>
          {app.icon}
        </span>
      )}
      <span className="app-tile-name">
        {app.name}
        <span className="app-tile-tag"> · {app.tag}</span>
      </span>
      <span className="app-tile-desc">{app.description}</span>
      {app.soon && <span className="app-tile-badge">Bientôt</span>}
      {wip && <span className="app-tile-badge wip">En chantier</span>}
    </>
  )
  const disabled = !!app.soon || !app.component
  return disabled ? (
    <div className={cls} aria-disabled="true" data-app-id={app.id} {...dndHandlers}>
      {inner}
    </div>
  ) : (
    <Link to={`/app/${app.id}`} className={cls} data-app-id={app.id} {...dndHandlers}>
      {inner}
    </Link>
  )
}
