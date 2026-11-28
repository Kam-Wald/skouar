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

const settle = async (React: any, ms = 160): Promise<void> => {
  await React.act(async () => {
    await new Promise((r) => setTimeout(r, ms))
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

const overlayOf = (div: HTMLElement, p: number) => div.querySelector(`.marge-page[data-page="${p}"] .marge-overlay`) as HTMLElement
const pageEl = (div: HTMLElement, p: number) => div.querySelector(`.marge-page[data-page="${p}"]`) as HTMLElement
const mouse = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
const key = async (React: any, k: string, opts: Record<string, boolean> = {}) => {
  await React.act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }))
  })
}
const popOk = async (div: HTMLElement) => {
  const ok = Array.from(div.querySelectorAll('.marge-note-pop button')).find((b) => b.textContent === 'OK') as HTMLButtonElement
  ok.click()
}

describe('Marge S7 — déplacer/rééditer + undo/redo + notes de page (smoke jsdom)', () => {
  it('drag d’un surlignage en mode sélection + Ctrl+Z/Y, réédition d’un texte, suppression tampon restaurable, note de page retrouvée par la recherche', async () => {
    await seedDoc()
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-page').length === 5)
      const { listAnnots, listPageNotes, listDocs } = await import('../src/apps/marge/store')
      const docId = (await listDocs())[0].id

      // 1. surlignage au drag (outil 2), page 1 → hl en coordonnées PDF x=10 y=90 w=50 h=40
      await key(React, '2')
      const ov1 = overlayOf(div, 1)
      await React.act(async () => {
        mouse(ov1, 'mousedown', 10, 10)
      })
      await React.act(async () => {
        mouse(ov1, 'mousemove', 60, 50)
      })
      await React.act(async () => {
        mouse(ov1, 'mouseup', 60, 50)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 1)
      let annots = await listAnnots(docId)
      expect(annots.length).toBe(1)
      expect(annots[0]).toMatchObject({ type: 'hl', x: 10, y: 90, w: 50, h: 40 })

      // 2. mode sélection (touche 1) : drag de l'annotation — (30,30)→pdf(30,110) dedans, move (50,50) → dx=+20 dy=-20
      await key(React, '1')
      const pg1 = pageEl(div, 1)
      await React.act(async () => {
        mouse(pg1, 'mousedown', 30, 30)
      })
      await React.act(async () => {
        mouse(pg1, 'mousemove', 50, 50)
      })
      await React.act(async () => {
        mouse(pg1, 'mouseup', 50, 50)
      })
      await settle(React)
      annots = await listAnnots(docId)
      expect(annots[0]).toMatchObject({ type: 'hl', x: 30, y: 70, w: 50, h: 40 })

      // 3. Ctrl+Z restaure, Ctrl+Y rétablit
      await key(React, 'z', { ctrlKey: true })
      await settle(React)
      annots = await listAnnots(docId)
      expect(annots[0]).toMatchObject({ x: 10, y: 90 })
      await key(React, 'y', { ctrlKey: true })
      await settle(React)
      annots = await listAnnots(docId)
      expect(annots[0]).toMatchObject({ x: 30, y: 70 })

      // 4. texte (outil 6) page 2, réédité au clic, Ctrl+Z restaure l'ancien texte
      await key(React, '6')
      await React.act(async () => {
        mouse(overlayOf(div, 2), 'mousedown', 30, 30)
      })
      await until(React, () => !!div.querySelector('.marge-note-pop textarea'))
      await React.act(async () => {
        setVal(div.querySelector('.marge-note-pop textarea') as HTMLTextAreaElement, 'Salut')
        await popOk(div)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 2)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.type === 'text')?.text).toBe('Salut')

      await React.act(async () => {
        ;(div.querySelector('.marge-atext') as HTMLButtonElement).click()
      })
      await until(React, () => !!div.querySelector('.marge-note-pop textarea'))
      await React.act(async () => {
        setVal(div.querySelector('.marge-note-pop textarea') as HTMLTextAreaElement, 'Yo')
        await popOk(div)
      })
      await settle(React)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.type === 'text')?.text).toBe('Yo')
      await key(React, 'z', { ctrlKey: true })
      await settle(React)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.type === 'text')?.text).toBe('Salut')

      // 5. tampon (outil 7) page 3, supprimé au clic, restauré par Ctrl+Z
      await key(React, '7')
      await React.act(async () => {
        mouse(overlayOf(div, 3), 'mousedown', 40, 40)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 3)
      expect((await listAnnots(docId)).some((a) => a.type === 'stamp')).toBe(true)
      await React.act(async () => {
        ;(div.querySelector('.marge-astamp') as HTMLButtonElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 2)
      expect((await listAnnots(docId)).some((a) => a.type === 'stamp')).toBe(false)
      await key(React, 'z', { ctrlKey: true })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 3)
      expect((await listAnnots(docId)).some((a) => a.type === 'stamp')).toBe(true)

      // 6. note de page via le panneau sidebar (page courante = 1) + présence dans la liste
      await React.act(async () => {
        setVal(div.querySelector('.marge-pn-ta') as HTMLTextAreaElement, 'ma note de page')
      })
      await React.act(async () => {
        ;(Array.from(div.querySelectorAll('.marge-pagenote button')).find((b) => b.textContent === 'Enregistrer la note') as HTMLButtonElement).click()
      })
      await settle(React)
      const notes = await listPageNotes(docId)
      expect(notes.length).toBe(1)
      expect(notes[0]).toMatchObject({ page: 1, text: 'ma note de page' })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 4)

      // 7. recherche Ctrl+F, filtre « mes annotations » → retrouve la note de page
      await key(React, 'f', { ctrlKey: true })
      await until(React, () => !!div.querySelector('.marge-search input'))
      await React.act(async () => {
        setVal(div.querySelector('.marge-search input') as HTMLInputElement, 'ma note')
      })
      await React.act(async () => {
        const sel = div.querySelector('.marge-search select') as HTMLSelectElement
        Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(sel, 'annots')
        sel.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await until(
        React,
        () => {
          const m = div.querySelector('.marge-search .marge-muted')
          return !!m && m.textContent === '1/1'
        },
        4000
      )
    } finally {
      root.unmount()
      div.remove()
    }
  })
})
