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

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const at = (days: number): Date => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

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

describe('Racine — constantes + cycle (smoke jsdom, vrais clics)', () => {
  it('saisie constante depuis l’accueil + saisie de 2 cycles → durées, moyennes, prévisions indicatives', async () => {
    const { saveRef, listEvents, listRefs } = await import('../src/apps/racine/store')
    const { uid } = await import('../src/shared/db')
    await saveRef({ id: uid(), kind: 'constante', name: 'Tension', unit: '', threshold: null, periodicityDays: null, lastDate: null, active: true, createdAt: Date.now() })
    const tensionRef = (await listRefs('constante'))[0]

    const { React, root, div, sideBtn, btnByLabel, btnByText, setInput, setSelect } = await renderApp()

    expect(btnByText('+ Constante')).toBeTruthy()
    expect(div.querySelector('.ra-constantes')?.textContent).toContain('Tension')
    expect(div.querySelector('.ra-constantes')?.textContent).toContain('aucune valeur')

    await React.act(async () => {
      btnByText('+ Constante').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      setSelect(btnByLabel('Constante concernée') as HTMLSelectElement, tensionRef.id)
    })
    await React.act(async () => {
      setInput(btnByLabel('Valeur de la constante') as HTMLInputElement, '12/8')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer la constante').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-constantes')?.textContent).toContain('Tension : 12/8')
    expect(div.querySelector('.ra-today')?.textContent).toContain('Tension : 12/8')

    await React.act(async () => {
      sideBtn('Cycle').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view h2')?.textContent).toContain('Cycle')

    await React.act(async () => {
      setInput(btnByLabel('Début des règles') as HTMLInputElement, iso(at(-30)))
      setInput(btnByLabel('Fin des règles') as HTMLInputElement, iso(at(-26)))
    })
    await React.act(async () => {
      setSelect(btnByLabel('Flux') as HTMLSelectElement, 'moyen')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer le cycle').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('règles 5 j')
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('flux moyen')

    await React.act(async () => {
      setInput(btnByLabel('Début des règles') as HTMLInputElement, iso(at(-2)))
      setInput(btnByLabel('Fin des règles') as HTMLInputElement, iso(at(2)))
    })
    await React.act(async () => {
      btnByLabel('Enregistrer le cycle').click()
    })
    await flush(React)
    const stats = div.querySelector('.ra-cycle-stats')?.textContent ?? ''
    expect(stats).toContain('2 cycles')
    expect(stats).toContain('règles moy. 5 j')
    expect(stats).toContain('cycle moy. 28 j')
    expect(stats).toContain('Prochaine période prévue')
    expect(stats).toContain('indicatif')
    expect(stats).toContain('Fenêtre ovulatoire indicative')
    expect(stats).toContain('Phase aujourd’hui')
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('cycle 28 j')

    const cycles = await listEvents('cycle')
    expect(cycles.length).toBe(2)
    expect(cycles.find((c) => c.payload.flux === 'moyen')).toBeTruthy()
    const consts = await listEvents('constante')
    expect(consts.length).toBe(1)
    expect(consts[0].payload.valeur).toBe('12/8')

    root.unmount()
    div.remove()
  })
})
