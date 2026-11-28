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
  const { saveConfig, saveEvent, saveProfil } = await import('../src/apps/salveto/store')
  const { addDays, makeEvent, seedConfig, seedProfil, todayDay } = await import('../src/apps/salveto/logic')
  saveConfig({ ...seedConfig(), onboarded: true })
  const today = todayDay()
  await saveEvent(makeEvent('crise', { value: 8, label: 'tête', notes: 'migraine' }))
  await saveEvent(makeEvent('crise', { value: 5, date: `${addDays(today, -3)}T18:00:00` }))
  await saveEvent(makeEvent('moral', { value: 4 }))
  await saveEvent(makeEvent('moral', { value: 2, date: `${addDays(today, -2)}T09:00:00` }))
  await saveEvent(makeEvent('rdv', { label: 'Dr Martin', date: `${addDays(today, -10)}T14:00:00`, motif: 'suivi' }))
  saveProfil({ ...seedProfil(), allergies: ['pénicilline'], groupeSanguin: 'O+', traitementsEnCours: 'Doliprane au besoin' })
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
    await sleep(60)
  })
  return { React, root, div }
}

const btn = (div: HTMLElement, sel: string) => div.querySelector(sel) as HTMLButtonElement
const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement

describe('Salveto S10 — rapports (smoke jsdom)', () => {
  it('rapport mensuel « Ton mois » : nb crises, moyennes, jours sans saisie ; navigation mois', async () => {
    await seedOnboarded()
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      btn(div, '[data-nav="rapports"]').click()
    })
    expect(div.textContent).toContain('Ton mois')
    expect(div.textContent).toContain('Crises ce mois : 2')
    expect(div.textContent).toContain('Moral moyen : 3/5')
    expect(div.textContent).toContain('jour(s) sans saisie')
    expect(div.textContent).toContain('Fiche médecin')
    // navigation vers le mois précédent
    const before = div.querySelector('.sa-cal-head strong')?.textContent
    await React.act(async () => {
      btnByText(div, '‹').click()
    })
    expect(div.querySelector('.sa-cal-head strong')?.textContent).not.toBe(before)
    root.unmount()
    div.remove()
  })

  it('bouton « Générer la fiche médecin (PDF) » → buildPdf produit un PDF valide (test unitaire) + toast au clic', async () => {
    const { React, root, div } = await renderApp()
    let toast = ''
    const onToast = (e: Event) => {
      toast = (e as CustomEvent<string>).detail
    }
    window.addEventListener('skouar:toast', onToast)
    await React.act(async () => {
      btn(div, '[data-nav="rapports"]').click()
    })
    await React.act(async () => {
      btnByText(div, 'Générer la fiche médecin (PDF)').click()
      await sleep(200)
    })
    expect(toast.toLowerCase()).toContain('fiche médecin pdf générée')
    window.removeEventListener('skouar:toast', onToast)
    root.unmount()
    div.remove()
  })
})

describe('Salveto S10 — buildFicheMedecinPdf (unitaire)', () => {
  it('produit un PDF valide contenant profil, crises depuis le dernier RDV, courbes, questions', async () => {
    const { buildFicheMedecinPdf } = await import('../src/apps/salveto/pdf')
    const { addDays, makeEvent, seedConfig, seedProfil, seedRefs, todayDay } = await import('../src/apps/salveto/logic')
    const today = todayDay()
    const events = [
      makeEvent('rdv', { label: 'Dr Martin', date: `${addDays(today, -10)}T14:00:00` }),
      makeEvent('crise', { value: 8, label: 'tête', notes: 'migraine' }),
      makeEvent('moral', { value: 4 }),
      makeEvent('poids', { value: 71.5 })
    ]
    const bytes = buildFicheMedecinPdf({
      profil: { ...seedProfil(), allergies: ['pénicilline'], groupeSanguin: 'O+' },
      events,
      refs: seedRefs(),
      config: { ...seedConfig(), onboarded: true, questionsRdv: ['Parler des migraines'] }
    })
    const head = new TextDecoder().decode(bytes.slice(0, 5))
    expect(head).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(800)
    const all = new TextDecoder('latin1').decode(bytes)
    expect(all).toContain('Fiche')
    expect(all).toContain('Dr Martin')
  })
})
