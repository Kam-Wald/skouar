import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type DragEvent as ReactDragEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Block, BlockType, BlocsState, Page } from './types'
import { createBlock, createColumn, createDatabase, createPage, loadState, saveState, uid } from './store'
import { exportStateToFile, isBlocsState, parseImportFile } from './export'
import { readRemoteState, startSync, type SyncHandle } from './sync'
import { BLOCK_CATS, BLOCK_CAT_ORDER, BLOCK_TYPES, type BlockTypeDef } from './blockTypes'
import {
  deleteFrom,
  descendantsOf,
  findBlock,
  flattenBlocks,
  insertAfter,
  mentionsIn,
  moveBlockInTree,
  moveSibling,
  patchBlock,
  stripHtml
} from './tree'
import BlockView, { type BlockHandlers } from './BlockView'
import PageTree from './PageTree'
import EmojiPicker from './EmojiPicker'
import { useDismiss } from './useDismiss'
import CoverMenu from './CoverMenu'
import { coverStyle } from './covers'
import { TEMPLATES, type TemplateSpec } from './templates'
import { exportFile, parseMarkdown, toMarkdown } from './markdown'
import ThemeButton from '../../ThemeButton'
import GraphView from './GraphView'
import DashboardView from './DashboardView'
import { exportPageHtml } from './share'
import AppIcon from './Icon'

const TAG_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'hier'
  if (d < 7) return `il y a ${d} j`
  return new Date(ts).toLocaleDateString('fr-FR')
}

function tagColor(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({
    ...b,
    id: uid(),
    db: b.db ? { ...b.db, id: uid(), columns: b.db.columns.map((c) => ({ ...c, id: uid() })), rows: b.db.rows.map((r) => ({ ...r, id: uid(), cells: { ...r.cells } })) } : undefined,
    children: b.children ? cloneBlocks(b.children) : undefined
  }))
}

export default function BlocsApp() {
  const [state, setState] = useState<BlocsState | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragBlockId = useRef<string | null>(null)
  const pastRef = useRef<BlocsState[]>([])
  const futureRef = useRef<BlocsState[]>([])
  const lastPush = useRef(0)
  const prevState = useRef<BlocsState | null>(null)
  const [sync, setSync] = useState<SyncHandle | null>(null)
  const lastJson = useRef('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [iconOpen, setIconOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [coverMenu, setCoverMenu] = useState<{ x: number; y: number } | null>(null)
  const [tplOpen, setTplOpen] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [dashOpen, setDashOpen] = useState(false)
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem('skouar:sidebarW'))
    return Number.isFinite(v) && v >= 180 && v <= 440 ? v : 240
  })
  const [linksOpen, setLinksOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [mentionDismissed, setMentionDismissed] = useState(false)
  const [toast, setToast] = useState<{ key: number; msg: string; action?: () => void } | null>(null)
  const [ctx, setCtx] = useState<null | { x: number; y: number; items: { label: string; icon?: string; danger?: boolean; onClick: () => void }[] }>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)

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
    if (!state) return
    const prev = prevState.current
    prevState.current = state
    if (!prev) return
    const t = setTimeout(() => {
      const now = Date.now()
      if (now - lastPush.current > 500) {
        pastRef.current.push(prev)
        if (pastRef.current.length > 100) pastRef.current.shift()
        futureRef.current = []
        lastPush.current = now
      }
    }, 500)
    return () => clearTimeout(t)
  }, [state])

  const undo = () => {
    const past = pastRef.current
    if (!past.length || !state) return
    const prev = past[past.length - 1]
    pastRef.current = past.slice(0, -1)
    futureRef.current.push(state)
    setState(prev)
  }
  const redo = () => {
    const future = futureRef.current
    if (!future.length || !state) return
    const next = future[future.length - 1]
    futureRef.current = future.slice(0, -1)
    pastRef.current.push(state)
    setState(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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

  const livePages = state?.pages.filter((p) => !p.deletedAt) ?? []
  const trashPages = state?.pages.filter((p) => p.deletedAt) ?? []

  const dueTodos = state
    ? livePages.flatMap((p) =>
        flattenBlocks(p.blocks)
          .filter((b) => b.type === 'todo' && !b.done && b.due)
          .map((b) => ({ page: p, block: b }))
      )
    : []
  const overdue = dueTodos.filter((d) => new Date(d.block.due!).getTime() <= Date.now())
  const soon48 = dueTodos.filter((d) => new Date(d.block.due!).getTime() <= Date.now() + 48 * 3600 * 1000)

  useEffect(() => {
    if (!state) return
    const check = () => {
      const now = Date.now()
      const toNotify = livePages.flatMap((p) =>
        flattenBlocks(p.blocks).filter(
          (b) => b.type === 'todo' && !b.done && b.due && new Date(b.due).getTime() <= now && !b.notified
        ).map((b) => ({ page: p, block: b }))
      )
      if (!toNotify.length) return
      if (Notification.permission === 'granted') {
        for (const d of toNotify) {
          new Notification('⏰ Calepin', {
            body: `${stripHtml(d.block.text) || 'Tâche'} — ${stripHtml(d.page.title).trim() || 'page'}`
          })
        }
      }
      const ids = new Set(toNotify.map((d) => d.block.id))
      setState((s) =>
        s
          ? {
              ...s,
              pages: s.pages.map((p) => ({
                ...p,
                blocks: toNotify
                  .filter((d) => d.page.id === p.id)
                  .reduce((blocks, d) => patchBlock(blocks, d.block.id, { notified: true }), p.blocks)
              }))
            }
          : s
      )
    }
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [state, livePages])

  const allDbs = livePages.flatMap((p) =>
    flattenBlocks(p.blocks)
      .filter((b) => b.type === 'database' && b.db)
      .map((b) => ({ id: b.db!.id, db: b.db! }))
  )
  const pagesList = livePages.map((p) => ({ id: p.id, title: stripHtml(p.title).trim() || 'Sans titre' }))

  const runAction = (buttonId: string) => {
    if (!state || !current) return
    const btn = findBlock(current.blocks, buttonId)
    if (!btn?.action) return
    const src = findBlock(current.blocks, btn.action.repeatBlockId)
    if (!src) return
    const copies = Array.from({ length: btn.action.count }, () => {
      const c = JSON.parse(JSON.stringify(src)) as Block
      c.id = uid()
      return c
    })
    let blocks = current.blocks
    for (const c of copies) blocks = insertAfter(blocks, buttonId, c)
    updatePage(current.id, { blocks })
  }

  const openJournal = () => {
    const today = new Date().toISOString().slice(0, 10)
    setState((s) => {
      if (!s) return s
      const existing = s.pages.find((p) => !p.deletedAt && stripHtml(p.title).trim() === today)
      if (existing) return { ...s, currentPageId: existing.id }
      const tpl = TEMPLATES.find((t) => t.name === 'Journal quotidien') ?? TEMPLATES[0]
      const page = createPage(today)
      page.icon = '📅'
      page.blocks = tpl.blocks.map((b) => {
        const nb = createBlock(b.type as BlockType, b.text)
        if (b.done !== undefined) nb.done = b.done
        return nb
      })
      const h1 = page.blocks.find((b) => b.type === 'h1')
      if (h1) h1.text = `Journal — ${today}`
      return { pages: [page, ...s.pages], currentPageId: page.id }
    })
    setSidebarOpen(false)
  }

  const q = query.trim().toLowerCase()
  const matches =
    q && state
      ? livePages
          .filter((p) => {
            if (typeFilter === 'heading') return flattenBlocks(p.blocks).some((b) => ['h1','h2','h3','h4'].includes(b.type) && stripHtml(b.text).toLowerCase().includes(q))
            if (typeFilter === 'todo') return flattenBlocks(p.blocks).some((b) => b.type === 'todo' && stripHtml(b.text).toLowerCase().includes(q))
            if (typeFilter === 'db') return flattenBlocks(p.blocks).some((b) => b.type === 'database' && (b.db?.rows ?? []).some((r) => Object.values(r.cells).some((v) => String(v ?? '').toLowerCase().includes(q))))
            if (typeFilter === 'text') return p.title.toLowerCase().includes(q) || flattenBlocks(p.blocks).some((b) => b.type !== 'database' && stripHtml(b.text).toLowerCase().includes(q))
            return p.title.toLowerCase().includes(q) || flattenBlocks(p.blocks).some((b) => stripHtml(b.text).toLowerCase().includes(q) || (b.db?.rows ?? []).some((r) => Object.values(r.cells).some((v) => String(v ?? '').toLowerCase().includes(q))))
          })
          .map((p) => {
            const b = flattenBlocks(p.blocks).find((x) => stripHtml(x.text).toLowerCase().includes(q))
            const raw = b ? stripHtml(b.text) : p.title
            const i = raw.toLowerCase().indexOf(q)
            const start = Math.max(0, i - 30)
            const snippet = (start > 0 ? '…' : '') + raw.slice(start, start + 90)
            return { page: p, snippet, at: i >= 0 ? start : 0, raw }
          })
      : null

  const tagFiltered = tagFilter ? livePages.filter((p) => p.tags?.includes(tagFilter)) : livePages

  const current: Page | undefined =
    livePages.find((p) => p.id === state?.currentPageId) ?? livePages[0]

  const allBlocks = current ? flattenBlocks(current.blocks) : []
  const blocksList = allBlocks.map((b) => ({ id: b.id, label: (stripHtml(b.text).slice(0, 40) || b.type) }))

  const plain = (b: Block) => stripHtml(b.text)

  const slashBlock = allBlocks.find((b) => plain(b).startsWith('/') && plain(b).length <= 40)
  const slashQuery = slashBlock ? plain(slashBlock).slice(1).toLowerCase() : ''
  const slashItems = BLOCK_TYPES.filter(
    (t) => !slashQuery || t.title.toLowerCase().includes(slashQuery) || t.label.toLowerCase().includes(slashQuery)
  )
  const slashOpen = !!slashBlock && !slashDismissed && slashItems.length > 0
  const slashGroups = BLOCK_CAT_ORDER.map((cat) => ({
    cat,
    items: slashItems.map((t, i) => ({ t, i })).filter((x) => (BLOCK_CATS[x.t.type] ?? 'Avancé') === cat)
  })).filter((g) => g.items.length > 0)

  const mentionMatch = allBlocks.map((b) => ({ b, m: plain(b).match(/\[\[([^\]\[]*)$/) })).find((x) => x.m)
  const mentionQuery = mentionMatch?.m?.[1]?.toLowerCase() ?? ''
  const mentionPages = livePages.filter((p) => !mentionQuery || p.title.toLowerCase().includes(mentionQuery))
  const mentionOpen = !!mentionMatch && !mentionDismissed && mentionPages.length > 0

  useDismiss('icon', iconOpen, () => setIconOpen(false))
  useDismiss('tags', tagsOpen, () => setTagsOpen(false))
  useDismiss('cover', !!coverMenu, () => setCoverMenu(null))
  useDismiss('bell', bellOpen, () => setBellOpen(false))
  useDismiss('tpl', tplOpen, () => setTplOpen(false))
  useDismiss('slash', slashOpen, () => setSlashDismissed(true))
  useDismiss('mention', mentionOpen, () => setMentionDismissed(true))
  useDismiss('ctx', !!ctx, () => setCtx(null))

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (current?.id) updatePage(current.id, { lastOpened: Date.now() })
  }, [current?.id])

  const headings = allBlocks
    .filter((b) => ['h1', 'h2', 'h3', 'h4'].includes(b.type))
    .map((b) => ({
      id: b.id,
      text: plain(b),
      level: b.type === 'h1' ? 1 : b.type === 'h2' ? 2 : b.type === 'h3' ? 3 : 4
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

  const currentTitle = current ? (stripHtml(current.title).trim() || 'Sans titre') : ''
  const recents = livePages
    .filter((p) => p.lastOpened && p.id !== current?.id)
    .sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))
    .slice(0, 4)
  const pinnedPages = livePages.filter((p) => p.pinned)
  const pageTodos = allBlocks.filter((b) => b.type === 'todo')
  const pageTodosDone = pageTodos.filter((b) => b.done).length
  const incoming = state ? livePages.filter((p) => p.id !== current?.id && flattenBlocks(p.blocks).some((b) => mentionsIn(plain(b)).includes(currentTitle))) : []
  const outgoing = current ? [...new Set(allBlocks.flatMap((b) => mentionsIn(plain(b))))] : []

  const updatePage = (pageId: string, patch: Partial<Page>) =>
    setState((s) =>
      s
        ? { ...s, pages: s.pages.map((p) => (p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p)) }
        : s
    )

  const updateBlock = (id: string, patch: Partial<Block>) => {
    if (!state || !current) return
    if ('text' in patch) {
      setSlashDismissed(false)
      setMentionDismissed(false)
      setSlashIndex(0)
    }
    updatePage(current.id, { blocks: patchBlock(current.blocks, id, patch) })
  }

  const applySlash = (t: BlockTypeDef) => {
    if (!slashBlock || !current) return
    const existing = findBlock(current.blocks, slashBlock.id)
    updateBlock(slashBlock.id, {
      type: t.type,
      text: '',
      done: t.type === 'todo' ? false : undefined,
      src: undefined, href: undefined, fileName: undefined, fileSize: undefined,
      cols: t.type === 'columns' ? 2 : undefined,
      db: t.type === 'database' ? (existing?.db ?? createDatabase()) : undefined,
      children:
        t.type === 'toggle' ? (existing?.children ?? [])
          : t.type === 'columns' ? [createBlock('column'), createBlock('column')]
          : undefined
    })
    setSlashDismissed(true)
  }

  const applyMention = (title: string) => {
    if (!mentionMatch || !current) return
    const b = mentionMatch.b
    const before = plain(b).slice(0, mentionMatch.m!.index)
    const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    updateBlock(b.id, { text: `${before}[[${escaped}]] ` })
  }

  const insertBlockAfter = (afterId: string, block?: Block) => {
    if (!state || !current) return
    const nb = block ?? createBlock('paragraph')
    updatePage(current.id, { blocks: insertAfter(current.blocks, afterId, nb) })
    pendingFocus.current = nb.id
  }

  const addChildTo = (parentId: string) => {
    if (!state || !current) return
    const parent = findBlock(current.blocks, parentId)
    const nb = createBlock('paragraph')
    updatePage(current.id, {
      blocks: patchBlock(current.blocks, parentId, { children: [...(parent?.children ?? []), nb] })
    })
    pendingFocus.current = nb.id
  }

  const setCols = (id: string, n: number) => {
    if (!state || !current) return
    const b = findBlock(current.blocks, id)
    let cols = [...(b?.children ?? [])]
    while (cols.length < n) cols.push(createBlock('column'))
    if (cols.length > n) cols = cols.slice(0, n)
    updateBlock(id, { cols: n, children: cols })
  }

  const moveBlock = (id: string, targetId: string, after: boolean) => {
    if (!state || !current || id === targetId) return
    updatePage(current.id, { blocks: moveBlockInTree(current.blocks, id, targetId, after) })
  }

  const deleteBlock = (id: string) => {
    if (!state || !current) return
    const snapshot = current.blocks
    const flat = flattenBlocks(current.blocks)
    const index = flat.findIndex((b) => b.id === id)
    if (index < 0) return
    let blocks = deleteFrom(current.blocks, id)
    if (blocks.length === 0) blocks = [createBlock()]
    updatePage(current.id, { blocks })
    setToast({ key: Date.now(), msg: 'Bloc supprimé', action: () => updatePage(current.id, { blocks: snapshot }) })
    const target = flat[Math.max(0, index - 1)]
    if (target && target.id !== id) pendingFocus.current = target.id
  }

  const handleEnter = (id: string) => {
    const block = current ? findBlock(current.blocks, id) : undefined
    if (!block || !state || !current) return
    insertBlockAfter(id, createBlock(block.type === 'todo' ? 'todo' : 'paragraph'))
  }

  const createFromTemplate = (tpl: TemplateSpec) => {
    const page = createPage(tpl.name)
    page.icon = tpl.icon
    page.blocks = tpl.blocks.map((b) => {
      const nb = createBlock(b.type as BlockType, b.text)
      if (b.done !== undefined) nb.done = b.done
      if (b.progress !== undefined) nb.progress = b.progress
      if (b.type === 'database') {
        nb.db = createDatabase()
        if (b.cols) {
          nb.db.columns = b.cols.map((c) => ({
            ...createColumn(c.name, c.type),
            options: c.options ?? (c.type === 'select' || c.type === 'status' || c.type === 'multi' ? [] : undefined)
          }))
        }
      }
      return nb
    })
    setState((s) => (s ? { pages: [page, ...s.pages], currentPageId: page.id } : s))
    setTplOpen(false)
    setSidebarOpen(false)
  }

  const openPageCtx = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    const p = state?.pages.find((x) => x.id === id)
    setCtx({
      x: Math.min(e.clientX, Math.max(8, window.innerWidth - 230)),
      y: Math.min(e.clientY, Math.max(8, window.innerHeight - 190)),
      items: [
        { label: 'Ouvrir', icon: '↗', onClick: () => { setState((s) => (s ? { ...s, currentPageId: id } : s)); setSidebarOpen(false) } },
        { label: 'Dupliquer', icon: '⧉', onClick: () => duplicatePage(id) },
        { label: 'Nouvelle sous-page', icon: '＋', onClick: () => addPage(id) },
        { label: p?.pinned ? 'Retirer des favoris' : 'Épingler dans les favoris', icon: '📌', onClick: () => updatePage(id, { pinned: !p?.pinned }) },
        { label: 'Remonter d’un niveau', icon: '⇤', onClick: () => promotePage(id) },
        { label: 'Envoyer à la corbeille', icon: '🗑', danger: true, onClick: () => deletePage(id) }
      ]
    })
  }

  const openBlockCtx = (id: string, e: React.MouseEvent) => {
    if (!current) return
    setCtx({
      x: Math.min(e.clientX, Math.max(8, window.innerWidth - 230)),
      y: Math.min(e.clientY, Math.max(8, window.innerHeight - 210)),
      items: [
        {
          label: 'Dupliquer le bloc', icon: '⧉', onClick: () => {
            const b = findBlock(current.blocks, id)
            if (!b) return
            const c = JSON.parse(JSON.stringify(b)) as Block
            c.id = uid()
            updatePage(current.id, { blocks: insertAfter(current.blocks, id, c) })
          }
        },
        { label: 'Monter', icon: '↑', onClick: () => updatePage(current.id, { blocks: moveSibling(current.blocks, id, -1) }) },
        { label: 'Descendre', icon: '↓', onClick: () => updatePage(current.id, { blocks: moveSibling(current.blocks, id, 1) }) },
        { label: 'Supprimer', icon: '🗑', danger: true, onClick: () => deleteBlock(id) }
      ]
    })
  }

  const addPage = (parentId: string | null = null) => {
    const page = createPage('Nouvelle page', parentId)
    setState((s) => (s ? { pages: [page, ...s.pages], currentPageId: page.id } : s))
  }

  const duplicatePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const p = s.pages.find((x) => x.id === id)
      if (!p) return s
      const copy: Page = { ...p, id: uid(), title: `${stripHtml(p.title).trim() || 'Sans titre'} (copie)`, blocks: cloneBlocks(p.blocks), updatedAt: Date.now(), deletedAt: null }
      const idx = s.pages.findIndex((x) => x.id === id)
      const pages = [...s.pages]
      pages.splice(idx + 1, 0, copy)
      return { pages, currentPageId: copy.id }
    })
  }

  const deletePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const sub = [s.pages.find((p) => p.id === id), ...descendantsOf(s.pages, id)].filter(Boolean) as Page[]
      return {
        ...s,
        pages: s.pages.map((p) => (sub.some((x) => x.id === p.id) ? { ...p, deletedAt: Date.now() } : p)),
        currentPageId: s.currentPageId && sub.some((x) => x.id === s.currentPageId) ? s.pages.find((p) => !p.deletedAt)?.id ?? null : s.currentPageId
      }
    })
    setToast({ key: Date.now(), msg: 'Page envoyée à la corbeille', action: () => restorePage(id) })
  }

  const restorePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const sub = descendantsOf(s.pages, id)
      return {
        ...s,
        pages: s.pages.map((p) => (p.id === id || sub.some((x) => x.id === p.id) ? { ...p, deletedAt: null } : p))
      }
    })
  }

  const purgePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const page = s.pages.find((p) => p.id === id)
      const newParent = page?.parentId ?? null
      const pages = s.pages
        .filter((p) => p.id !== id && !descendantsOf(s.pages, id).some((x) => x.id === p.id))
        .map((p) => (p.parentId === id ? { ...p, parentId: newParent } : p))
      return { pages, currentPageId: s.currentPageId === id ? pages.find((p) => !p.deletedAt)?.id ?? null : s.currentPageId }
    })
  }

  const promotePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const p = s.pages.find((x) => x.id === id)
      if (!p) return s
      const parent = s.pages.find((x) => x.id === p.parentId)
      return { ...s, pages: s.pages.map((x) => (x.id === id ? { ...x, parentId: parent?.parentId ?? null } : x)) }
    })
  }

  const movePage = (id: string, targetId: string) => {
    setState((s) => {
      if (!s || id === targetId) return s
      const idx = s.pages.findIndex((p) => p.id === id)
      const tidx = s.pages.findIndex((p) => p.id === targetId)
      if (idx < 0 || tidx < 0) return s
      const pages = [...s.pages]
      const [p] = pages.splice(idx, 1)
      pages.splice(tidx, 0, p)
      return { ...s, pages }
    })
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (!t || !current) return
    if (!current.tags?.includes(t)) updatePage(current.id, { tags: [...(current.tags ?? []), t] })
    setTagInput('')
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
    window.alert(`Salon « ${code} » ouvert. Sur l’autre appareil, ouvre Calepin → ⇄ Sync et entre ce même code.`)
  }

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !state) return
    try {
      if (file.name.toLowerCase().endsWith('.md')) {
        const { title, blocks } = parseMarkdown(await file.text(), file.name.replace(/\.md$/i, ''))
        const page = createPage(title)
        page.blocks = blocks
        setState((s) => (s ? { pages: [page, ...s.pages], currentPageId: page.id } : s))
      } else {
        const imported = await parseImportFile(file)
        const ok = window.confirm(`Remplacer les ${livePages.length} page(s) actuelles par celles du fichier « ${file.name} » ?`)
        if (ok) setState(imported)
      }
    } catch {
      window.alert('Fichier invalide : export JSON Skouar/Calepin ou .md attendu.')
    }
  }

  const onEditorPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))
    if (!item || !state || !current) return
    e.preventDefault()
    const f = item.getAsFile()
    if (!f) return
    if (f.size > 5_000_000) {
      window.alert('Image trop lourde (max 5 Mo).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const nb = createBlock('image')
      nb.src = String(reader.result)
      nb.fileName = f.name || 'image collée'
      nb.fileSize = f.size
      insertBlockAfter(activeId ?? current.blocks[current.blocks.length - 1]?.id, nb)
    }
    reader.readAsDataURL(f)
  }

  const onEditorDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'))
    if (!f || !state || !current) return
    e.preventDefault()
    if (f.size > 5_000_000) {
      window.alert('Image trop lourde (max 5 Mo).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const nb = createBlock('image')
      nb.src = String(reader.result)
      nb.fileName = f.name
      nb.fileSize = f.size
      insertBlockAfter(activeId ?? current.blocks[current.blocks.length - 1]?.id, nb)
    }
    reader.readAsDataURL(f)
  }

  const exportPageMd = () => {
    if (!current) return
    const name = (stripHtml(current.title).trim() || 'page').replace(/[^\w-]+/g, '-').toLowerCase()
    exportFile(`${name}.md`, toMarkdown(current), 'text/markdown')
  }

  if (!state || !current) {
    return (
      <div className="blocs-app">
        <main className="blocs-main">
          <div className="skel skel-title" />
          <div className="skel skel-line" />
          <div className="skel skel-line" />
          <div className="skel skel-line short" />
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
      updateBlock(id, f ? { src: f.src, fileName: f.fileName, fileSize: f.fileSize } : { src: undefined, fileName: undefined, fileSize: undefined }),
    onToggleDone: (id) => {
      const b = findBlock(current.blocks, id)
      updateBlock(id, { done: !(b?.done ?? false) })
    },
    onSetDue: (id, due) => {
      if (due && Notification.permission === 'default') void Notification.requestPermission()
      updateBlock(id, { due, notified: false })
    },
    onChangeColor: (id, color) => updateBlock(id, { color: color ?? undefined }),
    onChangeProgress: (id, n) => updateBlock(id, { progress: n }),
    onAddGallery: (id, srcs) => {
      const b = findBlock(current.blocks, id)
      updateBlock(id, { srcs: [...(b?.srcs ?? []), ...srcs] })
    },
    onRemoveGallery: (id, src) => {
      const b = findBlock(current.blocks, id)
      updateBlock(id, { srcs: (b?.srcs ?? []).filter((s) => s !== src) })
    },
    onSetAction: (id, action) => updateBlock(id, { action, href: action ? undefined : undefined }),
    onRunAction: runAction,
    onOpenPage: (id) => setState((s) => (s ? { ...s, currentPageId: id } : s)),
    onSetPage: (id, pageId) => updateBlock(id, { pageId }),
    pagesList,
    blocksList,
    allDbs,
    onChangeDb: (id, db) => updateBlock(id, { db }),
    onBlockContextMenu: openBlockCtx,
    onSetTable: (id, rows) => updateBlock(id, { table: rows }),
    onSetLang: (id, lang) => updateBlock(id, { lang }),
    onEnter: handleEnter,
    onDelete: deleteBlock,
    onAddChildTo: addChildTo,
    onSetCols: setCols,
    onBlockDragStart: (id) => { dragBlockId.current = id },
    onBlockDrop: (targetId, after) => {
      if (dragBlockId.current) moveBlock(dragBlockId.current, targetId, after)
      dragBlockId.current = null
    },
    isSlashActive: (id) => slashOpen && slashBlock?.id === id,
    onSlashNav: (dir) => setSlashIndex((i) => (i + dir + slashItems.length) % slashItems.length),
    onSlashEnter: () => {
      const item = slashItems[slashIndex]
      if (item) applySlash(item)
    },
    onSlashEscape: () => setSlashDismissed(true)
  }

  const slashEl = slashBlock ? document.getElementById(`bloc-${slashBlock.id}`) : null
  const slashRect = slashEl?.getBoundingClientRect()
  const mentionEl = mentionMatch ? document.getElementById(`bloc-${mentionMatch.b.id}`) : null
  const mentionRect = mentionEl?.getBoundingClientRect()
  const cover = current.cover ?? null
  const allTags = [...new Set(livePages.flatMap((p) => p.tags ?? []))]

  return (
    <div className="blocs-app">
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`blocs-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{ '--side-w': `${sideW}px` } as CSSProperties}
      >
        <div className="blocs-app-head">
          <Link to="/" className="blocs-app-brand" title="Retour au launcher Skouar">
            <img className="blocs-app-logo" src={`${import.meta.env.BASE_URL}app-icons/calepin.svg`} alt="Calepin" />
            <span className="blocs-app-name">Calepin</span>
          </Link>
          <Link to="/" className="blocs-back" title="Retour au launcher">
            ←
          </Link>
        </div>
        <input
          className="blocs-search"
          placeholder="Rechercher… (titre, texte, BDD)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q && (
          <select className="blocs-search" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Tous les contenus</option>
            <option value="text">Texte</option>
            <option value="heading">Titres</option>
            <option value="todo">Tâches</option>
            <option value="db">Bases de données</option>
          </select>
        )}
        {!q && allTags.length > 0 && (
          <select className="blocs-search" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tous les tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>🏷 {t}</option>
            ))}
          </select>
        )}
        <button
          className={`rappels-row${soon48.length > 0 ? ' has-soon' : ''}`}
          data-pop="bell"
          onClick={() => setBellOpen((o) => !o)}
          title={`${dueTodos.length} rappel(s) — ${overdue.length} en retard, ${soon48.length} dans les 48 h`}
        >
          <span className="rappels-dot" />
          <span>🔔 Rappels</span>
          {dueTodos.length > 0 && <span className="db-type">{dueTodos.length}</span>}
        </button>
        {!showTrash && pinnedPages.length > 0 && (
          <>
            <div className="blocs-side-label">Favoris</div>
            {pinnedPages.map((p) => (
              <button
                key={p.id}
                className="blocs-side-link"
                onClick={() => {
                  setState((s) => (s ? { ...s, currentPageId: p.id } : s))
                  setSidebarOpen(false)
                }}
              >
                <span className="blocs-side-link-ic"><AppIcon icon={p.icon ?? '📄'} size={15} /></span>
                <span className="blocs-side-link-title">{stripHtml(p.title).trim() || 'Sans titre'}</span>
                <span className="blocs-side-link-ic">📌</span>
              </button>
            ))}
          </>
        )}
        {!showTrash && recents.length > 0 && (
          <>
            <div className="blocs-side-label">Récents</div>
            {recents.map((p) => (
              <button
                key={p.id}
                className="blocs-side-link"
                onClick={() => {
                  setState((s) => (s ? { ...s, currentPageId: p.id } : s))
                  setSidebarOpen(false)
                }}
              >
                <span className="blocs-side-link-ic"><AppIcon icon={p.icon ?? '📄'} size={15} /></span>
                <span className="blocs-side-link-title">{stripHtml(p.title).trim() || 'Sans titre'}</span>
                <span className="blocs-side-link-time">{relTime(p.lastOpened ?? 0)}</span>
              </button>
            ))}
          </>
        )}
        <div className="blocs-side-sep" />
        <div className="blocs-sidebar-head">
          <span>{showTrash ? '🗑 Corbeille' : 'Pages'}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="blocs-new-page" onClick={openJournal} title="Journal du jour (AAAA-MM-JJ)">
              📅
            </button>
            <button className="blocs-new-page" onClick={() => setGraphOpen(true)} title="Graphe des pages (liens [[…]])">
              🕸
            </button>
            <button className="blocs-new-page" onClick={() => setShowTrash((v) => !v)} title="Corbeille / Pages">
              🗑
            </button>
          </div>
        </div>
        <div className="blocs-sidebar-scroll">
        <ul className="blocs-page-list">
          {showTrash
            ? trashPages.map((p) => (
                <li key={p.id}>
                  <div className="blocs-page-row">
                    <span className="blocs-page-item" style={{ cursor: 'default' }}>
                      {p.icon && <span className="blocs-page-icon"><AppIcon icon={p.icon} size={14} /></span>}
                      {stripHtml(p.title).trim() || 'Sans titre'}
                    </span>
                    <button className="blocs-page-act" title="Restaurer" onClick={() => restorePage(p.id)}>↩</button>
                    <button className="blocs-page-del" title="Supprimer définitivement" onClick={() => purgePage(p.id)}>×</button>
                  </div>
                </li>
              ))
            : matches
              ? matches.map(({ page: p, snippet, at, raw }) => (
                  <li key={p.id}>
                    <div className="blocs-page-row">
                      <button
                        className={`blocs-page-item${p.id === current.id ? ' selected' : ''}`}
                        onClick={() => setState((s) => (s ? { ...s, currentPageId: p.id } : s))}
                      >
                        {p.icon && <span className="blocs-page-icon" style={p.iconColor ? { backgroundColor: p.iconColor } : undefined}><AppIcon icon={p.icon} size={14} color={p.iconColor ?? undefined} /></span>}
                        {stripHtml(p.title).trim() || 'Sans titre'}
                      </button>
                    </div>
                    <div className="blocs-snippet">
                      {snippet.slice(0, at - (raw.toLowerCase().indexOf(q) >= 0 ? Math.max(0, raw.toLowerCase().indexOf(q) - 30) : 0))}
                      <mark>{raw.slice(Math.max(0, raw.toLowerCase().indexOf(q)), Math.max(0, raw.toLowerCase().indexOf(q)) + q.length)}</mark>
                      {raw.slice(Math.max(0, raw.toLowerCase().indexOf(q)) + q.length, Math.max(0, raw.toLowerCase().indexOf(q)) + q.length + 60)}
                    </div>
                  </li>
                ))
              : tagFiltered
                  .map((p) => p)
                  .filter((p) => !q)
                  .length >= 0 && (
                <PageTree
                  pages={tagFiltered}
                  parentId={null}
                  depth={0}
                  currentId={current.id}
                  onSelect={(id) => {
                    setState((s) => (s ? { ...s, currentPageId: id } : s))
                    setSidebarOpen(false)
                  }}
                  onDelete={deletePage}
                  onAddChild={(id) => addPage(id)}
                  onPromote={promotePage}
                  onMovePage={movePage}
                  onDuplicate={duplicatePage}
                  onContextMenuPage={openPageCtx}
                  fmtTime={relTime}
                />
              )}
        </ul>
        </div>
        {!showTrash && (
          <>
            <button
              className="blocs-side-link"
              onClick={() => {
                addPage(null)
                setSidebarOpen(false)
              }}
            >
              <span className="blocs-side-link-ic">＋</span> Nouvelle page
            </button>
            <button className="blocs-side-link" data-pop="tpl" onClick={() => setTplOpen(true)}>
              <span className="blocs-side-link-ic">📋</span> Templates
            </button>
          </>
        )}
        <div className="blocs-sidebar-foot">
          <ThemeButton />
          <button className={`blocs-io${sync ? ' active' : ''}`} onClick={toggleSync} title="Sync P2P">
            {sync ? `⇄ ${sync.code}` : '⇄ Sync'}
          </button>
          <button className="blocs-io" onClick={() => exportStateToFile(state)} title="Exporter toutes les données (JSON)">
            ↓ Exporter
          </button>
          <button className="blocs-io" onClick={() => fileInput.current?.click()} title="Import JSON ou .md">
            ↑ Import
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json,.md,text/markdown" hidden onChange={handleImport} />
        </div>
      </aside>
      <div
        className="sidebar-resizer"
        title="Redimensionner le menu"
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startW = sideW
          const onMove = (ev: MouseEvent) => {
            const w = Math.min(440, Math.max(180, startW + ev.clientX - startX))
            setSideW(w)
            localStorage.setItem('skouar:sidebarW', String(w))
          }
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <span className="resizer-arrow">⇆</span>
      </div>
      <main className="blocs-main">
        <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Menu">
          ☰
        </button>
        {cover && (
          <div className="page-cover" style={cover.kind === 'color' || cover.kind === 'pattern' ? coverStyle(cover) : undefined}>
            {(cover.kind === 'url' || cover.kind === 'file') && <img src={cover.value} alt="couverture de la page" />}
            <div className="page-cover-actions">
              <button
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setCoverMenu({ x: r.left, y: r.bottom })
                }}
              >
                🖼 Modifier
              </button>
              <button onClick={() => updatePage(current.id, { cover: null })}>Supprimer</button>
            </div>
          </div>
        )}
        <div className="page-top">
        <div className="breadcrumb">
          {crumbs.map((c) => (
            <span key={c.id} className="crumb-wrap">
              <button className="crumb" onClick={() => setState((s) => (s ? { ...s, currentPageId: c.id } : s))}>
                {stripHtml(c.title).trim() || 'Sans titre'}
              </button>
              <span className="crumb-sep">/</span>
            </span>
          ))}
          <span className="crumb current">{currentTitle}</span>
        </div>
        <div className="page-head">
          <div className="page-icon-wrap" data-pop="icon">
            <button
              className="page-icon-btn"
              style={current.iconColor ? { backgroundColor: current.iconColor } : undefined}
              title="Icône de la page"
              onClick={() => setIconOpen((o) => !o)}
            >
              {current.icon ? <AppIcon icon={current.icon} size={22} color={current.iconColor ?? undefined} /> : '＋'}
            </button>
            {iconOpen && (
              <EmojiPicker
                currentColor={current.iconColor}
                onPick={(e, c) => {
                  updatePage(current.id, { icon: e, iconColor: c === 'transparent' ? null : c })
                  setIconOpen(false)
                }}
                onClear={() => {
                  updatePage(current.id, { icon: null, iconColor: null })
                  setIconOpen(false)
                }}
              />
            )}
          </div>
          <input
            className="blocs-title"
            value={stripHtml(current.title)}
            placeholder="Sans titre"
            onChange={(e) => updatePage(current.id, { title: e.target.value })}
          />
          <div className="page-head-actions">
            <div className="page-icon-wrap" data-pop="tags">
              <button className="page-cover-btn" title="Tags" onClick={() => setTagsOpen((o) => !o)}>
                🏷
              </button>
              {tagsOpen && (
                <div className="emoji-pop tag-pop">
                  <div className="tag-input-row">
                    <input
                      className="db-input"
                      placeholder="Nouveau tag…"
                      value={tagInput}
                      autoFocus
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addTag()
                        if (e.key === 'Escape') setTagsOpen(false)
                      }}
                    />
                    <button className="db-btn" onClick={addTag}>＋</button>
                  </div>
                  <div className="tag-chips">
                    {(current.tags ?? []).map((t) => (
                      <span key={t} className="tag-chip" style={{ backgroundColor: tagColor(t) }}>
                        {t}
                        <button
                          onClick={() => updatePage(current.id, { tags: (current.tags ?? []).filter((x) => x !== t) })}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="page-cover-btn" title="Couverture (couleur, motif, URL, fichier)" data-pop="cover" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setCoverMenu({ x: r.left, y: r.bottom })
            }}>
              🖼
            </button>
            <button className="page-cover-btn" title="Exporter cette page en Markdown" onClick={exportPageMd}>
              ⇩
            </button>
            <button className="page-cover-btn" title="Exporter en PDF" onClick={() => window.print()}>
              🖨
            </button>
            <button className="page-cover-btn" title="Dupliquer la page" onClick={() => duplicatePage(current.id)}>
              ⧉
            </button>
            <button className="page-cover-btn" title="Tableau de bord de la page" onClick={() => setDashOpen((o) => !o)}>
              📊
            </button>
            <button className="page-cover-btn" title="Exporter la page en HTML autonome (fichier partageable)" onClick={() => exportPageHtml(current)}>
              🔗
            </button>
          </div>
        </div>
          {pageTodos.length > 0 && (
            <div className="page-progress" title={`${pageTodosDone}/${pageTodos.length} tâches terminées`}>
              <div className="page-progress-track">
                <div className="page-progress-bar" style={{ width: `${Math.round((pageTodosDone / pageTodos.length) * 100)}%` }} />
              </div>
              <span className="db-type">{pageTodosDone}/{pageTodos.length}</span>
            </div>
          )}
        </div>
        {current.tags && current.tags.length > 0 && (
          <div className="tag-chips page-tags">
            {current.tags.map((t) => (
              <span key={t} className="tag-chip" style={{ backgroundColor: tagColor(t) }}>{t}</span>
            ))}
          </div>
        )}
        {dashOpen && (
          <DashboardView
            page={current}
            allPages={livePages}
            onOpenPage={(id) => setState((s) => (s ? { ...s, currentPageId: id } : s))}
          />
        )}
        <div className="blocs-toolbar">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.type}
              title={t.title}
              className={activeId && findBlock(current.blocks, activeId)?.type === t.type ? 'tool active' : 'tool'}
              onClick={() => {
                if (!activeId) return
                const existing = findBlock(current.blocks, activeId)
                updateBlock(activeId, {
                  type: t.type,
                  done: t.type === 'todo' ? false : undefined,
                  src: undefined, href: undefined, fileName: undefined, fileSize: undefined,
                  cols: t.type === 'columns' ? 2 : undefined,
                  db: t.type === 'database' ? (existing?.db ?? createDatabase()) : undefined,
                  children:
                    t.type === 'toggle' ? (existing?.children ?? [])
                      : t.type === 'columns' ? [createBlock('column'), createBlock('column')]
                      : undefined
                })
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="blocs-editor" onPaste={onEditorPaste} onDrop={onEditorDrop}>
          {current.blocks.length === 0 && (
            <div className="empty-state">
              <p><strong>Cette page est vide.</strong></p>
              <p className="empty-hint">Tape <kbd>/</kbd> pour ajouter un bloc, ou choisis un modèle :</p>
              <button className="db-btn" onClick={() => setTplOpen(true)}>📋 Voir les 20 templates</button>
            </div>
          )}
          {current.blocks.map((b) => (
            <BlockView key={b.id} block={b} handlers={handlers} />
          ))}
        </div>
        <button
          className="blocs-add"
          onClick={() => insertBlockAfter(current.blocks[current.blocks.length - 1].id)}
        >
          ＋ Ajouter un bloc (ou tape /)
        </button>
        <div className="links-panel">
          <button className="links-toggle" onClick={() => setLinksOpen((o) => !o)}>
            🔗 Liens — {incoming.length} entrant(s), {outgoing.length} sortant(s) {linksOpen ? '▴' : '▾'}
          </button>
          {linksOpen && (
            <div className="links-body">
              <div>
                <strong>Entrants</strong>
                {incoming.length === 0 && <p className="db-empty">Aucun [[{currentTitle}]] ailleurs</p>}
                {incoming.map((p) => (
                  <button key={p.id} className="link-item" onClick={() => setState((s) => (s ? { ...s, currentPageId: p.id } : s))}>
                    {p.icon} {stripHtml(p.title).trim() || 'Sans titre'}
                  </button>
                ))}
              </div>
              <div>
                <strong>Sortants</strong>
                {outgoing.length === 0 && <p className="db-empty">Tape [[ dans un bloc pour lier une page</p>}
                {outgoing.map((t) => {
                  const target = livePages.find((p) => (stripHtml(p.title).trim() || 'Sans titre') === t)
                  return (
                    <button key={t} className="link-item" onClick={() => target && setState((s) => (s ? { ...s, currentPageId: target.id } : s))}>
                      [[{t}]]
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {ctx && (
          <div className="ctx-menu" data-pop="ctx" style={{ left: ctx.x, top: ctx.y }}>
            {ctx.items.map((it, i) => (
              <button
                key={i}
                className={`ctx-item${it.danger ? ' danger' : ''}`}
                onClick={() => {
                  setCtx(null)
                  it.onClick()
                }}
              >
                {it.icon && <span className="ctx-ic">{it.icon}</span>} {it.label}
              </button>
            ))}
          </div>
        )}
        {toast && (
          <div className="toast" key={toast.key}>
            <span>{toast.msg}</span>
            {toast.action && <button onClick={() => { setToast(null); toast.action?.() }}>Annuler</button>}
          </div>
        )}
        {slashOpen && slashBlock && slashRect && (
          <div className="slash-menu" data-pop="slash" style={{ left: Math.min(slashRect.left, Math.max(8, window.innerWidth - 260)), top: slashRect.bottom + 6 }}>
            {slashGroups.map((g) => (
              <div key={g.cat}>
                <div className="slash-cat">{g.cat}</div>
                {g.items.map(({ t, i }) => (
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
            ))}
          </div>
        )}
        {mentionOpen && mentionMatch && mentionRect && (
          <div className="slash-menu" data-pop="mention" style={{ left: mentionRect.left, top: mentionRect.bottom + 6 }}>
            {mentionPages.slice(0, 8).map((p, i) => (
              <button
                key={p.id}
                className={`slash-item${i === mentionIndex ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setMentionIndex(i)}
                onClick={() => applyMention(stripHtml(p.title).trim() || 'Sans titre')}
              >
                <span className="slash-label">{p.icon ?? '📄'}</span> {stripHtml(p.title).trim() || 'Sans titre'}
              </button>
            ))}
          </div>
        )}
        {coverMenu && (
          <CoverMenu
            anchor={coverMenu}
            onSelect={(c) => updatePage(current.id, { cover: c })}
            onClose={() => setCoverMenu(null)}
          />
        )}
        {bellOpen && (
          <div className="tpl-pop bell-pop" data-pop="bell">
            <div className="tpl-head">
              <strong>🔔 Rappels (tâches avec date)</strong>
              <button className="db-btn" onClick={() => setBellOpen(false)}>✕</button>
            </div>
            {dueTodos.length === 0 && <p className="db-empty">Aucune tâche avec rappel — clique ⏰ sur une tâche</p>}
            {dueTodos.map(({ page, block }) => (
              <button
                key={block.id}
                className="link-item"
                onClick={() => {
                  setState((s) => (s ? { ...s, currentPageId: page.id } : s))
                  setBellOpen(false)
                  setSidebarOpen(false)
                  setTimeout(() => document.getElementById(`bloc-${block.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                }}
              >
                ⏰ {block.due?.replace('T', ' ')} — {stripHtml(block.text) || 'Tâche'} <span className="db-type">({stripHtml(page.title).trim() || 'page'})</span>
              </button>
            ))}
          </div>
        )}
        {graphOpen && (
          <GraphView
            pages={livePages}
            currentId={current?.id ?? null}
            onOpen={(id) => {
              setState((s) => (s ? { ...s, currentPageId: id } : s))
              setGraphOpen(false)
              setSidebarOpen(false)
            }}
            onClose={() => setGraphOpen(false)}
          />
        )}
        {tplOpen && (
          <div className="tpl-pop" data-pop="tpl">
            <div className="tpl-head">
              <strong>Choisis un template</strong>
              <button className="db-btn" onClick={() => setTplOpen(false)}>✕</button>
            </div>
            <div className="tpl-grid">
              {TEMPLATES.map((t) => (
                <button key={t.name} className="tpl-card" onClick={() => createFromTemplate(t)}>
                  <span className="tpl-icon">{t.icon}</span>
                  <span className="tpl-name">{t.name}</span>
                  <span className="db-type">{t.tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
