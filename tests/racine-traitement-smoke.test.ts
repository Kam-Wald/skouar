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

describe('Racine — traitements & « ce qui me fait du bien » (smoke jsdom, vrais clics)', () => {
  it('créer des traitements, noter des effets, classement trié, saisie rapide « + Efficacité » depuis l’accueil', async () => {
    const { React, root, div, sideBtn, btnByLabel, btnByText, setInput, setSelect } = await renderApp()

    await React.act(async () => {
      sideBtn('Traitements').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view h2')?.textContent).toContain('Traitements')

    await React.act(async () => {
      setInput(btnByLabel('Nouveau traitement') as HTMLInputElement, 'Magnésium')
    })
    await React.act(async () => {
      btnByLabel('Ajouter le traitement').click()
    })
    await flush(React)
    expect(btnByLabel('Effet Marqué pour Magnésium')).toBeTruthy()

    await React.act(async () => {
      btnByLabel('Effet Marqué pour Magnésium').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      btnByLabel('Effet Marqué pour Magnésium').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      btnByLabel('Effet Aucun pour Magnésium').click()
    })
    await flush(React, 30)

    await React.act(async () => {
      setInput(btnByLabel('Nouveau traitement') as HTMLInputElement, 'Tisane')
    })
    await React.act(async () => {
      btnByLabel('Ajouter le traitement').click()
    })
    await flush(React)
    await React.act(async () => {
      btnByLabel('Effet Négatif pour Tisane').click()
    })
    await flush(React)

    const ranking = div.querySelector('.ra-ranking')!
    const items = Array.from(ranking.querySelectorAll('li')).map((li) => li.textContent ?? '')
    expect(items[0]).toContain('Magnésium')
    expect(items[0]).toContain('+1,3')
    expect(items[0]).toContain('2 marqués, 1 aucun')
    expect(items[items.length - 1]).toContain('Tisane')
    expect(items[items.length - 1]).toContain('-1,0')
    expect(div.querySelector('.ra-view')?.textContent).toContain('aucun conseil')

    await React.act(async () => {
      btnByLabel('Supprimer le traitement Tisane').click()
    })
    await React.act(async () => {
      btnByLabel('Supprimer le traitement Tisane').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-ranking')?.textContent).toContain('Tisane')

    await React.act(async () => {
      sideBtn('Accueil').click()
    })
    await flush(React, 30)
    expect(btnByText('+ Efficacité')).toBeTruthy()
    await React.act(async () => {
      btnByText('+ Efficacité').click()
    })
    await flush(React, 30)
    const { listRefs, listEvents } = await import('../src/apps/racine/store')
    const refs = await listRefs('traitement')
    const mag = refs.find((r) => r.name === 'Magnésium')!
    await React.act(async () => {
      setSelect(btnByLabel('Traitement concerné') as HTMLSelectElement, mag.id)
    })
    await React.act(async () => {
      btnByLabel('Effet Léger').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-today')?.textContent).toContain('Effet « Magnésium » : Léger')

    const trEvents = await listEvents('traitement')
    expect(trEvents.length).toBe(5)
    expect(trEvents.filter((e) => e.payload.refId === mag.id).length).toBe(4)

    root.unmount()
    div.remove()
  })
})
