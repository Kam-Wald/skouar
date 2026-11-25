import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent
} from 'react'
import { Link } from 'react-router-dom'
import type { Block, BlocsState, Page } from './types'
import { createBlock, createDatabase, createPage, loadState, saveState } from './store'
import { exportStateToFile, isBlocsState, parseImportFile } from './export'
import { readRemoteState, startSync, type SyncHandle } from './sync'
import { BLOCK_TYPES, type BlockTypeDef } from './blockTypes'
import { deleteFrom, findBlock, flattenBlocks, insertAfter, patchBlock } from './tree'
import BlockView, { type BlockHandlers } from './BlockView'
import PageTree from './PageTree'

const EMOJIS = [
  '▦', '📄', '📝', '✅', '⭐', '🔥', '💡', '📌',
  '🗂️', '🧠', '🎯', '🚀', '🌱', '🏠', '📚', '🎨',
  '🔒', '❤️', '🐰', '🌙', '⚡', '🧩'
]

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
      ? state.pages.filter((p) => {
          const blocks = flattenBlocks(p.blocks)
          return (
            p.title.toLowerCase().includes(q) ||
            blocks.some(
              (b) =>
                b.text.toLowerCase().includes(q) ||
                (b.db?.rows ?? []).some((r) =>
                  Object.values(r.cells).some((v) =>
                    String(v ?? '').toLowerCase().includes(q)
                  )
                )
            )
          )
        })
      : null

  const current: Page | undefined =
    state?.pages.find((p) => p.id === state.currentPageId) ?? state?.pages[0]

  const allBlocks = current ? flattenBlocks(current.blocks) : []

  const slashBlock = allBlocks.find(
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

  const headings = allBlocks
    .filter((b) => b.type === 'h1' || b.type === 'h2' || b.type === 'h3')
    .map((b) => ({
      id: b.id,
      text: b.text,
      level: b.type === 'h1' ? 1 : b.type === 'h2' ? 2 : 3
    }))

  const crumbs: Page[] = []
  if (current && state) {
    let pid: string | null | undefined = current.parentId ?? null
    while (pid) {
      const p = state.pages.find((x) => x.id === pid)
      if (!p) break
      crumbs.unshift(p)
      pid = p.parentId ?? null
    }
  }

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
    updatePage(current.id, { blocks: patchBlock(current.blocks, id, patch) })
  }

  const applySlash = (t: BlockTypeDef) => {
    if (!slashBlock) return
    const existing = findBlock(current!.blocks, slashBlock.id)
    updateBlock(slashBlock.id, {
      type: t.type,
      text: '',
      done: t.type === 'todo' ? false : undefined,
      src: undefined,
      href: undefined,
      fileName: undefined,
      fileSize: undefined,
      db: t.type === 'database' ? (existing?.db ?? createDatabase()) : undefined,
      children: t.type === 'toggle' ? (existing?.children ?? []) : undefined
    })
    setSlashDismissed(true)
  }

  const insertBlockAfter = (afterId: string) => {
    if (!state || !current) return
    const block = createBlock('paragraph')
    updatePage(current.id, {
      blocks: insertAfter(current.blocks, afterId, block)
    })
    pendingFocus.current = block.id
  }

  const deleteBlock = (id: string) => {
    if (!state || !current) return
    const flat = flattenBlocks(current.blocks)
    const index = flat.findIndex((b) => b.id === id)
    if (index < 0) return
    let blocks = deleteFrom(current.blocks, id)
    if (blocks.length === 0) blocks = [createBlock()]
    updatePage(current.id, { blocks })
    const target = flat[Math.max(0, index - 1)]
    if (target && target.id !== id) pendingFocus.current = target.id
  }

  const handleEnter = (id: string) => {
    const block = current ? findBlock(current.blocks, id) : undefined
    if (!block) return
    const nb = createBlock(block.type === 'todo' ? 'todo' : 'paragraph')
    if (!state || !current) return
    updatePage(current.id, {
      blocks: insertAfter(current.blocks, id, nb)
    })
    pendingFocus.current = nb.id
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

  const handlers: BlockHandlers = {
    headings,
    isActive: (id) => activeId === id,
    onActivate: setActiveId,
    onChangeText: (id, text) => updateBlock(id, { text }),
    onChangeSrc: (id, src) => updateBlock(id, { src }),
    onChangeHref: (id, href) => updateBlock(id, { href }),
    onChangeFile: (id, f) =>
      updateBlock(
        id,
        f
          ? { src: f.src, fileName: f.fileName, fileSize: f.fileSize }
          : { src: undefined, fileName: undefined, fileSize: undefined }
      ),
    onToggleDone: (id) => {
      const b = findBlock(current.blocks, id)
      updateBlock(id, { done: !(b?.done ?? false) })
    },
    onChangeDb: (id, db) => updateBlock(id, { db }),
    onEnter: handleEnter,
    onDelete: deleteBlock,
    isSlashActive: (id) => slashOpen && slashBlock?.id === id,
    onSlashNav: (dir) =>
      setSlashIndex((i) => (i + dir + slashItems.length) % slashItems.length),
    onSlashEnter: () => {
      const item = slashItems[slashIndex]
      if (item) applySlash(item)
    },
    onSlashEscape: () => setSlashDismissed(true)
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
        <div className="breadcrumb">
          {crumbs.map((c) => (
            <span key={c.id} className="crumb-wrap">
              <button
                className="crumb"
                onClick={() =>
                  setState((s) => (s ? { ...s, currentPageId: c.id } : s))
                }
              >
                {c.icon} {c.title.trim() || 'Sans titre'}
              </button>
              <span className="crumb-sep">/</span>
            </span>
          ))}
          <span className="crumb current">
            {current.icon} {current.title.trim() || 'Sans titre'}
          </span>
        </div>
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
                activeId && findBlock(current.blocks, activeId)?.type === t.type
                  ? 'tool active'
                  : 'tool'
              }
              onClick={() => {
                if (!activeId) return
                const existing = findBlock(current.blocks, activeId)
                updateBlock(activeId, {
                  type: t.type,
                  done: t.type === 'todo' ? false : undefined,
                  src: undefined,
                  href: undefined,
                  fileName: undefined,
                  fileSize: undefined,
                  db:
                    t.type === 'database'
                      ? (existing?.db ?? createDatabase())
                      : undefined,
                  children: t.type === 'toggle' ? (existing?.children ?? []) : undefined
                })
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="blocs-editor">
          {current.blocks.map((b) => (
            <BlockView key={b.id} block={b} handlers={handlers} />
          ))}
        </div>
        <button
          className="blocs-add"
          onClick={() => insertBlockAfter(current.blocks[current.blocks.length - 1].id)}
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
