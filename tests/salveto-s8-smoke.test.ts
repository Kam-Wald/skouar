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

async function seedEvents() {
  const { saveEvent } = await import('../src/apps/salveto/store')
  const { addDays, makeEvent, todayDay } = await import('../src/apps/salveto/logic')
  const today = todayDay()
  await saveEvent(makeEvent('moral', { value: 4, notes: 'bonne journée' }))
  await saveEvent(makeEvent('crise', { value: 7, label: 'tête', zones: ['tete'], declencheurs: ['stress'], notes: 'migraine' }))
  await saveEvent(makeEvent('note', { notes: 'réunion stressante' }))
  await saveEvent(makeEvent('crise', { value: 5, date: `${addDays(today, -2)}T18:00:00`, notes: 'migraine aussi' }))
  await sleep(80)
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
    await sleep(60)
  })
  return { React, root, div }
}

const btn = (div: HTMLElement, sel: string) => div.querySelector(sel) as HTMLButtonElement
const btnByText = (div: HTMLElement, text: string, scope?: HTMLElement) =>
  Array.from((scope ?? div).querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const setInput = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  const proto =
    el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const setSelect = (el: HTMLSelectElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('Salveto S8 — journal : timeline, filtres, recherche, calendrier, édition/suppression (smoke jsdom)', () => {
  it('timeline : toutes les entrées, filtre par type « Crise », recherche plein texte « migraine »', async () => {
    await seedOnboarded()
    await seedEvents()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="journal"]').click()
    })
    expect(div.querySelectorAll('.sa-journal-row').length).toBe(4)
    const sel = div.querySelector('.sa-journal-toolbar select') as HTMLSelectElement
    await React.act(async () => {
      setSelect(sel, 'crise')
    })
    expect(div.querySelectorAll('.sa-journal-row').length).toBe(2)
    const search = div.querySelector('.sa-search') as HTMLInputElement
    await React.act(async () => {
      setInput(search, 'migraine')
    })
    expect(div.querySelectorAll('.sa-journal-row').length).toBe(2)
    await React.act(async () => {
      setSelect(sel, 'all')
      setInput(search, 'stressante')
    })
    expect(div.querySelectorAll('.sa-journal-row').length).toBe(1)
    expect(div.textContent).toContain('réunion stressante')
    root.unmount()
    div.remove()
  })

  it('édition d’une entrée (modal) → persistée avec updatedAt touché ; suppression avec confirmation', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="journal"]').click()
    })
    const criseRow = Array.from(div.querySelectorAll('.sa-journal-row')).find((r) =>
      r.textContent?.includes('Crise')
    ) as HTMLElement
    await React.act(async () => {
      btnByText(div, 'Modifier', criseRow).click()
    })
    expect(div.querySelector('.sa-modal')).toBeTruthy()
    const valInput = div.querySelector('.sa-modal input[type="number"]') as HTMLInputElement
    await React.act(async () => {
      setInput(valInput, '9')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer', div.querySelector('.sa-modal') as HTMLElement).click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    const { loadEvents } = await import('../src/apps/salveto/store')
    const evs = await loadEvents()
    const edited = evs.find((e) => e.value === 9)
    expect(edited).toBeTruthy()
    expect(edited!.updatedAt >= edited!.createdAt).toBe(true)
    // suppression avec confirmation
    const row2 = div.querySelector('.sa-journal-row') as HTMLElement
    const id = row2.getAttribute('data-event')!
    await React.act(async () => {
      btnByText(div, 'Supprimer', row2).click()
    })
    expect(div.textContent).toContain('Confirmer la suppression ?')
    await React.act(async () => {
      btnByText(div, 'Confirmer la suppression ?', row2).click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    expect((await loadEvents()).some((e) => e.id === id)).toBe(false)
    expect(div.querySelectorAll('.sa-journal-row').length).toBe(3)
    root.unmount()
    div.remove()
  })

  it('calendrier mensuel : marqueurs par jour (💥 crise, ✓ saisie, · sans saisie), clic sur un jour → ses entrées', async () => {
    const { todayDay } = await import('../src/apps/salveto/logic')
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="journal"]').click()
    })
    await React.act(async () => {
      btnByText(div, 'Calendrier').click()
    })
    expect(div.querySelectorAll('.sa-cal-cell').length).toBeGreaterThanOrEqual(28)
    const today = todayDay()
    const todayCell = Array.from(div.querySelectorAll('.sa-cal-cell')).find(
      (c) => c.classList.contains('today')
    ) as HTMLElement
    expect(todayCell.textContent).toContain('💥')
    expect(todayCell.textContent).toContain('✓')
    const empty = div.querySelector('.sa-cal-cell.empty')
    expect(empty).toBeTruthy()
    // clic sur aujourd'hui → entrées du jour listées
    await React.act(async () => {
      todayCell.click()
    })
    const dayRows = div.querySelectorAll('.sa-cal .sa-journal-row, section .sa-journal-row')
    expect(dayRows.length).toBe(2)
    expect(div.textContent).toContain("Aujourd’hui")
    root.unmount()
    div.remove()
  })
})
