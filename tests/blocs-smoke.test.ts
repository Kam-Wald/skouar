// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'

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

describe('Calepin (smoke jsdom)', () => {
  it('rend via AppShell', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const BlocsApp = (await import('../src/apps/blocs/BlocsApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(BlocsApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 1200))
    })
    const html = div.innerHTML
    for (const needle of ['blocs-app', 'blocs-sidebar', 'blocs-app-head', 'Calepin', 'sidebar-resizer', 'blocs-sidebar-foot', 'Réglages', 'blocs-main']) {
      expect(html).toContain(needle)
    }
    root.unmount()
  })
})
