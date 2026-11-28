import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadDoc } from './pdf'
import { clampPage, clampScale, fitWidthScale } from './logic'
import { updateDoc, type MargeDoc } from './store'

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
  const docRef = useRef<PDFDocumentProxy | null>(null)

  useEffect(() => {
    let alive = true
    if (!doc) {
      docRef.current = null
      setNumPages(0)
      setOutline([])
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

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Escape') {
        if (present) {
          e.preventDefault()
          setPresent(false)
        }
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
  }, [doc, page, numPages, present, gotoPage, zoomStep])

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
    outline
  }
}

export type DocViewer = ReturnType<typeof useDocViewer>
