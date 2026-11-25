import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = [79, 70, 229]
const FG = [255, 255, 255]

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
function encodePng(size, tileFraction, radiusFraction) {
  const m = Math.round(size * (1 - tileFraction) / 2)
  const r = Math.round(size * radiusFraction)
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = false
      const x0 = m, x1 = size - m, y0 = m, y1 = size - m
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        const cx = x < x0 + r ? x0 + r : x >= x1 - r ? x1 - r - 1 : x
        const cy = y < y0 + r ? y0 + r : y >= y1 - r ? y1 - r - 1 : y
        inside = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r
      }
      const o = (y * size + x) * 4
      const c = inside ? FG : BG
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255
    }
  }
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

writeFileSync(join(outDir, 'icon-192.png'), encodePng(192, 0.47, 0.09))
writeFileSync(join(outDir, 'icon-512.png'), encodePng(512, 0.47, 0.09))
writeFileSync(join(outDir, 'icon-512-maskable.png'), encodePng(512, 0.72, 0.14))
console.log('icons generated in public/icons')
