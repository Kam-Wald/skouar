import { useState } from 'react'
import { useDismiss } from '../../shared/useDismiss'
import { moveField, removeFieldFromCategory, restoreEquivalentField } from './categories'
import type { Category, FieldDef, FieldType } from './store'

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'texte', label: 'Texte court' },
  { value: 'texte-long', label: 'Texte long' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'liste', label: 'Liste de choix' },
  { value: 'case', label: 'Case à cocher' }
]

export interface CategoryDraft {
  id?: string
  name: string
  fields: FieldDef[]
  removedFields: FieldDef[]
  createdAt?: number
}

export default function CategoryModal({
  initial,
  onSave,
  onClose
}: {
  initial?: Category
  onSave: (c: CategoryDraft) => void
  onClose: () => void
}): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [fields, setFields] = useState<FieldDef[]>(initial?.fields ?? [])
  const [removedFields, setRemovedFields] = useState<FieldDef[]>(initial?.removedFields ?? [])
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<FieldType>('texte')
  const [newOptions, setNewOptions] = useState('')
  useDismiss('fi-cat', true, onClose)

  const addField = (): void => {
    const label = newLabel.trim()
    if (!label) return
    const opts = newType === 'liste' ? newOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined
    const base: Category = initial ?? { id: '', name: '', fields, removedFields, createdAt: 0 }
    const { cat } = restoreEquivalentField({ ...base, fields, removedFields }, label, newType, opts)
    setFields(cat.fields)
    setRemovedFields(cat.removedFields)
    setNewLabel('')
    setNewOptions('')
  }

  const updateField = (id: string, patch: Partial<FieldDef>): void => {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeField = (id: string): void => {
    const cat = removeFieldFromCategory({ ...(initial ?? { id: '', name: '', fields, removedFields, createdAt: 0 }), fields, removedFields }, id)
    setFields(cat.fields)
    setRemovedFields(cat.removedFields)
  }

  const valid = name.trim().length > 0 && fields.every((f) => f.label.trim().length > 0)

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={initial ? 'Paramètres de la catégorie' : 'Nouvelle catégorie'}>
        <div className="modal-head">
          <strong>{initial ? 'Paramètres de la catégorie' : 'Nouvelle catégorie'}</strong>
          <button type="button" className="db-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <label className="settings-field">
          <span>Nom</span>
          <input aria-label="Nom de la catégorie" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="settings-field">
          <span>Champs affichés (dans l'ordre)</span>
          {fields.length === 0 && <p className="settings-muted">Aucun champ — la fiche n'aura que titre, note, favori, image, commentaire.</p>}
          {fields.map((f, i) => (
            <div className="fi-field-row" key={f.id}>
              <input aria-label={`Libellé du champ ${i + 1}`} value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
              <select aria-label={`Type du champ ${i + 1}`} value={f.type} onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {f.type === 'liste' && (
                <input
                  aria-label={`Options du champ ${i + 1}`}
                  placeholder="Options séparées par des virgules"
                  value={(f.options ?? []).join(', ')}
                  onChange={(e) => updateField(f.id, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                />
              )}
              <label className="fi-field-req">
                <input
                  type="checkbox"
                  aria-label={`Champ ${i + 1} obligatoire`}
                  checked={f.required === true}
                  onChange={(e) => updateField(f.id, { required: e.target.checked })}
                />
                req
              </label>
              <button type="button" className="unvez-btn" aria-label={`Monter le champ ${i + 1}`} onClick={() => setFields(moveField({ ...(initial ?? { id: '', name: '', fields, removedFields, createdAt: 0 }), fields, removedFields }, f.id, -1).fields)}>
                ↑
              </button>
              <button type="button" className="unvez-btn" aria-label={`Descendre le champ ${i + 1}`} onClick={() => setFields(moveField({ ...(initial ?? { id: '', name: '', fields, removedFields, createdAt: 0 }), fields, removedFields }, f.id, 1).fields)}>
                ↓
              </button>
              <button type="button" className="unvez-btn" aria-label={`Retirer le champ ${i + 1}`} onClick={() => removeField(f.id)}>
                ✕
              </button>
            </div>
          ))}
          <div className="fi-field-row fi-field-new">
            <input aria-label="Nouveau champ" placeholder="Libellé du nouveau champ" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <select aria-label="Type du nouveau champ" value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {newType === 'liste' && (
              <input aria-label="Options du nouveau champ" placeholder="Options séparées par des virgules" value={newOptions} onChange={(e) => setNewOptions(e.target.value)} />
            )}
            <button type="button" className="unvez-btn" onClick={addField} disabled={!newLabel.trim()}>
              Ajouter le champ
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="db-btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="db-btn primary"
            aria-label="Enregistrer la catégorie"
            disabled={!valid}
            onClick={() => onSave({ id: initial?.id, name: name.trim(), fields, removedFields, createdAt: initial?.createdAt })}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteCategoryModal({
  category,
  sheetCount,
  others,
  onConfirm,
  onClose
}: {
  category: Category
  sheetCount: number
  others: Category[]
  onConfirm: (moveTo: string | null) => void
  onClose: () => void
}): JSX.Element {
  const [choice, setChoice] = useState<'delete' | 'move'>('delete')
  const [target, setTarget] = useState('')
  useDismiss('fi-del', true, onClose)
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Supprimer la catégorie">
        <div className="modal-head">
          <strong>Supprimer « {category.name} » ?</strong>
          <button type="button" className="db-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="settings-muted">
          {sheetCount === 0 ? 'Aucune fiche dans cette catégorie.' : `${sheetCount} fiche${sheetCount > 1 ? 's' : ''} dans cette catégorie — que faire des fiches ?`}
        </p>
        {sheetCount > 0 && (
          <>
            <label className="settings-check">
              <input type="radio" name="fi-del-choice" checked={choice === 'delete'} onChange={() => setChoice('delete')} />
              <span>Supprimer aussi les fiches</span>
            </label>
            <label className="settings-check">
              <input type="radio" name="fi-del-choice" checked={choice === 'move'} onChange={() => setChoice('move')} />
              <span>Déplacer les fiches vers une autre catégorie</span>
            </label>
            {choice === 'move' && (
              <select aria-label="Catégorie de destination" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choisir…</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="db-btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="db-btn danger"
            aria-label="Confirmer la suppression de la catégorie"
            disabled={choice === 'move' && !target}
            onClick={() => onConfirm(choice === 'move' ? target : null)}
          >
            Supprimer la catégorie
          </button>
        </div>
      </div>
    </div>
  )
}
