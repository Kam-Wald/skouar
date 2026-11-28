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
  return { React, root, div, sideBtn, btnByLabel, btnByText, setInput }
}

const flush = async (React: typeof import('react'), ms = 50) =>
  React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

describe('Fichorama — fiches CRUD + détail + re-notation (smoke jsdom, vrais clics)', () => {
  it('créer une fiche Films (titre, note, champ, image), la voir en grille, re-noter, modifier, supprimer', async () => {
    const { React, root, div, sideBtn, btnByLabel, btnByText, setInput } = await renderApp()
    await React.act(async () => {
      sideBtn('Films').click()
    })
    await React.act(async () => {
      btnByText('+ Nouvelle fiche').click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Titre') as HTMLInputElement, 'Dune')
      setInput(btnByLabel('Note sur 10') as HTMLInputElement, '9')
      setInput(btnByLabel('Champ Réalisateur') as HTMLInputElement, 'Villeneuve')
    })
    const fileInput = btnByLabel('Image de la fiche') as HTMLInputElement
    await React.act(async () => {
      const file = new File([new Uint8Array([137, 80, 78, 71])], 'dune.png', { type: 'image/png' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 30)
    await React.act(async () => {
      btnByLabel('Enregistrer la fiche').click()
    })
    await flush(React)
    expect(div.querySelector('.fi-sheet h2')?.textContent).toContain('Dune')
    expect(div.querySelector('.fi-fields')?.textContent).toContain('Villeneuve')
    await React.act(async () => {
      btnByText('← Retour').click()
    })
    await flush(React, 30)
    const card = div.querySelector('.fi-sheet-card')
    expect(card?.textContent).toContain('Dune')
    expect(card?.textContent).toContain('9/10')
    await React.act(async () => {
      ;(div.querySelector('.fi-sheet-card') as HTMLElement).click()
    })
    await flush(React, 30)
    expect(div.querySelector('.fi-sheet h2')?.textContent).toContain('Dune')

    await React.act(async () => {
      setInput(btnByLabel('Nouvelle note') as HTMLInputElement, '8')
    })
    await React.act(async () => {
      btnByText('Re-noter').click()
    })
    await flush(React)
    expect(div.querySelector('.fi-sheet-note-big')?.textContent).toBe('8/10')
    expect(div.querySelectorAll('.fi-notes-history li').length).toBe(2)

    await React.act(async () => {
      btnByText('Modifier').click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Titre') as HTMLInputElement, 'Dune 2')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer la fiche').click()
    })
    await flush(React)
    expect(div.querySelector('.fi-sheet h2')?.textContent).toContain('Dune 2')

    await React.act(async () => {
      btnByText('Supprimer').click()
    })
    await React.act(async () => {
      btnByText('Confirmer la suppression ?').click()
    })
    await flush(React)
    expect(div.querySelector('.fi-sheet')).toBeNull()
    expect(div.querySelectorAll('.fi-sheet-card').length).toBe(0)
    root.unmount()
    div.remove()
  })
})
