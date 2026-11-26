import { cssFilter, frameGeom, layerDims, layerFont, type EditState, type Layer, type Rect } from './logic'

export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jaggedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amp: number, seed: number): void {
  const rnd = mulberry32(seed)
  const step = Math.max(5, Math.round(Math.min(w, h) / 36))
  ctx.beginPath()
  ctx.moveTo(x, y + rnd() * amp)
  for (let px = x + step; px < x + w - step / 2; px += step) ctx.lineTo(px, y + rnd() * amp)
  ctx.lineTo(x + w, y + rnd() * amp)
  for (let py = y + step; py < y + h - step / 2; py += step) ctx.lineTo(x + w - rnd() * amp, py)
  ctx.lineTo(x + w - rnd() * amp, y + h)
  for (let px = x + w - step; px > x + step / 2; px -= step) ctx.lineTo(px, y + h - rnd() * amp)
  ctx.lineTo(x, y + h - rnd() * amp)
  for (let py = y + h - step; py > y + step / 2; py -= step) ctx.lineTo(x + rnd() * amp, py)
  ctx.closePath()
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
  if (st.frame.scan) {
    octx.filter = 'none'
    octx.fillStyle = 'rgba(0,0,0,0.16)'
    for (let y = 0; y < g.ih; y += 3) octx.fillRect(0, y, g.iw, 1)
  }

  const canvas = document.createElement('canvas')
  canvas.width = g.W
  canvas.height = g.H
  const ctx = canvas.getContext('2d')!
  const tornEdge = st.frame.torn || st.frame.burnt
  const seed = (w * 733 + h * 131) >>> 0
  if (st.frame.burnt) {
    const bg = ctx.createLinearGradient(0, 0, g.W, g.H)
    bg.addColorStop(0, '#241609')
    bg.addColorStop(0.5, '#120b06')
    bg.addColorStop(1, '#2b1a0c')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.torn) {
    const bg = ctx.createLinearGradient(0, 0, 0, g.H)
    bg.addColorStop(0, '#faf7f0')
    bg.addColorStop(1, '#efe9dc')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.film) {
    ctx.fillStyle = '#141414'
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.stamp) {
    ctx.fillStyle = st.frame.stampColor
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.lace) {
    ctx.fillStyle = '#fdfbf7'
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.neon) {
    ctx.fillStyle = '#0b0b14'
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.mat) {
    ctx.fillStyle = st.frame.matColor
    ctx.fillRect(0, 0, g.W, g.H)
  } else if (st.frame.letterbox) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, g.W, g.H)
  }
  ctx.save()
  if (tornEdge) {
    jaggedRect(ctx, g.ix, g.iy, g.iw, g.ih, g.edge, seed)
    ctx.clip()
  } else if (g.circle) {
    ctx.beginPath()
    ctx.arc(g.ix + g.iw / 2, g.iy + g.ih / 2, Math.min(g.iw, g.ih) / 2, 0, Math.PI * 2)
    ctx.clip()
  } else if (g.radius > 0 && !st.frame.shadow) {
    ctx.beginPath()
    ctx.roundRect(g.ix, g.iy, g.iw, g.ih, g.radius * (g.iw / w))
    ctx.clip()
  }
  if (st.frame.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 12
    ctx.fillStyle = '#000000'
    ctx.fillRect(g.ix, g.iy, g.iw, g.ih)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }
  ctx.translate(g.ix + g.iw / 2, g.iy + g.ih / 2)
  ctx.rotate((st.rot * Math.PI) / 180)
  ctx.scale(st.flipH ? -1 : 1, st.flipV ? -1 : 1)
  ctx.drawImage(off, -g.iw / 2, -g.ih / 2)
  ctx.restore()
  if (tornEdge) {
    jaggedRect(ctx, g.ix, g.iy, g.iw, g.ih, g.edge, seed)
    if (st.frame.burnt) {
      ctx.save()
      ctx.shadowColor = 'rgba(255,122,26,0.85)'
      ctx.shadowBlur = g.edge * 1.6
      ctx.strokeStyle = 'rgba(255,140,40,0.9)'
      ctx.lineWidth = Math.max(2, g.edge * 0.22)
      ctx.stroke()
      ctx.restore()
      jaggedRect(ctx, g.ix, g.iy, g.iw, g.ih, g.edge, seed)
      ctx.strokeStyle = 'rgba(20,10,4,0.85)'
      ctx.lineWidth = Math.max(3, g.edge * 0.4)
      ctx.stroke()
    } else {
      ctx.save()
      ctx.shadowColor = 'rgba(60,45,20,0.4)'
      ctx.shadowBlur = g.edge * 0.7
      ctx.shadowOffsetY = g.edge * 0.18
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    }
  }
  if (st.frame.border || st.frame.double) {
    const bw = st.frame.borderWidth * (g.W / w)
    ctx.strokeStyle = st.frame.borderColor
    ctx.lineWidth = bw
    ctx.strokeRect(g.ix + bw / 2, g.iy + bw / 2, g.iw - bw, g.ih - bw)
    if (st.frame.double) {
      const gap = Math.max(6, Math.round(g.iw * 0.03))
      const lw = Math.max(2, bw / 2)
      ctx.lineWidth = lw
      ctx.strokeRect(g.ix + gap + lw / 2, g.iy + gap + lw / 2, g.iw - 2 * gap - lw, g.ih - 2 * gap - lw)
    }
  }
  if (st.frame.stamp || st.frame.lace || st.frame.film) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    if (st.frame.stamp) {
      for (let x = g.ix - 4; x <= g.ix + g.iw + 4; x += 10) {
        ctx.moveTo(x + 4.5, g.iy - 2)
        ctx.arc(x, g.iy - 2, 4.5, 0, Math.PI * 2)
        ctx.moveTo(x + 4.5, g.iy + g.ih + 2)
        ctx.arc(x, g.iy + g.ih + 2, 4.5, 0, Math.PI * 2)
      }
      for (let y = g.iy - 4; y <= g.iy + g.ih + 4; y += 10) {
        ctx.moveTo(g.ix - 2, y + 4.5)
        ctx.arc(g.ix - 2, y, 4.5, 0, Math.PI * 2)
        ctx.moveTo(g.ix + g.iw + 2, y + 4.5)
        ctx.arc(g.ix + g.iw + 2, y, 4.5, 0, Math.PI * 2)
      }
    }
    if (st.frame.lace) {
      const r = 6.5
      for (let x = 2; x <= g.W - 2; x += 14) {
        ctx.moveTo(x + r, 1)
        ctx.arc(x, 1, r, 0, Math.PI * 2)
        ctx.moveTo(x + r, g.H - 1)
        ctx.arc(x, g.H - 1, r, 0, Math.PI * 2)
      }
      for (let y = 2; y <= g.H - 2; y += 14) {
        ctx.moveTo(1, y + r)
        ctx.arc(1, y, r, 0, Math.PI * 2)
        ctx.moveTo(g.W - 1, y + r)
        ctx.arc(g.W - 1, y, r, 0, Math.PI * 2)
      }
    }
    if (st.frame.film) {
      const fm = Math.max(22, Math.round(h * 0.09))
      for (let y = g.iy + 6; y < g.iy + g.ih - 10; y += 18) {
        ctx.rect(g.ix - fm + 5, y, fm - 10, 10)
        ctx.rect(g.ix + g.iw + 5, y, fm - 10, 10)
      }
    }
    ctx.fill()
    ctx.restore()
  }
  if (st.frame.wood) {
    const bw = st.frame.borderWidth * (g.W / w)
    const grad = ctx.createLinearGradient(0, 0, g.W, g.H)
    grad.addColorStop(0, '#9c6b35')
    grad.addColorStop(0.35, '#6e4525')
    grad.addColorStop(0.65, '#b07a42')
    grad.addColorStop(1, '#5a3a1f')
    ctx.strokeStyle = grad
    ctx.lineWidth = bw
    ctx.strokeRect(g.ix + bw / 2, g.iy + bw / 2, g.iw - bw, g.ih - bw)
    if (g.iw > bw * 2 + 8 && g.ih > bw * 2 + 8) {
      ctx.strokeStyle = 'rgba(40,20,5,0.6)'
      ctx.lineWidth = 2
      ctx.strokeRect(g.ix + bw + 2, g.iy + bw + 2, g.iw - 2 * bw - 4, g.ih - 2 * bw - 4)
    }
  }
  if (st.frame.gold) {
    const bw = st.frame.borderWidth * (g.W / w)
    const grad = ctx.createLinearGradient(0, 0, g.W, g.H)
    grad.addColorStop(0, '#f6d878')
    grad.addColorStop(0.4, '#caa22f')
    grad.addColorStop(0.7, '#8a6a14')
    grad.addColorStop(1, '#e9c766')
    ctx.strokeStyle = grad
    ctx.lineWidth = bw
    ctx.strokeRect(g.ix + bw / 2, g.iy + bw / 2, g.iw - bw, g.ih - bw)
    if (st.frame.double) {
      const gap = Math.max(6, Math.round(g.iw * 0.03))
      ctx.strokeStyle = '#7a5c10'
      ctx.lineWidth = Math.max(2, bw / 3)
      ctx.strokeRect(g.ix + gap + bw / 4, g.iy + gap + bw / 4, g.iw - 2 * gap - bw / 2, g.ih - 2 * gap - bw / 2)
    }
  }
  if (st.frame.neon) {
    ctx.save()
    ctx.shadowColor = st.frame.neonColor
    ctx.shadowBlur = 18
    ctx.strokeStyle = st.frame.neonColor
    ctx.lineWidth = 3
    ctx.strokeRect(g.ix + 1.5, g.iy + 1.5, g.iw - 3, g.ih - 3)
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 7
    ctx.strokeRect(g.ix + 3.5, g.iy + 3.5, g.iw - 7, g.ih - 7)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 1
    ctx.strokeRect(g.ix + 1.5, g.iy + 1.5, g.iw - 3, g.ih - 3)
  }
  if (st.frame.sketch) {
    const amp = Math.max(4, Math.round(Math.min(w, h) * 0.012))
    ctx.strokeStyle = st.frame.borderColor
    ctx.lineWidth = 3
    jaggedRect(ctx, g.ix, g.iy, g.iw, g.ih, amp, seed)
    ctx.stroke()
    ctx.globalAlpha = 0.75
    ctx.lineWidth = 1.6
    jaggedRect(ctx, g.ix + 1.5, g.iy + 1.5, g.iw - 3, g.ih - 3, amp, seed + 7)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (st.frame.corners) {
    const cs = Math.max(26, Math.round(Math.min(g.iw, g.ih) * 0.09))
    ctx.fillStyle = st.frame.cornerColor
    ctx.beginPath()
    ctx.moveTo(g.ix, g.iy)
    ctx.lineTo(g.ix + cs, g.iy)
    ctx.lineTo(g.ix, g.iy + cs)
    ctx.moveTo(g.ix + g.iw, g.iy)
    ctx.lineTo(g.ix + g.iw - cs, g.iy)
    ctx.lineTo(g.ix + g.iw, g.iy + cs)
    ctx.moveTo(g.ix, g.iy + g.ih)
    ctx.lineTo(g.ix + cs, g.iy + g.ih)
    ctx.lineTo(g.ix, g.iy + g.ih - cs)
    ctx.moveTo(g.ix + g.iw, g.iy + g.ih)
    ctx.lineTo(g.ix + g.iw - cs, g.iy + g.ih)
    ctx.lineTo(g.ix + g.iw, g.iy + g.ih - cs)
    ctx.fill()
  }
  if (st.frame.tape) {
    ctx.save()
    ctx.fillStyle = 'rgba(250,240,190,0.72)'
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 2
    const pts: [number, number, number][] = [
      [g.ix, g.iy, -0.6],
      [g.ix + g.iw, g.iy, 0.6],
      [g.ix, g.iy + g.ih, 0.6],
      [g.ix + g.iw, g.iy + g.ih, -0.6]
    ]
    for (const [cx, cy, rot] of pts) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.fillRect(-32, -11, 64, 22)
      ctx.restore()
    }
    ctx.restore()
  }
  if (st.frame.splatter) {
    const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0)
    ctx.fillStyle = st.frame.splatColor
    for (let i = 0; i < 18; i++) {
      const c = Math.floor(rnd() * 4)
      const cx = c % 2 === 0 ? g.ix : g.ix + g.iw
      const cy = c < 2 ? g.iy : g.iy + g.ih
      const px = cx + (rnd() * 64 - 32)
      const py = cy + (rnd() * 64 - 32)
      ctx.globalAlpha = 0.55 + rnd() * 0.4
      ctx.beginPath()
      ctx.arc(px, py, 1.5 + rnd() * 5.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
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
