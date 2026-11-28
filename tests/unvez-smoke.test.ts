// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

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

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const UnvezApp = (await import('../src/apps/unvez/UnvezApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/unvez'] }, React.createElement(UnvezApp)))
  })
  return { React, root, div }
}

const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement

describe('Unvez — squelette (smoke jsdom)', () => {
  it('registry : la tuile unvez est câblée (composant présent, tag conservé)', async () => {
    const { apps } = await import('../src/apps/registry')
    const u = apps.find((a) => a.id === 'unvez')
    expect(u?.component).toBeTruthy()
    expect(u?.tag).toBe('unités & calcul')
    expect(u?.description).toContain('mémos enregistrés')
  })

  it('rend le shell AppShell : sidebar « Calculer » (Calculatrice/Conversion) + « Mémos enregistrés » (Sans dossier), navigation entre vues', async () => {
    const { React, root, div } = await renderApp()
    const text = div.textContent ?? ''
    for (const needle of ['Unvez', 'Calculer', 'Calculatrice', 'Conversion', 'Mémos enregistrés', 'Sans dossier']) {
      expect(text).toContain(needle)
    }
    expect(div.querySelector('.blocs-app')).toBeTruthy()
    expect(div.querySelector('.unvez-view')?.textContent).toContain('Conversion')
    await React.act(async () => {
      btnByText(div, 'Calculatrice').click()
    })
    expect(div.querySelector('.unvez-view')?.textContent).toContain('Calculatrice')
    await React.act(async () => {
      btnByText(div, 'Sans dossier').click()
    })
    expect(div.querySelector('.unvez-view')?.textContent).toContain('mémo')
    root.unmount()
    div.remove()
  })

  it('la tuile du launcher mène à /app/unvez (lien actif)', async () => {
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
    const tile = div.querySelector('.app-tile[data-app-id="unvez"]') as HTMLAnchorElement
    expect(tile).toBeTruthy()
    expect(tile.getAttribute('href')).toBe('/app/unvez')
    expect(tile.getAttribute('aria-disabled')).toBeNull()
    root.unmount()
    div.remove()
  })
})
