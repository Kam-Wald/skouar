import { describe, it, expect } from 'vitest'
import { relTime, safeName, parseRanges, filterDocs, sortDocs, progressOf, duplicateTitle, clampScale, fitWidthScale, clampPage } from '../src/apps/marge/logic'

describe('marge — logic (fonctions pures)', () => {
  it('relTime : à l’instant, minutes, heures, puis date fr-FR', () => {
    const now = Date.now()
    expect(relTime(now, now)).toBe("à l'instant")
    expect(relTime(now - 30 * 1000, now)).toBe("à l'instant")
    expect(relTime(now - 5 * 60 * 1000, now)).toBe('il y a 5 min')
    expect(relTime(now - 59 * 60 * 1000, now)).toBe('il y a 59 min')
    expect(relTime(now - 3 * 3600 * 1000, now)).toBe('il y a 3 h')
    expect(relTime(now - 23 * 3600 * 1000, now)).toBe('il y a 23 h')
    const ts = now - 5 * 86400 * 1000
    expect(relTime(ts, now)).toBe(new Date(ts).toLocaleDateString('fr-FR'))
  })

  it('safeName : caractères interdits Windows remplacés par -', () => {
    expect(safeName('rapport: final?.pdf')).toBe('rapport- final-.pdf')
    expect(safeName('a/b\\c*d"e<f>g|h')).toBe('a-b-c-d-e-f-g-h')
    expect(safeName('déjà bon.pdf')).toBe('déjà bon.pdf')
  })

  it('parseRanges : plages « 1-3, 5 », bornes ramenées entre 1 et max', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual([1, 2, 3, 5])
    expect(parseRanges('7', 10)).toEqual([7])
    expect(parseRanges('9-99', 10)).toEqual([9, 10])
    expect(parseRanges('0-2', 10)).toEqual([1, 2])
    expect(parseRanges('abc, 2', 10)).toEqual([2])
    expect(parseRanges('', 10)).toEqual([])
    expect(parseRanges('3-1', 10)).toEqual([3])
    expect(parseRanges('2,2,4-4', 10)).toEqual([2, 4])
  })

  it('filterDocs : recherche insensible à la casse sur le titre, vide = tout', () => {
    const docs = [{ title: 'Rapport 2026' }, { title: 'notes Perso' }, { title: 'contrat.pdf' }]
    expect(filterDocs(docs, '')).toHaveLength(3)
    expect(filterDocs(docs, '  ')).toHaveLength(3)
    expect(filterDocs(docs, 'RAPPORT')).toEqual([{ title: 'Rapport 2026' }])
    expect(filterDocs(docs, 'perso').map((d) => d.title)).toEqual(['notes Perso'])
    expect(filterDocs(docs, 'zzz')).toHaveLength(0)
  })

  it('sortDocs : date (défaut), titre A–Z (fr), pages décroissant — sans muter l’entrée', () => {
    const docs = [
      { title: 'béta', updatedAt: 100, pages: 3 },
      { title: 'Alpha', updatedAt: 300, pages: 10 },
      { title: 'charlie', updatedAt: 200, pages: 7 }
    ]
    const byDate = sortDocs(docs, 'date').map((d) => d.title)
    expect(byDate).toEqual(['Alpha', 'charlie', 'béta'])
    expect(sortDocs(docs, 'titre').map((d) => d.title)).toEqual(['Alpha', 'béta', 'charlie'])
    expect(sortDocs(docs, 'pages').map((d) => d.pages)).toEqual([10, 7, 3])
    expect(docs[0].title).toBe('béta')
  })

  it('progressOf : 0 sans lastPage, ratio lastPage/pages borné entre 0 et 1', () => {
    expect(progressOf({ pages: 10 })).toBe(0)
    expect(progressOf({ pages: 10, lastPage: 5 })).toBe(0.5)
    expect(progressOf({ pages: 10, lastPage: 99 })).toBe(1)
    expect(progressOf({ pages: 0, lastPage: 3 })).toBe(0)
  })

  it('duplicateTitle : « Copie de X »', () => {
    expect(duplicateTitle('rapport')).toBe('Copie de rapport')
  })

  it('clampScale : borné entre 0,3 et 3, NaN → 1', () => {
    expect(clampScale(0.1)).toBe(0.3)
    expect(clampScale(10)).toBe(3)
    expect(clampScale(1.5)).toBe(1.5)
    expect(clampScale(NaN)).toBe(1)
  })

  it('fitWidthScale : largeur dispo - 56 marge, borné', () => {
    expect(fitWidthScale(856, 600)).toBeCloseTo(800 / 600, 10)
    expect(fitWidthScale(100, 600)).toBe(0.3)
    expect(fitWidthScale(900, 0)).toBe(1)
  })

  it('clampPage : entre 1 et numPages', () => {
    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(5, 10)).toBe(5)
    expect(clampPage(99, 10)).toBe(10)
    expect(clampPage(3, 0)).toBe(1)
    expect(clampPage(NaN, 10)).toBe(1)
  })
})
