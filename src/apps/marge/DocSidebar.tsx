import DocThumb from './Thumb'
import type { MargeDoc } from './store'
import { ZOOMS, type DocViewer } from './viewer'

interface Props {
  doc: MargeDoc
  v: DocViewer
  onClose: () => void
}

export default function DocSidebar({ doc, v, onClose }: Props) {
  return (
    <>
      <div className="marge-side">
        <button className="db-btn marge-side-btn" onClick={onClose}>
          ← Bibliothèque
        </button>
      </div>
      <div className="marge-side marge-side-scroll">
        <div className="marge-side-label">Zoom / page</div>
        <div className="marge-viewopts">
          <select
            className="db-input"
            value={String(v.scale)}
            onChange={(e) => v.zoomTo(Number(e.target.value))}
            title="Zoom"
          >
            {ZOOMS.map((z) => (
              <option key={z} value={String(z)}>
                {Math.round(z * 100)} %
              </option>
            ))}
          </select>
          <button
            className="db-btn"
            title="Ajuster à la largeur"
            onClick={() => {
              const root = document.querySelector('.marge-main') as HTMLElement | null
              if (root) v.fitWidth(root.clientWidth)
            }}
          >
            ↔ largeur
          </button>
        </div>
        <div className="marge-viewopts">
          <button className="db-btn" onClick={() => v.gotoPage(v.page - 1)} disabled={v.page <= 1}>
            ‹
          </button>
          <input
            className="db-input marge-page-in"
            type="number"
            min={1}
            max={v.numPages}
            value={v.page}
            onChange={(e) => v.gotoPage(Number(e.target.value) || 1)}
          />
          <span className="marge-muted">/ {v.numPages}</span>
          <button className="db-btn" onClick={() => v.gotoPage(v.page + 1)} disabled={v.page >= v.numPages}>
            ›
          </button>
        </div>
        <div className="marge-viewopts">
          <button
            className={`db-btn${v.twoPages ? ' active' : ''}`}
            title="2 pages côte à côte"
            onClick={v.toggleTwoPages}
          >
            ▥ 2 pages
          </button>
          <button className="db-btn" title="Rotation -90°" onClick={() => v.rotate(270)}>
            ⟲
          </button>
          <button className="db-btn" title="Rotation +90°" onClick={() => v.rotate(90)}>
            ⟳
          </button>
          <button
            className={`db-btn${v.night ? ' active' : ''}`}
            title="Mode nuit (inversion)"
            onClick={v.toggleNight}
          >
            🌙
          </button>
          <button className="db-btn" title="Mode présentation (plein écran, Échap pour sortir)" onClick={() => v.setPresent(true)}>
            ⛶ présenter
          </button>
          <button className="db-btn" title="Rechercher (Ctrl+F)" onClick={() => v.setSearchOpen(true)}>
            🔍 rechercher
          </button>
        </div>
        {v.outline.length > 0 && (
          <>
            <div className="marge-side-label">Sommaire</div>
            <div className="marge-outline">
              {v.outline.map((o, i) => (
                <button key={i} className="marge-outline-item" onClick={() => v.gotoPage(o.page)}>
                  {o.title}
                  <span className="marge-muted">p.{o.page}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="marge-side-label">Pages</div>
        <div className="marge-thumbs">
          {Array.from({ length: v.numPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`marge-thumb${p === v.page ? ' on' : ''}`}
              onClick={() => v.gotoPage(p)}
              title={`Page ${p}`}
            >
              <DocThumb doc={doc} page={p} width={64} />
              <span className="marge-muted">{p}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
