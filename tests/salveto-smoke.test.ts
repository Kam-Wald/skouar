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
  const SalvetoApp = (await import('../src/apps/salveto/SalvetoApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(SalvetoApp)))
  })
  await React.act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
  return { React, root, div }
}

describe('Salveto (smoke jsdom) — S1 coquille + onboarding', () => {
  it('premier lancement : onboarding affiché avec tous les suivis cochés', async () => {
    const { root, div } = await renderApp()
    expect(div.textContent).toContain('Bienvenue dans Salveto')
    expect(div.querySelectorAll('.sa-onb-item input[type="checkbox"]').length).toBe(13)
    expect(div.querySelectorAll('.sa-onb-item input:checked').length).toBe(13)
    root.unmount()
    div.remove()
  })

  it('onboarding : décocher « cycle », valider, l’accueil affiche les suivis actifs et la config est persistée', async () => {
    const { React, root, div } = await renderApp()
    const cycle = div.querySelector('input[data-suivi="cycle"]') as HTMLInputElement
    await React.act(async () => {
      cycle.click()
    })
    expect(cycle.checked).toBe(false)
    await React.act(async () => {
      const btn = Array.from(div.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('C’est parti')
      ) as HTMLButtonElement
      btn.click()
    })
    expect(div.textContent).toContain('Accueil')
    expect(div.textContent).not.toContain('Cycle menstruel')
    expect(div.querySelectorAll('.sa-quick-btn').length).toBe(8)
    expect(div.querySelectorAll('.sa-side-row').length).toBe(11)
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 600))
    })
    const { loadConfig } = await import('../src/apps/salveto/store')
    const c = await loadConfig()
    expect(c.onboarded).toBe(true)
    expect(c.activeSuivis).not.toContain('cycle')
    expect(c.activeSuivis.length).toBe(12)
    expect(localStorage.getItem('skouar:salveto:desktopOnly')).toBe('1')
    root.unmount()
    div.remove()
  })

  it('deuxième lancement : l’onboarding n’est plus affiché (config relue depuis Dexie)', async () => {
    const { root, div } = await renderApp()
    expect(div.textContent).toContain('Accueil')
    expect(div.textContent).not.toContain('Bienvenue dans Salveto')
    root.unmount()
    div.remove()
  })
})
