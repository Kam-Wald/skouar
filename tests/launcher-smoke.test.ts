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
    root.unmount()
  })
})
