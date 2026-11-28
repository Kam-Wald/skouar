import { useEffect, useRef, type RefObject, type WheelEvent } from 'react'
import type { PageViewport } from 'pdfjs-dist'
import { matchRect, renderTextLayer } from './pdf'
import SearchBar from './SearchBar'
import type { MargeDoc } from './store'
import type { DocViewer } from './viewer'

interface Props {
  doc: MargeDoc
  v: DocViewer
  mainRef: RefObject<HTMLElement>
}

export default function DocPages({ doc, v, mainRef }: Props) {
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const tlRefs = useRef(new Map<number, HTMLDivElement>())
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const viewportsRef = useRef(new Map<number, PageViewport>())
  const overlayRefs = useRef(new Map<number, HTMLCanvasElement>())
  const renderedRef = useRef(new Map<number, string>())
  const presentRef = useRef<HTMLCanvasElement>(null)

  const renderPage = async (p: number) => {
    const d = v.docRef.current
    if (!d) return
    const pg = await d.getPage(p)
    const vp = pg.getViewport({ scale: v.scale, rotation: v.rotation })
    viewportsRef.current.set(p, vp)
    const ov = overlayRefs.current.get(p)
    if (ov) {
      ov.width = vp.width
      ov.height = vp.height
    }
    const cv = canvasRefs.current.get(p)
    const tl = tlRefs.current.get(p)
    if (!cv) return
    cv.width = vp.width
    cv.height = vp.height
    await pg.render({ canvasContext: cv.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise
    if (tl) {
      tl.innerHTML = ''
      tl.style.width = `${vp.width}px`
      tl.style.height = `${vp.height}px`
      try {
        await renderTextLayer(pg, tl, vp)
      } catch {
        // couche texte indisponible (test) : on laisse vide
      }
    }
    drawSearch(p)
  }

  const drawSearch = (p: number) => {
    const ov = overlayRefs.current.get(p)
    const vp = viewportsRef.current.get(p)
    if (!ov || !vp) return
    const ctx = ov.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, ov.width, ov.height)
    const cache = v.getTextCache(p)
    if (!cache) return
    v.matches.forEach((m, i) => {
      if (m.page !== p || !m.items) return
      ctx.globalAlpha = i === v.mIdx ? 0.6 : 0.3
      ctx.fillStyle = i === v.mIdx ? '#ff9f43' : '#ffc46b'
      for (const idx of m.items) {
        const item = cache.items[idx]
        if (!item) continue
        const [x, y, w, h] = matchRect(vp, item)
        ctx.fillRect(x, y, w, h)
      }
    })
    ctx.globalAlpha = 1
  }

  useEffect(() => {
    renderedRef.current.forEach((_, p) => drawSearch(p))
  }, [v.matches, v.mIdx])

  useEffect(() => {
    const root = mainRef.current
    if (!root || !doc) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          const p = Number((en.target as HTMLElement).dataset.page)
          v.setPage((c) => (c === p ? c : p))
          const key = `${v.scale}:${v.rotation}`
          if (renderedRef.current.get(p) !== key) {
            renderedRef.current.set(p, key)
            void renderPage(p)
          }
        }
      },
      { root, rootMargin: '800px 0px' }
    )
    root.querySelectorAll('.marge-page').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [doc?.id, v.numPages, mainRef])

  useEffect(() => {
    const root = mainRef.current
    if (!root || !doc) return
    renderedRef.current.clear()
    root.querySelectorAll('.marge-page').forEach((el) => {
      const r = el.getBoundingClientRect()
      const rr = root.getBoundingClientRect()
      if (r.bottom > rr.top - 800 && r.top < rr.bottom + 800) {
        const p = Number((el as HTMLElement).dataset.page)
        renderedRef.current.set(p, `${v.scale}:${v.rotation}`)
        void renderPage(p)
      }
    })
  }, [v.scale, v.rotation, doc?.id])

  useEffect(() => {
    if (!v.present || !doc) return
    const cv = presentRef.current
    const d = v.docRef.current
    if (!cv || !d) return
    let alive = true
    void d.getPage(v.page).then(async (pg) => {
      const base = pg.getViewport({ scale: 1, rotation: v.rotation })
      const s = Math.min(window.innerWidth / base.width, window.innerHeight / base.height) * 0.96
      const vp = pg.getViewport({ scale: Math.max(0.3, s), rotation: v.rotation })
      if (!alive || !presentRef.current) return
      cv.width = vp.width
      cv.height = vp.height
      await pg.render({ canvasContext: cv.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise
    })
    return () => {
      alive = false
    }
  }, [v.present, v.page, v.rotation, v.scale, doc?.id])

  useEffect(() => {
    if (!doc || v.numPages === 0) return
    const t = setTimeout(() => {
      const el = pageRefs.current.get(v.page)
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
    }, 80)
    return () => clearTimeout(t)
  }, [doc?.id, v.numPages])

  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    v.zoomStep(e.deltaY < 0 ? 1 : -1)
  }

  return (
    <div
      className={`marge-pages${v.twoPages ? ' two' : ''}${v.night ? ' night' : ''}`}
      onWheel={onWheel}
    >
      {Array.from({ length: v.numPages }, (_, i) => i + 1).map((p) => (
        <div
          key={p}
          className="marge-page"
          data-page={p}
          ref={(el) => {
            if (el) pageRefs.current.set(p, el)
            else pageRefs.current.delete(p)
          }}
        >
          <canvas
            className="marge-cv"
            ref={(el) => {
              if (el) canvasRefs.current.set(p, el)
              else canvasRefs.current.delete(p)
            }}
          />
          <div
            className="marge-tl textLayer"
            ref={(el) => {
              if (el) tlRefs.current.set(p, el)
              else tlRefs.current.delete(p)
            }}
          />
          <canvas
            className="marge-overlay"
            ref={(el) => {
              if (el) overlayRefs.current.set(p, el)
              else overlayRefs.current.delete(p)
            }}
          />
        </div>
      ))}
      {v.searchOpen && <SearchBar v={v} />}
      {v.present && (
        <div className="marge-present" onClick={() => v.setPresent(false)}>
          <canvas ref={presentRef} className="marge-present-cv" />
          <div className="marge-present-hud">
            <span>
              {v.page} / {v.numPages}
            </span>
            <button className="db-btn" onClick={() => v.setPresent(false)}>
              ✕ Quitter (Échap)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
