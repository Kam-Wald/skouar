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
  await React.act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const press = (t: string) =>
    Array.from(div.querySelectorAll('.calc-pad .calc-key, .calc-pad-sci .calc-key, .calc-pct .unvez-btn, .calc-mem .unvez-btn, .calc-tabs .unvez-btn')).find(
      (b) => b.textContent?.trim() === t
    ) as HTMLButtonElement
  await React.act(async () => {
    sideBtn('Calculatrice').click()
  })
  return { React, root, div, press }
}

const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
const out = (div: HTMLElement) => div.querySelector('.calc-out')?.textContent ?? ''

describe('Unvez — calculatrices (smoke jsdom, vrais clics + clavier)', () => {
  it('pavé : 2 + 3 = 5, tape alimentée, ligne de tape cliquable', async () => {
    const { React, root, div, press } = await renderApp()
    await React.act(async () => {
      press('2').click()
      press('+').click()
      press('3').click()
      press('=').click()
    })
    expect(out(div)).toBe('5')
    const tapeRows = div.querySelectorAll('.calc-tape-row')
    expect(tapeRows.length).toBe(1)
    expect(tapeRows[0].textContent).toContain('2+3')
    await React.act(async () => {
      press('×').click()
      press('4').click()
      press('=').click()
    })
    expect(out(div)).toBe('20')
    await React.act(async () => {
      div.querySelectorAll('.calc-tape-row')[1].click()
    })
    expect(out(div)).toBe('5')
    root.unmount()
    div.remove()
  })

  it('clavier physique : 4 * 2 Entrée = 8, retour arrière, Échap (C)', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      key('4')
      key('*')
      key('2')
      key('Enter')
    })
    expect(out(div)).toBe('8')
    await React.act(async () => {
      key('+')
      key('1')
      key('Backspace')
    })
    expect(out(div)).toBe('8+')
    await React.act(async () => {
      key('Backspace')
      key('Enter')
    })
    expect(out(div)).toBe('8')
    await React.act(async () => {
      key('Escape')
    })
    expect(out(div)).toBe('0')
    root.unmount()
    div.remove()
  })

  it('mémoire M+/MR/MC et variations en chaîne −20 % (100 → 80)', async () => {
    const { React, root, div, press } = await renderApp()
    await React.act(async () => {
      press('5').click()
      press('M+').click()
      press('C').click()
      press('MR').click()
      press('=').click()
    })
    expect(out(div)).toBe('5')
    await React.act(async () => {
      press('1').click()
      press('0').click()
      press('0').click()
      press('−20 %').click()
    })
    expect(out(div)).toBe('80')
    await React.act(async () => {
      press('−10 %').click()
    })
    expect(out(div)).toBe('72')
    root.unmount()
    div.remove()
  })

  it('scientifique : sin(90) = 1 en DEG, ≠ en RAD (10.J)', async () => {
    const { React, root, div, press } = await renderApp()
    await React.act(async () => {
      press('Scientifique').click()
    })
    await React.act(async () => {
      press('sin').click()
      press('9').click()
      press('0').click()
      press(')').click()
      press('=').click()
    })
    expect(out(div)).toBe('1')
    await React.act(async () => {
      press('RAD').click()
    })
    await React.act(async () => {
      press('C').click()
      press('sin').click()
      press('9').click()
      press('0').click()
      press(')').click()
      press('=').click()
    })
    expect(out(div)).toContain('0,893')
    root.unmount()
    div.remove()
  })

  it('persistance de la tape au remontage (4.I)', async () => {
    const first = await renderApp()
    await first.React.act(async () => {
      first.press('7').click()
      first.press('+').click()
      first.press('1').click()
      first.press('=').click()
    })
    expect(out(first.div)).toBe('8')
    first.root.unmount()
    first.div.remove()
    const second = await renderApp()
    expect(second.div.querySelector('.calc-tape')?.textContent).toContain('7+1')
    expect(second.div.querySelector('.calc-tape-row strong')?.textContent).toBe('8')
    second.root.unmount()
    second.div.remove()
  })
})
