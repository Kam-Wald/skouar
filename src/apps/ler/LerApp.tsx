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

type Tool = 'select' | 'hl' | 'ink' | 'arrow' | 'circle' | 'text' | 'stamp' | 'note' | 'sign'
const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'select', icon: '👆', label: 'Sélectionner du texte pour le surligner' },
  { id: 'hl', icon: '🖍️', label: 'Surligner (rectangle)' },
  { id: 'ink', icon: '✏️', label: 'Dessin libre' },
  { id: 'arrow', icon: '➡️', label: 'Flèche' },
  { id: 'circle', icon: '⭕', label: 'Cercle / ellipse' },
  { id: 'text', icon: '🔤', label: 'Ajouter du texte' },
  { id: 'stamp', icon: '✅', label: 'Tampon' },
  { id: 'note', icon: '📝', label: 'Note épinglée' },
  { id: 'sign', icon: '✍️', label: 'Poser ma signature' }
]
const COLORS = ['#ffd54a', '#7ee081', '#7ec8ff', '#ff9ecb', '#ff8a5c']
const STAMPS = ['✅ Lu', '⏳ À faire', '❌ Refusé', '⭐ Important']
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
const TEXT_SIZES = [12, 16, 22]

type TItem = { str: string; transform: number[]; width: number; height: number }

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

function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

async function loadDoc(buf: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data: new Uint8Array(buf.slice(0)),
    cMapUrl: CMAPS,
    cMapPacked: true,
    standardFontDataUrl: FONTS
  }).promise
}

function parseRanges(s: string, max: number): number[] {
  const out = new Set<number>()
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) continue
    const a = Math.min(max, Math.max(1, Number(m[1])))
    const b = Math.min(max, Math.max(a, Number(m[2] ?? m[1])))
    for (let i = a; i <= b; i++) out.add(i)
  }
  return [...out].sort((x, y) => x - y)
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
  const [rotation, setRotation] = useState(0)
  const [twoPages, setTwoPages] = useState(() => localStorage.getItem('skouar:ler-2p') === '1')
  const [night, setNight] = useState(() => localStorage.getItem('skouar:ler-night') === '1')
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(COLORS[0])
  const [stampIdx, setStampIdx] = useState(0)
  const [textSize, setTextSize] = useState(16)
  const [annots, setAnnots] = useState<LerAnnot[]>([])
  const [editPop, setEditPop] = useState<{ cx: number; cy: number; page: number; pdfX: number; pdfY: number; id?: string; kind: 'note' | 'text'; text: string; size: number } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [matches, setMatches] = useState<{ page: number; items: number[] }[]>([])
  const [mIdx, setMIdx] = useState(0)
  const [toast, setToast] = useState<{ key: number; msg: string; action?: () => void } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [mergeSel, setMergeSel] = useState<Set<string>>(new Set())
  const [splitPop, setSplitPop] = useState(false)
  const [splitDraft, setSplitDraft] = useState('')
  const [signOpen, setSignOpen] = useState(false)
  const [sign, setSign] = useState<string | null>(() => localStorage.getItem('skouar:ler-sign'))
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem('skouar:sidebarW'))
    return Number.isFinite(v) && v >= 180 && v <= 440 ? v : 240
  })
  const [dragOver, setDragOver] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const overlayRefs = useRef(new Map<number, HTMLCanvasElement>())
  const tlRefs = useRef(new Map<number, HTMLDivElement>())
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const viewportsRef = useRef(new Map<number, pdfjsLib.PageViewport>())
  const renderedRef = useRef(new Map<number, number>())
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const scaleRef = useRef(1)
  const rotRef = useRef(0)
  const annotsRef = useRef<LerAnnot[]>([])
  const searchRef = useRef<{ matches: { page: number; items: number[] }[]; mIdx: number }>({ matches: [], mIdx: 0 })
  const textCacheRef = useRef(new Map<number, { text: string; starts: number[]; items: TItem[] }>())
  const drawing = useRef<{ p: number; type: Tool; x0: number; y0: number; x: number; y: number; pts: [number, number][] } | null>(null)
  const padRef = useRef<HTMLCanvasElement>(null)
  const padDrawing = useRef(false)
  useDismiss('lernote', !!editPop, () => setEditPop(null))
  useDismiss('lersearch', searchOpen && view === 'view', () => {
    setSearchOpen(false)
    setMatches([])
    searchRef.current = { matches: [], mIdx: 0 }
    redrawAll()
  })
  useDismiss('lersplit', splitPop, () => setSplitPop(false))

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])
  useEffect(() => {
    rotRef.current = rotation
  }, [rotation])
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
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (view === 'view' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])
  useEffect(() => {
    if (!searchOpen || view !== 'view') return
    const t = setTimeout(() => void runSearch(), 250)
    return () => clearTimeout(t)
  }, [searchQ, searchOpen, view])

  const openFile = async (f: LerFile) => {
    if (docRef.current) {
      await docRef.current.destroy()
      docRef.current = null
    }
    const buf = await f.data.arrayBuffer()
    const d = await loadDoc(buf)
    docRef.current = d
    textCacheRef.current.clear()
    setCur(f)
    setNumPages(d.numPages)
    setRotation(f.rotation ?? 0)
    setPage(f.lastPage ?? 1)
    setAnnots(await listAnnots(f.id))
    renderedRef.current.clear()
    viewportsRef.current.clear()
    setView('view')
    setTimeout(() => {
      pageRefs.current.get(f.lastPage ?? 1)?.scrollIntoView({ block: 'start' })
    }, 60)
  }

  const closeFile = async () => {
    if (docRef.current) {
      await docRef.current.destroy()
      docRef.current = null
    }
    setCur(null)
    setAnnots([])
    setMatches([])
    searchRef.current = { matches: [], mIdx: 0 }
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

  const redrawAll = () => {
    renderedRef.current.forEach((_, p) => drawOverlay(p))
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
    const sr = searchRef.current
    if (sr.matches.length) {
      for (let i = 0; i < sr.matches.length; i++) {
        const m = sr.matches[i]
        if (m.page !== p) continue
        const cache = textCacheRef.current.get(p)
        if (!cache) continue
        ctx.globalAlpha = i === sr.mIdx ? 0.6 : 0.3
        ctx.fillStyle = i === sr.mIdx ? '#ff9f43' : '#ffc46b'
        for (const idx of m.items) {
          const item = cache.items[idx]
          if (!item) continue
          const m2 = pdfjsLib.Util.transform(vp.transform, item.transform)
          const fh = Math.hypot(m2[2], m2[3])
          const w = (item.width * Math.abs(m2[0])) / Math.max(1e-6, Math.abs(item.transform[0])) || item.width
          ctx.fillRect(m2[4], m2[5] - fh, w, fh)
        }
        ctx.globalAlpha = 1
      }
    }
    if (temp) {
      ctx.strokeStyle = color
      ctx.fillStyle = color
      if (temp.type === 'hl' || temp.type === 'circle') {
        const x = Math.min(temp.x0, temp.x)
        const y = Math.min(temp.y0, temp.y)
        const w = Math.abs(temp.x - temp.x0)
        const h = Math.abs(temp.y - temp.y0)
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
    const d = docRef.current
    if (!d) return
    const pg = await d.getPage(p)
    const vp = pg.getViewport({ scale: scaleRef.current, rotation: rotRef.current })
    viewportsRef.current.set(p, vp)
    const cv = canvasRefs.current.get(p)
    const ov = overlayRefs.current.get(p)
    const tl = tlRefs.current.get(p)
    if (!cv || !ov) return
    cv.width = vp.width
    cv.height = vp.height
    ov.width = vp.width
    ov.height = vp.height
    await pg.render({ canvasContext: cv.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise
    if (tl) {
      tl.innerHTML = ''
      tl.style.width = `${vp.width}px`
      tl.style.height = `${vp.height}px`
      const layer = new pdfjsLib.TextLayer({ textContentSource: pg.streamTextContent(), container: tl, viewport: vp })
      await layer.render()
    }
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
  }, [scale, rotation, view, cur?.id])

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
    if (tool === 'note' || tool === 'text') {
      const [px, py] = vp.convertToPdfPoint(x, y)
      setEditPop({ cx: e.clientX, cy: e.clientY, page: p, pdfX: px, pdfY: py, kind: tool, text: '', size: textSize })
      return
    }
    if (tool === 'stamp') {
      const [px, py] = vp.convertToPdfPoint(x, y)
      void (async () => {
        const a: LerAnnot = { id: uid(), fileId: cur.id, page: p, type: 'stamp', x: px, y: py, color, text: STAMPS[stampIdx], at: Date.now() }
        await putAnnot(a)
        setAnnots(await listAnnots(cur.id))
      })()
      return
    }
    if (tool === 'sign') {
      if (!sign) {
        setToast({ key: Date.now(), msg: 'Crée d\u2019abord ta signature ✍️ (sidebar)' })
        return
      }
      const [px, py] = vp.convertToPdfPoint(x, y)
      void (async () => {
        const a: LerAnnot = { id: uid(), fileId: cur.id, page: p, type: 'sign', x: px, y: py, w: 160, h: 64, color: '#000000', dataUrl: sign, at: Date.now() }
        await putAnnot(a)
        setAnnots(await listAnnots(cur.id))
      })()
      return
    }
    if (tool === 'select') return
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
    const mk = async (a: LerAnnot) => {
      await putAnnot(a)
      setAnnots(await listAnnots(cur!.id))
      drawOverlay(p)
    }
    if (d.type === 'hl' || d.type === 'circle') {
      const w = Math.abs(x - d.x0)
      const h = Math.abs(y - d.y0)
      if (w < 4 || h < 4) {
        drawOverlay(p)
        return
      }
      const [ax, ay] = vp.convertToPdfPoint(Math.min(d.x0, x), Math.min(d.y0, y))
      const [bx, by] = vp.convertToPdfPoint(Math.max(d.x0, x), Math.max(d.y0, y))
      await mk({ id: uid(), fileId: cur.id, page: p, type: d.type, x: ax, y: ay, w: bx - ax, h: by - ay, color, at: Date.now() })
    } else if (d.type === 'arrow') {
      const [ax, ay] = vp.convertToPdfPoint(d.x0, d.y0)
      const [bx, by] = vp.convertToPdfPoint(x, y)
      await mk({ id: uid(), fileId: cur.id, page: p, type: 'arrow', x: ax, y: ay, x2: bx, y2: by, color, at: Date.now() })
    } else if (d.type === 'ink') {
      if (d.pts.length < 2) {
        drawOverlay(p)
        return
      }
      const pts = d.pts.map(([sx, sy]) => vp.convertToPdfPoint(sx, sy) as [number, number])
      await mk({ id: uid(), fileId: cur.id, page: p, type: 'ink', points: pts, color, at: Date.now() })
    }
  }

  const onPageMouseUp = (p: number) => {
    if (tool !== 'select' || !cur) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
    const tl = tlRefs.current.get(p)
    const wrap = pageRefs.current.get(p)
    const vp = viewportsRef.current.get(p)
    if (!tl || !wrap || !vp || !sel.anchorNode || !tl.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)
    const wrapR = wrap.getBoundingClientRect()
    const byY = new Map<number, [number, number, number, number]>()
    for (const s of Array.from(tl.querySelectorAll('span'))) {
      if (!range.intersectsNode(s)) continue
      const r = s.getBoundingClientRect()
      const sx = r.left - wrapR.left
      const sy = r.top - wrapR.top
      const [ax, ay] = vp.convertToPdfPoint(sx, sy + r.height)
      const [bx, by] = vp.convertToPdfPoint(sx + r.width, sy)
      const x = Math.min(ax, bx)
      const y = Math.min(ay, by)
      const w = Math.abs(bx - ax)
      const h = Math.abs(by - ay)
      const key = Math.round(y / 3)
      const prev = byY.get(key)
      if (prev) byY.set(key, [Math.min(prev[0], x), y, Math.max(prev[0] + prev[2], x + w) - Math.min(prev[0], x), h])
      else byY.set(key, [x, y, w, h])
    }
    if (byY.size) {
      const rects = [...byY.values()]
      void (async () => {
        const a: LerAnnot = { id: uid(), fileId: cur!.id, page: p, type: 'hl', rects, color, at: Date.now() }
        await putAnnot(a)
        setAnnots(await listAnnots(cur!.id))
        drawOverlay(p)
      })()
    }
    sel.removeAllRanges()
  }

  const saveEdit = async () => {
    if (!editPop || !cur) return
    const a: LerAnnot = {
      id: editPop.id ?? uid(),
      fileId: cur.id,
      page: editPop.page,
      type: editPop.kind,
      x: editPop.pdfX,
      y: editPop.pdfY,
      color,
      text: editPop.text.trim() || (editPop.kind === 'note' ? '…' : ''),
      size: editPop.kind === 'text' ? editPop.size : undefined,
      at: Date.now()
    }
    await putAnnot(a)
    setAnnots(await listAnnots(cur.id))
    setEditPop(null)
  }

  const removeAnnot = async (id: string, pageN: number) => {
    await deleteAnnot(id)
    if (cur) setAnnots(await listAnnots(cur.id))
    drawOverlay(pageN)
  }

  const runSearch = async () => {
    const d = docRef.current
    const q = searchQ.trim().toLowerCase()
    if (!d || !q) {
      setMatches([])
      searchRef.current = { matches: [], mIdx: 0 }
      redrawAll()
      return
    }
    const out: { page: number; items: number[] }[] = []
    for (let p = 1; p <= d.numPages; p++) {
      let cache = textCacheRef.current.get(p)
      if (!cache) {
        const pg = await d.getPage(p)
        const tc = await pg.getTextContent()
        let text = ''
        const starts: number[] = []
        const items = tc.items as unknown as TItem[]
        items.forEach((it, i) => {
          starts[i] = text.length
          text += it.str + ' '
        })
        cache = { text, starts, items }
        textCacheRef.current.set(p, cache)
      }
      const t = cache.text.toLowerCase()
      let i = t.indexOf(q)
      while (i !== -1) {
        const idxs = new Set<number>()
        for (let c = i; c < i + q.length; c++) {
          let lo = 0
          let hi = cache.starts.length - 1
          let idx = 0
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (cache.starts[mid] <= c) {
              idx = mid
              lo = mid + 1
            } else hi = mid - 1
          }
          idxs.add(idx)
        }
        out.push({ page: p, items: [...idxs] })
        i = t.indexOf(q, i + 1)
      }
    }
    setMatches(out)
    searchRef.current = { matches: out, mIdx: 0 }
    setMIdx(0)
    if (out.length) {
      gotoPage(out[0].page)
      redrawAll()
    }
  }

  const stepMatch = (dir: -1 | 1) => {
    if (!matches.length) return
    const idx = (mIdx + dir + matches.length) % matches.length
    setMIdx(idx)
    searchRef.current = { matches, mIdx: idx }
    gotoPage(matches[idx].page)
    redrawAll()
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
    const pdfDoc = await PDFDocument.load(new Uint8Array(buf))
    const pages = pdfDoc.getPages()
    for (const a of annots) {
      const p = pages[a.page - 1]
      if (!p) continue
      if (a.type === 'hl') {
        const rects = a.rects ?? (a.x !== undefined && a.w !== undefined ? [[a.x, a.y ?? 0, a.w, a.h ?? 0]] : [])
        for (const [x, y, w, h] of rects) p.drawRectangle({ x, y, width: w, height: h, color: hexRgb(a.color), opacity: 0.4 })
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
      } else if (a.type === 'arrow' && a.x !== undefined && a.x2 !== undefined) {
        const x1 = a.x
        const y1 = a.y ?? 0
        const x2 = a.x2
        const y2 = a.y2 ?? 0
        p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 2.5, color: hexRgb(a.color) })
        const ang = Math.atan2(y2 - y1, x2 - x1)
        for (const da of [2.6, -2.6]) {
          p.drawLine({
            start: { x: x2, y: y2 },
            end: { x: x2 - 12 * Math.cos(ang + da), y: y2 - 12 * Math.sin(ang + da) },
            thickness: 2.5,
            color: hexRgb(a.color)
          })
        }
      } else if (a.type === 'circle' && a.x !== undefined && a.w !== undefined) {
        p.drawEllipse({
          x: a.x + a.w / 2,
          y: (a.y ?? 0) + (a.h ?? 0) / 2,
          xScale: a.w / 2,
          yScale: (a.h ?? 0) / 2,
          borderColor: hexRgb(a.color),
          borderWidth: 2
        })
      } else if (a.type === 'note' && a.text) {
        p.drawRectangle({ x: a.x ?? 0, y: (a.y ?? 0) - 16, width: 14, height: 14, color: hexRgb(a.color) })
        p.drawText(a.text.replace(/[^\x00-\xFF]/g, '?').slice(0, 300), {
          x: (a.x ?? 0) + 18,
          y: (a.y ?? 0) - 12,
          size: 8,
          color: rgb(0.15, 0.15, 0.15)
        })
      } else if (a.type === 'text' && a.text) {
        const size = a.size ?? 16
        const lines = a.text.replace(/[^\x00-\xFF]/g, '?').split('\n')
        lines.forEach((l, i) => {
          p.drawText(l.slice(0, 300), { x: a.x ?? 0, y: (a.y ?? 0) - size - i * size * 1.25, size, color: hexRgb(a.color) })
        })
      } else if (a.type === 'stamp' && a.text) {
        const label = a.text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '').trim() || a.text
        p.drawText(label.slice(0, 60), { x: a.x ?? 0, y: (a.y ?? 0) - 20, size: 16, color: hexRgb(a.color) })
      } else if (a.type === 'sign' && a.dataUrl) {
        const bytes = Uint8Array.from(atob(a.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
        const img = await pdfDoc.embedPng(bytes)
        p.drawImage(img, { x: a.x ?? 0, y: (a.y ?? 0) - (a.h ?? 64), width: a.w ?? 160, height: a.h ?? 64 })
      }
    }
    const out = await pdfDoc.save()
    downloadBlob(new Blob([ab(out)], { type: 'application/pdf' }), `${safeName(cur.title)}-annote.pdf`)
    setToast({ key: Date.now(), msg: `PDF annoté exporté (${annots.length} annotation${annots.length > 1 ? 's' : ''}) ⬇` })
  }

  const exportAnnotsJson = () => {
    if (!cur) return
    downloadBlob(new Blob([JSON.stringify({ title: cur.title, annots }, null, 2)], { type: 'application/json' }), `${safeName(cur.title)}-annotations.json`)
  }

  const importAnnotsJson = async (f: File) => {
    if (!cur) return
    try {
      const data = JSON.parse(await f.text()) as { annots?: LerAnnot[] } | LerAnnot[]
      const list = Array.isArray(data) ? data : data.annots ?? []
      for (const a of list) {
        await putAnnot({ ...a, id: uid(), fileId: cur.id })
      }
      setAnnots(await listAnnots(cur.id))
      redrawAll()
      setToast({ key: Date.now(), msg: `${list.length} annotation${list.length > 1 ? 's' : ''} importée${list.length > 1 ? 's' : ''} ↑` })
    } catch {
      setToast({ key: Date.now(), msg: 'JSON invalide ✕' })
    }
  }

  const mergeSelected = async () => {
    const sel = files.filter((f) => mergeSel.has(f.id))
    if (sel.length < 2) return
    const out = await PDFDocument.create()
    let total = 0
    for (const f of sel) {
      const src = await PDFDocument.load(new Uint8Array(await f.data.arrayBuffer()))
      const copied = await out.copyPages(src, src.getPageIndices())
      copied.forEach((p) => out.addPage(p))
      total += copied.length
    }
    const bytes = await out.save()
    await addFile({ id: uid(), title: `fusion-${sel.length}-pdf`, data: new Blob([ab(bytes)], { type: 'application/pdf' }), pages: total, updatedAt: Date.now() })
    setFiles(await listFiles())
    setMergeSel(new Set())
    setToast({ key: Date.now(), msg: `Fusion de ${sel.length} PDF (${total} pages) 📚` })
  }

  const doSplit = async () => {
    if (!cur) return
    const nums = parseRanges(splitDraft, numPages)
    if (!nums.length) return
    const src = await PDFDocument.load(new Uint8Array(await cur.data.arrayBuffer()))
    const out = await PDFDocument.create()
    const copied = await out.copyPages(src, nums.map((n) => n - 1))
    copied.forEach((p) => out.addPage(p))
    const bytes = await out.save()
    await addFile({
      id: uid(),
      title: `${cur.title}-p${nums.join('-')}`,
      data: new Blob([ab(bytes)], { type: 'application/pdf' }),
      pages: nums.length,
      updatedAt: Date.now()
    })
    setSplitPop(false)
    setSplitDraft('')
    setFiles(await listFiles())
    setToast({ key: Date.now(), msg: `${nums.length} page${nums.length > 1 ? 's' : ''} extraite${nums.length > 1 ? 's' : ''} ✂` })
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

  const padPos = (e: React.MouseEvent) => {
    const c = padRef.current
    const r = c?.getBoundingClientRect()
    return { x: ((e.clientX - (r?.left ?? 0)) * 300) / (r?.width || 300), y: ((e.clientY - (r?.top ?? 0)) * 120) / (r?.height || 120) }
  }
  const padDown = (e: React.MouseEvent) => {
    padDrawing.current = true
    const ctx = padRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = padPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const padMove = (e: React.MouseEvent) => {
    if (!padDrawing.current) return
    const ctx = padRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = padPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  const padUp = () => {
    padDrawing.current = false
  }
  const padClear = () => {
    padRef.current?.getContext('2d')?.clearRect(0, 0, 300, 120)
  }
  const padSave = () => {
    const url = padRef.current?.toDataURL('image/png')
    if (url) {
      localStorage.setItem('skouar:ler-sign', url)
      setSign(url)
    }
    setSignOpen(false)
  }
  useEffect(() => {
    if (signOpen && padRef.current) {
      const ctx = padRef.current.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#111'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        if (sign) {
          const img = new Image()
          img.onload = () => ctx.drawImage(img, 0, 0, 300, 120)
          img.src = sign
        }
      }
    }
  }, [signOpen])

  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void importFiles(Array.from(e.dataTransfer.files))
  }

  const annotsSorted = [...annots].sort((a, b) => a.page - b.page || a.at - b.at)
  const iconOf = (a: LerAnnot) =>
    a.type === 'hl' ? '🖍️' : a.type === 'ink' ? '✏️' : a.type === 'note' ? '📝' : a.type === 'text' ? '🔤' : a.type === 'sign' ? '✍️' : a.type === 'arrow' ? '➡️' : a.type === 'circle' ? '⭕' : '✅'

  return (
    <div
      className={`blocs-app ler-app${dragOver ? ' drag-over' : ''}${night ? ' night' : ''}`}
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
                {TOOLS.map((t) => (
                  <button key={t.id} className={tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)} title={t.label}>
                    {t.icon}{' '}
                    {t.id === 'select' ? 'Sélection' : t.id === 'hl' ? 'Surligner' : t.id === 'ink' ? 'Dessin' : t.id === 'arrow' ? 'Flèche' : t.id === 'circle' ? 'Cercle' : t.id === 'text' ? 'Texte' : t.id === 'stamp' ? 'Tampon' : t.id === 'note' ? 'Note' : 'Signature'}
                  </button>
                ))}
              </div>
              <div className="ler-colors">
                {COLORS.map((c) => (
                  <button key={c} className={`ler-dot${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} title={c} />
                ))}
              </div>
              {tool === 'stamp' && (
                <select className="skrid-select" value={stampIdx} onChange={(e) => setStampIdx(Number(e.target.value))} title="Tampon">
                  {STAMPS.map((s, i) => (
                    <option key={s} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              {tool === 'text' && (
                <select className="skrid-select" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} title="Taille du texte">
                  {TEXT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
              )}
              {tool === 'sign' && (
                <button className="blocs-side-link" onClick={() => setSignOpen(true)}>
                  <span className="blocs-side-link-ic">✍️</span> {sign ? 'Modifier ma signature' : 'Créer ma signature'}
                </button>
              )}
              <div className="blocs-side-sep" />
              <div className="blocs-sidebar-head">
                <span>Zoom / page</span>
                <select className="skrid-select" value={String(scale)} onChange={(e) => setScale(Number(e.target.value))}>
                  {ZOOMS.map((z) => (
                    <option key={z} value={String(z)}>
                      {Math.round(z * 100)} %
                    </option>
                  ))}
                </select>
              </div>
              <div className="ler-viewopts">
                <button className="db-btn" onClick={fitWidth} title="Ajuster à la largeur">
                  ↔ largeur
                </button>
                <button className="db-btn" onClick={() => gotoPage(page - 1)} disabled={page <= 1}>
                  ‹
                </button>
                <input className="db-input ler-page-in" type="number" min={1} max={numPages} value={page} onChange={(e) => gotoPage(Number(e.target.value) || 1)} />
                <span className="mono">/ {numPages}</span>
                <button className="db-btn" onClick={() => gotoPage(page + 1)} disabled={page >= numPages}>
                  ›
                </button>
              </div>
              <div className="ler-viewopts">
                <button
                  className={`db-btn${twoPages ? ' active' : ''}`}
                  title="2 pages côte à côte"
                  onClick={() => {
                    setTwoPages((v) => {
                      localStorage.setItem('skouar:ler-2p', v ? '0' : '1')
                      return !v
                    })
                  }}
                >
                  ▥ 2 pages
                </button>
                <button
                  className="db-btn"
                  title="Rotation -90°"
                  onClick={() => {
                    const r = (rotation + 270) % 360
                    setRotation(r)
                    void updateFile(cur.id, { rotation: r })
                  }}
                >
                  ⟲
                </button>
                <button
                  className="db-btn"
                  title="Rotation +90°"
                  onClick={() => {
                    const r = (rotation + 90) % 360
                    setRotation(r)
                    void updateFile(cur.id, { rotation: r })
                  }}
                >
                  ⟳
                </button>
                <button
                  className={`db-btn${night ? ' active' : ''}`}
                  title="Mode nuit (inversion)"
                  onClick={() => {
                    setNight((v) => {
                      localStorage.setItem('skouar:ler-night', v ? '0' : '1')
                      return !v
                    })
                  }}
                >
                  🌙
                </button>
                <button className="db-btn" title="Rechercher (Ctrl+F)" onClick={() => setSearchOpen(true)}>
                  🔍
                </button>
                <button className="db-btn" title="Imprimer" onClick={() => window.print()}>
                  🖨
                </button>
              </div>
              <div className="blocs-side-sep" />
              <div className="blocs-sidebar-head">
                <span>Annotations ({annots.length})</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="blocs-new-page" title="Exporter les annotations (JSON)" onClick={exportAnnotsJson}>
                    ⬇
                  </button>
                  <button className="blocs-new-page" title="Importer des annotations (JSON)" onClick={() => jsonRef.current?.click()}>
                    ↑
                  </button>
                </div>
              </div>
              <div className="ler-annots">
                {annotsSorted.map((a) => (
                  <div key={a.id} className="ler-annot-row" onClick={() => gotoPage(a.page)}>
                    <span className="ler-dot" style={{ background: a.color }} />
                    <span>
                      {iconOf(a)} p.{a.page}
                      {a.text ? ` — ${a.text.slice(0, 40)}` : ''}
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
              <span className="blocs-side-link-ic">⬇</span> Exporter le PDF annoté (aplati)
            </button>
            <button
              className="blocs-side-link"
              data-pop="lersplit"
              onClick={() => {
                setSplitDraft(`${page}`)
                setSplitPop(true)
              }}
            >
              <span className="blocs-side-link-ic">✂</span> Extraire des pages…
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
              <p className="mono skrid-com-empty">
                {files.length} fichier{files.length > 1 ? 's' : ''} PDF · {mergeSel.size} sélectionné{mergeSel.size > 1 ? 's' : ''}
              </p>
            </div>
            <button className="blocs-side-link" onClick={() => fileRef.current?.click()}>
              <span className="blocs-side-link-ic">↑</span> Importer un PDF
            </button>
            <button className="blocs-side-link" disabled={mergeSel.size < 2} onClick={mergeSelected}>
              <span className="blocs-side-link-ic">📚</span> Fusionner la sélection ({mergeSel.size})
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            void importFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <input
          ref={jsonRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importAnnotsJson(f)
            e.target.value = ''
          }}
        />
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
                  <button className="page-cover-btn" title="Fusionner les PDF cochés" disabled={mergeSel.size < 2} onClick={mergeSelected}>
                    📚 Fusionner ({mergeSel.size})
                  </button>
                  <button className="page-cover-btn" title="Importer des PDF" onClick={() => fileRef.current?.click()}>
                    ↑ Importer
                  </button>
                </div>
              </div>
            </div>
            <p className="skrid-plan-hint mono">Glisse-dépose des fichiers .pdf n'importe où ici, ou importe-les. Coche plusieurs fichiers pour les fusionner. Tout reste local.</p>
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
                    <input
                      type="checkbox"
                      className="ler-card-check"
                      checked={mergeSel.has(f.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setMergeSel((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(f.id)
                          else n.delete(f.id)
                          return n
                        })
                      }}
                      title="Cocher pour fusionner"
                    />
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
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              if (e.key === 'Enter') void updateFile(f.id, { title: editDraft.trim() || f.title }).then(() => listFiles().then(setFiles))
                              setEditId(null)
                            }
                          }}
                          onBlur={() => {
                            void updateFile(f.id, { title: editDraft.trim() || f.title }).then(() => listFiles().then(setFiles))
                            setEditId(null)
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
          <div className={`ler-pages${twoPages ? ' two' : ''}`}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
              <div
                key={p}
                className="ler-page"
                data-page={p}
                onMouseUp={() => onPageMouseUp(p)}
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
                <div
                  className="ler-tl textLayer"
                  ref={(el) => {
                    if (el) tlRefs.current.set(p, el)
                    else tlRefs.current.delete(p)
                  }}
                />
                <canvas
                  className="ler-overlay"
                  style={{ pointerEvents: tool === 'select' ? 'none' : 'auto' }}
                  ref={(el) => {
                    if (el) overlayRefs.current.set(p, el)
                    else overlayRefs.current.delete(p)
                  }}
                  onMouseDown={(e) => onOverlayDown(e, p)}
                  onMouseMove={(e) => onOverlayMove(e, p)}
                  onMouseUp={(e) => void onOverlayUp(e, p)}
                />
                {annots
                  .filter((a) => a.page === p && (a.type === 'note' || a.type === 'text' || a.type === 'stamp' || a.type === 'sign'))
                  .map((a) => {
                    const vp = viewportsRef.current.get(p)
                    if (!vp) return null
                    const [x, y] = vp.convertToViewportPoint(a.x ?? 0, a.y ?? 0)
                    if (a.type === 'sign') {
                      return <img key={a.id} src={a.dataUrl} alt="signature" className="ler-asign" style={{ left: x, top: y - (a.h ?? 64) * vp.scale, width: (a.w ?? 160) * vp.scale }} draggable={false} />
                    }
                    if (a.type === 'stamp') {
                      return (
                        <button
                          key={a.id}
                          className="ler-astamp"
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
                        className={isNote ? 'ler-note' : 'ler-atext-btn'}
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
                        {isNote ? '📝' : <span className="ler-atext">{a.text}</span>}
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        )}
        {view === 'view' && searchOpen && (
          <div className="ler-search" data-pop="lersearch">
            <input
              className="db-input"
              autoFocus
              placeholder="Rechercher dans le PDF… (Ctrl+F)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  stepMatch(e.shiftKey ? -1 : 1)
                }
                if (e.key === 'Escape') {
                  setSearchOpen(false)
                  setMatches([])
                  searchRef.current = { matches: [], mIdx: 0 }
                  redrawAll()
                }
              }}
            />
            <span className="mono">{matches.length ? `${Math.min(mIdx + 1, matches.length)}/${matches.length}` : '0'}</span>
            <button className="tool" onMouseDown={(e) => e.preventDefault()} onClick={() => stepMatch(-1)}>
              ↑
            </button>
            <button className="tool" onMouseDown={(e) => e.preventDefault()} onClick={() => stepMatch(1)}>
              ↓
            </button>
            <button
              className="tool"
              onClick={() => {
                setSearchOpen(false)
                setMatches([])
                searchRef.current = { matches: [], mIdx: 0 }
                redrawAll()
              }}
            >
              ✕
            </button>
          </div>
        )}
        {editPop && (
          <div
            className="skrid-pop ler-note-pop"
            data-pop="lernote"
            style={{ position: 'fixed', left: Math.max(8, Math.min(editPop.cx, window.innerWidth - 320)), top: Math.max(8, Math.min(editPop.cy, window.innerHeight - 180)) }}
          >
            <textarea
              className="db-input skrid-comta"
              autoFocus
              placeholder={editPop.kind === 'note' ? 'Ta note…' : 'Ton texte…'}
              value={editPop.text}
              onChange={(e) => setEditPop((p) => (p ? { ...p, text: e.target.value } : p))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveEdit()
                if (e.key === 'Escape') setEditPop(null)
              }}
            />
            {editPop.kind === 'text' && (
              <select className="skrid-select" value={editPop.size} onChange={(e) => setEditPop((p) => (p ? { ...p, size: Number(e.target.value) } : p))}>
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
        {splitPop && (
          <div className="skrid-pop ler-note-pop" data-pop="lersplit" style={{ position: 'fixed', left: '50%', top: 120, transform: 'translateX(-50%)' }}>
            <input
              className="db-input"
              autoFocus
              placeholder="Pages à extraire : 1-3, 5…"
              value={splitDraft}
              onChange={(e) => setSplitDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doSplit()
                if (e.key === 'Escape') setSplitPop(false)
              }}
            />
            <button className="db-btn" onClick={() => void doSplit()}>
              Extraire
            </button>
          </div>
        )}
        {signOpen && (
          <div className="skrid-help-ov" onClick={() => setSignOpen(false)}>
            <div className="skrid-help ler-signpad" data-pop="lersign" onClick={(e) => e.stopPropagation()}>
              <div className="tpl-head">
                <strong>Ta signature</strong>
                <button className="db-btn" onClick={() => setSignOpen(false)}>
                  ✕
                </button>
              </div>
              <canvas ref={padRef} width={300} height={120} className="ler-pad" onMouseDown={padDown} onMouseMove={padMove} onMouseUp={padUp} onMouseLeave={padUp} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="db-btn" onClick={padClear}>
                  Effacer
                </button>
                <button className="db-btn" onClick={padSave}>
                  Enregistrer ✍️
                </button>
              </div>
            </div>
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
