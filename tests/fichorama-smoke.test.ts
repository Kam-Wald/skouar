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

describe('Fichorama — mise en place (smoke jsdom)', () => {
  it('la tuile fichorama du launcher est cliquable vers /app/fichorama (ni wip ni soon)', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const LauncherHome = (await import('../src/launcher/LauncherHome')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(LauncherHome)))
    })
    const tile = div.querySelector('.app-tile[data-app-id="fichorama"]') as HTMLAnchorElement
    expect(tile.getAttribute('href')).toBe('/app/fichorama')
    expect(tile.classList.contains('wip')).toBe(false)
    expect(tile.classList.contains('soon')).toBe(false)
    root.unmount()
    div.remove()
  })

  it('l’app rend l’accueil : sidebar (Toutes les fiches + catégories seedées) + cartes catégories avec stats', async () => {
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
    const text = div.textContent ?? ''
    for (const needle of ['Fichorama', 'Toutes les fiches', 'Films', 'Livres', 'Recettes', 'Restaurants']) {
      expect(text).toContain(needle)
    }
    expect(div.querySelector('[aria-label="Nouvelle catégorie"]')).toBeTruthy()
    expect(div.querySelectorAll('.fi-cat-card').length).toBe(9)
    expect(div.querySelector('.fi-stats')?.textContent).toContain('0 fiche')
    const filmsBtn = Array.from(div.querySelectorAll('.fi-side-btn')).find((b) => b.textContent?.trim() === 'Films') as HTMLButtonElement
    await React.act(async () => {
      filmsBtn.click()
    })
    expect(div.querySelector('.fi-view h2')?.textContent).toBe('Films')
    root.unmount()
    div.remove()
  })
})
