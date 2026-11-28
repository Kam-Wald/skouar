// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

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
      getTextContent: async () => ({ items: [] })
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
  const { docsT, annotsT, pageNotesT, foldersT, signaturesT } = await import('../src/apps/marge/store')
  await docsT.clear()
  await annotsT.clear()
  await pageNotesT.clear()
  await foldersT.clear()
  await signaturesT.clear()
})

const setVal = (el: HTMLInputElement | HTMLTextAreaElement, v: string): void => {
  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
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
  await addDoc({ id: uid(), title: 'doc.pdf', data: new Blob([bytes], { type: 'application/pdf' }), pages: 5, updatedAt: Date.now() })
}

const pageIn = (div: HTMLElement) => div.querySelector('.marge-page-in') as HTMLInputElement
const overlayOf = (div: HTMLElement, p: number) => div.querySelector(`.marge-page[data-page="${p}"] .marge-overlay`) as HTMLElement
const mouse = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }))

describe('Marge S6 — outils d’annotation (smoke jsdom)', () => {
  it('surlignage au drag (touche 2), liste sidebar, suppression ; texte via popover (touche 6) ; tampon (touche 7) ; couleur persistée ; signature sans carnet → indice', async () => {
    await seedDoc()
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-page').length === 5)

      const { listAnnots, listDocs } = await import('../src/apps/marge/store')
      const docId = (await listDocs())[0].id

      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
      })
      await until(React, () => !!div.querySelector('.marge-tool.active'))
      const ov = overlayOf(div, 1)
      await React.act(async () => {
        mouse(ov, 'mousedown', 10, 10)
        mouse(ov, 'mousemove', 60, 50)
        mouse(ov, 'mouseup', 60, 50)
      })
      await React.act(async () => {
        await new Promise((r) => setTimeout(r, 120))
      })
      let annots = await listAnnots(docId)
      expect(annots.length).toBe(1)
      expect(annots[0].type).toBe('hl')
      expect(annots[0].w).toBeGreaterThan(0)
      expect(annots[0].h).toBeGreaterThan(0)

      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 1)

      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '6' }))
      })
      await React.act(async () => {
        mouse(overlayOf(div, 2), 'mousedown', 30, 30)
      })
      await until(React, () => !!div.querySelector('.marge-note-pop textarea'))
      const ta = div.querySelector('.marge-note-pop textarea') as HTMLTextAreaElement
      await React.act(async () => {
        setVal(ta, 'Salut le doc')
        const ok = Array.from(div.querySelectorAll('.marge-note-pop button')).find((b) => b.textContent === 'OK') as HTMLButtonElement
        ok.click()
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 2)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.type === 'text')?.text).toBe('Salut le doc')
      expect(annots.find((a) => a.type === 'text')?.page).toBe(2)

      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '7' }))
      })
      await React.act(async () => {
        mouse(overlayOf(div, 3), 'mousedown', 40, 40)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 3)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.type === 'stamp')?.text).toBe('✅ Lu')

      const dots = div.querySelectorAll('.marge-colors .marge-dot')
      await React.act(async () => {
        ;(dots[1] as HTMLButtonElement).click()
      })
      expect(localStorage.getItem('skouar:marge:color')).toBe('#7ee081')

      await React.act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '9' }))
      })
      await React.act(async () => {
        mouse(overlayOf(div, 1), 'mousedown', 50, 50)
      })
      await until(React, () => !!div.querySelector('.marge-hint'))
      expect(div.querySelector('.marge-hint')?.textContent).toContain('signature')

      const firstRow = div.querySelector('.marge-annot-row') as HTMLElement
      await React.act(async () => {
        ;(firstRow.querySelector('.marge-annot-del') as HTMLButtonElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 2)
      expect((await listAnnots(docId)).length).toBe(2)
    } finally {
      root.unmount()
      div.remove()
    }
  })
})
