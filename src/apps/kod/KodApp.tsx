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
  pushVersion,
  listVersions,
  deleteVersionsFor,
  type KodNode,
  type KodUI,
  type KodVersion
} from './store'
import { highlight, langOf } from './highlight'
import { renderPreview } from './preview'

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

const HL_THEMES = [
  { id: 'default', label: 'Par défaut' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'one-light', label: 'One Light' }
]

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }

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
  const [replOpen, setReplOpen] = useState(false)
  const [replQ, setReplQ] = useState('')
  const [gReplQ, setGReplQ] = useState('')
  const [multi, setMulti] = useState<{ s: number; e: number }[]>([])
  const [preview, setPreview] = useState(false)
  const [mini, setMini] = useState(true)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [versions, setVersions] = useState<KodVersion[]>([])
  const [palOpen, setPalOpen] = useState(false)
  const [palQ, setPalQ] = useState('')
  const [palArg, setPalArg] = useState<string | null>(null)
  const [palVal, setPalVal] = useState('')
  const [folds, setFolds] = useState<{ start: number; saved: string[] }[]>([])
  const [pair, setPair] = useState<{ a: { line: number; col: number }; b: { line: number; col: number } } | null>(null)
  const [charW, setCharW] = useState(8)
  const [probsOpen, setProbsOpen] = useState(false)
  const [fpOpen, setFpOpen] = useState(false)
  const [fpQ, setFpQ] = useState('')
  const [zen, setZen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const hlRef = useRef<HTMLPreElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)
  const miniRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
        await pushVersion(active, buffersRef.current[active]?.content ?? '')
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
  useDismiss('kpal', palOpen, () => { setPalOpen(false); setPalArg(null) })
  useDismiss('kout', outlineOpen, () => setOutlineOpen(false))
  useDismiss('khist', histOpen, () => setHistOpen(false))
  useDismiss('kprob', probsOpen, () => setProbsOpen(false))
  useDismiss('kfp', fpOpen, () => setFpOpen(false))
  useDismiss('kglob', gOpen, () => setGOpen(false))

  const syncScroll = (): void => {
    const ta = taRef.current
    if (!ta) return
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop
      hlRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
    if (miniRef.current) miniRef.current.scrollTop = ta.scrollTop * 0.25
  }

  const updateLineCol = (): void => {
    const ta = taRef.current
    if (!ta) return
    const sel = ta.selectionStart
    const before = ta.value.slice(0, sel)
    const line = before.split('\n').length
    const col = sel - before.lastIndexOf('\n')
    setLineCol({ line, col })
    setPair(findPair(ta.value, sel))
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
    await deleteVersionsFor(n.id)
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


  const setBuf = (id: string, content: string): void => {
    setBuffers((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], content, dirty: true } } : prev))
  }

  const replaceCurrent = (): void => {
    if (!active || !findQ) return
    const b = buffers[active]
    if (!b) return
    const pos = matches[findIdx] ?? matches[0]
    if (pos === undefined) return
    const nv = b.content.slice(0, pos) + replQ + b.content.slice(pos + findQ.length)
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      ta.setSelectionRange(pos + replQ.length, pos + replQ.length)
      syncScroll()
      updateLineCol()
    }
  }

  const replaceAllFile = (): void => {
    if (!active || !findQ) return
    const b = buffers[active]
    if (!b) return
    const n = b.content.split(findQ).length - 1
    if (!n) return
    const nv = b.content.split(findQ).join(replQ)
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      syncScroll()
    }
    notify(`${n} remplacement(s) dans ${activeName}`)
  }

  const replaceAllProject = async (): Promise<void> => {
    const q = gQ.trim()
    if (!q) return
    const keys = [...new Set(gResults.map((r) => r.key))]
    let files = 0
    let count = 0
    for (const key of keys) {
      let text: string | null = null
      let handle: FileSystemFileHandle | undefined
      if (key.startsWith('real:')) {
        const e = flattenReal(realTree).find((x) => x.key === key)
        if (!e?.handle) continue
        try {
          const f = await e.handle.getFile()
          text = await f.text()
          handle = e.handle
        } catch {
          continue
        }
      } else {
        const n = nodesRef.current.find((x) => x.id === key)
        if (!n || n.kind !== 'file') continue
        text = buffersRef.current[key]?.content ?? n.content ?? ''
      }
      if (text == null || !text.includes(q)) continue
      const c = text.split(q).length - 1
      const nv = text.split(q).join(gReplQ)
      count += c
      files++
      if (key.startsWith('real:') && handle) {
        try {
          const w = await handle.createWritable()
          await w.write(nv)
          await w.close()
          setBuffers((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], content: nv, dirty: false } } : prev))
        } catch {
          continue
        }
      } else {
        const n = nodesRef.current.find((x) => x.id === key)
        if (n) {
          await putNode({ ...n, content: nv, updatedAt: Date.now() })
          await pushVersion(key, nv)
          setNodes((prev) => prev?.map((x) => (x.id === key ? { ...x, content: nv, updatedAt: Date.now() } : x)) ?? prev)
          setBuf(key, nv)
        }
      }
    }
    if (active && keys.includes(active)) {
      const ta = taRef.current
      if (ta) {
        ta.value = buffersRef.current[active]?.content ?? ta.value
        syncScroll()
      }
    }
    await runGlobalSearch()
    notify(`${count} remplacement(s) dans ${files} fichier(s)`)
  }

  const wordAt = (ta: HTMLTextAreaElement): { s: number; e: number; w: string } => {
    const i = ta.selectionStart
    const v = ta.value
    const isW = (c: string): boolean => /[\w$]/.test(c)
    let s = i
    let e = ta.selectionEnd
    if (s === e) {
      while (s > 0 && isW(v[s - 1])) s--
      while (e < v.length && isW(v[e])) e++
    }
    return { s, e, w: v.slice(s, e) }
  }

  const addNextOccurrence = (): void => {
    const ta = taRef.current
    if (!ta) return
    const { e, w } = wordAt(ta)
    if (!w) return
    const v = ta.value
    const from = multi.length ? multi[multi.length - 1].e : e
    const idx = v.indexOf(w, from)
    if (idx < 0) {
      notify('Plus d\u2019occurrence')
      return
    }
    const nm = [...multi.filter((m) => m.s !== idx), { s: idx, e: idx + w.length }].sort((a, b) => a.s - b.s)
    setMulti(nm)
    ta.focus()
    ta.setSelectionRange(idx, idx + w.length)
    updateLineCol()
  }

  const selectAllOccurrences = (): void => {
    const ta = taRef.current
    if (!ta) return
    const { w } = wordAt(ta)
    if (!w) return
    const v = ta.value
    const out: { s: number; e: number }[] = []
    let i = v.indexOf(w)
    while (i >= 0) {
      out.push({ s: i, e: i + w.length })
      i = v.indexOf(w, i + w.length)
    }
    setMulti(out)
    if (out.length) {
      ta.focus()
      ta.setSelectionRange(out[out.length - 1].s, out[out.length - 1].e)
    }
    notify(`${out.length} occurrence(s) s\u00e9lectionn\u00e9e(s)`)
  }

  const applyMultiEdit = (key: string): void => {
    if (!active || !multi.length) return
    const b = buffers[active]
    if (!b) return
    let nv = b.content
    const ranges = [...multi].sort((a, c) => c.s - a.s)
    for (const r of ranges) {
      if (key === 'Backspace') {
        nv = r.s === r.e && r.s > 0 ? nv.slice(0, r.s - 1) + nv.slice(r.s) : nv.slice(0, r.s) + nv.slice(r.e)
      } else if (key === 'Delete') {
        nv = nv.slice(0, r.s) + nv.slice(r.s === r.e ? r.s + 1 : r.e)
      } else {
        nv = nv.slice(0, r.s) + key + nv.slice(r.e)
      }
    }
    const last = [...multi].sort((a, c) => a.s - c.s)[multi.length - 1]
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      const off = key === 'Backspace' ? -1 : key === 'Delete' ? 0 : key.length
      const pos = Math.max(0, last.s + off)
      ta.setSelectionRange(pos, pos)
      ta.focus()
      syncScroll()
    }
    setMulti([])
    updateLineCol()
  }

  const outline = useMemo(() => {
    if (!content) return [] as { line: number; label: string }[]
    const out: { line: number; label: string }[] = []
    content.split('\n').forEach((l, i) => {
      let m = l.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/)
      if (m) {
        out.push({ line: i + 1, label: `${m[1]} ${m[2]}` })
        return
      }
      m = l.match(/^\s*(?:def|class)\s+([A-Za-z_]\w*)/)
      if (m && (lang === 'python' || lang === 'ruby')) {
        out.push({ line: i + 1, label: `${l.trim().split(/\s+/)[0]} ${m[1]}` })
        return
      }
      const h = l.match(/^(#{1,6})\s+(.*)/)
      if (h && lang === 'markdown') {
        out.push({ line: i + 1, label: `${'#'.repeat(h[1].length)} ${h[2].slice(0, 40)}` })
        return
      }
      const t = l.match(/^\s*<(\w+)[^>]*id=["']([\w-]+)/)
      if (t && lang === 'html') out.push({ line: i + 1, label: `<${t[1]} #${t[2]}>` })
    })
    return out
  }, [content, lang])

  const jumpLine = (line: number): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const b = buffers[active]
    if (!b) return
    const arr = b.content.split('\n')
    const off = arr.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0)
    ta.focus()
    ta.setSelectionRange(off, off + (arr[line - 1]?.length ?? 0))
    ta.scrollTop = Math.max(0, (line - 1) * 20 - ta.clientHeight / 2)
    syncScroll()
    updateLineCol()
  }

  const miniJump = (e: React.MouseEvent<HTMLDivElement>): void => {
    const ta = taRef.current
    if (!ta) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / 0.25
    ta.scrollTop = Math.max(0, y - ta.clientHeight / 2)
    syncScroll()
  }

  const SNIPPETS: Record<string, { label: string; body: string }[]> = {
    javascript: [
      { label: 'console.log', body: 'console.log($0)' },
      { label: 'fonction', body: 'function $name($args) {\n\t$0\n}' },
      { label: 'fl\u00e8che', body: 'const $name = ($args) => {\n\t$0\n}' },
      { label: 'if / else', body: 'if ($cond) {\n\t$0\n} else {\n\t\n}' },
      { label: 'for', body: 'for (let i = 0; i < $n; i++) {\n\t$0\n}' },
      { label: 'try / catch', body: 'try {\n\t$0\n} catch (e) {\n\t\n}' }
    ],
    typescript: [
      { label: 'interface', body: 'interface $Name {\n\t$0\n}' },
      { label: 'fonction typ\u00e9e', body: 'function $name($args): $ret {\n\t$0\n}' },
      { label: 'console.log', body: 'console.log($0)' }
    ],
    markdown: [
      { label: 'titre H2', body: '## $0' },
      { label: 'lien', body: '[$texte]($url)' },
      { label: 'bloc de code', body: '```$lang\n$0\n```' },
      { label: 'tableau', body: '| $a | $b |\n|---|---|\n| $0 |  |' }
    ],
    html: [
      { label: 'div', body: '<div class="$cls">\n\t$0\n</div>' },
      { label: 'bouton', body: '<button type="button">$0</button>' }
    ],
    css: [{ label: 'media query', body: '@media (max-width: 640px) {\n\t$0\n}' }],
    python: [
      { label: 'fonction', body: 'def $name($args):\n    $0' },
      { label: 'if / else', body: 'if $cond:\n    $0\nelse:\n    pass' }
    ]
  }

  const insertText = (text: string): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const b = buffers[active]
    if (!b) return
    const sel = ta.selectionStart
    const end = ta.selectionEnd
    const i0 = text.indexOf('$0')
    const clean = text.replace('$0', '')
    const nv = b.content.slice(0, sel) + clean + b.content.slice(end)
    setBuf(active, nv)
    ta.value = nv
    const pos = sel + (i0 >= 0 ? i0 : clean.length)
    ta.setSelectionRange(pos, pos)
    ta.focus()
    syncScroll()
    updateLineCol()
  }

  interface PalCmd {
    id: string
    label: string
    arg?: boolean
    run: () => void
  }

  const paletteCmds = (): PalCmd[] => [
    { id: 'find', label: '\U0001F50D Rechercher dans le fichier', run: () => { setPalOpen(false); setFindOpen(true) } },
    { id: 'gfind', label: '\U0001F50E Rechercher dans tout le projet', run: () => { setPalOpen(false); setGOpen(true) } },
    { id: 'repl', label: '\u21C4 Remplacer dans le fichier', run: () => { setPalOpen(false); setFindOpen(true); setReplOpen(true) } },
    { id: 'save', label: '\U0001F4BE Enregistrer (Ctrl+S)', run: () => { setPalOpen(false); void saveActive() } },
    { id: 'preview', label: `\U0001F441 ${preview ? 'Cacher' : 'Afficher'} l\u2019aper\u00e7u`, run: () => setPreview((x) => !x) },
    { id: 'mini', label: `\U0001F5FA ${mini ? 'Cacher' : 'Afficher'} la minimap`, run: () => setMini((x) => !x) },
    { id: 'outline', label: `\u2630 ${outlineOpen ? 'Cacher' : 'Afficher'} le plan`, run: () => { setOutlineOpen((o) => !o); setPalOpen(false) } },
    { id: 'hist', label: '\U0001F558 Historique des versions', run: () => void openHist() },
    { id: 'goto', label: '\u2C7C Aller \u00e0 la ligne\u2026', arg: true, run: () => {} },
    { id: 'fp', label: '\U0001F4C4 Aller au fichier\u2026 (Ctrl+P)', run: () => { setPalOpen(false); setFpOpen(true); setFpQ('') } },
    { id: 'probs', label: `\u26A0\uFE0F Probl\u00e8mes (${probs.length})`, run: () => { setProbsOpen(true); setPalOpen(false) } },
    { id: 'zen', label: `\U0001F9D8 ${zen ? 'Quitter' : 'Activer'} le mode zen`, run: () => setZen((z) => !z) },
    ...HL_THEMES.map((t) => ({ id: 'hl:' + t.id, label: `\U0001F3A8 Th\u00e8me de coloration : ${t.label}`, run: () => setUi((p) => (p ? { ...p, hlTheme: t.id } : p)) })),
    ...(SNIPPETS[lang] ?? []).map((s) => ({ id: 'snip:' + s.label, label: `\u2702\uFE0F Extrait : ${s.label}`, run: () => { setPalOpen(false); insertText(s.body) } }))
  ]

  const filteredPal = paletteCmds().filter((c) => c.label.toLowerCase().includes(palQ.toLowerCase()))

  const openHist = async (): Promise<void> => {
    if (!active) return
    setPalOpen(false)
    setHistOpen(true)
    setVersions(await listVersions(active))
  }

  const restoreVersion = (v: KodVersion): void => {
    if (!active) return
    setBuf(active, v.content)
    const ta = taRef.current
    if (ta) {
      ta.value = v.content
      syncScroll()
    }
    setHistOpen(false)
    notify('Version restaur\u00e9e (Ctrl+S pour valider)')
  }


  const offToLC = (v: string, off: number): { line: number; col: number } => {
    const before = v.slice(0, off)
    const line = before.split('\n').length - 1
    const col = off - (before.lastIndexOf('\n') + 1)
    return { line, col }
  }

  const findPair = (v: string, pos: number): { a: { line: number; col: number }; b: { line: number; col: number } } | null => {
    const open = '([{'
    const close = ')]}'
    let i = -1
    if (pos > 0 && open.includes(v[pos - 1])) i = pos - 1
    else if (pos < v.length && close.includes(v[pos])) i = pos
    if (i < 0) return null
    const fwd = open.includes(v[i])
    const oc = fwd ? v[i] : close[open.indexOf(v[i])]
    const cc = fwd ? close[open.indexOf(v[i])] : v[i]
    let depth = 0
    if (fwd) {
      for (let j = i; j < v.length; j++) {
        if (v[j] === oc) depth++
        else if (v[j] === cc) {
          depth--
          if (!depth) return { a: offToLC(v, i), b: offToLC(v, j) }
        }
      }
    } else {
      for (let j = i; j >= 0; j--) {
        if (v[j] === oc) depth++
        else if (v[j] === cc) {
          depth--
          if (!depth) return { a: offToLC(v, j), b: offToLC(v, i) }
        }
      }
    }
    return null
  }

  useEffect(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    const fs = ui?.fontSize ?? 13
    ctx.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`
    const w = ctx.measureText('M').width
    if (w > 0) setCharW(w)
  }, [ui?.fontSize])

  const commentToken = (): string => {
    if (['html', 'xml'].includes(lang)) return '<!--'
    if (['css'].includes(lang)) return '/*'
    if (['python', 'ruby', 'bash', 'yaml', 'toml', 'ini'].includes(lang)) return '#'
    if (lang === 'sql') return '--'
    if (['markdown', 'text', 'json', 'diff'].includes(lang)) return ''
    return '//'
  }

  const toggleComment = (): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const tok = commentToken()
    if (!tok) return
    const v = ta.value
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const ls = v.slice(0, s).split('\n').length - 1
    const le = v.slice(0, e).split('\n').length - 1
    const arr = v.split('\n')
    const seg = arr.slice(ls, le + 1)
    const nonEmpty = seg.filter((l) => l.trim())
    const closing = tok === '<!--' ? '-->' : tok === '/*' ? '*/' : ''
    const allCommented = nonEmpty.length > 0 && nonEmpty.every((l) => l.trimStart().startsWith(tok))
    const next = seg.map((l) => {
      if (!l.trim()) return l
      const ind = l.match(/^\s*/)?.[0] ?? ''
      if (allCommented) return ind + l.trimStart().slice(tok.length).replace(/^\s?/, '') + (closing && l.trimEnd().endsWith(closing) ? '' : '')
      return ind + tok + ' ' + l.trimStart() + (closing ? ' ' + closing : '')
    })
    arr.splice(ls, le - ls + 1, ...next)
    const nv = arr.join('\n')
    setBuf(active, nv)
    ta.value = nv
    ta.setSelectionRange(s, s + (nv.length - v.length))
    syncScroll()
    updateLineCol()
  }

  const moveLines = (dir: -1 | 1): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const v = ta.value
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const ls = v.slice(0, s).split('\n').length - 1
    const le = v.slice(0, e).split('\n').length - 1
    const arr = v.split('\n')
    const to = dir === -1 ? ls - 1 : le + 1
    if (to < 0 || to >= arr.length) return
    const block = arr.slice(ls, le + 1)
    arr.splice(ls, le - ls + 1)
    const at = dir === -1 ? to : ls + (dir === 1 ? 1 : 0) + (le - ls) - (le - ls)
    arr.splice(dir === -1 ? to : le + 1, 0, ...block)
    const nv = arr.join('\n')
    setBuf(active, nv)
    ta.value = nv
    const nl = dir === -1 ? ls - 1 : ls + 1
    const off = nv.split('\n').slice(0, nl).reduce((a, l) => a + l.length + 1, 0)
    ta.setSelectionRange(off, off + (le - ls + 1 > 1 ? block.join('\n').length : 0))
    ta.focus()
    syncScroll()
    updateLineCol()
  }

  const duplicateSel = (): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const v = ta.value
    const s = ta.selectionStart
    const e = ta.selectionEnd
    let ins: string
    let pos: number
    if (s === e) {
      const ls = v.slice(0, s).split('\n').length - 1
      ins = '\n' + v.split('\n')[ls]
      pos = s + ins.length
    } else {
      ins = v.slice(s, e)
      pos = e + ins.length
    }
    const nv = v.slice(0, e) + ins + v.slice(e)
    setBuf(active, nv)
    ta.value = nv
    ta.setSelectionRange(pos, pos)
    ta.focus()
    syncScroll()
    updateLineCol()
  }

  const handleAutoPair = (ch: string): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const v = ta.value
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const close = PAIRS[ch]
    if (!close) return
    if (v[e] === close && s === e) {
      ta.setSelectionRange(s + 1, s + 1)
      updateLineCol()
      return
    }
    if ((ch === '"' || ch === "'") && s === e && /[\w\u00C0-\u024F]/.test(v[s - 1] ?? '')) {
      const nv = v.slice(0, s) + ch + v.slice(e)
      setBuf(active, nv)
      ta.value = nv
      ta.setSelectionRange(s + 1, s + 1)
      syncScroll()
      return
    }
    const sel = v.slice(s, e)
    const nv = v.slice(0, s) + ch + sel + close + v.slice(e)
    setBuf(active, nv)
    ta.value = nv
    if (sel) ta.setSelectionRange(s + 1, s + 1 + sel.length)
    else ta.setSelectionRange(s + 1, s + 1)
    ta.focus()
    syncScroll()
    updateLineCol()
  }

  const foldEnd = (arr: string[], start: number): number => {
    let d = 0
    for (let j = start; j < arr.length; j++) {
      d += (arr[j].match(/[{(\[]/g) ?? []).length - (arr[j].match(/[})\]]/g) ?? []).length
      if (d <= 0 && j > start) return j
    }
    return -1
  }

  const foldable = useMemo(() => {
    const set = new Set<number>()
    const arr = content.split('\n')
    for (let i = 0; i < arr.length; i++) {
      const opens = (arr[i].match(/[{(\[]/g) ?? []).length
      const closes = (arr[i].match(/[})\]]/g) ?? []).length
      if (opens - closes > 0) {
        const end = foldEnd(arr, i)
        if (end > i + 1) set.add(i)
      }
    }
    return set
  }, [content])

  const foldedStarts = useMemo(() => new Set(folds.map((f) => f.start)), [folds])

  const toggleFold = (i: number): void => {
    if (!active) return
    const existing = folds.find((f) => f.start === i)
    const arr = content.split('\n')
    if (existing) {
      const next = arr.slice()
      next.splice(existing.start + 1, 1, ...existing.saved.slice(1))
      const nv = next.join('\n')
      setFolds((fs) => fs.filter((f) => f.start !== i))
      setBuf(active, nv)
      const ta = taRef.current
      if (ta) {
        ta.value = nv
        syncScroll()
      }
      return
    }
    const end = foldEnd(arr, i)
    if (end <= i + 1) return
    const saved = arr.slice(i, end + 1)
    const placeholder = (arr[i].match(/^\s*/)?.[0] ?? '') + '\u22EF ' + (end - i) + ' lignes'
    const next = [...arr.slice(0, i + 1), placeholder, ...arr.slice(end + 1)]
    setFolds((fs) => [...fs, { start: i, saved }])
    const nv = next.join('\n')
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      syncScroll()
    }
  }

  const unfoldAll = (): string => {
    let arr = content.split('\n')
    for (const f of [...folds].sort((a, b) => b.start - a.start)) {
      arr.splice(f.start + 1, 1, ...f.saved.slice(1))
    }
    setFolds([])
    return arr.join('\n')
  }

  const probs = useMemo(() => {
    const out: { line: number; label: string }[] = []
    content.split('\n').forEach((l, i) => {
      const t = l.match(/\b(TODO|FIXME|HACK|XXX)\b/)
      if (t) out.push({ line: i + 1, label: `${t[1]} : ${l.trim().slice(0, 60)}` })
      if (l.length > 120) out.push({ line: i + 1, label: `ligne longue (${l.length} car.)` })
      if (/[ \t]$/.test(l)) out.push({ line: i + 1, label: 'espace en fin de ligne' })
    })
    return out
  }, [content])

  const fpList = useMemo(() => {
    const q = fpQ.trim().toLowerCase()
    const virt = (nodes ?? []).filter((n) => n.kind === 'file' && (!q || n.name.toLowerCase().includes(q))).map((n) => ({ key: n.id, name: n.name }))
    const real = flattenReal(realTree).filter((e) => !q || e.name.toLowerCase().includes(q)).map((e) => ({ key: e.key, name: e.path }))
    return [...virt, ...real]
  }, [fpQ, nodes, realTree])

  const openFileByKey = (key: string): void => {
    if (key.startsWith('real:')) {
      const e = flattenReal(realTree).find((x) => x.key === key)
      if (e) void openReal(e)
    } else {
      const n = nodesRef.current.find((x) => x.id === key)
      if (n) openNode(n)
    }
  }

  const moveNode = async (id: string, parentId: string): Promise<void> => {
    const n = nodes?.find((x) => x.id === id)
    if (!n || n.parentId === parentId) return
    await putNode({ ...n, parentId, updatedAt: Date.now() })
    setNodes((prev) => prev?.map((x) => (x.id === id ? { ...x, parentId } : x)) ?? prev)
    if (ui) setUi({ ...ui, expanded: [...new Set([...ui.expanded, parentId])] })
    notify(`« ${n.name} » déplacé`)
  }

  const importFiles = async (files: File[]): Promise<void> => {
    let count = 0
    for (const f of files) {
      if (f.size > 1_000_000) continue
      const name0 = f.name
      let name = name0
      let k = 1
      while (nodesRef.current.some((n) => n.parentId === null && n.name === name)) {
        name = name0.replace(/(\.[^.]+)?$/, ` (${k})$1`)
        k++
      }
      const node: KodNode = { id: uid(), parentId: null, name, kind: 'file', content: await f.text(), updatedAt: Date.now() }
      await putNode(node)
      setNodes((prev) => [...(prev ?? []), node])
      setBuffers((prev) => ({ ...prev, [node.id]: { content: node.content ?? '', dirty: false } }))
      count++
    }
    if (count) notify(`${count} fichier(s) importé(s) 📥`)
  }

  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length) void importFiles(files)
  }

  const onTaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!active || !ui) return
    if (multi.length > 0 && (e.key === 'Backspace' || e.key === 'Delete' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey))) {
      e.preventDefault()
      applyMultiEdit(e.key)
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault()
      toggleComment()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      duplicateSel()
      return
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      moveLines(e.key === 'ArrowUp' ? -1 : 1)
      return
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && PAIRS[e.key]) {
      handleAutoPair(e.key)
      e.preventDefault()
      return
    }
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setFindOpen(true)
        setReplOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setFpOpen(true)
        setFpQ('')
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault()
        addNextOccurrence()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && e.shiftKey) {
        e.preventDefault()
        selectAllOccurrences()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalOpen(true)
        setPalQ('')
        setPalArg(null)
      } else if (e.key === 'Escape') {
        setFindOpen(false)
        setGOpen(false)
        setPalOpen(false)
        setOutlineOpen(false)
        setHistOpen(false)
        setMulti([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, buffers, nodes, ui, multi])

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
    <div
      className={`blocs-app kod-app hl-${ui.hlTheme}${zen ? ' zen' : ''}`}
      style={{ '--side-w': `${sideW}px`, '--kod-fs': `${ui.fontSize}px`, '--kod-tab': ui.tabSize, '--chw': `${charW}px` } as CSSProperties}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); void importFiles([...e.dataTransfer.files]) } }}
    >
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
          <button className="db-btn" aria-label="Importer des fichiers" title="Importer des fichiers dans le projet (ou glisse-les dans la fenêtre)" onClick={() => fileInputRef.current?.click()}>
            ⬆️ Importer
          </button>
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
            {gResults.length > 0 && (
              <div className="kod-grepl">
                <input placeholder="Remplacer par…" value={gReplQ} onChange={(e) => setGReplQ(e.target.value)} />
                <button className="db-btn" onClick={() => void replaceAllProject()}>
                  Tout remplacer ({gResults.length})
                </button>
              </div>
            )}
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
        <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />
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
            <button className="db-btn" aria-label="Aperçu" title="Aperçu rendu (md/html)" onClick={() => setPreview((x) => !x)}>👁</button>
            <button className="db-btn" aria-label="Plan du fichier" title="Plan (symboles)" onClick={() => setOutlineOpen((o) => !o)}>☰</button>
            <button className="db-btn" aria-label="Minimap" title="Minimap" onClick={() => setMini((x) => !x)}>🗺</button>
            <button className="db-btn" aria-label="Historique des versions" title="Historique des versions" onClick={() => void openHist()}>🕘</button>
            <button className="db-btn" aria-label="Palette de commandes" title="Palette de commandes (Ctrl+K)" onClick={() => { setPalOpen(true); setPalQ(''); setPalArg(null) }}>⌘K</button>
            <button className="db-btn" aria-label="Problèmes" title={`Problèmes (${probs.length})`} onClick={() => setProbsOpen(true)}>⚠️</button>
            <button className="db-btn" aria-label="Mode zen" title="Mode zen (sans sidebar, éditeur centré)" onClick={() => setZen((z) => !z)}>🧘</button>
          </div>
        </div>
        {active ? (
          <>
            <div className={`kod-body${preview && (lang === 'markdown' || lang === 'html') ? ' split' : ''}`}>
              <div className="kod-gutter" ref={gutterRef} aria-hidden>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="kod-edwrap">
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
                {pair && (
                  <>
                    <div className="kod-bracket" style={{ left: 14 + pair.a.col * charW, top: 10 + pair.a.line * (ui.fontSize * 1.55) }} />
                    <div className="kod-bracket" style={{ left: 14 + pair.b.col * charW, top: 10 + pair.b.line * (ui.fontSize * 1.55) }} />
                  </>
                )}
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
                    {replOpen && (
                      <>
                        <input className="kod-repl" placeholder="Remplacer par…" value={replQ} onChange={(e) => setReplQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') replaceCurrent() }} />
                        <button className="db-btn" title="Remplacer l’occurrence courante" onClick={() => replaceCurrent()}>⇄</button>
                        <button className="db-btn" title="Tout remplacer dans ce fichier" onClick={() => replaceAllFile()}>Tout ⇄</button>
                      </>
                    )}
                    <span className="kod-find-count">{matches.length ? `${Math.min(findIdx + 1, matches.length)}/${matches.length}` : '0'}</span>
                    <button className="db-btn" title="Précédent (Maj+Entrée)" onClick={() => goMatch(-1)}>
                      ↑
                    </button>
                    <button className="db-btn" title="Suivant (Entrée)" onClick={() => goMatch(1)}>
                      ↓
                    </button>
                    <button className="db-btn" title="Afficher le remplacement (Ctrl+H)" aria-label="Remplacer" onClick={() => setReplOpen((o) => !o)}>⇄</button>
                    <button className="db-btn" title="Fermer" onClick={() => setFindOpen(false)}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {mini && lang !== 'text' && (
                <div className="kod-minimap" ref={miniRef} onClick={miniJump} aria-hidden>
                  <div className="kod-minimap-inner" style={{ width: 440 }} dangerouslySetInnerHTML={{ __html: highlight(content, lang) + '\n' }} />
                </div>
              )}
              </div>
              {preview && (lang === 'markdown' || lang === 'html') && (
                <div className="kod-preview" dangerouslySetInnerHTML={{ __html: renderPreview(content, lang) }} />
              )}
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
      {probsOpen && (
        <div className="kod-panel kod-outline" data-pop="kprob">
          <div className="kod-panel-head">⚠️ Problèmes — {activeName} ({probs.length})</div>
          {probs.map((pr) => (
            <button key={pr.line} className="kod-panel-item" onClick={() => { jumpLine(pr.line); setProbsOpen(false) }}>
              <span className="kod-panel-line">L{pr.line}</span> {pr.label}
            </button>
          ))}
          {probs.length === 0 && <div className="kod-pal-empty">Aucun problème détecté 🎉</div>}
        </div>
      )}
      {fpOpen && (
        <div className="kod-pal" data-pop="kfp">
          <input
            autoFocus
            aria-label="Aller au fichier"
            placeholder="Aller au fichier… (Ctrl+P)"
            value={fpQ}
            onChange={(e) => setFpQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && fpList[0]) { openFileByKey(fpList[0].key); setFpOpen(false) }
              if (e.key === 'Escape') setFpOpen(false)
            }}
          />
          <div className="kod-pal-list" role="listbox">
            {fpList.slice(0, 30).map((f) => (
              <button key={f.key} className="kod-pal-item" role="option" onClick={() => { openFileByKey(f.key); setFpOpen(false) }}>{f.name}</button>
            ))}
            {fpList.length === 0 && <div className="kod-pal-empty">Aucun fichier</div>}
          </div>
        </div>
      )}
      {palOpen && (
        <div className="kod-pal" data-pop="kpal">
          <input
            autoFocus
            aria-label="Palette de commandes"
            placeholder={palArg === 'goto' ? 'Numéro de ligne…' : 'Commande ou extrait… (Ctrl+K)'}
            value={palArg === 'goto' ? palVal : palQ}
            onChange={(e) => (palArg === 'goto' ? setPalVal(e.target.value) : setPalQ(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (palArg === 'goto') {
                  const ln = parseInt(palVal, 10)
                  if (ln > 0) jumpLine(ln)
                  setPalOpen(false)
                  setPalArg(null)
                } else {
                  const c = filteredPal[0]
                  if (c) c.run()
                }
              }
              if (e.key === 'Escape') { setPalOpen(false); setPalArg(null) }
            }}
          />
          {palArg !== 'goto' && (
            <div className="kod-pal-list" role="listbox">
              {filteredPal.map((c) => (
                <button key={c.id} className="kod-pal-item" role="option" onClick={() => { if (c.arg) { setPalArg(c.id); setPalVal('') } else c.run() }}>
                  {c.label}
                </button>
              ))}
              {filteredPal.length === 0 && <div className="kod-pal-empty">Aucun résultat</div>}
            </div>
          )}
        </div>
      )}
      {outlineOpen && (
        <div className="kod-panel kod-outline" data-pop="kout">
          <div className="kod-panel-head">☰ Plan — {activeName}</div>
          {outline.map((o) => (
            <button key={o.line} className="kod-panel-item" onClick={() => { jumpLine(o.line); setOutlineOpen(false) }}>
              <span className="kod-panel-line">L{o.line}</span> {o.label}
            </button>
          ))}
          {outline.length === 0 && <div className="kod-pal-empty">Aucun symbole détecté</div>}
        </div>
      )}
      {histOpen && (
        <div className="kod-panel kod-hist" data-pop="khist">
          <div className="kod-panel-head">🕘 Historique — {activeName}</div>
          {versions.map((v) => (
            <div key={v.id} className="kod-hist-row">
              <span>{new Date(v.at).toLocaleString('fr-FR')} · {v.content.length} car.</span>
              <button className="db-btn" onClick={() => restoreVersion(v)}>Restaurer</button>
            </div>
          ))}
          {versions.length === 0 && <div className="kod-pal-empty">Aucune version enregistrée</div>}
        </div>
      )}
      {toast && (
        <div className="toast" key={toast.key} style={{ bottom: 16 }}>
          <span>{toast.msg}</span>
          {toast.action && <button onClick={() => toast.action?.fn()}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  )
}
