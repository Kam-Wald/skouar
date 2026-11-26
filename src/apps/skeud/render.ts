import { cssFilter, frameGeom, layerDims, layerFont, type EditState, type Layer, type Rect } from './logic'

export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
}

function unsharp(canvas: HTMLCanvasElement, amount: number): void {
  const w = canvas.width
  const h = canvas.height
  if (w * h > 12_000_000) return
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, w, h)
  const src = img.data
  const out = new Uint8ClampedArray(src)
  const a = Math.min(1, amount)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = src[i + c]
        const neighbors = src[i - 4 + c] + src[i + 4 + c] + src[i - w * 4 + c] + src[i + w * 4 + c]
        out[i + c] = center + a * (center - neighbors / 4)
      }
    }
  }
  img.data.set(out)
  ctx.putImageData(img, 0, 0)
}

function drawTextLayer(ctx: CanvasRenderingContext2D, l: Extract<Layer, { kind: 'text' }>, g: { ix: number; iy: number; iw: number; ih: number }): void {
  const px = l.size * g.iw
  ctx.font = layerFont(l, px)
  const lines = l.text.split('\n')
  const lineH = px * l.lineHeight
  const blockW = Math.max(1, ...lines.map((ln) => ctx.measureText(ln).width))
  const blockH = lines.length * lineH
  const bx = g.ix + l.x * g.iw
  const by = g.iy + l.y * g.ih
  const pad = px * 0.25
  if (l.bgOpacity > 0) {
    ctx.save()
    ctx.globalAlpha = l.bgOpacity
    ctx.fillStyle = l.bg
    ctx.fillRect(bx - pad, by - pad, blockW + pad * 2, blockH + pad * 2)
    ctx.restore()
  }
  ctx.fillStyle = l.color
  ctx.textBaseline = 'top'
  ctx.textAlign = l.align === 'center' ? 'center' : l.align === 'right' ? 'right' : 'left'
  const tx = l.align === 'center' ? bx + blockW / 2 : l.align === 'right' ? bx + blockW : bx
  lines.forEach((ln, i) => ctx.fillText(ln, tx, by + i * lineH))
}

function drawStickerLayer(ctx: CanvasRenderingContext2D, l: Extract<Layer, { kind: 'sticker' }>, g: { ix: number; iy: number; iw: number; ih: number }): void {
  const px = l.size * g.iw
  ctx.font = `${Math.round(px)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(l.emoji, g.ix + l.x * g.iw, g.iy + l.y * g.ih)
}

export function renderEdit(bmp: ImageBitmap, st: EditState, maxW = 0): HTMLCanvasElement {
  const imgW = bmp.width
  const imgH = bmp.height
  const crop: Rect = st.crop ?? { x: 0, y: 0, w: imgW, h: imgH }
  const swapped = st.rot === 90 || st.rot === 270
  let w = swapped ? crop.h : crop.w
  let h = swapped ? crop.w : crop.h
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

  const off = document.createElement('canvas')
  off.width = g.iw
  off.height = g.ih
  const octx = off.getContext('2d')!
  octx.filter = cssFilter(st.filter)
  octx.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, 0, g.iw, g.ih)
  if (st.filter.sharpen > 0) unsharp(off, st.filter.sharpen)

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
  ctx.translate(g.ix + g.iw / 2, g.iy + g.ih / 2)
  ctx.rotate((st.rot * Math.PI) / 180)
  ctx.scale(st.flipH ? -1 : 1, st.flipV ? -1 : 1)
  ctx.drawImage(off, -g.iw / 2, -g.ih / 2)
  ctx.restore()
  if (st.frame.border) {
    const bw = st.frame.borderWidth * (g.W / w)
    ctx.strokeStyle = st.frame.borderColor
    ctx.lineWidth = bw
    ctx.strokeRect(g.ix + bw / 2, g.iy + bw / 2, g.iw - bw, g.ih - bw)
  }
  for (const l of st.layers) {
    if (l.kind === 'text') drawTextLayer(ctx, l, g)
    else drawStickerLayer(ctx, l, g)
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

export function measureLayer(l: Layer, iw: number): { w: number; h: number } {
  const c = document.createElement('canvas').getContext('2d')!
  return layerDims(l, iw, (text, px, font) => {
    c.font = font
    return c.measureText(text).width
  })
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
