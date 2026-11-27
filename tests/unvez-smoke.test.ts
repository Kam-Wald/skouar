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

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const UnvezApp = (await import('../src/apps/unvez/UnvezApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(UnvezApp)))
  })
  return { React, root, div }
}

function press(div: HTMLElement, label: string): void {
  const b = Array.from(div.querySelectorAll('button')).find((x) => x.textContent?.trim() === label)
  expect(b, `bouton ${label}`).toBeTruthy()
  b!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('Unvez (smoke jsdom)', () => {
  it('calculatrice : 7 + 8 = 15 au clic', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      press(div, '7')
      press(div, '+')
      press(div, '8')
      press(div, '=')
    })
    expect(div.querySelector('[data-testid="unvez-display"]')?.textContent).toBe('15')
    root.unmount()
    div.remove()
  })

  it('convertisseur : 100 m → ft', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      press(div, '📏 Convertisseur')
    })
    const input = div.querySelector('.unvez-input') as HTMLInputElement
    expect(input).toBeTruthy()
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await React.act(async () => {
      setVal.call(input, '100')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const out = div.querySelector('[data-testid="unvez-out"]')?.textContent ?? ''
    expect(out).toContain('328.084')
    root.unmount()
    div.remove()
  })
})
