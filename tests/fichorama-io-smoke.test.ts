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

const flush = async (React: typeof import('react'), ms = 60) =>
  React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const FichoramaApp = (await import('../src/apps/fichorama/FichoramaApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/fichorama'] }, React.createElement(FichoramaApp)))
  })
  await flush(React, 60)
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.includes(t)) as HTMLButtonElement
  const btnByText = (t: string) => Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const setSelect = (el: HTMLSelectElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { React, root, div, sideBtn, btnByText, setSelect }
}

describe('Fichorama — export/import JSON via ⚙️ (smoke jsdom, vrais clics)', () => {
  it('onglet Fichorama : export JSON capturé (images en base64), import fusion puis remplacer, snapshot skouar:preImport:* fait, fichier invalide sans casse', async () => {
    let captured: Blob | null = null
    URL.createObjectURL = ((b: Blob) => {
      captured = b
      return 'blob:test'
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL

    const { listCategories, listSheets, seedDefaultCategories } = await import('../src/apps/fichorama/store')
    const { makeSheet, saveSheet } = await import('../src/apps/fichorama/sheets')
    const { exportData } = await import('../src/apps/fichorama/io')
    await seedDefaultCategories()
    const cats = await listCategories()
    const films = cats.find((c) => c.name === 'Films')!
    const dune = makeSheet(films.id, 'Dune', 8, {}, 'chef-d’œuvre', true, new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
    await saveSheet(dune)

    const { React, root, div, sideBtn, btnByText, setSelect } = await renderApp()
    await React.act(async () => {
      sideBtn('Réglages').click()
    })
    await flush(React, 30)
    const tabApp = Array.from(div.querySelectorAll('.settings-tab-btn')).find((b) => b.textContent?.includes('Fichorama')) as HTMLButtonElement
    expect(tabApp).toBeTruthy()
    await React.act(async () => {
      tabApp.click()
    })
    await flush(React, 30)

    await React.act(async () => {
      btnByText('💾 Exporter mes données Fichorama (JSON)').click()
    })
    await flush(React, 80)
    expect(captured).toBeTruthy()
    const exported = JSON.parse(await readBlobText(captured!))
    expect(exported.app).toBe('fichorama')
    expect(exported.categories.length).toBe(9)
    expect(exported.sheets.length).toBe(1)
    expect(exported.sheets[0].title).toBe('Dune')
    expect('image' in exported.sheets[0]).toBe(true)

    const fileInput = div.querySelector('input[type=file][aria-label="Fichier de sauvegarde Fichorama"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const arrival = makeSheet(films.id, 'Arrival', 7, {}, '', false, null)
    const duneUp = { ...dune, note: 10 }
    const fusionJson = await exportData(cats, [duneUp, arrival])
    await React.act(async () => {
      btnByText('📥 Importer une sauvegarde Fichorama (JSON)').click()
    })
    await React.act(async () => {
      btnByText('⚠️ Confirmer l’import (fusion) ?').click()
    })
    await React.act(async () => {
      const file = new File([fusionJson], 'fichorama-sauvegarde-2026-11-28.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 120)
    const preSnapKeys = Object.keys(localStorage).filter((k) => k.startsWith('skouar:preImport:'))
    expect(preSnapKeys.length).toBeGreaterThanOrEqual(1)
    let sheets = await listSheets()
    expect(sheets.length).toBe(2)
    expect(sheets.find((s) => s.id === dune.id)?.note).toBe(10)
    expect(sheets.some((s) => s.id === arrival.id)).toBe(true)
    expect(div.querySelector('.toast')?.textContent).toContain('Import OK')

    const solo = makeSheet(films.id, 'Solo', 3, {}, '', false, null)
    const replaceJson = await exportData(cats, [solo])
    await React.act(async () => {
      setSelect(div.querySelector('[aria-label="Fichorama — mode d’import"]') as HTMLSelectElement, 'remplacer')
    })
    await React.act(async () => {
      btnByText('📥 Importer une sauvegarde Fichorama (JSON)').click()
    })
    await React.act(async () => {
      btnByText('⚠️ Confirmer l’import (remplacement total) ?').click()
    })
    await React.act(async () => {
      const file = new File([replaceJson], 'fichorama-sauvegarde-2026-11-29.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 150)
    sheets = await listSheets()
    expect(sheets.map((s) => s.title)).toEqual(['Solo'])

    await React.act(async () => {
      btnByText('📥 Importer une sauvegarde Fichorama (JSON)').click()
    })
    await React.act(async () => {
      btnByText('⚠️ Confirmer l’import (remplacement total) ?').click()
    })
    await React.act(async () => {
      const file = new File(['{"app":"autre"}'], 'bidon.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 120)
    expect(div.querySelector('.toast')?.textContent).toContain('Import interrompu')
    expect((await listSheets()).map((s) => s.title)).toEqual(['Solo'])

    root.unmount()
    div.remove()
  })
})
