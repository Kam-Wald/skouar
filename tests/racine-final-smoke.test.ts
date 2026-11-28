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
  localStorage.setItem('skouar:settings', JSON.stringify({ apps: { racine: { onboarded: true, trackers: {} } } }))
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const RacineApp = (await import('../src/apps/racine/RacineApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/racine'] }, React.createElement(RacineApp)))
  })
  await flush(React, 60)
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.includes(t)) as HTMLButtonElement
  const btnByLabel = (l: string) => div.querySelector(`[aria-label="${l}"]`) as HTMLElement
  const btnByText = (t: string) => Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { React, root, div, sideBtn, btnByLabel, btnByText, setInput }
}

describe('Racine — rapports PDF/mensuel + ⚙️ Racine (suivis, constantes, export/import) (smoke jsdom, vrais clics)', () => {
  it('rapport mensuel + fiche médecin PDF générée, réglages (désactiver Sommeil, créer Tension), export JSON, import fusion avec snapshot', async () => {
    let captured: Blob | null = null
    URL.createObjectURL = ((b: Blob) => {
      captured = b
      return 'blob:test'
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL

    const { addEvent } = await import('../src/apps/racine/events')
    const now = Date.now()
    const DAY = 86400000
    await addEvent('moral', { level: 4 }, '', now)
    await addEvent('crise', { intensity: 7, zone: 'ventre' }, '', now - DAY)
    await addEvent('rdv', { date: now - 10 * DAY, praticien: 'Dr House' }, '', now - 10 * DAY)

    const { React, root, div, sideBtn, btnByLabel, btnByText, setInput } = await renderApp()

    await React.act(async () => {
      sideBtn('Rapports').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view')?.textContent).toContain('Ton mois')
    expect(div.querySelector('.ra-stats-grid')?.textContent).toContain('1')
    expect(div.querySelector('.ra-view')?.textContent).toContain('crise')
    await React.act(async () => {
      btnByLabel('Générer la fiche médecin (PDF)').click()
    })
    await flush(React, 120)
    expect(captured).toBeTruthy()
    const pdfBytes = new Uint8Array(await captured!.arrayBuffer())
    expect(new TextDecoder().decode(pdfBytes.slice(0, 5))).toBe('%PDF-')

    await React.act(async () => {
      sideBtn('Réglages').click()
    })
    await flush(React, 30)
    const tabApp = Array.from(div.querySelectorAll('.settings-tab-btn')).find((b) => b.textContent?.includes('Racine')) as HTMLButtonElement
    expect(tabApp).toBeTruthy()
    await React.act(async () => {
      tabApp.click()
    })
    await flush(React, 30)
    await React.act(async () => {
      ;(btnByLabel('Racine — suivi Sommeil') as HTMLInputElement).click()
    })
    await flush(React, 30)
    const stored = JSON.parse(localStorage.getItem('skouar:settings') ?? '{}')
    expect(stored.apps?.racine?.trackers?.sommeil).toBe(false)
    await React.act(async () => {
      setInput(btnByLabel('Nom de la constante') as HTMLInputElement, 'Tension')
      setInput(btnByLabel('Unité de la constante') as HTMLInputElement, 'mmHg')
    })
    await React.act(async () => {
      btnByLabel('Ajouter la constante').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('Tension (mmHg)')

    await React.act(async () => {
      btnByText('💾 Exporter mes données Racine (JSON, avec pièces jointes)').click()
    })
    await flush(React, 100)
    expect(captured).toBeTruthy()
    const exported = JSON.parse(await readBlobText(captured!))
    expect(exported.app).toBe('racine')
    expect(exported.events.length).toBe(3)
    expect(exported.attachments).toEqual([])

    const { listEvents, listRefs, getProfile } = await import('../src/apps/racine/store')
    const { listQuestions } = await import('../src/apps/racine/agenda')
    const { exportData } = await import('../src/apps/racine/io')
    const { makeEvent } = await import('../src/apps/racine/store')
    const extra = makeEvent('note', Date.now(), {}, 'entrée importée')
    const importJson = await exportData([...(await listEvents()), extra], await listRefs(), await getProfile(), [], await listQuestions(), false)
    const fileInput = div.querySelector('input[type=file][aria-label="Fichier de sauvegarde Racine"]') as HTMLInputElement
    await React.act(async () => {
      btnByText('📥 Importer une sauvegarde Racine (JSON)').click()
    })
    await React.act(async () => {
      btnByText('⚠️ Confirmer l’import (fusion) ?').click()
    })
    await React.act(async () => {
      const file = new File([importJson], 'salveto-sauvegarde-2026-11-28.json', { type: 'application/json' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 150)
    const preSnapKeys = Object.keys(localStorage).filter((k) => k.startsWith('skouar:preImport:'))
    expect(preSnapKeys.length).toBeGreaterThanOrEqual(1)
    const all = await listEvents()
    expect(all.some((e) => e.id === extra.id)).toBe(true)
    expect(div.querySelector('.toast')?.textContent).toContain('Import OK')

    await React.act(async () => {
      sideBtn('Réglages').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      sideBtn('Accueil').click()
    })
    await flush(React, 30)
    expect(btnByText('+ Sommeil')).toBeFalsy()
    expect(btnByText('+ Moral')).toBeTruthy()

    root.unmount()
    div.remove()
  })
})
