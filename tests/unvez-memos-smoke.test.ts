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
  const UnvezApp = (await import('../src/apps/unvez/UnvezApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ['/app/unvez'] }, React.createElement(UnvezApp)))
  })
  await React.act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })
  const sideBtn = (t: string) => Array.from(div.querySelectorAll('.blocs-sidebar button')).find((b) => b.textContent?.trim().includes(t)) as HTMLButtonElement
  const btnByLabel = (l: string) => div.querySelector(`[aria-label="${l}"]`) as HTMLElement
  const btnByText = (t: string) => Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement
  const press = (t: string) =>
    Array.from(div.querySelectorAll('.calc-pad .calc-key, .calc-pct .unvez-btn, .calc-mem .unvez-btn, .calc-tabs .unvez-btn, .conv-actions .unvez-btn')).find(
      (b) => b.textContent?.trim() === t
    ) as HTMLButtonElement
  const setInput = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { React, root, div, sideBtn, btnByLabel, btnByText, press, setInput }
}

describe('Unvez — mémos enregistrés (smoke jsdom, vrais clics + DnD)', () => {
  it('enregistrer un calcul en mémo, le voir dans « Sans dossier », créer un dossier, déplacer le mémo en DnD', async () => {
    const { React, root, div, sideBtn, btnByLabel, btnByText, press, setInput } = await renderApp()
    await React.act(async () => {
      sideBtn('Calculatrice').click()
    })
    await React.act(async () => {
      press('2').click()
      press('+').click()
      press('3').click()
      press('=').click()
    })
    await React.act(async () => {
      Array.from(div.querySelectorAll('.calc-save')).find((b) => b.textContent?.includes('mémo'))!.click()
    })
    const nameInput = btnByLabel('Nom du mémo') as HTMLInputElement
    expect(nameInput).toBeTruthy()
    await React.act(async () => {
      setInput(nameInput, 'Test mémo')
    })
    await React.act(async () => {
      btnByText('Enregistrer').click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await React.act(async () => {
      sideBtn('Sans dossier').click()
    })
    let card = div.querySelector('.memo-card')
    expect(card?.textContent).toContain('Test mémo')
    expect(card?.textContent).toContain('5')
    expect(card?.querySelector('.memo-badge')?.textContent).toBe('calc')

    await React.act(async () => {
      btnByLabel('Nouveau dossier').click()
    })
    const folderName = btnByLabel('Nom du dossier') as HTMLInputElement
    await React.act(async () => {
      setInput(folderName, 'Cadeaux')
    })
    await React.act(async () => {
      btnByLabel('Enregistrer le dossier').click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    const folderBtn = sideBtn('Cadeaux')
    expect(folderBtn).toBeTruthy()

    await React.act(async () => {
      card!.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }))
    })
    await React.act(async () => {
      folderBtn.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }))
      folderBtn.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(div.querySelector('.memo-card')).toBeNull()
    await React.act(async () => {
      folderBtn.click()
    })
    card = div.querySelector('.memo-card')
    expect(card?.textContent).toContain('Test mémo')
    root.unmount()
    div.remove()
  })

  it('recherche, modification, suppression avec confirmation, réutilisation dans la calculatrice', async () => {
    const { React, root, div, sideBtn, btnByLabel, btnByText, press, setInput } = await renderApp()
    await React.act(async () => {
      sideBtn('Calculatrice').click()
    })
    await React.act(async () => {
      press('7').click()
      press('+').click()
      press('1').click()
      press('=').click()
    })
    await React.act(async () => {
      Array.from(div.querySelectorAll('.calc-save')).find((b) => b.textContent?.includes('mémo'))!.click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Nom du mémo') as HTMLInputElement, 'Addition')
    })
    await React.act(async () => {
      btnByText('Enregistrer').click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await React.act(async () => {
      sideBtn('Sans dossier').click()
    })
    const search = btnByLabel('Rechercher dans les mémos') as HTMLInputElement
    await React.act(async () => {
      setInput(search, 'addition')
    })
    expect(div.querySelectorAll('.memo-card').length).toBe(1)
    await React.act(async () => {
      setInput(search, 'zzz')
    })
    expect(div.querySelectorAll('.memo-card').length).toBe(0)
    await React.act(async () => {
      setInput(search, '')
    })

    const card = div.querySelector('.memo-card') as HTMLElement
    await React.act(async () => {
      Array.from(card.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Modifier')!.click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Nom du mémo') as HTMLInputElement, 'Addition renommée')
    })
    await React.act(async () => {
      btnByText('Enregistrer').click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(div.querySelector('.memo-card')?.textContent).toContain('Addition renommée')

    await React.act(async () => {
      Array.from(div.querySelectorAll('.memo-card button')).find((b) => b.textContent?.trim() === 'Supprimer')!.click()
    })
    await React.act(async () => {
      Array.from(div.querySelectorAll('.memo-card button')).find((b) => b.textContent?.trim() === 'Confirmer ?')!.click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(div.querySelector('.memo-card')).toBeNull()

    await React.act(async () => {
      sideBtn('Calculatrice').click()
    })
    await React.act(async () => {
      press('9').click()
      press('+').click()
      press('1').click()
      press('=').click()
    })
    await React.act(async () => {
      Array.from(div.querySelectorAll('.calc-save')).find((b) => b.textContent?.includes('mémo'))!.click()
    })
    await React.act(async () => {
      setInput(btnByLabel('Nom du mémo') as HTMLInputElement, 'Reuse')
    })
    await React.act(async () => {
      btnByText('Enregistrer').click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await React.act(async () => {
      sideBtn('Sans dossier').click()
    })
    const card2 = div.querySelector('.memo-card') as HTMLElement
    await React.act(async () => {
      card2.click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(div.querySelector('.unvez-calc')).toBeTruthy()
    expect(div.querySelector('.calc-out')?.textContent).toBe('10')
    root.unmount()
    div.remove()
  })
})
