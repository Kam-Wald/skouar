import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent
} from 'react'
import type { Block, Database } from './types'
import { createDatabase } from './store'
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
  onChangeDb(id: string, db: Database): void
  onEnter(id: string): void
  onDelete(id: string): void
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

const MEDIA_META: Record<string, { icon: string; pickLabel: string; urlLabel: string; accept: string }> = {
  pdf: { icon: '📕', pickLabel: 'Choisir un PDF…', urlLabel: 'URL du PDF…', accept: 'application/pdf' },
  file: { icon: '📎', pickLabel: 'Choisir un fichier…', urlLabel: 'URL du fichier…', accept: '*' },
  archive: { icon: '📦', pickLabel: 'Choisir une archive…', urlLabel: 'URL de l’archive…', accept: '.zip,.tar,.gz,.7z,.rar' },
  video: { icon: '🎬', pickLabel: 'Choisir une vidéo…', urlLabel: 'URL vidéo (YouTube, mp4, webm)…', accept: 'video/*' },
  audio: { icon: '🔊', pickLabel: 'Choisir un fichier audio…', urlLabel: 'URL audio (mp3)…', accept: 'audio/*' }
}

interface Props {
  block: Block
  handlers: BlockHandlers
}

export default function BlockView({ block, handlers }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const active = handlers.isActive(block.id)
  const slashActive = handlers.isSlashActive(block.id)

  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== block.text) el.textContent = block.text
  }, [block.text])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
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

  const mediaMeta = MEDIA_META[block.type]
  if (mediaMeta) {
    const isUpload = block.type === 'pdf' || block.type === 'file' || block.type === 'archive'
    return (
      <div
        className={`block-row${active ? ' block-active' : ''}`}
        onFocus={() => handlers.onActivate(block.id)}
      >
        {block.src ? (
          <>
            {block.type === 'pdf' && (
              <iframe
                className="block-pdf"
                src={block.src}
                title={block.fileName || 'PDF'}
              />
            )}
            {(block.type === 'file' || block.type === 'archive') && (
              <a
                className="block-file-card"
                href={block.src}
                download={block.fileName || 'fichier'}
              >
                <span className="block-file-ic">{mediaMeta.icon}</span>
                <span className="block-file-name">{block.fileName || 'Fichier'}</span>
                <span className="db-type">{formatSize(block.fileSize)}</span>
              </a>
            )}
            {block.type === 'video' &&
              (youtubeEmbed(block.src) ? (
                <iframe
                  className="block-video"
                  src={youtubeEmbed(block.src)!}
                  allowFullScreen
                  title="vidéo"
                />
              ) : (
                <video className="block-video" controls src={block.src} />
              ))}
            {block.type === 'audio' && (
              <audio className="block-audio" controls src={block.src} />
            )}
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
            <button
              className="block-media-pick"
              onClick={() => fileRef.current?.click()}
            >
              {mediaMeta.icon} {isUpload ? mediaMeta.pickLabel : 'ou fichier…'}
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={mediaMeta.accept}
          onChange={onFilePicked}
        />
      </div>
    )
  }

  if (block.type === 'divider') {
    return (
      <div
        className={`block-row block-divider-row${active ? ' block-active' : ''}`}
        tabIndex={-1}
        onFocus={() => handlers.onActivate(block.id)}
      >
        <hr className="block-divider" />
        <button
          className="block-row-del"
          title="Supprimer le séparateur"
          onClick={() => handlers.onDelete(block.id)}
        >
          ×
        </button>
      </div>
    )
  }

  if (block.type === 'toc') {
    return (
      <div
        className={`block-row block-toc-row${active ? ' block-active' : ''}`}
        tabIndex={-1}
        onFocus={() => handlers.onActivate(block.id)}
      >
        <div className="block-toc">
          <div className="block-toc-title">☰ Table des matières</div>
          {handlers.headings.length === 0 ? (
            <div className="db-empty">Ajoute des titres H1 / H2 / H3 dans la page</div>
          ) : (
            handlers.headings.map((h) => (
              <button
                key={h.id}
                className={`toc-item toc-l${h.level}`}
                onClick={() =>
                  document
                    .getElementById(`bloc-${h.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              >
                {h.text || 'Sans titre'}
              </button>
            ))
          )}
        </div>
        <button
          className="block-row-del"
          title="Supprimer"
          onClick={() => handlers.onDelete(block.id)}
        >
          ×
        </button>
      </div>
    )
  }

  if (block.type === 'button') {
    return (
      <div className={`block-row${active ? ' block-active' : ''}`}>
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
            onInput={(e) =>
              handlers.onChangeText(block.id, e.currentTarget.textContent ?? '')
            }
            onKeyDown={handleKeyDown}
          />
        </a>
        <button
          className="block-row-del"
          title="URL du bouton"
          onClick={() => {
            const u = window.prompt('URL du bouton :', block.href ?? '')
            if (u !== null) handlers.onChangeHref(block.id, u || undefined)
          }}
        >
          🔗
        </button>
      </div>
    )
  }

  if (block.type === 'toggle') {
    return (
      <div className="block-toggle">
        <div className={`block-row${active ? ' block-active' : ''}`}>
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
            onInput={(e) =>
              handlers.onChangeText(block.id, e.currentTarget.textContent ?? '')
            }
            onKeyDown={handleKeyDown}
          />
        </div>
        {open && (
          <div className="toggle-children">
            {(block.children ?? []).map((c) => (
              <BlockView key={c.id} block={c} handlers={handlers} />
            ))}
            {block.children?.length === 0 && (
              <div className="db-empty">Menu vide — clique dans le titre puis Entrée</div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (block.type === 'database') {
    return (
      <div
        className={`block-row block-db${active ? ' block-active' : ''}`}
        onFocus={() => handlers.onActivate(block.id)}
      >
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
    <div className={`block-row${active ? ' block-active' : ''}`}>
      {block.type === 'todo' && (
        <input
          type="checkbox"
          className="block-todo-check"
          checked={block.done ?? false}
          onChange={() => handlers.onToggleDone(block.id)}
        />
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
        onInput={(e) =>
          handlers.onChangeText(block.id, e.currentTarget.textContent ?? '')
        }
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
