// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, kv, listCategories, seedDefaultCategories, categoryStats, DEFAULT_CATEGORY_SEEDS, type Sheet } from '../src/apps/fichorama/store'
import { APP_DB_MAP } from '../src/shared/db'

describe('fichorama — règles de données (CDC 2.A / 9)', () => {
  it('APP_DB_MAP déclare skouar-fichorama et le schéma v1 a kv/categories/sheets', () => {
    expect(APP_DB_MAP.fichorama).toBe('skouar-fichorama')
    expect(db.tables.map((t) => t.name).sort()).toEqual(['categories', 'kv', 'sheets'])
  })

  it('seed : les 9 catégories par défaut sont insérées une seule fois (pas de re-seed si l’utilisateur a tout supprimé)', async () => {
    await seedDefaultCategories()
    const cats = await listCategories()
    expect(cats.length).toBe(DEFAULT_CATEGORY_SEEDS.length)
    expect(cats.map((c) => c.name)).toEqual(DEFAULT_CATEGORY_SEEDS.map((c) => c.name))
    const films = cats.find((c) => c.name === 'Films')!
    expect(films.fields.map((f) => f.label)).toEqual(['Réalisateur', 'Année', 'Genre', 'Durée (min)'])
    expect(films.fields.every((f) => typeof f.id === 'string' && f.id.length > 0)).toBe(true)
    await seedDefaultCategories()
    expect((await listCategories()).length).toBe(DEFAULT_CATEGORY_SEEDS.length)
    await db.table('categories').clear()
    await kv.saveKV('seeded', true)
    await seedDefaultCategories()
    expect((await listCategories()).length).toBe(0)
  })

  it('kvOf persiste (keyPath id)', async () => {
    await kv.saveKV('x', { a: 1 })
    expect(await kv.loadKV('x')).toEqual({ a: 1 })
  })

  it('categoryStats : nombre de fiches et moyenne par catégorie', () => {
    const sheets = [
      { categoryId: 'c1', note: 8 },
      { categoryId: 'c1', note: 6 },
      { categoryId: 'c2', note: 10 }
    ] as Sheet[]
    expect(categoryStats(sheets, 'c1')).toEqual({ count: 2, avg: 7 })
    expect(categoryStats(sheets, 'c2')).toEqual({ count: 1, avg: 10 })
    expect(categoryStats(sheets, 'c3')).toEqual({ count: 0, avg: null })
  })
})
