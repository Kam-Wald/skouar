import { useEffect, useMemo, useRef, useState } from 'react'
import type * as React from 'react'
import { useDismiss } from '../blocs/useDismiss'
import { notify } from '../blocs/notify'
import { loadAppSettings, saveAppSettings, SETTINGS_EVENT } from '../../Settings'
import {
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
import { KOD_TEMPLATES, templateGroups } from './templates'
import { HL_THEMES } from './themes'
import { syntaxIssues, type KodIssue } from './diagnostics'
import { diffLines, type DiffRow } from './diff'
import { expandEmmet } from './emmet'
import { DEFAULT_KEYMAP, comboOf } from './keymap'
import { buildIndex, findDef, resolveImport, wordAtOffset, importSpecAtOffset, type DefFile } from './definitions'
import { zipFiles, unzipFiles, entryText } from './zip'
import {
  isImageName,
  fileToDataURL,
  fileGlyph,
  isCodeName,
  scanDir,
  flattenReal,
  PAIRS,
  type RealEntry,
  type Buffer,
  type GResult
} from './lib'

export function useKodApp() {

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


  const lines = content.split('\n')

  return {
    nodes,
    setNodes,
    ui,
    setUi,
    buffers,
    setBuffers,
    dirHandle,
    setDirHandle,
    realTree,
    setRealTree,
    sideW,
    setSideW,
    newItem,
    setNewItem,
    renameId,
    setRenameId,
    renameVal,
    setRenameVal,
    findOpen,
    setFindOpen,
    findQ,
    setFindQ,
    findIdx,
    setFindIdx,
    gOpen,
    setGOpen,
    gQ,
    setGQ,
    gResults,
    setGResults,
    gBusy,
    setGBusy,
    toast,
    setToast,
    savedAt,
    setSavedAt,
    lineCol,
    setLineCol,
    replOpen,
    setReplOpen,
    replQ,
    setReplQ,
    gReplQ,
    setGReplQ,
    multi,
    setMulti,
    preview,
    setPreview,
    mini,
    setMini,
    outlineOpen,
    setOutlineOpen,
    histOpen,
    setHistOpen,
    versions,
    setVersions,
    palOpen,
    setPalOpen,
    palQ,
    setPalQ,
    palArg,
    setPalArg,
    palVal,
    setPalVal,
    folds,
    setFolds,
    pair,
    setPair,
    charW,
    setCharW,
    probsOpen,
    setProbsOpen,
    fpOpen,
    setFpOpen,
    fpQ,
    setFpQ,
    focus,
    setFocus,
    newTabOpen,
    setNewTabOpen,
    tplOpen,
    setTplOpen,
    projects,
    setProjects,
    pid,
    setPid,
    projOpen,
    setProjOpen,
    newProjName,
    setNewProjName,
    renProj,
    setRenProj,
    renProjVal,
    setRenProjVal,
    gitOpen,
    setGitOpen,
    commits,
    setCommits,
    gitMsg,
    setGitMsg,
    branches,
    setBranches,
    newBranch,
    setNewBranch,
    curBranch,
    setCurBranch,
    snipOpen,
    setSnipOpen,
    snips,
    setSnips,
    snipLang,
    setSnipLang,
    snipLabel,
    setSnipLabel,
    snipBody,
    setSnipBody,
    findRe,
    setFindRe,
    gRe,
    setGRe,
    synIssues,
    setSynIssues,
    rect,
    setRect,
    bms,
    setBms,
    tabMenu,
    setTabMenu,
    diffV,
    setDiffV,
    splitId,
    setSplitId,
    dropZone,
    setDropZone,
    dragTab,
    setDragTab,
    extChanged,
    setExtChanged,
    keymap,
    setKeymap,
    zipInputRef,
    snipInputRef,
    mtimesRef,
    realTreeRef,
    extRef,
    taRef,
    hlRef,
    gutterRef,
    miniRef,
    fileInputRef,
    nodesRef,
    buffersRef,
    uiRef,
    pendingDelete,
    matches,
    outline,
    foldable,
    foldedStarts,
    probsStatic,
    probs,
    fpList,
    diffRows,
    defFiles,
    defIndex,
    km,
    nodeName,
    pollExternal,
    reloadDisk,
    rescanDisk,
    openGit,
    commitCurrent,
    commitProject,
    restoreCommit,
    diffCommit,
    createBranch,
    exportZip,
    importZip,
    mergedSnippets,
    addSnippet,
    exportSnippets,
    importSnippets,
    syncScroll,
    updateLineCol,
    openNode,
    openReal,
    orderedTabs,
    closeTab,
    reopenClosedTab,
    togglePin,
    closeOthers,
    closeRight,
    sessOf,
    switchProject,
    createProject,
    commitRenameProj,
    removeProject,
    saveActive,
    createItem,
    removeNode,
    commitRename,
    openDirPicker,
    openFilePicker,
    saveAs,
    goMatch,
    runGlobalSearch,
    jumpTo,
    setBuf,
    replForMatch,
    replaceCurrent,
    replaceAllFile,
    replaceAllProject,
    wordAt,
    addNextOccurrence,
    selectAllOccurrences,
    applyMultiEdit,
    rectApply,
    rectExtend,
    jumpLine,
    miniJump,
    insertText,
    paletteCmds,
    openHist,
    restoreVersion,
    offToLC,
    findPair,
    commentToken,
    toggleComment,
    moveLines,
    duplicateSel,
    handleAutoPair,
    foldEnd,
    toggleFold,
    applyContent,
    foldAll,
    unfoldAll,
    toggleBm,
    openFileByKey,
    moveNode,
    importFiles,
    onFilesPicked,
    nodePath,
    doGoToDef,
    createQuickFile,
    createFromTemplate,
    onTaKeyDown,
    childrenOf,
    toggleDir,
    renderNode,
    renderReal,
    active,
    buf,
    activeNode,
    activeReal,
    activeName,
    lang,
    content,
    isImgActive,
    isSvgActive,
    SNIPPETS,
    filteredPal,
    lines,
  }
}

export type KodApi = ReturnType<typeof useKodApp>
