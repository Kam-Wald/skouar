import { FIELD_TYPES, type FieldDef, type FieldType } from './logic'
import { uid } from './store'

export default function FieldsEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }): JSX.Element {
  const update = (id: string, patch: Partial<FieldDef>): void => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  const remove = (id: string): void => {
    onChange(fields.filter((f) => f.id !== id))
  }
  const move = (id: string, dir: -1 | 1): void => {
    const i = fields.findIndex((f) => f.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= fields.length) return
    const next = [...fields]
    const [f] = next.splice(i, 1)
    next.splice(j, 0, f)
    onChange(next)
  }
  return (
    <div className="fi-fields-editor">
      {fields.length === 0 && <p className="fi-empty">Aucun champ — la fiche n'aura que titre, note, image, favori et commentaire.</p>}
      {fields.map((f, i) => (
        <div key={f.id} className="fi-field-row">
          <input
            className="fi-input fi-field-label"
            placeholder="Nom du champ"
            value={f.label}
            onChange={(e) => update(f.id, { label: e.target.value })}
          />
          <select
            className="fi-input fi-field-type"
            value={f.type}
            onChange={(e) => {
              const type = e.target.value as FieldType
              update(f.id, { type, ...(type === 'select' && !f.options ? { options: [] } : {}) })
            }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          {f.type === 'select' && (
            <input
              className="fi-input fi-field-opts"
              placeholder="Options séparées par des virgules"
              value={(f.options ?? []).join(', ')}
              onChange={(e) => update(f.id, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          )}
          <label className="fi-check fi-field-req" title="Obligatoire">
            <input type="checkbox" checked={f.required ?? false} onChange={(e) => update(f.id, { required: e.target.checked })} /> req.
          </label>
          <button type="button" className="fi-mini" title="Monter" disabled={i === 0} onClick={() => move(f.id, -1)}>
            ↑
          </button>
          <button type="button" className="fi-mini" title="Descendre" disabled={i === fields.length - 1} onClick={() => move(f.id, 1)}>
            ↓
          </button>
          <button type="button" className="fi-mini" title="Supprimer le champ (les valeurs des fiches sont conservées)" onClick={() => remove(f.id)}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="db-btn"
        onClick={() => onChange([...fields, { id: `f-${uid()}`, label: 'Nouveau champ', type: 'text' }])}
      >
        + Ajouter un champ
      </button>
    </div>
  )
}
