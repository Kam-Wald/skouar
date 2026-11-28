// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

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
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const btnByLabel = (l: string) => div.querySelector(`[aria-label="${l}"]`) as HTMLElement
  const btnByText = (t: string) => Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const setSelect = (el: HTMLSelectElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { React, root, div, sideBtn, btnByLabel, btnByText, setInput, setSelect }
}

describe('Racine — journal (filtres/recherche/édition/suppression) + calendrier + courbes (smoke jsdom)', () => {
  it('timeline filtrée + recherche, édition note, suppression 2 clics, calendrier jour crise, courbe poids + marqueur vertical', async () => {
    const { addEvent } = await import('../src/apps/racine/events')
    const now = Date.now()
    const DAY = 86400000
    await addEvent('moral', { level: 4 }, 'bonne journée', now)
    await addEvent('poids', { kg: 72.5 }, '', now)
    await addEvent('crise', { intensity: 7, zone: 'ventre', declencheurs: [] }, '', now - DAY)
    await addEvent('note', {}, 'Souvenir du jour', now)

    const { React, root, div, sideBtn, btnByLabel, btnByText, setInput, setSelect } = await renderApp()

    await React.act(async () => {
      sideBtn('Journal').click()
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.ra-journal-item').length).toBe(4)

    await React.act(async () => {
      btnByLabel('Filtrer Crise / douleur').click()
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.ra-journal-item').length).toBe(1)
    expect(div.querySelector('.ra-journal')?.textContent).toContain('Crise — intensité 7/10 — ventre')
    await React.act(async () => {
      btnByLabel('Filtrer Crise / douleur').click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Rechercher dans les notes') as HTMLInputElement, 'ventre')
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.ra-journal-item').length).toBe(1)
    await React.act(async () => {
      setInput(btnByLabel('Rechercher dans les notes') as HTMLInputElement, '')
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.ra-journal-item').length).toBe(4)

    await React.act(async () => {
      btnByLabel('Basculer calendrier').click()
    })
    await flush(React, 30)
    const criseDay = div.querySelector('.ra-cal-day.crise') as HTMLButtonElement
    expect(criseDay).toBeTruthy()
    await React.act(async () => {
      criseDay.click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-cal-day-events')?.textContent).toContain('Crise — intensité 7/10')
    await React.act(async () => {
      btnByLabel('Basculer calendrier').click()
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.ra-journal-item').length).toBe(4)

    await React.act(async () => {
      btnByLabel('Modifier l’entrée Poids 72,5 kg').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      setInput(btnByLabel('Modifier la note') as HTMLInputElement, 'après le repas')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer la modification').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-journal')?.textContent).toContain('après le repas')

    await React.act(async () => {
      btnByLabel('Supprimer l’entrée Crise — intensité 7/10 — ventre').click()
    })
    await React.act(async () => {
      btnByLabel('Supprimer l’entrée Crise — intensité 7/10 — ventre').click()
    })
    await flush(React)
    expect(div.querySelectorAll('.ra-journal-item').length).toBe(3)
    const { listEvents } = await import('../src/apps/racine/store')
    expect((await listEvents('crise')).length).toBe(0)

    await React.act(async () => {
      sideBtn('Courbes').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-chart polyline')).toBeTruthy()
    expect(div.querySelectorAll('.ra-point').length).toBe(1)
    await React.act(async () => {
      setSelect(btnByLabel('Période') as HTMLSelectElement, '1m')
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-chart polyline')).toBeTruthy()
    await React.act(async () => {
      btnByLabel('Ajouter un marqueur').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      setInput(btnByLabel('Libellé du marqueur') as HTMLInputElement, 'début traitement')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer le marqueur').click()
    })
    await flush(React)
    expect(div.querySelectorAll('.ra-marker').length).toBe(1)
    expect(div.querySelector('.ra-chart')?.textContent).toContain('début traitement')
    await React.act(async () => {
      setSelect(btnByLabel('Suivi à tracer') as HTMLSelectElement, 'moral')
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.ra-point').length).toBe(1)

    expect((await listEvents('marqueur')).length).toBe(1)

    root.unmount()
    div.remove()
  })
})
