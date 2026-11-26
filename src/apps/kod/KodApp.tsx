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
  loadProjects,
  putProject,
  deleteProject,
  pushCommit,
  listCommits,
  deleteCommit,
  putBranch,
  loadBranches,
  delBranch,
  loadSnippets,
  saveSnippets,
  type KodNode,
  type KodUI,
  type KodVersion,
  type KodProject,
  type KodCommit,
  type KodBranch,
  type KodSnippet
} from './store'
import { highlight, langOf } from './highlight'
import { renderPreview } from './preview'
import { loadAppSettings, saveAppSettings, SETTINGS_EVENT } from '../../Settings'
import SettingsButton from '../../Settings'
import { KOD_TEMPLATES, templateGroups } from './templates'
import { syntaxIssues, type KodIssue } from './diagnostics'
import { diffLines, type DiffRow } from './diff'
import { expandEmmet } from './emmet'
import { DEFAULT_KEYMAP, comboOf } from './keymap'
import { buildIndex, findDef, resolveImport, wordAtOffset, importSpecAtOffset, type DefFile } from './definitions'
import { zipFiles, unzipFiles, entryText } from './zip'

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
  mtime?: number
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

const IMG_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico'])
const isImageName = (name: string): boolean => IMG_EXTS.has((name.split('.').pop() ?? '').toLowerCase())
const fileToDataURL = (f: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const rd = new FileReader()
    rd.onload = () => res(String(rd.result))
    rd.onerror = () => rej(rd.error)
    rd.readAsDataURL(f)
  })

const isCodeName = (name: string): boolean => {
  if (TEXT_EXTS.has((name.split('.').pop() ?? '').toLowerCase())) return true
  if (isImageName(name)) return true
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
      let mtime = 0
      try {
        mtime = (await (h as FileSystemFileHandle).getFile()).lastModified
      } catch { /* mtime inconnu */ }
      out.push({ key: `real:${p}`, name, kind: 'file', path: p, handle: h as FileSystemFileHandle, mtime })
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

import { HL_THEMES } from './themes'

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
  const [focus, setFocus] = useState(false)
  const [newTabOpen, setNewTabOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [projects, setProjects] = useState<KodProject[]>([])
  const [pid, setPid] = useState('default')
  const [projOpen, setProjOpen] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [renProj, setRenProj] = useState<string | null>(null)
  const [renProjVal, setRenProjVal] = useState('')
  const [gitOpen, setGitOpen] = useState(false)
  const [commits, setCommits] = useState<KodCommit[]>([])
  const [gitMsg, setGitMsg] = useState('')
  const [branches, setBranches] = useState<KodBranch[]>([])
  const [newBranch, setNewBranch] = useState('')
  const [curBranch, setCurBranch] = useState('main')
  const [snipOpen, setSnipOpen] = useState(false)
  const [snips, setSnips] = useState<KodSnippet[]>([])
  const [snipLang, setSnipLang] = useState('javascript')
  const [snipLabel, setSnipLabel] = useState('')
  const [snipBody, setSnipBody] = useState('')
  const zipInputRef = useRef<HTMLInputElement | null>(null)
  const snipInputRef = useRef<HTMLInputElement | null>(null)
  const [findRe, setFindRe] = useState(false)
  const [gRe, setGRe] = useState(false)
  const [synIssues, setSynIssues] = useState<KodIssue[]>([])
  const [rect, setRect] = useState<{ aLine: number; aCol: number; line: number; col: number } | null>(null)
  const [bms, setBms] = useState<number[]>([])
  const [tabMenu, setTabMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [diffV, setDiffV] = useState<KodVersion | null>(null)
  const [splitId, setSplitId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState(false)
  const [dragTab, setDragTab] = useState<string | null>(null)
  const [extChanged, setExtChanged] = useState<string[]>([])
  const [keymap, setKeymap] = useState<Record<string, string>>({})
  const mtimesRef = useRef<Record<string, number>>({})
  const realTreeRef = useRef<RealEntry[]>([])
  const extRef = useRef<string[]>([])
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
  realTreeRef.current = realTree
  extRef.current = extChanged

  const active = ui?.active ?? null
  const buf = active ? buffers[active] : undefined
  const activeNode = nodes?.find((n) => n.id === active) ?? null
  const activeReal = active?.startsWith('real:') ? flattenReal(realTree).find((e) => e.key === active) ?? null : null
  const activeName = activeNode?.name ?? activeReal?.name ?? ''
  const lang = langOf(activeName)
  const content = buf?.content ?? ''
  const km = (id: string): string => keymap[id] ?? DEFAULT_KEYMAP[id] ?? ''
  const isImgActive = isImageName(activeName)
  const isSvgActive = /\.svg$/i.test(activeName)
  const nodeName = (id: string): string =>
    nodes?.find((x) => x.id === id)?.name ?? flattenReal(realTree).find((x) => x.key === id)?.name ?? id

  useEffect(() => {
    const apply = (): void => {
      const s = loadAppSettings('kod')
      if (s.mini !== undefined) setMini(s.mini !== false)
      if (s.keymap && typeof s.keymap === 'object') setKeymap(s.keymap as Record<string, string>)
      setUi((prev) =>
        prev
          ? {
              ...prev,
              fontSize: Number(s.fontSize ?? prev.fontSize),
              tabSize: Number(s.tabSize ?? prev.tabSize),
              wrap: s.wrap === true,
              hlTheme: String(s.hlTheme ?? prev.hlTheme)
            }
          : prev
      )
    }
    apply()
    window.addEventListener(SETTINGS_EVENT, apply)
    return () => window.removeEventListener(SETTINGS_EVENT, apply)
  }, [])

  useEffect(() => {
    if (!ui) return
    saveAppSettings('kod', { fontSize: ui.fontSize, tabSize: ui.tabSize, wrap: ui.wrap, hlTheme: ui.hlTheme, mini }, false)
  }, [ui?.fontSize, ui?.tabSize, ui?.wrap, ui?.hlTheme, mini])

  useEffect(() => {
    let alive = true
    void (async () => {
      let projs = await loadProjects()
      if (!projs.length) {
        const p: KodProject = { id: 'default', name: 'Mon projet', createdAt: Date.now() }
        await putProject(p)
        projs = [p]
      }
      const [ns, u0] = await Promise.all([loadNodes('default'), loadUI()])
      const sess0 = await loadKV<Partial<KodUI>>('sess:default')
      const u = sess0
        ? { ...u0, tabs: sess0.tabs ?? [], active: sess0.active ?? null, expanded: sess0.expanded ?? [], pinned: sess0.pinned ?? [], closed: sess0.closed ?? [] }
        : u0
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
        await putNode({ ...welcome, projectId: 'default' })
        seeded = [{ ...welcome, projectId: 'default' }]
        u.tabs = [welcome.id]
        u.active = welcome.id
        await saveUI(u)
      }
      if (!alive) return
      setProjects(projs)
      setSnips(await loadSnippets())
      setCurBranch((await loadKV<string>('branch:default')) ?? 'main')
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
            const tree = await scanDir(h, '')
            setRealTree(tree)
            const mt: Record<string, number> = {}
            for (const e of flattenReal(tree)) if (e.mtime) mt[e.path] = e.mtime
            mtimesRef.current = mt
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
    const t = setTimeout(() => {
      void saveUI(ui)
      void saveKV('sess:' + pid, { tabs: ui.tabs, active: ui.active, expanded: ui.expanded, pinned: ui.pinned, closed: ui.closed })
    }, 250)
    return () => clearTimeout(t)
  }, [ui, pid])

  useEffect(() => {
    if (!nodes) return
    const t = setTimeout(() => {
      void (async () => {
        let savedActive = false
        for (const [id, b] of Object.entries(buffersRef.current)) {
          if (!b.dirty || id.startsWith('real:')) continue
          const n = nodesRef.current.find((x) => x.id === id)
          if (!n) continue
          await putNode({ ...n, content: b.content, updatedAt: Date.now() })
          await pushVersion(id, b.content)
          setNodes((prev) => prev?.map((x) => (x.id === id ? { ...x, content: b.content, updatedAt: Date.now() } : x)) ?? prev)
          setBuffers((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], dirty: false } } : prev))
          if (id === uiRef.current?.active) savedActive = true
        }
        if (savedActive) setSavedAt(Date.now())
      })()
    }, 400)
    return () => clearTimeout(t)
  }, [nodes, buffers, active])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 4200)
    return () => clearTimeout(t)
  }, [toast])

  const pollExternal = async (): Promise<void> => {
    const changed: string[] = []
    const mt: Record<string, number> = { ...mtimesRef.current }
    for (const e of flattenReal(realTreeRef.current)) {
      if (!e.handle) continue
      try {
        const f = await e.handle.getFile()
        mt[e.path] = f.lastModified
        if (mtimesRef.current[e.path] !== undefined && f.lastModified !== mtimesRef.current[e.path]) changed.push(e.path)
      } catch { /* ignore */ }
    }
    mtimesRef.current = mt
    extRef.current = changed
    setExtChanged(changed)
  }

  useEffect(() => {
    if (!dirHandle) return
    void pollExternal()
    const iv = setInterval(() => void pollExternal(), 4000)
    return () => clearInterval(iv)
  }, [dirHandle, realTree])

  const reloadDisk = async (): Promise<void> => {
    if (!dirHandle) return
    const paths = extRef.current
    let n = 0
    let skipped = 0
    for (const e of flattenReal(realTreeRef.current)) {
      if (!e.handle) continue
      let f: File
      try {
        f = await e.handle.getFile()
      } catch {
        continue
      }
      mtimesRef.current[e.path] = f.lastModified
      if (!paths.includes(e.path)) continue
      const cur = buffersRef.current[e.key]
      if (cur?.dirty) {
        skipped++
        continue
      }
      try {
        const text = isImageName(e.name) ? await fileToDataURL(f) : await f.text()
        setBuffers((prev) => (prev[e.key] ? { ...prev, [e.key]: { content: text, dirty: false, real: e.handle } } : prev))
        if (e.key === uiRef.current?.active && taRef.current) {
          taRef.current.value = text
          syncScroll()
        }
        n++
      } catch { /* ignore */ }
    }
    extRef.current = []
    setExtChanged([])
    if (n) notify(`${n} fichier(s) rechargé(s) depuis le disque ⟳`)
    if (skipped) notify(`${skipped} fichier(s) non rechargé(s) : modifiés localement en même temps`)
  }

  const rescanDisk = async (): Promise<void> => {
    if (!dirHandle) return
    const tree = await scanDir(dirHandle, '')
    setRealTree(tree)
    const mt: Record<string, number> = {}
    for (const e of flattenReal(tree)) if (e.mtime) mt[e.path] = e.mtime
    mtimesRef.current = mt
    extRef.current = []
    setExtChanged([])
    notify('Dossier actualisé ⟳')
  }

  const openGit = async (): Promise<void> => {
    setGitOpen(true)
    setCommits(await listCommits(pid))
    setBranches(await loadBranches())
    setCurBranch((await loadKV<string>('branch:' + pid)) ?? 'main')
  }

  const commitCurrent = async (): Promise<void> => {
    if (!active) return
    const b = buffersRef.current[active]
    if (!b) return
    await pushCommit({
      id: uid(),
      projectId: pid,
      scope: 'file',
      fileId: active,
      fileName: nodeName(active),
      at: Date.now(),
      message: gitMsg.trim() || 'commit',
      branch: curBranch,
      files: { [active]: b.content },
      names: { [active]: nodeName(active) }
    })
    setGitMsg('')
    setCommits(await listCommits(pid))
    notify('Commit local créé 🌿')
  }

  const commitProject = async (): Promise<void> => {
    const files: Record<string, string> = {}
    const names: Record<string, string> = {}
    for (const n of nodesRef.current) {
      if (n.kind !== 'file') continue
      files[n.id] = buffersRef.current[n.id]?.content ?? n.content ?? ''
      names[n.id] = nodePath(n)
    }
    await pushCommit({ id: uid(), projectId: pid, scope: 'project', at: Date.now(), message: gitMsg.trim() || 'commit projet', branch: curBranch, files, names })
    setGitMsg('')
    setCommits(await listCommits(pid))
    notify(`Commit projet (${Object.keys(files).length} fichiers) 🌿`)
  }

  const restoreCommit = async (c: KodCommit): Promise<void> => {
    let n = 0
    for (const [id, ct] of Object.entries(c.files)) {
      if (id.startsWith('real:')) continue
      const node = nodesRef.current.find((x) => x.id === id)
      if (!node) continue
      await putNode({ ...node, content: ct, updatedAt: Date.now() })
      setNodes((prev) => prev?.map((x) => (x.id === id ? { ...x, content: ct } : x)) ?? prev)
      setBuf(id, ct)
      if (id === active && taRef.current) {
        taRef.current.value = ct
        syncScroll()
      }
      n++
    }
    setGitOpen(false)
    notify(`Restauration : ${n} fichier(s) ↩ (Ctrl+S pour valider)`)
  }

  const diffCommit = (c: KodCommit): void => {
    const fid = c.scope === 'file' && c.fileId ? c.fileId : Object.keys(c.files)[0]
    if (fid) setDiffV({ id: c.id, fileId: fid, at: c.at, content: c.files[fid] ?? '' })
  }

  const createBranch = async (): Promise<void> => {
    const name = newBranch.trim()
    if (!name || !commits.length) return
    await putBranch({ name, commitId: commits[0].id, at: Date.now() })
    await saveKV('branch:' + pid, name)
    setNewBranch('')
    setCurBranch(name)
    setBranches(await loadBranches())
    notify(`Branche « ${name} » créée 🌿`)
  }

  const exportZip = async (): Promise<void> => {
    const entries: { name: string; data: string }[] = []
    for (const n of nodesRef.current) {
      if (n.kind !== 'file') continue
      const c = buffersRef.current[n.id]?.content ?? n.content ?? ''
      entries.push({ name: nodePath(n), data: c })
    }
    if (!entries.length) {
      notify('Projet vide')
      return
    }
    const blob = await zipFiles(entries)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(projects.find((p) => p.id === pid)?.name ?? 'projet').replace(/[^\w-]+/g, '-')}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    notify(`Projet exporté en ZIP (${entries.length} fichiers) 📦`)
  }

  const importZip = async (file: File): Promise<void> => {
    try {
      const entries = await unzipFiles(file)
      let count = 0
      for (const e of entries) {
        const parts = e.name.split('/').filter(Boolean)
        if (!parts.length) continue
        let parentId: string | null = null
        for (let i = 0; i < parts.length - 1; i++) {
          const dirName = parts[i]
          let dir = nodesRef.current.find((n) => n.parentId === parentId && n.kind === 'dir' && n.name === dirName)
          if (!dir) {
            const dn: KodNode = { id: uid(), parentId, projectId: pid, name: dirName, kind: 'dir', updatedAt: Date.now() }
            await putNode(dn)
            setNodes((prev) => [...(prev ?? []), dn])
            dir = dn
          }
          parentId = dir.id
        }
        let name = parts[parts.length - 1]
        const base = name
        let k = 1
        while (nodesRef.current.some((n) => n.parentId === parentId && n.name === name)) {
          name = base.replace(/(\.[^.]+)?$/, ` (${k})$1`)
          k++
        }
        const content = entryText(e)
        const node: KodNode = { id: uid(), parentId, projectId: pid, name, kind: 'file', content, updatedAt: Date.now() }
        await putNode(node)
        setNodes((prev) => [...(prev ?? []), node])
        setBuffers((prev) => ({ ...prev, [node.id]: { content, dirty: false } }))
        count++
      }
      notify(`${count} fichier(s) importé(s) depuis le ZIP 📦`)
    } catch {
      notify('ZIP illisible')
    }
  }

  const mergedSnippets = (l: string): { label: string; body: string }[] => [...(SNIPPETS[l] ?? []), ...snips.filter((s) => s.lang === l)]

  const addSnippet = async (): Promise<void> => {
    const label = snipLabel.trim()
    if (!label || !snipBody.trim()) return
    const next = [...snips.filter((s) => !(s.lang === snipLang && s.label === label)), { lang: snipLang, label, body: snipBody }]
    setSnips(next)
    await saveSnippets(next)
    setSnipLabel('')
    setSnipBody('')
    notify(`Extrait « ${label} » enregistré ✂️`)
  }

  const exportSnippets = (): void => {
    const blob = new Blob([JSON.stringify(snips, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'skouar-extraits.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  const importSnippets = async (file: File): Promise<void> => {
    try {
      const arr = JSON.parse(await file.text()) as KodSnippet[]
      if (!Array.isArray(arr)) throw new Error('bad')
      const next = [...snips]
      for (const s of arr) {
        if (s && typeof s.lang === 'string' && typeof s.label === 'string' && typeof s.body === 'string') {
          const i = next.findIndex((x) => x.lang === s.lang && x.label === s.label)
          if (i >= 0) next[i] = s
          else next.push(s)
        }
      }
      setSnips(next)
      await saveSnippets(next)
      notify(`${arr.length} extrait(s) importé(s) ✂️`)
    } catch {
      notify('Fichier d’extraits invalide')
    }
  }

  useDismiss('kfind', findOpen, () => setFindOpen(false))
  useDismiss('kpal', palOpen, () => { setPalOpen(false); setPalArg(null) })
  useDismiss('kout', outlineOpen, () => setOutlineOpen(false))
  useDismiss('khist', histOpen, () => setHistOpen(false))
  useDismiss('kprob', probsOpen, () => setProbsOpen(false))
  useDismiss('kfp', fpOpen, () => setFpOpen(false))
  useDismiss('knew', newTabOpen, () => setNewTabOpen(false))
  useDismiss('ktpl', tplOpen, () => setTplOpen(false))
  useDismiss('kglob', gOpen, () => setGOpen(false))
  useDismiss('ktmenu', !!tabMenu, () => setTabMenu(null))
  useDismiss('kdiff', !!diffV, () => setDiffV(null))
  useDismiss('kproj', projOpen, () => setProjOpen(false))
  useDismiss('kgit', gitOpen, () => setGitOpen(false))
  useDismiss('ksnip', snipOpen, () => setSnipOpen(false))

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
        const text = isImageName(e.name) ? await fileToDataURL(f) : await f.text()
        setBuffers((prev) => ({ ...prev, [key]: { content: text, dirty: false, real: e.handle } }))
      } catch {
        notify('Fichier illisible')
        return
      }
    }
    setUi({ ...ui, tabs: ui.tabs.includes(key) ? ui.tabs : [...ui.tabs, key], active: key })
    setTimeout(() => taRef.current?.focus(), 30)
  }

  const orderedTabs = (): string[] => {
    if (!ui) return []
    return [...ui.pinned.filter((p) => ui.tabs.includes(p)), ...ui.tabs.filter((t) => !ui.pinned.includes(t))]
  }

  const closeTab = (id: string): void => {
    if (!ui) return
    const tabs = ui.tabs.filter((t) => t !== id)
    const active = ui.active === id ? (tabs[tabs.length - 1] ?? null) : ui.active
    const closed = [id, ...ui.closed.filter((c) => c !== id)].slice(0, 20)
    const pinned = ui.pinned.filter((p) => p !== id)
    if (splitId === id) setSplitId(null)
    setUi({ ...ui, tabs, active, closed, pinned })
  }

  const reopenClosedTab = (): void => {
    if (!ui || !ui.closed.length) return
    const id = ui.closed[0]
    setUi({ ...ui, tabs: ui.tabs.includes(id) ? ui.tabs : [...ui.tabs, id], active: id, closed: ui.closed.slice(1) })
    setTimeout(() => taRef.current?.focus(), 30)
  }

  const togglePin = (id: string): void => {
    if (!ui) return
    const pinned = ui.pinned.includes(id) ? ui.pinned.filter((p) => p !== id) : [...ui.pinned, id]
    setUi({ ...ui, pinned })
  }

  const closeOthers = (id: string): void => {
    if (!ui) return
    const tabs = [id, ...ui.pinned.filter((p) => p !== id && ui.tabs.includes(p))]
    const removed = ui.tabs.filter((t) => !tabs.includes(t))
    setUi({ ...ui, tabs, active: id, closed: [...removed, ...ui.closed].slice(0, 20) })
  }

  const closeRight = (id: string): void => {
    if (!ui) return
    const ordered = orderedTabs()
    const idx = ordered.indexOf(id)
    const removed = ordered.slice(idx + 1).filter((t) => !ui.pinned.includes(t))
    const tabs = ui.tabs.filter((t) => !removed.includes(t))
    const active = ui.active && removed.includes(ui.active) ? id : ui.active
    setUi({ ...ui, tabs, active, closed: [...removed, ...ui.closed].slice(0, 20) })
  }

  const sessOf = (u: KodUI): Partial<KodUI> => ({ tabs: u.tabs, active: u.active, expanded: u.expanded, pinned: u.pinned, closed: u.closed })

  const switchProject = async (id: string): Promise<void> => {
    setProjOpen(false)
    if (!ui || id === pid) return
    await saveKV('sess:' + pid, sessOf(ui))
    await saveKV('branch:' + pid, curBranch)
    const ns = await loadNodes(id)
    const sess = await loadKV<Partial<KodUI>>('sess:' + id)
    const b: Record<string, Buffer> = {}
    for (const n of ns) if (n.kind === 'file') b[n.id] = { content: n.content ?? '', dirty: false }
    setNodes(ns)
    setBuffers(b)
    setUi((prev) => (prev ? { ...prev, tabs: sess?.tabs ?? [], active: sess?.active ?? null, expanded: sess?.expanded ?? [], pinned: sess?.pinned ?? [], closed: sess?.closed ?? [] } : prev))
    setPid(id)
    setCurBranch((await loadKV<string>('branch:' + id)) ?? 'main')
    setFolds([])
    setMulti([])
    setRect(null)
    setBms([])
    setSplitId(null)
    notify(`Projet « ${projects.find((p) => p.id === id)?.name ?? id} »`)
  }

  const createProject = async (): Promise<void> => {
    const name = newProjName.trim()
    if (!name) return
    const p: KodProject = { id: uid(), name, createdAt: Date.now() }
    await putProject(p)
    setProjects((prev) => [...prev, p])
    setNewProjName('')
    await switchProject(p.id)
  }

  const commitRenameProj = async (): Promise<void> => {
    if (!renProj) return
    const name = renProjVal.trim()
    const id = renProj
    setRenProj(null)
    if (!name) return
    const p = projects.find((x) => x.id === id)
    if (!p) return
    await putProject({ ...p, name })
    setProjects((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)))
  }

  const removeProject = async (id: string): Promise<void> => {
    if (projects.length <= 1) return
    const p = projects.find((x) => x.id === id)
    await deleteProject(id)
    const rest = (await loadProjects()).filter((x) => x.id !== id)
    setProjects(rest)
    if (id === pid && rest.length) await switchProject(rest[0].id)
    notify(`Projet « ${p?.name ?? id} » supprimé`)
  }

  const saveActive = async (id?: string): Promise<void> => {
    const aid = id ?? active
    if (!ui || !aid) return
    const b = buffers[aid]
    if (!b) return
    if (aid.startsWith('real:')) {
      if (!b.real) return
      try {
        const w = await b.real.createWritable()
        await w.write(b.content)
        await w.close()
        const e = flattenReal(realTreeRef.current).find((x) => x.handle === b.real)
        if (e) mtimesRef.current[e.path] = Date.now()
        setBuffers((prev) => ({ ...prev, [aid]: { ...prev[aid], dirty: false } }))
        if (aid === ui.active) setSavedAt(Date.now())
        notify('Enregistré sur le disque 💾')
      } catch {
        notify('Écriture impossible (permission refusée ?)')
      }
      return
    }
    const n = nodes?.find((x) => x.id === aid)
    if (!n) return
    await putNode({ ...n, content: b.content, updatedAt: Date.now() })
    await pushVersion(aid, b.content)
    setNodes((prev) => prev?.map((x) => (x.id === aid ? { ...x, content: b.content, updatedAt: Date.now() } : x)) ?? prev)
    setBuffers((prev) => ({ ...prev, [aid]: { ...prev[aid], dirty: false } }))
    if (aid === ui.active) setSavedAt(Date.now())
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
      projectId: pid,
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
      const tree = await scanDir(h, '')
      setRealTree(tree)
      const mt: Record<string, number> = {}
      for (const e of flattenReal(tree)) if (e.mtime) mt[e.path] = e.mtime
      mtimesRef.current = mt
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
    if (!findQ || !content) return [] as { i: number; len: number }[]
    const out: { i: number; len: number }[] = []
    try {
      if (findRe) {
        const re = new RegExp(findQ, 'gi')
        let m: RegExpExecArray | null
        while ((m = re.exec(content)) && out.length < 500) {
          out.push({ i: m.index, len: Math.max(1, m[0].length) })
          if (m[0].length === 0) re.lastIndex++
        }
      } else {
        let i = content.indexOf(findQ)
        while (i >= 0 && out.length < 500) {
          out.push({ i, len: findQ.length })
          i = content.indexOf(findQ, i + findQ.length)
        }
      }
    } catch { /* regex invalide */ }
    return out
  }, [findQ, content, findRe])

  const goMatch = (dir: 1 | -1): void => {
    if (!matches.length || !taRef.current) return
    const next = (findIdx + dir + matches.length) % matches.length
    setFindIdx(next)
    const pos = matches[next].i
    const len = matches[next].len
    const ta = taRef.current
    ta.focus()
    ta.setSelectionRange(pos, pos + len)
    const line = ta.value.slice(0, pos).split('\n').length
    ta.scrollTop = Math.max(0, (line - 1) * 20 - ta.clientHeight / 2)
    syncScroll()
    updateLineCol()
  }

  useEffect(() => {
    if (!findOpen) return
    setFindIdx(0)
  }, [findOpen, findQ])

  const runGlobalSearch = async (reFlag?: boolean): Promise<void> => {
    const q = gQ.trim()
    if (q.length < 2) {
      setGResults([])
      return
    }
    const useRe = reFlag ?? gRe
    let re: RegExp | null = null
    if (useRe) {
      try {
        re = new RegExp(q, 'gi')
      } catch {
        setGResults([])
        setGBusy(false)
        return
      }
    }
    setGBusy(true)
    const res: GResult[] = []
    const lower = q.toLowerCase()
    const lineHit = (t: string): boolean => {
      if (re) {
        re.lastIndex = 0
        return re.test(t)
      }
      return t.toLowerCase().includes(lower)
    }
    for (const n of nodesRef.current) {
      if (n.kind !== 'file' || n.content == null) continue
      const lines = n.content.split('\n')
      lines.forEach((text, i) => {
        if (lineHit(text) && res.length < 200) {
          res.push({ key: n.id, name: n.name, path: n.name, line: i + 1, text: text.trim().slice(0, 120) })
        }
      })
    }
    for (const e of flattenReal(realTree)) {
      if (!e.handle || isImageName(e.name)) continue
      try {
        const f = await e.handle.getFile()
        if (f.size > 300_000) continue
        const text = await f.text()
        text.split('\n').forEach((line, i) => {
          if (lineHit(line) && res.length < 200) {
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

  const replForMatch = (m: RegExpExecArray): string =>
    replQ.replace(/\$(\d+)/g, (s, d) => m[Number(d)] ?? s).replace(/\$&/g, m[0])

  const replaceCurrent = (): void => {
    if (!active || !findQ) return
    const b = buffers[active]
    if (!b) return
    const hit = matches[findIdx] ?? matches[0]
    if (!hit) return
    let rep = replQ
    let mlen = findQ.length
    if (findRe) {
      try {
        const re = new RegExp(findQ, 'g')
        let m: RegExpExecArray | null
        while ((m = re.exec(b.content))) {
          if (m.index === hit.i) {
            rep = replForMatch(m)
            mlen = m[0].length
            break
          }
          if (m[0].length === 0) re.lastIndex++
        }
      } catch {
        return
      }
    }
    const nv = b.content.slice(0, hit.i) + rep + b.content.slice(hit.i + mlen)
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      ta.setSelectionRange(hit.i + rep.length, hit.i + rep.length)
      syncScroll()
      updateLineCol()
    }
  }

  const replaceAllFile = (): void => {
    if (!active || !findQ) return
    const b = buffers[active]
    if (!b) return
    const n = matches.length
    if (!n) return
    let nv: string
    if (findRe) {
      try {
        nv = b.content.replace(new RegExp(findQ, 'g'), replQ)
      } catch {
        notify('Regex invalide')
        return
      }
    } else {
      nv = b.content.split(findQ).join(replQ)
    }
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
      if (text == null) continue
      let nv: string
      let c = 0
      if (gRe) {
        let re: RegExp
        try {
          re = new RegExp(q, 'g')
        } catch {
          continue
        }
        c = (text.match(re) ?? []).length
        if (!c) continue
        nv = text.replace(re, gReplQ)
      } else {
        if (!text.includes(q)) continue
        c = text.split(q).length - 1
        nv = text.split(q).join(gReplQ)
      }
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

  const rectApply = (key: string): void => {
    if (!rect || !active) return
    const b = buffers[active]
    if (!b) return
    const arr = b.content.split('\n')
    const l0 = Math.min(rect.aLine, rect.line)
    const l1 = Math.max(rect.aLine, rect.line)
    const c0 = Math.min(rect.aCol, rect.col)
    const c1 = Math.max(rect.aCol, rect.col)
    for (let i = l0; i <= l1 && i < arr.length; i++) {
      let l = arr[i]
      if (l.length < c0) l = l + ' '.repeat(c0 - l.length)
      if (key === 'Backspace') {
        if (c0 === c1) {
          if (c0 > 0) arr[i] = l.slice(0, c0 - 1) + l.slice(c0)
        } else arr[i] = l.slice(0, c0) + l.slice(Math.min(c1, l.length))
      } else if (key === 'Delete') {
        if (c0 === c1) arr[i] = l.slice(0, c0) + l.slice(c0 + 1)
        else arr[i] = l.slice(0, c0) + l.slice(Math.min(c1, l.length))
      } else {
        arr[i] = l.slice(0, c0) + key + l.slice(Math.min(c1, l.length))
      }
    }
    const nv = arr.join('\n')
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      const nl = nv.split('\n')
      const off = nl.slice(0, l1).reduce((a, l) => a + l.length + 1, 0) + Math.min(c1, nl[l1]?.length ?? 0)
      ta.setSelectionRange(off, off)
      ta.focus()
      syncScroll()
      updateLineCol()
    }
  }

  const rectExtend = (key: string): void => {
    setRect((r) => {
      if (!r) return r
      const nr = { ...r }
      if (key === 'ArrowUp') nr.line = Math.max(0, nr.line - 1)
      if (key === 'ArrowDown') nr.line = nr.line + 1
      if (key === 'ArrowLeft') nr.col = Math.max(0, nr.col - 1)
      if (key === 'ArrowRight') nr.col = nr.col + 1
      return nr
    })
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
    { id: 'find', label: '🔍 Rechercher dans le fichier', run: () => { setPalOpen(false); setFindOpen(true) } },
    { id: 'gfind', label: '🔎 Rechercher dans tout le projet', run: () => { setPalOpen(false); setGOpen(true) } },
    { id: 'repl', label: '\u21C4 Remplacer dans le fichier', run: () => { setPalOpen(false); setFindOpen(true); setReplOpen(true) } },
    { id: 'save', label: '💾 Enregistrer (Ctrl+S)', run: () => { setPalOpen(false); void saveActive() } },
    { id: 'preview', label: `👁 ${preview ? 'Cacher' : 'Afficher'} l\u2019aper\u00e7u`, run: () => setPreview((x) => !x) },
    { id: 'mini', label: `🗺 ${mini ? 'Cacher' : 'Afficher'} la minimap`, run: () => setMini((x) => !x) },
    { id: 'outline', label: `\u2630 ${outlineOpen ? 'Cacher' : 'Afficher'} le plan`, run: () => { setOutlineOpen((o) => !o); setPalOpen(false) } },
    { id: 'hist', label: '🕘 Historique des versions', run: () => void openHist() },
    { id: 'goto', label: '\u2C7C Aller \u00e0 la ligne\u2026', arg: true, run: () => {} },
    { id: 'fp', label: '📄 Aller au fichier\u2026 (Ctrl+P)', run: () => { setPalOpen(false); setFpOpen(true); setFpQ('') } },
    { id: 'probs', label: `\u26A0\uFE0F Probl\u00e8mes (${probs.length})`, run: () => { setProbsOpen(true); setPalOpen(false) } },
    { id: 'focus', label: `🧘 ${focus ? 'Quitter' : 'Activer'} le mode focus`, run: () => setFocus((z) => !z) },
    { id: 'foldall', label: '⤓ Replier tous les blocs', run: () => { setPalOpen(false); foldAll() } },
    { id: 'unfoldall', label: '⤒ Déplier tous les blocs', run: () => { setPalOpen(false); unfoldAll() } },
    { id: 'reopen', label: '↩ Rouvrir l’onglet fermé', run: () => { setPalOpen(false); reopenClosedTab() } },
    { id: 'splitclose', label: '↔ Fermer le volet droit', run: () => { setPalOpen(false); setSplitId(null) } },
    { id: 'gotodef', label: '⤴ Aller à la définition (Ctrl+F12 / Ctrl+clic)', run: () => { setPalOpen(false); doGoToDef() } },
    { id: 'git', label: '🌿 Git local (commits, branches)', run: () => { setPalOpen(false); void openGit() } },
    { id: 'snips', label: '✂️ Gérer mes extraits', run: () => { setPalOpen(false); setSnipOpen(true) } },
    { id: 'zip', label: '📦 Exporter le projet en ZIP', run: () => { setPalOpen(false); void exportZip() } },
    ...HL_THEMES.map((t) => ({ id: 'hl:' + t.id, label: `🎨 Th\u00e8me de coloration : ${t.label}`, run: () => setUi((p) => (p ? { ...p, hlTheme: t.id } : p)) })),
    ...mergedSnippets(lang).map((s) => ({ id: 'snip:' + s.label, label: `\u2702\uFE0F Extrait : ${s.label}`, run: () => { setPalOpen(false); insertText(s.body) } }))
  ]


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

  const applyContent = (nv: string): void => {
    if (!active) return
    setBuf(active, nv)
    const ta = taRef.current
    if (ta) {
      ta.value = nv
      syncScroll()
      updateLineCol()
    }
  }

  const foldAll = (): void => {
    const arr = content.split('\n')
    const next: { start: number; saved: string[] }[] = []
    for (const start of [...foldable].sort((a, b) => b - a)) {
      if (foldedStarts.has(start)) continue
      const end = foldEnd(arr, start)
      if (end <= start + 1) continue
      next.push({ start, saved: arr.slice(start, end + 1) })
    }
    if (!next.length) return
    let nv = arr.join('\n')
    for (const f of next) {
      const lines = nv.split('\n')
      const ph = (lines[f.start]?.match(/^\s*/)?.[0] ?? '') + '⋯ ' + (f.saved.length - 1) + ' lignes'
      lines.splice(f.start + 1, f.saved.length - 1, ph)
      nv = lines.join('\n')
    }
    setFolds(next)
    applyContent(nv)
    notify(`${next.length} bloc(s) replié(s)`)
  }

  const unfoldAll = (): void => {
    if (!folds.length) return
    const arr = content.split('\n')
    for (const f of [...folds].sort((a, b) => b.start - a.start)) {
      arr.splice(f.start + 1, 1, ...f.saved.slice(1))
    }
    setFolds([])
    applyContent(arr.join('\n'))
  }

  const probsStatic = useMemo(() => {
    const out: { line: number; label: string }[] = []
    content.split('\n').forEach((l, i) => {
      const t = l.match(/\b(TODO|FIXME|HACK|XXX)\b/)
      if (t) out.push({ line: i + 1, label: `${t[1]} : ${l.trim().slice(0, 60)}` })
      if (l.length > 120) out.push({ line: i + 1, label: `ligne longue (${l.length} car.)` })
      if (/[ \t]$/.test(l)) out.push({ line: i + 1, label: 'espace en fin de ligne' })
    })
    return out
  }, [content])

  const probs = useMemo(
    () => [...probsStatic, ...synIssues.map((s) => ({ line: s.line, label: `⛔ ${s.msg}${s.col > 1 ? ` (col ${s.col})` : ''}` }))],
    [probsStatic, synIssues]
  )

  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      void syntaxIssues(content, lang).then((r) => {
        if (alive) setSynIssues(r)
      })
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [content, lang])

  useEffect(() => {
    try {
      setBms(JSON.parse(localStorage.getItem(`skouar:kod:bm:${active}`) ?? '[]'))
    } catch {
      setBms([])
    }
  }, [active])

  const toggleBm = (line: number): void => {
    if (!active) return
    setBms((prev) => {
      const next = prev.includes(line) ? prev.filter((x) => x !== line) : [...prev, line].sort((a, b) => a - b)
      localStorage.setItem(`skouar:kod:bm:${active}`, JSON.stringify(next))
      return next
    })
  }

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
      const content = isImageName(name) ? await fileToDataURL(f) : await f.text()
      const node: KodNode = { id: uid(), parentId: null, projectId: pid, name, kind: 'file', content, updatedAt: Date.now() }
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

  const filteredPal = paletteCmds().filter((c) => c.label.toLowerCase().includes(palQ.toLowerCase()))

  const diffRows = useMemo<DiffRow[]>(() => (diffV ? diffLines(diffV.content, buffers[diffV.fileId ?? '']?.content ?? content) : []), [diffV, buffers, content])

  const nodePath = (n: KodNode): string => {
    const parts: string[] = [n.name]
    let cur: KodNode | undefined = n
    while (cur.parentId) {
      const p = nodesRef.current.find((x) => x.id === cur?.parentId)
      if (!p) break
      parts.unshift(p.name)
      cur = p
    }
    return parts.join('/')
  }

  const defFiles = useMemo<DefFile[]>(() => {
    const out: DefFile[] = []
    for (const n of nodes ?? []) {
      if (n.kind !== 'file') continue
      out.push({ key: n.id, path: nodePath(n), content: buffers[n.id]?.content ?? n.content ?? '' })
    }
    for (const e of flattenReal(realTree)) {
      if (e.kind === 'file') out.push({ key: e.key, path: e.path, content: buffers[e.key]?.content ?? '' })
    }
    return out
  }, [nodes, realTree, buffers])

  const defIndex = useMemo(() => {
    const langs: Record<string, string> = {}
    for (const f of defFiles) langs[f.key] = langOf(f.path.split('/').pop() ?? f.path)
    return buildIndex(defFiles, langs)
  }, [defFiles])

  const doGoToDef = (): void => {
    const ta = taRef.current
    if (!ta || !active) return
    const off = ta.selectionStart
    const v = ta.value
    const spec = importSpecAtOffset(v, off)
    if (spec && spec.startsWith('.')) {
      const fromPath = active.startsWith('real:')
        ? flattenReal(realTree).find((x) => x.key === active)?.path ?? activeName
        : nodePath(nodesRef.current.find((n) => n.id === active) ?? { id: '', parentId: null, name: activeName, kind: 'file', updatedAt: 0 })
      const target = resolveImport(spec, fromPath, defFiles)
      if (target) {
        openFileByKey(target.key)
        setTimeout(() => jumpLine(1), 150)
        notify(`→ ${target.path}`)
        return
      }
    }
    const { w } = wordAtOffset(v, off)
    if (!w) return
    const hit = findDef(defIndex, w, active)
    if (!hit) {
      notify(`Aucune définition trouvée pour « ${w} »`)
      return
    }
    openFileByKey(hit.key)
    setTimeout(() => jumpLine(hit.line), 150)
    notify(`→ ${w} (L${hit.line})`)
  }


  const createQuickFile = async (ext: string): Promise<void> => {
    if (!ui) return
    let name = `sans-titre.${ext}`
    let k = 1
    while (nodesRef.current.some((n) => n.parentId === null && n.name === name)) {
      name = `sans-titre-${k}.${ext}`
      k++
    }
    const node: KodNode = { id: uid(), parentId: null, projectId: pid, name, kind: 'file', content: '', updatedAt: Date.now() }
    await putNode(node)
    setNodes((prev) => [...(prev ?? []), node])
    setBuffers((prev) => ({ ...prev, [node.id]: { content: '', dirty: false } }))
    setUi({ ...ui, tabs: [...ui.tabs, node.id], active: node.id })
    setNewTabOpen(false)
    setTimeout(() => taRef.current?.focus(), 60)
  }

  const createFromTemplate = async (t: (typeof KOD_TEMPLATES)[number]): Promise<void> => {
    if (!ui) return
    const parts = t.path.split('/')
    let parentId: string | null = null
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      let dir = nodesRef.current.find((n) => n.parentId === parentId && n.kind === 'dir' && n.name === dirName)
      if (!dir) {
        const dn: KodNode = { id: uid(), parentId, projectId: pid, name: dirName, kind: 'dir', updatedAt: Date.now() }
        await putNode(dn)
        setNodes((prev) => [...(prev ?? []), dn])
        dir = dn
      }
      parentId = dir.id
    }
    let name = parts[parts.length - 1]
    const base = name
    let k = 1
    while (nodesRef.current.some((n) => n.parentId === parentId && n.name === name)) {
      name = base.replace(/(\.[^.]+)?$/, ` (${k})$1`)
      k++
    }
    const content = t.content.replaceAll('{{titre}}', t.label)
    const node: KodNode = { id: uid(), parentId, projectId: pid, name, kind: 'file', content, updatedAt: Date.now() }
    await putNode(node)
    setNodes((prev) => [...(prev ?? []), node])
    setBuffers((prev) => ({ ...prev, [node.id]: { content, dirty: false } }))
    setUi({ ...ui, tabs: [...ui.tabs, node.id], active: node.id, expanded: parentId ? [...new Set([...ui.expanded, parentId])] : ui.expanded })
    setTplOpen(false)
    notify(`Mod\u00e8le \u00ab ${t.label} \u00bb cr\u00e9\u00e9 \ud83d\udccb`)
    setTimeout(() => taRef.current?.focus(), 60)
  }

  const onTaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!active || !ui) return
    if (rect && e.altKey && e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault()
      rectExtend(e.key)
      return
    }
    if (rect && (e.key === 'Backspace' || e.key === 'Delete' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey))) {
      e.preventDefault()
      rectApply(e.key)
      return
    }
    if (multi.length > 0 && (e.key === 'Backspace' || e.key === 'Delete' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey))) {
      e.preventDefault()
      applyMultiEdit(e.key)
      return
    }
    if (comboOf(e) === km('comment')) {
      e.preventDefault()
      toggleComment()
      return
    }
    if (comboOf(e) === km('dupLine')) {
      e.preventDefault()
      duplicateSel()
      return
    }
    if (comboOf(e) === km('moveUp')) {
      e.preventDefault()
      moveLines(-1)
      return
    }
    if (comboOf(e) === km('moveDown')) {
      e.preventDefault()
      moveLines(1)
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
      if (!e.shiftKey) {
        const lineStart = val.lastIndexOf('\n', sel - 1) + 1
        const prefix = val.slice(lineStart, sel)
        const stripped = prefix.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '')
        if (['html', 'css', 'vue', 'svelte', 'xml'].includes(lang) && prefix.trim() && !/\s/.test(stripped)) {
          const exp = expandEmmet(prefix, lang)
          if (exp) {
            const lineEnd = val.indexOf('\n', sel)
            const le = lineEnd < 0 ? val.length : lineEnd
            const indent = val.slice(lineStart).match(/^\s*/)?.[0] ?? ''
            const body = exp.split('\n').map((l, i) => (i === 0 ? l : indent + l)).join('\n')
            const ci = body.indexOf('\u0001')
            const clean = ci >= 0 ? body.replace('\u0001', '') : body
            const nv = val.slice(0, lineStart) + clean + val.slice(le)
            setBuf(active, nv)
            ta.value = nv
            const pos = lineStart + (ci >= 0 ? ci : clean.length)
            ta.setSelectionRange(pos, pos)
            syncScroll()
            updateLineCol()
            return
          }
        }
      }
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
      const c = comboOf(e)
      if (c === km('save')) {
        e.preventDefault()
        void saveActive()
      } else if (c === km('gfind')) {
        e.preventDefault()
        setGOpen(true)
      } else if (c === km('replace')) {
        e.preventDefault()
        setFindOpen(true)
        setReplOpen(true)
      } else if (c === km('find')) {
        e.preventDefault()
        setFindOpen(true)
      } else if (c === km('quickopen')) {
        e.preventDefault()
        setFpOpen(true)
        setFpQ('')
      } else if (c === km('dupOcc')) {
        e.preventDefault()
        addNextOccurrence()
      } else if (c === km('selAllOcc')) {
        e.preventDefault()
        selectAllOccurrences()
      } else if (c === km('palette')) {
        e.preventDefault()
        setPalOpen(true)
        setPalQ('')
        setPalArg(null)
      } else if (c === km('goto')) {
        e.preventDefault()
        setPalOpen(true)
        setPalArg('goto')
        setPalVal('')
      } else if (c === km('reopenTab')) {
        e.preventDefault()
        reopenClosedTab()
      } else if (c === km('gotoDef')) {
        e.preventDefault()
        doGoToDef()
      } else if (e.key === 'Escape') {
        setFindOpen(false)
        setGOpen(false)
        setPalOpen(false)
        setOutlineOpen(false)
        setHistOpen(false)
        setMulti([])
        setRect(null)
        setTabMenu(null)
        setDiffV(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, buffers, nodes, ui, multi, keymap])

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
      className={`blocs-app kod-app hl-${ui.hlTheme}${focus ? ' focus' : ''}`}
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
        <div className="kod-projbar">
          <button className="db-btn" title="Changer de projet (multi-projets)" onClick={() => setProjOpen((o) => !o)}>
            🗂 {projects.find((p) => p.id === pid)?.name ?? '…'} ▾
          </button>
        </div>
        {projOpen && (
          <div className="kod-panel kod-proj" data-pop="kproj">
            <div className="kod-panel-head">🗂 Projets</div>
            {projects.map((p) => (
              <div key={p.id} className={`kod-proj-row${p.id === pid ? ' active' : ''}`}>
                {renProj === p.id ? (
                  <input
                    className="kod-rename"
                    autoFocus
                    value={renProjVal}
                    onChange={(e) => setRenProjVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void commitRenameProj() }}
                    onBlur={() => void commitRenameProj()}
                  />
                ) : (
                  <button className="kod-panel-item kod-proj-go" onClick={() => void switchProject(p.id)}>
                    {p.id === pid ? '● ' : ''}{p.name}
                  </button>
                )}
                <button className="db-btn" title="Renommer le projet" onClick={() => { setRenProj(p.id); setRenProjVal(p.name) }}>
                  ✎
                </button>
                {projects.length > 1 && (
                  <button className="db-btn" title="Supprimer ce projet (fichiers + commits)" onClick={() => void removeProject(p.id)}>
                    🗑
                  </button>
                )}
              </div>
            ))}
            <div className="kod-git-actions">
              <input placeholder="Nouveau projet…" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createProject() }} />
              <button className="db-btn" onClick={() => void createProject()}>
                ＋
              </button>
            </div>
          </div>
        )}
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
          <button className="db-btn" title="Exporter tout le projet en ZIP" onClick={() => void exportZip()}>
            📦 Export ZIP
          </button>
          <button className="db-btn" title="Importer un projet depuis un fichier ZIP" onClick={() => zipInputRef.current?.click()}>
            ⇧ Import ZIP
          </button>
        </div>
        <div className="kod-side-actions">
          <button className="db-btn" onClick={() => void openDirPicker()} title="Ouvrir un dossier réel du disque (File System Access)">
            🗂 Ouvrir un dossier…
          </button>
          <button className="db-btn" onClick={() => void openFilePicker()} title="Ouvrir un fichier réel du disque">
            📂 Ouvrir un fichier…
          </button>
          <button className="db-btn" aria-label="Modèles de fichiers" title="Créer un fichier depuis un modèle (langages, projet, docs)" onClick={() => setTplOpen((o) => !o)}>
            📋 Modèles
          </button>
          <button className="db-btn" aria-label="Git local" title="Mini-git 100 % local : commits, branches, diff, restauration" onClick={() => void openGit()}>
            🌿 Git local
          </button>
          <button className="db-btn" aria-label="Mes extraits" title="Gérer mes extraits (snippets) personnels + partage JSON" onClick={() => setSnipOpen((o) => !o)}>
            ✂️ Extraits
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
              <div className="kod-tree-head" title="Dossier réel du disque">
                🗂 {dirHandle.name} (disque)
                <button className="db-btn kod-rescan" title="Actualiser depuis le disque" onClick={() => void rescanDisk()}>
                  ⟳
                </button>
              </div>
              {extChanged.length > 0 && (
                <div className="kod-extwarn">
                  <span>⚠ {extChanged.length} modifié(s) sur le disque</span>
                  <button className="db-btn" onClick={() => void reloadDisk()}>Recharger</button>
                </div>
              )}
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
            <div className="kod-gcount">
              <button className={`db-btn${gRe ? ' active' : ''}`} title="Expression régulière (.*)" aria-label="Recherche regex" onClick={() => { setGRe((v) => !v); void runGlobalSearch(!gRe) }}>
                .*
              </button>
              {gBusy ? '…' : `${gResults.length} résultat(s)`}
            </div>
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
        {tplOpen && (
          <div className="kod-tpl" data-pop="ktpl">
            {templateGroups().map((g) => (
              <div key={g}>
                <div className="kod-tree-head">{g}</div>
                {KOD_TEMPLATES.filter((t) => t.group === g).map((t) => (
                  <button key={t.label} className="kod-tpl-item" onClick={() => void createFromTemplate(t)}>
                    <span>{t.icon}</span>
                    <span className="kod-tpl-label">{t.label}</span>
                    <span className="kod-tpl-path">{t.path}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {gitOpen && (
          <div className="kod-gsearch kod-git" data-pop="kgit">
            <div className="kod-panel-head">🌿 Git local — {projects.find((p) => p.id === pid)?.name}</div>
            <div className="kod-git-actions">
              <input placeholder="Message du commit…" value={gitMsg} onChange={(e) => setGitMsg(e.target.value)} />
              <button className="db-btn" onClick={() => void commitCurrent()}>Commit fichier</button>
              <button className="db-btn" onClick={() => void commitProject()}>Commit projet</button>
            </div>
            <div className="kod-git-actions">
              <input placeholder="Nouvelle branche…" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
              <button className="db-btn" onClick={() => void createBranch()}>Créer</button>
              <span className="kod-git-branch">🌿 {curBranch}</span>
            </div>
            {branches.length > 0 && (
              <div className="kod-git-branches">
                {branches.map((b) => (
                  <button
                    key={b.name}
                    className={`kod-gres${b.name === curBranch ? ' active' : ''}`}
                    onClick={async () => {
                      await saveKV('branch:' + pid, b.name)
                      setCurBranch(b.name)
                    }}
                  >
                    🌿 {b.name}
                  </button>
                ))}
              </div>
            )}
            <div className="kod-gresults">
              {commits.map((c) => (
                <div key={c.id} className="kod-commit">
                  <div className="kod-commit-head">
                    <strong>{c.message}</strong>
                    {c.branch && <span className="kod-commit-branch">🌿 {c.branch}</span>}
                    <span className="kod-commit-meta">
                      {c.scope === 'project' ? `projet (${Object.keys(c.files).length} f.)` : c.fileName} · {new Date(c.at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="kod-commit-actions">
                    <button className="db-btn" onClick={() => diffCommit(c)}>Comparer</button>
                    <button className="db-btn" onClick={() => void restoreCommit(c)}>Restaurer</button>
                    <button
                      className="db-btn"
                      onClick={async () => {
                        await deleteCommit(c.id)
                        setCommits(await listCommits(pid))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {commits.length === 0 && <div className="kod-pal-empty">Aucun commit local — tout reste dans le navigateur, aucun serveur</div>}
            </div>
          </div>
        )}
        {snipOpen && (
          <div className="kod-gsearch kod-snip" data-pop="ksnip">
            <div className="kod-panel-head">✂️ Mes extraits ({snips.length})</div>
            <div className="kod-git-actions">
              <select value={snipLang} onChange={(e) => setSnipLang(e.target.value)}>
                {['javascript', 'typescript', 'html', 'css', 'markdown', 'python'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <input placeholder="Libellé" value={snipLabel} onChange={(e) => setSnipLabel(e.target.value)} />
            </div>
            <textarea className="kod-snip-body" rows={4} placeholder="Corps de l'extrait ($0 = position du curseur)" value={snipBody} onChange={(e) => setSnipBody(e.target.value)} />
            <div className="kod-git-actions">
              <button className="db-btn" onClick={() => void addSnippet()}>Ajouter</button>
              <button className="db-btn" onClick={exportSnippets}>⇩ Exporter JSON</button>
              <button className="db-btn" onClick={() => snipInputRef.current?.click()}>⇧ Importer JSON</button>
            </div>
            <div className="kod-gresults">
              {snips.map((s, i) => (
                <div key={i} className="kod-commit">
                  <div className="kod-commit-head">
                    <strong>{s.label}</strong>
                    <span className="kod-commit-meta">{s.lang}</span>
                  </div>
                  <div className="kod-commit-actions">
                    <button className="db-btn" onClick={() => insertText(s.body)}>Insérer</button>
                    <button
                      className="db-btn"
                      onClick={async () => {
                        const next = snips.filter((_, j) => j !== i)
                        setSnips(next)
                        await saveSnippets(next)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {snips.length === 0 && <div className="kod-pal-empty">Aucun extrait perso — exporte/importe en JSON pour les partager</div>}
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importZip(f)
          }}
        />
        <input
          ref={snipInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importSnippets(f)
          }}
        />
        <div className="blocs-sidebar-foot">
          <ThemeButton />
          <SettingsButton appId="kod" appName="Kod" />
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
          {orderedTabs().map((id) => {
            const n = nodes.find((x) => x.id === id)
            const r = id.startsWith('real:') ? flattenReal(realTree).find((x) => x.key === id) : undefined
            const name = n?.name ?? r?.name ?? id
            const pinned = ui.pinned.includes(id)
            return (
              <div
                key={id}
                className={`kod-tab${active === id ? ' active' : ''}${pinned ? ' pinned' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/kod-tab', id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragTab(id)
                }}
                onDragEnd={() => {
                  setDragTab(null)
                  setDropZone(false)
                }}
                onClick={() => setUi({ ...ui, active: id })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setTabMenu({ id, x: e.clientX, y: e.clientY })
                }}
                title="Clic : ouvrir · clic droit : menu · glisser à droite : volet split"
              >
                {pinned && <span className="kod-tab-pin">📌</span>}
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
          <button className="kod-tab-add" aria-label="Nouveau fichier (nouvel onglet)" title="Nouveau fichier +" onClick={() => setNewTabOpen((o) => !o)}>
            +
          </button>
          {newTabOpen && (
            <div className="kod-panel kod-newtab" data-pop="knew">
              <div className="kod-panel-head">+ Nouveau fichier</div>
              {["md", "js", "ts", "html", "css", "py", "json", "yml", "sh", "sql", "txt"].map((ext) => (
                <button key={ext} className="kod-panel-item" onClick={() => void createQuickFile(ext)}>
                  📄 sans-titre.{ext}
                </button>
              ))}
            </div>
          )}
          {tabMenu && (
            <div className="kod-tabmenu" data-pop="ktmenu" style={{ left: tabMenu.x, top: tabMenu.y }}>
              <button className="kod-panel-item" onClick={() => { togglePin(tabMenu.id); setTabMenu(null) }}>
                {ui.pinned.includes(tabMenu.id) ? '📌 Désépingler' : '📌 Épingler'}
              </button>
              <button className="kod-panel-item" onClick={() => { setSplitId(tabMenu.id); setTabMenu(null) }}>
                ➡ Ouvrir dans le volet droit
              </button>
              <button className="kod-panel-item" onClick={() => { closeTab(tabMenu.id); setTabMenu(null) }}>
                ✕ Fermer
              </button>
              <button className="kod-panel-item" onClick={() => { closeOthers(tabMenu.id); setTabMenu(null) }}>
                Fermer les autres
              </button>
              <button className="kod-panel-item" onClick={() => { closeRight(tabMenu.id); setTabMenu(null) }}>
                Fermer à droite
              </button>
            </div>
          )}
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
            <button className="db-btn" aria-label="Mode focus" title="Mode focus (sans sidebar, éditeur centré)" onClick={() => setFocus((z) => !z)}>🧘</button>
          </div>
        </div>
        {active ? (
          <>
            <div
              className={`kod-body${preview && (lang === 'markdown' || lang === 'html' || isSvgActive) ? ' split' : ''}${splitId ? ' has-split' : ''}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('text/kod-tab')) {
                  const r = e.currentTarget.getBoundingClientRect()
                  if (e.clientX > r.right - 140) {
                    e.preventDefault()
                    setDropZone(true)
                  }
                }
              }}
              onDragLeave={() => setDropZone(false)}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/kod-tab')
                if (id) {
                  e.preventDefault()
                  setSplitId(id)
                  setDropZone(false)
                }
              }}
            >
              {dropZone && <div className="kod-dropzone">Déposer « {dragTab ? nodeName(dragTab) : ''} » à droite ➡</div>}
              <div className="kod-gutter" ref={gutterRef}>
                <div className="kod-ghead">
                  <button title="Replier tous les blocs" onClick={foldAll}>⤓</button>
                  <button title="Déplier tous les blocs" onClick={unfoldAll}>⤒</button>
                </div>
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className={`kod-gline${foldable.has(i) ? ' foldable' : ''}${foldedStarts.has(i) ? ' folded' : ''}${bms.includes(i) ? ' bm' : ''}`}
                    onClick={() => (foldable.has(i) ? toggleFold(i) : toggleBm(i))}
                    title={foldable.has(i) ? 'Clic : replier/déplier ce bloc' : 'Clic : poser/retirer un signet 🔖'}
                  >
                    <span className="kod-garrow">{foldedStarts.has(i) ? '▸' : foldable.has(i) ? '▾' : ''}</span>
                    <span className="kod-gnum">{i + 1}</span>
                    {bms.includes(i) && <span className="kod-gbm">🔖</span>}
                  </div>
                ))}
              </div>
              {isImgActive && content.startsWith('data:') ? (
                <div className="kod-imgprev">
                  <img src={content} alt={activeName} />
                  <div className="kod-imgprev-name">{activeName} — aperçu image</div>
                </div>
              ) : (
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
                  onClick={(e) => {
                    const ta = taRef.current
                    if ((e.ctrlKey || e.metaKey) && ta) {
                      doGoToDef()
                      return
                    }
                    if (e.altKey && ta) {
                      const off = ta.selectionStart
                      const lc = offToLC(ta.value, off)
                      setRect({ aLine: lc.line - 1, aCol: lc.col, line: lc.line - 1, col: lc.col })
                    } else {
                      setRect(null)
                    }
                    updateLineCol()
                  }}
                  onKeyDown={onTaKeyDown}
                />
                {pair && (
                  <>
                    <div className="kod-bracket" style={{ left: 14 + pair.a.col * charW, top: 10 + pair.a.line * (ui.fontSize * 1.55) }} />
                    <div className="kod-bracket" style={{ left: 14 + pair.b.col * charW, top: 10 + pair.b.line * (ui.fontSize * 1.55) }} />
                  </>
                )}
                {rect &&
                  (() => {
                    const l0 = Math.min(rect.aLine, rect.line)
                    const l1 = Math.max(rect.aLine, rect.line)
                    const c0 = Math.min(rect.aCol, rect.col)
                    const c1 = Math.max(rect.aCol, rect.col)
                    const lh = ui.fontSize * 1.55
                    const out: React.ReactNode[] = []
                    for (let i = l0; i <= l1; i++) {
                      const len = Math.max(c1, lines[i]?.length ?? 0) - c0
                      out.push(
                        <div key={i} className="kod-rect" style={{ left: 14 + c0 * charW, top: 10 + i * lh, width: Math.max(2, len * charW), height: lh }} />
                      )
                    }
                    return out
                  })()}
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
                    <button className={`db-btn${findRe ? ' active' : ''}`} title="Recherche par expression régulière (.*)" aria-label="Regex" onClick={() => setFindRe((v) => !v)}>
                      .*
                    </button>
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
              )}
              {splitId && splitId !== active && (
                <MiniEditor
                  id={splitId}
                  name={nodeName(splitId)}
                  lang={langOf(nodeName(splitId))}
                  content={buffers[splitId]?.content ?? ''}
                  dirty={!!buffers[splitId]?.dirty}
                  onChange={(c) => setBuf(splitId, c)}
                  onSave={() => void saveActive(splitId)}
                  onClose={() => setSplitId(null)}
                />
              )}
              {preview && (lang === 'markdown' || lang === 'html' || isSvgActive) && (
                <div className="kod-preview" dangerouslySetInnerHTML={{ __html: renderPreview(content, isSvgActive ? 'svg' : lang) }} />
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
              <button className="db-btn" onClick={() => setDiffV(v)}>Comparer</button>
            </div>
          ))}
          {versions.length === 0 && <div className="kod-pal-empty">Aucune version enregistrée</div>}
        </div>
      )}
      {diffV && (
        <div className="kod-panel kod-diff" data-pop="kdiff">
          <div className="kod-panel-head">
            <span>⇄ Diff — {diffV.fileId ? nodeName(diffV.fileId) : activeName} · {new Date(diffV.at).toLocaleString('fr-FR')} → courant</span>
            <button className="db-btn" aria-label="Fermer le diff" onClick={() => setDiffV(null)}>✕</button>
          </div>
          <div className="kod-diff-body">
            {diffRows.slice(0, 800).map((r, i) => (
              <div key={i} className={`kod-diff-row ${r.type}`}>
                <span className="kod-diff-ln">{r.type === 'add' ? '' : r.a}{r.type === 'del' ? '' : r.b ? `/${r.b}` : ''}</span>
                <span className="kod-diff-txt">{r.text === '' ? ' ' : r.text}</span>
              </div>
            ))}
            {diffRows.length > 800 && <div className="kod-pal-empty">… {diffRows.length - 800} lignes de plus</div>}
          </div>
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

function MiniEditor(props: {
  id: string
  name: string
  lang: string
  content: string
  dirty: boolean
  onChange: (c: string) => void
  onSave: () => void
  onClose: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const hlRef = useRef<HTMLPreElement | null>(null)
  const gutRef = useRef<HTMLDivElement | null>(null)
  const isImg = isImageName(props.name)
  const sync = (): void => {
    const ta = taRef.current
    if (!ta) return
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop
      hlRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop
  }
  const lines = props.content.split('\n')
  return (
    <div className="kod-edwrap split-pane">
      <div className="kod-split-head">
        <span className="kod-tab-ico">{fileGlyph(props.name)}</span>
        <span className="kod-tab-name">{props.name}</span>
        {props.dirty && <span className="kod-dot">●</span>}
        <button className="db-btn" title="Enregistrer (Ctrl+S)" onClick={props.onSave}>
          💾
        </button>
        <button className="db-btn" title="Fermer le volet droit" onClick={props.onClose}>
          ✕
        </button>
      </div>
      {isImg && props.content.startsWith('data:') ? (
        <div className="kod-imgprev">
          <img src={props.content} alt={props.name} />
        </div>
      ) : (
        <div className="kod-split-body">
          <div className="kod-gutter" ref={gutRef} aria-hidden>
            {lines.map((_, i) => (
              <div key={i} className="kod-gline">
                <span className="kod-garrow" />
                <span className="kod-gnum">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="kod-edwrap mini-ed">
            <div className="kod-ed">
              <pre className="kod-hl" ref={hlRef} aria-hidden>
                <code dangerouslySetInnerHTML={{ __html: highlight(props.content, props.lang) + '\n' }} />
              </pre>
              <textarea
                ref={taRef}
                className="kod-ta"
                wrap="off"
                spellCheck={false}
                value={props.content}
                onChange={(e) => props.onChange(e.target.value)}
                onScroll={sync}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault()
                    props.onSave()
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
