import { useState } from 'react'
import { fmtDate, fmtNote, imageUrl } from './sheets'
import type { Category, Sheet } from './store'

export function fieldDisplay(cat: Category, s: Sheet, fid: string): string {
  const f = cat.fields.find((x) => x.id === fid)
  const v = s.values[fid]
  if (v === undefined || v === null || v === '') return '—'
  if (!f) return String(v)
  if (f.type === 'case') return v === true ? 'Oui' : 'Non'
  if (f.type === 'date') return fmtDate(Date.parse(String(v)) || 0)
  if (f.type === 'liste' && Array.isArray(v)) return v.join(', ')
  return String(v)
}

export function SheetCard({ s, onOpen }: { s: Sheet; onOpen: () => void }): JSX.Element {
  const img = imageUrl(s.image)
  return (
    <button type="button" className="fi-sheet-card" onClick={onOpen}>
      {img && <img className="fi-sheet-img" src={img} alt="" />}
      <strong className="fi-sheet-title">{s.title}</strong>
      <span className="fi-sheet-meta">
        <span className="fi-sheet-note">{fmtNote(s.note)}</span>
        {s.fav && <span className="fi-sheet-fav">★</span>}
      </span>
    </button>
  )
}

interface Props {
  sheet: Sheet
  category: Category
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onRenote: (value: number) => void
  onToggleFav: () => void
}

export default function SheetView({ sheet, category, onBack, onEdit, onDelete, onRenote, onToggleFav }: Props): JSX.Element {
  const [renote, setRenote] = useState('')
  const [armed, setArmed] = useState(false)
  const img = imageUrl(sheet.image)

  return (
    <section className="fi-view fi-sheet">
      <div className="fi-cat-head">
        <button type="button" className="unvez-btn" onClick={onBack}>
          ← Retour
        </button>
        <span className="fi-cat-actions">
          <button type="button" className="unvez-btn" onClick={onEdit}>
            Modifier
          </button>
          <button
            type="button"
            className={`unvez-btn${armed ? ' danger armed' : ''}`}
            onClick={() => {
              if (!armed) {
                setArmed(true)
                return
              }
              onDelete()
            }}
          >
            {armed ? 'Confirmer la suppression ?' : 'Supprimer'}
          </button>
        </span>
      </div>
      {img && <img className="fi-sheet-hero" src={img} alt="" />}
      <h2>
        {sheet.title}{' '}
        <button type="button" className={`fi-fav-toggle${sheet.fav ? ' active' : ''}`} aria-label="Favori" aria-pressed={sheet.fav} onClick={onToggleFav}>
          ★
        </button>
      </h2>
      <p className="fi-sheet-note-big">{fmtNote(sheet.note)}</p>
      <div className="fi-renote">
        <input
          aria-label="Nouvelle note"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={renote}
          onChange={(e) => setRenote(e.target.value)}
        />
        <button
          type="button"
          className="unvez-btn"
          onClick={() => {
            const v = Number(String(renote).replace(',', '.'))
            if (!isFinite(v) || v < 0 || v > 10) return
            onRenote(v)
            setRenote('')
          }}
        >
          Re-noter
        </button>
      </div>
      {sheet.notes.length > 1 && (
        <ol className="fi-notes-history" aria-label="Historique des notes">
          {[...sheet.notes].reverse().map((n, i) => (
            <li key={`${n.date}-${i}`}>
              <strong>{fmtNote(n.value)}</strong> <small>{fmtDate(n.date)}</small>
            </li>
          ))}
        </ol>
      )}
      <dl className="fi-fields">
        {category.fields.map((f) => (
          <div key={f.id} className="fi-field-line">
            <dt>{f.label}</dt>
            <dd>{fieldDisplay(category, sheet, f.id)}</dd>
          </div>
        ))}
      </dl>
      {sheet.comment && <p className="fi-comment">{sheet.comment}</p>}
      <p className="fi-added">Ajoutée le {fmtDate(sheet.createdAt)}</p>
    </section>
  )
}
