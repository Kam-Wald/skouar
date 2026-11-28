// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { applyOrder, loadLauncherOrder, moveId, resetLauncherOrder, saveLauncherOrder } from '../src/shared/launcherOrder'

const KEY = 'skouar:launcher:order'

describe('launcherOrder — persistance + application', () => {
  beforeEach(() => localStorage.clear())

  it('load/save/reset via localStorage', () => {
    expect(loadLauncherOrder()).toEqual([])
    saveLauncherOrder(['b', 'a'])
    expect(loadLauncherOrder()).toEqual(['b', 'a'])
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['b', 'a'])
    resetLauncherOrder()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(loadLauncherOrder()).toEqual([])
    localStorage.setItem(KEY, 'pas du json')
    expect(loadLauncherOrder()).toEqual([])
  })

  it('applyOrder : ordre perso d’abord, ids inconnus en fin, stable', () => {
    const apps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    expect(applyOrder(apps, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(applyOrder(apps, []).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('moveId : insère avant la cible, gère début/fin et id inconnu', () => {
    expect(moveId(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
    expect(moveId(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveId(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a'])
    expect(moveId(['a', 'b', 'c'], 'x', 'a')).toEqual(['a', 'b', 'c'])
    expect(moveId(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c'])
  })
})
