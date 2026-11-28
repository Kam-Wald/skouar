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

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia
  }
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function seedOnboarded() {
  const { saveConfig, saveEvent } = await import('../src/apps/salveto/store')
  const { makeEvent, seedConfig, todayDay } = await import('../src/apps/salveto/logic')
  saveConfig({ ...seedConfig(), onboarded: true })
  await saveEvent(makeEvent('note', { notes: 'entrée locale avant import' }))
  await sleep(600)
}

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const SalvetoApp = (await import('../src/apps/salveto/SalvetoApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(SalvetoApp)))
  })
  await React.act(async () => {
    await sleep(60)
  })
  return { React, root, div }
}

const btn = (div: HTMLElement, sel: string) => div.querySelector(sel) as HTMLButtonElement
const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement

describe('Salveto S11 — paramètres, activation suivis, export/import avec snapshot (smoke jsdom)', () => {
  it('paramètres : désactiver « cycle » → persisté, bouton accueil correspondant retiré, données conservées', async () => {
    await seedOnboarded()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="parametres"]').click()
    })
    expect(div.querySelectorAll('[data-suivi-toggle]').length).toBe(13)
    await React.act(async () => {
      ;(div.querySelector('[data-suivi-toggle="cycle"]') as HTMLInputElement).click()
    })
    await React.act(async () => {
      await sleep(500)
    })
    const { loadConfig } = await import('../src/apps/salveto/store')
    expect((await loadConfig()).activeSuivis).not.toContain('cycle')
    await React.act(async () => {
      btn(div, '[data-nav="accueil"]').click()
    })
    expect(div.querySelector('[data-quick="cycle"]')).toBeNull()
    expect(div.querySelectorAll('.sa-quick-btn').length).toBe(11)
    root.unmount()
    div.remove()
  })

  it('import JSON « remplacer tout » : validation + snapshotBeforeImport (clé skouar:preImport:*) + données remplacées + rechargement', async () => {
    const { buildBackup, makeEvent, seedConfig, seedProfil, seedRefs } = await import('../src/apps/salveto/logic')
    const backup = buildBackup(
      {
        config: { ...seedConfig(), onboarded: true },
        refs: seedRefs(),
        profil: seedProfil(),
        events: [makeEvent('note', { notes: 'note importée depuis sauvegarde' })],
        attachments: []
      },
      false
    )
    const file = new File([JSON.stringify(backup)], 'salveto-sauvegarde-test.json', { type: 'application/json' })
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="parametres"]').click()
    })
    const fileInput = div.querySelector('input[type="file"]') as HTMLInputElement
    await React.act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(150)
    })
    expect(div.querySelector('[data-pending-import]')).toBeTruthy()
    expect(div.textContent).toContain('snapshot de sécurité')
    await React.act(async () => {
      btnByText(div, 'Remplacer tout').click()
      await sleep(400)
    })
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('skouar:preImport:'))
    expect(keys.length).toBeGreaterThanOrEqual(1)
    const { loadEvents } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    expect(evs.length).toBe(1)
    expect(evs[0].notes).toBe('note importée depuis sauvegarde')
    // rechargement → l'accueil affiche l'entrée importée
    await React.act(async () => {
      await sleep(300)
    })
    expect(div.textContent).toContain('note importée depuis sauvegarde')
    root.unmount()
    div.remove()
  })

  it('import invalide → refusé avec message, aucune donnée touchée', async () => {
    const bad = new File(['{"app":"autre"}'], 'bad.json', { type: 'application/json' })
    let toast = ''
    const onToast = (e: Event) => {
      toast = (e as CustomEvent<string>).detail
    }
    window.addEventListener('skouar:toast', onToast)
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="parametres"]').click()
    })
    const fileInput = div.querySelector('input[type="file"]') as HTMLInputElement
    await React.act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [bad], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(150)
    })
    expect(toast).toContain('Import refusé')
    expect(div.querySelector('[data-pending-import]')).toBeNull()
    const { loadEvents } = await import('../src/apps/salveto/store')
    expect((await loadEvents()).length).toBe(1)
    window.removeEventListener('skouar:toast', onToast)
    root.unmount()
    div.remove()
  })
})
