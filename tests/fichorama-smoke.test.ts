// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'

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

describe('Fichorama (smoke jsdom)', () => {
  it('rend le shell via AppShell', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const FichoramaApp = (await import('../src/apps/fichorama/FichoramaApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(FichoramaApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(div.textContent).toContain('Fichorama')
    expect(div.textContent).toContain('Films')
    expect(div.querySelectorAll('.fi-card').length).toBe(9)
    root.unmount()
    div.remove()
  })
})

describe('Fichorama (smoke jsdom) — création de fiche', () => {
  it('catégorie → nouvelle fiche → enregistrer → la fiche apparaît', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const FichoramaApp = (await import('../src/apps/fichorama/FichoramaApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(FichoramaApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await React.act(async () => {
      ;(div.querySelector('.fi-card') as HTMLButtonElement).click()
    })
    expect(div.textContent).toContain('Films')
    await React.act(async () => {
      const btns = Array.from(div.querySelectorAll('button'))
      ;(btns.find((b) => b.textContent?.includes('Nouvelle fiche')) as HTMLButtonElement).click()
    })
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    const titleInput = div.querySelector('.fi-form .fi-input') as HTMLInputElement
    await React.act(async () => {
      setVal.call(titleInput, 'Le Grand Bleu')
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await React.act(async () => {
      const btns = Array.from(div.querySelectorAll('.fi-modal-actions button'))
      ;(btns.find((b) => b.textContent?.includes('Enregistrer')) as HTMLButtonElement).click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(div.textContent).toContain('Le Grand Bleu')
    expect(div.querySelectorAll('.fi-row').length).toBe(1)
    root.unmount()
    div.remove()
  })
})

describe('Fichorama (smoke jsdom) — détail + re-notation', () => {
  it('fiche → détail (frise 1 note) → re-noter → frise 2 notes', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const FichoramaApp = (await import('../src/apps/fichorama/FichoramaApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(FichoramaApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await React.act(async () => {
      ;(div.querySelector('.fi-card') as HTMLButtonElement).click()
    })
    await React.act(async () => {
      const btns = Array.from(div.querySelectorAll('button'))
      ;(btns.find((b) => b.textContent?.includes('Nouvelle fiche')) as HTMLButtonElement).click()
    })
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    const titleInput = div.querySelector('.fi-form .fi-input') as HTMLInputElement
    await React.act(async () => {
      setVal.call(titleInput, 'Le Grand Bleu')
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await React.act(async () => {
      const btns = Array.from(div.querySelectorAll('.fi-modal-actions button'))
      ;(btns.find((b) => b.textContent?.includes('Enregistrer')) as HTMLButtonElement).click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    await React.act(async () => {
      ;(div.querySelector('.fi-row') as HTMLElement).click()
    })
    expect(div.textContent).toContain('Historique des notes (1)')
    await React.act(async () => {
      const btns = Array.from(div.querySelectorAll('.fi-detail-actions button'))
      ;(btns.find((b) => b.textContent?.includes('Re-noter')) as HTMLButtonElement).click()
    })
    await React.act(async () => {
      const btns = Array.from(div.querySelectorAll('.fi-modal-actions button'))
      ;(btns.find((b) => b.textContent?.includes('Enregistrer la note')) as HTMLButtonElement).click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(div.textContent).toContain('Historique des notes (2)')
    expect(div.querySelectorAll('.fi-frise-item').length).toBe(2)
    root.unmount()
    div.remove()
  })
})
