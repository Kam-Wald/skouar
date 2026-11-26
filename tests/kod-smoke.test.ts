// @vitest-environment jsdom
import 'fake-indexeddb/auto'
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

describe('KodApp (smoke jsdom)', () => {
  it('rend complètement sans erreur', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const KodApp = (await import('../src/apps/kod/KodApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(KodApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 900))
    })
    const html = div.innerHTML
    for (const needle of ['kod-app', 'bienvenue.md', 'kod-ghead', 'kod-tab-add', 'Modèles', 'Réglages', 'kod-ta', 'Ln 1, Col 1', 'kod-projbar', 'Git local', 'Extraits', 'Export ZIP']) {
      expect(html).toContain(needle)
    }
    root.unmount()
  })
})
