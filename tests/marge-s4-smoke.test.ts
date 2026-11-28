// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

vi.mock('../src/apps/marge/pdf', () => ({
  CMAPS_URL: '',
  FONTS_URL: '',
  loadDoc: async () => ({
    numPages: 5,
    destroy: async () => {},
    getOutline: async () => [{ title: 'Chapitre 1', dest: 'd1' }],
    getDestination: async () => [{ num: 7, gen: 0 }],
    getPageIndex: async () => 2,
    getPage: async (n: number) => ({
      pageNumber: n,
      getViewport: ({ scale, rotation = 0 }: { scale: number; rotation?: number }) => {
        const w = 100 * scale
        const h = 140 * scale
        return rotation % 180 !== 0 ? { width: h, height: w, scale, rotation } : { width: w, height: h, scale, rotation }
      },
      render: () => ({ promise: Promise.resolve() }),
      streamTextContent: () => ({})
    })
  }),
  renderTextLayer: async () => {}
}))

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
  if (!(window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver) {
    ;(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;(Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = function (this: Blob) {
    const self = this
    return new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as ArrayBuffer)
      fr.onerror = () => rej(fr.error)
      fr.readAsArrayBuffer(self)
    })
  }
})

beforeEach(async () => {
  localStorage.clear()
  const { docsT, annotsT, pageNotesT, foldersT } = await import('../src/apps/marge/store')
  await docsT.clear()
  await annotsT.clear()
  await pageNotesT.clear()
  await foldersT.clear()
})

const setVal = (el: HTMLInputElement, v: string): void => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const setSelect = (el: HTMLSelectElement, v: string): void => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

async function renderApp() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter } = await import('react-router-dom')
  const MargeApp = (await import('../src/apps/marge/MargeApp')).default
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  await React.act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(MargeApp)))
  })
  return { React, root, div }
}

async function until(React: ReturnType<typeof renderApp> extends Promise<infer R> ? R['React'] : never, fn: () => boolean, ms = 3000): Promise<void> {
  await React.act(async () => {
    const t0 = Date.now()
    while (!fn() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 40))
  })
}

async function seedDoc(title = 'doc.pdf', lastPage?: number) {
  const { PDFDocument } = await import('pdf-lib')
  const d = await PDFDocument.create()
  d.addPage([100, 100])
  const bytes = await d.save()
  const { addDoc, uid } = await import('../src/apps/marge/store')
  await addDoc({
    id: uid(),
    title,
    data: new Blob([bytes], { type: 'application/pdf' }),
    pages: 5,
    updatedAt: Date.now(),
    ...(lastPage ? { lastPage } : {})
  })
}

const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text) || b.title.includes(text)) as HTMLButtonElement
const pageIn = (div: HTMLElement) => div.querySelector('.marge-page-in') as HTMLInputElement

describe('Marge S4 — visionneuse et navigation (smoke jsdom)', () => {
  it('ouverture depuis une carte, rendu des 5 pages, navigation clavier et champ page', async () => {
    await seedDoc()
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-page').length === 5)
      expect(div.querySelector('.marge-pages')).toBeTruthy()
      expect(pageIn(div).value).toBe('1')
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      })
      await until(React, () => pageIn(div).value === '2')
      await React.act(async () => {
        setVal(pageIn(div), '4')
        pageIn(div).dispatchEvent(new Event('change', { bubbles: true }))
      })
      await until(React, () => pageIn(div).value === '4')
    } finally {
      root.unmount()
      div.remove()
    }
  })

  it('zoom (preset + touche +), 2 pages, rotation persistée, mode nuit persisté', async () => {
    await seedDoc()
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => !!pageIn(div))
      const zoomSel = () => div.querySelector('.marge-viewopts select') as HTMLSelectElement
      await React.act(async () => {
        setSelect(zoomSel(), '1.5')
      })
      await until(React, () => zoomSel().value === '1.5')
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
      })
      await until(React, () => Number(zoomSel().value) > 1.5 || (div.querySelector('.marge-viewopts select') as HTMLSelectElement).value !== '1.5')
      await React.act(async () => {
        btnByText(div, '2 pages').click()
      })
      await until(React, () => !!div.querySelector('.marge-pages.two'))
      expect(localStorage.getItem('skouar:marge:2p')).toBe('1')
      await React.act(async () => {
        btnByText(div, 'Rotation +90°').click()
      })
      const { listDocs } = await import('../src/apps/marge/store')
      await until(React, () => false, 300)
      expect((await listDocs())[0].rotation).toBe(90)
      await React.act(async () => {
        btnByText(div, 'Mode nuit').click()
      })
      await until(React, () => !!div.querySelector('.marge-pages.night'))
      expect(localStorage.getItem('skouar:marge:night')).toBe('1')
    } finally {
      root.unmount()
      div.remove()
    }
  })

  it('sommaire cliquable, vignettes, présentation (Échap), reprise de lecture persistée puis réouverture', async () => {
    await seedDoc('livre.pdf', 3)
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => !!pageIn(div) && pageIn(div).value === '3')
      const outline = () => div.querySelector('.marge-outline-item') as HTMLButtonElement
      await until(React, () => !!outline())
      expect(outline().textContent).toContain('Chapitre 1')
      await React.act(async () => {
        outline().click()
      })
      await until(React, () => pageIn(div).value === '3')
      await until(React, () => div.querySelectorAll('.marge-thumb').length === 5)
      await React.act(async () => {
        btnByText(div, 'présenter').click()
      })
      await until(React, () => !!div.querySelector('.marge-present'))
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })
      await until(React, () => !div.querySelector('.marge-present'))
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      })
      await until(React, () => pageIn(div).value === '4')
      const { listDocs } = await import('../src/apps/marge/store')
      await until(React, () => false, 1200)
      expect((await listDocs())[0].lastPage).toBe(4)
      await React.act(async () => {
        btnByText(div, 'Bibliothèque').click()
      })
      await until(React, () => !!div.querySelector('.marge-lib'))
    } finally {
      root.unmount()
      div.remove()
    }
    const r2 = await renderApp()
    try {
      await r2.React.act(async () => {
        ;(r2.div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(r2.React, () => !!pageIn(r2.div) && pageIn(r2.div).value === '4')
    } finally {
      r2.root.unmount()
      r2.div.remove()
    }
  })
})
