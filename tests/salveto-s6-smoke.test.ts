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

describe('Salveto S6 — RDV, ordonnances, préventif, bandeau passif (smoke jsdom)', () => {
  it('RDV dans 3 jours créé → persisté + bandeau accueil « dans 3 jours » + question en préparation persistée', async () => {
    await seedOnboarded()
    const { addDays, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="rdv"]').click()
    })
    const dates = div.querySelectorAll('input[type="date"]')
    const times = div.querySelectorAll('input[type="time"]')
    const texts = div.querySelectorAll('input[type="text"]')
    await React.act(async () => {
      setInput(dates[0] as HTMLInputElement, addDays(today, 3))
      setInput(times[0] as HTMLInputElement, '14:30')
      setInput(texts[0] as HTMLInputElement, 'Dr Martin')
      setInput(texts[1] as HTMLInputElement, 'Cabinet centre')
      setInput(texts[2] as HTMLInputElement, 'contrôle annuel')
    })
    await React.act(async () => {
      btnByText(div, 'Ajouter le RDV').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    const rdv = (await loadEvents()).find((e) => e.type === 'rdv')
    expect(rdv?.label).toBe('Dr Martin')
    expect(rdv?.lieu).toBe('Cabinet centre')
    expect(rdv?.motif).toBe('contrôle annuel')
    expect(rdv!.date.slice(0, 10)).toBe(addDays(today, 3))
    expect(div.textContent).toContain('À venir (1)')
    // question en préparation
    const qInput = Array.from(div.querySelectorAll('input[type="text"]')).find((i) =>
      (i as HTMLInputElement).placeholder.includes('question')
    ) as HTMLInputElement
    await React.act(async () => {
      setInput(qInput, 'Parler de mes migraines')
      btnByText(div, '+').click()
    })
    await React.act(async () => {
      await sleep(500)
    })
    expect(div.textContent).toContain('Parler de mes migraines ×')
    const { loadConfig } = await import('../src/apps/salveto/store')
    expect((await loadConfig()).questionsRdv).toContain('Parler de mes migraines')
    // bandeau sur l'accueil
    await React.act(async () => {
      btn(div, '[data-nav="accueil"]').click()
    })
    expect(div.textContent).toContain('RDV Dr Martin dans 3 jours')
    expect(div.textContent).toContain("Ton moral du jour n’est pas encore noté")
    root.unmount()
    div.remove()
  })

  it('RDV passé : compte-rendu (diagnostic/prescriptions/prochaine étape) enregistré sur l’événement', async () => {
    const { addDays, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="rdv"]').click()
    })
    const dates = div.querySelectorAll('input[type="date"]')
    const texts = div.querySelectorAll('input[type="text"]')
    await React.act(async () => {
      setInput(dates[0] as HTMLInputElement, addDays(today, -10))
      setInput(texts[0] as HTMLInputElement, 'Dr House')
    })
    await React.act(async () => {
      btnByText(div, 'Ajouter le RDV').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    expect(div.textContent).toContain('Passés (1)')
    await React.act(async () => {
      btnByText(div, 'Compte-rendu').click()
    })
    const crInputs = div.querySelectorAll('.sa-cr input')
    await React.act(async () => {
      setInput(crInputs[0] as HTMLInputElement, 'migraine chronique évoquée')
      setInput(crInputs[1] as HTMLInputElement, 'IRM prescrite')
      setInput(crInputs[2] as HTMLInputElement, 'revoir dans 3 mois')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer le compte-rendu').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    const passe = (await loadEvents()).find((e) => e.type === 'rdv' && e.label === 'Dr House')
    expect(passe?.crDiag).toBe('migraine chronique évoquée')
    expect(passe?.crExamens).toBe('IRM prescrite')
    expect(passe?.crProchaine).toBe('revoir dans 3 mois')
    expect(div.textContent).toContain('compte-rendu : migraine chronique évoquée / IRM prescrite / revoir dans 3 mois')
    root.unmount()
    div.remove()
  })

  it('ordonnance « à renouveler » créée → liste + badge + bandeau ; préventif échu → bandeau « échéance dépassée »', async () => {
    const { addDays, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const { React, root, div } = await renderApp()
    // ordonnance
    await React.act(async () => {
      btn(div, '[data-nav="ordonnances"]').click()
    })
    const texts = div.querySelectorAll('input[type="text"]')
    const dates = div.querySelectorAll('input[type="date"]')
    await React.act(async () => {
      setInput(dates[0] as HTMLInputElement, today)
      setInput(texts[0] as HTMLInputElement, 'Dr Martin')
      setInput(dates[1] as HTMLInputElement, addDays(today, 10))
    })
    const check = div.querySelector('input[type="checkbox"]') as HTMLInputElement
    await React.act(async () => {
      check.click()
    })
    const contenu = div.querySelector('textarea') as HTMLTextAreaElement
    await React.act(async () => {
      setInput(contenu, 'Doliprane 1 g, 3 fois/jour')
    })
    await React.act(async () => {
      btnByText(div, 'Ajouter l’ordonnance').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    const o = (await loadEvents()).find((e) => e.type === 'ordonnance')
    expect(o?.medecin).toBe('Dr Martin')
    expect(o?.aRenouveler).toBe(true)
    expect(o?.fin!.slice(0, 10)).toBe(addDays(today, 10))
    expect(div.textContent).toContain('à renouveler')
    expect(div.textContent).toContain('pas un outil de prise')
    // preventif
    await React.act(async () => {
      btn(div, '[data-nav="preventif"]').click()
    })
    const pTexts = div.querySelectorAll('input[type="text"]')
    const pNum = div.querySelector('input[type="number"]') as HTMLInputElement
    const pDate = div.querySelector('input[type="date"]') as HTMLInputElement
    await React.act(async () => {
      setInput(pTexts[0] as HTMLInputElement, 'Dentiste')
      setInput(pNum, '365')
      setInput(pDate, addDays(today, -400))
    })
    await React.act(async () => {
      btnByText(div, 'Ajouter').click()
    })
    await React.act(async () => {
      await sleep(450)
    })
    const { loadRefs } = await import('../src/apps/salveto/store')
    expect((await loadRefs()).items.some((r) => r.kind === 'preventif' && r.label === 'Dentiste')).toBe(true)
    expect(div.textContent).toContain('échéance dépassée')
    // bandeau accueil
    await React.act(async () => {
      btn(div, '[data-nav="accueil"]').click()
    })
    expect(div.textContent).toContain('à renouveler')
    expect(div.textContent).toContain('Dentiste')
    expect(div.textContent).toContain('échéance dépassée')
    root.unmount()
    div.remove()
  })
})
