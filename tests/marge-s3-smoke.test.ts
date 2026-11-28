// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

vi.mock('../src/apps/marge/pdf', () => ({
  CMAPS_URL: '',
  FONTS_URL: '',
  loadDoc: async () => ({
    numPages: 10,
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
  const { docsT, annotsT, pageNotesT, foldersT } = await import('../src/apps/marge/store')
  await docsT.clear()
  await annotsT.clear()
  await pageNotesT.clear()
  await foldersT.clear()
})

const setFiles = (input: HTMLInputElement, files: File[]): void => {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const setVal = (el: HTMLInputElement, v: string): void => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const setSelect = (el: HTMLSelectElement, v: string): void => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const flush = () => new Promise((r) => setTimeout(r, 60))

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
const btnByText = (div: HTMLElement, text: string) =>
  Array.from(div.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const folderByName = (div: HTMLElement, name: string) =>
  Array.from(div.querySelectorAll('.marge-folder')).find((el) => el.textContent?.includes(name)) as HTMLElement

describe('Marge S3 — dossiers, tri/recherche, duplication, progression (smoke jsdom)', () => {
  it('dossier : création, déplacement par drag&drop, filtre, suppression non destructive', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('a.pdf'), await makePdfFile('b.pdf')])
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(2)

    await React.act(async () => {
      btnByText(div, 'Nouveau dossier').click()
    })
    const popInput = div.querySelector('.marge-folder-pop input') as HTMLInputElement
    expect(popInput).toBeTruthy()
    await React.act(async () => {
      setVal(popInput, 'Pro')
      btnByText(div, 'Créer').click()
      await flush()
    })
    const pro = folderByName(div, 'Pro')
    expect(pro).toBeTruthy()
    expect(pro.textContent).toContain('0')

    const cards = div.querySelectorAll('.marge-card')
    await React.act(async () => {
      cards[0].dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }))
      await flush()
    })
    await React.act(async () => {
      folderByName(div, 'Pro').dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
      await flush()
    })
    expect(folderByName(div, 'Pro').textContent).toContain('1')

    await React.act(async () => {
      folderByName(div, 'Pro').click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(1)

    await React.act(async () => {
      btnByText(div, 'Sans dossier').click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(1)

    await React.act(async () => {
      ;(folderByName(div, 'Pro').querySelector('.marge-folder-del') as HTMLButtonElement).click()
      await flush()
    })
    expect(folderByName(div, 'Pro')).toBeUndefined()
    await React.act(async () => {
      btnByText(div, 'Sans dossier').click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(2)
    root.unmount()
    div.remove()
  })

  it('recherche par nom + tri date/titre', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('alpha.pdf'), await makePdfFile('zeta.pdf')])
      await flush()
    })
    const { listDocs, updateDoc } = await import('../src/apps/marge/store')
    const docs = await listDocs()
    const alpha = docs.find((d) => d.title === 'alpha')!
    const zeta = docs.find((d) => d.title === 'zeta')!
    await updateDoc(alpha.id, { updatedAt: 1000 })
    await updateDoc(zeta.id, { updatedAt: 2000 })
    root.unmount()
    div.remove()
    const r2 = await renderApp()
    const div2 = r2.div
    const React2 = r2.React
    const search = div2.querySelector('.marge-lib-search') as HTMLInputElement
    await React2.act(async () => {
      setVal(search, 'alpha')
      await flush()
    })
    expect(div2.querySelectorAll('.marge-card').length).toBe(1)
    expect(div2.textContent).toContain('alpha')
    await React2.act(async () => {
      setVal(search, '')
      await flush()
    })
    const sort = div2.querySelector('.marge-lib-sort') as HTMLSelectElement
    const firstTitle = () => (div2.querySelector('.marge-card-body strong') as HTMLElement).textContent
    expect(firstTitle()).toBe('zeta')
    await React2.act(async () => {
      setSelect(sort, 'titre')
      await flush()
    })
    expect(firstTitle()).toBe('alpha')
    r2.root.unmount()
    div2.remove()
  })

  it('duplication : ⧉ crée « Copie de X »', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('contrat.pdf')])
      await flush()
    })
    await React.act(async () => {
      ;(div.querySelector('.marge-card-dup') as HTMLButtonElement).click()
      await flush()
    })
    expect(div.querySelectorAll('.marge-card').length).toBe(2)
    expect(div.textContent).toContain('Copie de contrat')
    root.unmount()
    div.remove()
  })

  it('barre de progression de lecture selon lastPage/pages', async () => {
    const { React, root, div } = await renderApp()
    await React.act(async () => {
      setFiles(fileInput(div), [await makePdfFile('gros.pdf')])
      await flush()
    })
    const { listDocs, updateDoc } = await import('../src/apps/marge/store')
    const [doc] = await listDocs()
    await updateDoc(doc.id, { lastPage: 5 })
    root.unmount()
    div.remove()
    const r2 = await renderApp()
    await r2.React.act(async () => {
      await flush()
    })
    const bar = r2.div.querySelector('.marge-progress > span') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.style.width).toBe('50%')
    r2.root.unmount()
    r2.div.remove()
  })
})
