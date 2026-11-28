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
