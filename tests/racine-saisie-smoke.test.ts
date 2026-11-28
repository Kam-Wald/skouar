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
  const setArea = (el: HTMLTextAreaElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { React, root, div, btnByLabel, btnByText, setInput, setArea }
}

describe('Racine — onboarding + saisie rapide + accueil (smoke jsdom, vrais clics)', () => {
  it('onboarding choix des suivis, boutons filtrés, saisies moral/poids/crise/note du jour, persistance au rechargement', async () => {
    const { React, root, div, btnByLabel, btnByText, setInput, setArea } = await renderApp()

    expect(div.querySelector('.ra-onboard')).toBeTruthy()
    for (const l of ['Suivi Moral', 'Suivi Énergie', 'Suivi Poids', 'Suivi Crise / douleur', 'Suivi Sommeil', 'Suivi Symptôme', 'Suivi Habitude', 'Suivi Note libre', 'Suivi Cycle']) {
      expect(btnByLabel(l)).toBeTruthy()
    }
    await React.act(async () => {
      ;(btnByLabel('Suivi Sommeil') as HTMLInputElement).click()
      ;(btnByLabel('Suivi Habitude') as HTMLInputElement).click()
    })
    await React.act(async () => {
      btnByText('Commencer').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-onboard')).toBeNull()
    const stored = JSON.parse(localStorage.getItem('skouar:settings') ?? '{}')
    expect(stored.apps?.racine?.onboarded).toBe(true)
    expect(stored.apps?.racine?.trackers?.sommeil).toBe(false)
    expect(stored.apps?.racine?.trackers?.habitude).toBe(false)
    expect(stored.apps?.racine?.trackers?.moral).toBe(true)

    expect(btnByText('+ Moral')).toBeTruthy()
    expect(btnByText('+ Poids')).toBeTruthy()
    expect(btnByText('+ Crise')).toBeTruthy()
    expect(btnByText('+ Sommeil')).toBeFalsy()
    expect(btnByText('+ Habitude')).toBeFalsy()

    await React.act(async () => {
      btnByText('+ Moral').click()
    })
    await flush(React, 30)
    expect(div.querySelector('[aria-label="Saisie Moral"]')).toBeTruthy()
    await React.act(async () => {
      btnByLabel('Moral niveau 4').click()
    })
    await flush(React)
    expect(div.querySelector('.toast')?.textContent).toContain('Moral enregistré')
    expect(div.querySelector('.ra-today')?.textContent).toContain('Moral 4/5')

    await React.act(async () => {
      btnByText('+ Poids').click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Poids (kg)') as HTMLInputElement, '72.5')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer le poids').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-today')?.textContent).toContain('Poids 72,5 kg')

    await React.act(async () => {
      btnByText('+ Crise').click()
    })
    await flush(React)
    expect(div.querySelector('.toast')?.textContent).toContain('Crise horodatée')
    expect(div.querySelector('.ra-today')?.textContent).toContain('Crise (intensité à définir)')
    await React.act(async () => {
      btnByLabel('Intensité 7').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-today')?.textContent).toContain('Crise — intensité 7/10')

    await React.act(async () => {
      btnByText('+ Note').click()
    })
    await React.act(async () => {
      setArea(div.querySelector('[aria-label="Note du jour"]') as HTMLTextAreaElement, 'Belle journée en famille')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer la note').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-today')?.textContent).toContain('Note libre')
    expect(div.querySelector('.ra-today')?.textContent).toContain('Belle journée en famille')
    expect(div.querySelectorAll('.ra-today li').length).toBe(4)

    root.unmount()
    div.remove()

    const again = await renderApp()
    expect(again.div.querySelector('.ra-onboard')).toBeNull()
    expect(again.div.querySelector('.ra-today')?.textContent).toContain('Moral 4/5')
    expect(again.div.querySelectorAll('.ra-today li').length).toBe(4)
    expect(again.btnByText('+ Sommeil')).toBeFalsy()
    again.root.unmount()
    again.div.remove()
  })
})
