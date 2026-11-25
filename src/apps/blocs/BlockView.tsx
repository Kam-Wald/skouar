import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent
} from 'react'
import type { Block, BlockAction, Database } from './types'
import { createBlock, createDatabase } from './store'
import { PLACEHOLDERS } from './blockTypes'
import DatabaseView from './DatabaseView'
import { ICON_COLORS } from './EmojiPicker'
import { stripHtml } from './tree'
import type { DbRef } from './fields'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { QRCodeSVG } from 'qrcode.react'
import { useDismiss } from './useDismiss'

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
  onChangeColor(id: string, color: string | null): void
  onChangeProgress(id: string, n: number): void
  onAddGallery(id: string, srcs: string[]): void
  onRemoveGallery(id: string, src: string): void
  onSetAction(id: string, action: BlockAction | undefined): void
  onRunAction(id: string): void
  onOpenPage(id: string): void
  onSetPage(id: string, pageId: string | undefined): void
  pagesList: { id: string; title: string }[]
  blocksList: { id: string; label: string }[]
  allDbs: DbRef[]
  onEnter(id: string): void
  onDelete(id: string): void
  onAddChildTo(parentId: string): void
  onSetCols(id: string, n: number): void
  onBlockDragStart(id: string): void
  onBlockDrop(targetId: string, after: boolean): void
  onBlockContextMenu(id: string, e: React.MouseEvent): void
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
  useDismiss(`url-${block.id}`, !!urlPop, () => setUrlPop(null))
  useDismiss(`due-${block.id}`, !!duePop, () => setDuePop(null))
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
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      handlers.onBlockContextMenu(block.id, e)
    },
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
              data-pop={`url-${block.id}`} onClick={(e) => openUrlPop('src', e)}
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
            popKey={`url-${block.id}`}
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
    const [actOpen, setActOpen] = useState(false)
    useDismiss(`act-${block.id}`, actOpen, () => setActOpen(false))
    const [actSrc, setActSrc] = useState(block.action?.repeatBlockId ?? '')
    const [actCount, setActCount] = useState(block.action?.count ?? 3)
    return (
      <div
        className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`}
        {...rowDropProps}
      >
        {dragHandle}
        <a
          className="block-button"
          href={block.action ? undefined : block.href || undefined}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (block.action) {
              e.preventDefault()
              handlers.onRunAction(block.id)
            } else if (!block.href) e.preventDefault()
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
        {block.action && <span className="db-type">⚙ ×{block.action.count}</span>}
        <button className="block-row-del" title="URL du bouton" data-pop={`url-${block.id}`} onClick={(e) => openUrlPop('href', e)}>
          🔗
        </button>
        <button
          className={`block-row-del${block.action ? ' set' : ''}`}
          title="Automatisation : répéter un bloc N fois au clic"
          data-pop={`act-${block.id}`} onClick={() => { setActSrc(block.action?.repeatBlockId ?? ''); setActCount(block.action?.count ?? 3); setActOpen((o) => !o) }}
        >
          ⚙
        </button>
        {urlPop && (
          <UrlPop
            x={urlPop.x}
            y={urlPop.y}
            value={urlPop.value}
            placeholder="https://…"
            popKey={`url-${block.id}`}
            onSubmit={(v) => handlers.onChangeHref(block.id, v || undefined)}
            onClose={() => setUrlPop(null)}
          />
        )}
        {actOpen && (
          <div className="url-pop" data-pop={`act-${block.id}`} style={{ left: 8, top: 'auto', bottom: 8 }}>
            <select className="db-select" value={actSrc} onChange={(e) => setActSrc(e.target.value)}>
              <option value="">Bloc à répéter…</option>
              {handlers.blocksList.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={50}
              className="db-input"
              style={{ width: 60 }}
              value={actCount}
              onChange={(e) => setActCount(Number(e.target.value) || 1)}
            />
            <button
              className="db-btn"
              onClick={() => {
                if (actSrc) handlers.onSetAction(block.id, { repeatBlockId: actSrc, count: actCount })
                setActOpen(false)
              }}
            >
              OK
            </button>
            {block.action && (
              <button className="db-btn" onClick={() => { handlers.onSetAction(block.id, undefined); setActOpen(false) }}>✕</button>
            )}
          </div>
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

  if (block.type === 'callout') {
    const color = block.color ?? 'var(--accent)'
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div className="block-callout" style={{ borderLeftColor: color, backgroundColor: 'color-mix(in srgb, ' + color + ' 12%, transparent)' }}>
          <span className="block-callout-ic">💡</span>
          <div
            id={`bloc-${block.id}`}
            ref={ref}
            className="block block-callout-text"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={PLACEHOLDERS.callout}
            onFocus={() => handlers.onActivate(block.id)}
            onInput={(e) => handlers.onChangeText(block.id, e.currentTarget.innerHTML)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {active && (
          <span className="callout-colors">
            {ICON_COLORS.filter((c) => c !== 'transparent').map((c) => (
              <button key={c} className="emoji-color" style={{ backgroundColor: c }} onClick={() => handlers.onChangeColor(block.id, c)} />
            ))}
            <button className="emoji-color" style={{ background: 'repeating-conic-gradient(#475569 0% 25%, transparent 0% 50%)', backgroundSize: '8px 8px' }} onClick={() => handlers.onChangeColor(block.id, null)} />
          </span>
        )}
      </div>
    )
  }

  if (block.type === 'embed') {
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        {block.src ? (
          <>
            <iframe className="block-embed" src={block.src} title="embed" />
            <button className="block-row-del" title="Changer l'URL" data-pop={`url-${block.id}`} onClick={(e) => openUrlPop('src', e)}>🔗</button>
            <button className="block-row-del" title="Retirer" onClick={() => { handlers.onChangeSrc(block.id, undefined) }}>×</button>
          </>
        ) : (
          <input
            className="block-image-input"
            placeholder="URL à intégrer (site, vidéo, doc, carte…)"
            onFocus={() => handlers.onActivate(block.id)}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => handlers.onChangeSrc(block.id, e.target.value || undefined)}
          />
        )}
        {urlPop && (
          <UrlPop x={urlPop.x} y={urlPop.y} value={urlPop.value} placeholder="https://…" popKey={`url-${block.id}`} onSubmit={(v) => handlers.onChangeSrc(block.id, v || undefined)} onClose={() => setUrlPop(null)} />
        )}
      </div>
    )
  }

  if (block.type === 'math') {
    const [editOpen, setEditOpen] = useState(false)
    useDismiss(`math-${block.id}`, editOpen, () => setEditOpen(false))
    const [draft, setDraft] = useState('')
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div
          className="block-math"
          data-pop={`math-${block.id}`}
          title="Cliquer pour éditer la formule LaTeX"
          onClick={() => { setDraft(stripHtml(block.text)); setEditOpen(true) }}
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(stripHtml(block.text) || '…', { throwOnError: false })
          }}
        />
        {editOpen && (
          <div className="url-pop" data-pop={`math-${block.id}`} style={{ left: 8, top: 'auto', bottom: 8 }}>
            <textarea
              className="db-input"
              style={{ width: 320, height: 70 }}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="E = mc^2"
            />
            <button className="db-btn" onClick={() => { handlers.onChangeText(block.id, draft); setEditOpen(false) }}>OK</button>
            <button className="db-btn" onClick={() => setEditOpen(false)}>✕</button>
          </div>
        )}
      </div>
    )
  }

  if (block.type === 'progress') {
    const p = block.progress ?? 0
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div className="block-progress-wrap">
          <div className="block-progress-track">
            <div className="block-progress-bar" style={{ width: `${p}%` }} />
          </div>
          <span className="db-type">{p}%</span>
        </div>
        {active && (
          <input
            type="range"
            min={0}
            max={100}
            value={p}
            className="block-progress-range"
            onChange={(e) => handlers.onChangeProgress(block.id, Number(e.target.value))}
          />
        )}
      </div>
    )
  }

  if (block.type === 'qr') {
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div className="block-qr">
          <QRCodeSVG value={stripHtml(block.text) || 'https://kam-wald.github.io/skouar/'} size={140} />
        </div>
        <div
          id={`bloc-${block.id}`}
          ref={ref}
          className="block block-qr-text"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={PLACEHOLDERS.qr}
          onFocus={() => handlers.onActivate(block.id)}
          onInput={(e) => handlers.onChangeText(block.id, e.currentTarget.innerHTML)}
          onKeyDown={handleKeyDown}
        />
      </div>
    )
  }

  if (block.type === 'countdown') {
    const [, setTick] = useState(0)
    useEffect(() => {
      const t = setInterval(() => setTick((x) => x + 1), 1000)
      return () => clearInterval(t)
    }, [])
    const target = block.due ? new Date(block.due).getTime() : null
    const diff = target ? target - Date.now() : null
    const fmt = (ms: number) => {
      const s = Math.max(0, Math.floor(ms / 1000))
      const d = Math.floor(s / 86400)
      const h = Math.floor((s % 86400) / 3600)
      const m = Math.floor((s % 3600) / 60)
      const sec = s % 60
      return `${d}j ${h}h ${m}m ${sec}s`
    }
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div className="block-countdown">
          <span className="block-countdown-time">{diff == null ? '⏳ aucune date' : diff <= 0 ? '🎉 Terminé !' : fmt(diff)}</span>
          <button className={`todo-due-btn${block.due ? ' set' : ''}`} title="Choisir la date cible" data-pop={`due-${block.id}`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setDuePop({ x: r.left, y: r.bottom }) }}>⏰</button>
        </div>
        {duePop && (
          <div className="url-pop" data-pop={`due-${block.id}`} style={{ left: duePop.x, top: duePop.y + 6 }}>
            <input type="datetime-local" className="db-input" autoFocus defaultValue={block.due ?? undefined}
              onKeyDown={(e) => { if (e.key === 'Enter') { handlers.onSetDue(block.id, (e.target as HTMLInputElement).value || null); setDuePop(null) } if (e.key === 'Escape') setDuePop(null) }} />
            <button className="db-btn" onClick={(e) => { const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input'); handlers.onSetDue(block.id, input?.value || null); setDuePop(null) }}>OK</button>
          </div>
        )}
      </div>
    )
  }

  if (block.type === 'gallery') {
    const galRef = useRef<HTMLInputElement>(null)
    const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'))
      e.target.value = ''
      if (!files.length) return
      const srcs: string[] = []
      let pending = files.length
      for (const f of files) {
        const reader = new FileReader()
        reader.onload = () => {
          srcs.push(String(reader.result))
          if (--pending === 0) handlers.onAddGallery(block.id, srcs)
        }
        reader.readAsDataURL(f)
      }
    }
    return (
      <div className={`block-row block-gallery-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div className="block-gallery">
          {(block.srcs ?? []).map((s) => (
            <span key={s} className="block-gallery-item">
              <img src={s} alt="" />
              <button className="block-row-del" onClick={() => handlers.onRemoveGallery(block.id, s)}>×</button>
            </span>
          ))}
          <button className="block-media-pick" onClick={() => galRef.current?.click()}>＋ images…</button>
          <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        </div>
      </div>
    )
  }

  if (block.type === 'pageembed') {
    const target = handlers.pagesList.find((p) => p.id === block.pageId)
    return (
      <div className={`block-row${active ? ' block-active' : ''}${over ? ' drag-over' : ''}`} {...rowDropProps}>
        {dragHandle}
        <div className="block-pageembed">
          <select
            className="db-select"
            value={block.pageId ?? ''}
            onChange={(e) => handlers.onSetPage(block.id, e.target.value || undefined)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <option value="">Choisir une page…</option>
            {handlers.pagesList.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          {target && (
            <button className="block-pageembed-card" onClick={() => handlers.onOpenPage(target.id)}>
              <strong>{target.title}</strong>
            </button>
          )}
        </div>
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
          allDbs={handlers.allDbs}
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
            <div className="url-pop" data-pop={`due-${block.id}`} style={{ left: duePop.x, top: duePop.y + 6 }}>
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
  popKey,
  onSubmit,
  onClose
}: {
  x: number
  y: number
  value: string
  placeholder: string
  popKey: string
  onSubmit: (v: string) => void
  onClose: () => void
}) {
  const [v, setV] = useState(value)
  return (
    <div className="url-pop" data-pop={popKey} style={{ left: x, top: y + 6 }}>
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
