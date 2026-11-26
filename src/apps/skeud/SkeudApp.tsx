import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppShell, { AppSkeleton } from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { useDismiss } from '../../shared/useDismiss'
import { zipFiles } from '../kod/zip'
import { delImage, listImages, putImage, uid, type SkImage } from './store'
import { batchName, DEFAULT_EDIT, EXPORT_FORMATS, fmtBytes, FRAME_PRESETS, framePresetOf, type EditState } from './logic'
import { canvasToBlob, downloadBlob, loadBitmap, renderEdit } from './render'
import EditorView from './views/EditorView'

export interface SkCtx {
  images: SkImage[]
  currentId: string | null
  select: (id: string | null) => void
  remove: (id: string) => Promise<void>
  saveEdited: (id: string, blob: Blob) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  selected: string[]
  toggleSel: (id: string) => void
  importFiles: (files: FileList | File[]) => Promise<void>
  batchState: EditState
  setBatchState: (st: EditState) => void
  runBatch: (formatIdx: number) => Promise<void>
}

export default function SkeudApp(): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState<SkImage[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [showBatch, setShowBatch] = useState(false)
  const [batchState, setBatchState] = useState<EditState>(DEFAULT_EDIT)
  const [batchFormat, setBatchFormat] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)
  useDismiss('sk-batch', showBatch, () => setShowBatch(false))

  const reload = useCallback(async () => {
    setImages(await listImages())
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const thumbs = useMemo(() => {
    const m = new Map<string, string>()
    for (const im of images) m.set(im.id, URL.createObjectURL(im.blob))
    return m
  }, [images])

  useEffect(() => () => {
    for (const u of thumbs.values()) URL.revokeObjectURL(u)
  }, [thumbs])

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    for (const f of list) {
      try {
        const bmp = await loadBitmap(f)
        const img: SkImage = {
          id: uid(), name: f.name, type: f.type || 'image/png', size: f.size,
          w: bmp.width, h: bmp.height, blob: f, orig: f, createdAt: Date.now(), updatedAt: Date.now()
        }
        bmp.close()
        await putImage(img)
        setImages((prev) => [...prev, img].sort((a, b) => a.createdAt - b.createdAt))
      } catch {
        notify(`« ${f.name} » illisible (format non supporté ?)`)
      }
    }
    if (list.length) notify(`${list.length} image(s) importée(s) 🖼️`)
  }, [])

  const remove = useCallback(async (id: string) => {
    await delImage(id)
    setImages((prev) => prev.filter((x) => x.id !== id))
    setSel((prev) => prev.filter((x) => x !== id))
    setCurrentId((prev) => (prev === id ? null : prev))
  }, [])

  const saveEdited = useCallback(async (id: string, blob: Blob) => {
    const img = images.find((x) => x.id === id)
    if (!img) return
    const next = { ...img, blob, size: blob.size, updatedAt: Date.now() }
    await putImage(next)
    setImages((prev) => prev.map((x) => (x.id === id ? next : x)))
    notify('Version enregistrée dans la bibliothèque 💾 (original conservé)')
  }, [images])

  const rename = useCallback(async (id: string, name: string) => {
    const img = images.find((x) => x.id === id)
    if (!img || !name.trim()) return
    const next = { ...img, name: name.trim() }
    await putImage(next)
    setImages((prev) => prev.map((x) => (x.id === id ? next : x)))
  }, [images])

  const runBatch = useCallback(async (formatIdx: number) => {
    const fmt = EXPORT_FORMATS[formatIdx]
    const targets = images.filter((x) => sel.includes(x.id))
    if (!targets.length) return
    setShowBatch(false)
    notify(`Traitement de ${targets.length} image(s)… ⚙️`)
    const entries: { name: string; data: Uint8Array }[] = []
    for (let i = 0; i < targets.length; i++) {
      const im = targets[i]
      try {
        const bmp = await loadBitmap(im.orig)
        const canvas = renderEdit(bmp, batchState)
        bmp.close()
        const blob = await canvasToBlob(canvas, fmt.type, fmt.quality)
        entries.push({ name: batchName(im.name, fmt.ext, i, targets.length), data: new Uint8Array(await blob.arrayBuffer()) })
      } catch {
        notify(`« ${im.name} » ignorée (illisible)`)
      }
    }
    if (entries.length) {
      const zip = await zipFiles(entries)
      await downloadBlob(zip, `skeud-lot-${targets.length}images.zip`)
      notify(`${entries.length} image(s) exportées en ZIP 📦`)
    }
  }, [images, sel, batchState])

  const current = images.find((x) => x.id === currentId) ?? null

  const ctx: SkCtx = {
    images, currentId, select: setCurrentId, remove, saveEdited, rename,
    selected: sel, toggleSel: (id) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    importFiles, batchState, setBatchState, runBatch
  }

  const sidebar = (
    <div className="sk-side">
      <button className="sk-btn primary sk-import" onClick={() => fileRef.current?.click()}>
        ⬆ Importer des images
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="sk-hint">{images.length} image(s) · coche pour le lot</p>
      <ul className="sk-lib">
        {images.map((im) => (
          <li
            key={im.id}
            className={`sk-lib-item${currentId === im.id ? ' active' : ''}${sel.includes(im.id) ? ' selected' : ''}`}
            onClick={() => setCurrentId(im.id)}
          >
            <input
              type="checkbox"
              className="sk-batch-check"
              checked={sel.includes(im.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => ctx.toggleSel(im.id)}
              title="Inclure dans le traitement par lot"
            />
            <img className="sk-thumb" src={thumbs.get(im.id)} alt={im.name} loading="lazy" />
            <span className="sk-lib-meta">
              <span className="sk-lib-name" title={im.name}>{im.name}</span>
              <span className="sk-lib-sub">{im.w}×{im.h} · {fmtBytes(im.size)}</span>
            </span>
            <button
              className="sk-mini"
              title="Supprimer"
              onClick={(e) => {
                e.stopPropagation()
                void remove(im.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
        {images.length === 0 && <li className="sk-hint">Aucune image — importe ou glisse-dépose ici.</li>}
      </ul>
    </div>
  )

  return (
    <AppShell
      appId="skeud"
      appName="Skeud"
      logo={`${import.meta.env.BASE_URL}app-icons/skeud.svg`}
      sidebar={sidebar}
      mainClass="blocs-main sk-main"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files)
      }}
    >
      {loading ? (
        <AppSkeleton />
      ) : current ? (
        <EditorView key={current.id} img={current} ctx={ctx} />
      ) : (
        <div className="sk-empty">
          <div className="sk-empty-icon">🖼️</div>
          <h2>Ta bibliothèque d'images</h2>
          <p className="sk-hint">
            Glisse des images n'importe où dans la fenêtre, ou utilise « ⬆ Importer ».
            <br />
            Recadrage, filtres, cadres, redimensionnement, traitement par lot en ZIP — 100 % local, rien ne quitte ton navigateur.
          </p>
          <button className="sk-btn primary" onClick={() => fileRef.current?.click()}>
            ⬆ Importer des images
          </button>
        </div>
      )}

      {sel.length >= 2 && (
        <div className="sk-batch-bar">
          <span>☑ {sel.length} image(s) sélectionnée(s)</span>
          <button className="sk-btn primary" onClick={() => setShowBatch(true)}>
            ⚙️ Traiter par lot
          </button>
          <button className="sk-btn ghost" onClick={() => setSel([])}>
            ✕ Tout désélectionner
          </button>
        </div>
      )}

      {showBatch && (
        <div className="ck-pop-backdrop">
          <div className="ck-pop" data-pop="sk-batch">
            <h3>⚙️ Traitement par lot ({sel.length} images)</h3>
            <p className="sk-hint">Applique les réglages ci-dessous à chaque image sélectionnée (depuis leur original), exportées en ZIP.</p>
            <label className="sk-field">
              Format de sortie
              <select className="sk-input" value={batchFormat} onChange={(e) => setBatchFormat(Number(e.target.value))}>
                {EXPORT_FORMATS.map((f, i) => (
                  <option key={f.ext} value={i}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="sk-field">
              Cadre
              <select
                className="sk-input"
                value={framePresetOf(batchState.frame)?.id ?? ''}
                onChange={(e) => {
                  const p = FRAME_PRESETS.find((x) => x.id === e.target.value)
                  if (p) setBatchState({ ...batchState, frame: { ...p.frame } })
                }}
              >
                {FRAME_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                ))}
              </select>
            </label>
            <label className="sk-field">
              Luminosité ({Math.round(batchState.filter.brightness * 100)} %)
              <input
                type="range" min={0.5} max={1.5} step={0.05}
                value={batchState.filter.brightness}
                onChange={(e) => setBatchState({ ...batchState, filter: { ...batchState.filter, brightness: Number(e.target.value) } })}
              />
            </label>
            <label className="sk-field">
              Contraste ({Math.round(batchState.filter.contrast * 100)} %)
              <input
                type="range" min={0.5} max={1.5} step={0.05}
                value={batchState.filter.contrast}
                onChange={(e) => setBatchState({ ...batchState, filter: { ...batchState.filter, contrast: Number(e.target.value) } })}
              />
            </label>
            <label className="sk-field">
              Saturation ({Math.round(batchState.filter.saturation * 100)} %)
              <input
                type="range" min={0} max={2} step={0.05}
                value={batchState.filter.saturation}
                onChange={(e) => setBatchState({ ...batchState, filter: { ...batchState.filter, saturation: Number(e.target.value) } })}
              />
            </label>
            <div className="ck-pop-actions">
              <button className="sk-btn ghost" onClick={() => setShowBatch(false)}>Annuler</button>
              <button className="sk-btn primary" onClick={() => void runBatch(batchFormat)}>Lancer le lot 🚀</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
