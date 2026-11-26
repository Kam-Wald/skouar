import { useCallback, useEffect, useRef, useState } from 'react'
import type { SkCtx } from '../SkeudApp'
import {
  ASPECT_PRESETS,
  DEFAULT_EDIT,
  DEFAULT_FRAME,
  EXPORT_FORMATS,
  FILTER_PRESETS,
  FRAME_PRESETS,
  aspectLabel,
  exportName,
  framePresetOf,
  outDims,
  toImageRect,
  type EditState,
  type Rect
} from '../logic'
import { canvasToBlob, downloadBlob, loadBitmap, renderEdit } from '../render'
import type { SkImage } from '../store'
import { notify } from '../../../shared/notify'

const FILTER_SLIDERS: { key: 'brightness' | 'contrast' | 'saturation' | 'sepia' | 'grayscale' | 'hue'; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'brightness', label: 'Luminosité', min: 0.5, max: 1.5, step: 0.05, unit: '%' },
  { key: 'contrast', label: 'Contraste', min: 0.5, max: 1.5, step: 0.05, unit: '%' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.05, unit: '%' },
  { key: 'sepia', label: 'Sépia', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'grayscale', label: 'N&B', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'hue', label: 'Teinte', min: 0, max: 360, step: 5, unit: '°' }
]

export default function EditorView({ img, ctx }: { img: SkImage; ctx: SkCtx }): JSX.Element {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null)
  const [st, setSt] = useState<EditState>({ ...DEFAULT_EDIT, filter: { ...DEFAULT_EDIT.filter }, frame: { ...DEFAULT_EDIT.frame } })
  const [hist, setHist] = useState<EditState[]>([])
  const [hi, setHi] = useState(-1)
  const [cropMode, setCropMode] = useState(false)
  const [aspect, setAspect] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  const [fmtIdx, setFmtIdx] = useState(1)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(img.name)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

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
    const s = Math.min(1, maxW / dims.w, 620 / dims.h)
    const preview = renderEdit(bmp, cropView, maxW)
    const c = canvasRef.current
    c.width = Math.max(1, Math.round(preview.width * s))
    c.height = Math.max(1, Math.round(preview.height * s))
    const cx = c.getContext('2d')!
    cx.imageSmoothingQuality = 'high'
    cx.clearRect(0, 0, c.width, c.height)
    cx.drawImage(preview, 0, 0, c.width, c.height)
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
  }, [bmp, st, cropMode, drag, img.w, img.h])

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

  const exportCurrent = async (save: boolean): Promise<void> => {
    if (!bmp) return
    const canvas = renderEdit(bmp, st)
    const fmt = EXPORT_FORMATS[fmtIdx]
    const blob = await canvasToBlob(canvas, fmt.type, fmt.quality)
    if (save) await ctx.saveEdited(img.id, blob)
    else await downloadBlob(blob, exportName(img.name, fmt.ext))
    if (!save) notify(`Exporté : ${exportName(img.name, fmt.ext)} ⬇`)
  }

  const dims = outDims(img.w, img.h, st)
  const dirty = hi >= 0
  const activeFrame = framePresetOf(st.frame)

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
              setSt({ ...DEFAULT_EDIT, filter: { ...DEFAULT_EDIT.filter }, frame: { ...DEFAULT_EDIT.frame } })
            }}
          >
            Reset
          </button>
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tb-group">
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
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tb-group">
          <button className="sk-btn" title="Pivoter 90°" onClick={() => push({ ...st, rot: ((st.rot + 90) % 360) as EditState['rot'] })}>⟳ 90°</button>
          <button className="sk-btn" title="Miroir horizontal" onClick={() => push({ ...st, flipH: !st.flipH })}>🪞 H</button>
          <button className="sk-btn" title="Miroir vertical" onClick={() => push({ ...st, flipV: !st.flipV })}>🪞 V</button>
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tb-group sk-presets">
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
        </div>
        <div className="sk-tb-group sk-filters">
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
                {sl.key === 'hue' ? `${Math.round(st.filter.hue)}°` : `${Math.round(st.filter[sl.key] * 100)}${sl.unit}`}
              </span>
            </label>
          ))}
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tb-group sk-frames">
          <span className="sk-tb-label">Cadre</span>
          <span className="sk-preset-row">
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
          <span className="sk-frame-hint">Bordure = filet SUR l’image · Passe-partout = marge AUTOUR</span>
          {(st.frame.border || st.frame.rounded || st.frame.vignette || st.frame.mat) && (
            <span className="sk-frame-custom">
              {st.frame.border && (
                <>
                  <input type="color" className="sk-color" value={st.frame.borderColor} title="Couleur du filet" onChange={(e) => push({ ...st, frame: { ...st.frame, borderColor: e.target.value } })} />
                  <label className="sk-num">
                    ép.{' '}
                    <input type="number" min={1} max={200} value={st.frame.borderWidth} onChange={(e) => push({ ...st, frame: { ...st.frame, borderWidth: Number(e.target.value) } })} />
                  </label>
                </>
              )}
              {st.frame.rounded && (
                <label className="sk-num">
                  rayon{' '}
                  <input type="number" min={0} max={9999} value={st.frame.radius} onChange={(e) => push({ ...st, frame: { ...st.frame, radius: Number(e.target.value) } })} />
                </label>
              )}
              {st.frame.vignette && (
                <label className="sk-num">
                  vig.{' '}
                  <input type="number" min={0} max={1} step={0.05} value={st.frame.vig} onChange={(e) => push({ ...st, frame: { ...st.frame, vig: Number(e.target.value) } })} />
                </label>
              )}
              {st.frame.mat && (
                <>
                  <input type="color" className="sk-color" value={st.frame.matColor} title="Couleur de la marge" onChange={(e) => push({ ...st, frame: { ...st.frame, matColor: e.target.value } })} />
                  <label className="sk-num">
                    marge{' '}
                    <input type="number" min={0} max={800} value={st.frame.matSize} onChange={(e) => push({ ...st, frame: { ...st.frame, matSize: Number(e.target.value) } })} />
                  </label>
                  <label className="sk-check">
                    <input type="checkbox" checked={st.frame.polaroid} onChange={(e) => push({ ...st, frame: { ...st.frame, polaroid: e.target.checked } })} /> polaroid
                  </label>
                </>
              )}
            </span>
          )}
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tb-group">
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
            <button className="sk-btn ghost" onClick={() => push({ ...st, size: null })}>
              Taille d'origine
            </button>
          )}
        </div>
        <div className="sk-tb-sep" />
        <div className="sk-tb-group">
          <select className="sk-input" value={fmtIdx} onChange={(e) => setFmtIdx(Number(e.target.value))} title="Format d'export">
            {EXPORT_FORMATS.map((f, i) => (
              <option key={f.ext} value={i}>{f.label}</option>
            ))}
          </select>
          <button className="sk-btn primary" onClick={() => void exportCurrent(false)}>⬇ Exporter</button>
          <button className="sk-btn" title="Remplacer l'image dans la bibliothèque (l'original est conservé)" onClick={() => void exportCurrent(true)}>
            💾 Enregistrer
          </button>
        </div>
      </div>

      <div className="sk-canvas-wrap" ref={wrapRef}>
        {bmp ? (
          <canvas
            ref={canvasRef}
            className={`sk-canvas${cropMode ? ' cropping' : ''}`}
            onMouseDown={(e) => {
              if (!cropMode) return
              setDrag({ a: canvasPos(e), b: canvasPos(e) })
            }}
            onMouseMove={(e) => {
              if (!cropMode || !drag) return
              setDrag({ a: drag.a, b: canvasPos(e) })
            }}
            onMouseUp={() => {
              if (cropMode) applyCrop()
            }}
            onMouseLeave={() => {
              if (cropMode && drag) applyCrop()
            }}
          />
        ) : (
          <div className="sk-hint">Chargement de l'image…</div>
        )}
        {cropMode && <p className="sk-hint sk-crop-hint">Glisse sur l'image pour définir le recadrage, choisis un ratio ci-dessus.</p>}
      </div>
    </div>
  )
}
