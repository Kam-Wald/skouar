import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import ThemeButton from '../../ThemeButton'
import { useDismiss } from '../blocs/useDismiss'
import { stripHtml } from '../blocs/tree'
import { buildPdf, downloadPdf, wrap, type PdfLine } from '../blocs/pdf'
import {
  createDoc,
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
  onSelect,
  onAddChild,
  onDelete,
  onDuplicate
}: {
  docs: SkridDoc[]
  parentId: string | null
  depth: number
  currentId: string | null
  onSelect: (id: string) => void
  onAddChild: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  return (
    <>
      {docs
        .filter((d) => (d.parentId ?? null) === parentId)
        .map((d) => (
          <li key={d.id}>
            <div className="blocs-page-row" style={{ paddingLeft: depth * 20 }}>
              <span className="drag-handle" style={{ visibility: 'hidden' }}>
                ⸬
              </span>
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
                onSelect={onSelect}
                onAddChild={onAddChild}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
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
  const [toast, setToast] = useState<{ key: number; msg: string; action?: () => void } | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const pastRef = useRef<SkridState[]>([])
  const futureRef = useRef<SkridState[]>([])
  const prevRef = useRef<SkridState | null>(null)
  const lastPush = useRef(0)
  useDismiss('target', targetPop, () => setTargetPop(false))
  useDismiss('tplsk', tplOpen, () => setTplOpen(false))

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
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = state?.docs.find((d) => d.id === state.currentId) ?? null

  useEffect(() => {
    const el = editorRef.current
    if (!el || !current) return
    if (el.innerHTML === current.content) return
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
    if (el && current) updateDoc(current.id, { content: el.innerHTML })
  }

  const fmt = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    saveContent()
  }

  const onEditorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      fmt(e.key.toLowerCase())
    }
  }

  const words = current ? wordCount(current.content) : 0
  const target = current?.wordTarget ?? 0
  const totalWords = state ? orderedDocs(state.docs).reduce((a, d) => a + wordCount(d.content), 0) : 0
  const docsOrdered = state ? orderedDocs(state.docs) : []
  const maxW = Math.max(1, ...docsOrdered.map((d) => wordCount(d.content)))

  const exportBook = () => {
    if (!state) return
    const lines: PdfLine[] = [
      { text: state.bookTitle || 'Mon livre', size: 26, font: 2, indent: 0, gapBefore: 0 },
      { text: `Skrid — Skouar · ${new Date().toLocaleDateString('fr-FR')} · ${totalWords} mots`, size: 10, font: 1, indent: 0, gapBefore: 8 }
    ]
    orderedDocs(state.docs).forEach((d, i) => {
      lines.push({ text: '', size: 8, font: 1, indent: 0, gapBefore: i === 0 ? 40 : 90 })
      lines.push({ text: d.title.trim() || 'Sans titre', size: 18, font: 2, indent: 0, gapBefore: 0 })
      htmlToLines(d.content, lines)
    })
    downloadPdf(buildPdf(lines), `${(state.bookTitle || 'livre').replace(/[\\/:*?"<>|]/g, '-')}.pdf`)
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
    <div className={`blocs-app skrid-app${focus ? ' focus' : ''}`}>
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
          <div className="blocs-sidebar-scroll">
            <ul className="blocs-page-list">
              <DocTree
                docs={state.docs}
                parentId={null}
                depth={0}
                currentId={current.id}
                onSelect={(id) => setState((s) => (s ? { ...s, currentId: id } : s))}
                onAddChild={(id) => addDoc(id)}
                onDelete={deleteDoc}
                onDuplicate={duplicateDoc}
              />
            </ul>
          </div>
          <button className="blocs-side-link" onClick={() => addDoc(null)}>
            <span className="blocs-side-link-ic">＋</span> Nouveau chapitre
          </button>
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
          </div>
        </aside>
      )}
      <main className="blocs-main skrid-main">
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
            <div className="page-top">
              <div className="page-head">
                <input
                  className="blocs-title"
                  value={current.title}
                  placeholder="Titre du chapitre"
                  onChange={(e) => updateDoc(current.id, { title: e.target.value })}
                />
                <div className="page-head-actions">
                  <button
                    className="page-cover-btn"
                    title={focus ? 'Quitter le mode focus' : 'Mode focus (sans sidebar ni barre)'}
                    onClick={() => setFocus((f) => !f)}
                  >
                    {focus ? '↔' : '🎯'}
                  </button>
                  <button className="page-cover-btn" title="Exporter le livre en PDF" onClick={exportBook}>
                    📄
                  </button>
                </div>
              </div>
              <div className="skrid-toolbar">
                {(['p', 'H1', 'H2', '❝'] as const).map((f) => (
                  <button
                    key={f}
                    className="tool"
                    title={f === '❝' ? 'Citation' : f === 'p' ? 'Paragraphe' : f}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => fmt('formatBlock', f === '❝' ? 'blockquote' : f)}
                  >
                    {f === '❝' ? '❝' : f === 'p' ? '¶' : f}
                  </button>
                ))}
                <span className="sel-sep" />
                {(['b', 'i', 'u'] as const).map((f) => (
                  <button
                    key={f}
                    className="tool"
                    title={f === 'b' ? 'Gras (Ctrl+B)' : f === 'i' ? 'Italique (Ctrl+I)' : 'Souligné (Ctrl+U)'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => fmt(f)}
                  >
                    {f === 'b' ? 'B' : f === 'i' ? 'I' : 'U'}
                  </button>
                ))}
              </div>
            </div>
            <div
              ref={editorRef}
              className="skrid-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Écris ton chapitre ici… (Ctrl+B/I/U, ¶ H1 H2 ❝ dans la barre)"
              onInput={saveContent}
              onKeyDown={onEditorKeyDown}
              onBlur={saveContent}
            />
            <div className="skrid-status">
              <span className="mono">
                {words} mot{words > 1 ? 's' : ''}
                {target > 0 && ` / ${target}`}
              </span>
              {target > 0 && (
                <span className="page-progress-track" style={{ width: 120 }}>
                  <span className="page-progress-bar" style={{ width: `${Math.min(100, Math.round((words / target) * 100))}%`, display: 'block', height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
                </span>
              )}
              <button className="db-btn skrid-target-btn" data-pop="target" onClick={() => { setTargetDraft(String(current.wordTarget ?? '')); setTargetPop((o) => !o) }}>
                🎯 objectif
              </button>
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
              <span className="mono skrid-total">Livre : {totalWords} mots · {state.docs.length} chapitre{state.docs.length > 1 ? 's' : ''}</span>
            </div>
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
