// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'

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

describe('Cockpit (smoke jsdom)', () => {
  it('rend le shell, la nav et la vue Aujourd’hui', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const CockpitApp = (await import('../src/apps/cockpit/CockpitApp')).default
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(CockpitApp)))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 1200))
    })
    const html = div.innerHTML
    for (const needle of [
      'blocs-app',
      'Cockpit',
      'ck-nav',
      'Aujourd’hui',
      'Kanban',
      'Matrice',
      'Revue',
      'Conseils',
      'ck-timer-card',
      'ck-ring',
      'ck-time',
      'Checklist du jour',
      'Techniques guidées',
      'Rituel de fermeture',
      'Tâche du jour',
      'Rappels',
      'Tout effacer',
      'Routines',
      'min de focus aujourd’hui',
      'tâches en cours'
    ]) {
      expect(html).toContain(needle)
    }
    root.unmount()
  })

  it('le registry expose cockpit actif à la place de eur', async () => {
    const { apps } = await import('../src/apps/registry')
    const ck = apps.find((a) => a.id === 'cockpit')
    expect(ck).toBeTruthy()
    expect(ck?.soon).toBeFalsy()
    expect(ck?.component).toBeTruthy()
    expect(ck?.name).toBe('Cockpit')
    expect(apps.find((a) => a.id === 'eur')).toBeUndefined()
  })
})
