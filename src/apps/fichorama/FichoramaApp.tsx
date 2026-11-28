import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { apps } from '../registry'
import { categoryStats, listCategories, listSheets, seedDefaultCategories, type Category, type Sheet } from './store'

const app = apps.find((a) => a.id === 'fichorama')!

export default function FichoramaApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let alive = true
    void seedDefaultCategories()
      .then(() => Promise.all([listCategories(), listSheets()]))
      .then(([c, s]) => {
        if (alive) {
          setCategories(c)
          setSheets(s)
        }
      })
      .catch(() => {
        if (alive) notify('Lecture impossible — état vide en mémoire, rien n’est écrit')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const on = (e: Event) => setToast((e as CustomEvent<string>).detail ?? '')
    window.addEventListener('skouar:toast', on)
    return () => window.removeEventListener('skouar:toast', on)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const sidebar = (
    <>
      <p className="fi-side-label">Fichorama</p>
      <button
        type="button"
        className={`fi-side-btn${selected === null ? ' active' : ''}`}
        onClick={() => setSelected(null)}
      >
        Toutes les fiches
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`fi-side-btn${selected === c.id ? ' active' : ''}`}
          onClick={() => setSelected(c.id)}
        >
          {c.name}
        </button>
      ))}
      <p className="fi-side-label">
        Catégories
        <button type="button" className="fi-side-add" aria-label="Nouvelle catégorie" title="Nouvelle catégorie">
          +
        </button>
      </p>
    </>
  )

  const allStats = { count: sheets.length, avg: sheets.length === 0 ? null : sheets.reduce((a, s) => a + s.note, 0) / sheets.length }

  return (
    <AppShell appId="fichorama" appName="Fichorama" logo={app.logo!} sidebar={sidebar}>
      {selected === null ? (
        <section className="fi-view">
          <h2>Toutes les catégories</h2>
          <p className="fi-stats">
            {allStats.count} fiche{allStats.count > 1 ? 's' : ''}
            {allStats.avg !== null ? ` — note moyenne ${allStats.avg.toFixed(1).replace('.', ',')}/10` : ''}
          </p>
          <div className="fi-cat-grid">
            {categories.map((c) => {
              const st = categoryStats(sheets, c.id)
              return (
                <button key={c.id} type="button" className="fi-cat-card" onClick={() => setSelected(c.id)}>
                  <strong>{c.name}</strong>
                  <span>
                    {st.count} fiche{st.count > 1 ? 's' : ''}
                    {st.avg !== null ? ` — moy. ${st.avg.toFixed(1).replace('.', ',')}/10` : ''}
                  </span>
                </button>
              )
            })}
          </div>
          {categories.length === 0 && <p className="fi-empty">Aucune catégorie — étape 4.2.</p>}
        </section>
      ) : (
        <section className="fi-view">
          <h2>{categories.find((c) => c.id === selected)?.name ?? 'Catégorie'}</h2>
          <p className="fi-empty">Grille de fiches — étape 4.3.</p>
        </section>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
