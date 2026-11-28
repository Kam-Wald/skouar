import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import FieldsEditor from './FieldsEditor'
import {
  CAT_COLORS,
  CAT_ICONS,
  addRating,
  avg,
  catStats,
  categoryOf,
  clampNote,
  deleteCategory,
  fileToDataUrl,
  filterFiches,
  fmtDateIso,
  fmtFieldValue,
  fmtNote,
  globalStats,
  noteOf,
  searchFiches,
  sortFiches,
  validateDraft,
  type SortKey,
  type Category,
  type Fiche,
  type FieldDef,
  type FieldValue,
  type FichoramaData
} from './logic'
import { loadData, saveData, uid } from './store'

type View = { kind: 'home' } | { kind: 'all' } | { kind: 'cat'; id: string } | { kind: 'fiche'; id: string }

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
  const [catFields, setCatFields] = useState<FieldDef[]>([])
  const [settings, setSettings] = useState<string | null>(null)
  const [setDraft, setSetDraft] = useState<Category | null>(null)
  const [delConfirm, setDelConfirm] = useState(false)
  const [delTarget, setDelTarget] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [renote, setRenote] = useState<string | null>(null)
  const [renoteVal, setRenoteVal] = useState(5)
  const [sort, setSort] = useState<SortKey>('note-desc')
  const [favOnly, setFavOnly] = useState(false)
  const [minN, setMinN] = useState<number | undefined>(undefined)
  const [maxN, setMaxN] = useState<number | undefined>(undefined)
  const [viewQ, setViewQ] = useState('')

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
  const fiche = view.kind === 'fiche' && data ? data.fiches.find((f) => f.id === view.id) : undefined
  const ficheCat = fiche && data ? categoryOf(data, fiche.categoryId) : undefined
  const ficheForRenote = renote && data ? data.fiches.find((f) => f.id === renote) : undefined
  const scopeFiches = !data ? [] : view.kind === 'cat' && cat ? catFiches : view.kind === 'all' ? data.fiches : []
  const shown = useMemo(
    () => sortFiches(filterFiches(scopeFiches, { favOnly, min: minN, max: maxN, q: viewQ }), sort),
    [scopeFiches, favOnly, minN, maxN, viewQ, sort]
  )
  const scopeStats = useMemo(() => ({ nb: scopeFiches.length, moyenne: avg(scopeFiches.map(noteOf)) }), [scopeFiches])

  const addCategory = (): void => {
    const name = catName.trim()
    if (!name) {
      notify('Nom de catégorie requis')
      return
    }
    const fields = catFields
    mutate((d) => {
      d.categories.push({ id: `cat-${uid()}`, name, icon: catIcon, color: catColor, fields })
    })
    setNewCat(false)
    setCatName('')
    setCatFields([])
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

  const openSettings = (id: string): void => {
    if (!data) return
    const c = categoryOf(data, id)
    if (!c) return
    setSettings(id)
    setSetDraft(structuredClone(c))
    setDelConfirm(false)
    setDelTarget('')
  }

  const saveSettings = (): void => {
    if (!settings || !setDraft || !data) return
    const name = setDraft.name.trim()
    if (!name) {
      notify('Nom de catégorie requis')
      return
    }
    const draft = { ...setDraft, name }
    mutate((d) => {
      const i = d.categories.findIndex((c) => c.id === settings)
      if (i >= 0) d.categories[i] = draft
    })
    setSettings(null)
    notify('Catégorie enregistrée')
  }

  const removeCategory = (): void => {
    if (!settings || !data) return
    const target = delTarget !== '' ? delTarget : null
    const name = categoryOf(data, settings)?.name ?? ''
    mutate((d) => deleteCategory(d, settings, target))
    setSettings(null)
    if (view.kind === 'cat' && view.id === settings) setView({ kind: 'home' })
    notify(`Catégorie « ${name} » supprimée${target ? ' (fiches déplacées)' : ' (fiches supprimées)'}`)
  }

  const saveRenote = (): void => {
    if (!renote || !data) return
    const v = clampNote(renoteVal)
    mutate((d) => {
      const f = d.fiches.find((x) => x.id === renote)
      if (f) {
        addRating(f, v, new Date().toISOString())
        f.updatedAt = new Date().toISOString()
      }
    })
    setRenote(null)
    notify(`Nouvelle note : ${fmtNote(v)}/10`)
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
          <button type="button" className={`fi-side-row${view.kind === 'all' ? ' active' : ''}`} onClick={() => setView({ kind: 'all' })}>
            <span>🗂</span> Toutes les fiches
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
          <h1 className="fi-h1">
            {view.kind === 'home'
              ? 'Fichorama'
              : view.kind === 'all'
                ? '🗂 Toutes les fiches'
                : view.kind === 'fiche' && fiche
                  ? fiche.title
                  : cat
                    ? `${cat.icon} ${cat.name}`
                    : 'Catégorie'}
          </h1>
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
                    setView({ kind: 'fiche', id: f.id })
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
        {(view.kind === 'cat' || view.kind === 'all') && data && (
          <div className="fi-cat">
            <div className="fi-cat-head fi-controls">
              {view.kind === 'cat' && cat && (
                <>
                  <button type="button" className="db-btn" onClick={() => setForm({ id: null, catId: cat.id, draft: emptyDraft() })}>
                    + Nouvelle fiche
                  </button>
                  <button type="button" className="db-btn" title="Paramètres de la catégorie (champs, renommage, suppression)" onClick={() => openSettings(cat.id)}>
                    ⚙ Paramètres
                  </button>
                </>
              )}
              <input className="fi-search fi-search-sm" placeholder="Filtrer (titre, commentaire)…" value={viewQ} onChange={(e) => setViewQ(e.target.value)} />
              <select className="fi-input fi-sort" value={sort} title="Trier par" onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="note-desc">Note ↓</option>
                <option value="note-asc">Note ↑</option>
                <option value="date-desc">Ajoutées récemment</option>
                <option value="date-asc">Ajoutées en premier</option>
                <option value="titre">Titre A→Z</option>
                <option value="fav">★ Favoris d'abord</option>
              </select>
              <label className="fi-check">
                <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> Favoris
              </label>
              <label className="fi-check fi-note-range">
                Note
                <input
                  type="number"
                  className="fi-input fi-note-in"
                  min={0}
                  max={10}
                  step={0.5}
                  placeholder="min"
                  value={minN ?? ''}
                  onChange={(e) => setMinN(e.target.value === '' ? undefined : Number(e.target.value))}
                />
                –
                <input
                  type="number"
                  className="fi-input fi-note-in"
                  min={0}
                  max={10}
                  step={0.5}
                  placeholder="max"
                  value={maxN ?? ''}
                  onChange={(e) => setMaxN(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </label>
              <span className="fi-cat-count">
                {shown.length}/{scopeStats.nb} · moyenne {scopeStats.moyenne === null ? '—' : `${fmtNote(Math.round(scopeStats.moyenne * 10) / 10)}/10`}
              </span>
            </div>
            <div className="fi-grid">
              {shown.map((f) => {
                const c = categoryOf(data, f.categoryId)
                return (
                  <button key={f.id} type="button" className="fi-vignette" onClick={() => setView({ kind: 'fiche', id: f.id })}>
                    {f.image ? (
                      <img className="fi-vignette-img" src={f.image} alt="" />
                    ) : (
                      <span className="fi-vignette-img fi-thumb-empty" style={{ background: c?.color ?? '#64748b' }}>
                        {c?.icon ?? '🗂️'}
                      </span>
                    )}
                    <span className="fi-vignette-body">
                      <span className="fi-row-title">
                        {f.favori && <span className="fi-fav">★ </span>}
                        {f.title}
                      </span>
                      <span className="fi-note-row">
                        <Stars value={noteOf(f)} readOnly />
                        <span className="fi-note">{fmtNote(noteOf(f))}/10</span>
                      </span>
                    </span>
                  </button>
                )
              })}
              {shown.length === 0 && <p className="fi-empty">Aucune fiche{view.kind === 'cat' && cat ? ` dans « ${cat.name} »` : ''}.</p>}
            </div>
          </div>
        )}
        {view.kind === 'fiche' && fiche && ficheCat && (
          <div className="fi-detail">
            <button type="button" className="db-btn" onClick={() => setView({ kind: 'cat', id: fiche.categoryId })}>
              ← {ficheCat.icon} {ficheCat.name}
            </button>
            <div className="fi-detail-head">
              {fiche.image ? (
                <img className="fi-detail-img" src={fiche.image} alt="" />
              ) : (
                <span className="fi-detail-img fi-thumb-empty" style={{ background: ficheCat.color }}>
                  {ficheCat.icon}
                </span>
              )}
              <div className="fi-detail-info">
                <h2 className="fi-detail-title">
                  {fiche.favori && <span className="fi-fav">★ </span>}
                  {fiche.title}
                </h2>
                <div className="fi-note-row">
                  <Stars value={noteOf(fiche)} readOnly />
                  <span className="fi-note fi-note-big">{fmtNote(noteOf(fiche))}/10</span>
                </div>
                <p className="fi-detail-meta">
                  Ajoutée le {fmtDateIso(fiche.createdAt)} · {ficheCat.icon} {ficheCat.name}
                </p>
                <div className="fi-detail-actions">
                  <button type="button" className="db-btn" onClick={() => setForm({ id: fiche.id, catId: fiche.categoryId, draft: draftOf(fiche) })}>
                    ✎ Modifier
                  </button>
                  <button
                    type="button"
                    className="db-btn"
                    onClick={() => {
                      setRenote(fiche.id)
                      setRenoteVal(noteOf(fiche))
                    }}
                  >
                    🔁 Re-noter
                  </button>
                  <button
                    type="button"
                    className="db-btn"
                    onClick={() =>
                      mutate((d) => {
                        const f = d.fiches.find((x) => x.id === fiche.id)
                        if (f) {
                          f.favori = !f.favori
                          f.updatedAt = new Date().toISOString()
                        }
                      })
                    }
                  >
                    {fiche.favori ? '★ Retirer des favoris' : '☆ Favori'}
                  </button>
                  <button
                    type="button"
                    className="db-btn"
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${fiche.title} » ?`)) {
                        mutate((d) => {
                          d.fiches = d.fiches.filter((x) => x.id !== fiche.id)
                        })
                        setView({ kind: 'cat', id: fiche.categoryId })
                        notify('Fiche supprimée')
                      }
                    }}
                  >
                    🗑 Supprimer
                  </button>
                </div>
              </div>
            </div>
            {ficheCat.fields.length > 0 && (
              <div className="fi-detail-fields">
                <p className="fi-section-title">Détails</p>
                {ficheCat.fields.map((fd) => (
                  <div key={fd.id} className="fi-detail-field">
                    <span className="fi-field-label">{fd.label}</span>
                    <span>{fmtFieldValue(fiche.values[fd.id])}</span>
                  </div>
                ))}
              </div>
            )}
            {fiche.comment && (
              <div className="fi-detail-comment">
                <p className="fi-section-title">Commentaire</p>
                <p className="fi-comment-text">{fiche.comment}</p>
              </div>
            )}
            <div className="fi-detail-history">
              <p className="fi-section-title">Historique des notes ({fiche.ratings.length})</p>
              <div className="fi-frise">
                {fiche.ratings.map((r, i) => (
                  <div
                    key={i}
                    className={`fi-frise-item${i === fiche.ratings.length - 1 ? ' current' : ''}`}
                    title={`${fmtNote(r.value)}/10 — ${fmtDateIso(r.date)}`}
                  >
                    <span className="fi-frise-dot" />
                    <span className="fi-frise-val">{fmtNote(r.value)}</span>
                    <span className="fi-frise-date">{fmtDateIso(r.date)}</span>
                  </div>
                ))}
              </div>
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
            <p className="fi-section-title">Champs de la catégorie</p>
            <FieldsEditor fields={catFields} onChange={setCatFields} />
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
      {settings && setDraft && data && (
        <div className="fi-overlay" onClick={() => setSettings(null)}>
          <div className="fi-modal fi-form" onClick={(e) => e.stopPropagation()}>
            <p className="fi-modal-title">⚙ Paramètres — {setDraft.icon} {setDraft.name}</p>
            <input
              className="fi-input"
              placeholder="Nom de la catégorie"
              value={setDraft.name}
              onChange={(e) => setSetDraft({ ...setDraft, name: e.target.value })}
            />
            <div className="fi-pick-row">
              {CAT_ICONS.map((ic) => (
                <button key={ic} type="button" className={`fi-pick${setDraft.icon === ic ? ' on' : ''}`} onClick={() => setSetDraft({ ...setDraft, icon: ic })}>
                  {ic}
                </button>
              ))}
            </div>
            <div className="fi-pick-row">
              {CAT_COLORS.map((c) => (
                <button key={c} type="button" className={`fi-swatch${setDraft.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setSetDraft({ ...setDraft, color: c })} />
              ))}
            </div>
            <p className="fi-section-title">Champs affichés (les valeurs des fiches sont toujours conservées)</p>
            <FieldsEditor fields={setDraft.fields} onChange={(fields) => setSetDraft({ ...setDraft, fields })} />
            <div className="fi-danger">
              {!delConfirm ? (
                <button type="button" className="db-btn fi-danger-btn" onClick={() => setDelConfirm(true)}>
                  🗑 Supprimer la catégorie…
                </button>
              ) : (
                <div className="fi-danger-box">
                  <p className="fi-danger-text">
                    {data.fiches.filter((f) => f.categoryId === settings).length} fiche(s) concernée(s). Que faire des fiches ?
                  </p>
                  <select className="fi-input" value={delTarget} onChange={(e) => setDelTarget(e.target.value)}>
                    <option value="">Les supprimer avec la catégorie</option>
                    {data.categories
                      .filter((c) => c.id !== settings)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Les déplacer vers « {c.icon} {c.name} »
                        </option>
                      ))}
                  </select>
                  <div className="fi-modal-actions">
                    <button type="button" className="db-btn" onClick={() => setDelConfirm(false)}>
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="db-btn fi-danger-btn"
                      onClick={() => {
                        if (window.confirm(`Confirmer la suppression de « ${setDraft.name} » ?`)) removeCategory()
                      }}
                    >
                      Confirmer la suppression
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="fi-modal-actions">
              <button type="button" className="db-btn" onClick={() => setSettings(null)}>
                Annuler
              </button>
              <button type="button" className="db-btn" onClick={saveSettings}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      {renote && ficheForRenote && (
        <div className="fi-overlay" onClick={() => setRenote(null)}>
          <div className="fi-modal" onClick={(e) => e.stopPropagation()}>
            <p className="fi-modal-title">Re-noter « {ficheForRenote.title} »</p>
            <p className="fi-detail-meta">
              Note actuelle : <strong>{fmtNote(noteOf(ficheForRenote))}/10</strong> — l'ancienne note reste dans l'historique.
            </p>
            <div className="fi-note-row">
              <Stars value={renoteVal} onChange={setRenoteVal} />
              <span className="fi-note">{fmtNote(clampNote(renoteVal))}/10</span>
            </div>
            <div className="fi-modal-actions">
              <button type="button" className="db-btn" onClick={() => setRenote(null)}>
                Annuler
              </button>
              <button type="button" className="db-btn" onClick={saveRenote}>
                Enregistrer la note
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
