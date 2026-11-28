// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { avgNote, filterSheets, fmtAvg, makeSheet, querySheets, searchSheets, sortSheets, type SheetFilter } from '../src/apps/fichorama/sheets'
import type { Sheet } from '../src/apps/fichorama/store'

const mk = (title: string, note: number, fav: boolean, comment: string, createdAt: number): Sheet => ({
  ...makeSheet('c1', title, note, {}, comment, fav, null),
  createdAt
})

const sheets: Sheet[] = [
  mk('Dune', 9, true, 'chef-d’œuvre de SF', 1000),
  mk('Arrival', 7, false, 'langage et temps', 3000),
  mk('Blade Runner', 5, false, 'visuel', 2000)
]

const F = (over: Partial<SheetFilter> = {}): SheetFilter => ({ q: '', favOnly: false, minNote: null, maxNote: null, ...over })

describe('fichorama — consultation/tri/filtres (CDC 7.B/7.C/7.D, logique)', () => {
  it('sortSheets : note (défaut, desc), date (desc), titre (fr), favoris (fav d’abord puis note)', () => {
    expect(sortSheets(sheets, 'note').map((s) => s.title)).toEqual(['Dune', 'Arrival', 'Blade Runner'])
    expect(sortSheets(sheets, 'date').map((s) => s.title)).toEqual(['Arrival', 'Blade Runner', 'Dune'])
    expect(sortSheets(sheets, 'titre').map((s) => s.title)).toEqual(['Arrival', 'Blade Runner', 'Dune'])
    expect(sortSheets(sheets, 'fav').map((s) => s.title)).toEqual(['Dune', 'Arrival', 'Blade Runner'])
  })

  it('filterSheets : favoris seuls, plage de notes min/max, recherche plein texte titre+commentaire', () => {
    expect(filterSheets(sheets, F({ favOnly: true })).map((s) => s.title)).toEqual(['Dune'])
    expect(filterSheets(sheets, F({ minNote: 8 })).map((s) => s.title)).toEqual(['Dune'])
    expect(filterSheets(sheets, F({ maxNote: 6 })).map((s) => s.title)).toEqual(['Blade Runner'])
    expect(filterSheets(sheets, F({ minNote: 6, maxNote: 8 })).map((s) => s.title)).toEqual(['Arrival'])
    expect(filterSheets(sheets, F({ q: 'visuel' })).map((s) => s.title)).toEqual(['Blade Runner'])
    expect(filterSheets(sheets, F({ q: 'DUNE' })).map((s) => s.title)).toEqual(['Dune'])
    expect(filterSheets(sheets, F({ q: '   ' })).length).toBe(3)
    expect(searchSheets(sheets, 'langage').map((s) => s.title)).toEqual(['Arrival'])
  })

  it('querySheets : filtre puis tri composé', () => {
    expect(querySheets(sheets, F({ minNote: 5 }), 'titre').map((s) => s.title)).toEqual(['Arrival', 'Blade Runner', 'Dune'])
    expect(querySheets(sheets, F({ q: 'dune', minNote: 8 }), 'note').map((s) => s.title)).toEqual(['Dune'])
    expect(querySheets(sheets, F({ q: 'a', minNote: 8 }), 'note')).toEqual([])
    expect(querySheets(sheets, F({ favOnly: true, q: 'zzz' }), 'note')).toEqual([])
  })

  it('avgNote / fmtAvg : moyenne FR (virgule), null sur liste vide', () => {
    expect(avgNote(sheets)).toBeCloseTo(7)
    expect(avgNote([])).toBeNull()
    expect(fmtAvg(7)).toBe('7,0')
    expect(fmtAvg(7.25)).toBe('7,3')
  })
})
