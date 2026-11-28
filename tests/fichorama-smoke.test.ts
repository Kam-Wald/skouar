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
