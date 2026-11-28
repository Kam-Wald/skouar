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
  return { React, root, div, sideBtn, btnByLabel, btnByText, setInput }
}

describe('Racine — RDV/ordonnances/préventif + bandeau passif (smoke jsdom, vrais clics)', () => {
  it('bandeau rappel moral → RDV dans 3 j + question + ordonnance à renouveler + examen échu → bandeau complet → moral saisi → rappel disparaît', async () => {
    const { React, root, div, sideBtn, btnByLabel, btnByText, setInput } = await renderApp()

    expect(div.querySelector('.ra-bandeau')?.textContent).toContain('moral du jour')

    await React.act(async () => {
      sideBtn('RDV & ordonnances').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      setInput(btnByLabel('Date du RDV') as HTMLInputElement, iso(at(3)))
      setInput(btnByLabel('Praticien') as HTMLInputElement, 'Dr House')
      setInput(btnByLabel('Motif') as HTMLInputElement, 'contrôle')
    })
    await React.act(async () => {
      btnByLabel('Ajouter le RDV').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('Dr House')
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('À venir')

    await React.act(async () => {
      setInput(btnByLabel('Nouvelle question à poser') as HTMLInputElement, 'Et si ça empire ?')
    })
    await React.act(async () => {
      btnByLabel('Ajouter la question').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view')?.textContent).toContain('Et si ça empire ?')

    await React.act(async () => {
      setInput(btnByLabel('Date de l’ordonnance') as HTMLInputElement, iso(at(0)))
      setInput(btnByLabel('Médecin') as HTMLInputElement, 'Dr House')
      setInput(btnByLabel('Contenu de l’ordonnance') as HTMLInputElement, 'Doliprane 500')
      setInput(btnByLabel('Date de fin (si connue)') as HTMLInputElement, iso(at(5)))
    })
    await React.act(async () => {
      ;(btnByLabel('À renouveler') as HTMLInputElement).click()
    })
    await React.act(async () => {
      btnByLabel('Ajouter l’ordonnance').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-view')?.textContent).toContain('À renouveler')

    await React.act(async () => {
      sideBtn('Préventif').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      setInput(btnByLabel('Nouvel examen préventif') as HTMLInputElement, 'Dentiste')
      setInput(btnByLabel('Périodicité (jours)') as HTMLInputElement, '180')
      setInput(btnByLabel('Date de dernière visite') as HTMLInputElement, iso(at(-200)))
    })
    await React.act(async () => {
      btnByLabel('Ajouter l’examen préventif').click()
    })
    await flush(React)
    expect(div.querySelector('.ra-view')?.textContent).toContain('Échu depuis le')

    await React.act(async () => {
      sideBtn('Accueil').click()
    })
    await flush(React, 30)
    const bandeau = div.querySelector('.ra-bandeau')?.textContent ?? ''
    expect(bandeau).toContain('RDV « Dr House » dans 3 jours')
    expect(bandeau).toContain('Ordonnance de Dr House se termine le')
    expect(bandeau).toContain('Dentiste')
    expect(bandeau).toContain('échu')
    expect(bandeau).toContain('moral du jour')

    await React.act(async () => {
      btnByText('+ Moral').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      btnByLabel('Moral niveau 4').click()
    })
    await flush(React)
    const bandeau2 = div.querySelector('.ra-bandeau')?.textContent ?? ''
    expect(bandeau2).not.toContain('moral du jour')
    expect(bandeau2).toContain('RDV « Dr House »')

    const { listEvents } = await import('../src/apps/racine/store')
    const { listQuestions } = await import('../src/apps/racine/agenda')
    expect((await listEvents('rdv')).length).toBe(1)
    expect((await listEvents('ordonnance')).length).toBe(1)
    expect(await listQuestions()).toEqual(['Et si ça empire ?'])

    root.unmount()
    div.remove()
  })
})
