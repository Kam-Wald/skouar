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
  return { React, root, div }
}

const setInput = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const setSelect = (el: HTMLSelectElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}
const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const byLabel = (div: HTMLElement, label: string) => div.querySelector(`[aria-label="${label}"]`) as HTMLElement

describe('Unvez — convertisseur (smoke jsdom, vrais clics)', () => {
  it('100 km → miles bidirectionnel + swap + formule affichée', async () => {
    const { React, root, div } = await renderApp()
    const src = byLabel(div, 'Valeur source') as HTMLInputElement
    const dst = byLabel(div, 'Valeur convertie') as HTMLInputElement
    const toSel = byLabel(div, 'Unité cible') as HTMLSelectElement
    await React.act(async () => {
      setSelect(toSel, 'mi')
    })
    await React.act(async () => {
      setInput(src, '100')
    })
    expect(dst.value).toContain('62,137')
    expect(div.querySelector('.conv-formula')?.textContent).toContain('0,621371')
    await React.act(async () => {
      setInput(dst, '62,1371')
    })
    expect(src.value).toContain('99,99')
    await React.act(async () => {
      byLabel(div, 'Échanger source et cible').click()
    })
    expect((byLabel(div, 'Unité source') as HTMLSelectElement).value).toBe('mi')
    expect((byLabel(div, 'Unité cible') as HTMLSelectElement).value).toBe('km')
    root.unmount()
    div.remove()
  })

  it('panneau « toutes les unités » + recherche « livre » + persistance de la paire au remontage', async () => {
    const { React, root, div } = await renderApp()
    const src = byLabel(div, 'Valeur source') as HTMLInputElement
    await React.act(async () => {
      setInput(src, '1000')
    })
    await React.act(async () => {
      btnByText(div, 'Toutes les unités').click()
    })
    const rows = div.querySelectorAll('.conv-unit-row').length
    expect(rows).toBeGreaterThanOrEqual(10)
    expect(div.querySelector('.conv-all')?.textContent).toContain('mile')
    const search = byLabel(div, 'Rechercher une unité') as HTMLInputElement
    await React.act(async () => {
      setInput(search, 'livre')
    })
    const res = btnByText(div, 'livre')
    expect(res).toBeTruthy()
    await React.act(async () => {
      res.click()
    })
    expect((byLabel(div, 'Famille d\'unités') as HTMLSelectElement).value).toBe('poids')
    expect((byLabel(div, 'Unité source') as HTMLSelectElement).value).toBe('lb')
    root.unmount()
    div.remove()

    const again = await renderApp()
    expect((byLabel(again.div, 'Famille d\'unités') as HTMLSelectElement).value).toBe('poids')
    expect((byLabel(again.div, 'Unité source') as HTMLSelectElement).value).toBe('lb')
    expect(again.div.querySelector('.conv-recents')?.textContent).toContain('lb')
    again.root.unmount()
    again.div.remove()
  })

  it('durées : saisir « 1 h 30 » affiche 5400 s / 90 min dans le panneau', async () => {
    const { React, root, div } = await renderApp()
    const famSel = byLabel(div, 'Famille d\'unités') as HTMLSelectElement
    await React.act(async () => {
      setSelect(famSel, 'duree')
    })
    const src = byLabel(div, 'Valeur source') as HTMLInputElement
    const toSel = byLabel(div, 'Unité cible') as HTMLSelectElement
    await React.act(async () => {
      setInput(src, '1 h 30')
    })
    await React.act(async () => {
      setSelect(toSel, 's')
    })
    await React.act(async () => {
      setInput(src, '1 h 30')
    })
    expect((byLabel(div, 'Valeur convertie') as HTMLInputElement).value).toContain('5 400')
    await React.act(async () => {
      btnByText(div, 'Toutes les unités').click()
    })
    const all = div.querySelector('.conv-all')?.textContent ?? ''
    expect(all).toContain('90')
    root.unmount()
    div.remove()
  })
})
