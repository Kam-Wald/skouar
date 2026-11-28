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

describe('Taol (smoke jsdom)', () => {
  it('rend la grille, la barre de formule et le seed calcule MOYENNE', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const TaolApp = (await import('../src/apps/taol/TaolApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(TaolApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(div.querySelector('.taol-table')).toBeTruthy()
    expect(div.querySelector('.taol-formula')).toBeTruthy()
    expect(div.textContent).toContain('Feuil 1')
    const cells = Array.from(div.querySelectorAll('.taol-cell')).map((c) => c.textContent)
    expect(cells).toContain('13.5')
    root.unmount()
    div.remove()
  })

  it('saisie d’une formule via la barre : =SOMME(B2:B3)', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const TaolApp = (await import('../src/apps/taol/TaolApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(TaolApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const formula = div.querySelector('.taol-formula') as HTMLInputElement
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await React.act(async () => {
      setVal.call(formula, '=SOMME(B2:B3)+1')
      formula.dispatchEvent(new Event('input', { bubbles: true }))
      formula.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    const cells = Array.from(div.querySelectorAll('.taol-cell')).map((c) => c.textContent)
    expect(cells).toContain('28')
    root.unmount()
    div.remove()
  })
})

describe('ChartView (smoke jsdom)', () => {
  it('rend courbe, barres et camembert en SVG', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const ChartView = (await import('../src/apps/taol/ChartView')).default
    const data = { labels: ['Ana', 'Tom', 'Léa'], series: [{ name: 'Note', values: [15, 12, 17] }] }
    for (const type of ['line', 'bar', 'pie'] as const) {
      const div = document.createElement('div')
      document.body.appendChild(div)
      const root = createRoot(div)
      await React.act(async () => {
        root.render(React.createElement(ChartView, { data, type, title: 'Notes', w: 380, h: 250 }))
      })
      expect(div.querySelector('svg')).toBeTruthy()
      expect(div.textContent).toContain('Note')
      root.unmount()
      div.remove()
    }
  })
})
