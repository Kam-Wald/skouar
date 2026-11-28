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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function seedOnboarded() {
  const { saveConfig } = await import('../src/apps/salveto/store')
  const { seedConfig } = await import('../src/apps/salveto/logic')
  saveConfig({ ...seedConfig(), onboarded: true })
  await sleep(600)
}

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const SalvetoApp = (await import('../src/apps/salveto/SalvetoApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(SalvetoApp)))
  })
  await React.act(async () => {
    await sleep(50)
  })
  return { React, root, div }
}

const btn = (div: HTMLElement, sel: string) => div.querySelector(sel) as HTMLButtonElement
const btnByText = (div: HTMLElement, text: string, exact = false) =>
  Array.from(div.querySelectorAll('button')).find((b) =>
    exact ? b.textContent?.trim() === text : b.textContent?.includes(text)
  ) as HTMLButtonElement
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const setInput = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function saisirCrise(React: typeof import('react'), div: HTMLElement, intensite: string, declencheur?: string) {
  await React.act(async () => {
    btn(div, '[data-quick="crise"]').click()
  })
  if (declencheur) {
    const declInput = div.querySelector('[data-panel="crise"] input[list="sa-declencheurs"]') as HTMLInputElement
    await React.act(async () => {
      setInput(declInput, declencheur)
    })
    await React.act(async () => {
      btnByText(div, '+', true).click()
    })
  }
  await React.act(async () => {
    const n = Array.from(div.querySelectorAll('.sa-scale-btn')).find((b) => b.textContent?.trim() === intensite) as HTMLButtonElement
    n.click()
  })
  await React.act(async () => {
    btnByText(div, 'Enregistrer la crise').click()
  })
  await React.act(async () => {
    await sleep(60)
  })
}

describe('Salveto S3 — carte du corps, déclencheurs, co-occurrences (smoke jsdom)', () => {
  it('crise : clic sur les zones de la silhouette (face + dos) et ajout d’un déclencheur, tout est persisté', async () => {
    await seedOnboarded()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-quick="crise"]').click()
    })
    const tete = div.querySelector('[data-zone="tete"]')!
    await React.act(async () => {
      click(tete)
    })
    expect(tete.classList.contains('active')).toBe(true)
    await React.act(async () => {
      btnByText(div, 'Dos').click()
    })
    const dos = div.querySelector('[data-zone="dos"]')!
    await React.act(async () => {
      click(dos)
    })
    expect(dos.classList.contains('active')).toBe(true)
    await React.act(async () => {
      const declInput = div.querySelector('[data-panel="crise"] input[list="sa-declencheurs"]') as HTMLInputElement
      setInput(declInput, 'stress')
      btnByText(div, '+', true).click()
    })
    expect(div.textContent).toContain('stress ×')
    await React.act(async () => {
      const sept = Array.from(div.querySelectorAll('.sa-scale-btn')).find((b) => b.textContent?.trim() === '7') as HTMLButtonElement
      sept.click()
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer la crise').click()
    })
    await React.act(async () => {
      await sleep(60)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    const crise = evs.find((e) => e.type === 'crise')
    expect(crise?.value).toBe(7)
    expect(crise?.zones).toContain('tete')
    expect(crise?.zones).toContain('dos')
    expect(crise?.declencheurs).toContain('stress')
    root.unmount()
    div.remove()
  })

  it('co-occurrences affichées sur l’accueil avec l’avertissement « observation uniquement »', async () => {
    const { React, root, div } = await renderApp()
    await saisirCrise(React, div, '8', 'stress')
    expect(div.textContent).toContain('Co-occurrences observées avec les crises')
    expect(div.textContent).toContain('Observation statistique uniquement')
    expect(div.textContent).toContain('« stress »')
    expect(div.textContent).toContain('2 crises sur 2 (100 %)')
    root.unmount()
    div.remove()
  })

  it('multi-sélection : retirer une zone la désactive', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-quick="crise"]').click()
    })
    const ventre = div.querySelector('[data-zone="ventre"]')!
    await React.act(async () => {
      click(ventre)
    })
    expect(ventre.classList.contains('active')).toBe(true)
    await React.act(async () => {
      click(ventre)
    })
    expect(ventre.classList.contains('active')).toBe(false)
    expect(div.textContent).toContain('Clique sur les zones concernées')
    root.unmount()
    div.remove()
  })
})
