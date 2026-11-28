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
const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const setInput = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Salveto S4 — traitements/efficacité + constantes (smoke jsdom)', () => {
  it('créer un traitement « Doliprane », noter un effet « marqué » : ref + événement persistés (par id)', async () => {
    await seedOnboarded()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-quick="traitement"]').click()
    })
    const nameInput = div.querySelector('[data-panel="traitement"] input[type="text"]') as HTMLInputElement
    await React.act(async () => {
      setInput(nameInput, 'Doliprane')
    })
    await React.act(async () => {
      btnByText(div, 'Créer').click()
    })
    expect(div.querySelector('[data-panel="traitement"] select')).toBeTruthy()
    await React.act(async () => {
      await sleep(450)
    })
    await React.act(async () => {
      btn(div, '[data-effet="marqué"]').click()
    })
    await React.act(async () => {
      await sleep(150)
    })
    const { loadEvents, loadRefs } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    const t = evs.find((e) => e.type === 'traitement')
    expect(t?.label).toBe('Doliprane')
    expect(t?.effet).toBe('marqué')
    expect(t?.refId).toBeTruthy()
    const refs = await loadRefs()
    expect(refs.items.some((r) => r.kind === 'traitement' && r.label === 'Doliprane')).toBe(true)
    root.unmount()
    div.remove()
  })

  it('deuxième prise « léger » sur Doliprane + création « Sport » effet « marqué » → vue Traitements triée', async () => {
    const { React, root, div } = await renderApp()
    // prise 2 sur Doliprane (sélection par défaut = premier traitement)
    await React.act(async () => {
      btn(div, '[data-quick="traitement"]').click()
    })
    await React.act(async () => {
      btn(div, '[data-effet="léger"]').click()
    })
    await React.act(async () => {
      await sleep(150)
    })
    // nouveau traitement Sport
    await React.act(async () => {
      btn(div, '[data-quick="traitement"]').click()
    })
    await React.act(async () => {
      btnByText(div, 'nouveau traitement').click()
    })
    const nameInput = div.querySelector('[data-panel="traitement"] input[type="text"]') as HTMLInputElement
    await React.act(async () => {
      setInput(nameInput, 'Sport')
    })
    await React.act(async () => {
      btnByText(div, 'Créer').click()
    })
    await React.act(async () => {
      await sleep(450)
    })
    await React.act(async () => {
      btn(div, '[data-effet="marqué"]').click()
    })
    await React.act(async () => {
      await sleep(150)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    expect((await loadEvents()).filter((e) => e.type === 'traitement').length).toBe(3)
    // vue Traitements
    await React.act(async () => {
      btn(div, '[data-nav="traitements"]').click()
    })
    expect(div.textContent).toContain('Ce qui me fait du bien')
    expect(div.textContent).toContain('aucune recommandation')
    const rows = Array.from(div.querySelectorAll('.sa-bien-row'))
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain('Doliprane')
    expect(rows[0].textContent).toContain('+5')
    expect(rows[0].textContent).toContain('marqué × 1')
    expect(rows[0].textContent).toContain('léger × 1')
    expect(rows[1].textContent).toContain('Sport')
    expect(div.textContent).toContain('Traitements suivis (2)')
    root.unmount()
    div.remove()
  })

  it('constante « Tension » (mmHg, seuil 140) + valeur 128 persistées et affichées avec dernière valeur', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-quick="constante"]').click()
    })
    const inputs = div.querySelectorAll('[data-panel="constante"] input')
    await React.act(async () => {
      setInput(inputs[0] as HTMLInputElement, 'Tension')
      setInput(inputs[1] as HTMLInputElement, 'mmHg')
      setInput(inputs[2] as HTMLInputElement, '140')
    })
    await React.act(async () => {
      btnByText(div, 'Créer').click()
    })
    await React.act(async () => {
      await sleep(450)
    })
    const valInput = div.querySelector('[data-panel="constante"] input[type="number"]') as HTMLInputElement
    await React.act(async () => {
      setInput(valInput, '128')
    })
    await React.act(async () => {
      btnByText(div, 'Noter').click()
    })
    await React.act(async () => {
      await sleep(150)
    })
    const { loadEvents, loadRefs } = await import('../src/apps/salveto/store')
    const c = (await loadEvents()).find((e) => e.type === 'constante')
    expect(c?.value).toBe(128)
    expect(c?.label).toBe('Tension')
    const refs = await loadRefs()
    const ref = refs.items.find((r) => r.kind === 'constante')
    expect(ref?.unite).toBe('mmHg')
    expect(ref?.seuil).toBe(140)
    await React.act(async () => {
      btn(div, '[data-nav="traitements"]').click()
    })
    expect(div.textContent).toContain('Constantes définies (1)')
    expect(div.textContent).toContain('Tension (mmHg)')
    expect(div.textContent).toContain('dernière valeur 128 mmHg')
    root.unmount()
    div.remove()
  })
})
