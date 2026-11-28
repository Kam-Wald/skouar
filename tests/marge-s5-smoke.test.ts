// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

const PAGE_TEXTS: Record<number, string[]> = {
  1: ['Bonjour', 'le monde'],
  2: ['encore bonjour ici'],
  3: ['rien'],
  4: ['page quatre'],
  5: ['cinq']
}

vi.mock('../src/apps/marge/pdf', () => ({
  CMAPS_URL: '',
  FONTS_URL: '',
  loadDoc: async () => ({
    numPages: 5,
    destroy: async () => {},
    getOutline: async () => null,
    getPage: async (n: number) => ({
      pageNumber: n,
      getViewport: ({ scale, rotation = 0 }: { scale: number; rotation?: number }) => {
        const w = 100 * scale
        const h = 140 * scale
        const vp = rotation % 180 !== 0 ? { width: h, height: w, scale, rotation } : { width: w, height: h, scale, rotation }
        return {
          ...vp,
          transform: [scale, 0, 0, -scale, 0, h],
          convertToPdfPoint: (x: number, y: number) => [x, h - y] as [number, number],
          convertToViewportPoint: (x: number, y: number) => [x, h - y] as [number, number]
        }
      },
      render: () => ({ promise: Promise.resolve() }),
      streamTextContent: () => ({}),
      getTextContent: async () => ({
        items: (PAGE_TEXTS[n] ?? []).map((str, i) => ({ str, transform: [1, 0, 0, -1, i * 60, 140], width: 50, height: 10 }))
      })
    })
  }),
  renderTextLayer: async () => {},
  matchRect: () => [0, 0, 10, 10] as [number, number, number, number]
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

async function until(React: any, fn: () => boolean, ms = 3000): Promise<void> {
  await React.act(async () => {
    const t0 = Date.now()
    while (!fn() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 40))
  })
}

async function seedDoc() {
  const { PDFDocument } = await import('pdf-lib')
  const d = await PDFDocument.create()
  d.addPage([100, 100])
  const bytes = await d.save()
  const { addDoc, uid } = await import('../src/apps/marge/store')
  const id = uid()
  await addDoc({ id, title: 'doc.pdf', data: new Blob([bytes], { type: 'application/pdf' }), pages: 5, updatedAt: Date.now() })
  return id
}

const pageIn = (div: HTMLElement) => div.querySelector('.marge-page-in') as HTMLInputElement
const counter = (div: HTMLElement) => div.querySelector('.marge-search .marge-muted')?.textContent ?? ''

describe('Marge S5 — recherche Ctrl+F (smoke jsdom)', () => {
  it('Ctrl+F ouvre la recherche, « bonjour » → 2 résultats, compteur n/N, Entrée boucle et saute de page, Échap ferme', async () => {
    await seedDoc()
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => !!pageIn(div))
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
      })
      await until(React, () => !!div.querySelector('.marge-search input'))
      const input = div.querySelector('.marge-search input') as HTMLInputElement
      await React.act(async () => {
        setVal(input, 'bonjour')
      })
      await until(React, () => counter(div) === '1/2')
      expect(pageIn(div).value).toBe('1')
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      })
      await until(React, () => counter(div) === '2/2' && pageIn(div).value === '2')
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      })
      await until(React, () => counter(div) === '1/2' && pageIn(div).value === '1')
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })
      await until(React, () => !div.querySelector('.marge-search'))
    } finally {
      root.unmount()
      div.remove()
    }
  })

  it('filtre « mes annotations » trouve le contenu des annotations', async () => {
    const docId = await seedDoc()
    const { annotsT } = await import('../src/apps/marge/store')
    await annotsT.put({ id: 'an1', docId, page: 4, type: 'note', color: '#ffd54a', text: 'bonjour dans ma note', at: 1 })
    await annotsT.put({ id: 'an2', docId, page: 1, type: 'text', color: '#fff', text: 'autre chose', at: 2 })
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => !!pageIn(div))
      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
      })
      await until(React, () => !!div.querySelector('.marge-search input'))
      const input = div.querySelector('.marge-search input') as HTMLInputElement
      const filter = div.querySelector('.marge-search select') as HTMLSelectElement
      await React.act(async () => {
        setVal(input, 'bonjour')
      })
      await until(React, () => counter(div) === '1/2')
      await React.act(async () => {
        setSelect(filter, 'annots')
      })
      await until(React, () => counter(div) === '1/1')
      expect(pageIn(div).value).toBe('4')
      await React.act(async () => {
        setSelect(filter, 'doc')
      })
      await until(React, () => counter(div) === '1/2')
    } finally {
      root.unmount()
      div.remove()
    }
  })
})
