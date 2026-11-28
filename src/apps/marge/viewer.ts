import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadDoc } from './pdf'
import { clampPage, clampScale, fitWidthScale } from './logic'
import { annotsMatching, cacheFromItems, findMatches, notesMatching, type SearchMatch, type TItem, type TextCache } from './search'
import { COLORS, SIGN_SIZES, TOOLS, type HistAction, type Tool } from './annot'
import {
  deleteAnnot,
  deletePageNote,
  deleteSignature,
  listAnnots,
  listPageNotes,
  listSignatures,
  putAnnot,
  putPageNote,
  putSignature,
  uid,
  updateDoc,
  type MargeAnnot,
  type MargeDoc,
  type MargePageNote,
  type MargeSignature
} from './store'

export const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export interface OutlineItem {
  title: string
  page: number
}

export function useDocViewer(doc: MargeDoc | null) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [twoPages, setTwoPages] = useState(() => localStorage.getItem('skouar:marge:2p') === '1')
  const [night, setNight] = useState(() => localStorage.getItem('skouar:marge:night') === '1')
  const [present, setPresent] = useState(false)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [annots, setAnnots] = useState<MargeAnnot[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchFilter, setSearchFilter] = useState<'doc' | 'annots' | 'all'>('all')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [mIdx, setMIdx] = useState(0)
  const textCacheRef = useRef(new Map<number, TextCache>())
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColorState] = useState(() => localStorage.getItem('skouar:marge:color') || COLORS[0])
  const [stampIdx, setStampIdx] = useState(0)
  const [textSize, setTextSize] = useState(16)
  const [signatures, setSignatures] = useState<MargeSignature[]>([])
  const [signId, setSignId] = useState<string | null>(() => localStorage.getItem('skouar:marge:sign'))
  const [hint, setHint] = useState('')
  const [pageNotes, setPageNotes] = useState<MargePageNote[]>([])
  const histRef = useRef<HistAction[]>([])
  const hIdxRef = useRef(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const reloadSignatures = useCallback(async () => {
    setSignatures(await listSignatures())
  }, [])

  useEffect(() => {
    void reloadSignatures()
  }, [reloadSignatures])

  const setActiveSign = useCallback((id: string): void => {
    localStorage.setItem('skouar:marge:sign', id)
    setSignId(id)
  }, [])

  const addSignature = useCallback(
    async (name: string, dataUrl: string) => {
      await putSignature({ id: uid(), name, dataUrl, at: Date.now() })
      await reloadSignatures()
    },
    [reloadSignatures]
  )

  const removeSignature = useCallback(
    async (id: string) => {
      await deleteSignature(id)
      if (signId === id) {
        localStorage.removeItem('skouar:marge:sign')
        setSignId(null)
      }
      await reloadSignatures()
    },
    [signId, reloadSignatures]
  )

  const [signSize, setSignSizeState] = useState(() => {
    const i = Number(localStorage.getItem('skouar:marge:signsize') ?? '1')
    return Math.min(SIGN_SIZES.length - 1, Math.max(0, Number.isFinite(i) ? i : 1))
  })

  const setSignSize = useCallback((i: number): void => {
    localStorage.setItem('skouar:marge:signsize', String(i))
    setSignSizeState(i)
  }, [])

  const setColor = useCallback((c: string) => {
    localStorage.setItem('skouar:marge:color', c)
    setColorState(c)
  }, [])

  const activeSign = useCallback((): MargeSignature | undefined => {
    return signatures.find((s) => s.id === signId) ?? signatures[0]
  }, [signatures, signId])

  const reloadAnnots = useCallback(async () => {
    if (doc) setAnnots(await listAnnots(doc.id))
  }, [doc?.id])

  const reloadPageNotes = useCallback(async () => {
    if (doc) setPageNotes(await listPageNotes(doc.id))
  }, [doc?.id])

  const syncHist = (): void => {
    setCanUndo(hIdxRef.current > 0)
    setCanRedo(hIdxRef.current < histRef.current.length)
  }

  const pushHist = useCallback((a: HistAction): void => {
    if (histRef.current.length >= 100) {
      histRef.current.shift()
      hIdxRef.current = Math.max(0, hIdxRef.current - 1)
    }
    histRef.current = histRef.current.slice(0, hIdxRef.current).concat([a])
    hIdxRef.current = histRef.current.length
    syncHist()
  }, [])

  const undo = useCallback(async () => {
    if (hIdxRef.current <= 0) return
    hIdxRef.current -= 1
    const a = histRef.current[hIdxRef.current]
    if (a.kind === 'add' && a.after) await deleteAnnot(a.after.id)
    else if (a.before) await putAnnot(a.before)
    await reloadAnnots()
    syncHist()
  }, [reloadAnnots])

  const redo = useCallback(async () => {
    if (hIdxRef.current >= histRef.current.length) return
    const a = histRef.current[hIdxRef.current]
    hIdxRef.current += 1
    if (a.kind === 'delete' && a.before) await deleteAnnot(a.before.id)
    else if (a.after) await putAnnot(a.after)
    await reloadAnnots()
    syncHist()
  }, [reloadAnnots])

  const removeAnnot = useCallback(
    async (id: string) => {
      const before = annots.find((a) => a.id === id)
      await deleteAnnot(id)
      if (before) pushHist({ kind: 'delete', before })
      await reloadAnnots()
    },
    [annots, pushHist, reloadAnnots]
  )

  const savePageNote = useCallback(
    async (page: number, text: string) => {
      if (!doc) return
      const t = text.trim()
      const ex = pageNotes.find((n) => n.page === page)
      if (!t) {
        if (ex) {
          await deletePageNote(ex.id)
          await reloadPageNotes()
        }
        return
      }
      if (ex) await putPageNote({ ...ex, text: t, at: Date.now() })
      else await putPageNote({ id: uid(), docId: doc.id, page, text: t, at: Date.now() })
      await reloadPageNotes()
    },
    [doc?.id, pageNotes, reloadPageNotes]
  )

  const removePageNote = useCallback(
    async (id: string) => {
      await deletePageNote(id)
      await reloadPageNotes()
    },
    [reloadPageNotes]
  )

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(''), 3500)
    return () => clearTimeout(t)
  }, [hint])

  useEffect(() => {
    let alive = true
    if (!doc) {
      docRef.current = null
      setNumPages(0)
      setOutline([])
      setAnnots([])
      setPageNotes([])
      setMatches([])
      setSearchOpen(false)
      histRef.current = []
      hIdxRef.current = 0
      setCanUndo(false)
      setCanRedo(false)
      return
    }
    void doc.data.arrayBuffer().then(async (buf) => {
      if (!alive) return
      const d = await loadDoc(buf)
      if (!alive) {
        await d.destroy()
        return
      }
      docRef.current = d
      setNumPages(d.numPages)
      setRotation(doc.rotation ?? 0)
      setPage(clampPage(doc.lastPage ?? 1, d.numPages))
      setOutline([])
      textCacheRef.current.clear()
      setAnnots(await listAnnots(doc.id))
      setPageNotes(await listPageNotes(doc.id))
      histRef.current = []
      hIdxRef.current = 0
      syncHist()
      try {
        const ol = await d.getOutline()
        if (ol) {
          const items: OutlineItem[] = []
          for (const it of ol) {
            if (!it.dest || typeof it.dest !== 'string') continue
            try {
              const dest = await d.getDestination(it.dest)
              if (dest && dest[0]) {
                const idx = await d.getPageIndex(dest[0])
                items.push({ title: it.title, page: idx + 1 })
              }
            } catch {
              // destination illisible : on saute
            }
          }
          if (alive) setOutline(items)
        }
      } catch {
        // pas de sommaire
      }
    })
    return () => {
      alive = false
      if (docRef.current) {
        void docRef.current.destroy()
        docRef.current = null
      }
    }
  }, [doc?.id])

  useEffect(() => {
    if (!doc) return
    const t = setTimeout(() => {
      void updateDoc(doc.id, { lastPage: page })
    }, 800)
    return () => clearTimeout(t)
  }, [page, doc?.id])

  const gotoPage = useCallback(
    (n: number) => {
      setPage((cur) => {
        const p = clampPage(n, numPages || 1)
        return p === cur ? cur : p
      })
    },
    [numPages]
  )

  const zoomTo = useCallback((s: number) => setScale(clampScale(s)), [])
  const zoomStep = useCallback(
    (dir: 1 | -1) => setScale((s) => clampScale(s * (dir > 0 ? 1.25 : 0.8))),
    []
  )
  const fitWidth = useCallback((rootWidth: number) => {
    const d = docRef.current
    if (!d) return
    void d.getPage(1).then((p) => {
      const base = p.getViewport({ scale: 1 }).width
      setScale(fitWidthScale(rootWidth, base))
    })
  }, [])

  const rotate = useCallback(
    (dir: 90 | 270) => {
      setRotation((r) => {
        const nr = (r + dir) % 360
        if (doc) void updateDoc(doc.id, { rotation: nr })
        return nr
      })
    },
    [doc]
  )

  const toggleTwoPages = useCallback(() => {
    setTwoPages((v) => {
      localStorage.setItem('skouar:marge:2p', v ? '0' : '1')
      return !v
    })
  }, [])

  const toggleNight = useCallback(() => {
    setNight((v) => {
      localStorage.setItem('skouar:marge:night', v ? '0' : '1')
      return !v
    })
  }, [])

  const runSearch = useCallback(async () => {
    const d = docRef.current
    const q = searchQ.trim()
    if (!d || !q) {
      setMatches([])
      setMIdx(0)
      return
    }
    const out: SearchMatch[] = []
    if (searchFilter !== 'annots') {
      for (let p = 1; p <= d.numPages; p++) {
        let cache = textCacheRef.current.get(p)
        if (!cache) {
          const pg = await d.getPage(p)
          const tc = await pg.getTextContent()
          cache = cacheFromItems(tc.items as unknown as TItem[])
          textCacheRef.current.set(p, cache)
        }
        for (const m of findMatches(cache, q)) out.push({ page: p, items: m.items })
      }
    }
    if (searchFilter !== 'doc') {
      for (const a of annotsMatching(annots, q)) out.push({ page: a.page, annotId: a.id })
      for (const n of notesMatching(pageNotes, q)) out.push({ page: n.page, annotId: n.id })
    }
    out.sort((a, b) => a.page - b.page)
    setMatches(out)
    setMIdx(0)
    if (out.length) gotoPage(out[0].page)
  }, [searchQ, searchFilter, annots, pageNotes, gotoPage])

  useEffect(() => {
    if (!searchOpen || !doc) return
    const t = setTimeout(() => void runSearch(), 250)
    return () => clearTimeout(t)
  }, [searchQ, searchOpen, searchFilter, runSearch, doc?.id])

  const stepMatch = useCallback(
    (dir: -1 | 1) => {
      setMatches((ms) => {
        if (!ms.length) return ms
        const idx = (mIdx + dir + ms.length) % ms.length
        setMIdx(idx)
        gotoPage(ms[idx].page)
        return ms
      })
    },
    [mIdx, gotoPage]
  )

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setMatches([])
    setMIdx(0)
  }, [])

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) void redo()
        else void undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        void redo()
        return
      }
      if (e.key === 'Escape') {
        if (searchOpen) {
          e.preventDefault()
          closeSearch()
          return
        }
        if (present) {
          e.preventDefault()
          setPresent(false)
        }
        return
      }
      if (searchOpen && e.key === 'Enter') {
        e.preventDefault()
        stepMatch(e.shiftKey ? -1 : 1)
        return
      }
      const toolKey = TOOLS.find((t) => t.key === e.key)
      if (toolKey && !present) {
        e.preventDefault()
        setTool(toolKey.id)
        return
      }
      if (present) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault()
          gotoPage(page + 1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault()
          gotoPage(page - 1)
        }
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        gotoPage(page + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        gotoPage(page - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        gotoPage(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        gotoPage(numPages)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomStep(1)
      } else if (e.key === '-') {
        e.preventDefault()
        zoomStep(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, page, numPages, present, searchOpen, gotoPage, zoomStep, stepMatch, closeSearch, undo, redo])

  return {
    docRef,
    numPages,
    page,
    setPage,
    gotoPage,
    scale,
    setScale,
    zoomTo,
    zoomStep,
    fitWidth,
    rotation,
    rotate,
    twoPages,
    toggleTwoPages,
    night,
    toggleNight,
    present,
    setPresent,
    outline,
    annots,
    searchOpen,
    setSearchOpen,
    searchQ,
    setSearchQ,
    searchFilter,
    setSearchFilter,
    matches,
    mIdx,
    stepMatch,
    closeSearch,
    getTextCache: (p: number) => textCacheRef.current.get(p),
    tool,
    setTool,
    color,
    setColor,
    stampIdx,
    setStampIdx,
    textSize,
    setTextSize,
    signatures,
    activeSign,
    reloadSignatures,
    setActiveSign,
    addSignature,
    removeSignature,
    signSize,
    setSignSize,
    reloadAnnots,
    pageNotes,
    reloadPageNotes,
    savePageNote,
    removePageNote,
    pushHist,
    undo,
    redo,
    canUndo,
    canRedo,
    removeAnnot,
    hint,
    setHint
  }
}

export type DocViewer = ReturnType<typeof useDocViewer>
