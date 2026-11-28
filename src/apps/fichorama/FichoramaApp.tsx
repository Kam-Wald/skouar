import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { uid } from '../../shared/db'
import { apps } from '../registry'
import CategoryModal, { DeleteCategoryModal, type CategoryDraft } from './CategoryModal'
import SheetModal from './SheetModal'
import SheetView, { SheetCard } from './SheetView'
import { countSheetsOf, deleteCategory, saveCategory } from './categories'
import { addNote, deleteSheet, makeSheet, saveSheet, sortSheets } from './sheets'
import { categoryStats, listCategories, listSheets, seedDefaultCategories, type Category, type Sheet, type SheetValues } from './store'

const app = apps.find((a) => a.id === 'fichorama')!

type View = { kind: 'home' } | { kind: 'all' } | { kind: 'cat'; id: string } | { kind: 'sheet'; id: string }

export default function FichoramaApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [view, setView] = useState<View>({ kind: 'home' })
  const [toast, setToast] = useState('')
  const [catModal, setCatModal] = useState<null | { category?: Category }>(null)
  const [delModal, setDelModal] = useState<Category | null>(null)
  const [sheetModal, setSheetModal] = useState<null | { categoryId: string; sheet?: Sheet }>(null)

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
    if (d.id) setView({ kind: 'cat', id: cat.id })
    notify(d.id ? 'Catégorie mise à jour' : 'Catégorie créée')
  }

  const onDeleteCategory = async (moveTo: string | null): Promise<void> => {
    if (!delModal) return
    await deleteCategory(delModal.id, moveTo)
    await reload()
    setDelModal(null)
    setView({ kind: 'home' })
    notify(moveTo ? 'Catégorie supprimée — fiches déplacées' : 'Catégorie et fiches supprimées')
  }

  const saveSheetDraft = async (d: { title: string; note: number; fav: boolean; comment: string; image: Blob | null; values: SheetValues }): Promise<void> => {
    if (!sheetModal) return
    const existing = sheetModal.sheet
    const s: Sheet = existing
      ? { ...existing, title: d.title.trim(), note: d.note, fav: d.fav, comment: d.comment, image: d.image, values: d.values, updatedAt: Date.now() }
      : makeSheet(sheetModal.categoryId, d.title, d.note, d.values, d.comment, d.fav, d.image)
    await saveSheet(s)
    await reload()
    setSheetModal(null)
    setView({ kind: 'sheet', id: s.id })
    notify(existing ? 'Fiche mise à jour' : 'Fiche créée')
  }

  const onDeleteSheet = async (id: string): Promise<void> => {
    await deleteSheet(id)
    await reload()
    setView({ kind: 'all' })
    notify('Fiche supprimée')
  }

  const onRenote = async (s: Sheet, value: number): Promise<void> => {
    await saveSheet(addNote(s, value))
    await reload()
    notify(`Nouvelle note : ${String(value).replace('.', ',')}/10`)
  }

  const selectedCat = view.kind === 'cat' || view.kind === 'sheet' ? categories.find((c) => c.id === (view.kind === 'cat' ? view.id : sheets.find((s) => s.id === view.id)?.categoryId ?? '')) ?? null : null
  const sheet = view.kind === 'sheet' ? sheets.find((s) => s.id === view.id) ?? null : null
  const sheetCat = sheet ? categories.find((c) => c.id === sheet.categoryId) ?? null : null

  const sidebar = (
    <>
      <p className="fi-side-label">Fichorama</p>
      <button type="button" className={`fi-side-btn${view.kind === 'home' ? ' active' : ''}`} onClick={() => setView({ kind: 'home' })}>
        Accueil
      </button>
      <button type="button" className={`fi-side-btn${view.kind === 'all' ? ' active' : ''}`} onClick={() => setView({ kind: 'all' })}>
        Toutes les fiches
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`fi-side-btn${(view.kind === 'cat' || view.kind === 'sheet') && selectedCat?.id === c.id ? ' active' : ''}`}
          onClick={() => setView({ kind: 'cat', id: c.id })}
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

  const grid = (list: Sheet[], catId: string | null) => (
    <div className="fi-sheet-grid">
      {sortSheets(list, 'note').map((s) => (
        <SheetCard key={s.id} s={s} onOpen={() => setView({ kind: 'sheet', id: s.id })} />
      ))}
      {list.length === 0 && <p className="fi-empty">Aucune fiche ici.</p>}
      {catId && (
        <button type="button" className="fi-new-sheet" onClick={() => setSheetModal({ categoryId: catId })}>
          + Nouvelle fiche
        </button>
      )}
    </div>
  )

  const allStats = { count: sheets.length, avg: sheets.length === 0 ? null : sheets.reduce((a, s) => a + s.note, 0) / sheets.length }

  return (
    <AppShell appId="fichorama" appName="Fichorama" logo={app.logo!} sidebar={sidebar}>
      {view.kind === 'sheet' && sheet && sheetCat ? (
        <SheetView
          sheet={sheet}
          category={sheetCat}
          onBack={() => setView({ kind: 'cat', id: sheet.categoryId })}
          onEdit={() => setSheetModal({ categoryId: sheet.categoryId, sheet })}
          onDelete={() => void onDeleteSheet(sheet.id)}
          onRenote={(v) => void onRenote(sheet, v)}
          onToggleFav={async () => {
            await saveSheet({ ...sheet, fav: !sheet.fav })
            await reload()
          }}
        />
      ) : view.kind === 'home' ? (
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
                <button key={c.id} type="button" className="fi-cat-card" onClick={() => setView({ kind: 'cat', id: c.id })}>
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
      ) : view.kind === 'all' ? (
        <section className="fi-view">
          <h2>Toutes les fiches</h2>
          {grid(sheets, null)}
        </section>
      ) : (
        <section className="fi-view">
          <div className="fi-cat-head">
            <h2>{selectedCat?.name ?? 'Catégorie'}</h2>
            <span className="fi-cat-actions">
              <button type="button" className="unvez-btn" aria-label="Paramètres de la catégorie" onClick={() => selectedCat && setCatModal({ category: selectedCat })}>
                ⚙️ Paramètres
              </button>
              <button type="button" className="unvez-btn" aria-label="Supprimer la catégorie" onClick={() => selectedCat && setDelModal(selectedCat)}>
                Supprimer
              </button>
            </span>
          </div>
          {grid(sheets.filter((s) => s.categoryId === view.id), view.id)}
        </section>
      )}
      {catModal && (
        <CategoryModal initial={catModal.category} onSave={(d) => void saveCategoryDraft(d)} onClose={() => setCatModal(null)} />
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
      {sheetModal && (
        <SheetModal
          category={categories.find((c) => c.id === sheetModal.categoryId)!}
          sheet={sheetModal.sheet}
          onSave={(d) => void saveSheetDraft(d)}
          onClose={() => setSheetModal(null)}
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
