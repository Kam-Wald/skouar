import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent
} from 'react'
import { Link } from 'react-router-dom'
import type { Block, BlockType, BlocsState, Database, Page } from './types'
import { createBlock, createDatabase, createPage, loadState, saveState } from './store'
import { exportStateToFile, isBlocsState, parseImportFile } from './export'
import { readRemoteState, startSync, type SyncHandle } from './sync'
import DatabaseView from './DatabaseView'

const BLOCK_TYPES = [
  { type: 'paragraph', label: '¶', title: 'Paragraphe' },
  { type: 'h1', label: 'H1', title: 'Titre 1' },
  { type: 'h2', label: 'H2', title: 'Titre 2' },
  { type: 'h3', label: 'H3', title: 'Titre 3' },
  { type: 'bullet', label: '•', title: 'Liste à puces' },
  { type: 'todo', label: '☑', title: 'Tâche' },
  { type: 'quote', label: '❝', title: 'Citation' },
  { type: 'code', label: '</>', title: 'Bloc de code' },
  { type: 'divider', label: '―', title: 'Séparateur' },
  { type: 'image', label: '🖼', title: 'Image' },
  { type: 'database', label: '▦', title: 'Base de données' }
] as const

type BlockTypeDef = (typeof BLOCK_TYPES)[number]

const PLACEHOLDERS: Record<BlockType, string> = {
  paragraph: 'Écris quelque chose… (Entrée = nouveau bloc, / = menu)',
  h1: 'Titre 1',
  h2: 'Titre 2',
  h3: 'Titre 3',
  bullet: 'Élément de liste',
  todo: 'Tâche à faire',
  quote: 'Citation',
  code: 'Code…',
  divider: '',
  image: '',
  database: 'Base de données'
}

const EMOJIS = [
  '▦', '📄', '📝', '✅', '⭐', '🔥', '💡', '📌',
  '🗂️', '🧠', '🎯', '🚀', '🌱', '🏠', '📚', '🎨',
  '🔒', '❤️', '🐰', '🌙', '⚡', '🧩'
]

interface BlockViewProps {
  block: Block
  active: boolean
  slashActive: boolean
  onActivate: (id: string) => void
  onChangeText: (id: string, text: string) => void
  onChangeSrc: (id: string, src: string | undefined) => void
  onToggleDone: (id: string) => void
  onChangeDb: (id: string, db: Database) => void
  onEnter: (id: string) => void
  onBackspaceEmpty: (id: string) => void
  onSlashNav: (dir: 1 | -1) => void
  onSlashEnter: () => void
  onSlashEscape: () => void
}

function BlockView({
  block,
  active,
  slashActive,
  onActivate,
  onChangeText,
  onChangeSrc,
  onToggleDone,
  onChangeDb,
  onEnter,
  onBackspaceEmpty,
  onSlashNav,
  onSlashEnter,
  onSlashEscape
}: BlockViewProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== block.text) el.textContent = block.text
  }, [block.text])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (slashActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        onSlashNav(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        onSlashNav(-1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onSlashEnter()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onSlashEscape()
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnter(block.id)
    } else if (e.key === 'Backspace' && (el?.textContent ?? '') === '') {
      e.preventDefault()
      onBackspaceEmpty(block.id)
    }
  }

  if (block.type === 'divider') {
    return (
      <div
        className={`block-row block-divider-row${active ? ' block-active' : ''}`}
        tabIndex={-1}
        onFocus={() => onActivate(block.id)}
      >
        <hr className="block-divider" />
        <button
          className="block-row-del"
          title="Supprimer le séparateur"
          onClick={() => onBackspaceEmpty(block.id)}
        >
          ×
        </button>
      </div>
    )
  }

  if (block.type === 'image') {
    return (
      <div
        className={`block-row${active ? ' block-active' : ''}`}
        onFocus={() => onActivate(block.id)}
      >
        {block.src ? (
          <img
            className="block-image"
            src={block.src}
            alt=""
            title="Cliquer pour changer l’URL"
            onClick={() => {
              const u = window.prompt('URL de l’image :', block.src)
              if (u !== null) onChangeSrc(block.id, u || undefined)
            }}
          />
        ) : (
          <input
            className="block-image-input"
            placeholder="Colle l’URL d’une image…"
            onFocus={() => onActivate(block.id)}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => onChangeSrc(block.id, e.target.value || undefined)}
          />
        )}
      </div>
    )
  }

  if (block.type === 'database') {
    return (
      <div
        className={`block-row block-db${active ? ' block-active' : ''}`}
        onFocus={() => onActivate(block.id)}
      >
        <DatabaseView
          db={block.db ?? createDatabase()}
          title={block.text}
          onTitle={(t) => onChangeText(block.id, t)}
          onChange={(db) => onChangeDb(block.id, db)}
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
          onChange={() => onToggleDone(block.id)}
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
        onFocus={() => onActivate(block.id)}
        onInput={(e) => onChangeText(block.id, e.currentTarget.textContent ?? '')}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function PageTree({
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

export default function BlocsApp() {
  const [state, setState] = useState<BlocsState | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const [sync, setSync] = useState<SyncHandle | null>(null)
  const lastJson = useRef('')
  const [query, setQuery] = useState('')
  const [iconOpen, setIconOpen] = useState(false)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)

  useEffect(() => {
    let alive = true
    loadState().then((s) => {
      if (alive) setState(s)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => {
      void saveState(state)
    }, 200)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (!state || !sync) return
    const t = setTimeout(() => {
      const json = JSON.stringify(state)
      lastJson.current = json
      sync.doc.transact(() => {
        sync.doc.getMap('blocs').set('state', json)
      })
    }, 400)
    return () => clearTimeout(t)
  }, [state, sync])

  useEffect(() => {
    if (!sync) return
    const map = sync.doc.getMap('blocs')
    const handler = () => {
      const json = map.get('state')
      if (typeof json === 'string' && json !== lastJson.current) {
        lastJson.current = json
        try {
          const parsed: unknown = JSON.parse(json)
          if (isBlocsState(parsed)) setState(parsed)
        } catch {
          // ignore
        }
      }
    }
    map.observe(handler)
    return () => {
      map.unobserve(handler)
    }
  }, [sync])

  useEffect(() => {
    if (pendingFocus.current) {
      const el = document.getElementById(`bloc-${pendingFocus.current}`)
      if (el) {
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      pendingFocus.current = null
    }
  })

  const q = query.trim().toLowerCase()
  const matches =
    q && state
      ? state.pages.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.blocks.some(
              (b) =>
                b.text.toLowerCase().includes(q) ||
                (b.db?.rows ?? []).some((r) =>
                  Object.values(r.cells).some((v) =>
                    String(v ?? '').toLowerCase().includes(q)
                  )
                )
            )
        )
      : null

  const current: Page | undefined =
    state?.pages.find((p) => p.id === state.currentPageId) ?? state?.pages[0]

  const slashBlock = current?.blocks.find(
    (b) => b.text.startsWith('/') && b.text.length <= 40
  )
  const slashQuery = slashBlock ? slashBlock.text.slice(1).toLowerCase() : ''
  const slashItems = BLOCK_TYPES.filter(
    (t) =>
      !slashQuery ||
      t.title.toLowerCase().includes(slashQuery) ||
      t.label.toLowerCase().includes(slashQuery)
  )
  const slashOpen = !!slashBlock && !slashDismissed && slashItems.length > 0

  const updatePage = (pageId: string, patch: Partial<Page>) =>
    setState((s) =>
      s
        ? {
            ...s,
            pages: s.pages.map((p) =>
              p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p
            )
          }
        : s
    )

  const updateBlock = (id: string, patch: Partial<Block>) => {
    if (!state || !current) return
    if ('text' in patch) {
      setSlashDismissed(false)
      setSlashIndex(0)
    }
    updatePage(current.id, {
      blocks: current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
    })
  }

  const applySlash = (t: BlockTypeDef) => {
    if (!slashBlock) return
    updateBlock(slashBlock.id, {
      type: t.type,
      text: '',
      done: t.type === 'todo' ? false : undefined,
      src: undefined,
      db: t.type === 'database' ? createDatabase() : undefined
    })
    setSlashDismissed(true)
  }

  const insertBlockAfter = (afterId: string, type: BlockType = 'paragraph') => {
    if (!state || !current) return
    const index = current.blocks.findIndex((b) => b.id === afterId)
    const block = createBlock(type)
    const blocks = [...current.blocks]
    blocks.splice(index + 1, 0, block)
    updatePage(current.id, { blocks })
    pendingFocus.current = block.id
  }

  const deleteBlock = (id: string) => {
    if (!state || !current) return
    const index = current.blocks.findIndex((b) => b.id === id)
    if (index < 0) return
    const blocks = current.blocks.filter((b) => b.id !== id)
    if (blocks.length === 0) blocks.push(createBlock())
    updatePage(current.id, { blocks })
    const target = blocks[Math.max(0, index - 1)]
    pendingFocus.current = target.id
  }

  const handleEnter = (id: string) => {
    if (!state || !current) return
    const block = current.blocks.find((b) => b.id === id)
    insertBlockAfter(id, block?.type === 'todo' ? 'todo' : 'paragraph')
  }

  const addPage = (parentId: string | null = null) => {
    const page = createPage('Nouvelle page', parentId)
    setState((s) =>
      s ? { pages: [page, ...s.pages], currentPageId: page.id } : s
    )
  }

  const deletePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const page = s.pages.find((p) => p.id === id)
      const newParent = page?.parentId ?? null
      const pages = s.pages
        .filter((p) => p.id !== id)
        .map((p) => (p.parentId === id ? { ...p, parentId: newParent } : p))
      const next = pages.length > 0 ? pages : [createPage('Nouvelle page')]
      return {
        pages: next,
        currentPageId: s.currentPageId === id ? next[0].id : s.currentPageId
      }
    })
  }

  const promotePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const p = s.pages.find((x) => x.id === id)
      if (!p) return s
      const parent = s.pages.find((x) => x.id === p.parentId)
      return {
        ...s,
        pages: s.pages.map((x) =>
          x.id === id ? { ...x, parentId: parent?.parentId ?? null } : x
        )
      }
    })
  }

  const toggleSync = () => {
    if (sync) {
      sync.leave()
      setSync(null)
      return
    }
    const input = window.prompt(
      'Code de salon de synchro (jusqu’à 12 caractères). Laisse vide pour en générer un :',
      ''
    )
    if (input === null) return
    const code = (input.trim() || Math.random().toString(36).slice(2, 8)).slice(0, 12)
    const handle = startSync(code)
    setSync(handle)
    setTimeout(() => {
      const remote = readRemoteState(handle.doc)
      if (remote && remote !== lastJson.current) {
        lastJson.current = remote
        try {
          const parsed: unknown = JSON.parse(remote)
          if (isBlocsState(parsed)) setState(parsed)
        } catch {
          // ignore
        }
      }
    }, 1500)
    window.alert(
      `Salon « ${code} » ouvert. Sur l’autre appareil (desktop/tablette), ouvre Blocs → ⇄ Sync et entre ce même code.`
    )
  }

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !state) return
    try {
      const imported = await parseImportFile(file)
      const ok = window.confirm(
        `Remplacer les ${state.pages.length} page(s) actuelles par celles du fichier « ${file.name} » ?`
      )
      if (ok) setState(imported)
    } catch {
      window.alert('Fichier invalide : un export JSON de Skouar/Blocs est attendu.')
    }
  }

  const setCoverFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !current) return
    if (f.size > 2_000_000) {
      window.alert('Image trop lourde (max 2 Mo) : compresse-la ou utilise une URL.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => updatePage(current.id, { cover: String(reader.result) })
    reader.readAsDataURL(f)
  }

  const setCoverUrl = () => {
    if (!current) return
    const u = window.prompt('URL de l’image de couverture :', current.cover ?? '')
    if (u !== null) updatePage(current.id, { cover: u || null })
  }

  if (!state || !current) {
    return (
      <div className="blocs-app">
        <main className="blocs-main">
          <p className="blocs-loading">Chargement…</p>
        </main>
      </div>
    )
  }

  const slashEl = slashBlock ? document.getElementById(`bloc-${slashBlock.id}`) : null
  const slashRect = slashEl?.getBoundingClientRect()

  return (
    <div className="blocs-app">
      <aside className="blocs-sidebar">
        <Link to="/" className="blocs-back">
          ← Skouar
        </Link>
        <input
          className="blocs-search"
          placeholder="Rechercher dans les pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="blocs-sidebar-head">
          <span>Pages</span>
          <button className="blocs-new-page" onClick={() => addPage()} title="Nouvelle page">
            ＋
          </button>
        </div>
        <ul className="blocs-page-list">
          {matches
            ? matches.map((p) => (
                <li key={p.id}>
                  <div className="blocs-page-row">
                    <button
                      className={`blocs-page-item${p.id === current.id ? ' selected' : ''}`}
                      onClick={() =>
                        setState((s) => (s ? { ...s, currentPageId: p.id } : s))
                      }
                    >
                      {p.icon && <span className="blocs-page-icon">{p.icon}</span>}
                      {p.title.trim() || 'Sans titre'}
                    </button>
                  </div>
                </li>
              ))
            : (
              <PageTree
                pages={state.pages}
                parentId={null}
                depth={0}
                currentId={current.id}
                onSelect={(id) =>
                  setState((s) => (s ? { ...s, currentPageId: id } : s))
                }
                onDelete={deletePage}
                onAddChild={(id) => addPage(id)}
                onPromote={promotePage}
              />
            )}
        </ul>
        <div className="blocs-sidebar-foot">
          <button
            className={`blocs-io${sync ? ' active' : ''}`}
            onClick={toggleSync}
            title="Synchroniser avec un autre appareil (P2P, aucun serveur)"
          >
            {sync ? `⇄ ${sync.code}` : '⇄ Sync'}
          </button>
          <button className="blocs-io" onClick={() => exportStateToFile(state)}>
            ↓ Exporter
          </button>
          <button className="blocs-io" onClick={() => fileInput.current?.click()}>
            ↑ Importer
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImport}
          />
        </div>
      </aside>
      <main className="blocs-main">
        {current.cover && (
          <div className="page-cover">
            <img src={current.cover} alt="couverture de la page" />
            <div className="page-cover-actions">
              <button onClick={() => coverInput.current?.click()}>Changer</button>
              <button onClick={setCoverUrl}>URL…</button>
              <button onClick={() => updatePage(current.id, { cover: null })}>
                Supprimer
              </button>
            </div>
          </div>
        )}
        <div className="page-head">
          <div className="page-icon-wrap">
            <button
              className="page-icon-btn"
              title="Icône de la page"
              onClick={() => setIconOpen((o) => !o)}
            >
              {current.icon ?? '＋'}
            </button>
            {iconOpen && (
              <div className="emoji-pop">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      updatePage(current.id, { icon: e })
                      setIconOpen(false)
                    }}
                  >
                    {e}
                  </button>
                ))}
                <button
                  title="Retirer l’icône"
                  onClick={() => {
                    updatePage(current.id, { icon: null })
                    setIconOpen(false)
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <input
            className="blocs-title"
            value={current.title}
            placeholder="Sans titre"
            onChange={(e) => updatePage(current.id, { title: e.target.value })}
          />
        </div>
        {!current.cover && (
          <div className="page-cover-add">
            <button className="blocs-io" onClick={() => coverInput.current?.click()}>
              🖼 Ajouter une couverture (fichier)
            </button>
            <button className="blocs-io" onClick={setCoverUrl}>
              🔗 Couverture via URL
            </button>
          </div>
        )}
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={setCoverFile}
        />
        <div className="blocs-toolbar">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.type}
              title={t.title}
              className={
                activeId &&
                current.blocks.find((b) => b.id === activeId)?.type === t.type
                  ? 'tool active'
                  : 'tool'
              }
              onClick={() => {
                if (!activeId) return
                if (t.type === 'database') {
                  const existing = current.blocks.find((b) => b.id === activeId)
                  updateBlock(activeId, {
                    type: 'database',
                    done: undefined,
                    src: undefined,
                    db: existing?.db ?? createDatabase()
                  })
                } else {
                  updateBlock(activeId, {
                    type: t.type,
                    done: t.type === 'todo' ? false : undefined,
                    src: undefined,
                    db: undefined
                  })
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="blocs-editor">
          {current.blocks.map((b) => (
            <BlockView
              key={b.id}
              block={b}
              active={activeId === b.id}
              slashActive={slashOpen && slashBlock?.id === b.id}
              onActivate={setActiveId}
              onChangeText={(id, text) => updateBlock(id, { text })}
              onChangeSrc={(id, src) => updateBlock(id, { src })}
              onToggleDone={(id) =>
                updateBlock(id, {
                  done: !(current.blocks.find((x) => x.id === id)?.done ?? false)
                })
              }
              onChangeDb={(id, db) => updateBlock(id, { db })}
              onEnter={handleEnter}
              onBackspaceEmpty={deleteBlock}
              onSlashNav={(dir) =>
                setSlashIndex(
                  (i) => (i + dir + slashItems.length) % slashItems.length
                )
              }
              onSlashEnter={() => {
                const item = slashItems[slashIndex]
                if (item) applySlash(item)
              }}
              onSlashEscape={() => setSlashDismissed(true)}
            />
          ))}
        </div>
        <button
          className="blocs-add"
          onClick={() =>
            insertBlockAfter(current.blocks[current.blocks.length - 1].id)
          }
        >
          ＋ Ajouter un bloc
        </button>
        {slashOpen && slashBlock && slashRect && (
          <div
            className="slash-menu"
            style={{ left: slashRect.left, top: slashRect.bottom + 6 }}
          >
            {slashItems.map((t, i) => (
              <button
                key={t.type}
                className={`slash-item${i === slashIndex ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() => applySlash(t)}
              >
                <span className="slash-label">{t.label}</span> {t.title}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
