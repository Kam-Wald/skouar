import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { catStats, categoryOf, fmtNote, globalStats, searchFiches, CAT_COLORS, CAT_ICONS, type FichoramaData } from './logic'
import { loadData, saveData, uid } from './store'

type View = { kind: 'home' } | { kind: 'cat'; id: string }

export default function FichoramaApp(): JSX.Element {
  const [data, setData] = useState<FichoramaData | null>(null)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [query, setQuery] = useState('')
  const [newCat, setNewCat] = useState(false)
  const [catName, setCatName] = useState('')
  const [catIcon, setCatIcon] = useState('🗂️')
  const [catColor, setCatColor] = useState(CAT_COLORS[0])

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
                <div key={f.id} className="fi-result-row">
                  <span style={{ color: c?.color }}>{c?.icon ?? '🗂️'}</span>
                  <span className="fi-result-title">{f.title}</span>
                  <span className="fi-note">{fmtNote(f.ratings.length ? f.ratings[f.ratings.length - 1].value : 0)}/10</span>
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
            <p className="fi-empty">Grille de fiches, tris et filtres arrivent en S5. ({data.fiches.filter((f) => f.categoryId === cat.id).length} fiche(s) dans « {cat.name} »)</p>
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
    </AppShell>
  )
}
