import { useEffect, useRef, useState, type RefObject, type WheelEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { PageViewport } from 'pdfjs-dist'
import { matchRect, renderTextLayer } from './pdf'
import SearchBar from './SearchBar'
import { mergeRectsByLine, normRect, STAMPS, TEXT_SIZES, type Tool } from './annot'
import { useDismiss } from '../../shared/useDismiss'
import { deleteAnnot, putAnnot, uid, type MargeAnnot } from './store'
import type { MargeDoc } from './store'
import type { DocViewer } from './viewer'

interface Props {
  doc: MargeDoc
  v: DocViewer
  mainRef: RefObject<HTMLElement>
}

interface EditPop {
  cx: number
  cy: number
  page: number
  pdfX: number
  pdfY: number
  id?: string
  kind: 'note' | 'text'
  text: string
  size: number
}

type Temp = { x0: number; y0: number; x: number; y: number; pts: [number, number][]; type: Tool }

export default function DocPages({ doc, v, mainRef }: Props) {
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const tlRefs = useRef(new Map<number, HTMLDivElement>())
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const overlayRefs = useRef(new Map<number, HTMLCanvasElement>())
  const viewportsRef = useRef(new Map<number, PageViewport>())
  const renderedRef = useRef(new Map<number, string>())
  const presentRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ p: number; type: Tool; x0: number; y0: number; x: number; y: number; pts: [number, number][] } | null>(null)
  const [editPop, setEditPop] = useState<EditPop | null>(null)
  useDismiss('margeannot', !!editPop, () => setEditPop(null))

  const redraw = (p: number, temp?: Temp) => {
    const ov = overlayRefs.current.get(p)
    const vp = viewportsRef.current.get(p)
    if (!ov || !vp) return
    const ctx = ov.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, ov.width, ov.height)
    const cache = v.getTextCache(p)
    if (cache) {
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
    for (const a of v.annots) {
      if (a.page !== p) continue
      if (a.type === 'hl') {
        const rects = a.rects ?? (a.x !== undefined && a.w !== undefined ? [[a.x, a.y ?? 0, a.w, a.h ?? 0]] : [])
        ctx.globalAlpha = 0.4
        ctx.fillStyle = a.color
        for (const [x, y, w, h] of rects) {
          const [x1, y1] = vp.convertToViewportPoint(x, y)
          const [x2, y2] = vp.convertToViewportPoint(x + w, y + h)
          ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
        }
        ctx.globalAlpha = 1
      } else if (a.type === 'ink' && a.points && a.points.length > 1) {
        ctx.strokeStyle = a.color
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.beginPath()
        a.points.forEach(([px, py], i) => {
          const [vx, vy] = vp.convertToViewportPoint(px, py)
          if (i === 0) ctx.moveTo(vx, vy)
          else ctx.lineTo(vx, vy)
        })
        ctx.stroke()
      } else if (a.type === 'arrow' && a.x !== undefined && a.x2 !== undefined) {
        const [vx1, vy1] = vp.convertToViewportPoint(a.x, a.y ?? 0)
        const [vx2, vy2] = vp.convertToViewportPoint(a.x2, a.y2 ?? 0)
        ctx.strokeStyle = a.color
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(vx1, vy1)
        ctx.lineTo(vx2, vy2)
        const ang = Math.atan2(vy2 - vy1, vx2 - vx1)
        for (const da of [2.6, -2.6]) {
          ctx.moveTo(vx2, vy2)
          ctx.lineTo(vx2 - 12 * Math.cos(ang + da), vy2 - 12 * Math.sin(ang + da))
        }
        ctx.stroke()
      } else if (a.type === 'circle' && a.x !== undefined && a.w !== undefined) {
        const [cx, cy] = vp.convertToViewportPoint(a.x + a.w / 2, (a.y ?? 0) + (a.h ?? 0) / 2)
        ctx.strokeStyle = a.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, (a.w * vp.scale) / 2, ((a.h ?? 0) * vp.scale) / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    if (temp) {
      ctx.strokeStyle = v.color
      ctx.fillStyle = v.color
      if (temp.type === 'hl' || temp.type === 'circle') {
        const [x, y, w, h] = normRect(temp.x0, temp.y0, temp.x, temp.y)
        if (temp.type === 'hl') {
          ctx.globalAlpha = 0.4
          ctx.fillRect(x, y, w, h)
          ctx.globalAlpha = 1
        } else {
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else if (temp.type === 'arrow') {
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(temp.x0, temp.y0)
        ctx.lineTo(temp.x, temp.y)
        const ang = Math.atan2(temp.y - temp.y0, temp.x - temp.x0)
        for (const da of [2.6, -2.6]) {
          ctx.moveTo(temp.x, temp.y)
          ctx.lineTo(temp.x - 12 * Math.cos(ang + da), temp.y - 12 * Math.sin(ang + da))
        }
        ctx.stroke()
      } else if (temp.pts.length > 1) {
        ctx.lineWidth = 2
        ctx.beginPath()
        temp.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.stroke()
      }
    }
  }

  const renderPage = async (p: number) => {
    const d = v.docRef.current
    if (!d) return
    const pg = await d.getPage(p)
    const vp = pg.getViewport({ scale: v.scale, rotation: v.rotation })
    viewportsRef.current.set(p, vp)
    const cv = canvasRefs.current.get(p)
    const tl = tlRefs.current.get(p)
    const ov = overlayRefs.current.get(p)
    if (!cv) return
    cv.width = vp.width
    cv.height = vp.height
    if (ov) {
      ov.width = vp.width
      ov.height = vp.height
    }
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
    redraw(p)
  }

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
  }, [v.scale, v.rotation, doc?.id, v.numPages])

  useEffect(() => {
    renderedRef.current.forEach((_, p) => redraw(p))
  }, [v.annots, v.matches, v.mIdx, v.color])

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

  const evtPos = (e: { clientX: number; clientY: number }, p: number) => {
    const ov = overlayRefs.current.get(p)
    const r = ov?.getBoundingClientRect()
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
  }

  const mk = async (a: MargeAnnot) => {
    await putAnnot(a)
    await v.reloadAnnots()
    redraw(a.page)
  }

  const onOverlayDown = (e: ReactMouseEvent, p: number) => {
    const vp = viewportsRef.current.get(p)
    if (!vp) return
    const { x, y } = evtPos(e, p)
    if (v.tool === 'note' || v.tool === 'text') {
      const [px, py] = vp.convertToPdfPoint(x, y)
      setEditPop({ cx: e.clientX, cy: e.clientY, page: p, pdfX: px, pdfY: py, kind: v.tool, text: '', size: v.textSize })
      return
    }
    if (v.tool === 'stamp') {
      const [px, py] = vp.convertToPdfPoint(x, y)
      void mk({ id: uid(), docId: doc.id, page: p, type: 'stamp', x: px, y: py, color: v.color, text: STAMPS[v.stampIdx], at: Date.now() })
      return
    }
    if (v.tool === 'sign') {
      const s = v.activeSign()
      if (!s) {
        v.setHint('Crée d’abord ta signature ✍️ (carnet de signatures, étape suivante)')
        return
      }
      const [px, py] = vp.convertToPdfPoint(x, y)
      void mk({ id: uid(), docId: doc.id, page: p, type: 'sign', x: px, y: py, w: 160, h: 64, color: '#000000', dataUrl: s.dataUrl, at: Date.now() })
      return
    }
    if (v.tool === 'select') return
    e.preventDefault()
    drawing.current = { p, type: v.tool, x0: x, y0: y, x, y, pts: [[x, y]] }
  }

  const onOverlayMove = (e: ReactMouseEvent, p: number) => {
    const d = drawing.current
    if (!d || d.p !== p) return
    const { x, y } = evtPos(e, p)
    d.x = x
    d.y = y
    if (d.type === 'ink') d.pts.push([x, y])
    redraw(p, { x0: d.x0, y0: d.y0, x, y, pts: d.pts, type: d.type })
  }

  const onOverlayUp = (e: ReactMouseEvent, p: number) => {
    const d = drawing.current
    if (!d || d.p !== p) return
    drawing.current = null
    const vp = viewportsRef.current.get(p)
    if (!vp) return
    const { x, y } = evtPos(e, p)
    if (d.type === 'hl' || d.type === 'circle') {
      const [nx, ny, w, h] = normRect(d.x0, d.y0, x, y)
      if (w < 4 || h < 4) {
        redraw(p)
        return
      }
      const [ax, ay] = vp.convertToPdfPoint(nx, ny + h)
      const [bx, by] = vp.convertToPdfPoint(nx + w, ny)
      void mk({ id: uid(), docId: doc.id, page: p, type: d.type, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), color: v.color, at: Date.now() })
    } else if (d.type === 'arrow') {
      const [ax, ay] = vp.convertToPdfPoint(d.x0, d.y0)
      const [bx, by] = vp.convertToPdfPoint(x, y)
      void mk({ id: uid(), docId: doc.id, page: p, type: 'arrow', x: ax, y: ay, x2: bx, y2: by, color: v.color, at: Date.now() })
    } else if (d.type === 'ink') {
      if (d.pts.length < 2) {
        redraw(p)
        return
      }
      const pts = d.pts.map(([sx, sy]) => vp.convertToPdfPoint(sx, sy) as [number, number])
      void mk({ id: uid(), docId: doc.id, page: p, type: 'ink', points: pts, color: v.color, at: Date.now() })
    }
  }

  const onPageMouseUp = (p: number) => {
    if (v.tool !== 'select') return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
    const tl = tlRefs.current.get(p)
    const wrap = pageRefs.current.get(p)
    const vp = viewportsRef.current.get(p)
    if (!tl || !wrap || !vp || !sel.anchorNode || !tl.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)
    const wrapR = wrap.getBoundingClientRect()
    const raw: [number, number, number, number][] = []
    for (const s of Array.from(tl.querySelectorAll('span'))) {
      if (!range.intersectsNode(s)) continue
      const r = s.getBoundingClientRect()
      const sx = r.left - wrapR.left
      const sy = r.top - wrapR.top
      const [ax, ay] = vp.convertToPdfPoint(sx, sy + r.height)
      const [bx, by] = vp.convertToPdfPoint(sx + r.width, sy)
      raw.push([Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)])
    }
    if (raw.length) {
      const rects = mergeRectsByLine(raw)
      void mk({ id: uid(), docId: doc.id, page: p, type: 'hl', rects, color: v.color, at: Date.now() })
    }
    sel.removeAllRanges()
  }

  const saveEdit = async () => {
    if (!editPop) return
    await mk({
      id: editPop.id ?? uid(),
      docId: doc.id,
      page: editPop.page,
      type: editPop.kind,
      x: editPop.pdfX,
      y: editPop.pdfY,
      color: v.color,
      text: editPop.text.trim() || (editPop.kind === 'note' ? '…' : ''),
      size: editPop.kind === 'text' ? editPop.size : undefined,
      at: Date.now()
    })
    setEditPop(null)
  }

  const removeAnnot = async (id: string, pageN: number) => {
    await deleteAnnot(id)
    await v.reloadAnnots()
    redraw(pageN)
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
          onMouseUp={() => onPageMouseUp(p)}
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
            style={{ pointerEvents: v.tool === 'select' ? 'none' : 'auto' }}
            ref={(el) => {
              if (el) overlayRefs.current.set(p, el)
              else overlayRefs.current.delete(p)
            }}
            onMouseDown={(e) => onOverlayDown(e, p)}
            onMouseMove={(e) => onOverlayMove(e, p)}
            onMouseUp={(e) => void onOverlayUp(e, p)}
          />
          {v.annots
            .filter((a) => a.page === p && (a.type === 'note' || a.type === 'text' || a.type === 'stamp' || a.type === 'sign'))
            .map((a) => {
              const vp = viewportsRef.current.get(p)
              if (!vp) return null
              const [x, y] = vp.convertToViewportPoint(a.x ?? 0, a.y ?? 0)
              if (a.type === 'sign') {
                return (
                  <img
                    key={a.id}
                    src={a.dataUrl}
                    alt="signature"
                    className="marge-asign"
                    style={{ left: x, top: y - (a.h ?? 64) * vp.scale, width: (a.w ?? 160) * vp.scale }}
                    draggable={false}
                  />
                )
              }
              if (a.type === 'stamp') {
                return (
                  <button
                    key={a.id}
                    className="marge-astamp"
                    style={{ left: x, top: y - 20 * vp.scale, fontSize: 22 * vp.scale }}
                    title="Cliquer pour supprimer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      void removeAnnot(a.id, p)
                    }}
                  >
                    {a.text}
                  </button>
                )
              }
              const isNote = a.type === 'note'
              return (
                <button
                  key={a.id}
                  className={isNote ? 'marge-anote' : 'marge-atext'}
                  style={
                    isNote
                      ? { left: x - 9, top: y - 9, background: a.color }
                      : { left: x, top: y - (a.size ?? 16) * vp.scale, fontSize: (a.size ?? 16) * vp.scale, color: a.color }
                  }
                  title={a.text}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditPop({ cx: e.clientX, cy: e.clientY, page: p, pdfX: a.x ?? 0, pdfY: a.y ?? 0, id: a.id, kind: isNote ? 'note' : 'text', text: a.text ?? '', size: a.size ?? 16 })
                  }}
                >
                  {isNote ? '📝' : <span>{a.text}</span>}
                </button>
              )
            })}
        </div>
      ))}
      {v.searchOpen && <SearchBar v={v} />}
      {v.hint && <div className="marge-hint">{v.hint}</div>}
      {editPop && (
        <div
          className="marge-note-pop"
          data-pop="margeannot"
          style={{ position: 'fixed', left: Math.max(8, Math.min(editPop.cx, window.innerWidth - 320)), top: Math.max(8, Math.min(editPop.cy, window.innerHeight - 180)) }}
        >
          <textarea
            className="db-input marge-note-ta"
            autoFocus
            placeholder={editPop.kind === 'note' ? 'Ta note…' : 'Ton texte…'}
            value={editPop.text}
            onChange={(e) => setEditPop((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveEdit()
              if (e.key === 'Escape') setEditPop(null)
            }}
          />
          {editPop.kind === 'text' && (
            <select
              className="db-input"
              value={editPop.size}
              onChange={(e) => setEditPop((prev) => (prev ? { ...prev, size: Number(e.target.value) } : prev))}
            >
              {TEXT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          )}
          <button className="db-btn" onClick={() => void saveEdit()}>
            OK
          </button>
        </div>
      )}
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
