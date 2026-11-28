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

const flush = async (React: typeof import('react'), ms = 50) =>
  React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

async function seed() {
  const { seedDefaultCategories, listCategories } = await import('../src/apps/fichorama/store')
  const { makeSheet, saveSheet } = await import('../src/apps/fichorama/sheets')
  await seedDefaultCategories()
  const cats = await listCategories()
  const films = cats.find((c) => c.name === 'Films')!
  await saveSheet({ ...makeSheet(films.id, 'Dune', 9, {}, 'chef-d’œuvre de SF', true, null), createdAt: 1000 })
  await saveSheet({ ...makeSheet(films.id, 'Arrival', 7, {}, 'langage et temps', false, null), createdAt: 3000 })
  await saveSheet({ ...makeSheet(films.id, 'Blade Runner', 5, {}, 'visuel', false, null), createdAt: 2000 })
}

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const FichoramaApp = (await import('../src/apps/fichorama/FichoramaApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/fichorama'] }, React.createElement(FichoramaApp)))
  })
  await flush(React, 60)
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const btnByLabel = (l: string) => div.querySelector(`[aria-label="${l}"]`) as HTMLElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const setSelect = (el: HTMLSelectElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const titles = () => Array.from(div.querySelectorAll('.fi-sheet-card .fi-sheet-title')).map((t) => t.textContent)
  return { React, root, div, sideBtn, btnByLabel, setInput, setSelect, titles }
}

describe('Fichorama — consultation/tri/filtres/stats (smoke jsdom, vrais clics)', () => {
  it('accueil : stats + recherche globale ; toutes les fiches : tri, favoris, plage de notes, recherche ; catégorie : idem', async () => {
    await seed()
    const { React, root, div, sideBtn, btnByLabel, setInput, setSelect, titles } = await renderApp()

    expect(div.querySelector('.fi-stats')?.textContent).toContain('3 fiches')
    expect(div.querySelector('.fi-stats')?.textContent).toContain('7,0/10')
    expect(div.querySelectorAll('.fi-cat-card').length).toBe(9)
    expect(btnByLabel('Recherche globale')).toBeTruthy()

    await React.act(async () => {
      setInput(btnByLabel('Recherche globale') as HTMLInputElement, 'dune')
    })
    await flush(React, 30)
    expect(div.querySelector('h2')?.textContent).toContain('Résultats pour')
    expect(titles()).toEqual(['Dune'])
    await React.act(async () => {
      setInput(btnByLabel('Recherche globale') as HTMLInputElement, '')
    })
    await flush(React, 30)
    expect(div.querySelectorAll('.fi-cat-card').length).toBe(9)

    await React.act(async () => {
      sideBtn('Toutes les fiches').click()
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Dune', 'Arrival', 'Blade Runner'])
    expect(div.querySelector('.fi-stats')?.textContent).toContain('3 fiches')

    await React.act(async () => {
      setSelect(btnByLabel('Trier par') as HTMLSelectElement, 'date')
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Arrival', 'Blade Runner', 'Dune'])

    await React.act(async () => {
      setSelect(btnByLabel('Trier par') as HTMLSelectElement, 'titre')
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Arrival', 'Blade Runner', 'Dune'])

    await React.act(async () => {
      setSelect(btnByLabel('Trier par') as HTMLSelectElement, 'note')
      ;(btnByLabel('Favoris uniquement') as HTMLInputElement).click()
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Dune'])
    expect(div.querySelector('.fi-stats')?.textContent).toContain('1 fiche sur 3')
    await React.act(async () => {
      ;(btnByLabel('Favoris uniquement') as HTMLInputElement).click()
    })
    await flush(React, 30)
    expect(titles().length).toBe(3)

    await React.act(async () => {
      setInput(btnByLabel('Note minimale') as HTMLInputElement, '8')
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Dune'])
    await React.act(async () => {
      setInput(btnByLabel('Note minimale') as HTMLInputElement, '')
      setInput(btnByLabel('Note maximale') as HTMLInputElement, '6')
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Blade Runner'])
    await React.act(async () => {
      setInput(btnByLabel('Note maximale') as HTMLInputElement, '')
      setInput(btnByLabel('Rechercher dans les fiches') as HTMLInputElement, 'visuel')
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Blade Runner'])
    await React.act(async () => {
      setInput(btnByLabel('Rechercher dans les fiches') as HTMLInputElement, 'zzz')
    })
    await flush(React, 30)
    expect(titles()).toEqual([])
    expect(div.querySelector('.fi-empty')?.textContent).toContain('Aucune fiche ne correspond')
    await React.act(async () => {
      setInput(btnByLabel('Rechercher dans les fiches') as HTMLInputElement, '')
    })
    await flush(React, 30)
    expect(titles().length).toBe(3)

    await React.act(async () => {
      sideBtn('Films').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.fi-toolbar')).toBeTruthy()
    expect(Array.from(div.querySelectorAll('button')).some((b) => b.textContent?.trim() === '+ Nouvelle fiche')).toBe(true)
    expect(titles().length).toBe(3)
    await React.act(async () => {
      setInput(btnByLabel('Rechercher dans les fiches') as HTMLInputElement, 'arrival')
    })
    await flush(React, 30)
    expect(titles()).toEqual(['Arrival'])

    root.unmount()
    div.remove()
  })
})
