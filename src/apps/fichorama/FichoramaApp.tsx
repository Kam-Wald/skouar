import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import {
  CAT_COLORS,
  CAT_ICONS,
  catStats,
  categoryOf,
  clampNote,
  fileToDataUrl,
  fmtFieldValue,
  fmtNote,
  globalStats,
  noteOf,
  searchFiches,
  validateDraft,
  type Category,
  type Fiche,
  type FieldDef,
  type FieldValue,
  type FichoramaData
} from './logic'
import { loadData, saveData, uid } from './store'

type View = { kind: 'home' } | { kind: 'cat'; id: string }

interface Draft {
  title: string
  note: number
  favori: boolean
  comment: string
  image?: string
  values: Record<string, FieldValue>
}

interface FormState {
  id: string | null
  catId: string
  draft: Draft
}

function emptyDraft(): Draft {
  return { title: '', note: 5, favori: false, comment: '', values: {} }
}

function draftOf(f: Fiche): Draft {
  return { title: f.title, note: noteOf(f), favori: f.favori, comment: f.comment, image: f.image, values: { ...f.values } }
}

function Stars({ value, onChange, readOnly }: { value: number; onChange?: (n: number) => void; readOnly?: boolean }): JSX.Element {
  return (
    <span className="fi-stars" aria-label={`Note ${fmtNote(value)}/10`}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1
        const fill = value >= n ? 100 : value >= n - 0.5 ? 50 : 0
        return (
          <button
            key={n}
            type="button"
            className="fi-star"
            disabled={readOnly}
            aria-label={`${n}/10`}
            onClick={(e) => {
              if (!onChange) return
              const r = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - r.left
              onChange(x < r.width / 2 ? n - 0.5 : n)
            }}
          >
            <span className="fi-star-bg">★</span>
            <span className="fi-star-fg" style={{ width: `${fill}%` }}>
              ★
            </span>
          </button>
        )
      })}
    </span>
  )
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: FieldValue | undefined; onChange: (v: FieldValue) => void }): JSX.Element {
  if (field.type === 'number') {
    return (
      <input
        type="number"
        className="fi-input"
        value={value === undefined || value === '' ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    )
  }
  if (field.type === 'date') {
    return <input type="date" className="fi-input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'select') {
    return (
      <select className="fi-input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  return <input className="fi-input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
}

export default function FichoramaApp(): JSX.Element {
  const [data, setData] = useState<FichoramaData | null>(null)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [query, setQuery] = useState('')
  const [newCat, setNewCat] = useState(false)
  const [catName, setCatName] = useState('')
  const [catIcon, setCatIcon] = useState('🗂️')
  const [catColor, setCatColor] = useState(CAT_COLORS[0])
  const [form, setForm] = useState<FormState | null>(null)

  useEffect(() => {
    void loadData().then(setData)
  }, [])

  const mutate = (fn: (d: FichoramaData) => void): void => {
    setData((d) => {
      if (!d) return d
      const next = structuredClone(d)
      fn(next)
      saveData(next)
      return next
    })
  }

  const stats = useMemo(() => (data ? globalStats(data) : null), [data])
  const results = useMemo(() => (data && query.trim() ? searchFiches(data, query) : []), [data, query])
  const cat = view.kind === 'cat' && data ? categoryOf(data, view.id) : undefined
  const catFiches = useMemo(() => (data && cat ? data.fiches.filter((f) => f.categoryId === cat.id) : []), [data, cat])

  const addCategory = (): void => {
    const name = catName.trim()
    if (!name) {
      notify('Nom de catégorie requis')
      return
    }
    mutate((d) => {
      d.categories.push({ id: `cat-${uid()}`, name, icon: catIcon, color: catColor, fields: [] })
    })
    setNewCat(false)
    setCatName('')
    notify(`Catégorie « ${name} » créée`)
  }

  const saveFiche = (): void => {
    if (!form || !data) return
    const c = categoryOf(data, form.catId)
    if (!c) return
    const err = validateDraft(c, form.draft)
    if (err) {
      notify(err)
      return
    }
    const now = new Date().toISOString()
    const note = clampNote(form.draft.note)
    const isEdit = form.id !== null
    mutate((d) => {
      if (isEdit) {
        const f = d.fiches.find((x) => x.id === form.id)!
        f.title = form.draft.title.trim()
        f.comment = form.draft.comment
        f.favori = form.draft.favori
        if (form.draft.image !== f.image) f.image = form.draft.image
        f.values = { ...f.values, ...form.draft.values }
        if (note !== noteOf(f)) f.ratings.push({ value: note, date: now })
        f.updatedAt = now
      } else {
        d.fiches.push({
          id: `fic-${uid()}`,
          categoryId: form.catId,
          title: form.draft.title.trim(),
          comment: form.draft.comment,
          favori: form.draft.favori,
          image: form.draft.image,
          values: { ...form.draft.values },
          ratings: [{ value: note, date: now }],
          createdAt: now,
          updatedAt: now
        })
      }
    })
    setForm(null)
    notify(isEdit ? 'Fiche enregistrée' : 'Fiche créée')
  }

  const deleteFiche = (f: Fiche): void => {
    if (!window.confirm(`Supprimer « ${f.title} » ?`)) return
    mutate((d) => {
      d.fiches = d.fiches.filter((x) => x.id !== f.id)
    })
    notify('Fiche supprimée')
  }

  const formCat = form && data ? categoryOf(data, form.catId) : undefined

  if (!data) return <AppShell appId="fichorama" appName="Fichorama" logo={`${import.meta.env.BASE_URL}app-icons/fichorama.svg`}><div className="fichorama-main" /></AppShell>

  return (
    <AppShell
      appId="fichorama"
      appName="Fichorama"
      logo={`${import.meta.env.BASE_URL}app-icons/fichorama.svg`}
      sidebar={
        <div className="fi-side">
          <p className="fi-side-title">Catégories</p>
          <button type="button" className={`fi-side-row${view.kind === 'home' ? ' active' : ''}`} onClick={() => setView({ kind: 'home' })}>
            <span>🏠</span> Accueil
          </button>
          {data.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fi-side-row${view.kind === 'cat' && view.id === c.id ? ' active' : ''}`}
              onClick={() => setView({ kind: 'cat', id: c.id })}
            >
              <span style={{ color: c.color }}>{c.icon}</span> {c.name}
            </button>
          ))}
          <button type="button" className="db-btn" onClick={() => setNewCat(true)}>
            + Nouvelle catégorie
          </button>
        </div>
      }
    >
      <div className="fichorama-main">
        <div className="fi-topbar">
          <h1 className="fi-h1">{view.kind === 'home' ? 'Fichorama' : cat ? `${cat.icon} ${cat.name}` : 'Catégorie'}</h1>
          <input
            className="fi-search"
            placeholder="Rechercher une fiche (titre, commentaire)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {stats && (
          <p className="fi-stats">
            {stats.nb} fiche{stats.nb > 1 ? 's' : ''} · note moyenne : {stats.moyenne === null ? '—' : fmtNote(Math.round(stats.moyenne * 10) / 10)}/10
          </p>
        )}
        {query.trim() && (
          <div className="fi-results">
            <p className="fi-section-title">{results.length} fiche(s) pour « {query.trim()} »</p>
            {results.map((f) => {
              const c = categoryOf(data, f.categoryId)
              return (
                <div
                  key={f.id}
                  className="fi-result-row"
                  onClick={() => {
                    setQuery('')
                    setView({ kind: 'cat', id: f.categoryId })
                    setForm({ id: f.id, catId: f.categoryId, draft: draftOf(f) })
                  }}
                >
                  <span style={{ color: c?.color }}>{c?.icon ?? '🗂️'}</span>
                  <span className="fi-result-title">{f.title}</span>
                  <span className="fi-note">{fmtNote(noteOf(f))}/10</span>
                </div>
              )
            })}
          </div>
        )}
        {view.kind === 'home' && !query.trim() && (
          <div className="fi-cards">
            {data.categories.map((c) => {
              const st = catStats(data, c.id)
              return (
                <button key={c.id} type="button" className="fi-card" onClick={() => setView({ kind: 'cat', id: c.id })}>
                  <span className="fi-card-icon" style={{ background: c.color }}>
                    {c.icon}
                  </span>
                  <span className="fi-card-name">{c.name}</span>
                  <span className="fi-card-meta">
                    {st.nb} fiche{st.nb > 1 ? 's' : ''} · {st.moyenne === null ? '—' : fmtNote(Math.round(st.moyenne * 10) / 10)}/10
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {view.kind === 'cat' && cat && (
          <div className="fi-cat">
            <div className="fi-cat-head">
              <button type="button" className="db-btn" onClick={() => setForm({ id: null, catId: cat.id, draft: emptyDraft() })}>
                + Nouvelle fiche
              </button>
              <span className="fi-cat-count">
                {catFiches.length} fiche{catFiches.length > 1 ? 's' : ''} · moyenne{' '}
                {(() => {
                  const st = catStats(data, cat.id)
                  return st.moyenne === null ? '—' : `${fmtNote(Math.round(st.moyenne * 10) / 10)}/10`
                })()}
              </span>
            </div>
            <div className="fi-list">
              {catFiches.map((f) => (
                <div key={f.id} className="fi-row" onClick={() => setForm({ id: f.id, catId: cat.id, draft: draftOf(f) })}>
                  {f.image ? (
                    <img className="fi-thumb" src={f.image} alt="" />
                  ) : (
                    <span className="fi-thumb fi-thumb-empty" style={{ background: cat.color }}>
                      {cat.icon}
                    </span>
                  )}
                  <span className="fi-row-title">
                    {f.favori && <span className="fi-fav">★</span>} {f.title}
                  </span>
                  <Stars value={noteOf(f)} readOnly />
                  <span className="fi-note">{fmtNote(noteOf(f))}/10</span>
                  <button
                    type="button"
                    className="fi-mini"
                    title="Supprimer"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteFiche(f)
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
              {catFiches.length === 0 && <p className="fi-empty">Aucune fiche dans « {cat.name} » — cliquez « + Nouvelle fiche ».</p>}
            </div>
          </div>
        )}
      </div>
      {newCat && (
        <div className="fi-overlay" onClick={() => setNewCat(false)}>
          <div className="fi-modal" onClick={(e) => e.stopPropagation()}>
            <p className="fi-modal-title">Nouvelle catégorie</p>
            <input className="fi-input" placeholder="Nom (ex. Restos)" value={catName} autoFocus onChange={(e) => setCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCategory() }} />
            <div className="fi-pick-row">
              {CAT_ICONS.map((ic) => (
                <button key={ic} type="button" className={`fi-pick${catIcon === ic ? ' on' : ''}`} onClick={() => setCatIcon(ic)}>
                  {ic}
                </button>
              ))}
            </div>
            <div className="fi-pick-row">
              {CAT_COLORS.map((c) => (
                <button key={c} type="button" className={`fi-swatch${catColor === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setCatColor(c)} />
              ))}
            </div>
            <div className="fi-modal-actions">
              <button type="button" className="db-btn" onClick={() => setNewCat(false)}>
                Annuler
              </button>
              <button type="button" className="db-btn" onClick={addCategory}>
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
      {form && formCat && (
        <div className="fi-overlay" onClick={() => setForm(null)}>
          <div className="fi-modal fi-form" onClick={(e) => e.stopPropagation()}>
            <p className="fi-modal-title">
              {form.id ? 'Modifier la fiche' : 'Nouvelle fiche'} — {formCat.icon} {formCat.name}
            </p>
            <div className="fi-form-image">
              {form.draft.image ? <img src={form.draft.image} alt="" className="fi-form-img" /> : <span className="fi-form-img fi-thumb-empty" style={{ background: formCat.color }}>{formCat.icon}</span>}
              <label className="db-btn fi-file-btn">
                {form.draft.image ? 'Changer l’image' : 'Ajouter une image…'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    fileToDataUrl(file)
                      .then((url) => setForm((f) => (f ? { ...f, draft: { ...f.draft, image: url } } : f)))
                      .catch(() => notify('Image illisible'))
                  }}
                />
              </label>
              {form.draft.image && (
                <button type="button" className="db-btn" onClick={() => setForm((f) => (f ? { ...f, draft: { ...f.draft, image: undefined } } : f))}>
                  Retirer
                </button>
              )}
            </div>
            <label className="fi-field">
              <span className="fi-field-label">Titre *</span>
              <input className="fi-input" value={form.draft.title} autoFocus onChange={(e) => setForm((f) => (f ? { ...f, draft: { ...f.draft, title: e.target.value } } : f))} />
            </label>
            <div className="fi-field">
              <span className="fi-field-label">Note /10</span>
              <div className="fi-note-row">
                <Stars value={form.draft.note} onChange={(n) => setForm((f) => (f ? { ...f, draft: { ...f.draft, note: n } } : f))} />
                <span className="fi-note">{fmtNote(clampNote(form.draft.note))}/10</span>
              </div>
            </div>
            <label className="fi-field fi-check">
              <input type="checkbox" checked={form.draft.favori} onChange={(e) => setForm((f) => (f ? { ...f, draft: { ...f.draft, favori: e.target.checked } } : f))} />
              <span>Favori ★</span>
            </label>
            {formCat.fields.map((fd) => (
              <label key={fd.id} className="fi-field">
                <span className="fi-field-label">
                  {fd.label}
                  {fd.required ? ' *' : ''}
                </span>
                <FieldInput field={fd} value={form.draft.values[fd.id]} onChange={(v) => setForm((f) => (f ? { ...f, draft: { ...f.draft, values: { ...f.draft.values, [fd.id]: v } } } : f))} />
              </label>
            ))}
            <label className="fi-field">
              <span className="fi-field-label">Commentaire</span>
              <textarea className="fi-input fi-textarea" rows={4} value={form.draft.comment} onChange={(e) => setForm((f) => (f ? { ...f, draft: { ...f.draft, comment: e.target.value } } : f))} />
            </label>
            <div className="fi-modal-actions">
              <button type="button" className="db-btn" onClick={() => setForm(null)}>
                Annuler
              </button>
              <button type="button" className="db-btn" onClick={saveFiche}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
