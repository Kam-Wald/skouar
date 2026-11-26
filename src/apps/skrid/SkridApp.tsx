import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import SettingsButton from '../../Settings'
import ThemeButton from '../../ThemeButton'
import { useDismiss } from '../blocs/useDismiss'
import { stripHtml } from '../blocs/tree'
import { buildPdf, downloadPdf, wrap, type PdfLine, type PdfOpts } from '../blocs/pdf'
import { exportFile } from '../blocs/markdown'
import {
  createDoc,
  docIcon,
  FICHE_TYPES,
  ficheTypeOf,
  loadSkrid,
  loadSkridHistory,
  orderedDocs,
  saveSkrid,
  saveSkridHistory,
  uid,
  type SkridDoc,
  type SkridState
} from './store'
import { SKRID_TEMPLATES } from './templates'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eraser,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
  Unlink2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  MessageSquare,
  Search,
  X
} from 'lucide-react'
import { ficheHtml, htmlToMarkdown, lastNDays, standaloneHtml, streakOf, todayKey, wordHtml } from './extra'

type SkridView = 'doc' | 'writer' | 'stats'

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(ts).toLocaleDateString('fr-FR')
}

function wordCount(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length
}

function cleanHtml(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  d.querySelectorAll('mark.skrid-find, mark.skrid-find-cur').forEach((m) =>
    m.replaceWith(document.createTextNode(m.textContent ?? ''))
  )
  return d.innerHTML
}

function htmlToLines(html: string, lines: PdfLine[]): void {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  const addText = (t: string, size: number, font: 1 | 2 | 3, indent: number, gap: number) => {
    if (!t.trim()) return
    for (const w of wrap(t.trim(), size, indent)) lines.push({ text: w, size, font, indent, gapBefore: gap })
  }
  for (const node of Array.from(div.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      addText(node.textContent ?? '', 11, 1, 0, 2)
      continue
    }
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const t = stripHtml(el.innerHTML)
    if (tag === 'h1') addText(t, 15, 2, 0, 10)
    else if (tag === 'h2') addText(t, 13, 2, 0, 8)
    else if (tag === 'h3') addText(t, 12, 2, 0, 6)
    else if (tag === 'blockquote') addText(t, 11, 1, 16, 4)
    else if (tag === 'li') addText('• ' + t, 11, 1, 16, 0)
    else if (tag === 'pre') for (const l of t.split('\n')) lines.push({ text: l || ' ', size: 9, font: 3, indent: 12, gapBefore: 0 })
    else addText(t, 11, 1, 0, 2)
  }
}

function DocTree({
  docs,
  parentId,
  depth,
  currentId,
  dragOverId,
  onSelect,
  onAddChild,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: {
  docs: SkridDoc[]
  parentId: string | null
  depth: number
  currentId: string | null
  dragOverId: string | null
  onSelect: (id: string) => void
  onAddChild: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: (id: string) => void
  onDragEnd: () => void
}) {
  return (
    <>
      {docs
        .filter((d) => (d.parentId ?? null) === parentId)
        .map((d) => (
          <li key={d.id}>
            <div
              className={`blocs-page-row${dragOverId === d.id ? ' drop-hint' : ''}`}
              style={{ paddingLeft: depth * 20 }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', d.id)
                e.dataTransfer.effectAllowed = 'move'
                onDragStart(d.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                onDragOver(d.id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(d.id)
              }}
              onDragEnd={onDragEnd}
            >
              <span className="drag-handle">⸬</span>
              <button
                className={`blocs-page-item${d.id === currentId ? ' selected' : ''}`}
                onClick={() => onSelect(d.id)}
              >
                <span className="skrid-doc-count">{wordCount(d.content)}</span>
                {d.title.trim() || 'Sans titre'}
              </button>
              <button className="blocs-page-act" title="Nouveau sous-chapitre" onClick={() => onAddChild(d.id)}>
                ＋
              </button>
              <button className="blocs-page-act" title="Dupliquer" onClick={() => onDuplicate(d.id)}>
                ⧉
              </button>
              <button className="blocs-page-del" title="Supprimer" onClick={() => onDelete(d.id)}>
                ×
              </button>
            </div>
            <ul className="blocs-page-sub">
              <DocTree
                docs={docs}
                parentId={d.id}
                depth={depth + 1}
                currentId={currentId}
                dragOverId={dragOverId}
                onSelect={onSelect}
                onAddChild={onAddChild}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            </ul>
          </li>
        ))}
    </>
  )
}

export default function SkridApp() {
  const [state, setState] = useState<SkridState | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [view, setView] = useState<SkridView>('doc')
  const [tplOpen, setTplOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const [targetPop, setTargetPop] = useState(false)
  const [targetDraft, setTargetDraft] = useState('')
  const [linkPop, setLinkPop] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [tablePop, setTablePop] = useState(false)
  const [tRows, setTRows] = useState('3')
  const [tCols, setTCols] = useState('3')
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem('skouar:sidebarW'))
    return Number.isFinite(v) && v >= 180 && v <= 440 ? v : 240
  })
  const [findOpen, setFindOpen] = useState(false)
  const [findQ, setFindQ] = useState('')
  const [repl, setRepl] = useState('')
  const [findIdx, setFindIdx] = useState(0)
  const [findCount, setFindCount] = useState(0)
  const [comPop, setComPop] = useState(false)
  const [comText, setComText] = useState('')
  const [comOpen, setComOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [expOpen, setExpOpen] = useState(false)
  const [read, setRead] = useState(false)
  const [readSize, setReadSize] = useState(1.3)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQ, setMentionQ] = useState('')
  const [mentionIdx, setMentionIdx] = useState(0)
  const [mentionPos, setMentionPos] = useState({ x: 0, y: 0 })
  const [toast, setToast] = useState<{ key: number; msg: string; action?: () => void } | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const findMarks = useRef<HTMLElement[]>([])
  const pastRef = useRef<SkridState[]>([])
  const futureRef = useRef<SkridState[]>([])
  const prevRef = useRef<SkridState | null>(null)
  const lastPush = useRef(0)
  useDismiss('target', targetPop, () => setTargetPop(false))
  useDismiss('tplsk', tplOpen, () => setTplOpen(false))
  useDismiss('sklink', linkPop, () => setLinkPop(false))
  useDismiss('sktable', tablePop, () => setTablePop(false))
  useDismiss('skfind', findOpen, () => closeFind())
  useDismiss('skcom', comPop, () => setComPop(false))
  useDismiss('skcoms', comOpen, () => setComOpen(false))
  useDismiss('skexp', expOpen, () => setExpOpen(false))
  useDismiss('skmen', mentionOpen, () => setMentionOpen(false))

  useEffect(() => {
    let alive = true
    loadSkrid().then((s) => alive && setState(s))
    loadSkridHistory().then((h) => {
      if (alive) {
        pastRef.current = h.past
        futureRef.current = h.future
      }
    })
    const onToast = (e: Event) => setToast({ key: Date.now(), msg: (e as CustomEvent<string>).detail })
    window.addEventListener('skouar:toast', onToast)
    return () => {
      alive = false
      window.removeEventListener('skouar:toast', onToast)
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => {
      void saveSkrid(state).then(() => setSavedAt(Date.now()))
    }, 200)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (!state) return
    const prev = prevRef.current
    prevRef.current = state
    if (!prev) return
    const t = setTimeout(() => {
      const now = Date.now()
      if (now - lastPush.current > 500) {
        pastRef.current.push(prev)
        if (pastRef.current.length > 100) pastRef.current.shift()
        futureRef.current = []
        lastPush.current = now
        void saveSkridHistory(pastRef.current, futureRef.current)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!findOpen) return
    const t = setTimeout(() => runFind(), 200)
    return () => clearTimeout(t)
  }, [findQ, findOpen])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setView('doc')
        setFindOpen(true)
      } else if (e.key === 'Escape') {
        setRead(false)
        setHelpOpen(false)
        closeFind()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = state?.docs.find((d) => d.id === state.currentId) ?? null

  useEffect(() => {
    const el = editorRef.current
    if (!el || !current) return
    if (cleanHtml(el.innerHTML) === current.content) return
    const sel = window.getSelection()
    let offset = 0
    if (sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode)) {
      const r = sel.getRangeAt(0).cloneRange()
      r.selectNodeContents(el)
      r.setEnd(sel.anchorNode, sel.anchorOffset)
      offset = r.toString().length
    }
    el.innerHTML = current.content
    if (offset > 0 && sel) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let remaining = offset
      let node = walker.nextNode() as Text | null
      while (node) {
        if (remaining <= node.length) {
          const r2 = document.createRange()
          r2.setStart(node, remaining)
          r2.collapse(true)
          sel.removeAllRanges()
          sel.addRange(r2)
          break
        }
        remaining -= node.length
        node = walker.nextNode() as Text | null
      }
    }
  }, [current?.id, current?.content])

  const undo = () => {
    const past = pastRef.current
    if (!past.length || !state) return
    const prev = past[past.length - 1]
    pastRef.current = past.slice(0, -1)
    futureRef.current.push(state)
    void saveSkridHistory(pastRef.current, futureRef.current)
    setState(prev)
  }

  const redo = () => {
    const future = futureRef.current
    if (!future.length || !state) return
    const next = future[future.length - 1]
    futureRef.current = future.slice(0, -1)
    pastRef.current.push(state)
    void saveSkridHistory(pastRef.current, futureRef.current)
    setState(next)
  }

  const updateDoc = (id: string, patch: Partial<SkridDoc>) =>
    setState((s) =>
      s ? { ...s, docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)) } : s
    )

  const addDoc = (parentId: string | null = null) => {
    setState((s) => {
      if (!s) return s
      const d = createDoc('Nouveau chapitre', parentId)
      return { ...s, docs: [...s.docs, d], currentId: d.id }
    })
  }

  const addAnnexe = (kind: 'fiche' | 'memo') => {
    setState((s) => {
      if (!s) return s
      const d = createDoc(kind === 'memo' ? 'Nouveau mémo' : 'Nouvelle fiche')
      d.kind = kind
      if (kind === 'fiche') d.ficheType = 'perso'
      return { ...s, docs: [...s.docs, d], currentId: d.id }
    })
  }

  const addFiche = () => addAnnexe('fiche')
  const addMemo = () => addAnnexe('memo')

  const deleteDoc = (id: string) => {
    const snap = state
    setState((s) => {
      if (!s) return s
      const sub = [s.docs.find((d) => d.id === id), ...descendants(s.docs, id)].filter(Boolean) as SkridDoc[]
      return {
        ...s,
        docs: s.docs.filter((d) => !sub.some((x) => x.id === d.id)),
        currentId: sub.some((x) => x.id === s.currentId) ? s.docs.find((d) => !sub.some((x) => x.id === d.id))?.id ?? null : s.currentId
      }
    })
    setToast({ key: Date.now(), msg: 'Chapitre supprimé', action: () => snap && setState(snap) })
  }

  const duplicateDoc = (id: string) => {
    setState((s) => {
      if (!s) return s
      const d = s.docs.find((x) => x.id === id)
      if (!d) return s
      const copy: SkridDoc = { ...d, id: uid(), title: `${d.title.trim() || 'Sans titre'} (copie)`, updatedAt: Date.now() }
      const idx = s.docs.findIndex((x) => x.id === id)
      const docs = [...s.docs]
      docs.splice(idx + 1, 0, copy)
      return { ...s, docs, currentId: copy.id }
    })
  }

  const goChapter = (dir: -1 | 1) => {
    const n = docsOrdered[chapIdx + dir]
    if (n) setState((s) => (s ? { ...s, currentId: n.id } : s))
  }

  const moveDoc = (id: string, dir: -1 | 1) => {
    setState((s) => {
      if (!s) return s
      const d = s.docs.find((x) => x.id === id)
      if (!d) return s
      const siblings = s.docs.filter((x) => (x.parentId ?? null) === (d.parentId ?? null))
      const i = siblings.findIndex((x) => x.id === id)
      const j = i + dir
      if (j < 0 || j >= siblings.length) return s
      const docs = [...s.docs]
      const a = docs.findIndex((x) => x.id === siblings[i].id)
      const b = docs.findIndex((x) => x.id === siblings[j].id)
      ;[docs[a], docs[b]] = [docs[b], docs[a]]
      return { ...s, docs }
    })
  }

  function descendants(docs: SkridDoc[], id: string): SkridDoc[] {
    const out: SkridDoc[] = []
    const walk = (pid: string) => {
      for (const d of docs.filter((x) => (x.parentId ?? null) === pid)) {
        out.push(d)
        walk(d.id)
      }
    }
    walk(id)
    return out
  }

  const saveContent = () => {
    const el = editorRef.current
    if (!el || !current) return
    const html = cleanHtml(el.innerHTML)
    const before = wordCount(current.content)
    const after = wordCount(html)
    updateDoc(current.id, { content: html })
    if (after > before) {
      const k = todayKey()
      setState((s) => (s ? { ...s, daily: { ...(s.daily ?? {}), [k]: (s.daily?.[k] ?? 0) + (after - before) } } : s))
    }
  }

  const eachSelectedBlock = (fn: (el: HTMLElement) => void, tags = 'p,h1,h2,h3,h4,li,blockquote,div,pre,td,th') => {
    const el = editorRef.current
    if (!el) return
    const sel = window.getSelection()
    const blocks = new Set<HTMLElement>()
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0)
      el.querySelectorAll(tags).forEach((b) => {
        if (r.intersectsNode(b)) blocks.add(b as HTMLElement)
      })
      if (!blocks.size && sel.anchorNode) {
        let n = sel.anchorNode as HTMLElement | null
        while (n && n !== el) {
          if (tags.split(',').includes(n.tagName.toLowerCase())) {
            blocks.add(n)
            break
          }
          n = n.parentElement
        }
      }
    }
    if (!blocks.size) {
      let n = (sel?.anchorNode ?? el) as HTMLElement | null
      while (n && n !== el) {
        if (tags.split(',').includes(n.tagName.toLowerCase())) {
          blocks.add(n)
          break
        }
        n = n.parentElement
      }
      if (!blocks.size) blocks.add(el.firstElementChild as HTMLElement ?? el)
    }
    blocks.forEach(fn)
  }

  const applyLineHeight = (lh: string) => {
    eachSelectedBlock((b) => {
      b.style.lineHeight = lh
    })
    saveContent()
  }

  const toggleTaskList = () => {
    const sel = window.getSelection()
    const inLi = sel && sel.anchorNode ? !!(sel.anchorNode as HTMLElement).closest?.('li') || (sel.anchorNode as HTMLElement).tagName === 'LI' : false
    if (!inLi) document.execCommand('insertUnorderedList', false)
    eachSelectedBlock((b) => {
      if (b.tagName === 'LI') b.classList.toggle('task')
    }, 'li')
    saveContent()
  }

  const doLink = () => {
    const url = linkUrl.trim()
    if (!url) return
    document.execCommand('styleWithCSS', false, 'true')
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) document.execCommand('createLink', false, url)
    else document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`)
    saveContent()
    setLinkPop(false)
    setLinkUrl('')
  }

  const doTable = () => {
    const r = Math.min(20, Math.max(1, Number(tRows) || 1))
    const c = Math.min(10, Math.max(1, Number(tCols) || 1))
    let html = '<table class="skrid-table"><tbody>'
    for (let i = 0; i < r; i++) {
      html += '<tr>'
      for (let j = 0; j < c; j++) html += '<td><br></td>'
      html += '</tr>'
    }
    html += '</tbody></table><p><br></p>'
    document.execCommand('insertHTML', false, html)
    saveContent()
    setTablePop(false)
  }

  const onImgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      document.execCommand('insertHTML', false, `<img src="${String(reader.result)}" alt="" style="max-width:100%;border-radius:10px">`)
      saveContent()
    }
    reader.readAsDataURL(f)
  }

  const fmt = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    saveContent()
  }

  const runFind = () => {
    const el = editorRef.current
    if (!el) return
    el.querySelectorAll('mark.skrid-find, mark.skrid-find-cur').forEach((m) =>
      m.replaceWith(document.createTextNode(m.textContent ?? ''))
    )
    el.normalize()
    const q = findQ.trim()
    const marks: HTMLElement[] = []
    if (q) {
      const ql = q.toLowerCase()
      for (;;) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let hit: Text | null = null
        let node = walker.nextNode() as Text | null
        while (node) {
          if ((node.nodeValue ?? '').toLowerCase().includes(ql)) {
            hit = node
            break
          }
          node = walker.nextNode() as Text | null
        }
        if (!hit) break
        const idx = (hit.nodeValue ?? '').toLowerCase().indexOf(ql)
        const r = document.createRange()
        r.setStart(hit, idx)
        r.setEnd(hit, idx + q.length)
        const m = document.createElement('mark')
        m.className = 'skrid-find'
        r.surroundContents(m)
        marks.push(m)
      }
    }
    findMarks.current = marks
    setFindCount(marks.length)
    const idx = marks.length ? Math.min(findIdx, marks.length - 1) : 0
    setFindIdx(idx)
    marks.forEach((m, i) => m.classList.toggle('skrid-find-cur', i === idx))
    if (marks.length) marks[idx]?.scrollIntoView({ block: 'center' })
  }

  const findGo = (dir: -1 | 1) => {
    const marks = findMarks.current
    if (!marks.length) return
    const idx = (findIdx + dir + marks.length) % marks.length
    setFindIdx(idx)
    marks.forEach((m, i) => m.classList.toggle('skrid-find-cur', i === idx))
    marks[idx]?.scrollIntoView({ block: 'center' })
  }

  const doReplace = (all: boolean) => {
    const el = editorRef.current
    if (!el || !findQ.trim()) return
    const targets = all
      ? (Array.from(el.querySelectorAll('mark.skrid-find, mark.skrid-find-cur')) as HTMLElement[])
      : findMarks.current[findIdx]
        ? [findMarks.current[findIdx]]
        : []
    for (const m of targets) m.replaceWith(document.createTextNode(repl))
    saveContent()
    runFind()
  }

  const closeFind = () => {
    const el = editorRef.current
    const had = el?.querySelector('mark.skrid-find, mark.skrid-find-cur')
    if (el && had) {
      el.querySelectorAll('mark.skrid-find, mark.skrid-find-cur').forEach((m) =>
        m.replaceWith(document.createTextNode(m.textContent ?? ''))
      )
      saveContent()
    }
    findMarks.current = []
    setFindCount(0)
    setFindOpen(false)
  }

  const addComment = () => {
    const text = comText.trim()
    const sel = window.getSelection()
    if (current && text && sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const cid = uid()
      const r = sel.getRangeAt(0)
      const frag = r.extractContents()
      const span = document.createElement('span')
      span.className = 'skrid-com'
      span.id = `com-${cid}`
      span.appendChild(frag)
      r.insertNode(span)
      sel.removeAllRanges()
      const html = cleanHtml(editorRef.current!.innerHTML)
      setState((s) =>
        s
          ? {
              ...s,
              docs: s.docs.map((d) =>
                d.id === current.id
                  ? { ...d, content: html, comments: { ...(d.comments ?? {}), [cid]: { text, at: Date.now() } }, updatedAt: Date.now() }
                  : d
              )
            }
          : s
      )
      setToast({ key: Date.now(), msg: 'Commentaire ajouté 💬' })
    }
    setComText('')
    setComPop(false)
  }

  const deleteComment = (cid: string) => {
    const el = editorRef.current
    if (!el || !current) return
    const span = el.querySelector(`#com-${cid}`)
    if (span) span.replaceWith(document.createTextNode(span.textContent ?? ''))
    const html = cleanHtml(el.innerHTML)
    setState((s) =>
      s
        ? {
            ...s,
            docs: s.docs.map((d) => {
              if (d.id !== current.id) return d
              const comments = { ...(d.comments ?? {}) }
              delete comments[cid]
              return { ...d, content: html, comments, updatedAt: Date.now() }
            })
          }
        : s
    )
  }

  const comGoto = (cid: string) => {
    const el = editorRef.current?.querySelector(`#com-${cid}`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ block: 'center' })
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 1400)
    }
  }

  const moveDocTo = (id: string, targetId: string) => {
    setState((s) => {
      if (!s) return s
      const d = s.docs.find((x) => x.id === id)
      const t = s.docs.find((x) => x.id === targetId)
      if (!d || !t || d.id === t.id) return s
      if (descendants(s.docs, id).some((x) => x.id === targetId)) return s
      const docs = s.docs.filter((x) => x.id !== id)
      if ((d.parentId ?? null) === (t.parentId ?? null)) {
        const i = docs.findIndex((x) => x.id === targetId)
        docs.splice(i, 0, { ...d, updatedAt: Date.now() })
      } else {
        docs.push({ ...d, parentId: t.id, updatedAt: Date.now() })
      }
      return { ...s, docs }
    })
  }

  const openMentionAtCaret = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) return
    const t = sel.anchorNode
    if (!t || t.nodeType !== Node.TEXT_NODE) return
    const upto = ((t as Text).nodeValue ?? '').slice(0, sel.anchorOffset)
    const m = upto.match(/@([^\s@]{0,30})$/)
    if (!m) {
      if (mentionOpen) setMentionOpen(false)
      return
    }
    setMentionQ(m[1])
    setMentionIdx(0)
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    setMentionPos({ x: Math.max(8, rect.left), y: rect.bottom + 6 })
    setMentionOpen(true)
  }

  const insertMention = (d: SkridDoc) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const t = sel.anchorNode as Text
    if (t && t.nodeType === Node.TEXT_NODE) {
      const upto = (t.nodeValue ?? '').slice(0, sel.anchorOffset)
      const m = upto.match(/@([^\s@]{0,30})$/)
      if (m) t.deleteData(sel.anchorOffset - m[0].length, m[0].length)
    }
    const span = document.createElement('span')
    span.className = 'skrid-ref'
    span.setAttribute('data-doc', d.id)
    span.contentEditable = 'false'
    span.textContent = `@${d.title.trim() || 'Sans titre'}`
    const r = sel.getRangeAt(0)
    r.collapse(true)
    r.insertNode(span)
    r.setStartAfter(span)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    saveContent()
    setMentionOpen(false)
    setMentionQ('')
  }

  const pdfOpts = (): PdfOpts => {
    const p = state?.pdf ?? {}
    return {
      topNum: state?.pdfNumTop ?? true,
      bottomNum: state?.pdfNumBottom ?? true,
      xOfY: p.xOfY ?? false,
      footerText: p.footerTitle ? state?.bookTitle || 'Livre' : undefined,
      format: p.format ?? 'a4',
      margin: p.margin ?? (p.format === 'a5' ? 40 : undefined),
      font: p.font ?? 'sans',
      toc: p.toc ?? false,
      pageBreakPerChapter: p.pageBreak ?? false,
      titlePage: p.titlePage ?? false,
      titleText: state?.bookTitle || 'Livre'
    }
  }

  const setPdfOpt = (k: string, v: unknown) =>
    setState((s) => (s ? { ...s, pdf: { ...(s.pdf ?? {}), [k]: v } } : s))

  const exportChapter = (format: 'pdf' | 'html' | 'md' | 'doc') => {
    if (!current || !state) return
    const title = current.title.trim() || 'Sans titre'
    const fname = title.replace(/[\\/:*?"<>|]/g, '-')
    const body = current.kind === 'fiche' ? ficheHtml(current) : current.content
    if (format === 'pdf') {
      const lines: PdfLine[] = [
        { text: title, size: 20, font: 2, indent: 0, gapBefore: 0 },
        { text: `${state.bookTitle || 'Livre'} — Skrid · ${new Date().toLocaleDateString('fr-FR')}`, size: 9, font: 1, indent: 0, gapBefore: 4 },
        { text: '', size: 6, font: 1, indent: 0, gapBefore: 8 }
      ]
      htmlToLines(body, lines)
      downloadPdf(buildPdf(lines, { ...pdfOpts(), toc: false, titlePage: false }), `${fname}.pdf`)
    } else if (format === 'html') {
      exportFile(`${fname}.html`, standaloneHtml(title, state.bookTitle || 'Livre', body), 'text/html')
    } else if (format === 'md') {
      exportFile(`${fname}.md`, `# ${title}\n\n${htmlToMarkdown(body)}`, 'text/markdown')
    } else {
      exportFile(`${fname}.doc`, wordHtml(title, body), 'application/msword')
    }
    setToast({ key: Date.now(), msg: `${kindLabel} exporté (${format.toUpperCase()}) ⬇` })
    setExpOpen(false)
  }

  const fmtFromUi = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    fmt(cmd, value)
  }

  const setForeColor = (color: string) => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
    fmt('foreColor', color)
  }

  const setHiliteColor = (color: string) => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
    fmt('hiliteColor', color)
  }

  const onEditorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIdx((i) => Math.min(i + 1, mentionList.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const d = mentionList[Math.min(mentionIdx, mentionList.length - 1)]
        if (d) insertMention(d)
        return
      }
      if (e.key === 'Escape') {
        setMentionOpen(false)
        return
      }
    }
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      fmt(e.key.toLowerCase())
    }
  }

  const words = current ? wordCount(current.content) : 0
  const target = current?.wordTarget ?? 0
  const chapters = state ? state.docs.filter((d) => !d.kind || d.kind === 'chapter') : []
  const annexes = state ? state.docs.filter((d) => d.kind === 'fiche' || d.kind === 'memo') : []
  const totalWords = chapters.reduce((a, d) => a + wordCount(d.content), 0)
  const docsOrdered = orderedDocs(chapters)
  const maxW = Math.max(1, ...docsOrdered.map((d) => wordCount(d.content)))
  const daily = state?.daily ?? {}
  const days14 = lastNDays(daily, 14)
  const maxD = Math.max(1, ...days14.map((d) => d.words))
  const sum7 = lastNDays(daily, 7).reduce((a, d) => a + d.words, 0)
  const streak = streakOf(daily)
  const chapIdx = docsOrdered.findIndex((d) => d.id === current?.id)
  const comCount = Object.keys(current?.comments ?? {}).length
  const kindLabel = current?.kind === 'memo' ? 'Mémo' : current?.kind === 'fiche' ? 'Fiche' : 'Chapitre'
  const annexesSorted = [...annexes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  const mentionList = annexesSorted.filter((d) => `${d.title} ${d.kind ?? ''}`.toLowerCase().includes(mentionQ.toLowerCase()))

  const exportBook = () => {
    if (!state) return
    const lines: PdfLine[] = [
      { text: state.bookTitle || 'Mon livre', size: 26, font: 2, indent: 0, gapBefore: 0 },
      { text: `Skrid — Skouar · ${new Date().toLocaleDateString('fr-FR')} · ${totalWords} mots`, size: 10, font: 1, indent: 0, gapBefore: 8 }
    ]
    orderedDocs(state.docs.filter((d) => !d.kind || d.kind === 'chapter')).forEach((d, i) => {
      lines.push({ text: '', size: 8, font: 1, indent: 0, gapBefore: i === 0 ? 40 : 90 })
      lines.push({ text: d.title.trim() || 'Sans titre', size: 18, font: 2, indent: 0, gapBefore: 0, chapter: d.title.trim() || 'Sans titre' })
      htmlToLines(d.content, lines)
    })
    downloadPdf(buildPdf(lines, pdfOpts()), `${(state.bookTitle || 'livre').replace(/[\\/:*?"<>|]/g, '-')}.pdf`)
    setToast({ key: Date.now(), msg: 'Livre exporté en PDF 📄' })
  }

  if (!state || !current) {
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

  return (
    <div
      className={`blocs-app skrid-app${focus ? ' focus' : ''}${read ? ' reading' : ''}${view !== 'doc' ? ' altview' : ''}`}
      style={{ '--side-w': `${sideW}px` } as CSSProperties}
    >
      {!focus && (
        <aside className="blocs-sidebar skrid-side">
          <div className="blocs-app-head">
            <Link to="/" className="blocs-app-brand" title="Retour au launcher Skouar">
              <img className="blocs-app-logo" src={`${import.meta.env.BASE_URL}app-icons/skrid.svg`} alt="Skrid" />
              <span className="blocs-app-name">Skrid</span>
            </Link>
            <Link to="/" className="blocs-back" title="Retour au launcher">
              ←
            </Link>
          </div>
          <div className="skrid-views">
            <button className={view === 'doc' ? 'active' : ''} onClick={() => setView('doc')} title="Vue Document — édition de texte">
              ✍️ Document
            </button>
            <button className={view === 'writer' ? 'active' : ''} onClick={() => setView('writer')} title="Vue Écrivain — plan du livre, objectifs, export PDF">
              🖋️ Écrivain
            </button>
            <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')} title="Statistiques d’écriture">
              📊 Stats
            </button>
          </div>
          <div className="blocs-side-sep" />
          {view === 'writer' && (
          <div className="blocs-sidebar-head">
            <span>Chapitres</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="blocs-new-page" onClick={() => addDoc(null)} title="Nouveau chapitre">
                ＋
              </button>
              <button
                className={`blocs-new-page${view === 'writer' ? ' active' : ''}`}
                onClick={() => setView(view === 'writer' ? 'doc' : 'writer')}
                title="Vue Écrivain (plan du livre)"
              >
                🗂
              </button>
            </div>
          </div>
          )}
          <div className="blocs-sidebar-scroll">
            {view === 'writer' && (
            <ul className="blocs-page-list">
              <DocTree
                docs={chapters}
                parentId={null}
                depth={0}
                currentId={current.id}
                dragOverId={dragOverId}
                onSelect={(id) => setState((s) => (s ? { ...s, currentId: id } : s))}
                onAddChild={(id) => addDoc(id)}
                onDelete={deleteDoc}
                onDuplicate={duplicateDoc}
                onDragStart={(id) => setDragId(id)}
                onDragOver={(id) => setDragOverId(id)}
                onDrop={(id) => {
                  if (dragId) moveDocTo(dragId, id)
                  setDragId(null)
                  setDragOverId(null)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDragOverId(null)
                }}
              />
            </ul>
            )}
            <div className="blocs-sidebar-head" style={{ marginTop: 12 }}>
              <span>Fiches & mémos</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className="blocs-new-page" onClick={addFiche} title="Nouvelle fiche">
                  ＋
                </button>
                <button className="blocs-new-page" onClick={addMemo} title="Nouveau mémo">
                  🗒️
                </button>
              </div>
            </div>
            <ul className="blocs-page-list">
              {annexesSorted.map((d) => (
                <li key={d.id}>
                  <div className="blocs-page-row">
                    <button
                      className={`blocs-page-item${d.id === current.id ? ' selected' : ''}`}
                      onClick={() => setState((s) => (s ? { ...s, currentId: d.id } : s))}
                    >
                      <span className="skrid-doc-count">{d.kind === 'fiche' ? `${Object.values(d.fields ?? {}).filter((v) => v.trim()).length}/${ficheTypeOf(d).fields.length}` : wordCount(d.content)}</span>
                      <span style={{ marginRight: 5 }}>{docIcon(d)}</span>
                      {d.title.trim() || 'Sans titre'}
                    </button>
                    <label className="skrid-dot-btn" title="Couleur">
                      <span className="skrid-dot" style={{ background: d.color ?? 'transparent', borderColor: d.color ?? 'var(--muted)' }} />
                      <input type="color" className="skrid-dot-in" defaultValue={d.color ?? '#e8b93e'} onChange={(e) => updateDoc(d.id, { color: e.target.value })} />
                    </label>
                    <button
                      className={`blocs-page-act skrid-pin${d.pinned ? ' on' : ''}`}
                      title={d.pinned ? 'Désépingler' : 'Épingler en haut'}
                      onClick={() => updateDoc(d.id, { pinned: !d.pinned })}
                    >
                      📌
                    </button>
                    <button className="blocs-page-del" title="Supprimer" onClick={() => deleteDoc(d.id)}>
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {view === 'writer' && (
          <button className="blocs-side-link" onClick={() => addDoc(null)}>
            <span className="blocs-side-link-ic">＋</span> Nouveau chapitre
          </button>
          )}
          <button className="blocs-side-link" data-pop="tplsk" onClick={() => setTplOpen(true)}>
            <span className="blocs-side-link-ic">📋</span> Templates ({SKRID_TEMPLATES.length})
          </button>
          <button className="blocs-side-link" onClick={exportBook}>
            <span className="blocs-side-link-ic">📄</span> Exporter le livre en PDF
          </button>
          <div className="saved-line">
            <span className={`saved-check${savedAt ? ' on' : ''}`}>✓</span> enregistré
            {savedAt && <span className="saved-time">{relTime(savedAt)}</span>}
          </div>
          <div className="blocs-sidebar-foot">
            <ThemeButton />
          <SettingsButton appId="skrid" appName="Skrid" />
          </div>
        </aside>
      )}
      {!focus && (
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
      )}
      <main className="blocs-main skrid-main">
        {read && view === 'doc' && (
          <div className="skrid-read-bar" data-pop="skread">
            <button className="db-btn" title="Police plus petite" onClick={() => setReadSize((s) => Math.max(0.9, Math.round((s - 0.1) * 10) / 10))}>
              A−
            </button>
            <button className="db-btn" title="Police plus grande" onClick={() => setReadSize((s) => Math.min(2.2, Math.round((s + 0.1) * 10) / 10))}>
              A+
            </button>
            <button className="db-btn" title="Quitter le mode lecture (Échap)" onClick={() => setRead(false)}>
              <X size={14} />
            </button>
          </div>
        )}
        {view === 'doc' && findOpen && (
          <div className="skrid-find" data-pop="skfind">
            <input
              className="db-input"
              autoFocus
              placeholder="Rechercher… (Ctrl+F)"
              value={findQ}
              onChange={(e) => setFindQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') findGo(e.shiftKey ? -1 : 1)
                if (e.key === 'Escape') closeFind()
              }}
            />
            <span className="mono skrid-find-count">{findCount ? `${Math.min(findIdx + 1, findCount)}/${findCount}` : '0'}</span>
            <button className="tool" title="Occurrence précédente" onMouseDown={(e) => e.preventDefault()} onClick={() => findGo(-1)}>
              <ChevronUp size={14} />
            </button>
            <button className="tool" title="Occurrence suivante" onMouseDown={(e) => e.preventDefault()} onClick={() => findGo(1)}>
              <ChevronDown size={14} />
            </button>
            <input
              className="db-input"
              placeholder="Remplacer par…"
              value={repl}
              onChange={(e) => setRepl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doReplace(false)
              }}
            />
            <button className="db-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => doReplace(false)}>
              Remplacer
            </button>
            <button className="db-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => doReplace(true)}>
              Tout
            </button>
            <button className="tool" title="Fermer (Échap)" onClick={closeFind}>
              <X size={14} />
            </button>
          </div>
        )}
        {view === 'doc' && comOpen && (
          <div className="skrid-comments" data-pop="skcoms">
            <div className="tpl-head">
              <strong>Commentaires ({comCount})</strong>
              <button className="db-btn" onClick={() => setComOpen(false)}>
                ✕
              </button>
            </div>
            {Object.entries(current.comments ?? {}).map(([cid, c]) => (
              <div className="skrid-com-item" key={cid}>
                <p>{c.text}</p>
                <div className="skrid-com-meta">
                  <span className="mono">{relTime(c.at)}</span>
                  <button className="db-btn" onClick={() => comGoto(cid)}>
                    Voir
                  </button>
                  <button className="db-btn" onClick={() => deleteComment(cid)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {!comCount && <p className="mono skrid-com-empty">Sélectionne du texte puis 💬 dans la barre pour annoter.</p>}
          </div>
        )}
        {view === 'doc' && mentionOpen && (
          <div className="skrid-mention" data-pop="skmen" style={{ left: mentionPos.x, top: mentionPos.y }}>
            {mentionList.length === 0 && <div className="skrid-mention-empty mono">Aucune fiche ni mémo correspondant</div>}
            {mentionList.slice(0, 8).map((d, i) => (
              <button
                key={d.id}
                className={`skrid-mention-item${i === Math.min(mentionIdx, mentionList.length - 1) ? ' cur' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(d)}
              >
                <span>{docIcon(d)}</span>
                <span>{d.title.trim() || 'Sans titre'}</span>
                <span className="mono skrid-mention-kind">{d.kind === 'memo' ? 'mémo' : ficheTypeOf(d).label.toLowerCase()}</span>
              </button>
            ))}
          </div>
        )}
        {expOpen && (
          <div className="skrid-pop skrid-exp" data-pop="skexp">
            <button className="skrid-exp-btn" onClick={() => exportChapter('pdf')}>⬇ {kindLabel} en PDF</button>
            <button className="skrid-exp-btn" onClick={() => exportChapter('html')}>⬇ {kindLabel} en HTML</button>
            <button className="skrid-exp-btn" onClick={() => exportChapter('md')}>⬇ {kindLabel} en Markdown</button>
            <button className="skrid-exp-btn" onClick={() => exportChapter('doc')}>⬇ {kindLabel} en .doc</button>
            <div className="skrid-exp-sep" />
            <button className="skrid-exp-btn" onClick={exportBook}>⬇ Livre entier en PDF</button>
            <label className="skrid-exp-opt">
              <input
                type="checkbox"
                checked={state.pdfNumTop ?? true}
                onChange={(e) => setState((s) => (s ? { ...s, pdfNumTop: e.target.checked } : s))}
              />
              Numéros de page en haut du PDF
            </label>
            <label className="skrid-exp-opt">
              <input
                type="checkbox"
                checked={state.pdfNumBottom ?? true}
                onChange={(e) => setState((s) => (s ? { ...s, pdfNumBottom: e.target.checked } : s))}
              />
              Numéros de page en bas du PDF
            </label>
            <div className="skrid-exp-sep" />
            <label className="skrid-exp-opt">
              <input type="checkbox" checked={state.pdf?.xOfY ?? false} onChange={(e) => setPdfOpt('xOfY', e.target.checked)} />
              « Page X sur Y » en bas
            </label>
            <label className="skrid-exp-opt">
              <input type="checkbox" checked={state.pdf?.footerTitle ?? false} onChange={(e) => setPdfOpt('footerTitle', e.target.checked)} />
              Titre du livre en pied de page
            </label>
            <label className="skrid-exp-opt">
              <input type="checkbox" checked={state.pdf?.toc ?? false} onChange={(e) => setPdfOpt('toc', e.target.checked)} />
              Sommaire automatique
            </label>
            <label className="skrid-exp-opt">
              <input type="checkbox" checked={state.pdf?.pageBreak ?? false} onChange={(e) => setPdfOpt('pageBreak', e.target.checked)} />
              Saut de page avant chaque chapitre
            </label>
            <label className="skrid-exp-opt">
              <input type="checkbox" checked={state.pdf?.titlePage ?? false} onChange={(e) => setPdfOpt('titlePage', e.target.checked)} />
              Page de garde (titre du livre)
            </label>
            <label className="skrid-exp-opt">
              Format
              <select className="skrid-select skrid-exp-sel" value={state.pdf?.format ?? 'a4'} onChange={(e) => setPdfOpt('format', e.target.value)}>
                <option value="a4">A4 (210×297)</option>
                <option value="a5">A5 (148×210)</option>
                <option value="livret">Livret (2×A5 sur A4 paysage)</option>
              </select>
            </label>
            <label className="skrid-exp-opt">
              Marges
              <select
                className="skrid-select skrid-exp-sel"
                value={String(state.pdf?.margin ?? 0)}
                onChange={(e) => setPdfOpt('margin', Number(e.target.value) || undefined)}
              >
                <option value="0">par défaut</option>
                <option value="36">étroites</option>
                <option value="50">normales</option>
                <option value="70">larges</option>
              </select>
            </label>
            <label className="skrid-exp-opt">
              Police PDF
              <select className="skrid-select skrid-exp-sel" value={state.pdf?.font ?? 'sans'} onChange={(e) => setPdfOpt('font', e.target.value)}>
                <option value="sans">Sans (Helvetica)</option>
                <option value="serif">Serif (Times)</option>
                <option value="mono">Mono (Courier)</option>
              </select>
            </label>
          </div>
        )}
        {helpOpen && (
          <div className="skrid-help-ov" onClick={() => setHelpOpen(false)}>
            <div className="skrid-help" data-pop="skhelp" onClick={(e) => e.stopPropagation()}>
              <div className="tpl-head">
                <strong>Raccourcis clavier</strong>
                <button className="db-btn" onClick={() => setHelpOpen(false)}>
                  ✕
                </button>
              </div>
              <div className="skrid-help-grid">
                <span><kbd>Ctrl</kbd>+<kbd>B</kbd></span><span>gras</span>
                <span><kbd>Ctrl</kbd>+<kbd>I</kbd></span><span>italique</span>
                <span><kbd>Ctrl</kbd>+<kbd>U</kbd></span><span>souligné</span>
                <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd></span><span>annuler / rétablir</span>
                <span><kbd>Ctrl</kbd>+<kbd>F</kbd></span><span>rechercher / remplacer</span>
                <span><kbd>Échap</kbd></span><span>fermer popover, quitter le mode lecture</span>
                <span>double-clic</span><span>cocher une case de liste</span>
              </div>
            </div>
          </div>
        )}
        {tplOpen && (
          <div className="tpl-pop" data-pop="tplsk">
            <div className="tpl-head">
              <strong>Choisis un modèle de texte</strong>
              <button className="db-btn" onClick={() => setTplOpen(false)}>✕</button>
            </div>
            <div className="tpl-grid">
              {SKRID_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  className="tpl-card"
                  onClick={() => {
                    const d = createDoc(t.title)
                    d.content = t.content
                    setState((s) => (s ? { ...s, docs: [...s.docs, d], currentId: d.id } : s))
                    setTplOpen(false)
                    setView('doc')
                  }}
                >
                  <span className="tpl-icon">{t.icon}</span>
                  <span className="tpl-name">{t.name}</span>
                  <span className="db-type">{t.tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {view === 'doc' ? (
          <>
            {!read && (
            <div className="page-top">
              <div className="page-head">
                <input
                  className="blocs-title"
                  value={current.title}
                  placeholder={!current.kind || current.kind === 'chapter' ? 'Titre du chapitre' : current.kind === 'memo' ? 'Titre du mémo' : 'Nom de la fiche'}
                  onChange={(e) => updateDoc(current.id, { title: e.target.value })}
                />
                <div className="page-head-actions">
                  {!current.kind || current.kind === 'chapter' ? (
                    <>
                      <button className="page-cover-btn" title="Chapitre précédent" disabled={chapIdx <= 0} onClick={() => goChapter(-1)}>
                        ‹
                      </button>
                      <button className="mono skrid-chap-num skrid-chap-link" title="Voir le plan du livre (vue Écrivain)" onClick={() => setView('writer')}>
                        chapitre {chapIdx + 1}/{docsOrdered.length}
                      </button>
                      <button className="page-cover-btn" title="Chapitre suivant" disabled={chapIdx >= docsOrdered.length - 1} onClick={() => goChapter(1)}>
                        ›
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="skrid-dot-btn" title="Couleur">
                        <span className="skrid-dot" style={{ background: current.color ?? 'transparent', borderColor: current.color ?? 'var(--muted)' }} />
                        <input type="color" className="skrid-dot-in" defaultValue={current.color ?? '#e8b93e'} onChange={(e) => updateDoc(current.id, { color: e.target.value })} />
                      </label>
                      <span className="mono skrid-chap-num">{current.kind === 'memo' ? '🗒️ mémo' : `fiche ${ficheTypeOf(current).icon} ${ficheTypeOf(current).label.toLowerCase()}`}</span>
                    </>
                  )}
                  <button
                    className="page-cover-btn"
                    title={focus ? 'Quitter le mode focus' : 'Mode focus (sans sidebar ni barre)'}
                    onClick={() => setFocus((f) => !f)}
                  >
                    {focus ? '↔' : '🎯'}
                  </button>
                  <button className={`page-cover-btn${read ? ' active' : ''}`} title="Mode lecture (plein écran, police réglable)" onClick={() => setRead((r) => !r)}>
                    <BookOpen size={16} />
                  </button>
                  <button className={`page-cover-btn${comOpen ? ' active' : ''}`} title={`Commentaires (${comCount})`} onClick={() => setComOpen((o) => !o)}>
                    <MessageSquare size={16} />
                    {comCount > 0 && <span className="skrid-badge">{comCount}</span>}
                  </button>
                  <button className="page-cover-btn" data-pop="skexp" title="Exporter (chapitre PDF/HTML/MD/doc, livre PDF, numéros de page)" onClick={() => setExpOpen((o) => !o)}>
                    <Download size={16} />
                  </button>
                </div>
              </div>
              {current.kind !== 'fiche' && (
              <div className="skrid-toolbar-wrap">
                <div className="skrid-toolbar">
                  <button className="tool" title="Annuler (Ctrl+Z)" onMouseDown={(e) => e.preventDefault()} onClick={undo}>
                    <Undo2 size={15} />
                  </button>
                  <button className="tool" title="Rétablir (Ctrl+Y)" onMouseDown={(e) => e.preventDefault()} onClick={redo}>
                    <Redo2 size={15} />
                  </button>
                  <span className="sel-sep" />
                  <select className="skrid-select skrid-font-sel" title="Police d'écriture (polices système)" value="" onChange={(e) => e.target.value && fmtFromUi('fontName', e.target.value)}>
                    <option value="" disabled>Police…</option>
                    <option value="'Iowan Old Style', Georgia, serif" style={{ fontFamily: "'Iowan Old Style', Georgia, serif" }}>Iowan (défaut)</option>
                    <option value="Inter, system-ui, sans-serif" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Inter</option>
                    <option value="Arial, sans-serif" style={{ fontFamily: 'Arial, sans-serif' }}>Arial</option>
                    <option value="'Segoe UI', system-ui, sans-serif" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>Segoe UI</option>
                    <option value="Georgia, serif" style={{ fontFamily: 'Georgia, serif' }}>Georgia</option>
                    <option value="'Times New Roman', serif" style={{ fontFamily: "'Times New Roman', serif" }}>Times New Roman</option>
                    <option value="'Palatino Linotype', Palatino, serif" style={{ fontFamily: "'Palatino Linotype', Palatino, serif" }}>Palatino</option>
                    <option value="'Book Antiqua', Palatino, serif" style={{ fontFamily: "'Book Antiqua', Palatino, serif" }}>Book Antiqua</option>
                    <option value="Garamond, serif" style={{ fontFamily: 'Garamond, serif' }}>Garamond</option>
                    <option value="Verdana, sans-serif" style={{ fontFamily: 'Verdana, sans-serif' }}>Verdana</option>
                    <option value="Tahoma, sans-serif" style={{ fontFamily: 'Tahoma, sans-serif' }}>Tahoma</option>
                    <option value="'Trebuchet MS', sans-serif" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>Trebuchet</option>
                    <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
                    <option value="'Lucida Console', monospace" style={{ fontFamily: "'Lucida Console', monospace" }}>Lucida Console</option>
                    <option value="Impact, sans-serif" style={{ fontFamily: 'Impact, sans-serif' }}>Impact</option>
                  </select>
                  <select className="skrid-select" title="Style de bloc" value="" onChange={(e) => e.target.value && fmtFromUi('formatBlock', e.target.value)}>
                    <option value="" disabled>¶ Titre…</option>
                    <option value="p">¶ Paragraphe</option>
                    <option value="h1">H1 Titre</option>
                    <option value="h2">H2 Sous-titre</option>
                    <option value="h3">H3</option>
                    <option value="h4">H4</option>
                    <option value="blockquote">❝ Citation</option>
                    <option value="pre">{'</>'} Bloc code</option>
                  </select>
                  <select className="skrid-select" title="Interligne" value="" onChange={(e) => e.target.value && applyLineHeight(e.target.value)}>
                    <option value="" disabled>Interligne…</option>
                    <option value="1">1</option>
                    <option value="1.15">1,15</option>
                    <option value="1.5">1,5</option>
                    <option value="1.75">1,75</option>
                    <option value="2">2</option>
                    <option value="2.5">2,5</option>
                  </select>
                  <span className="sel-sep" />
                  <button className="tool" title="Gras (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('bold')}>
                    <b>B</b>
                  </button>
                  <button className="tool" title="Italique (Ctrl+I)" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('italic')}>
                    <i>I</i>
                  </button>
                  <button className="tool" title="Souligné (Ctrl+U)" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('underline')}>
                    <u>U</u>
                  </button>
                  <button className="tool" title="Barré" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('strikeThrough')}>
                    <Strikethrough size={15} />
                  </button>
                  <label className="tool skrid-color-btn" title="Couleur de la police">
                    <span className="skrid-color-a">A</span>
                    <input type="color" className="skrid-color" defaultValue="#e8e6e3" onChange={(e) => setForeColor(e.target.value)} />
                  </label>
                  <label className="tool skrid-color-btn" title="Couleur de fond du texte (surlignage)">
                    <span className="skrid-color-a skrid-hl">A</span>
                    <input type="color" className="skrid-color" defaultValue="#ffd54a" onChange={(e) => setHiliteColor(e.target.value)} />
                  </label>
                  <span className="sel-sep" />
                  <button className="tool" title="Liste à puces" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('insertUnorderedList')}>
                    <List size={15} />
                  </button>
                  <button className="tool" title="Liste numérotée" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('insertOrderedList')}>
                    <ListOrdered size={15} />
                  </button>
                  <button className="tool" title="Liste à cocher (double-clic sur une case pour la cocher)" onMouseDown={(e) => e.preventDefault()} onClick={toggleTaskList}>
                    <ListChecks size={15} />
                  </button>
                  <button
                    className="tool"
                    data-pop="sklink"
                    title="Insérer un lien"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const s = window.getSelection()
                      setLinkUrl(s && !s.isCollapsed ? String(s) : '')
                      setLinkPop((o) => !o)
                    }}
                  >
                    <Link2 size={15} />
                  </button>
                  <button className="tool" title="Supprimer le lien" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('unlink')}>
                    <Unlink2 size={15} />
                  </button>
                  <button className="tool" data-pop="sktable" title="Insérer un tableau" onMouseDown={(e) => e.preventDefault()} onClick={() => setTablePop((o) => !o)}>
                    <Table2 size={15} />
                  </button>
                  <button className="tool" title="Insérer une image" onMouseDown={(e) => e.preventDefault()} onClick={() => imgRef.current?.click()}>
                    <ImageIcon size={15} />
                  </button>
                  <span className="sel-sep" />
                  <button className="tool" title="Ligne horizontale" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('insertHorizontalRule')}>
                    <Minus size={15} />
                  </button>
                  <button className="tool" title="Augmenter le retrait" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('indent')}>
                    <IndentIncrease size={15} />
                  </button>
                  <button className="tool" title="Diminuer le retrait" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('outdent')}>
                    <IndentDecrease size={15} />
                  </button>
                  <button className="tool" title="Aligner à gauche" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('justifyLeft')}>
                    <AlignLeft size={15} />
                  </button>
                  <button className="tool" title="Centrer" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('justifyCenter')}>
                    <AlignCenter size={15} />
                  </button>
                  <button className="tool" title="Aligner à droite" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('justifyRight')}>
                    <AlignRight size={15} />
                  </button>
                  <button className="tool" title="Effacer la mise en forme" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt('removeFormat')}>
                    <Eraser size={15} />
                  </button>
                  <span className="sel-sep" />
                  <button className="tool" title="Rechercher / remplacer (Ctrl+F)" onMouseDown={(e) => e.preventDefault()} onClick={() => setFindOpen(true)}>
                    <Search size={15} />
                  </button>
                  <button className="tool" data-pop="skcom" title="Commenter la sélection" onMouseDown={(e) => e.preventDefault()} onClick={() => setComPop((o) => !o)}>
                    <MessageSquare size={15} />
                  </button>
                </div>
                {linkPop && (
                  <div className="skrid-pop" data-pop="sklink">
                    <input
                      className="db-input"
                      autoFocus
                      type="url"
                      placeholder="https://…"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') doLink()
                        if (e.key === 'Escape') setLinkPop(false)
                      }}
                    />
                    <button className="db-btn" onClick={doLink}>
                      OK
                    </button>
                  </div>
                )}
                {tablePop && (
                  <div className="skrid-pop" data-pop="sktable">
                    <input className="db-input skrid-tbl-in" autoFocus type="number" min={1} max={20} value={tRows} onChange={(e) => setTRows(e.target.value)} title="Lignes" />
                    <span className="mono">×</span>
                    <input className="db-input skrid-tbl-in" type="number" min={1} max={10} value={tCols} onChange={(e) => setTCols(e.target.value)} title="Colonnes" />
                    <button className="db-btn" onClick={doTable}>
                      Insérer
                    </button>
                  </div>
                )}
                {comPop && (
                  <div className="skrid-pop skrid-compop" data-pop="skcom">
                    <textarea
                      className="db-input skrid-comta"
                      autoFocus
                      placeholder="Ton commentaire sur la sélection…"
                      value={comText}
                      onChange={(e) => setComText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment()
                        if (e.key === 'Escape') setComPop(false)
                      }}
                    />
                    <button className="db-btn" onClick={addComment}>
                      OK
                    </button>
                  </div>
                )}
                <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImgFile} />
              </div>
              )}
            </div>
            )}
            {current.kind === 'fiche' ? (
              <div className="skrid-fiche-form">
                <div className="skrid-fiche-top">
                  <select
                    className="skrid-select"
                    title="Type de fiche"
                    value={current.ficheType ?? 'perso'}
                    onChange={(e) => updateDoc(current.id, { ficheType: e.target.value, fields: {} })}
                  >
                    {FICHE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                  <label className="skrid-dot-btn" title="Couleur de la fiche">
                    <span className="skrid-dot" style={{ background: current.color ?? 'transparent', borderColor: current.color ?? 'var(--muted)' }} />
                    <input type="color" className="skrid-dot-in" defaultValue={current.color ?? '#e8b93e'} onChange={(e) => updateDoc(current.id, { color: e.target.value })} />
                  </label>
                  <span className="mono skrid-fiche-hint">une fiche = ces champs uniquement, pas de texte libre</span>
                </div>
                {ficheTypeOf(current).fields.map((f) => {
                  const big = ['Notes', 'Histoire', 'Description', 'Texte', 'Résumé', 'Définition', 'Accroche', 'Conflit', 'Enjeu', 'Résolution possible', 'Exemples', 'Membres', 'Pouvoirs', 'Ambiance', 'But', 'Origine', 'Traits', 'Rôle', 'Source', 'Contexte'].includes(f)
                  const val = current.fields?.[f] ?? ''
                  const set = (v: string) => updateDoc(current.id, { fields: { ...(current.fields ?? {}), [f]: v } })
                  return (
                    <div className="skrid-fiche-row" key={f}>
                      <label className="skrid-fiche-lbl">{f}</label>
                      {big ? (
                        <textarea className="db-input skrid-fiche-ta" rows={3} value={val} onChange={(e) => set(e.target.value)} />
                      ) : (
                        <input className="db-input skrid-fiche-in" value={val} onChange={(e) => set(e.target.value)} />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
            <div className="skrid-sheet-col">
              <div className="skrid-ruler-h">
                {Array.from({ length: 22 }, (_, i) => (
                  <span key={i} className={`skrid-tick-h${i % 5 === 0 ? ' major' : ''}`} style={{ left: `${(i / 21) * 100}%` }}>
                    {i % 5 === 0 ? i : ''}
                  </span>
                ))}
              </div>
              <div className="skrid-sheet-row">
                <div className="skrid-ruler-v">
                  {Array.from({ length: 30 }, (_, i) => (
                    <span key={i} className={`skrid-tick-v${i % 5 === 0 ? ' major' : ''}`} style={{ top: `${(i / 29) * 100}%` }} />
                  ))}
                </div>
                <div className="skrid-sheet">
            <div
              ref={editorRef}
              className="skrid-editor"
              contentEditable
              suppressContentEditableWarning
              spellCheck
              lang="fr"
              style={read ? { fontSize: `${readSize}rem` } : undefined}
              data-placeholder={current.kind === 'memo' ? 'Écris ton mémo ici…' : 'Écris ton chapitre ici… — mise en forme complète dans la barre : polices, H1–H4, interligne, couleurs, listes, liens, tableaux, images…'}
              onInput={() => {
                saveContent()
                openMentionAtCaret()
              }}
              onKeyDown={onEditorKeyDown}
              onClick={(e) => {
                const ref = (e.target as HTMLElement).closest?.('.skrid-ref')
                if (ref) {
                  e.preventDefault()
                  const id = ref.getAttribute('data-doc')
                  if (id && state?.docs.some((d) => d.id === id)) {
                    setState((s) => (s ? { ...s, currentId: id } : s))
                    editorRef.current?.scrollTo({ top: 0 })
                  }
                }
              }}
              onBlur={saveContent}
              onDoubleClick={(e) => {
                const li = (e.target as HTMLElement).closest?.('li.task')
                if (li) {
                  li.classList.toggle('done')
                  saveContent()
                }
              }}
            />
                </div>
              </div>
            </div>
            )}
            {!read && (
            <div className="skrid-status">
              <span className="mono">
                {current.kind === 'fiche'
                  ? `${Object.values(current.fields ?? {}).filter((v) => v.trim()).length}/${ficheTypeOf(current).fields.length} champs remplis`
                  : `${words} mot${words > 1 ? 's' : ''}${target > 0 ? ` / ${target}` : ''}`}
              </span>
              {target > 0 && (
                <span className="page-progress-track" style={{ width: 120 }}>
                  <span className="page-progress-bar" style={{ width: `${Math.min(100, Math.round((words / target) * 100))}%`, display: 'block', height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
                </span>
              )}
              {current.kind !== 'fiche' && (
              <button className="db-btn skrid-target-btn" data-pop="target" onClick={() => { setTargetDraft(String(current.wordTarget ?? '')); setTargetPop((o) => !o) }}>
                🎯 objectif
              </button>
              )}
              {targetPop && (
                <div className="sync-pop skrid-target-pop" data-pop="target">
                  <input
                    className="db-input"
                    autoFocus
                    type="number"
                    placeholder="Objectif de mots…"
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateDoc(current.id, { wordTarget: Number(targetDraft) || undefined })
                        setTargetPop(false)
                      }
                      if (e.key === 'Escape') setTargetPop(false)
                    }}
                  />
                  <button
                    className="db-btn"
                    onClick={() => {
                      updateDoc(current.id, { wordTarget: Number(targetDraft) || undefined })
                      setTargetPop(false)
                    }}
                  >
                    OK
                  </button>
                </div>
              )}
              <span className="mono skrid-total">Chapitre {chapIdx + 1}/{docsOrdered.length} · livre : {totalWords} mots · {state.docs.length} chapitre{state.docs.length > 1 ? 's' : ''}</span>
              <button className="db-btn" title="Raccourcis clavier (?)" onClick={() => setHelpOpen(true)}>
                ?
              </button>
            </div>
            )}
          </>
        ) : view === 'writer' ? (
          <div className="skrid-plan">
            <div className="page-top">
              <div className="page-head">
                <input
                  className="blocs-title"
                  value={state.bookTitle}
                  placeholder="Titre du livre"
                  onChange={(e) => setState((s) => (s ? { ...s, bookTitle: e.target.value } : s))}
                />
                <div className="page-head-actions">
                  <button className="page-cover-btn" title="Exporter le livre en PDF" onClick={exportBook}>
                    📄
                  </button>
                </div>
              </div>
            </div>
            <p className="skrid-plan-hint mono">Vue Plan — {state.docs.length} chapitres, {totalWords} mots au total. ↑↓ pour réordonner, clic pour ouvrir.</p>
            <div className="plan-grid">
              {orderedDocs(state.docs).map((d) => (
                <div key={d.id} className="plan-card" onClick={() => { setState((s) => (s ? { ...s, currentId: d.id } : s)); setView('doc') }}>
                  <div className="plan-card-head">
                    <strong>{d.title.trim() || 'Sans titre'}</strong>
                    <span className="plan-card-btns" onClick={(e) => e.stopPropagation()}>
                      <button className="blocs-page-act" title="Monter" onClick={() => moveDoc(d.id, -1)}>↑</button>
                      <button className="blocs-page-act" title="Descendre" onClick={() => moveDoc(d.id, 1)}>↓</button>
                    </span>
                  </div>
                  <div className="plan-card-meta mono">
                    {wordCount(d.content)} mot{wordCount(d.content) > 1 ? 's' : ''}
                    {d.wordTarget ? ` / ${d.wordTarget}` : ''}
                  </div>
                  <p className="plan-card-preview">{stripHtml(d.content).slice(0, 120) || 'Vide…'}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="skrid-stats">
            <div className="page-top">
              <div className="page-head">
                <input
                  className="blocs-title"
                  value={state.bookTitle}
                  placeholder="Titre du livre"
                  onChange={(e) => setState((s) => (s ? { ...s, bookTitle: e.target.value } : s))}
                />
                <div className="page-head-actions">
                  <button className="page-cover-btn" title="Exporter le livre en PDF" onClick={exportBook}>
                    📄
                  </button>
                </div>
              </div>
            </div>
            <p className="skrid-plan-hint mono">
              Statistiques — {state.docs.length} chapitre{state.docs.length > 1 ? 's' : ''} · {totalWords} mots · {docsOrdered.filter((d) => d.wordTarget).length} objectif{docsOrdered.filter((d) => d.wordTarget).length > 1 ? 's' : ''} défini{docsOrdered.filter((d) => d.wordTarget).length > 1 ? 's' : ''}
            </p>
            <div className="stats-cards">
              <div className="stat-card"><span className="stat-num">{totalWords}</span><span className="stat-lbl">mots au total</span></div>
              <div className="stat-card"><span className="stat-num">{state.docs.length}</span><span className="stat-lbl">chapitres</span></div>
              <div className="stat-card"><span className="stat-num">{Math.round(totalWords / Math.max(1, state.docs.length))}</span><span className="stat-lbl">mots / chapitre (moy.)</span></div>
              <div className="stat-card"><span className="stat-num">{docsOrdered.filter((d) => d.wordTarget && wordCount(d.content) >= d.wordTarget).length}</span><span className="stat-lbl">objectifs atteints</span></div>
            </div>
            <div className="stats-bars">
              {docsOrdered.map((d) => (
                <div
                  key={d.id}
                  className="stats-row"
                  onClick={() => {
                    setState((s) => (s ? { ...s, currentId: d.id } : s))
                    setView('doc')
                  }}
                >
                  <span className="stats-name">{d.title.trim() || 'Sans titre'}</span>
                  <span className="stats-track">
                    <span className="stats-bar" style={{ width: `${Math.round((wordCount(d.content) / maxW) * 100)}%` }} />
                  </span>
                  <span className="stats-val">{wordCount(d.content)}{d.wordTarget ? ` / ${d.wordTarget}` : ''} mots</span>
                </div>
              ))}
            </div>
            <p className="skrid-plan-hint mono" style={{ marginTop: 18 }}>
              Session — {daily[todayKey()] ?? 0} mot{(daily[todayKey()] ?? 0) > 1 ? 's' : ''} aujourd'hui · {sum7} sur 7 jours · streak 🔥 {streak} jour{streak > 1 ? 's' : ''}
            </p>
            <div className="stats-cards">
              <div className="stat-card"><span className="stat-num">{daily[todayKey()] ?? 0}</span><span className="stat-lbl">mots aujourd'hui</span></div>
              <div className="stat-card"><span className="stat-num">{sum7}</span><span className="stat-lbl">mots / 7 jours</span></div>
              <div className="stat-card"><span className="stat-num">🔥 {streak}</span><span className="stat-lbl">streak (jours)</span></div>
              <div className="stat-card"><span className="stat-num">{maxD}</span><span className="stat-lbl">meilleur jour (14 j)</span></div>
            </div>
            <div className="skrid-days">
              {days14.map((d) => (
                <div className="skrid-day" key={d.key} title={`${d.full} : ${d.words} mots`}>
                  <span className="skrid-day-bar" style={{ height: `${Math.max(5, Math.round((d.words / maxD) * 100))}%` }} />
                  <span className="skrid-day-lbl">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {toast && (
          <div className="toast" key={toast.key}>
            <span>{toast.msg}</span>
            {toast.action && <button onClick={() => { setToast(null); toast.action?.() }}>Annuler</button>}
          </div>
        )}
      </main>
    </div>
  )
}
