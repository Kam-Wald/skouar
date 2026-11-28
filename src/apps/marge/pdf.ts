import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const BASE = import.meta.env.BASE_URL
export const CMAPS_URL = `${BASE}pdfjs/cmaps/`
export const FONTS_URL = `${BASE}pdfjs/standard_fonts/`

export async function loadDoc(buf: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data: new Uint8Array(buf.slice(0)),
    cMapUrl: CMAPS_URL,
    cMapPacked: true,
    standardFontDataUrl: FONTS_URL
  }).promise
}

export async function renderTextLayer(
  page: pdfjsLib.PDFPageProxy,
  container: HTMLElement,
  viewport: pdfjsLib.PageViewport
): Promise<void> {
  const layer = new pdfjsLib.TextLayer({
    textContentSource: page.streamTextContent(),
    container,
    viewport
  })
  await layer.render()
}
