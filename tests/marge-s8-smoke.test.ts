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
  const { addDoc, uid, putSignature } = await import('../src/apps/marge/store')
  await addDoc({ id: uid(), title: 'doc.pdf', data: new Blob([bytes], { type: 'application/pdf' }), pages: 5, updatedAt: Date.now() })
  await putSignature({ id: 'sig1', name: 'Camille', dataUrl: 'data:sig1', at: 1 })
  await putSignature({ id: 'sig2', name: 'Camille pro', dataUrl: 'data:sig2', at: 2 })
}

const overlayOf = (div: HTMLElement, p: number) => div.querySelector(`.marge-page[data-page="${p}"] .marge-overlay`) as HTMLElement
const mouse = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
const key = async (React: any, k: string, opts: Record<string, boolean> = {}) => {
  await React.act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }))
  })
}
const setSelect = (sel: HTMLSelectElement, v: string): void => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(sel, v)
  sel.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('Marge S8 — carnet de signatures (smoke jsdom)', () => {
  it('liste nommée + active, pose au clic à la taille choisie (persistée), suppression, indice si aucune, pad présent', async () => {
    await seedDoc()
    const { React, root, div } = await renderApp()
    try {
      await React.act(async () => {
        ;(div.querySelector('.marge-card') as HTMLElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-page').length === 5)
      const { listAnnots, listSignatures, listDocs } = await import('../src/apps/marge/store')
      const docId = (await listDocs())[0].id

      // 1. carnet : 2 signatures, la première est active par défaut
      await until(React, () => div.querySelectorAll('.marge-sign-row').length === 2)
      const rows = () => Array.from(div.querySelectorAll('.marge-sign-row')) as HTMLElement[]
      expect(rows()[0].className).toContain('on')
      expect(rows()[0].textContent).toContain('Camille')
      expect(rows()[1].textContent).toContain('Camille pro')

      // 2. pose au clic (touche 9) page 1 → taille M par défaut (160×64), signature active = sig1
      await key(React, '9')
      await React.act(async () => {
        mouse(overlayOf(div, 1), 'mousedown', 50, 50)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 1)
      let annots = await listAnnots(docId)
      expect(annots[0]).toMatchObject({ type: 'sign', page: 1, w: 160, h: 64, dataUrl: 'data:sig1' })

      // 3. taille L (index 2) persistée → pose page 2 en 240×96
      await React.act(async () => {
        setSelect(div.querySelector('.marge-signsize-sel') as HTMLSelectElement, '2')
      })
      expect(localStorage.getItem('skouar:marge:signsize')).toBe('2')
      await React.act(async () => {
        mouse(overlayOf(div, 2), 'mousedown', 30, 30)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 2)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.page === 2)).toMatchObject({ type: 'sign', w: 240, h: 96, dataUrl: 'data:sig1' })

      // 4. bascule sur la 2e signature → pose page 3 avec data:sig2
      await React.act(async () => {
        rows()[1].click()
      })
      expect(localStorage.getItem('skouar:marge:sign')).toBe('sig2')
      expect(rows()[1].className).toContain('on')
      await React.act(async () => {
        mouse(overlayOf(div, 3), 'mousedown', 40, 40)
      })
      await until(React, () => div.querySelectorAll('.marge-annot-row').length === 3)
      annots = await listAnnots(docId)
      expect(annots.find((a) => a.page === 3)?.dataUrl).toBe('data:sig2')

      // 5. suppression d'une signature depuis le carnet
      await React.act(async () => {
        ;(rows()[0].querySelector('.marge-annot-del') as HTMLButtonElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-sign-row').length === 1)
      expect((await listSignatures()).map((s) => s.id)).toEqual(['sig2'])

      // 6. plus de signature active après suppression de la dernière → indice au lieu de la pose
      await React.act(async () => {
        ;(rows()[0].querySelector('.marge-annot-del') as HTMLButtonElement).click()
      })
      await until(React, () => div.querySelectorAll('.marge-sign-row').length === 0)
      await React.act(async () => {
        mouse(overlayOf(div, 1), 'mousedown', 60, 60)
      })
      await until(React, () => !!div.querySelector('.marge-hint'))
      expect(div.querySelector('.marge-hint')?.textContent).toContain('signature')
      expect((await listAnnots(docId)).length).toBe(3)

      // 7. pad de dessin présent, Enregistrer désactivé tant que rien n'est tracé
      expect(!!div.querySelector('.marge-signpad-cv')).toBe(true)
      const saveBtn = Array.from(div.querySelectorAll('.marge-signpad button')).find((b) => b.textContent === 'Enregistrer') as HTMLButtonElement
      expect(saveBtn.disabled).toBe(true)
      await settle(React, 50)
    } finally {
      root.unmount()
      div.remove()
    }
  })
})
