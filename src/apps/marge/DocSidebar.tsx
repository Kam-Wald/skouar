import DocThumb from './Thumb'
import { COLORS, iconOf, STAMPS, TEXT_SIZES, TOOLS } from './annot'
import { deleteAnnot } from './store'
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
        <div className="marge-side-label">Outils</div>
        <div className="marge-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`marge-tool${v.tool === t.id ? ' active' : ''}`}
              onClick={() => v.setTool(t.id)}
              title={`${t.label} (touche ${t.key})`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="marge-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`marge-dot${v.color === c ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => v.setColor(c)}
              title={c}
            />
          ))}
        </div>
        {v.tool === 'stamp' && (
          <select className="db-input" value={v.stampIdx} onChange={(e) => v.setStampIdx(Number(e.target.value))} title="Tampon">
            {STAMPS.map((s, i) => (
              <option key={s} value={i}>
                {s}
              </option>
            ))}
          </select>
        )}
        {v.tool === 'text' && (
          <select className="db-input" value={v.textSize} onChange={(e) => v.setTextSize(Number(e.target.value))} title="Taille du texte">
            {TEXT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        )}
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
        <div className="marge-side-label">Annotations ({v.annots.length})</div>
        <div className="marge-annots">
          {[...v.annots]
            .sort((a, b) => a.page - b.page || a.at - b.at)
            .map((a) => (
              <div key={a.id} className="marge-annot-row" onClick={() => v.gotoPage(a.page)}>
                <span className="marge-dot" style={{ background: a.color }} />
                <span className="marge-annot-txt">
                  {iconOf(a.type)} p.{a.page}
                  {a.text ? ` — ${a.text.slice(0, 40)}` : ''}
                </span>
                <button
                  className="marge-annot-del"
                  title="Supprimer l'annotation"
                  onClick={(e) => {
                    e.stopPropagation()
                    void deleteAnnot(a.id).then(() => v.reloadAnnots())
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          {v.annots.length === 0 && <p className="marge-empty">Aucune annotation — choisis un outil ci-dessus.</p>}
        </div>
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
