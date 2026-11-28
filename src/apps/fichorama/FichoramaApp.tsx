import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { uid } from '../../shared/db'
import { apps } from '../registry'
import CategoryModal, { DeleteCategoryModal, type CategoryDraft } from './CategoryModal'
import { countSheetsOf, deleteCategory, saveCategory } from './categories'
import { categoryStats, listCategories, listSheets, seedDefaultCategories, type Category, type Sheet } from './store'

const app = apps.find((a) => a.id === 'fichorama')!

export default function FichoramaApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [catModal, setCatModal] = useState<null | { category?: Category }>(null)
  const [delModal, setDelModal] = useState<Category | null>(null)

  const reload = async (): Promise<void> => {
    const [c, s] = await Promise.all([listCategories(), listSheets()])
    setCategories(c)
    setSheets(s)
  }

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

  const saveCategoryDraft = async (d: CategoryDraft): Promise<void> => {
    const now = Date.now()
    const cat: Category = {
      id: d.id ?? uid(),
      name: d.name,
      fields: d.fields,
      removedFields: d.removedFields,
      createdAt: d.createdAt ?? now
    }
    await saveCategory(cat)
    await reload()
    setCatModal(null)
    if (d.id) setSelected(cat.id)
    notify(d.id ? 'Catégorie mise à jour' : 'Catégorie créée')
  }

  const onDeleteCategory = async (moveTo: string | null): Promise<void> => {
    if (!delModal) return
    await deleteCategory(delModal.id, moveTo)
    await reload()
    setDelModal(null)
    setSelected(null)
    notify(moveTo ? 'Catégorie supprimée — fiches déplacées' : 'Catégorie et fiches supprimées')
  }

  const selectedCat = categories.find((c) => c.id === selected) ?? null

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
        <button type="button" className="fi-side-add" aria-label="Nouvelle catégorie" title="Nouvelle catégorie" onClick={() => setCatModal({})}>
          +
        </button>
      </p>
    </>
  )

  const allStats = { count: sheets.length, avg: sheets.length === 0 ? null : sheets.reduce((a, s) => a + s.note, 0) / sheets.length }

  return (
    <AppShell appId="fichorama" appName="Fichorama" logo={app.logo!} sidebar={sidebar}>
      {selected === null || !selectedCat ? (
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
          {categories.length === 0 && <p className="fi-empty">Aucune catégorie.</p>}
        </section>
      ) : (
        <section className="fi-view">
          <div className="fi-cat-head">
            <h2>{selectedCat.name}</h2>
            <span className="fi-cat-actions">
              <button type="button" className="unvez-btn" aria-label="Paramètres de la catégorie" onClick={() => setCatModal({ category: selectedCat })}>
                ⚙️ Paramètres
              </button>
              <button type="button" className="unvez-btn" aria-label="Supprimer la catégorie" onClick={() => setDelModal(selectedCat)}>
                Supprimer
              </button>
            </span>
          </div>
          <p className="fi-empty">Grille de fiches — étape 4.3.</p>
        </section>
      )}
      {catModal && (
        <CategoryModal
          initial={catModal.category}
          onSave={(d) => void saveCategoryDraft(d)}
          onClose={() => setCatModal(null)}
        />
      )}
      {delModal && (
        <DeleteCategoryModal
          category={delModal}
          sheetCount={countSheetsOf(sheets, delModal.id)}
          others={categories.filter((c) => c.id !== delModal.id)}
          onConfirm={(moveTo) => void onDeleteCategory(moveTo)}
          onClose={() => setDelModal(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
