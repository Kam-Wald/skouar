// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
if (typeof Blob !== 'undefined' && !(Blob.prototype as unknown as { arrayBuffer?: unknown }).arrayBuffer) {
  ;(Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = function (this: Blob) {
    const self = this
    return new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as ArrayBuffer)
      fr.onerror = () => rej(fr.error)
      fr.readAsArrayBuffer(self)
    })
  }
}
if (typeof Blob !== 'undefined' && !(Blob.prototype as unknown as { stream?: unknown }).stream) {
  ;(Blob.prototype as unknown as { stream: () => ReadableStream }).stream = function (this: Blob) {
    const self = this
    return new ReadableStream({
      start(controller) {
        const fr = new FileReader()
        fr.onload = () => {
          controller.enqueue(new Uint8Array(fr.result as ArrayBuffer))
          controller.close()
        }
        fr.onerror = () => controller.error(fr.error)
        fr.readAsArrayBuffer(self)
      }
    })
  }
}
import { zipFiles, unzipFiles, entryText } from '../src/apps/kod/zip'
import { exportBackup, importBackup } from '../src/shared/backup'
import { BG_PRESETS, launcherBgCss, saveLauncherBg, loadLauncherBg } from '../src/shared/launcherBg'

describe('zip roundtrip', () => {
  it('zipFiles/unzipFiles : aller-retour fidèle', async () => {
    const zip = await zipFiles([
      { name: 'a.txt', data: 'bonjour œ é ç' },
      { name: 'b.bin', data: new Uint8Array([0, 1, 2, 250, 255]) }
    ])
    const entries = await unzipFiles(zip)
    expect(entries.length).toBe(2)
    expect(entryText(entries.find((e) => e.name === 'a.txt')!)).toBe('bonjour œ é ç')
    expect(Array.from(entries.find((e) => e.name === 'b.bin')!.data)).toEqual([0, 1, 2, 250, 255])
  })
})

describe('backup global', () => {
  it('exportBackup puis importBackup : localStorage + IDB restaurés', async () => {
    localStorage.setItem('skouar:test', 'valeur œ')
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('skouar-test-db', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' })
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const tx = db.transaction('items', 'readwrite')
    tx.objectStore('items').put({ id: 'x1', name: 'lapin', tags: ['œuf', 'carotte'], n: 42 })
    await new Promise<void>((res) => { tx.oncomplete = () => res() })
    db.close()

    const zip = await exportBackup()
    localStorage.removeItem('skouar:test')
    await new Promise<void>((res) => { const d = indexedDB.deleteDatabase('skouar-test-db'); d.onsuccess = () => res(); d.onerror = () => res() })

    const r = await importBackup(zip)
    expect(r.ls).toBeGreaterThanOrEqual(1)
    expect(r.dbs).toBeGreaterThanOrEqual(1)
    expect(localStorage.getItem('skouar:test')).toBe('valeur œ')

    const db2 = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('skouar-test-db', 1)
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    const tx2 = db2.transaction('items', 'readonly')
    const got = await new Promise<IDBValidKey>((res, rej) => {
      const g = tx2.objectStore('items').get('x1')
      g.onsuccess = () => res(g.result)
      g.onerror = () => rej(g.error)
    })
    const rec = got as { id: string; name: string; tags: string[]; n: number }
    expect(rec.name).toBe('lapin')
    expect(rec.tags).toEqual(['œuf', 'carotte'])
    expect(rec.n).toBe(42)
    db2.close()
  })
})

describe('launcherBg', () => {
  it('save/load + css des 4 types', () => {
    saveLauncherBg(null)
    expect(loadLauncherBg()).toBeNull()
    expect(launcherBgCss(null)).toBeUndefined()
    saveLauncherBg({ type: 'solid', c1: '#123456', c2: '#000000', angle: 135 })
    expect(loadLauncherBg()?.type).toBe('solid')
    expect(launcherBgCss(loadLauncherBg())).toBe('linear-gradient(var(--launcher-scrim), var(--launcher-scrim)), #123456')
    saveLauncherBg({ type: 'gradient', c1: '#111111', c2: '#155b60', angle: 90 })
    expect(launcherBgCss(loadLauncherBg())).toBe('linear-gradient(var(--launcher-scrim), var(--launcher-scrim)), linear-gradient(90deg, #111111, #155b60)')
    saveLauncherBg({ type: 'dots', c1: '#ffffff', c2: '#0b0f19', angle: 0 })
    expect(launcherBgCss(loadLauncherBg())).toContain('radial-gradient')
    saveLauncherBg({ type: 'grid', c1: '#ffffff', c2: '#0b0f19', angle: 0 })
    expect(launcherBgCss(loadLauncherBg())).toContain('linear-gradient')
    saveLauncherBg(null)
  })

  it('BG_PRESETS : au moins 6 presets, tous avec voile de lisibilité', () => {
    expect(BG_PRESETS.length).toBeGreaterThanOrEqual(6)
    for (const p of BG_PRESETS) {
      expect(launcherBgCss(p.bg)).toContain('var(--launcher-scrim)')
    }
  })
})
