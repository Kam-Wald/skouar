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

async function seedOnboarded() {
  const { saveConfig } = await import('../src/apps/salveto/store')
  const { seedConfig } = await import('../src/apps/salveto/logic')
  saveConfig({ ...seedConfig(), onboarded: true })
  await sleep(600)
}

async function seedEvents() {
  const { saveEvent } = await import('../src/apps/salveto/store')
  const { addDays, makeEvent, todayDay } = await import('../src/apps/salveto/logic')
  const today = todayDay()
  await saveEvent(makeEvent('poids', { value: 72, date: `${addDays(today, -40)}T08:00:00` }))
  await saveEvent(makeEvent('poids', { value: 72.5, date: `${addDays(today, -10)}T08:00:00` }))
  await saveEvent(makeEvent('poids', { value: 71.8, date: `${addDays(today, -5)}T08:00:00` }))
  await saveEvent(makeEvent('poids', { value: 71.2 }))
  await saveEvent(makeEvent('moral', { value: 4 }))
  await saveEvent(makeEvent('moral', { value: 2, date: `${addDays(today, -3)}T09:00:00` }))
  await saveEvent(makeEvent('crise', { value: 8, label: 'tête' }))
  await saveEvent(makeEvent('marqueur', { label: 'début traitement', date: `${addDays(today, -10)}T12:00:00` }))
  await sleep(80)
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
const btnByText = (div: HTMLElement, text: string, scope?: HTMLElement) =>
  Array.from((scope ?? div).querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const setInput = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Salveto S9 — courbes + marqueurs (smoke jsdom)', () => {
  it('vue Courbes : onglets par suivi, période glissante 3 mois/1 an, valeurs au survol, marqueur en trait vertical', async () => {
    await seedOnboarded()
    await seedEvents()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="courbes"]').click()
    })
    for (const label of ['Poids', 'Moral', 'Crises (intensité)']) {
      expect(div.textContent).toContain(label)
    }
    // onglet Poids actif par défaut : 4 points en 3 mois (tous, dont -40 j)
    expect(div.querySelectorAll('.sa-courbe-pt').length).toBe(4)
    const title = div.querySelector('.sa-courbe-pt title')
    expect(title?.textContent).toContain('kg')
    // marqueur « début traitement » → 1 trait vertical étiqueté
    expect(div.querySelectorAll('.sa-mark').length).toBe(1)
    expect(div.textContent).toContain('début traitement')
    // période 1 mois → 3 points (le -40 j exclu)
    await React.act(async () => {
      btnByText(div, '1 mois').click()
    })
    expect(div.querySelectorAll('.sa-courbe-pt').length).toBe(3)
    // onglet Moral : échelle fixe 1-5
    await React.act(async () => {
      btn(div, '[data-tab="moral"]').click()
    })
    expect(div.querySelectorAll('.sa-courbe-pt').length).toBe(2)
    const ticks = Array.from(div.querySelectorAll('.sa-courbe-tick')).map((t) => t.textContent)
    expect(ticks).toContain('1')
    expect(ticks).toContain('5')
    root.unmount()
    div.remove()
  })

  it('marqueur épinglé depuis l’accueil (« + Marqueur ») → persisté et visible sur les courbes', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-quick="marqueur"]').click()
    })
    const txt = div.querySelector('[data-panel="marqueur"] input[type="text"]') as HTMLInputElement
    await React.act(async () => {
      setInput(txt, 'changement de vie')
    })
    await React.act(async () => {
      btnByText(div, 'Épingler le marqueur').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    expect((await loadEvents()).some((e) => e.type === 'marqueur' && e.label === 'changement de vie')).toBe(true)
    await React.act(async () => {
      btn(div, '[data-nav="courbes"]').click()
    })
    expect(div.querySelectorAll('.sa-mark').length).toBe(2)
    expect(div.textContent).toContain('changement de vie')
    root.unmount()
    div.remove()
  })
})
