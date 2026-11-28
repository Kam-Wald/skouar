import { describe, it, expect } from 'vitest'
import {
  catStats,
  clampNote,
  fmtNote,
  globalStats,
  noteOf,
  searchFiches,
  seedData,
  validateData,
  type Fiche,
  type FichoramaData
} from '../src/apps/fichorama/logic'

function fiche(id: string, catId: string, title: string, notes: number[], extra: Partial<Fiche> = {}): Fiche {
  const now = '2026-01-01T10:00:00.000Z'
  return {
    id,
    categoryId: catId,
    title,
    comment: '',
    favori: false,
    values: {},
    ratings: notes.map((value, i) => ({ value, date: `2026-01-0${i + 1}T10:00:00.000Z` })),
    createdAt: now,
    updatedAt: now,
    ...extra
  }
}

describe('Fichorama — modèle (S2)', () => {
  it('seedData : 9 catégories intégrées avec champs par défaut', () => {
    const d = seedData()
    expect(d.version).toBe(1)
    expect(d.categories.map((c) => c.name)).toEqual(['Films', 'Livres', 'Albums', 'Mangas / BD', 'Jeux vidéo', 'Restaurants', 'Bars', 'Musées / Expos', 'Recettes'])
    expect(d.categories[0].fields.map((f) => f.id)).toEqual(['realisateur', 'annee', 'genre', 'duree'])
    expect(d.categories[0].fields.find((f) => f.id === 'genre')?.options).toContain('Action')
    expect(d.fiches).toEqual([])
    expect(validateData(d)).toBe(true)
    expect(validateData({ version: 2 })).toBe(false)
    expect(validateData(null)).toBe(false)
  })

  it('clampNote : demi-points, borné [0, 10]', () => {
    expect(clampNote(7.3)).toBe(7.5)
    expect(clampNote(7.2)).toBe(7)
    expect(clampNote(11)).toBe(10)
    expect(clampNote(-2)).toBe(0)
    expect(clampNote(NaN)).toBe(0)
    expect(fmtNote(7.5)).toBe('7,5')
  })

  it('noteOf = dernière note de l’historique ; stats globale et par catégorie', () => {
    const d: FichoramaData = { ...seedData(), fiches: [fiche('f1', 'cat-films', 'A', [6, 8]), fiche('f2', 'cat-films', 'B', [4]), fiche('f3', 'cat-livres', 'C', [9])] }
    expect(noteOf(d.fiches[0])).toBe(8)
    expect(catStats(d, 'cat-films')).toEqual({ nb: 2, moyenne: 6 })
    expect(catStats(d, 'cat-bars')).toEqual({ nb: 0, moyenne: null })
    expect(globalStats(d)).toEqual({ nb: 3, moyenne: 7 })
  })

  it('searchFiches : titre + commentaire, insensible à la casse', () => {
    const d: FichoramaData = {
      ...seedData(),
      fiches: [fiche('f1', 'cat-films', 'Le Grand Bleu', [8], { comment: 'superbe' }), fiche('f2', 'cat-films', 'Autre', [5], { comment: 'BOF' })]
    }
    expect(searchFiches(d, 'grand').map((f) => f.id)).toEqual(['f1'])
    expect(searchFiches(d, 'bof').map((f) => f.id)).toEqual(['f2'])
    expect(searchFiches(d, '')).toEqual([])
  })

  it('règle anti-perte : supprimer un champ masque la valeur (indexée par id), recréer le même id la retrouve', () => {
    const d = seedData()
    const cat = d.categories[0]
    const f = fiche('f1', cat.id, 'Film X', [7], { values: { realisateur: 'Hayao Miyazaki', annee: 2001 } })
    d.fiches.push(f)
    const before = { ...f.values }
    cat.fields = cat.fields.filter((fl) => fl.id !== 'realisateur')
    expect(cat.fields.find((fl) => fl.id === 'realisateur')).toBeUndefined()
    expect(f.values.realisateur).toBe('Hayao Miyazaki')
    cat.fields.push({ id: 'realisateur', label: 'Réalisateur', type: 'text' })
    expect(f.values).toEqual(before)
  })
})

describe('Fichorama — saisie (S3)', () => {
  it('validateDraft : titre requis + champs obligatoires', async () => {
    const { validateDraft, seedData } = await import('../src/apps/fichorama/logic')
    const cat = { ...seedData().categories[0], fields: [{ id: 'realisateur', label: 'Réalisateur', type: 'text' as const, required: true }] }
    expect(validateDraft(cat, { title: '', values: { realisateur: 'X' } })).toBe('Titre requis')
    expect(validateDraft(cat, { title: 'Film', values: {} })).toBe('Champ « Réalisateur » obligatoire')
    expect(validateDraft(cat, { title: 'Film', values: { realisateur: 'X' } })).toBeNull()
  })

  it('fmtFieldValue / fmtDateIso', async () => {
    const { fmtFieldValue, fmtDateIso } = await import('../src/apps/fichorama/logic')
    expect(fmtFieldValue(undefined)).toBe('—')
    expect(fmtFieldValue('abc')).toBe('abc')
    expect(fmtFieldValue(2001)).toBe('2001')
    expect(fmtFieldValue(true)).toBe('Oui')
    expect(fmtFieldValue(['a', 'b'])).toBe('a, b')
    expect(fmtFieldValue('2026-01-05')).toBe('05/01/2026')
    expect(fmtDateIso('2026-12-31T23:00:00.000Z')).toBe('31/12/2026')
  })
})

describe('Fichorama — re-notation (S4)', () => {
  it('addRating : ajoute à l’historique, borne, noteOf suit', async () => {
    const { addRating, noteOf } = await import('../src/apps/fichorama/logic')
    const f = fiche('f1', 'cat-films', 'A', [6])
    addRating(f, 8.5, '2026-02-01T10:00:00.000Z')
    expect(f.ratings).toHaveLength(2)
    expect(noteOf(f)).toBe(8.5)
    addRating(f, 99, '2026-03-01T10:00:00.000Z')
    expect(noteOf(f)).toBe(10)
  })
})

describe('Fichorama — tri / filtres (S5)', () => {
  it('sortFiches : toutes les clés', async () => {
    const { sortFiches } = await import('../src/apps/fichorama/logic')
    const fs = [
      fiche('a', 'cat-films', 'Beta', [5], { favori: false, createdAt: '2026-01-02T00:00:00.000Z' }),
      fiche('b', 'cat-films', 'Alpha', [9], { favori: true, createdAt: '2026-01-01T00:00:00.000Z' }),
      fiche('c', 'cat-films', 'Gamma', [7], { favori: false, createdAt: '2026-01-03T00:00:00.000Z' })
    ]
    expect(sortFiches(fs, 'note-desc').map((f) => f.id)).toEqual(['b', 'c', 'a'])
    expect(sortFiches(fs, 'note-asc').map((f) => f.id)).toEqual(['a', 'c', 'b'])
    expect(sortFiches(fs, 'titre').map((f) => f.id)).toEqual(['b', 'a', 'c'])
    expect(sortFiches(fs, 'date-desc').map((f) => f.id)).toEqual(['c', 'a', 'b'])
    expect(sortFiches(fs, 'date-asc').map((f) => f.id)).toEqual(['b', 'a', 'c'])
    expect(sortFiches(fs, 'fav').map((f) => f.id)[0]).toBe('b')
  })

  it('filterFiches : favoris, plage de notes, texte', async () => {
    const { filterFiches } = await import('../src/apps/fichorama/logic')
    const fs = [
      fiche('a', 'cat-films', 'Beta', [5], { favori: true }),
      fiche('b', 'cat-films', 'Alpha', [9], { comment: 'chef-d’œuvre' }),
      fiche('c', 'cat-films', 'Gamma', [7])
    ]
    expect(filterFiches(fs, { favOnly: true }).map((f) => f.id)).toEqual(['a'])
    expect(filterFiches(fs, { min: 7 }).map((f) => f.id)).toEqual(['b', 'c'])
    expect(filterFiches(fs, { max: 7 }).map((f) => f.id)).toEqual(['a', 'c'])
    expect(filterFiches(fs, { min: 6, max: 9 }).map((f) => f.id)).toEqual(['b', 'c'])
    expect(filterFiches(fs, { q: 'chef' }).map((f) => f.id)).toEqual(['b'])
    expect(filterFiches(fs, {}).length).toBe(3)
  })
})

describe('Fichorama — paramètres catégorie (S6)', () => {
  it('moveField réordonne, removeField garde les valeurs, deleteCategory déplace ou supprime', async () => {
    const { moveField, removeField, deleteCategory, seedData } = await import('../src/apps/fichorama/logic')
    const d = seedData()
    const cat = d.categories[0]
    expect(cat.fields.map((f) => f.id)).toEqual(['realisateur', 'annee', 'genre', 'duree'])
    moveField(cat, 'genre', -1)
    expect(cat.fields.map((f) => f.id)).toEqual(['realisateur', 'genre', 'annee', 'duree'])
    moveField(cat, 'realisateur', -1)
    expect(cat.fields.map((f) => f.id)).toEqual(['realisateur', 'genre', 'annee', 'duree'])
    const f = fiche('f1', cat.id, 'X', [7], { values: { genre: 'SF' } })
    d.fiches.push(f)
    removeField(cat, 'genre')
    expect(cat.fields.find((fl) => fl.id === 'genre')).toBeUndefined()
    expect(f.values.genre).toBe('SF')
    deleteCategory(d, 'cat-livres', 'cat-films')
    expect(d.categories.find((c) => c.id === 'cat-livres')).toBeUndefined()
    d.fiches.push(fiche('f2', 'cat-livres', 'Livre', [8]))
    deleteCategory(d, 'cat-livres', null)
  })

  it('deleteCategory : déplacement vs suppression des fiches', async () => {
    const { deleteCategory, seedData } = await import('../src/apps/fichorama/logic')
    const d = seedData()
    d.fiches.push(fiche('f1', 'cat-films', 'A', [7]), fiche('f2', 'cat-livres', 'B', [8]), fiche('f3', 'cat-livres', 'C', [9]))
    deleteCategory(d, 'cat-livres', 'cat-films')
    expect(d.fiches.every((f) => f.categoryId !== 'cat-livres')).toBe(true)
    expect(d.fiches.filter((f) => f.categoryId === 'cat-films').length).toBe(3)
    const d2 = seedData()
    d2.fiches.push(fiche('f1', 'cat-films', 'A', [7]), fiche('f2', 'cat-livres', 'B', [8]))
    deleteCategory(d2, 'cat-livres', null)
    expect(d2.fiches.length).toBe(1)
    expect(d2.fiches[0].id).toBe('f1')
  })
})

describe('Fichorama — export / import JSON (S7)', () => {
  it('exportJson → parseImport roundtrip valide', async () => {
    const { exportJson, parseImport, seedData } = await import('../src/apps/fichorama/logic')
    const d = seedData()
    d.fiches.push(fiche('f1', 'cat-films', 'A', [7], { image: 'data:image/jpeg;base64,AAAA', values: { genre: 'SF' } }))
    const back = parseImport(exportJson(d))
    expect(back).not.toBeNull()
    expect(back!.fiches[0].image).toContain('data:image/jpeg')
    expect(back!.categories.length).toBe(9)
  })

  it('parseImport : invalide → null', async () => {
    const { parseImport } = await import('../src/apps/fichorama/logic')
    expect(parseImport('pas du json')).toBeNull()
    expect(parseImport('{"version":2}')).toBeNull()
    expect(parseImport('{"version":1,"categories":[],"fiches":"x"}')).toBeNull()
  })

  it('mergeData : fusion par id (les existantes gagnent, les inconnues ajoutées)', async () => {
    const { mergeData, seedData } = await import('../src/apps/fichorama/logic')
    const cur = seedData()
    cur.fiches.push(fiche('f1', 'cat-films', 'Local', [5]))
    const inc = seedData()
    inc.categories.push({ id: 'cat-jeux2', name: 'Capsules', icon: '💊', color: '#000', fields: [] })
    inc.fiches.push(fiche('f1', 'cat-films', 'Importé', [9]), fiche('f9', 'cat-films', 'Nouveau', [8]))
    const m = mergeData(cur, inc)
    expect(m.categories.length).toBe(10)
    expect(m.fiches.length).toBe(2)
    expect(m.fiches.find((f) => f.id === 'f1')!.title).toBe('Local')
    expect(m.fiches.find((f) => f.id === 'f9')!.title).toBe('Nouveau')
  })
})
