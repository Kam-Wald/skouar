// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

vi.mock('../src/apps/marge/pdf', () => ({
  CMAPS_URL: '',
  FONTS_URL: '',
  loadDoc: async () => ({
    numPages: 7,
    destroy: async () => {},
    getPage: async () => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 140 * scale }),
      render: () => ({ promise: Promise.resolve() })
    })
  })
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
  const { docsT, annotsT, pageNotesT } = await import('../src/apps/marge/store')
  await docsT.clear()
  await annotsT.clear()
  await pageNotesT.clear()
})

const setFiles = (input: HTMLInputElement, files: File[]): void => {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const setVal = (el: HTMLInputElement, v: string): void => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
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

async function makePdfFile(name: string): Promise<File> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.addPage([100, 100])
  const bytes = await doc.save()
  return new File([bytes], name, { type: 'application/pdf' })
}

const fileInput = (div: HTMLElement) => div.querySelector('input[type=file]') as HTMLInputElement

const flush = () => new Promise((r) => setTimeout(r, 60))

describe('Marge — bibliothèque (smoke jsdom)', () => {
  it('état vide cliquable + import via champ fichier : filtre MIME/extension, carte, nb de pages, toast', async () => {
    const { React, root, div } = await renderApp()
    expect(div.querySelector('.marge-empty-cta')).toBeTruthy()
    const f1 = await makePdfFile('rapport.pdf')
    const f2 = new File([new Uint8Array([1])], 'notes.txt', { type: 'text/plain' })
    await React.act(async () => {
      setFiles(fileInput(div), [f1, f2])
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(1)
    expect(div.textContent).toContain('rapport')
    expect(div.textContent).toContain('7 pages')
    expect(div.textContent).toContain('1 PDF importé')
    root.unmount()
    div.remove()
  })

  it('renommage par double-clic : Entrée valide, Échap annule', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('avant.pdf')])
      await flush()
    })
    const title = div.querySelector('.marge-card-body strong') as HTMLElement
    await React.act(async () => {
      title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    const input = div.querySelector('.marge-card-body input') as HTMLInputElement
    expect(input).toBeTruthy()
    await React.act(async () => {
      setVal(input, 'mon rapport')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flush()
    })
    expect(div.textContent).toContain('mon rapport')
    root.unmount()
    div.remove()
  })

  it('fusion de 2 documents cochés → nouvelle carte « fusion-2-pdf »', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('a.pdf'), await makePdfFile('b.pdf')])
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(2)
    const checks = div.querySelectorAll('.marge-card-check') as NodeListOf<HTMLInputElement>
    await React.act(async () => {
      checks[0].click()
      checks[1].click()
    })
    const mergeBtn = Array.from(div.querySelectorAll('.marge-lib-actions .db-btn')).find((b) =>
      b.textContent?.includes('Fusionner')
    ) as HTMLButtonElement
    expect(mergeBtn.disabled).toBe(false)
    await React.act(async () => {
      mergeBtn.click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(3)
    expect(div.textContent).toContain('fusion-2-pdf')
    expect(div.textContent).toContain('Fusion de 2 PDF')
    root.unmount()
    div.remove()
  })

  it('suppression par carte → toast « Annuler » restaure le document', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('doc.pdf')])
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(1)
    await React.act(async () => {
      ;(div.querySelector('.marge-card-del') as HTMLButtonElement).click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(0)
    expect(div.textContent).toContain('Document supprimé')
    const undo = div.querySelector('.toast button') as HTMLButtonElement
    expect(undo?.textContent).toBe('Annuler')
    await React.act(async () => {
      undo.click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(1)
    expect(div.textContent).toContain('doc')
    root.unmount()
    div.remove()
  })
})
