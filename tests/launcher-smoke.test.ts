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
    for (const needle of ['launcher', 'Skouar', 'app-tile', 'Karneto', 'Skrid', 'Ler', 'Kod', 'Cockpit', 'Skeud', 'Bientôt', 'launcher-search', 'Réglages']) {
      expect(html).toContain(needle)
    }
    const tiles = div.querySelectorAll('.app-tile').length
    expect(tiles).toBeGreaterThanOrEqual(4)
    const soon = div.querySelectorAll('.app-tile.soon').length
    expect(soon).toBeGreaterThanOrEqual(4)
    const text = div.textContent ?? ''
    for (const tag of ['notes & bdd', 'écriture', 'pdf', 'photos', 'éditeur de code', 'productivité & focus', 'tableur', 'dessin & vectoriel', 'fichiers & zip', 'audio', 'budget', 'unités & calcul']) {
      expect(text).toContain(tag)
    }
    expect(div.querySelectorAll('.app-tile-tag').length).toBe(12)
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
    expect(div.querySelectorAll('.app-tile').length).toBe(12)
    await React.act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.activeElement).not.toBe(search)
    root.unmount()
    div.remove()
  })
})
