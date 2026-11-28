// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { uid } from '../src/shared/db'
import { db, listCategories, type Category, type Sheet } from '../src/apps/fichorama/store'
import { deleteCategory, moveField, removeFieldFromCategory, restoreEquivalentField, saveCategory } from '../src/apps/fichorama/categories'

const mkCat = (over: Partial<Category> = {}): Category => ({
  id: uid(),
  name: 'Films',
  fields: [
    { id: 'f-genre', label: 'Genre', type: 'liste', options: ['SF'] },
    { id: 'f-annee', label: 'Année', type: 'nombre' }
  ],
  removedFields: [],
  createdAt: 1,
  ...over
})

const mkSheet = (catId: string, values: Record<string, unknown>): Sheet => ({
  id: uid(),
  categoryId: catId,
  title: 'Dune',
  note: 9,
  notes: [{ value: 9, date: 1 }],
  fav: false,
  comment: '',
  image: null,
  values,
  createdAt: 1,
  updatedAt: 1
})

describe('fichorama — catégories/champs (CDC 5, 6, 9.C)', () => {
  it('retirer un champ le conserve dans removedFields ; les valeurs des fiches restent intactes (9.C)', async () => {
    const cat = mkCat()
    const sheet = mkSheet(cat.id, { 'f-genre': 'SF', 'f-annee': 1984 })
    await saveCategory(cat)
    await db.table<Sheet, string>('sheets').put(sheet)

    const removed = removeFieldFromCategory(cat, 'f-genre')
    expect(removed.fields.map((f) => f.id)).toEqual(['f-annee'])
    expect(removed.removedFields.map((f) => f.id)).toEqual(['f-genre'])

    const back = await db.table<Sheet, string>('sheets').get(sheet.id)
    expect(back?.values['f-genre']).toBe('SF')

    const restored = restoreEquivalentField(removed, 'Genre', 'liste', ['SF', 'Fantastique'])
    expect(restored.restored).toBe(true)
    expect(restored.cat.fields.map((f) => f.id)).toContain('f-genre')
    expect(restored.cat.fields.find((f) => f.id === 'f-genre')?.options).toEqual(['SF', 'Fantastique'])
    expect(restored.cat.removedFields.length).toBe(0)
    const again = await db.table<Sheet, string>('sheets').get(sheet.id)
    expect(again?.values['f-genre']).toBe('SF')

    const fresh = restoreEquivalentField(removed, 'Nouveau champ', 'texte')
    expect(fresh.restored).toBe(false)
    expect(fresh.cat.fields.at(-1)?.id).not.toBe('f-genre')

    await db.table<Sheet, string>('sheets').delete(sheet.id)
    await db.table<Category, string>('categories').delete(cat.id)
  })

  it('moveField réordonne sans perdre de champ', () => {
    const cat = mkCat()
    const up = moveField(cat, 'f-annee', -1)
    expect(up.fields.map((f) => f.id)).toEqual(['f-annee', 'f-genre'])
    expect(moveField(cat, 'f-genre', -1).fields.map((f) => f.id)).toEqual(['f-genre', 'f-annee'])
    expect(moveField(cat, 'f-genre', 1).fields.map((f) => f.id)).toEqual(['f-annee', 'f-genre'])
  })

  it('deleteCategory : moveTo null supprime les fiches, moveTo les déplace (5.C)', async () => {
    const a = mkCat({ id: 'catA', name: 'A' })
    const b = mkCat({ id: 'catB', name: 'B' })
    await saveCategory(a)
    await saveCategory(b)
    const s1 = mkSheet('catA', {})
    const s2 = mkSheet('catA', {})
    await db.table<Sheet, string>('sheets').bulkPut([s1, s2])

    await deleteCategory('catA', 'catB')
    expect(await db.table<Category, string>('categories').get('catA')).toBeUndefined()
    const moved = await db.table<Sheet, string>('sheets').toArray()
    expect(moved.length).toBe(2)
    expect(moved.every((s) => s.categoryId === 'catB')).toBe(true)

    await saveCategory(a)
    await db.table<Sheet, string>('sheets').bulkPut([mkSheet('catA', {}), mkSheet('catA', {})])
    await deleteCategory('catA', null)
    expect((await db.table<Sheet, string>('sheets').toArray()).every((s) => s.categoryId === 'catB')).toBe(true)
    expect((await listCategories()).map((c) => c.id)).toEqual(['catB'])
  })
})
