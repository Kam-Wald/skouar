import { cssFilter, frameGeom, outDims, type EditState, type Rect } from './logic'

export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
}

export function renderEdit(bmp: ImageBitmap, st: EditState, maxW = 0): HTMLCanvasElement {
  const imgW = bmp.width
  const imgH = bmp.height
  const crop: Rect = st.crop ?? { x: 0, y: 0, w: imgW, h: imgH }
  const cw = crop.w
  const ch = crop.h
  const swapped = st.rot === 90 || st.rot === 270
  let w = swapped ? ch : cw
  let h = swapped ? cw : ch
  if (st.size) {
    const s = st.size.w / w
    w = Math.max(1, st.size.w)
    h = Math.max(1, Math.round(h * s))
  }
  if (maxW > 0 && w > maxW) {
    const s = maxW / w
    w = maxW
    h = Math.round(h * s)
  }
  const g = frameGeom(w, h, st.frame)
  const canvas = document.createElement('canvas')
  canvas.width = g.W
  canvas.height = g.H
  const ctx = canvas.getContext('2d')!
  if (st.frame.mat) {
    ctx.fillStyle = st.frame.matColor
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.letterbox) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, g.W, g.H)
  }
  ctx.save()
  if (g.circle) {
    ctx.beginPath()
    ctx.arc(g.ix + g.iw / 2, g.iy + g.ih / 2, Math.min(g.iw, g.ih) / 2, 0, Math.PI * 2)
    ctx.clip()
  } else if (g.radius > 0) {
    ctx.beginPath()
    ctx.roundRect(g.ix, g.iy, g.iw, g.ih, g.radius * (g.iw / w))
    ctx.clip()
  }
  ctx.filter = cssFilter(st.filter)
  ctx.translate(g.ix + g.iw / 2, g.iy + g.ih / 2)
  ctx.rotate((st.rot * Math.PI) / 180)
  ctx.scale(st.flipH ? -1 : 1, st.flipV ? -1 : 1)
  ctx.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, -g.iw / 2, -g.ih / 2, g.iw, g.ih)
  ctx.restore()
  if (st.frame.border) {
    const bw = st.frame.borderWidth * (g.W / w)
    ctx.strokeStyle = st.frame.borderColor
    ctx.lineWidth = bw
    ctx.strokeRect(g.ix + bw / 2, g.iy + bw / 2, g.iw - bw, g.ih - bw)
  }
  if (g.vig > 0) {
    const grad = ctx.createRadialGradient(g.W / 2, g.H / 2, Math.min(g.W, g.H) * 0.35, g.W / 2, g.H / 2, Math.max(g.W, g.H) * 0.75)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(0,0,0,${g.vig})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, g.W, g.H)
  }
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), type, quality))
}

export async function downloadBlob(blob: Blob, name: string): Promise<void> {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export function fitScale(imgW: number, imgH: number, maxW: number, maxH: number): number {
  return Math.min(1, maxW / imgW, maxH / imgH)
}
