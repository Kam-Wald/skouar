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
const setInput = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  const proto =
    el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function saisirCycle(React: typeof import('react'), div: HTMLElement, debut: string, fin: string, flux = '', notes = '') {
  await React.act(async () => {
    btn(div, '[data-quick="cycle"]').click()
  })
  const dates = div.querySelectorAll('[data-panel="cycle"] input[type="date"]')
  await React.act(async () => {
    setInput(dates[0] as HTMLInputElement, debut)
    setInput(dates[1] as HTMLInputElement, fin)
  })
  if (flux) {
    await React.act(async () => {
      setInput(div.querySelector('[data-panel="cycle"] input[list="sa-flux"]') as HTMLInputElement, flux)
    })
  }
  if (notes) {
    await React.act(async () => {
      setInput(div.querySelector('[data-panel="cycle"] textarea') as HTMLTextAreaElement, notes)
    })
  }
  await React.act(async () => {
    btnByText(div, 'Enregistrer la période').click()
  })
  await React.act(async () => {
    await sleep(80)
  })
}

describe('Salveto S5 — cycle menstruel (smoke jsdom)', () => {
  it('saisie d’une période (début/fin/flux/notes) persistée en événement cycle', async () => {
    await seedOnboarded()
    const { addDays, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const { React, root, div } = await renderApp()
    await saisirCycle(React, div, today, addDays(today, 2), 'abondant', 'RAS')
    const { loadEvents } = await import('../src/apps/salveto/store')
    const c = (await loadEvents()).find((e) => e.type === 'cycle')
    expect(c).toBeTruthy()
    expect(c!.label).toBe('règles')
    expect(c!.date.slice(0, 10)).toBe(today)
    expect(c!.fin!.slice(0, 10)).toBe(addDays(today, 2))
    expect(c!.flux).toBe('abondant')
    expect(c!.notes).toBe('RAS')
    expect(div.textContent).toContain('Règles')
    root.unmount()
    div.remove()
  })

  it('3 cycles saisis → vue Cycle : prévision (moyenne 28 j, prochaine période, fenêtre ovulatoire) + historique', async () => {
    const { addDays, fmtDay, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const { React, root, div } = await renderApp()
    await saisirCycle(React, div, addDays(today, -56), addDays(today, -52))
    await saisirCycle(React, div, addDays(today, -28), addDays(today, -24))
    await React.act(async () => {
      btn(div, '[data-nav="cycle"]').click()
    })
    expect(div.textContent).toContain('Cycle menstruel')
    expect(div.textContent).toContain('Prévision (indicative, calcul 100 % local)')
    expect(div.textContent).toContain(`Prochaine période estimée : ${fmtDay(addDays(today, 28))}`)
    expect(div.textContent).toContain('Fenêtre ovulatoire indicative')
    expect(div.textContent).toContain(`${fmtDay(addDays(today, 12))} → ${fmtDay(addDays(today, 16))}`)
    expect(div.textContent).toContain('moyenne de 2 cycles : 28 j')
    const txt = (div.textContent ?? '').replace(/\s+/g, ' ')
    expect(txt).toContain('cycle 28 j · règles 4.3 j · 3 périodes enregistrées')
    expect(div.querySelectorAll('.sa-cycle-row').length).toBe(3)
    expect(div.textContent).toContain('flux abondant')
    // persistance après « rechargement »
    root.unmount()
    div.remove()
    const { root: root2, div: div2 } = await renderApp()
    const { loadEvents } = await import('../src/apps/salveto/store')
    expect((await loadEvents()).filter((e) => e.type === 'cycle').length).toBe(3)
    root2.unmount()
    div2.remove()
  })

  it('phase du jour affichée sur l’accueil quand une période couvre aujourd’hui', async () => {
    const { root, div } = await renderApp()
    expect(div.querySelectorAll('.sa-day-phase').length).toBeGreaterThan(0)
    expect(div.textContent).toContain('règles')
    root.unmount()
    div.remove()
  })
})
