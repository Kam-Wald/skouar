// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia
  }
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const flush = async (React: typeof import('react'), ms = 60) =>
  React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

async function renderApp() {
  localStorage.setItem('skouar:settings', JSON.stringify({ apps: { racine: { onboarded: true, trackers: {} } } }))
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const RacineApp = (await import('../src/apps/racine/RacineApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/racine'] }, React.createElement(RacineApp)))
  })
  await flush(React, 60)
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const btnByLabel = (l: string) => div.querySelector(`[aria-label="${l}"]`) as HTMLElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const setArea = (el: HTMLTextAreaElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const setSelect = (el: HTMLSelectElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { React, root, div, sideBtn, btnByLabel, setInput, setArea, setSelect }
}

describe('Racine — profil santé + pièces jointes + carte d’urgence (smoke jsdom, vrais clics)', () => {
  it('remplir le profil, importer un PDF (limite 8 Mo respectée), rattacher à un RDV, carte d’urgence depuis l’accueil', async () => {
    const { addEvent } = await import('../src/apps/racine/events')
    const rdv = await addEvent('rdv', { date: Date.now() + 86400000, praticien: 'Dr House', motif: 'contrôle', heure: '10:00', lieu: '', statut: 'a-venir' }, '')

    const { React, root, div, sideBtn, btnByLabel, setArea, setSelect } = await renderApp()

    await React.act(async () => {
      sideBtn('Profil santé').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      setArea(btnByLabel('Allergies') as HTMLTextAreaElement, 'Pénicilline')
      setArea(btnByLabel('Groupe sanguin') as HTMLTextAreaElement, 'O+')
      setArea(btnByLabel('Traitements en cours') as HTMLTextAreaElement, 'Magnésium 300 mg/j')
      setArea(btnByLabel('Personne à contacter') as HTMLTextAreaElement, 'Sam — 06 12 34 56 78')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer le profil').click()
    })
    await flush(React)
    expect(div.querySelector('.toast')?.textContent).toContain('Profil santé enregistré')

    const fileInput = btnByLabel('Fichier de pièce jointe') as HTMLInputElement
    await React.act(async () => {
      const file = new File([new Uint8Array([37, 80, 68, 70, 45])], 'ordonnance.pdf', { type: 'application/pdf' })
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 80)
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('ordonnance.pdf')
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('Ko')

    await React.act(async () => {
      const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'gros.pdf', { type: 'application/pdf' })
      Object.defineProperty(fileInput, 'files', { value: [big], configurable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush(React, 80)
    expect(div.querySelector('.toast')?.textContent).toContain('trop lourde')
    expect(div.querySelectorAll('.ra-cycle-list li').length).toBe(1)

    await React.act(async () => {
      setSelect(btnByLabel('Rattacher ordonnance.pdf à') as HTMLSelectElement, rdv!.id)
    })
    await flush(React, 40)
    expect(div.querySelector('.ra-cycle-list')?.textContent).toContain('rattachée à : RDV')

    await React.act(async () => {
      sideBtn('Accueil').click()
    })
    await flush(React, 30)
    await React.act(async () => {
      btnByLabel('Carte d’urgence').click()
    })
    await flush(React, 30)
    const urg = div.querySelector('.ra-urgence')
    expect(urg).toBeTruthy()
    expect(urg?.textContent).toContain('Pénicilline')
    expect(urg?.textContent).toContain('O+')
    expect(urg?.textContent).toContain('Magnésium 300 mg/j')
    expect(urg?.textContent).toContain('Sam — 06 12 34 56 78')
    await React.act(async () => {
      btnByLabel('Fermer la carte d’urgence').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-urgence')).toBeNull()

    const { getProfile, listAttachments } = await import('../src/apps/racine/store')
    const p = await getProfile()
    expect(p.allergies).toBe('Pénicilline')
    expect(p.groupeSanguin).toBe('O+')
    const atts = await listAttachments()
    expect(atts.length).toBe(1)
    expect(atts[0].eventId).toBe(rdv!.id)

    root.unmount()
    div.remove()
  })
})
