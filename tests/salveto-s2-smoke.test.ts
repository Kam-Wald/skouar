// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

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

async function seedOnboarded(active?: string[]) {
  const { saveConfig } = await import('../src/apps/salveto/store')
  const { seedConfig, SUIVI_IDS } = await import('../src/apps/salveto/logic')
  saveConfig({ ...seedConfig(), onboarded: true, activeSuivis: (active ?? [...SUIVI_IDS]) as never })
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
    await sleep(50)
  })
  return { React, root, div }
}

const btn = (div: HTMLElement, sel: string) => div.querySelector(sel) as HTMLButtonElement
const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const setInput = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Salveto S2 — saisie rapide (smoke jsdom)', () => {
  it('accueil : 8 boutons rapides visibles, saisie moral en 2 clics persistée et listée dans le résumé du jour', async () => {
    await seedOnboarded()
    const { React, root, div } = await renderApp()
    expect(div.querySelectorAll('.sa-quick-btn').length).toBe(8)
    await React.act(async () => {
      btn(div, '[data-quick="moral"]').click()
    })
    expect(div.querySelector('[data-panel="moral"]')).toBeTruthy()
    expect(div.querySelectorAll('.sa-scale-btn').length).toBe(5)
    await React.act(async () => {
      const four = Array.from(div.querySelectorAll('.sa-scale-btn')).find((b) => b.textContent?.trim() === '4') as HTMLButtonElement
      four.click()
    })
    await React.act(async () => {
      await sleep(50)
    })
    expect(div.querySelector('[data-panel="moral"]')).toBeNull()
    expect(div.textContent).toContain('Moral 4/5')
    expect(div.querySelectorAll('.sa-day-row').length).toBe(1)
    const { loadEvents } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    expect(evs.some((e) => e.type === 'moral' && e.value === 4)).toBe(true)
    root.unmount()
    div.remove()
  })

  it('crise : « + crise » → intensité 8 + localisation persistées (événement horodaté)', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-quick="crise"]').click()
    })
    const eight = Array.from(div.querySelectorAll('.sa-scale-btn')).find(
      (b) => b.textContent?.trim() === '8'
    ) as HTMLButtonElement
    await React.act(async () => {
      eight.click()
    })
    const loc = div.querySelector('[data-panel="crise"] input[type="text"]') as HTMLInputElement
    await React.act(async () => {
      setInput(loc, 'tête')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer la crise').click()
    })
    await React.act(async () => {
      await sleep(50)
    })
    expect(div.textContent).toContain('Crise 8/10 — tête')
    const { loadEvents } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    const crise = evs.find((e) => e.type === 'crise')
    expect(crise?.value).toBe(8)
    expect(crise?.label).toBe('tête')
    expect(/^\d{4}-\d{2}-\d{2}T/.test(crise!.date)).toBe(true)
    root.unmount()
    div.remove()
  })

  it('poids, sommeil, note, habitude, symptôme : formulaires enregistrés et persistés', async () => {
    const { React, root, div } = await renderApp()
    // poids
    await React.act(async () => {
      btn(div, '[data-quick="poids"]').click()
    })
    await React.act(async () => {
      setInput(div.querySelector('.sa-poids-input') as HTMLInputElement, '72.5')
    })
    await React.act(async () => {
      btnByText(div, 'Noter').click()
    })
    // sommeil
    await React.act(async () => {
      btn(div, '[data-quick="sommeil"]').click()
    })
    const times = div.querySelectorAll('[data-panel="sommeil"] input[type="time"]')
    await React.act(async () => {
      setInput(times[0] as HTMLInputElement, '23:10')
      setInput(times[1] as HTMLInputElement, '07:20')
    })
    await React.act(async () => {
      const q = Array.from(div.querySelectorAll('.sa-scale-btn')).find((b) => b.textContent?.trim() === '4') as HTMLButtonElement
      q.click()
    })
    // note
    await React.act(async () => {
      btn(div, '[data-quick="note"]').click()
    })
    await React.act(async () => {
      setInput(div.querySelector('.sa-note-input') as HTMLTextAreaElement, 'Journée calme à la maison')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer').click()
    })
    // habitude
    await React.act(async () => {
      btn(div, '[data-quick="habitude"]').click()
    })
    await React.act(async () => {
      setInput(div.querySelector('[data-panel="habitude"] input[type="text"]') as HTMLInputElement, 'Sport')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer').click()
    })
    // symptôme
    await React.act(async () => {
      btn(div, '[data-quick="symptome"]').click()
    })
    await React.act(async () => {
      setInput(div.querySelector('[data-panel="symptome"] input[type="text"]') as HTMLInputElement, 'fatigue')
    })
    await React.act(async () => {
      const i = Array.from(div.querySelectorAll('.sa-scale-btn')).find((b) => b.textContent?.trim() === '6') as HTMLButtonElement
      i.click()
    })
    await React.act(async () => {
      setInput(div.querySelector('[data-panel="symptome"] input[type="number"]') as HTMLInputElement, '120')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    expect(div.textContent).toContain('Poids 72.5 kg')
    expect(div.textContent).toContain('Sommeil 23:10 → 07:20, qualité 4/5')
    expect(div.textContent).toContain('Note : Journée calme à la maison')
    expect(div.textContent).toContain('Habitude : Sport')
    expect(div.textContent).toContain('Symptôme fatigue 6/10, 2 h')
    const { loadEvents } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    expect(evs.filter((e) => e.type === 'poids').length).toBe(1)
    expect(evs.filter((e) => e.type === 'sommeil').length).toBe(1)
    expect(evs.filter((e) => e.type === 'note').length).toBe(1)
    expect(evs.filter((e) => e.type === 'habitude').length).toBe(1)
    expect(evs.filter((e) => e.type === 'symptome').length).toBe(1)
    expect(div.querySelectorAll('.sa-day-row').length).toBe(7)
    root.unmount()
    div.remove()
  })

  it('suivi désactivé : le bouton disparaît de l’accueil mais les événements sont conservés', async () => {
    const { SUIVI_IDS } = await import('../src/apps/salveto/logic')
    await seedOnboarded(SUIVI_IDS.filter((id) => id !== 'note'))
    const { root, div } = await renderApp()
    expect(div.querySelector('[data-quick="note"]')).toBeNull()
    expect(div.querySelectorAll('.sa-quick-btn').length).toBe(7)
    expect(div.textContent).toContain('Note : Journée calme à la maison')
    const { loadEvents } = await import('../src/apps/salveto/store')
    expect((await loadEvents()).some((e) => e.type === 'note')).toBe(true)
    root.unmount()
    div.remove()
  })
})
