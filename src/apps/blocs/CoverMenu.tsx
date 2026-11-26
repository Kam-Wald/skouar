import { useRef, useState } from 'react'
import { notify } from './notify'
import { COVER_COLORS, COVER_PATTERNS, coverStyle, type CoverDef } from './covers'

export default function CoverMenu({
  anchor,
  onSelect,
  onClose
}: {
  anchor: { x: number; y: number }
  onSelect: (cover: CoverDef | null) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'color' | 'pattern' | 'url'>('color')
  const [url, setUrl] = useState('')
  const [patColor, setPatColor] = useState('#312e81')
  const fileRef = useRef<HTMLInputElement>(null)
  const x = Math.min(anchor.x, Math.max(8, window.innerWidth - 320))

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 2_000_000) {
      notify('Image trop lourde (max 2 Mo).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onSelect({ kind: 'file', value: String(reader.result) })
      onClose()
    }
    reader.readAsDataURL(f)
  }

  return (
    <div className="cover-menu" data-pop="cover" style={{ left: x, top: anchor.y + 8 }}>
      <div className="cover-tabs">
        <button className={tab === 'color' ? 'active' : ''} onClick={() => setTab('color')}>
          🎨 Couleur
        </button>
        <button className={tab === 'pattern' ? 'active' : ''} onClick={() => setTab('pattern')}>
          〰️ Motif
        </button>
        <button className={tab === 'url' ? 'active' : ''} onClick={() => setTab('url')}>
          🔗 URL
        </button>
        <button onClick={() => fileRef.current?.click()}>📤 Fichier</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      {tab === 'color' && (
        <div className="cover-swatches">
          {COVER_COLORS.map((c) => (
            <button
              key={c}
              className="cover-swatch"
              style={{ backgroundColor: c }}
              title={c}
              onClick={() => {
                onSelect({ kind: 'color', value: c })
                onClose()
              }}
            />
          ))}
        </div>
      )}
      {tab === 'pattern' && (
        <>
          <div className="emoji-colors" style={{ marginBottom: 8 }}>
            {COVER_COLORS.map((c) => (
              <button
                key={c}
                className={`emoji-color${patColor === c ? ' active' : ''}`}
                style={{ backgroundColor: c }}
                title={c}
                onClick={() => setPatColor(c)}
              />
            ))}
          </div>
          <div className="cover-patterns">
            {COVER_PATTERNS.map((p) => (
              <button
                key={p.id}
                className="cover-pattern"
                style={coverStyle({ kind: 'pattern', value: `${p.id}|${patColor}` })}
                title={p.name}
                onClick={() => {
                  onSelect({ kind: 'pattern', value: `${p.id}|${patColor}` })
                  onClose()
                }}
              />
            ))}
          </div>
        </>
      )}
      {tab === 'url' && (
        <div className="cover-url">
          <input
            className="db-input"
            autoFocus
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) {
                onSelect({ kind: 'url', value: url.trim() })
                onClose()
              }
              if (e.key === 'Escape') onClose()
            }}
          />
          <button
            className="db-btn"
            onClick={() => {
              if (url.trim()) {
                onSelect({ kind: 'url', value: url.trim() })
                onClose()
              }
            }}
          >
            Valider
          </button>
        </div>
      )}
      <button className="cover-clear" onClick={() => { onSelect(null); onClose() }}>
        ✕ Supprimer la couverture
      </button>
    </div>
  )
}
