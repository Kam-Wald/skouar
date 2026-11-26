import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const varDir = join(outDir, 'variants')
mkdirSync(varDir, { recursive: true })

const BG = [250, 250, 250]
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function makeCanvas(size) {
  const px = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255
  }
  return px
}
function setPx(px, size, x, y, c) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const o = (y * size + x) * 4
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3] ?? 255
}
function fillRoundedRect(px, size, x0, y0, x1, y1, r, c) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const cx = x < x0 + r ? x0 + r : x >= x1 - r ? x1 - r - 1 : x
      const cy = y < y0 + r ? y0 + r : y >= y1 - r ? y1 - r - 1 : y
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) setPx(px, size, x, y, c)
    }
  }
}
function fillCircle(px, size, cx, cy, r, c) {
  for (let y = cy - r; y < cy + r; y++)
    for (let x = cx - r; x < cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) setPx(px, size, x, y, c)
}
function fillCapsule(px, size, cx, cy, w, h, ang, c) {
  const rad = (ang * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const reach = Math.ceil(Math.hypot(w, h) / 2) + 1
  const r = w / 2
  const ah = w / 2, bh = h / 2
  for (let y = cy - reach; y <= cy + reach; y++) {
    for (let x = cx - reach; x <= cx + reach; x++) {
      const dx = x - cx, dy = y - cy
      const lx = Math.abs(dx * cos + dy * sin)
      const ly = Math.abs(-dx * sin + dy * cos)
      const qx = lx - (ah - r), qy = ly - (bh - r)
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
      if (d <= 0) setPx(px, size, x, y, c)
    }
  }
}
function encodePng(size, px) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const WHITE = [255, 255, 255]
const TEAL = [13, 148, 136]
const TEAL_L = [160, 216, 216]
const TEAL_D = [26, 95, 95]
const L1 = [165, 220, 216]
const L2 = [120, 200, 196]

function variant(size, v) {
  const px = makeCanvas(size)
  const m = Math.round(size * 0.22)
  if (v === 1) {
    fillRoundedRect(px, size, m, m, size - m, size - m, Math.round(size * 0.08), TEAL)
  } else if (v === 2) {
    const u = size / 512
    const R = Math.round
    fillCapsule(px, size, R(222*u), R(155*u), R(58*u), R(200*u), -12, TEAL)
    fillCapsule(px, size, R(290*u), R(155*u), R(58*u), R(200*u), 12, TEAL)
    fillCapsule(px, size, R(222*u), R(155*u), R(26*u), R(146*u), -12, TEAL_L)
    fillCapsule(px, size, R(290*u), R(155*u), R(26*u), R(146*u), 12, TEAL_L)
    fillCircle(px, size, R(256*u), R(348*u), R(110*u), TEAL)
    fillCircle(px, size, R(220*u), R(346*u), R(16*u), TEAL_L)
    fillCircle(px, size, R(294*u), R(384*u), R(10*u), TEAL_D)
  } else if (v === 3) {
    const s = Math.round(size * 0.42)
    const r = Math.round(size * 0.07)
    fillRoundedRect(px, size, size - m - s, m, size - m, m + s, r, L1)
    fillRoundedRect(px, size, size - m - s - Math.round(size * 0.06), m + Math.round(size * 0.06), size - m - Math.round(size * 0.06), m + s + Math.round(size * 0.06), r, L2)
    fillRoundedRect(px, size, m, size - m - s, m + s, size - m, r, TEAL)
  } else {
    const u = size / 512
    const R = Math.round
    fillCapsule(px, size, R(222*u), R(155*u), R(58*u), R(200*u), -12, TEAL)
    fillCapsule(px, size, R(290*u), R(155*u), R(58*u), R(200*u), 12, TEAL)
    fillCapsule(px, size, R(222*u), R(155*u), R(26*u), R(146*u), -12, TEAL_L)
    fillCapsule(px, size, R(290*u), R(155*u), R(26*u), R(146*u), 12, TEAL_L)
    fillCircle(px, size, R(256*u), R(348*u), R(110*u), TEAL)
    fillCircle(px, size, R(220*u), R(346*u), R(16*u), TEAL_L)
    fillCircle(px, size, R(294*u), R(384*u), R(10*u), TEAL_D)
  }
  return px
}

for (const v of [1, 2, 3, 4]) {
  writeFileSync(join(varDir, `v${v}.png`), encodePng(512, variant(512, v)))
}
writeFileSync(join(outDir, 'icon-192.png'), encodePng(192, variant(192, 2)))
writeFileSync(join(outDir, 'icon-512.png'), encodePng(512, variant(512, 2)))
writeFileSync(join(outDir, 'icon-512-maskable.png'), encodePng(512, variant(512, 2)))
console.log('icons v1-v4 variants + default v2 (lapin teal) generated')
