import { useState } from 'react'
import { notify } from '../../shared/notify'
import { useDismiss } from '../../shared/useDismiss'
import { imageUrl, quotaWarning, resizeImage, validateSheet } from './sheets'
import type { Category, Sheet, SheetValues } from './store'

interface Props {
  category: Category
  sheet?: Sheet
  onSave: (s: { title: string; note: number; fav: boolean; comment: string; image: Blob | null; values: SheetValues }) => void
  onClose: () => void
}

export default function SheetModal({ category, sheet, onSave, onClose }: Props): JSX.Element {
  const [title, setTitle] = useState(sheet?.title ?? '')
  const [note, setNote] = useState(String(sheet?.note ?? 5))
  const [fav, setFav] = useState(sheet?.fav ?? false)
  const [comment, setComment] = useState(sheet?.comment ?? '')
  const [image, setImage] = useState<Blob | null>(sheet?.image ?? null)
  const [values, setValues] = useState<SheetValues>(sheet?.values ?? {})
  useDismiss('fi-sheet', true, onClose)

  const setVal = (fid: string, v: unknown): void => setValues((prev) => ({ ...prev, [fid]: v }))

  const submit = (): void => {
    const n = Number(String(note).replace(',', '.'))
    const err = validateSheet(category, title, n, values)
    if (err) {
      notify(err)
      return
    }
    onSave({ title, note: n, fav, comment, image, values })
  }

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const w = await quotaWarning()
    if (w) notify(w)
    setImage(await resizeImage(f))
  }

  const img = imageUrl(image)

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={sheet ? 'Modifier la fiche' : 'Nouvelle fiche'}>
        <div className="modal-head">
          <strong>{sheet ? 'Modifier la fiche' : `Nouvelle fiche — ${category.name}`}</strong>
          <button type="button" className="db-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <label className="settings-field">
          <span>Titre *</span>
          <input aria-label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="settings-field">
          <span>Note sur 10</span>
          <input aria-label="Note sur 10" type="number" min={0} max={10} step={0.5} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="settings-check">
          <input type="checkbox" aria-label="Favori" checked={fav} onChange={(e) => setFav(e.target.checked)} />
          <span>Favori ★</span>
        </label>
        <label className="settings-field">
          <span>Image (redimensionnée à ~400 px max)</span>
          <input type="file" accept="image/*" aria-label="Image de la fiche" onChange={(e) => void onImage(e)} />
          {img && <img className="fi-sheet-img-preview" src={img} alt="Aperçu" />}
        </label>
        {category.fields.map((f) => (
          <label key={f.id} className="settings-field">
            <span>
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'texte' && (
              <input aria-label={`Champ ${f.label}`} value={String(values[f.id] ?? '')} onChange={(e) => setVal(f.id, e.target.value)} />
            )}
            {f.type === 'texte-long' && (
              <textarea aria-label={`Champ ${f.label}`} rows={3} value={String(values[f.id] ?? '')} onChange={(e) => setVal(f.id, e.target.value)} />
            )}
            {f.type === 'nombre' && (
              <input aria-label={`Champ ${f.label}`} type="number" step="any" value={values[f.id] === undefined ? '' : String(values[f.id])} onChange={(e) => setVal(f.id, e.target.value === '' ? '' : Number(e.target.value))} />
            )}
            {f.type === 'date' && (
              <input aria-label={`Champ ${f.label}`} type="date" value={String(values[f.id] ?? '')} onChange={(e) => setVal(f.id, e.target.value)} />
            )}
            {f.type === 'liste' && (
              <select aria-label={`Champ ${f.label}`} value={String(values[f.id] ?? '')} onChange={(e) => setVal(f.id, e.target.value)}>
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            {f.type === 'case' && (
              <input type="checkbox" aria-label={`Champ ${f.label}`} checked={values[f.id] === true} onChange={(e) => setVal(f.id, e.target.checked)} />
            )}
          </label>
        ))}
        <label className="settings-field">
          <span>Commentaire</span>
          <textarea aria-label="Commentaire" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="db-btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="db-btn primary" aria-label="Enregistrer la fiche" onClick={submit}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
