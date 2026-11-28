// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

if (typeof Blob !== 'undefined' && !(Blob.prototype as unknown as { arrayBuffer?: unknown }).arrayBuffer) {
  ;(Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = function (this: Blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as ArrayBuffer)
      fr.onerror = () => rej(fr.error)
      fr.readAsArrayBuffer(this)
    })
  }
}

const readBlobText = (b: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result))
    fr.onerror = () => rej(fr.error)
    fr.readAsText(b)
  })

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia
  }
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const UnvezApp = (await import('../src/apps/unvez/UnvezApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/unvez'] }, React.createElement(UnvezApp)))
  })
  await React.act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.includes(t)) as HTMLButtonElement
  const btnByText = (t: string) => Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const setSelect = (el: HTMLSelectElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { React, root, div, sideBtn, btnByText, setInput, setSelect }
}

describe('Unvez — réglages app dans ⚙️ + export/import JSON (smoke jsdom)', () => {
  it('onglet Unvez : décimales/scientifique/convention persistés en localStorage, export JSON téléchargeable, import avec snapshot', async () => {
    let captured: Blob | null = null
    URL.createObjectURL = ((b: Blob) => {
      captured = b
      return 'blob:test'
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL

    const { db, uid } = await import('../src/apps/unvez/store')
    const { saveMemo, listMemos } = await import('../src/apps/unvez/memos')
    const { exportData } = await import('../src/apps/unvez/io')
    await saveMemo(db, { id: 'm1', name: 'Mémo test', note: '', folderId: null, bg: null, kind: 'calc', expr: '2+2', familyId: null, fromUnit: null, toUnit: null, input: '2+2', result: '4', createdAt: 1, updatedAt: 1 })

    const { React, root, div, sideBtn, btnByText, setSelect } = await renderApp()
    await React.act(async () => {
      sideBtn('Réglages').click()
    })
    const tabApp = Array.from(div.querySelectorAll('.settings-tab-btn')).find((b) => b.textContent?.includes('Unvez')) as HTMLButtonElement
    expect(tabApp).toBeTruthy()
    await React.act(async () => {
      tabApp.click()
    })
    const decSel = div.querySelector('[aria-label="Unvez — décimales"]') as HTMLSelectElement
    expect(decSel).toBeTruthy()
    await React.act(async () => {
      setSelect(decSel, '10')
    })
    const stored = JSON.parse(localStorage.getItem('skouar:settings') ?? '{}')
    expect(stored.apps?.unvez?.decimals).toBe(10)

    const sciBox = div.querySelector('[aria-label="Unvez — calculatrice scientifique"]') as HTMLInputElement
    await React.act(async () => {
      sciBox.click()
    })
    const stored2 = JSON.parse(localStorage.getItem('skouar:settings') ?? '{}')
    expect(stored2.apps?.unvez?.sci).toBe(false)

    await React.act(async () => {
      btnByText('💾 Exporter mes données Unvez (JSON)').click()
    })
    expect(captured).toBeTruthy()
    const exported = JSON.parse(await readBlobText(captured!))
    expect(exported.app).toBe('unvez')
    expect(exported.memos.length).toBe(1)
    expect(exported.memos[0].name).toBe('Mémo test')

    const backup = exportData(
      [
        { id: 'm2', name: 'Importé 1', note: '', folderId: null, bg: null, kind: 'calc', expr: '5+5', familyId: null, fromUnit: null, toUnit: null, input: '5+5', result: '10', createdAt: 2, updatedAt: 2 },
        { id: 'm3', name: 'Importé 2', note: '', folderId: null, bg: null, kind: 'conv', expr: '1 km → mi', familyId: 'distance', fromUnit: 'km', toUnit: 'mi', input: '1', result: '0,621371', createdAt: 3, updatedAt: 3 }
      ],
      [],
      {}
    )
    const fileInput = div.querySelector('input[type=file][aria-label="Fichier de sauvegarde Unvez"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    await React.act(async () => {
      btnByText('📥 Importer une sauvegarde Unvez (JSON)').click()
    })
    await React.act(async () => {
      btnByText('⚠️ Confirmer l’import (remplace mémos + dossiers actuels) ?').click()
    })
    await React.act(async () => {
      const file = new File([backup], 'unvez-sauvegarde-2026-11-28.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    const preSnapKeys = Object.keys(localStorage).filter((k) => k.startsWith('skouar:preImport:'))
    expect(preSnapKeys.length).toBeGreaterThanOrEqual(1)
    const memos = await listMemos(db)
    expect(memos.map((m) => m.id).sort()).toEqual(['m2', 'm3'])
    root.unmount()
    div.remove()
  })
})
