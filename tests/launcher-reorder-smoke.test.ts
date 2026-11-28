// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

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

beforeEach(() => localStorage.clear())

const KEY = 'skouar:launcher:order'

async function renderLauncher() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const LauncherHome = (await import('../src/launcher/LauncherHome')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(LauncherHome)))
  })
  return { React, root, div }
}

const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const idOf = (href: string) => href.replace(/^#?\/app\//, '')
const tileIds = (div: HTMLElement) =>
  Array.from(div.querySelectorAll('.app-tile')).map((t) => (t as HTMLElement).getAttribute('href') ?? `/app/${(t as HTMLElement).dataset.appId ?? ''}`)
const tileAppIds = (div: HTMLElement) => tileIds(div).map(idOf)
const setVal = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Launcher — réorganisation des tuiles (smoke jsdom)', () => {
  it('« Réorganiser » → mode édition (poignées sur les 14 tuiles, bouton « ✓ Terminé » actif) ; Échap quitte', async () => {
    const { React, root, div } = await renderLauncher()
    expect(div.querySelector('.app-tile-grip')).toBeNull()
    await React.act(async () => {
      btnByText(div, 'Réorganiser').click()
    })
    expect(div.querySelectorAll('.app-tile-grip').length).toBe(14)
    const btn = btnByText(div, 'Terminé')
    expect(btn.classList.contains('active')).toBe(true)
    expect(div.querySelector('.launcher-editbar')).toBeTruthy()
    await React.act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(div.querySelector('.app-tile-grip')).toBeNull()
    root.unmount()
    div.remove()
  })

  it('drag’n’drop simulé : déposer la 1ʳᵉ tuile avant la 3ᵉ → ordre persisté + DOM réordonné + statut affiché', async () => {
    const { React, root, div } = await renderLauncher()
    await React.act(async () => {
      btnByText(div, 'Réorganiser').click()
    })
    const before = tileIds(div)
    const firstId = before[0]
    const thirdId = before[2]
    const grips = div.querySelectorAll('.app-tile-grip')
    const tiles = div.querySelectorAll('.app-tile')
    await React.act(async () => {
      grips[0].dispatchEvent(new Event('dragstart', { bubbles: true }))
    })
    await React.act(async () => {
      tiles[2].dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }))
    })
    expect(tiles[2].classList.contains('drop-before')).toBe(true)
    await React.act(async () => {
      tiles[2].dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
    })
    const after = tileIds(div)
    expect(after[0]).toBe(before[1])
    expect(idOf(after[1])).toBe(idOf(firstId))
    expect(after[2]).toBe(thirdId)
    const saved = JSON.parse(localStorage.getItem(KEY)!) as string[]
    expect(saved[1]).toBe(idOf(firstId))
    expect(div.textContent).toContain('Ordre des tuiles enregistré')
    root.unmount()
    div.remove()
  })

  it('ordre persisté appliqué au rechargement + recherche respecte l’ordre ; « Réinitialiser » efface', async () => {
    localStorage.setItem(KEY, JSON.stringify(['racine', 'taol']))
    const { React, root, div } = await renderLauncher()
    const ids = tileIds(div)
    expect(tileAppIds(div)[0]).toBe('racine')
    expect(tileAppIds(div)[1]).toBe('taol')
    // recherche : ordre perso appliqué aux résultats filtrés
    const search = div.querySelector('.launcher-search') as HTMLInputElement
    await React.act(async () => {
      setVal(search, 'a')
    })
    expect(tileAppIds(div)[0]).toBe('racine')
    await React.act(async () => {
      setVal(search, '')
    })
    // réinitialiser
    await React.act(async () => {
      btnByText(div, 'Réorganiser').click()
    })
    await React.act(async () => {
      btnByText(div, 'Réinitialiser').click()
    })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(tileAppIds(div)[0]).toBe('karneto')
    expect(div.textContent).toContain('Ordre réinitialisé')
    root.unmount()
    div.remove()
  })

  it('clavier : Alt+→ déplace la tuile focalisée d’une position en mode édition', async () => {
    const { React, root, div } = await renderLauncher()
    await React.act(async () => {
      btnByText(div, 'Réorganiser').click()
    })
    const tiles = div.querySelectorAll('.app-tile')
    const before = tileIds(div)
    await React.act(async () => {
      tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
    })
    const after = tileIds(div)
    expect(idOf(after[1])).toBe(idOf(before[0]))
    expect(JSON.parse(localStorage.getItem(KEY)!)[1]).toBe(idOf(before[0]))
    root.unmount()
    div.remove()
  })
})
