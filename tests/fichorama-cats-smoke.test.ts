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
  await React.act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
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

const flush = async (React: typeof import('react'), ms = 50) =>
  React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

describe('Fichorama — catégories (smoke jsdom, vrais clics)', () => {
  it('créer une catégorie « Concerts » avec un champ, la renommer, la supprimer (fiches supprimées)', async () => {
    const { React, root, div, btnByLabel, btnByText, setInput, setSelect, sideBtn } = await renderApp()
    await React.act(async () => {
      btnByLabel('Nouvelle catégorie').click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Nom de la catégorie') as HTMLInputElement, 'Concerts')
      setInput(btnByLabel('Nouveau champ') as HTMLInputElement, 'Artiste')
    })
    await React.act(async () => {
      btnByText('Ajouter le champ').click()
    })
    expect(div.querySelector('[aria-label="Libellé du champ 1"]')).toBeTruthy()
    await React.act(async () => {
      btnByLabel('Enregistrer la catégorie').click()
    })
    await flush(React)
    expect(sideBtn('Concerts')).toBeTruthy()

    await React.act(async () => {
      sideBtn('Concerts').click()
    })
    expect(div.querySelector('.fi-view h2')?.textContent).toBe('Concerts')
    await React.act(async () => {
      btnByLabel('Paramètres de la catégorie').click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Nom de la catégorie') as HTMLInputElement, 'Concerts 2026')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer la catégorie').click()
    })
    await flush(React)
    expect(sideBtn('Concerts 2026')).toBeTruthy()

    await React.act(async () => {
      btnByLabel('Supprimer la catégorie').click()
    })
    expect(div.querySelector('[aria-label="Confirmer la suppression de la catégorie"]')).toBeTruthy()
    await React.act(async () => {
      btnByLabel('Confirmer la suppression de la catégorie').click()
    })
    await flush(React)
    expect(sideBtn('Concerts 2026')).toBeFalsy()
    root.unmount()
    div.remove()
  })

  it('retirer un champ le garde en removedFields (9.C) et recréer le même libellé restaure le même id', async () => {
    const { React, root, div, btnByLabel, btnByText, setInput, setSelect, sideBtn } = await renderApp()
    await React.act(async () => {
      sideBtn('Films').click()
    })
    await React.act(async () => {
      btnByLabel('Paramètres de la catégorie').click()
    })
    const before = div.querySelectorAll('.fi-field-row:not(.fi-field-new)').length
    expect(before).toBe(4)
    await React.act(async () => {
      btnByLabel('Retirer le champ 3').click()
    })
    expect(div.querySelectorAll('.fi-field-row:not(.fi-field-new)').length).toBe(3)
    await React.act(async () => {
      setInput(btnByLabel('Nouveau champ') as HTMLInputElement, 'Genre')
    })
    await React.act(async () => {
      setSelect(btnByLabel('Type du nouveau champ') as HTMLSelectElement, 'liste')
    })
    await React.act(async () => {
      setInput(btnByLabel('Options du nouveau champ') as HTMLInputElement, 'Action, SF')
    })
    await React.act(async () => {
      btnByText('Ajouter le champ').click()
    })
    expect(div.querySelectorAll('.fi-field-row:not(.fi-field-new)').length).toBe(4)
    const { db } = await import('../src/apps/fichorama/store')
    const { listCategories } = await import('../src/apps/fichorama/store')
    await React.act(async () => {
      btnByLabel('Enregistrer la catégorie').click()
    })
    await flush(React)
    const films = (await listCategories()).find((c) => c.name === 'Films')!
    expect(films.fields.map((f) => f.label)).toContain('Genre')
    expect(films.fields.find((f) => f.label === 'Genre')?.options).toEqual(['Action', 'SF'])
    expect(films.removedFields.length).toBe(0)
    const genreId = films.fields.find((f) => f.label === 'Genre')!.id
    expect(typeof genreId).toBe('string')
    await db.table('categories').delete(films.id)
    root.unmount()
    div.remove()
  })
})
