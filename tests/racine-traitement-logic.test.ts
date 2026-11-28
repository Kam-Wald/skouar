// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { makeEvent, type RefEntity } from '../src/apps/racine/store'
import { validatePayload } from '../src/apps/racine/events'
import { EFFETS, effetLabel, effetScore, efficaciteStats, fmtCounts, fmtScore, isEffet } from '../src/apps/racine/traitement'

const ref = (id: string, name: string): RefEntity => ({ id, kind: 'traitement', name, unit: '', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: 1 })

describe('racine — traitements & efficacité (CDC §5, logique)', () => {
  it('EFFETS : 4 effets, scores, labels, isEffet', () => {
    expect(EFFETS).toEqual(['aucun', 'leger', 'marque', 'negatif'])
    expect(effetScore('marque')).toBe(2)
    expect(effetScore('leger')).toBe(1)
    expect(effetScore('aucun')).toBe(0)
    expect(effetScore('negatif')).toBe(-1)
    expect(effetLabel('marque')).toBe('Marqué')
    expect(isEffet('marque')).toBe(true)
    expect(isEffet('positif')).toBe(false)
  })

  it('validatePayload traitement : refId + effet valide requis', () => {
    expect(validatePayload('traitement', { refId: 'r1', name: 'X', effet: 'marque' })).toBeNull()
    expect(validatePayload('traitement', { refId: '', effet: 'marque' })).toContain('Traitement requis')
    expect(validatePayload('traitement', { refId: 'r1', effet: 'super' })).toContain('Effet requis')
  })

  it('efficaciteStats : agrégation par traitement, tri score desc, ref supprimée gardée via payload.name', () => {
    const refs = [ref('r1', 'Magnésium'), ref('r2', 'Tisane')]
    const events = [
      makeEvent('traitement', 3000, { refId: 'r1', name: 'Magnésium', effet: 'marque' }),
      makeEvent('traitement', 2000, { refId: 'r1', name: 'Magnésium', effet: 'marque' }),
      makeEvent('traitement', 1000, { refId: 'r1', name: 'Magnésium', effet: 'aucun' }),
      makeEvent('traitement', 500, { refId: 'r2', name: 'Tisane', effet: 'negatif' }),
      makeEvent('traitement', 400, { refId: 'gone', name: 'Ancien traitement', effet: 'leger' }),
      makeEvent('moral', 100, { level: 4 })
    ]
    const stats = efficaciteStats(events, refs)
    expect(stats.map((s) => s.name)).toEqual(['Magnésium', 'Ancien traitement', 'Tisane'])
    const mag = stats[0]
    expect(mag.total).toBe(3)
    expect(mag.score).toBeCloseTo(4 / 3)
    expect(mag.counts).toEqual({ marque: 2, aucun: 1 })
    expect(stats[2].score).toBe(-1)
    expect(efficaciteStats([], refs)).toEqual([])
  })

  it('fmtScore / fmtCounts : format FR', () => {
    expect(fmtScore(4 / 3)).toBe('+1,3')
    expect(fmtScore(-1)).toBe('-1,0')
    expect(fmtScore(0)).toBe('+0,0')
    expect(fmtCounts({ marque: 2, aucun: 1 })).toBe('2 marqués, 1 aucun')
    expect(fmtCounts({})).toBe('')
  })
})
