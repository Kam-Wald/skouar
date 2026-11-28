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
const setSelect = (el: HTMLSelectElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('Salveto S7 — profil santé, pièces jointes, carte d’urgence (smoke jsdom)', () => {
  it('profil rempli → persisté ; carte d’urgence en 1 clic depuis l’accueil affiche allergies/groupe/traitements/contact', async () => {
    await seedOnboarded()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="profil"]').click()
    })
    const selects = div.querySelectorAll('select')
    await React.act(async () => {
      setSelect(selects[0] as HTMLSelectElement, 'O+')
    })
    const texts = div.querySelectorAll('.sa-profil-form input[type="text"]')
    await React.act(async () => {
      setInput(texts[0] as HTMLInputElement, 'Marie Dupont')
      setInput(texts[1] as HTMLInputElement, '06 12 34 56 78')
      setInput(texts[2] as HTMLInputElement, 'pénicilline')
      btnByText(div, '+').click()
    })
    const textareas = div.querySelectorAll('.sa-profil-form textarea')
    await React.act(async () => {
      setInput(textareas[0] as HTMLTextAreaElement, 'Migraines chroniques')
      setInput(textareas[2] as HTMLTextAreaElement, 'Doliprane au besoin')
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer le profil').click()
    })
    await React.act(async () => {
      await sleep(500)
    })
    const { loadProfil } = await import('../src/apps/salveto/store')
    const p = await loadProfil()
    expect(p.groupeSanguin).toBe('O+')
    expect(p.allergies).toContain('pénicilline')
    expect(p.maladies).toBe('Migraines chroniques')
    expect(p.traitementsEnCours).toBe('Doliprane au besoin')
    expect(p.contactNom).toBe('Marie Dupont')
    // carte d'urgence en 1 clic depuis l'accueil
    await React.act(async () => {
      btn(div, '[data-nav="accueil"]').click()
    })
    await React.act(async () => {
      btn(div, '.sa-urgence-btn').click()
    })
    expect(div.textContent).toContain('Carte d’urgence')
    expect(div.querySelector('[data-urgence="allergies"]')?.textContent).toBe('pénicilline')
    expect(div.querySelector('[data-urgence="groupe"]')?.textContent).toBe('O+')
    expect(div.querySelector('[data-urgence="traitements"]')?.textContent).toBe('Doliprane au besoin')
    expect(div.querySelector('[data-urgence="contact"]')?.textContent).toContain('Marie Dupont')
    expect(div.textContent).toContain('Aucune diffusion automatique')
    root.unmount()
    div.remove()
  })

  it('vaccin avec rappel dépassé → bandeau passif accueil', async () => {
    const { addDays, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="profil"]').click()
    })
    const vTexts = Array.from(div.querySelectorAll('input[type="text"]')).filter(
      (i) => (i as HTMLInputElement).placeholder === 'Vaccin'
    )
    const vDates = Array.from(div.querySelectorAll('input[type="date"]'))
    await React.act(async () => {
      setInput(vTexts[0] as HTMLInputElement, 'Tétanos')
      setInput(vDates[vDates.length - 2] as HTMLInputElement, addDays(today, -800))
      setInput(vDates[vDates.length - 1] as HTMLInputElement, addDays(today, -5))
    })
    await React.act(async () => {
      btnByText(div, 'Ajouter').click()
    })
    await React.act(async () => {
      btnByText(div, 'Enregistrer le profil').click()
    })
    await React.act(async () => {
      await sleep(500)
    })
    await React.act(async () => {
      btn(div, '[data-nav="accueil"]').click()
    })
    expect(div.textContent).toContain('Rappel vaccin Tétanos dépassé')
    root.unmount()
    div.remove()
  })

  it('pièce jointe PDF importée (data-URL) → persistée, rattachable, supprimable après confirmation', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="profil"]').click()
    })
    const fileInput = div.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['%PDF-1.4 fake content'], 'ordonnance-scan.pdf', { type: 'application/pdf' })
    await React.act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(200)
    })
    expect(div.querySelectorAll('.sa-pj-row').length).toBe(1)
    expect(div.textContent).toContain('ordonnance-scan.pdf')
    const { loadAttachments } = await import('../src/apps/salveto/store')
    const atts = await loadAttachments()
    expect(atts.length).toBe(1)
    expect(atts[0].mime).toBe('application/pdf')
    expect(atts[0].dataUrl.startsWith('data:application/pdf')).toBe(true)
    expect(atts[0].refType).toBe('profil')
    // suppression en 2 clics (confirmation)
    await React.act(async () => {
      btnByText(div, 'Supprimer').click()
    })
    expect(div.textContent).toContain('Confirmer la suppression ?')
    await React.act(async () => {
      btnByText(div, 'Confirmer la suppression ?').click()
    })
    await React.act(async () => {
      await sleep(80)
    })
    expect((await loadAttachments()).length).toBe(0)
    expect(div.querySelectorAll('.sa-pj-row').length).toBe(0)
    root.unmount()
    div.remove()
  })
})
