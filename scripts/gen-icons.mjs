import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const varDir = join(outDir, 'variants')
mkdirSync(varDir, { recursive: true })

const BG = [79, 70, 229]
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
const L1 = [199, 210, 254]
const L2 = [165, 180, 252]

function variant(size, v) {
  const px = makeCanvas(size)
  const m = Math.round(size * 0.22)
  if (v === 1) {
    fillRoundedRect(px, size, m, m, size - m, size - m, Math.round(size * 0.08), WHITE)
  } else if (v === 2) {
    const bw = size - 2 * m
    for (let i = 0; i < 3; i++) {
      const y0 = m + i * Math.round(size * 0.155)
      fillRoundedRect(px, size, m, y0, m + bw, y0 + Math.round(size * 0.1), Math.round(size * 0.03), i === 2 ? WHITE : L1)
    }
  } else if (v === 3) {
    const s = Math.round(size * 0.42)
    const r = Math.round(size * 0.07)
    fillRoundedRect(px, size, size - m - s, m, size - m, m + s, r, L1)
    fillRoundedRect(px, size, size - m - s - Math.round(size * 0.06), m + Math.round(size * 0.06), size - m - Math.round(size * 0.06), m + s + Math.round(size * 0.06), r, L2)
    fillRoundedRect(px, size, m, size - m - s, m + s, size - m, r, WHITE)
  } else {
    const s = Math.round(size * 0.4)
    const r = Math.round(size * 0.08)
    fillCircle(px, size, Math.round(size * 0.38), Math.round(size * 0.26), Math.round(size * 0.075), WHITE)
    fillCircle(px, size, Math.round(size * 0.62), Math.round(size * 0.26), Math.round(size * 0.075), WHITE)
    fillRoundedRect(px, size, size / 2 - s / 2, size / 2 - s / 2 + Math.round(size * 0.08), size / 2 + s / 2, size / 2 + s / 2 + Math.round(size * 0.08), r, WHITE)
  }
  return px
}

for (const v of [1, 2, 3, 4]) {
  writeFileSync(join(varDir, `v${v}.png`), encodePng(512, variant(512, v)))
}
writeFileSync(join(outDir, 'icon-192.png'), encodePng(192, variant(192, 2)))
writeFileSync(join(outDir, 'icon-512.png'), encodePng(512, variant(512, 2)))
writeFileSync(join(outDir, 'icon-512-maskable.png'), encodePng(512, variant(512, 2)))
console.log('icons v1-v4 variants + default v2 generated')
