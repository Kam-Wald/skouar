import { useEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react'
import { Link } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument, rgb } from 'pdf-lib'
import ThemeButton from '../../ThemeButton'
import { useDismiss } from '../blocs/useDismiss'
import {
  addFile,
  deleteAnnot,
  deleteFile,
  listAnnots,
  listFiles,
  putAnnot,
  restoreFile,
  updateFile,
  uid,
  db,
  type LerAnnot,
  type LerFile
} from './store'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const BASE = import.meta.env.BASE_URL
const CMAPS = `${BASE}pdfjs/cmaps/`
const FONTS = `${BASE}pdfjs/standard_fonts/`

type Tool = 'hl' | 'ink' | 'note'
const COLORS = ['#ffd54a', '#7ee081', '#7ec8ff', '#ff9ecb']
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(ts).toLocaleDateString('fr-FR')
}

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '-')
}

async function loadDoc(buf: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data: new Uint8Array(buf.slice(0)),
    cMapUrl: CMAPS,
    cMapPacked: true,
    standardFontDataUrl: FONTS
  }).promise
}

function PdfThumb({ file, width = 120 }: { file: LerFile; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    void file.data.arrayBuffer().then(async (buf) => {
      const d = await loadDoc(buf)
      const p = await d.getPage(1)
      const base = p.getViewport({ scale: 1 }).width
      const vp = p.getViewport({ scale: width / base })
      const c = ref.current
      if (!c || !alive) return
      c.width = vp.width
      c.height = vp.height
      await p.render({ canvasContext: c.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise
      await d.destroy()
    })
    return () => {
      alive = false
    }
  }, [file.id, width])
  return <canvas ref={ref} className="ler-thumb-cv" />
}

export default function LerApp() {
  const [files, setFiles] = useState<LerFile[]>([])
  const [view, setView] = useState<'lib' | 'view'>('lib')
  const [cur, setCur] = useState<LerFile | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [tool, setTool] = useState<Tool>('hl')
  const [color, setColor] = useState(COLORS[0])
  const [annots, setAnnots] = useState<LerAnnot[]>([])
  const [notePop, setNotePop] = useState<{ cx: number; cy: number; page: number; pdfX: number; pdfY: number; id?: string } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [toast, setToast] = useState<{ key: number; msg: string; action?: () => void } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem('skouar:sidebarW'))
    return Number.isFinite(v) && v >= 180 && v <= 440 ? v : 240
  })
  const [dragOver, setDragOver] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const overlayRefs = useRef(new Map<number, HTMLCanvasElement>())
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const viewportsRef = useRef(new Map<number, pdfjsLib.PageViewport>())
  const renderedRef = useRef(new Map<number, number>())
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const scaleRef = useRef(1)
  const annotsRef = useRef<LerAnnot[]>([])
  const drawing = useRef<{ p: number; type: Tool; x0: number; y0: number; x: number; y: number; pts: [number, number][] } | null>(null)
  useDismiss('lernote', !!notePop, () => setNotePop(null))

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])
  useEffect(() => {
    annotsRef.current = annots
  }, [annots])

  useEffect(() => {
    void listFiles().then(setFiles)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!cur || view !== 'view') return
    const t = setTimeout(() => {
      void db.pdfs.update(cur.id, { lastPage: page, updatedAt: Date.now() })
    }, 800)
    return () => clearTimeout(t)
  }, [page, cur, view])

  const openFile = async (f: LerFile) => {
    if (docRef.current) {
      await docRef.current.destroy()
      docRef.current = null
    }
    const buf = await f.data.arrayBuffer()
    const d = await loadDoc(buf)
    docRef.current = d
    setCur(f)
    setNumPages(d.numPages)
    setPage(f.lastPage ?? 1)
    setAnnots(await listAnnots(f.id))
    renderedRef.current.clear()
    viewportsRef.current.clear()
    setView('view')
    setTimeout(() => {
      const el = pageRefs.current.get(f.lastPage ?? 1)
      el?.scrollIntoView({ block: 'start' })
    }, 60)
  }

  const closeFile = async () => {
    if (docRef.current) {
      await docRef.current.destroy()
      docRef.current = null
    }
    setCur(null)
    setAnnots([])
    setView('lib')
    void listFiles().then(setFiles)
  }

  const importFiles = async (list: File[]) => {
    let n = 0
    for (const f of list) {
      if (!f.name.toLowerCase().endsWith('.pdf') && !f.type.includes('pdf')) continue
      const buf = await f.arrayBuffer()
      const d = await loadDoc(buf)
      const pages = d.numPages
      await d.destroy()
      await addFile({ id: uid(), title: f.name.replace(/\.pdf$/i, ''), data: new Blob([buf], { type: 'application/pdf' }), pages, updatedAt: Date.now() })
      n++
    }
    if (n) {
      setFiles(await listFiles())
      setToast({ key: Date.now(), msg: `${n} PDF importé${n > 1 ? 's' : ''} 📥` })
    }
  }

  const drawOverlay = (p: number, temp?: { x0: number; y0: number; x: number; y: number; pts: [number, number][]; type: Tool }) => {
    const vp = viewportsRef.current.get(p)
    const ov = overlayRefs.current.get(p)
    if (!vp || !ov) return
    const ctx = ov.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, ov.width, ov.height)
    for (const a of annotsRef.current) {
      if (a.page !== p) continue
      if (a.type === 'hl' && a.x !== undefined && a.w !== undefined) {
        const [x1, y1] = vp.convertToViewportPoint(a.x, a.y ?? 0)
        const [x2, y2] = vp.convertToViewportPoint(a.x + a.w, (a.y ?? 0) + (a.h ?? 0))
        ctx.globalAlpha = 0.4
        ctx.fillStyle = a.color
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
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
      }
    }
    if (temp) {
      ctx.strokeStyle = color
      ctx.fillStyle = color
      if (temp.type === 'hl') {
        ctx.globalAlpha = 0.4
        ctx.fillRect(Math.min(temp.x0, temp.x), Math.min(temp.y0, temp.y), Math.abs(temp.x - temp.x0), Math.abs(temp.y - temp.y0))
        ctx.globalAlpha = 1
      } else if (temp.pts.length > 1) {
        ctx.lineWidth = 2
        ctx.beginPath()
        temp.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.stroke()
      }
    }
  }

  const renderPage = async (p: number) => {
    const d = docRef.current
    if (!d) return
    const pg = await d.getPage(p)
    const vp = pg.getViewport({ scale: scaleRef.current })
    viewportsRef.current.set(p, vp)
    const cv = canvasRefs.current.get(p)
    const ov = overlayRefs.current.get(p)
    if (!cv || !ov) return
    cv.width = vp.width
    cv.height = vp.height
    ov.width = vp.width
    ov.height = vp.height
    await pg.render({ canvasContext: cv.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise
    drawOverlay(p)
  }

  useEffect(() => {
    if (view !== 'view' || !cur) return
    const root = mainRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          const p = Number((en.target as HTMLElement).dataset.page)
          setPage((c) => (c === p ? c : p))
          if (renderedRef.current.get(p) !== scaleRef.current) {
            renderedRef.current.set(p, scaleRef.current)
            void renderPage(p)
          }
        }
      },
      { root, rootMargin: '800px 0px' }
    )
    root.querySelectorAll('.ler-page').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [view, cur?.id, numPages])

  useEffect(() => {
    if (view !== 'view' || !cur) return
    const root = mainRef.current
    if (!root) return
    renderedRef.current.clear()
    root.querySelectorAll('.ler-page').forEach((el) => {
      const r = el.getBoundingClientRect()
      const rr = root.getBoundingClientRect()
      if (r.bottom > rr.top - 800 && r.top < rr.bottom + 800) {
        const p = Number((el as HTMLElement).dataset.page)
        renderedRef.current.set(p, scale)
        void renderPage(p)
      }
    })
  }, [scale, view, cur?.id])

  const evtPos = (e: { clientX: number; clientY: number }, p: number) => {
    const ov = overlayRefs.current.get(p)
    const r = ov?.getBoundingClientRect()
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
  }

  const onOverlayDown = (e: React.MouseEvent, p: number) => {
    if (!cur) return
    const vp = viewportsRef.current.get(p)
    if (!vp) return
    const { x, y } = evtPos(e, p)
    if (tool === 'note') {
      const [px, py] = vp.convertToPdfPoint(x, y)
      setNoteText('')
      setNotePop({ cx: e.clientX, cy: e.clientY, page: p, pdfX: px, pdfY: py })
      return
    }
    e.preventDefault()
    drawing.current = { p, type: tool, x0: x, y0: y, x, y, pts: [[x, y]] }
  }

  const onOverlayMove = (e: React.MouseEvent, p: number) => {
    const d = drawing.current
    if (!d || d.p !== p) return
    const { x, y } = evtPos(e, p)
    d.x = x
    d.y = y
    if (d.type === 'ink') d.pts.push([x, y])
    drawOverlay(p, { x0: d.x0, y0: d.y0, x, y, pts: d.pts, type: d.type })
  }

  const onOverlayUp = async (e: React.MouseEvent, p: number) => {
    const d = drawing.current
    if (!d || d.p !== p || !cur) return
    drawing.current = null
    const vp = viewportsRef.current.get(p)
    if (!vp) return
    const { x, y } = evtPos(e, p)
    if (d.type === 'hl') {
      const w = Math.abs(x - d.x0)
      const h = Math.abs(y - d.y0)
      if (w < 4 || h < 4) {
        drawOverlay(p)
        return
      }
      const [ax, ay] = vp.convertToPdfPoint(Math.min(d.x0, x), Math.min(d.y0, y))
      const [bx, by] = vp.convertToPdfPoint(Math.max(d.x0, x), Math.max(d.y0, y))
      const a: LerAnnot = { id: uid(), fileId: cur.id, page: p, type: 'hl', x: ax, y: ay, w: bx - ax, h: by - ay, color, at: Date.now() }
      await putAnnot(a)
      const list = await listAnnots(cur.id)
      setAnnots(list)
      drawOverlay(p)
    } else if (d.type === 'ink') {
      if (d.pts.length < 2) {
        drawOverlay(p)
        return
      }
      const pts = d.pts.map(([sx, sy]) => vp.convertToPdfPoint(sx, sy) as [number, number])
      const a: LerAnnot = { id: uid(), fileId: cur.id, page: p, type: 'ink', points: pts, color, at: Date.now() }
      await putAnnot(a)
      const list = await listAnnots(cur.id)
      setAnnots(list)
      drawOverlay(p)
    }
  }

  const saveNote = async () => {
    if (!notePop || !cur) return
    const a: LerAnnot = {
      id: notePop.id ?? uid(),
      fileId: cur.id,
      page: notePop.page,
      type: 'note',
      x: notePop.pdfX,
      y: notePop.pdfY,
      color,
      text: noteText.trim() || '…',
      at: Date.now()
    }
    await putAnnot(a)
    setAnnots(await listAnnots(cur.id))
    setNotePop(null)
  }

  const removeAnnot = async (id: string, pageN: number) => {
    await deleteAnnot(id)
    if (cur) setAnnots(await listAnnots(cur.id))
    drawOverlay(pageN)
  }

  const gotoPage = (n: number) => {
    const p = Math.min(numPages, Math.max(1, n))
    setPage(p)
    renderedRef.current.delete(p)
    pageRefs.current.get(p)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const fitWidth = () => {
    const root = mainRef.current
    const vp1 = viewportsRef.current.get(1)
    if (!root || !vp1) return
    const base = vp1.width / scaleRef.current
    setScale(Math.min(3, Math.max(0.3, (root.clientWidth - 56) / base)))
  }

  const exportAnnotated = async () => {
    if (!cur) return
    const buf = await cur.data.arrayBuffer()
    const pdfDoc = await PDFDocument.load(buf)
    const pages = pdfDoc.getPages()
    for (const a of annots) {
      const p = pages[a.page - 1]
      if (!p) continue
      if (a.type === 'hl' && a.x !== undefined && a.w !== undefined) {
        p.drawRectangle({ x: a.x, y: a.y ?? 0, width: a.w, height: a.h ?? 0, color: hexRgb(a.color), opacity: 0.4 })
      } else if (a.type === 'ink' && a.points && a.points.length > 1) {
        for (let i = 1; i < a.points.length; i++) {
          p.drawLine({
            start: { x: a.points[i - 1][0], y: a.points[i - 1][1] },
            end: { x: a.points[i][0], y: a.points[i][1] },
            thickness: 2,
            color: hexRgb(a.color),
            opacity: 0.9
          })
        }
      } else if (a.type === 'note' && a.text) {
        p.drawRectangle({ x: a.x ?? 0, y: (a.y ?? 0) - 16, width: 14, height: 14, color: hexRgb(a.color) })
        p.drawText(a.text.replace(/[^\x00-\xFF]/g, '?').slice(0, 300), {
          x: (a.x ?? 0) + 18,
          y: (a.y ?? 0) - 12,
          size: 8,
          color: rgb(0.15, 0.15, 0.15)
        })
      }
    }
    const out = await pdfDoc.save()
    const blob = new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `${safeName(cur.title)}-annote.pdf`
    el.click()
    URL.revokeObjectURL(url)
    setToast({ key: Date.now(), msg: `PDF annoté exporté (${annots.length} annotation${annots.length > 1 ? 's' : ''}) ⬇` })
  }

  const removeCurrent = async () => {
    if (!cur) return
    const snap = { file: cur, annots }
    await deleteFile(cur.id)
    setFiles(await listFiles())
    setView('lib')
    setCur(null)
    setAnnots([])
    setToast({
      key: Date.now(),
      msg: 'Fichier supprimé',
      action: () => {
        void restoreFile(snap.file, snap.annots).then(() => listFiles().then(setFiles))
      }
    })
  }

  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void importFiles(Array.from(e.dataTransfer.files))
  }

  const annotsSorted = [...annots].sort((a, b) => a.page - b.page || a.at - b.at)

  return (
    <div
      className={`blocs-app ler-app${dragOver ? ' drag-over' : ''}`}
      style={{ '--side-w': `${sideW}px` } as CSSProperties}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <aside className="blocs-sidebar ler-side">
        <div className="blocs-app-head">
          <Link to="/" className="blocs-app-brand" title="Retour au launcher Skouar">
            <img className="blocs-app-logo" src={`${BASE}app-icons/ler.svg`} alt="Ler" />
            <span className="blocs-app-name">Ler</span>
          </Link>
          <Link to="/" className="blocs-back" title="Retour au launcher">
            ←
          </Link>
        </div>
        {view === 'view' && cur ? (
          <>
            <button className="blocs-side-link" onClick={closeFile}>
              <span className="blocs-side-link-ic">←</span> Bibliothèque
            </button>
            <div className="blocs-side-sep" />
            <div className="blocs-sidebar-scroll">
              <div className="blocs-sidebar-head">
                <span>Outils</span>
              </div>
              <div className="ler-tools">
                <button className={tool === 'hl' ? 'active' : ''} onClick={() => setTool('hl')} title="Surligner : tirer un rectangle sur la page">
                  🖍️ Surligner
                </button>
                <button className={tool === 'ink' ? 'active' : ''} onClick={() => setTool('ink')} title="Dessin libre à la souris">
                  ✏️ Dessin
                </button>
                <button className={tool === 'note' ? 'active' : ''} onClick={() => setTool('note')} title="Note : cliquer sur la page">
                  📝 Note
                </button>
              </div>
              <div className="ler-colors">
                {COLORS.map((c) => (
                  <button key={c} className={`ler-dot${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} title={c} />
                ))}
              </div>
              <div className="blocs-side-sep" />
              <div className="blocs-sidebar-head">
                <span>Zoom</span>
                <select className="skrid-select" value={String(scale)} onChange={(e) => setScale(Number(e.target.value))}>
                  {ZOOMS.map((z) => (
                    <option key={z} value={String(z)}>
                      {Math.round(z * 100)} %
                    </option>
                  ))}
                </select>
              </div>
              <button className="blocs-side-link" onClick={fitWidth}>
                <span className="blocs-side-link-ic">↔</span> Ajuster à la largeur
              </button>
              <div className="ler-pagenav">
                <button className="page-cover-btn" disabled={page <= 1} onClick={() => gotoPage(page - 1)}>
                  ‹
                </button>
                <input
                  className="db-input ler-page-in"
                  type="number"
                  min={1}
                  max={numPages}
                  value={page}
                  onChange={(e) => gotoPage(Number(e.target.value) || 1)}
                />
                <span className="mono">/ {numPages}</span>
                <button className="page-cover-btn" disabled={page >= numPages} onClick={() => gotoPage(page + 1)}>
                  ›
                </button>
              </div>
              <div className="blocs-side-sep" />
              <div className="blocs-sidebar-head">
                <span>Annotations ({annots.length})</span>
              </div>
              <div className="ler-annots">
                {annotsSorted.map((a) => (
                  <div key={a.id} className="ler-annot-row" onClick={() => gotoPage(a.page)}>
                    <span className="ler-dot" style={{ background: a.color }} />
                    <span>
                      {a.type === 'hl' ? '🖍️' : a.type === 'ink' ? '✏️' : '📝'} p.{a.page}
                      {a.type === 'note' && a.text ? ` — ${a.text.slice(0, 40)}` : ''}
                    </span>
                    <button
                      className="blocs-page-del"
                      title="Supprimer l'annotation"
                      onClick={(e) => {
                        e.stopPropagation()
                        void removeAnnot(a.id, a.page)
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!annots.length && <p className="mono skrid-com-empty">Aucune annotation — choisis un outil ci-dessus.</p>}
              </div>
              <div className="blocs-side-sep" />
              <div className="blocs-sidebar-head">
                <span>Pages</span>
              </div>
              <div className="ler-thumbs">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={`ler-thumb${p === page ? ' on' : ''}`} onClick={() => gotoPage(p)} title={`Page ${p}`}>
                    <PdfThumb file={cur} width={64} />
                    <span className="mono">{p}</span>
                  </button>
                ))}
              </div>
            </div>
            <button className="blocs-side-link" onClick={exportAnnotated}>
              <span className="blocs-side-link-ic">⬇</span> Exporter le PDF annoté
            </button>
            <button className="blocs-side-link ler-del" onClick={removeCurrent}>
              <span className="blocs-side-link-ic">🗑</span> Supprimer le fichier
            </button>
          </>
        ) : (
          <>
            <div className="blocs-sidebar-head">
              <span>Bibliothèque</span>
            </div>
            <div className="blocs-sidebar-scroll">
              <p className="mono skrid-com-empty">{files.length} fichier{files.length > 1 ? 's' : ''} PDF</p>
            </div>
            <button className="blocs-side-link" onClick={() => fileRef.current?.click()}>
              <span className="blocs-side-link-ic">↑</span> Importer un PDF
            </button>
          </>
        )}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { void importFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        <div className="saved-line">
          <span className="saved-check on">✓</span> 100 % local
        </div>
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
      <main ref={mainRef} className="blocs-main ler-main">
        {view === 'lib' ? (
          <div className="ler-lib">
            <div className="page-top">
              <div className="page-head">
                <span className="blocs-title">Bibliothèque PDF</span>
                <div className="page-head-actions">
                  <button className="page-cover-btn" title="Importer des PDF" onClick={() => fileRef.current?.click()}>
                    ↑ Importer
                  </button>
                </div>
              </div>
            </div>
            <p className="skrid-plan-hint mono">Glisse-dépose des fichiers .pdf n'importe où ici, ou importe-les. Tout reste sur ton appareil.</p>
            {files.length === 0 ? (
              <div className="ler-empty" onClick={() => fileRef.current?.click()}>
                <span className="ler-empty-ic">📕</span>
                <strong>Aucun PDF pour l'instant</strong>
                <span className="mono">clique ou glisse-dépose des fichiers .pdf ici</span>
              </div>
            ) : (
              <div className="ler-grid">
                {files.map((f) => (
                  <div key={f.id} className="ler-card" onClick={() => void openFile(f)}>
                    <div className="ler-card-thumb">
                      <PdfThumb file={f} />
                    </div>
                    <div className="ler-card-body">
                      {editId === f.id ? (
                        <input
                          className="db-input"
                          autoFocus
                          value={editDraft}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void updateFile(f.id, { title: editDraft.trim() || f.title })
                              setEditId(null)
                              void listFiles().then(setFiles)
                            }
                            if (e.key === 'Escape') setEditId(null)
                          }}
                          onBlur={() => {
                            void updateFile(f.id, { title: editDraft.trim() || f.title })
                            setEditId(null)
                            void listFiles().then(setFiles)
                          }}
                        />
                      ) : (
                        <strong
                          title="Double-clic pour renommer"
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setEditId(f.id)
                            setEditDraft(f.title)
                          }}
                        >
                          {f.title}
                        </strong>
                      )}
                      <span className="mono ler-card-meta">
                        {f.pages} page{f.pages > 1 ? 's' : ''} · {relTime(f.updatedAt)}
                      </span>
                    </div>
                    <button
                      className="blocs-page-del ler-card-del"
                      title="Supprimer"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const snap = { file: f, annots: await listAnnots(f.id) }
                        await deleteFile(f.id)
                        setFiles(await listFiles())
                        setToast({
                          key: Date.now(),
                          msg: 'Fichier supprimé',
                          action: () => {
                            void restoreFile(snap.file, snap.annots).then(() => listFiles().then(setFiles))
                          }
                        })
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="ler-pages">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
              <div
                key={p}
                className="ler-page"
                data-page={p}
                ref={(el) => {
                  if (el) pageRefs.current.set(p, el)
                  else pageRefs.current.delete(p)
                }}
              >
                <canvas
                  className="ler-cv"
                  ref={(el) => {
                    if (el) canvasRefs.current.set(p, el)
                    else canvasRefs.current.delete(p)
                  }}
                />
                <canvas
                  className="ler-overlay"
                  ref={(el) => {
                    if (el) overlayRefs.current.set(p, el)
                    else overlayRefs.current.delete(p)
                  }}
                  onMouseDown={(e) => onOverlayDown(e, p)}
                  onMouseMove={(e) => onOverlayMove(e, p)}
                  onMouseUp={(e) => void onOverlayUp(e, p)}
                />
                {annots
                  .filter((a) => a.page === p && a.type === 'note')
                  .map((a) => {
                    const vp = viewportsRef.current.get(p)
                    if (!vp) return null
                    const [x, y] = vp.convertToViewportPoint(a.x ?? 0, a.y ?? 0)
                    return (
                      <button
                        key={a.id}
                        className="ler-note"
                        style={{ left: x - 9, top: y - 9, background: a.color }}
                        title={a.text}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          setNoteText(a.text ?? '')
                          setNotePop({ cx: e.clientX, cy: e.clientY, page: p, pdfX: a.x ?? 0, pdfY: a.y ?? 0, id: a.id })
                        }}
                      >
                        📝
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        )}
        {notePop && (
          <div
            className="skrid-pop ler-note-pop"
            data-pop="lernote"
            style={{ position: 'fixed', left: Math.max(8, Math.min(notePop.cx, window.innerWidth - 300)), top: Math.max(8, Math.min(notePop.cy, window.innerHeight - 170)) }}
          >
            <textarea
              className="db-input skrid-comta"
              autoFocus
              placeholder="Ta note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveNote()
                if (e.key === 'Escape') setNotePop(null)
              }}
            />
            <button className="db-btn" onClick={() => void saveNote()}>
              OK
            </button>
          </div>
        )}
        {toast && (
          <div className="toast" key={toast.key}>
            <span>{toast.msg}</span>
            {toast.action && (
              <button
                onClick={() => {
                  setToast(null)
                  toast.action?.()
                }}
              >
                Annuler
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
