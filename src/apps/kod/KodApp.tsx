import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import ThemeButton from '../../ThemeButton'
import { useDismiss } from '../blocs/useDismiss'
import { notify } from '../blocs/notify'
import {
  db,
  loadNodes,
  loadUI,
  saveUI,
  putNode,
  deleteNodeTree,
  loadKV,
  saveKV,
  uid,
  type KodNode,
  type KodUI
} from './store'
import { highlight, langOf } from './highlight'

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
    showOpenFilePicker?: (opts?: { multiple?: boolean; types?: unknown[] }) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (opts?: { suggestedName?: string; types?: unknown[] }) => Promise<FileSystemFileHandle>
  }
}

interface RealEntry {
  key: string
  name: string
  kind: 'file' | 'dir'
  path: string
  handle?: FileSystemFileHandle
  children?: RealEntry[]
}

interface Buffer {
  content: string
  dirty: boolean
  real?: FileSystemFileHandle
}

interface GResult {
  key: string
  name: string
  path: string
  line: number
  text: string
}

const TEXT_EXTS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'html', 'htm', 'css', 'scss', 'less', 'md', 'txt', 'py', 'rb', 'sh', 'yml', 'yaml', 'toml', 'ini', 'xml', 'svg', 'sql', 'java', 'c', 'h', 'cpp', 'cs', 'go', 'rs', 'php', 'lua', 'vue', 'svelte', 'env', 'gitignore', 'log', 'csv'])

const fileGlyph = (name: string): string => {
  const lang = langOf(name)
  const map: Record<string, string> = {
    javascript: '🟨', typescript: '🟦', json: '🟧', html: '🌐', css: '🎨',
    markdown: '📝', python: '🐍', bash: '⚙️', yaml: '📋', sql: '🗄️', text: '📄'
  }
  return map[lang] ?? '📄'
}

const isCodeName = (name: string): boolean => {
  if (TEXT_EXTS.has((name.split('.').pop() ?? '').toLowerCase())) return true
  return ['Dockerfile', 'Makefile', '.gitignore', '.env', 'LICENSE', 'README'].includes(name)
}

async function scanDir(dir: FileSystemDirectoryHandle, path: string): Promise<RealEntry[]> {
  const out: RealEntry[] = []
  const entries = (dir as unknown as { entries?: () => AsyncIterable<[string, FileSystemHandle]> }).entries
  if (!entries) return out
  for await (const [name, h] of entries.call(dir)) {
    const p = path ? `${path}/${name}` : name
    if (h.kind === 'directory') {
      if (name === 'node_modules' || name === '.git') continue
      out.push({ key: `real:${p}`, name, kind: 'dir', path: p, children: await scanDir(h as FileSystemDirectoryHandle, p) })
    } else if (isCodeName(name)) {
      out.push({ key: `real:${p}`, name, kind: 'file', path: p, handle: h as FileSystemFileHandle })
    }
  }
  out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
  return out
}

const flattenReal = (entries: RealEntry[], acc: RealEntry[] = []): RealEntry[] => {
  for (const e of entries) {
    if (e.kind === 'file') acc.push(e)
    else if (e.children) flattenReal(e.children, acc)
  }
  return acc
}

export default function KodApp() {
  const [nodes, setNodes] = useState<KodNode[] | null>(null)
  const [ui, setUi] = useState<KodUI | null>(null)
  const [buffers, setBuffers] = useState<Record<string, Buffer>>({})
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [realTree, setRealTree] = useState<RealEntry[]>([])
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem('skouar:sidebarW'))
    return Number.isFinite(v) && v >= 180 && v <= 440 ? v : 260
  })
  const [newItem, setNewItem] = useState<{ parentId: string | null; kind: 'file' | 'dir'; value: string } | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const [findQ, setFindQ] = useState('')
  const [findIdx, setFindIdx] = useState(0)
  const [gOpen, setGOpen] = useState(false)
  const [gQ, setGQ] = useState('')
  const [gResults, setGResults] = useState<GResult[]>([])
  const [gBusy, setGBusy] = useState(false)
  const [toast, setToast] = useState<{ key: number; msg: string; action?: { label: string; fn: () => void } } | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [lineCol, setLineCol] = useState({ line: 1, col: 1 })
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const hlRef = useRef<HTMLPreElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<KodNode[]>([])
  const buffersRef = useRef<Record<string, Buffer>>({})
  const uiRef = useRef<KodUI | null>(null)
  const pendingDelete = useRef<{ nodes: KodNode[] } | null>(null)
  nodesRef.current = nodes ?? []
  buffersRef.current = buffers
  uiRef.current = ui

  const active = ui?.active ?? null
  const buf = active ? buffers[active] : undefined
  const activeNode = nodes?.find((n) => n.id === active) ?? null
  const activeReal = active?.startsWith('real:') ? flattenReal(realTree).find((e) => e.key === active) ?? null : null
  const activeName = activeNode?.name ?? activeReal?.name ?? ''
  const lang = langOf(activeName)
  const content = buf?.content ?? ''

  useEffect(() => {
    let alive = true
    void (async () => {
      const [ns, u] = await Promise.all([loadNodes(), loadUI()])
      let seeded = ns
      if (!ns.length) {
        const welcome: KodNode = {
          id: uid(),
          parentId: null,
          name: 'bienvenue.md',
          kind: 'file',
          content: '# Bienvenue dans Kod 👋\n\nÉditeur de code 100 % local.\n\n- `Ctrl+F` : rechercher dans le fichier\n- `Ctrl+Shift+F` : rechercher dans tout le projet\n- `Ctrl+S` : enregistrer\n- Onglets, arbre de fichiers, coloration…\n',
          updatedAt: Date.now()
        }
        await putNode(welcome)
        seeded = [welcome]
        u.tabs = [welcome.id]
        u.active = welcome.id
        await saveUI(u)
      }
      if (!alive) return
      setNodes(seeded)
      setUi(u)
      const b: Record<string, Buffer> = {}
      for (const n of seeded) if (n.kind === 'file') b[n.id] = { content: n.content ?? '', dirty: false }
      setBuffers(b)
      const h = await loadKV<FileSystemDirectoryHandle>('dirHandle')
      if (h && alive) {
        try {
          const perm = await (h as unknown as { queryPermission?: (o: { mode: string }) => Promise<string> }).queryPermission?.({ mode: 'readwrite' })
          if (perm === 'granted') {
            setDirHandle(h)
            setRealTree(await scanDir(h, ''))
          }
        } catch { /* dossier plus disponible */ }
      }
    })()
    const onToast = (e: Event) => setToast({ key: Date.now(), msg: (e as CustomEvent<string>).detail })
    window.addEventListener('skouar:toast', onToast)
    return () => {
      alive = false
      window.removeEventListener('skouar:toast', onToast)
    }
  }, [])

  useEffect(() => {
    if (!ui) return
    const t = setTimeout(() => void saveUI(ui), 250)
    return () => clearTimeout(t)
  }, [ui])

  useEffect(() => {
    if (!nodes || !active || !buffers[active]) return
    if (active.startsWith('real:')) return
    const t = setTimeout(() => {
      void (async () => {
        const n = nodesRef.current.find((x) => x.id === active)
        if (!n) return
        await putNode({ ...n, content: buffersRef.current[active]?.content ?? '', updatedAt: Date.now() })
        setNodes((prev) => prev?.map((x) => (x.id === active ? { ...x, content: buffersRef.current[active]?.content ?? '', updatedAt: Date.now() } : x)) ?? prev)
        setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], dirty: false } }))
        setSavedAt(Date.now())
      })()
    }, 400)
    return () => clearTimeout(t)
  }, [nodes, active, buffers])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 4200)
    return () => clearTimeout(t)
  }, [toast])

  useDismiss('kfind', findOpen, () => setFindOpen(false))
  useDismiss('kglob', gOpen, () => setGOpen(false))

  const syncScroll = (): void => {
    const ta = taRef.current
    if (!ta) return
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop
      hlRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
  }

  const updateLineCol = (): void => {
    const ta = taRef.current
    if (!ta) return
    const sel = ta.selectionStart
    const before = ta.value.slice(0, sel)
    const line = before.split('\n').length
    const col = sel - before.lastIndexOf('\n')
    setLineCol({ line, col })
  }

  const openNode = (n: KodNode): void => {
    if (!ui) return
    setBuffers((prev) => prev[n.id] ? prev : { ...prev, [n.id]: { content: n.content ?? '', dirty: false } })
    setUi({ ...ui, tabs: ui.tabs.includes(n.id) ? ui.tabs : [...ui.tabs, n.id], active: n.id })
    setTimeout(() => taRef.current?.focus(), 30)
  }

  const openReal = async (e: RealEntry): Promise<void> => {
    if (!ui || !e.handle) return
    const key = e.key
    if (!buffers[key]) {
      try {
        const f = await e.handle.getFile()
        const text = await f.text()
        setBuffers((prev) => ({ ...prev, [key]: { content: text, dirty: false, real: e.handle } }))
      } catch {
        notify('Fichier illisible')
        return
      }
    }
    setUi({ ...ui, tabs: ui.tabs.includes(key) ? ui.tabs : [...ui.tabs, key], active: key })
    setTimeout(() => taRef.current?.focus(), 30)
  }

  const closeTab = (id: string): void => {
    if (!ui) return
    const tabs = ui.tabs.filter((t) => t !== id)
    const active = ui.active === id ? (tabs[tabs.length - 1] ?? null) : ui.active
    setUi({ ...ui, tabs, active })
  }

  const saveActive = async (): Promise<void> => {
    if (!ui || !active) return
    const b = buffers[active]
    if (!b) return
    if (active.startsWith('real:')) {
      if (!b.real) return
      try {
        const w = await b.real.createWritable()
        await w.write(b.content)
        await w.close()
        setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], dirty: false } }))
        setSavedAt(Date.now())
        notify('Enregistré sur le disque 💾')
      } catch {
        notify('Écriture impossible (permission refusée ?)')
      }
      return
    }
    const n = nodes?.find((x) => x.id === active)
    if (!n) return
    await putNode({ ...n, content: b.content, updatedAt: Date.now() })
    setNodes((prev) => prev?.map((x) => (x.id === active ? { ...x, content: b.content, updatedAt: Date.now() } : x)) ?? prev)
    setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], dirty: false } }))
    setSavedAt(Date.now())
    notify('Enregistré ✓')
  }

  const createItem = async (): Promise<void> => {
    if (!newItem || !ui) return
    const name = newItem.value.trim()
    if (!name) {
      setNewItem(null)
      return
    }
    const node: KodNode = {
      id: uid(),
      parentId: newItem.parentId,
      name,
      kind: newItem.kind,
      content: newItem.kind === 'file' ? '' : undefined,
      updatedAt: Date.now()
    }
    await putNode(node)
    setNodes((prev) => [...(prev ?? []), node])
    if (newItem.kind === 'file') {
      setBuffers((prev) => ({ ...prev, [node.id]: { content: '', dirty: false } }))
      setUi({ ...ui, tabs: [...ui.tabs, node.id], active: node.id, expanded: newItem.parentId ? [...new Set([...ui.expanded, newItem.parentId])] : ui.expanded })
    } else if (newItem.parentId) {
      setUi({ ...ui, expanded: [...new Set([...ui.expanded, newItem.parentId])] })
    }
    setNewItem(null)
    notify(newItem.kind === 'dir' ? `Dossier « ${name} » créé` : `Fichier « ${name} » créé`)
  }

  const removeNode = async (n: KodNode): Promise<void> => {
    const removed = await deleteNodeTree(n.id)
    setNodes((prev) => prev?.filter((x) => !removed.some((r) => r.id === x.id)) ?? prev)
    setBuffers((prev) => {
      const next = { ...prev }
      for (const r of removed) delete next[r.id]
      return next
    })
    if (ui) {
      const tabs = ui.tabs.filter((t) => !removed.some((r) => r.id === t))
      const active = ui.active && removed.some((r) => r.id === ui.active) ? (tabs[tabs.length - 1] ?? null) : ui.active
      setUi({ ...ui, tabs, active })
    }
    pendingDelete.current = { nodes: removed }
    setToast({
      key: Date.now(),
      msg: `« ${n.name} » supprimé`,
      action: {
        label: 'Annuler',
        fn: async () => {
          const p = pendingDelete.current
          pendingDelete.current = null
          if (!p) return
          for (const r of p.nodes) await putNode(r)
          setNodes(await loadNodes())
          setToast(null)
          notify('Restauration effectuée')
        }
      }
    })
  }

  const commitRename = async (): Promise<void> => {
    if (!renameId || !nodes) return
    const name = renameVal.trim()
    setRenameId(null)
    if (!name) return
    const n = nodes.find((x) => x.id === renameId)
    if (!n || n.name === name) return
    await putNode({ ...n, name, updatedAt: Date.now() })
    setNodes((prev) => prev?.map((x) => (x.id === renameId ? { ...x, name } : x)) ?? prev)
    notify(`Renommé en « ${name} »`)
  }

  const openDirPicker = async (): Promise<void> => {
    if (!window.showDirectoryPicker) {
      notify('Ouvrir un dossier réel non supporté par ce navigateur — utilise le projet local')
      return
    }
    try {
      const h = await window.showDirectoryPicker({ id: 'skouar-kod', mode: 'readwrite' })
      const req = h as unknown as { requestPermission?: (o: { mode: string }) => Promise<string> }
      if (req.requestPermission) await req.requestPermission({ mode: 'readwrite' })
      await saveKV('dirHandle', h)
      setDirHandle(h)
      setRealTree(await scanDir(h, ''))
      notify(`Dossier « ${h.name} » ouvert`)
    } catch { /* annulé */ }
  }

  const openFilePicker = async (): Promise<void> => {
    if (!window.showOpenFilePicker) {
      notify('Ouvrir un fichier non supporté par ce navigateur')
      return
    }
    try {
      const hs = await window.showOpenFilePicker({ multiple: true })
      const files = hs.filter((h) => isCodeName(h.name) || h.name.includes('.'))
      for (const h of files) {
        const f = await h.getFile()
        if (f.size > 2_000_000) continue
        const key = `real:file:${h.name}:${uid()}`
        const text = await f.text()
        setBuffers((prev) => ({ ...prev, [key]: { content: text, dirty: false, real: h } }))
        setUi((prev) => (prev ? { ...prev, tabs: [...prev.tabs, key], active: key } : prev))
      }
      if (files.length) notify(`${files.length} fichier(s) ouvert(s)`)
    } catch { /* annulé */ }
  }

  const saveAs = async (): Promise<void> => {
    if (!active || !buffers[active] || !window.showSaveFilePicker) return
    try {
      const h = await window.showSaveFilePicker({ suggestedName: activeName || 'nouveau.txt' })
      const w = await h.createWritable()
      await w.write(buffers[active].content)
      await w.close()
      setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], dirty: false, real: h } }))
      notify('Enregistré sous… 💾')
    } catch { /* annulé */ }
  }

  const matches = useMemo(() => {
    if (!findQ || !content) return [] as number[]
    const out: number[] = []
    let i = content.indexOf(findQ)
    while (i >= 0 && out.length < 500) {
      out.push(i)
      i = content.indexOf(findQ, i + findQ.length)
    }
    return out
  }, [findQ, content])

  const goMatch = (dir: 1 | -1): void => {
    if (!matches.length || !taRef.current) return
    const next = (findIdx + dir + matches.length) % matches.length
    setFindIdx(next)
    const pos = matches[next]
    const ta = taRef.current
    ta.focus()
    ta.setSelectionRange(pos, pos + findQ.length)
    const line = ta.value.slice(0, pos).split('\n').length
    ta.scrollTop = Math.max(0, (line - 1) * 20 - ta.clientHeight / 2)
    syncScroll()
    updateLineCol()
  }

  useEffect(() => {
    if (!findOpen) return
    setFindIdx(0)
  }, [findOpen, findQ])

  const runGlobalSearch = async (): Promise<void> => {
    const q = gQ.trim()
    if (q.length < 2) {
      setGResults([])
      return
    }
    setGBusy(true)
    const res: GResult[] = []
    const lower = q.toLowerCase()
    for (const n of nodesRef.current) {
      if (n.kind !== 'file' || n.content == null) continue
      const lines = n.content.split('\n')
      lines.forEach((text, i) => {
        if (text.toLowerCase().includes(lower) && res.length < 200) {
          res.push({ key: n.id, name: n.name, path: n.name, line: i + 1, text: text.trim().slice(0, 120) })
        }
      })
    }
    for (const e of flattenReal(realTree)) {
      if (!e.handle) continue
      try {
        const f = await e.handle.getFile()
        if (f.size > 300_000) continue
        const text = await f.text()
        text.split('\n').forEach((line, i) => {
          if (line.toLowerCase().includes(lower) && res.length < 200) {
            res.push({ key: e.key, name: e.name, path: e.path, line: i + 1, text: line.trim().slice(0, 120) })
          }
        })
      } catch { /* ignore */ }
    }
    setGResults(res)
    setGBusy(false)
  }

  const jumpTo = (r: GResult): void => {
    if (r.key.startsWith('real:')) {
      const e = flattenReal(realTree).find((x) => x.key === r.key)
      if (e) void openReal(e)
    } else {
      const n = nodesRef.current.find((x) => x.id === r.key)
      if (n) openNode(n)
    }
    setGOpen(false)
    setTimeout(() => {
      const ta = taRef.current
      if (!ta) return
      const b = buffersRef.current[r.key]
      if (!b) return
      const lines = b.content.split('\n')
      const off = lines.slice(0, r.line - 1).reduce((a, l) => a + l.length + 1, 0)
      ta.focus()
      ta.setSelectionRange(off, off + (lines[r.line - 1]?.length ?? 0))
      ta.scrollTop = Math.max(0, (r.line - 1) * 20 - ta.clientHeight / 2)
      syncScroll()
      updateLineCol()
    }, 120)
  }

  const onTaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!active || !ui) return
    const ta = e.currentTarget
    const sel = ta.selectionStart
    const val = ta.value
    if (e.key === 'Tab') {
      e.preventDefault()
      const spaces = ' '.repeat(ui.tabSize)
      if (ta.selectionEnd > sel) {
        const block = val.slice(sel, ta.selectionEnd)
        const indented = e.shiftKey
          ? block.split('\n').map((l) => l.replace(new RegExp(`^ {1,${ui.tabSize}}`), '')).join('\n')
          : block.split('\n').map((l) => spaces + l).join('\n')
        const nv = val.slice(0, sel) + indented + val.slice(ta.selectionEnd)
        setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], content: nv, dirty: true } }))
        ta.value = nv
        ta.setSelectionRange(sel, sel + indented.length)
      } else if (e.shiftKey) {
        const lineStart = val.lastIndexOf('\n', sel - 1) + 1
        const cur = val.slice(lineStart, sel)
        const m = cur.match(new RegExp(`^ {1,${ui.tabSize}}`))
        if (m) {
          const nv = val.slice(0, lineStart) + cur.slice(m[0].length) + val.slice(sel)
          setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], content: nv, dirty: true } }))
          ta.value = nv
          ta.setSelectionRange(sel - m[0].length, sel - m[0].length)
        }
      } else {
        const nv = val.slice(0, sel) + spaces + val.slice(ta.selectionEnd)
        setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], content: nv, dirty: true } }))
        ta.value = nv
        ta.setSelectionRange(sel + spaces.length, sel + spaces.length)
      }
      updateLineCol()
    } else if (e.key === 'Enter') {
      const lineStart = val.lastIndexOf('\n', sel - 1) + 1
      const curLine = val.slice(lineStart, sel)
      const indent = curLine.match(/^\s*/)?.[0] ?? ''
      const extra = /[{(\[]$/.test(curLine.trimEnd()) ? ' '.repeat(ui.tabSize) : (/^\s*(?:else|catch|finally|case\b)/.test(curLine) && ui.tabSize ? '' : '')
      if (indent || extra) {
        e.preventDefault()
        const ins = '\n' + indent + extra
        const nv = val.slice(0, sel) + ins + val.slice(ta.selectionEnd)
        setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], content: nv, dirty: true } }))
        ta.value = nv
        ta.setSelectionRange(sel + ins.length, sel + ins.length)
        syncScroll()
        updateLineCol()
      }
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActive()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && e.shiftKey) {
        e.preventDefault()
        setGOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
      } else if (e.key === 'Escape') {
        setFindOpen(false)
        setGOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, buffers, nodes, ui])

  const childrenOf = (parentId: string | null): KodNode[] =>
    (nodes ?? [])
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))

  const toggleDir = (id: string): void => {
    if (!ui) return
    setUi({ ...ui, expanded: ui.expanded.includes(id) ? ui.expanded.filter((x) => x !== id) : [...ui.expanded, id] })
  }

  const renderNode = (n: KodNode, depth: number): React.ReactNode => {
    const isDir = n.kind === 'dir'
    const open = ui?.expanded.includes(n.id) ?? false
    const isActive = active === n.id
    return (
      <div key={n.id}>
        <div
          className={`kod-row${isActive ? ' active' : ''}${isDir ? ' dir' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => (isDir ? toggleDir(n.id) : openNode(n))}
          onDoubleClick={() => {
            if (!isDir) {
              setRenameId(n.id)
              setRenameVal(n.name)
            }
          }}
          title={isDir ? (open ? 'Replier' : 'Déplier') : 'Ouvrir — double-clic pour renommer'}
        >
          <span className="kod-row-ico">{isDir ? (open ? '📂' : '📁') : fileGlyph(n.name)}</span>
          {renameId === n.id ? (
            <input
              className="kod-rename"
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename()
                if (e.key === 'Escape') setRenameId(null)
              }}
              onBlur={() => void commitRename()}
            />
          ) : (
            <span className="kod-row-name">{n.name}</span>
          )}
          {!isDir && buffers[n.id]?.dirty && <span className="kod-dot">●</span>}
          <span className="kod-row-actions">
            {!isDir && (
              <button
                title="Renommer"
                onClick={(e) => {
                  e.stopPropagation()
                  setRenameId(n.id)
                  setRenameVal(n.name)
                }}
              >
                ✎
              </button>
            )}
            <button
              title="Supprimer"
              onClick={(e) => {
                e.stopPropagation()
                void removeNode(n)
              }}
            >
              🗑
            </button>
          </span>
        </div>
        {isDir && open && (
          <div>
            {newItem?.parentId === n.id && (
              <div className="kod-row new" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
                <span className="kod-row-ico">{newItem.kind === 'dir' ? '📁' : '📄'}</span>
                <input
                  className="kod-rename"
                  autoFocus
                  placeholder={newItem.kind === 'dir' ? 'nom du dossier' : 'nom du fichier'}
                  value={newItem.value}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createItem()
                    if (e.key === 'Escape') setNewItem(null)
                  }}
                  onBlur={() => void createItem()}
                />
              </div>
            )}
            {childrenOf(n.id).map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderReal = (e: RealEntry, depth: number): React.ReactNode => {
    const isActive = active === e.key
    return (
      <div key={e.key}>
        <div
          className={`kod-row${isActive ? ' active' : ''}${e.kind === 'dir' ? ' dir' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => (e.kind === 'dir' ? toggleDir(e.key) : void openReal(e))}
        >
          <span className="kod-row-ico">{e.kind === 'dir' ? (ui?.expanded.includes(e.key) ? '📂' : '📁') : fileGlyph(e.name)}</span>
          <span className="kod-row-name">{e.name}</span>
          {e.kind === 'file' && buffers[e.key]?.dirty && <span className="kod-dot">●</span>}
        </div>
        {e.kind === 'dir' && ui?.expanded.includes(e.key) && e.children?.map((c) => renderReal(c, depth + 1))}
      </div>
    )
  }

  if (!nodes || !ui) {
    return (
      <div className="blocs-app">
        <main className="blocs-main">
          <div className="skel skel-title" />
          <div className="skel skel-line" />
          <div className="skel skel-line short" />
        </main>
      </div>
    )
  }

  const lines = content.split('\n')

  return (
    <div className="blocs-app kod-app" style={{ '--side-w': `${sideW}px`, '--kod-fs': `${ui.fontSize}px`, '--kod-tab': ui.tabSize } as CSSProperties}>
      <aside className="blocs-sidebar kod-side">
        <div className="blocs-app-head">
          <Link to="/" className="blocs-app-brand" title="Retour au launcher Skouar">
            <img className="blocs-app-logo" src={`${import.meta.env.BASE_URL}app-icons/kod.svg`} alt="Kod" />
            <span className="blocs-app-name">Kod</span>
          </Link>
          <Link to="/" className="blocs-back" title="Retour au launcher">
            ←
          </Link>
        </div>
        <div className="kod-side-actions">
          <button className="db-btn" onClick={() => setNewItem({ parentId: null, kind: 'file', value: '' })} title="Nouveau fichier à la racine">
            📄 Nouveau fichier
          </button>
          <button className="db-btn" onClick={() => setNewItem({ parentId: null, kind: 'dir', value: '' })} title="Nouveau dossier à la racine">
            📁 Nouveau dossier
          </button>
        </div>
        <div className="kod-side-actions">
          <button className="db-btn" onClick={() => void openDirPicker()} title="Ouvrir un dossier réel du disque (File System Access)">
            🗂 Ouvrir un dossier…
          </button>
          <button className="db-btn" onClick={() => void openFilePicker()} title="Ouvrir un fichier réel du disque">
            📂 Ouvrir un fichier…
          </button>
          <button className="db-btn" onClick={() => setGOpen(true)} title="Rechercher dans tous les fichiers (Ctrl+Shift+F)">
            🔎 Tout chercher
          </button>
        </div>
        <div className="kod-tree">
          <div className="kod-tree-head">📁 Mon projet (local)</div>
          {newItem?.parentId === null && (
            <div className="kod-row new" style={{ paddingLeft: 8 }}>
              <span className="kod-row-ico">{newItem.kind === 'dir' ? '📁' : '📄'}</span>
              <input
                className="kod-rename"
                autoFocus
                placeholder={newItem.kind === 'dir' ? 'nom du dossier' : 'nom du fichier'}
                value={newItem.value}
                onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createItem()
                  if (e.key === 'Escape') setNewItem(null)
                }}
                onBlur={() => void createItem()}
              />
            </div>
          )}
          {childrenOf(null).map((n) => renderNode(n, 0))}
          {nodes.length === 0 && <div className="kod-empty">Projet vide — crée un fichier 📄</div>}
          {dirHandle && (
            <>
              <div className="kod-tree-head" title="Dossier réel du disque">🗂 {dirHandle.name} (disque)</div>
              <div className="kod-row dir" style={{ paddingLeft: 8 }} onClick={() => toggleDir('root:' + dirHandle.name)}>
                <span className="kod-row-ico">{ui.expanded.includes('root:' + dirHandle.name) ? '📂' : '📁'}</span>
                <span className="kod-row-name">{dirHandle.name}</span>
              </div>
              {ui.expanded.includes('root:' + dirHandle.name) && realTree.map((e) => renderReal(e, 1))}
            </>
          )}
        </div>
        {gOpen && (
          <div className="kod-gsearch" data-pop="kglob">
            <input
              autoFocus
              placeholder="Rechercher dans les fichiers…"
              value={gQ}
              onChange={(e) => {
                setGQ(e.target.value)
                void runGlobalSearch()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runGlobalSearch()
              }}
            />
            <div className="kod-gcount">{gBusy ? '…' : `${gResults.length} résultat(s)`}</div>
            <div className="kod-gresults">
              {gResults.map((r, i) => (
                <button key={i} className="kod-gres" onClick={() => jumpTo(r)}>
                  <span className="kod-gres-name">{r.path}</span>
                  <span className="kod-gres-line">L{r.line} · {r.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="blocs-sidebar-foot">
          <ThemeButton />
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
      <main className="blocs-main kod-main">
        <div className="kod-tabs">
          {ui.tabs.map((id) => {
            const n = nodes.find((x) => x.id === id)
            const r = id.startsWith('real:') ? flattenReal(realTree).find((x) => x.key === id) : undefined
            const name = n?.name ?? r?.name ?? id
            return (
              <div key={id} className={`kod-tab${active === id ? ' active' : ''}`} onClick={() => setUi({ ...ui, active: id })}>
                <span className="kod-tab-ico">{n ? fileGlyph(n.name) : '📄'}</span>
                <span className="kod-tab-name">{name}</span>
                {buffers[id]?.dirty && <span className="kod-dot">●</span>}
                <button
                  className="kod-tab-x"
                  title="Fermer l'onglet"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(id)
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
          <div className="kod-tabs-tools">
            <button className="db-btn" title="Rechercher dans le fichier (Ctrl+F)" onClick={() => setFindOpen(true)}>
              🔍
            </button>
            <button className="db-btn" title="Rechercher dans tout le projet (Ctrl+Shift+F)" onClick={() => setGOpen(true)}>
              🔎
            </button>
            <button
              className="db-btn"
              title="Police plus petite"
              onClick={() => setUi({ ...ui, fontSize: Math.max(10, ui.fontSize - 1) })}
            >
              A−
            </button>
            <button
              className="db-btn"
              title="Police plus grande"
              onClick={() => setUi({ ...ui, fontSize: Math.min(22, ui.fontSize + 1) })}
            >
              A+
            </button>
            <button className="db-btn" title={ui.wrap ? 'Désactiver le retour à la ligne' : 'Activer le retour à la ligne'} onClick={() => setUi({ ...ui, wrap: !ui.wrap })}>
              {ui.wrap ? '↵ coupé' : '↵ wrap'}
            </button>
            <button className="db-btn" title="Enregistrer (Ctrl+S)" onClick={() => void saveActive()}>
              💾
            </button>
            <button className="db-btn" title="Enregistrer sous… (disque)" onClick={() => void saveAs()}>
              ⤓
            </button>
          </div>
        </div>
        {active ? (
          <>
            <div className="kod-body">
              <div className="kod-gutter" ref={gutterRef} aria-hidden>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className={`kod-ed${ui.wrap ? ' wrap' : ''}`}>
                <pre className="kod-hl" ref={hlRef} aria-hidden>
                  <code dangerouslySetInnerHTML={{ __html: highlight(content, lang) + '\n' }} />
                </pre>
                <textarea
                  ref={taRef}
                  className={`kod-ta${ui.wrap ? ' wrap' : ''}`}
                  wrap={ui.wrap ? 'soft' : 'off'}
                  spellCheck={false}
                  value={content}
                  style={{ tabSize: ui.tabSize }}
                  onChange={(e) => {
                    setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], content: e.target.value, dirty: true } }))
                    updateLineCol()
                  }}
                  onScroll={syncScroll}
                  onSelect={updateLineCol}
                  onKeyUp={updateLineCol}
                  onClick={updateLineCol}
                  onKeyDown={onTaKeyDown}
                />
                {findOpen && (
                  <div className="kod-find" data-pop="kfind">
                    <input
                      autoFocus
                      placeholder="Rechercher…"
                      value={findQ}
                      onChange={(e) => setFindQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') goMatch(e.shiftKey ? -1 : 1)
                        if (e.key === 'Escape') setFindOpen(false)
                      }}
                    />
                    <span className="kod-find-count">{matches.length ? `${Math.min(findIdx + 1, matches.length)}/${matches.length}` : '0'}</span>
                    <button className="db-btn" title="Précédent (Maj+Entrée)" onClick={() => goMatch(-1)}>
                      ↑
                    </button>
                    <button className="db-btn" title="Suivant (Entrée)" onClick={() => goMatch(1)}>
                      ↓
                    </button>
                    <button className="db-btn" title="Fermer" onClick={() => setFindOpen(false)}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="kod-status">
              <span>
                Ln {lineCol.line}, Col {lineCol.col}
              </span>
              <span>{lang}</span>
              <span>UTF-8</span>
              <span>espaces : {ui.tabSize}</span>
              <span className={buf?.dirty ? 'dirty' : ''}>{buf?.dirty ? '● modifié' : '✓ enregistré'}</span>
              {savedAt && <span className="saved-time">{new Date(savedAt).toLocaleTimeString('fr-FR')}</span>}
            </div>
          </>
        ) : (
          <div className="kod-welcome">
            <div className="kod-welcome-logo">⌨️</div>
            <h2>Kod</h2>
            <p>Éditeur de code 100 % local.</p>
            <p>
              Ouvre un fichier dans l'arbre à gauche, ou crée-en un nouveau. <kbd>Ctrl+F</kbd> cherche dans le fichier, <kbd>Ctrl+Shift+F</kbd> dans tout le projet, <kbd>Ctrl+S</kbd> enregistre.
            </p>
          </div>
        )}
      </main>
      {toast && (
        <div className="toast" key={toast.key} style={{ bottom: 16 }}>
          <span>{toast.msg}</span>
          {toast.action && <button onClick={() => toast.action?.fn()}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  )
}
