import { useCallback, useEffect, useRef, useState } from 'react'
import type { SkCtx } from '../SkeudApp'
import {
  ASPECT_PRESETS,
  DEFAULT_EDIT,
  DEFAULT_FRAME,
  EXPORT_FORMATS,
  FILTER_PRESETS,
  FONTS,
  FRAME_PRESETS,
  STICKERS,
  aspectLabel,
  exportName,
  framePresetOf,
  newStickerLayer,
  newTextLayer,
  outDims,
  toImageRect,
  fmtBytes,
  type EditState,
  type FrameGeom,
  type Layer,
  type Rect,
  type TextLayer
} from '../logic'
import { canvasToBlob, downloadBlob, loadBitmap, measureLayer, renderEdit } from '../render'
import { uid, type SkImage } from '../store'
import { notify } from '../../../shared/notify'

const FILTER_SLIDERS: { key: 'brightness' | 'contrast' | 'saturation' | 'sepia' | 'grayscale' | 'hue' | 'temp' | 'sharpen'; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'brightness', label: 'Luminosité', min: 0.5, max: 1.5, step: 0.05, unit: '%' },
  { key: 'contrast', label: 'Contraste', min: 0.5, max: 1.5, step: 0.05, unit: '%' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.05, unit: '%' },
  { key: 'sepia', label: 'Sépia', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'grayscale', label: 'N&B', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'hue', label: 'Teinte', min: 0, max: 360, step: 5, unit: '°' },
  { key: 'temp', label: 'Température', min: -100, max: 100, step: 5, unit: '' },
  { key: 'sharpen', label: 'Netteté', min: 0, max: 1, step: 0.05, unit: '' }
]

type TabId = 'ajuster' | 'filtres' | 'cadres' | 'calques' | 'exporter'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'ajuster', label: 'Ajuster', icon: '✂️' },
  { id: 'filtres', label: 'Filtres', icon: '🎨' },
  { id: 'cadres', label: 'Cadres', icon: '🖼️' },
  { id: 'calques', label: 'Calques', icon: '🧩' },
  { id: 'exporter', label: 'Exporter', icon: '⬇️' }
]

export default function EditorView({ img, ctx }: { img: SkImage; ctx: SkCtx }): JSX.Element {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null)
  const [st, setSt] = useState<EditState>({ ...DEFAULT_EDIT, filter: { ...DEFAULT_EDIT.filter }, frame: { ...DEFAULT_EDIT.frame }, layers: [] })
  const [hist, setHist] = useState<EditState[]>([])
  const [hi, setHi] = useState(-1)
  const [cropMode, setCropMode] = useState(false)
  const [aspect, setAspect] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  const [fmtIdx, setFmtIdx] = useState(1)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(img.name)
  const [zoom, setZoom] = useState(1)
  const [compare, setCompare] = useState(false)
  const [cmpX, setCmpX] = useState(0.5)
  const [cmpDrag, setCmpDrag] = useState(false)
  const [selLayer, setSelLayer] = useState<string | null>(null)
  const [dragLayer, setDragLayer] = useState<{ id: string; offX: number; offY: number } | null>(null)
  const [estSize, setEstSize] = useState('')
  const [tab, setTab] = useState<TabId>('ajuster')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const geomRef = useRef<{ g: FrameGeom; s: number; fit: number } | null>(null)
  const stRef = useRef(st)
  stRef.current = st

  useEffect(() => {
    let dead = false
    loadBitmap(img.orig).then((b) => {
      if (!dead) setBmp(b)
    })
    return () => {
      dead = true
    }
  }, [img.orig])

  const push = useCallback(
    (next: EditState) => {
      setHist((h) => [...h.slice(0, hi + 1), next])
      setHi((v) => v + 1)
      setSt(next)
    },
    [hi]
  )

  const undo = (): void => {
    if (hi <= 0) return
    setHi(hi - 1)
    setSt(hist[hi - 1])
  }
  const redo = (): void => {
    if (hi >= hist.length - 1) return
    setHi(hi + 1)
    setSt(hist[hi + 1])
  }

  useEffect(() => {
    if (!bmp || !canvasRef.current) return
    const maxW = Math.max(320, (wrapRef.current?.clientWidth ?? 900) - 24)
    const cropView = cropMode ? { ...st, frame: { ...DEFAULT_FRAME }, size: null } : st
    const dims = outDims(img.w, img.h, cropView)
    const fit = Math.min(1, maxW / dims.w, 620 / dims.h)
    const s = fit * zoom
    const preview = renderEdit(bmp, cropView)
    const c = canvasRef.current
    c.width = Math.max(1, Math.round(preview.width * s))
    c.height = Math.max(1, Math.round(preview.height * s))
    geomRef.current = { g: { W: preview.width, H: preview.height, ix: 0, iy: 0, iw: preview.width, ih: preview.height, radius: 0, circle: false, bars: 0, vig: 0, edge: 0 }, s, fit }
    const cx = c.getContext('2d')!
    cx.imageSmoothingQuality = 'high'
    cx.clearRect(0, 0, c.width, c.height)
    cx.drawImage(preview, 0, 0, c.width, c.height)
    if (compare) {
      const orig = renderEdit(bmp, { ...DEFAULT_EDIT, filter: { ...DEFAULT_EDIT.filter }, frame: { ...DEFAULT_EDIT.frame }, layers: [], size: st.size })
      cx.save()
      cx.beginPath()
      cx.rect(0, 0, cmpX * c.width, c.height)
      cx.clip()
      cx.drawImage(orig, 0, 0, c.width, c.height)
      cx.restore()
      cx.strokeStyle = '#fff'
      cx.lineWidth = 2
      cx.beginPath()
      cx.moveTo(cmpX * c.width, 0)
      cx.lineTo(cmpX * c.width, c.height)
      cx.stroke()
      cx.fillStyle = '#fff'
      cx.font = '12px sans-serif'
      cx.fillText('AVANT', 8, 16)
      cx.textAlign = 'right'
      cx.fillText('APRÈS', c.width - 8, 16)
      cx.textAlign = 'left'
    }
    if (cropMode && drag) {
      const r = normDrag(drag)
      cx.fillStyle = 'rgba(0,0,0,0.3)'
      cx.fillRect(0, 0, c.width, c.height)
      cx.clearRect(r.x, r.y, r.w, r.h)
      cx.drawImage(preview, 0, 0, c.width, c.height)
      cx.strokeStyle = '#4f46e5'
      cx.lineWidth = 2
      cx.setLineDash([6, 4])
      cx.strokeRect(r.x, r.y, r.w, r.h)
      cx.setLineDash([])
    }
  }, [bmp, st, cropMode, drag, compare, cmpX, zoom, img.w, img.h])

  useEffect(() => {
    if (!bmp) return
    const t = setTimeout(() => {
      try {
        const canvas = renderEdit(bmp, stRef.current)
        const fmt = EXPORT_FORMATS[fmtIdx]
        canvasToBlob(canvas, fmt.type, fmt.quality)
          .then((b) => setEstSize(fmtBytes(b.size)))
          .catch(() => setEstSize(''))
      } catch {
        setEstSize('')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [bmp, st, fmtIdx])

  const normDrag = (d: { a: { x: number; y: number }; b: { x: number; y: number } }): Rect => ({
    x: Math.min(d.a.x, d.b.x),
    y: Math.min(d.a.y, d.b.y),
    w: Math.abs(d.b.x - d.a.x),
    h: Math.abs(d.b.y - d.a.y)
  })

  const canvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  const applyCrop = (): void => {
    if (!drag || !bmp || !canvasRef.current) return
    const r = normDrag(drag)
    if (r.w < 8 || r.h < 8) {
      setDrag(null)
      return
    }
    const c = canvasRef.current
    const base: Rect = st.crop ?? { x: 0, y: 0, w: img.w, h: img.h }
    const ir = toImageRect(r, c.width, c.height, base.w, base.h, aspect)
    push({ ...st, crop: { x: base.x + ir.x, y: base.y + ir.y, w: ir.w, h: ir.h } })
    setDrag(null)
    setCropMode(false)
    notify(`Recadré : ${ir.w}×${ir.h}`)
  }

  const hitLayer = (px: number, py: number): Layer | null => {
    const geo = geomRef.current
    if (!geo || !bmp) return null
    const fx = px / geo.s
    const fy = py / geo.s
    const inner = { ix: 0, iy: 0, iw: geo.g.W, ih: geo.g.H }
    const lx = fx / inner.iw
    const ly = fy / inner.ih
    for (let i = st.layers.length - 1; i >= 0; i--) {
      const l = st.layers[i]
      const d = measureLayer(l, inner.iw)
      if (lx >= l.x && lx <= l.x + d.w / inner.iw && ly >= l.y && ly <= l.y + d.h / inner.ih) return l
    }
    return null
  }

  const onCanvasDown = (e: React.MouseEvent): void => {
    const p = canvasPos(e)
    if (compare) {
      if (Math.abs(p.x - cmpX * (canvasRef.current?.width ?? 1)) < 12) setCmpDrag(true)
      return
    }
    if (cropMode) {
      setDrag({ a: p, b: p })
      return
    }
    const l = hitLayer(p.x, p.y)
    if (l) {
      const geo = geomRef.current!
      const lx = p.x / geo.s / geo.g.W
      const ly = p.y / geo.s / geo.g.H
      setDragLayer({ id: l.id, offX: lx - l.x, offY: ly - l.y })
      setSelLayer(l.id)
    } else setSelLayer(null)
  }

  const onCanvasMove = (e: React.MouseEvent): void => {
    const p = canvasPos(e)
    if (cmpDrag) {
      const c = canvasRef.current!
      setCmpX(Math.min(1, Math.max(0, p.x / c.width)))
      return
    }
    if (cropMode && drag) {
      setDrag({ a: drag.a, b: p })
      return
    }
    if (dragLayer) {
      const geo = geomRef.current
      if (!geo) return
      const lx = p.x / geo.s / geo.g.W
      const ly = p.y / geo.s / geo.g.H
      setSt((cur) => ({
        ...cur,
        layers: cur.layers.map((l) => (l.id === dragLayer.id ? { ...l, x: Math.min(1, Math.max(0, lx - dragLayer.offX)), y: Math.min(1, Math.max(0, ly - dragLayer.offY)) } : l))
      }))
    }
  }

  const onCanvasUp = (): void => {
    if (cmpDrag) setCmpDrag(false)
    if (cropMode && drag) {
      applyCrop()
      return
    }
    if (dragLayer) {
      setHist((h) => [...h.slice(0, hi + 1), stRef.current])
      setHi((v) => v + 1)
      setDragLayer(null)
    }
  }

  const exportCurrent = async (save: boolean): Promise<void> => {
    if (!bmp) return
    const canvas = renderEdit(bmp, st)
    const fmt = EXPORT_FORMATS[fmtIdx]
    const blob = await canvasToBlob(canvas, fmt.type, fmt.quality)
    if (save) await ctx.saveEdited(img.id, blob)
    else await downloadBlob(blob, exportName(img.name, fmt.ext))
    if (!save) notify(`Exporté : ${exportName(img.name, fmt.ext)} (${fmtBytes(blob.size)}) ⬇`)
  }

  const addText = (): void => {
    const l = newTextLayer(uid())
    push({ ...st, layers: [...st.layers, l] })
    setSelLayer(l.id)
  }
  const addSticker = (emoji: string): void => {
    const l = newStickerLayer(uid(), emoji)
    push({ ...st, layers: [...st.layers, l] })
    setSelLayer(l.id)
  }
  const patchLayer = (id: string, patch: Partial<Layer>): void => {
    setSt((cur) => ({ ...cur, layers: cur.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }))
  }
  const commitLayers = (): void => {
    setHist((h) => [...h.slice(0, hi + 1), stRef.current])
    setHi((v) => v + 1)
  }
  const delLayer = (id: string): void => {
    push({ ...st, layers: st.layers.filter((l) => l.id !== id) })
    setSelLayer(null)
  }

  const dims = outDims(img.w, img.h, st)
  const dirty = hi >= 0
  const activeFrame = framePresetOf(st.frame)
  const layer = st.layers.find((l) => l.id === selLayer) ?? null
  const textLayer = layer?.kind === 'text' ? (layer as TextLayer) : null

  return (
    <div className="sk-editor">
      <header className="sk-ed-head">
        <button className="sk-btn ghost" onClick={() => ctx.select(null)}>‹ Bibliothèque</button>
        {renaming ? (
          <input
            className="sk-input sk-rename"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void ctx.rename(img.id, name)
                setRenaming(false)
              }
            }}
            onBlur={() => {
              void ctx.rename(img.id, name)
              setRenaming(false)
            }}
          />
        ) : (
          <strong className="sk-ed-title" title="Cliquer pour renommer" onClick={() => setRenaming(true)}>
            {img.name} ✏️
          </strong>
        )}
        <span className="sk-ed-dims">
          {img.w}×{img.h} ({aspectLabel(img.w, img.h)}) → <strong>{dims.w}×{dims.h}</strong>
        </span>
        <button className={`sk-btn ghost${compare ? ' primary' : ''}`} title="Comparaison avant / après (glisser la ligne)" onClick={() => setCompare((v) => !v)}>
          ⟷ Avant/Après
        </button>
        <button className="sk-btn danger" onClick={() => void ctx.remove(img.id)}>🗑 Supprimer</button>
      </header>

      <div className="sk-toolbar">
        <div className="sk-tb-group">
          <button className="sk-btn ghost" disabled={hi <= 0} onClick={undo} title="Annuler">↶</button>
          <button className="sk-btn ghost" disabled={hi >= hist.length - 1} onClick={redo} title="Rétablir">↷</button>
          <button
            className="sk-btn ghost"
            disabled={!dirty}
            onClick={() => {
              setHist([])
              setHi(-1)
              setSt({ ...DEFAULT_EDIT, filter: { ...DEFAULT_EDIT.filter }, frame: { ...DEFAULT_EDIT.frame }, layers: [] })
              setSelLayer(null)
            }}
          >
            Reset
          </button>
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`sk-tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ajuster' && (
        <div className="sk-panel">
          <button
            className={`sk-btn${cropMode ? ' primary' : ''}`}
            disabled={st.rot !== 0}
            title={st.rot !== 0 ? 'Remets la rotation à 0° pour recadrer' : 'Recadrer (glisser sur l’image)'}
            onClick={() => {
              setCropMode((v) => !v)
              setDrag(null)
            }}
          >
            ▢ Recadrer
          </button>
          {cropMode && (
            <span className="sk-chip-row">
              {ASPECT_PRESETS.map((p) => (
                <button key={p.label} className={`sk-chip-btn${aspect === p.v ? ' active' : ''}`} onClick={() => setAspect(p.v)}>
                  {p.label}
                </button>
              ))}
            </span>
          )}
          {st.crop && !cropMode && (
            <button className="sk-btn ghost" onClick={() => push({ ...st, crop: null })}>
              ✕ Annuler le recadrage ({st.crop.w}×{st.crop.h})
            </button>
          )}
          <div className="sk-tb-sep" />
          <button className="sk-btn" title="Pivoter 90°" onClick={() => push({ ...st, rot: ((st.rot + 90) % 360) as EditState['rot'] })}>⟳ 90°</button>
          <button className="sk-btn" title="Miroir horizontal" onClick={() => push({ ...st, flipH: !st.flipH })}>🪞 H</button>
          <button className="sk-btn" title="Miroir vertical" onClick={() => push({ ...st, flipV: !st.flipV })}>🪞 V</button>
          <div className="sk-tb-sep" />
          <label className="sk-num">
            Largeur
            <input
              type="number"
              min={1}
              max={16000}
              placeholder={String(img.w)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const w = Number((e.target as HTMLInputElement).value)
                  if (w > 0) push({ ...st, size: { w, h: Math.round((img.h / img.w) * w) } })
                }
              }}
            />
          </label>
          {st.size && (
            <button className="sk-btn ghost" onClick={() => push({ ...st, size: null })}>Taille d'origine</button>
          )}
        </div>
      )}

      {tab === 'filtres' && (
        <div className="sk-panel sk-panel-col">
          <span className="sk-preset-row sk-preset-wrap">
            {FILTER_PRESETS.map((p) => (
              <button
                key={p.label}
                className={`sk-preset${JSON.stringify(st.filter) === JSON.stringify(p.filter) ? ' active' : ''}`}
                title={`Filtre ${p.label}`}
                onClick={() => push({ ...st, filter: { ...p.filter } })}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </span>
          <details className="sk-fine">
            <summary className="sk-tb-label sk-fine-sum">Réglages fins ▾</summary>
            <div className="sk-filters">
              {FILTER_SLIDERS.map((sl) => (
                <label key={sl.key} className="sk-slider">
                  <span>{sl.label}</span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={st.filter[sl.key]}
                    onChange={(e) => push({ ...st, filter: { ...st.filter, [sl.key]: Number(e.target.value) } })}
                  />
                  <span className="sk-slider-val">
                    {sl.key === 'hue' ? `${Math.round(st.filter.hue)}°` : sl.key === 'temp' ? `${st.filter.temp > 0 ? '+' : ''}${Math.round(st.filter.temp)}` : sl.key === 'sharpen' ? Math.round(st.filter.sharpen * 100) + '%' : `${Math.round(st.filter[sl.key] * 100)}${sl.unit}`}
                  </span>
                </label>
              ))}
            </div>
          </details>
        </div>
      )}

      {tab === 'cadres' && (
        <div className="sk-panel sk-panel-col">
          <span className="sk-preset-row sk-preset-wrap">
            {FRAME_PRESETS.map((p) => (
              <button
                key={p.id}
                className={`sk-preset${activeFrame?.id === p.id ? ' active' : ''}`}
                title={`${p.label} — ${p.hint}`}
                onClick={() => push({ ...st, frame: { ...p.frame }, ...(p.filter ? { filter: { ...p.filter } } : {}) })}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </span>
          <span className="sk-frame-hint">Filet = ligne SUR l’image · Passe-partout = marge AUTOUR · Déchiré / Brûlé = bord irrégulier</span>
          {(st.frame.border || st.frame.rounded || st.frame.vignette || st.frame.mat || st.frame.double || st.frame.torn || st.frame.burnt) && (
            <span className="sk-frame-custom">
              {st.frame.border && (
                <>
                  <input type="color" className="sk-color" value={st.frame.borderColor} title="Couleur du filet" onChange={(e) => push({ ...st, frame: { ...st.frame, borderColor: e.target.value } })} />
                  <label className="sk-num">ép. <input type="number" min={1} max={200} value={st.frame.borderWidth} onChange={(e) => push({ ...st, frame: { ...st.frame, borderWidth: Number(e.target.value) } })} /></label>
                </>
              )}
              {st.frame.rounded && (
                <label className="sk-num">rayon <input type="number" min={0} max={9999} value={st.frame.radius} onChange={(e) => push({ ...st, frame: { ...st.frame, radius: Number(e.target.value) } })} /></label>
              )}
              {st.frame.vignette && (
                <label className="sk-num">vig. <input type="number" min={0} max={1} step={0.05} value={st.frame.vig} onChange={(e) => push({ ...st, frame: { ...st.frame, vig: Number(e.target.value) } })} /></label>
              )}
              {st.frame.mat && (
                <>
                  <input type="color" className="sk-color" value={st.frame.matColor} title="Couleur de la marge" onChange={(e) => push({ ...st, frame: { ...st.frame, matColor: e.target.value } })} />
                  <label className="sk-num">marge <input type="number" min={0} max={800} value={st.frame.matSize} onChange={(e) => push({ ...st, frame: { ...st.frame, matSize: Number(e.target.value) } })} /></label>
                  <label className="sk-check"><input type="checkbox" checked={st.frame.polaroid} onChange={(e) => push({ ...st, frame: { ...st.frame, polaroid: e.target.checked } })} /> polaroid</label>
                </>
              )}
              <label className="sk-check"><input type="checkbox" checked={st.frame.double} onChange={(e) => push({ ...st, frame: { ...st.frame, double: e.target.checked } })} /> double</label>
              <label className="sk-check"><input type="checkbox" checked={st.frame.torn} onChange={(e) => push({ ...st, frame: { ...st.frame, torn: e.target.checked } })} /> déchiré</label>
              <label className="sk-check"><input type="checkbox" checked={st.frame.burnt} onChange={(e) => push({ ...st, frame: { ...st.frame, burnt: e.target.checked } })} /> brûlé</label>
            </span>
          )}
        </div>
      )}

      {tab === 'calques' && (
        <div className="sk-panel">
          <button className="sk-btn" title="Ajouter un calque texte" onClick={addText}>T Texte</button>
          <button className="sk-btn" title="Ajouter un sticker" onClick={() => addSticker(STICKERS[0])}>😄 Sticker</button>
          {st.layers.length > 0 && (
            <>
              <div className="sk-tb-sep" />
              <span className="sk-preset-row sk-preset-wrap">
                {st.layers.map((l) => (
                  <button key={l.id} className={`sk-preset${selLayer === l.id ? ' active' : ''}`} title="Sélectionner ce calque" onClick={() => setSelLayer(l.id)}>
                    {l.kind === 'text' ? 'T' : l.emoji} {l.kind === 'text' ? ((l as TextLayer).text.split('\n')[0].slice(0, 18) || 'Texte') : 'sticker'}
                  </button>
                ))}
              </span>
              <span className="sk-frame-hint">Sélectionne un calque, puis glisse-le sur l’image</span>
            </>
          )}
        </div>
      )}

      {tab === 'exporter' && (
        <div className="sk-panel">
          <select className="sk-input" value={fmtIdx} onChange={(e) => setFmtIdx(Number(e.target.value))} title="Format d'export">
            {EXPORT_FORMATS.map((f, i) => (
              <option key={f.ext} value={i}>{f.label}</option>
            ))}
          </select>
          <button className="sk-btn primary" onClick={() => void exportCurrent(false)}>
            ⬇ Exporter{estSize ? ` ≈ ${estSize}` : ''}
          </button>
          <button className="sk-btn" title="Remplacer l'image dans la bibliothèque (l'original est conservé)" onClick={() => void exportCurrent(true)}>
            💾 Enregistrer
          </button>
        </div>
      )}
      {layer && (
        <div className="sk-layer-panel">
          <div className="sk-layer-head">
            <strong>{layer.kind === 'text' ? 'T Calque texte' : `😄 Sticker ${layer.kind === 'sticker' ? layer.emoji : ''}`}</strong>
            <span className="sk-tb-group">
              <button className="sk-btn ghost" onClick={commitLayers} title="Valider dans l’historique">✔ Terminé</button>
              <button className="sk-btn danger" onClick={() => delLayer(layer.id)}>🗑</button>
              <button className="sk-btn ghost" onClick={() => setSelLayer(null)}>✕</button>
            </span>
          </div>
          {textLayer && (
            <div className="sk-layer-body">
              <textarea className="sk-input sk-layer-text" rows={3} value={textLayer.text} onChange={(e) => patchLayer(layer.id, { text: e.target.value } as Partial<Layer>)} />
              <div className="sk-layer-grid">
                <label className="sk-field">
                  Police
                  <select className="sk-input" value={textLayer.font} onChange={(e) => patchLayer(layer.id, { font: e.target.value } as Partial<Layer>)}>
                    {FONTS.map((f) => (
                      <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                  </select>
                </label>
                <label className="sk-field">
                  Taille ({Math.round(textLayer.size * 100)} % de la largeur)
                  <input type="range" min={0.01} max={0.3} step={0.005} value={textLayer.size} onChange={(e) => patchLayer(layer.id, { size: Number(e.target.value) } as Partial<Layer>)} />
                </label>
                <label className="sk-field">
                  Couleur
                  <input type="color" className="sk-color" value={textLayer.color} onChange={(e) => patchLayer(layer.id, { color: e.target.value } as Partial<Layer>)} />
                </label>
                <label className="sk-field">
                  Fond
                  <span className="sk-tb-group">
                    <input type="color" className="sk-color" value={textLayer.bg} onChange={(e) => patchLayer(layer.id, { bg: e.target.value } as Partial<Layer>)} />
                    <input type="range" min={0} max={1} step={0.05} value={textLayer.bgOpacity} title="Opacité du fond" onChange={(e) => patchLayer(layer.id, { bgOpacity: Number(e.target.value) } as Partial<Layer>)} />
                  </span>
                </label>
                <label className="sk-field">
                  Interligne ({textLayer.lineHeight.toFixed(2)})
                  <input type="range" min={1} max={2.5} step={0.05} value={textLayer.lineHeight} onChange={(e) => patchLayer(layer.id, { lineHeight: Number(e.target.value) } as Partial<Layer>)} />
                </label>
                <label className="sk-field">
                  Style
                  <span className="sk-tb-group">
                    <label className="sk-check"><input type="checkbox" checked={textLayer.bold} onChange={(e) => patchLayer(layer.id, { bold: e.target.checked } as Partial<Layer>)} /> G</label>
                    <label className="sk-check"><input type="checkbox" checked={textLayer.italic} onChange={(e) => patchLayer(layer.id, { italic: e.target.checked } as Partial<Layer>)} /> I</label>
                    <select className="sk-input sk-align" value={textLayer.align} onChange={(e) => patchLayer(layer.id, { align: e.target.value } as Partial<Layer>)}>
                      <option value="left">⬅ gauche</option>
                      <option value="center">⬅➡ centré</option>
                      <option value="right">➡ droite</option>
                    </select>
                  </span>
                </label>
              </div>
            </div>
          )}
          {layer.kind === 'sticker' && (
            <div className="sk-layer-body">
              <label className="sk-field">
                Taille ({Math.round(layer.size * 100)} %)
                <input type="range" min={0.03} max={0.6} step={0.01} value={layer.size} onChange={(e) => patchLayer(layer.id, { size: Number(e.target.value) } as Partial<Layer>)} />
              </label>
              <div className="sk-sticker-grid">
                {STICKERS.map((em) => (
                  <button key={em} className={`sk-sticker-btn${layer.kind === 'sticker' && layer.emoji === em ? ' active' : ''}`} onClick={() => patchLayer(layer.id, { emoji: em } as Partial<Layer>)}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="sk-canvas-wrap" ref={wrapRef}>
        {bmp ? (
          <canvas
            ref={canvasRef}
            className={`sk-canvas${cropMode ? ' cropping' : ''}${compare ? ' comparing' : ''}`}
            onMouseDown={onCanvasDown}
            onMouseMove={onCanvasMove}
            onMouseUp={onCanvasUp}
            onMouseLeave={() => {
              if (cropMode && drag) applyCrop()
              onCanvasUp()
            }}
          />
        ) : (
          <div className="sk-hint">Chargement de l'image…</div>
        )}
        {cropMode && <p className="sk-hint sk-crop-hint">Glisse sur l'image pour définir le recadrage, choisis un ratio ci-dessus.</p>}
      </div>

      <div className="sk-zoombar">
        <button className="sk-btn ghost" onClick={() => setZoom(1)} title="Ajuster à la fenêtre">Fit</button>
        <button className="sk-btn ghost" onClick={() => setZoom(1 / (geomRef.current?.fit || 1))}>100 %</button>
        <button className="sk-btn ghost" onClick={() => setZoom(2 / (geomRef.current?.fit || 1))}>200 %</button>
        <input
          type="range"
          min={10}
          max={400}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          title="Zoom"
        />
        <span className="sk-zoom-val">{Math.round(zoom * (geomRef.current?.fit ?? 1) * 100)} %</span>
      </div>
    </div>
  )
}
