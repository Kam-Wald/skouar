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

const flush = async (React: typeof import('react'), ms = 50) =>
  React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const RacineApp = (await import('../src/apps/racine/RacineApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  localStorage.setItem('skouar:settings', JSON.stringify({ apps: { racine: { onboarded: true, trackers: {} } } }))
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/racine'] }, React.createElement(RacineApp)))
  })
  await flush(React, 60)
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  return { React, root, div, sideBtn }
}

describe('Racine — squelette (smoke jsdom, vrais clics)', () => {
  it('rend le shell AppShell : sidebar 9 entrées, navigation entre vues, toast skouar:toast, compteur journal', async () => {
    const { React, root, div, sideBtn } = await renderApp()
    for (const label of ['Accueil', 'Journal', 'Courbes', 'Cycle', 'RDV & ordonnances', 'Traitements', 'Profil santé', 'Préventif', 'Rapports']) {
      expect(sideBtn(label)).toBeTruthy()
    }
    expect(div.querySelector('.ra-view h2')?.textContent).toContain('Accueil')
    expect(div.querySelector('.ra-view')?.textContent).toContain('0 entrée')
    await React.act(async () => {
      sideBtn('Journal').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view h2')?.textContent).toContain('Journal')
    expect(div.querySelector('.ra-journal')).toBeTruthy()
    await React.act(async () => {
      sideBtn('Rapports').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view h2')?.textContent).toContain('Rapports')
    expect(div.querySelector('.ra-view')?.textContent).toContain('Ton mois')
    await React.act(async () => {
      sideBtn('Profil santé').click()
    })
    await flush(React, 30)
    expect(div.querySelector('.ra-view h2')?.textContent).toContain('Profil santé')
    await React.act(async () => {
      window.dispatchEvent(new CustomEvent('skouar:toast', { detail: 'Toast de test' }))
    })
    await flush(React, 30)
    expect(div.querySelector('.toast')?.textContent).toContain('Toast de test')
    root.unmount()
    div.remove()
  })
})
