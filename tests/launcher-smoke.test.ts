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

describe('Launcher (smoke jsdom)', () => {
  it('rend les tuiles actives + Bientôt + recherche', async () => {
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
    const html = div.innerHTML
    for (const needle of ['launcher', 'Skouar', 'app-tile', 'Karneto', 'Skrid', 'Ler', 'Kod', 'Cockpit', 'Skeud', 'Fichorama', 'Racine', 'Bientôt', 'launcher-search', 'Réglages']) {
      expect(html).toContain(needle)
    }
    const tiles = div.querySelectorAll('.app-tile').length
    expect(tiles).toBe(14)
    const soon = div.querySelectorAll('.app-tile.soon').length
    expect(soon).toBe(4)
    const wip = div.querySelectorAll('.app-tile.wip').length
    expect(wip).toBe(7)
    expect(div.textContent).toContain('En chantier')
    const unvezTile = div.querySelector('.app-tile[data-app-id="unvez"]') as HTMLElement
    expect(unvezTile.classList.contains('wip')).toBe(false)
    expect(unvezTile.classList.contains('soon')).toBe(false)
    expect(unvezTile.getAttribute('aria-disabled')).toBeNull()
    const fichoramaTile = div.querySelector('.app-tile[data-app-id="fichorama"]') as HTMLAnchorElement
    expect(fichoramaTile.classList.contains('wip')).toBe(false)
    expect(fichoramaTile.getAttribute('href')).toBe('/app/fichorama')
    const racineTile = div.querySelector('.app-tile[data-app-id="racine"]') as HTMLAnchorElement
    expect(racineTile.classList.contains('wip')).toBe(false)
    expect(racineTile.classList.contains('soon')).toBe(false)
    expect(racineTile.getAttribute('href')).toBe('/app/racine')
    const text = div.textContent ?? ''
    for (const tag of ['notes & bdd', 'écriture', 'pdf', 'photos', 'éditeur de code', 'productivité & focus', 'tableur', 'dessin & vectoriel', 'fichiers & zip', 'audio', 'budget', 'unités & calcul', 'fiches & notation', 'santé & humeur']) {
      expect(text).toContain(tag)
    }
    expect(div.querySelectorAll('.app-tile-tag').length).toBe(14)
    root.unmount()
  })

  it('raccourci « / » focusse la recherche, « Échap » la quitte', async () => {
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
    const search = div.querySelector('.launcher-search') as HTMLInputElement
    expect(search).toBeTruthy()
    await React.act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    })
    expect(document.activeElement).toBe(search)
    await React.act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.activeElement).not.toBe(search)
    root.unmount()
    div.remove()
  })

  it('recherche par tag + compteur + Échap efface puis quitte', async () => {
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
    const search = div.querySelector('.launcher-search') as HTMLInputElement
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await React.act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    })
    expect(document.activeElement).toBe(search)
    await React.act(async () => {
      setVal.call(search, 'photos')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(div.querySelectorAll('.app-tile').length).toBe(1)
    expect(div.textContent).toContain('Skeud')
    expect(div.querySelector('.launcher-count')?.textContent).toContain('1 app')
    await React.act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(search.value).toBe('')
    expect(document.activeElement).toBe(search)
    expect(div.querySelectorAll('.app-tile').length).toBe(14)
    await React.act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.activeElement).not.toBe(search)
    root.unmount()
    div.remove()
  })
})
