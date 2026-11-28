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
  const btnByLabel = (l: string) => div.querySelector(`[aria-label="${l}"]`) as HTMLElement
  const btnByText = (t: string) => Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { React, root, div, btnByLabel, btnByText, setInput }
}

describe('Racine — crise : carte du corps + déclencheurs + co-occurrences (smoke jsdom, vrais clics)', () => {
  it('+ Crise → zone « Ventre » sur la silhouette → intensité 8 → déclencheurs → co-occurrences avec avertissement', async () => {
    const { React, root, div, btnByLabel, btnByText, setInput } = await renderApp()

    await React.act(async () => {
      btnByText('+ Crise').click()
    })
    await flush(React)
    expect(div.querySelector('.toast')?.textContent).toContain('Crise horodatée')
    expect(div.querySelector('.ra-today')?.textContent).toContain('Crise (intensité à définir)')
    expect(div.querySelector('[aria-label="Carte du corps"]')).toBeTruthy()

    await React.act(async () => {
      btnByLabel('Zone du corps : Ventre').click()
    })
    await flush(React, 30)
    expect((btnByLabel('Zone du corps : Ventre') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')

    await React.act(async () => {
      btnByLabel('Intensité 8').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-today')?.textContent).toContain('Crise — intensité 8/10 — ventre')

    await React.act(async () => {
      setInput(btnByLabel('Nouveau déclencheur') as HTMLInputElement, 'stress')
    })
    await React.act(async () => {
      btnByLabel('Ajouter le déclencheur').click()
    })
    await flush(React)
    expect((btnByLabel('Déclencheur stress') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    expect(div.querySelector('.ra-cooc')?.textContent).toContain('stress (1/1)')
    expect(div.querySelector('.ra-cooc')?.textContent).toContain('aucune conclusion médicale')

    await React.act(async () => {
      setInput(btnByLabel('Nouveau déclencheur') as HTMLInputElement, 'aliment')
    })
    await React.act(async () => {
      btnByLabel('Ajouter le déclencheur').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-cooc')?.textContent).toContain('aliment (1/1)')

    await React.act(async () => {
      btnByLabel('Fermer la saisie').click()
    })
    await flush(React, 30)

    await React.act(async () => {
      btnByText('+ Crise').click()
    })
    await flush(React)
    await React.act(async () => {
      btnByLabel('Intensité 5').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      btnByLabel('Déclencheur stress').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-cooc')?.textContent).toContain('stress (2/2)')

    const { listEvents } = await import('../src/apps/racine/store')
    const crises = await listEvents('crise')
    expect(crises.length).toBe(2)
    const first = crises.find((c) => c.payload.intensity === 8)!
    expect(first.payload.zone).toBe('ventre')
    expect(first.payload.declencheurs).toEqual(['stress', 'aliment'])
    const second = crises.find((c) => c.payload.intensity === 5)!
    expect(second.payload.declencheurs).toEqual(['stress'])

    root.unmount()
    div.remove()
  })
})
