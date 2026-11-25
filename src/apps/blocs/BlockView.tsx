import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent
} from 'react'
import type { Block, Database } from './types'
import { createBlock, createDatabase } from './store'
import { PLACEHOLDERS } from './blockTypes'
import DatabaseView from './DatabaseView'

export interface Heading {
  id: string
  text: string
  level: number
}

export interface BlockHandlers {
  headings: Heading[]
  isActive(id: string): boolean
  onActivate(id: string): void
  onChangeText(id: string, text: string): void
  onChangeSrc(id: string, src: string | undefined): void
  onChangeHref(id: string, href: string | undefined): void
  onChangeFile(
    id: string,
    f: { src: string; fileName: string; fileSize: number } | undefined
  ): void
  onToggleDone(id: string): void
  onSetDue(id: string, due: string | null): void
  onChangeDb(id: string, db: Database): void
  onEnter(id: string): void
  onDelete(id: string): void
  onAddChildTo(parentId: string): void
  onSetCols(id: string, n: number): void
  onBlockDragStart(id: string): void
  onBlockDrop(targetId: string, after: boolean): void
  isSlashActive(id: string): boolean
  onSlashNav(dir: 1 | -1): void
  onSlashEnter(): void
  onSlashEscape(): void
}

function formatSize(n?: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export function youtubeEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  )
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

const MEDIA_META: Record<string, { icon: string; urlLabel: string; accept: string }> = {
  pdf: { icon: '📕', urlLabel: 'URL du PDF…', accept: 'application/pdf' },
  file: { icon: '📎', urlLabel: 'URL du fichier…', accept: '*' },
  archive: { icon: '📦', urlLabel: 'URL de l’archive…', accept: '.zip,.tar,.gz,.7z,.rar' },
  video: { icon: '🎬', urlLabel: 'URL vidéo (YouTube, mp4, webm)…', accept: 'video/*' },
  audio: { icon: '🔊', urlLabel: 'URL audio (mp3)…', accept: 'audio/*' }
}

interface Props {
  block: Block
  handlers: BlockHandlers
}

export default function BlockView({ block, handlers }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [over, setOver] = useState(false)
  const [urlPop, setUrlPop] = useState<null | { x: number; y: number; kind: 'src' | 'href'; value: string }>(null)
  const [duePop, setDuePop] = useState<null | { x: number; y: number }>(null)
  const active = handlers.isActive(block.id)
  const slashActive = handlers.isSlashActive(block.id)

  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== block.text) el.innerHTML = block.text
  }, [block.text])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      const cmd = e.key.toLowerCase() === 'b' ? 'bold' : e.key.toLowerCase() === 'i' ? 'italic' : 'underline'
      document.execCommand(cmd, false)
      if (el) handlers.onChangeText(block.id, el.innerHTML)
      return
    }
    if (slashActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        handlers.onSlashNav(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        handlers.onSlashNav(-1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handlers.onSlashEnter()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handlers.onSlashEscape()
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlers.onEnter(block.id)
    } else if (e.key === 'Backspace' && (el?.textContent ?? '') === '') {
      e.preventDefault()
      handlers.onDelete(block.id)
    }
  }

  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 5_000_000) {
      window.alert('Fichier trop lourd (max 5 Mo) : compresse-le ou utilise une URL.')
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      handlers.onChangeFile(block.id, {
        src: String(reader.result),
        fileName: f.name,
        fileSize: f.size
      })
    reader.readAsDataURL(f)
  }

  const dragHandle = (
    <span
      className="drag-handle"
      draggable
      title="Déplacer le bloc"
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.setData('text/plain', block.id)
        e.dataTransfer.effectAllowed = 'move'
        handlers.onBlockDragStart(block.id)
      }}
    >
      ⠿
    </span>
  )

  const rowDropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setOver(false)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const after = e.clientY > rect.top + rect.height / 2
      handlers.onBlockDrop(block.id, after)
    }
  }

  const openUrlPop = (kind: 'src' | 'href', e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setUrlPop({
      x: Math.min(r.left, Math.max(8, window.innerWidth - 340)),
      y: r.bottom,
      kind,
      value: kind === 'src' ? (block.src ?? '') : (block.href ?? '')
    })
  }

  const mediaMeta = MEDIA_META[block.type]
  if (mediaMeta) {
    const isUpload = block.type === 'pdf' || block.type === 'file' || block.type === 'archive'
    return (
      <div
        className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        onFocus={() => handlers.onActivate(block.id)}
        {...rowDropProps}
      >
        {dragHandle}
        {block.src ? (
          <>
            {block.type === 'pdf' && (
              <iframe className="block-pdf" src={block.src} title={block.fileName || 'PDF'} />
            )}
            {(block.type === 'file' || block.type === 'archive') && (
              <a className="block-file-card" href={block.src} download={block.fileName || 'fichier'}>
                <span className="block-file-ic">{mediaMeta.icon}</span>
                <span className="block-file-name">{block.fileName || 'Fichier'}</span>
                <span className="db-type">{formatSize(block.fileSize)}</span>
              </a>
            )}
            {block.type === 'video' &&
              (youtubeEmbed(block.src) ? (
                <iframe className="block-video" src={youtubeEmbed(block.src)!} allowFullScreen title="vidéo" />
              ) : (
                <video className="block-video" controls src={block.src} />
              ))}
            {block.type === 'audio' && <audio className="block-audio" controls src={block.src} />}
            <button
              className="block-row-del"
              title="Changer l’URL"
              onClick={(e) => openUrlPop('src', e)}
            >
              🔗
            </button>
            <button
              className="block-row-del"
              title="Retirer le média"
              onClick={() => {
                handlers.onChangeSrc(block.id, undefined)
                handlers.onChangeFile(block.id, undefined)
              }}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <input
              className="block-image-input"
              placeholder={mediaMeta.urlLabel}
              onFocus={() => handlers.onActivate(block.id)}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => handlers.onChangeSrc(block.id, e.target.value || undefined)}
            />
            <button className="block-media-pick" onClick={() => fileRef.current?.click()}>
              {mediaMeta.icon} {isUpload ? 'fichier…' : 'ou fichier…'}
            </button>
          </>
        )}
        <input ref={fileRef} type="file" hidden accept={mediaMeta.accept} onChange={onFilePicked} />
        {urlPop && (
          <UrlPop
            x={urlPop.x}
            y={urlPop.y}
            value={urlPop.value}
            placeholder="https://…"
            onSubmit={(v) => handlers.onChangeSrc(block.id, v || undefined)}
            onClose={() => setUrlPop(null)}
          />
        )}
      </div>
    )
  }

  if (block.type === 'divider') {
    return (
      <div
        className={`block-row block-divider-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        tabIndex={-1}
        onFocus={() => handlers.onActivate(block.id)}
        {...rowDropProps}
      >
        {dragHandle}
        <hr className="block-divider" />
        <button className="block-row-del" title="Supprimer le séparateur" onClick={() => handlers.onDelete(block.id)}>
          ×
        </button>
      </div>
    )
  }

  if (block.type === 'toc') {
    return (
      <div
        className={`block-row block-toc-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        tabIndex={-1}
        onFocus={() => handlers.onActivate(block.id)}
        {...rowDropProps}
      >
        {dragHandle}
        <div className="block-toc">
          <div className="block-toc-title">☰ Table des matières</div>
          {handlers.headings.length === 0 ? (
            <div className="db-empty">Ajoute des titres H1 / H2 / H3 / H4 dans la page</div>
          ) : (
            handlers.headings.map((h) => (
              <button
                key={h.id}
                className={`toc-item toc-l${h.level}`}
                onClick={() =>
                  document.getElementById(`bloc-${h.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              >
                {h.text || 'Sans titre'}
              </button>
            ))
          )}
        </div>
        <button className="block-row-del" title="Supprimer" onClick={() => handlers.onDelete(block.id)}>
          ×
        </button>
      </div>
    )
  }

  if (block.type === 'button') {
    return (
      <div
        className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        {...rowDropProps}
      >
        {dragHandle}
        <a
          className="block-button"
          href={block.href || undefined}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!block.href) e.preventDefault()
          }}
        >
          <span
            id={`bloc-${block.id}`}
            ref={ref}
            className="block-button-label"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={PLACEHOLDERS.button}
            onFocus={() => handlers.onActivate(block.id)}
            onInput={(e) => handlers.onChangeText(block.id, e.currentTarget.innerHTML)}
            onKeyDown={handleKeyDown}
          />
        </a>
        <button className="block-row-del" title="URL du bouton" onClick={(e) => openUrlPop('href', e)}>
          🔗
        </button>
        {urlPop && (
          <UrlPop
            x={urlPop.x}
            y={urlPop.y}
            value={urlPop.value}
            placeholder="https://…"
            onSubmit={(v) => handlers.onChangeHref(block.id, v || undefined)}
            onClose={() => setUrlPop(null)}
          />
        )}
      </div>
    )
  }

  if (block.type === 'columns') {
    const cols = block.children ?? []
    return (
      <div
        className={`block-row block-cols-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        {...rowDropProps}
      >
        {dragHandle}
        <div className="block-columns-wrap">
          <div className="block-columns" style={{ gridTemplateColumns: `repeat(${block.cols ?? 2}, 1fr)` }}>
            {cols.map((col) => (
              <div className="block-column" key={col.id}>
                {(col.children ?? []).map((c) => (
                  <BlockView key={c.id} block={c} handlers={handlers} />
                ))}
                <button className="col-add" title="Ajouter un bloc dans cette colonne" onClick={() => handlers.onAddChildTo(col.id)}>
                  ＋
                </button>
              </div>
            ))}
          </div>
          {active && (
            <div className="cols-ctl">
              <span className="db-type">Colonnes :</span>
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  className={n === (block.cols ?? 2) ? 'tool active' : 'tool'}
                  onClick={() => handlers.onSetCols(block.id, n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (block.type === 'toggle') {
    return (
      <div className="block-toggle">
        <div
          className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
          {...rowDropProps}
        >
          {dragHandle}
          <button
            className={`toggle-caret${open ? ' open' : ''}`}
            onClick={() => setOpen((o) => !o)}
            aria-label="Déplier / replier"
          >
            ▸
          </button>
          <div
            id={`bloc-${block.id}`}
            ref={ref}
            className="block block-toggle-head"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={PLACEHOLDERS.toggle}
            onFocus={() => handlers.onActivate(block.id)}
            onInput={(e) => handlers.onChangeText(block.id, e.currentTarget.innerHTML)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {open && (
          <div className="toggle-children">
            {(block.children ?? []).map((c) => (
              <BlockView key={c.id} block={c} handlers={handlers} />
            ))}
            <button className="col-add" onClick={() => handlers.onAddChildTo(block.id)}>
              ＋ bloc dans le dépliant
            </button>
          </div>
        )}
      </div>
    )
  }

  if (block.type === 'database') {
    return (
      <div
        className={`block-row block-db${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        onFocus={() => handlers.onActivate(block.id)}
        {...rowDropProps}
      >
        {dragHandle}
        <DatabaseView
          db={block.db ?? createDatabase()}
          title={block.text}
          onTitle={(t) => handlers.onChangeText(block.id, t)}
          onChange={(db) => handlers.onChangeDb(block.id, db)}
        />
      </div>
    )
  }

  return (
    <div
      className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
      {...rowDropProps}
    >
      {dragHandle}
      {block.type === 'todo' && (
        <>
          <input
            type="checkbox"
            className="block-todo-check"
            checked={block.done ?? false}
            onChange={() => handlers.onToggleDone(block.id)}
          />
          <button
            className={`todo-due-btn${block.due ? ' set' : ''}`}
            title={block.due ? `Rappel : ${block.due.replace('T', ' ')}` : 'Ajouter un rappel'}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setDuePop({ x: r.left, y: r.bottom })
            }}
          >
            ⏰
          </button>
          {duePop && (
            <div className="url-pop" style={{ left: duePop.x, top: duePop.y + 6 }}>
              <input
                type="datetime-local"
                className="db-input"
                autoFocus
                defaultValue={block.due ?? undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlers.onSetDue(block.id, (e.target as HTMLInputElement).value || null)
                    setDuePop(null)
                  }
                  if (e.key === 'Escape') setDuePop(null)
                }}
              />
              <button
                className="db-btn"
                onClick={(e) => {
                  const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input')
                  handlers.onSetDue(block.id, input?.value || null)
                  setDuePop(null)
                }}
              >
                OK
              </button>
              {block.due && (
                <button
                  className="db-btn"
                  onClick={() => {
                    handlers.onSetDue(block.id, null)
                    setDuePop(null)
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </>
      )}
      {block.type === 'bullet' && <span className="block-bullet">•</span>}
      <div
        id={`bloc-${block.id}`}
        ref={ref}
        className={`block block-${block.type}${block.done ? ' block-done' : ''}`}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={PLACEHOLDERS[block.type]}
        onFocus={() => handlers.onActivate(block.id)}
        onInput={(e) => handlers.onChangeText(block.id, e.currentTarget.innerHTML)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function UrlPop({
  x,
  y,
  value,
  placeholder,
  onSubmit,
  onClose
}: {
  x: number
  y: number
  value: string
  placeholder: string
  onSubmit: (v: string) => void
  onClose: () => void
}) {
  const [v, setV] = useState(value)
  return (
    <div className="url-pop" style={{ left: x, top: y + 6 }}>
      <input
        className="db-input"
        autoFocus
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSubmit(v.trim())
            onClose()
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      <button
        className="db-btn"
        onClick={() => {
          onSubmit(v.trim())
          onClose()
        }}
      >
        OK
      </button>
      <button className="db-btn" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}
