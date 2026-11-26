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

describe('Skeud (smoke jsdom)', () => {
  it('rend le shell + état vide bibliothèque', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const SkeudApp = (await import('../src/apps/skeud/SkeudApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(SkeudApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 1000))
    })
    const html = div.innerHTML
    for (const needle of ['blocs-app', 'Skeud', 'Importer des images', 'Ta bibliothèque', 'sk-lib', 'glisse', '100 % local']) {
      expect(html.toLowerCase()).toContain(needle.toLowerCase())
    }
    root.unmount()
  })

  it('le registry expose skeud actif', async () => {
    const { apps } = await import('../src/apps/registry')
    const sk = apps.find((a) => a.id === 'skeud')
    expect(sk).toBeTruthy()
    expect(sk?.soon).toBeFalsy()
    expect(sk?.component).toBeTruthy()
    expect(sk?.name).toBe('Skeud')
  })
})
