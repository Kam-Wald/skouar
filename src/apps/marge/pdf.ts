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

export function matchRect(vp: pdfjsLib.PageViewport, item: { transform: number[]; width: number }): [number, number, number, number] {
  const m = pdfjsLib.Util.transform(vp.transform, item.transform)
  const fh = Math.hypot(m[2], m[3])
  const w = (item.width * Math.abs(m[0])) / Math.max(1e-6, Math.abs(item.transform[0])) || item.width
  return [m[4], m[5] - fh, w, fh]
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
