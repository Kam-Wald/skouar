// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, type Category, type Sheet } from '../src/apps/fichorama/store'
import { addNote, deleteSheet, makeSheet, resizeImage, saveSheet, searchSheets, sortSheets, validateSheet } from '../src/apps/fichorama/sheets'

const cat: Category = {
  id: 'c1',
  name: 'Films',
  fields: [
    { id: 'f1', label: 'Réalisateur', type: 'texte', required: true },
    { id: 'f2', label: 'Genre', type: 'liste', options: ['SF', 'Drame'] }
  ],
  removedFields: [],
  createdAt: 1
}

describe('fichorama — fiches (CDC 4)', () => {
  it('validateSheet : titre obligatoire, note 0–10, champs requis, liste contrainte', () => {
    expect(validateSheet(cat, '', 5, {})).toContain('titre')
    expect(validateSheet(cat, 'Dune', 11, { f1: 'V' })).toContain('0 et 10')
    expect(validateSheet(cat, 'Dune', 8, {})).toContain('Réalisateur')
    expect(validateSheet(cat, 'Dune', 8, { f1: 'V', f2: 'Western' })).toContain('Genre')
    expect(validateSheet(cat, 'Dune', 8.5, { f1: 'Villeneuve', f2: 'SF' })).toBeNull()
  })

  it('makeSheet/saveSheet : fiche créée avec note dans l’historique, CRUD par id', async () => {
    const s = makeSheet('c1', 'Dune', 9, { f1: 'Villeneuve' }, 'chef-d’œuvre', true, null)
    expect(s.note).toBe(9)
    expect(s.notes).toEqual([{ value: 9, date: s.createdAt }])
    await saveSheet(s)
    expect((await db.table<Sheet, string>('sheets').get(s.id))?.title).toBe('Dune')
    await deleteSheet(s.id)
    expect(await db.table<Sheet, string>('sheets').get(s.id)).toBeUndefined()
  })

  it('addNote : re-notation empilée, ancienne note conservée (4.E)', () => {
    const s = makeSheet('c1', 'Dune', 9, {}, '', false, null)
    const s2 = addNote(s, 7, 2000)
    expect(s2.note).toBe(7)
    expect(s2.notes.map((n) => n.value)).toEqual([9, 7])
    expect(s.notes.length).toBe(1)
  })

  it('sortSheets : note (défaut), date, titre, favoris', () => {
    const a = makeSheet('c1', 'Alpha', 5, {}, '', false, null)
    const b = makeSheet('c1', 'Beta', 9, {}, '', true, null)
    const c = makeSheet('c1', 'Gamma', 9, {}, '', false, null)
    expect(sortSheets([a, b, c], 'note').map((s) => s.title)).toEqual(['Beta', 'Gamma', 'Alpha'])
    expect(sortSheets([a, b, c], 'fav').map((s) => s.title)).toEqual(['Beta', 'Gamma', 'Alpha'])
    expect(sortSheets([a, b, c], 'titre').map((s) => s.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(sortSheets([a, b, c], 'date').length).toBe(3)
  })

  it('searchSheets : plein texte titre + commentaire (7.C)', () => {
    const a = makeSheet('c1', 'Dune', 9, {}, 'épique', false, null)
    const b = makeSheet('c1', 'Matrix', 7, {}, 'cyberpunk', false, null)
    expect(searchSheets([a, b], 'dune').map((s) => s.title)).toEqual(['Dune'])
    expect(searchSheets([a, b], 'cyber').map((s) => s.title)).toEqual(['Matrix'])
    expect(searchSheets([a, b], '').length).toBe(2)
  })

  it('resizeImage : fallback propre hors canvas (jsdom renvoie le fichier tel quel)', async () => {
    const f = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const out = await resizeImage(f)
    expect(out).toBe(f)
  })
})
