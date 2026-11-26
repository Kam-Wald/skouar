import { deflateSync, inflateSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const varDir = join(outDir, 'variants')
mkdirSync(varDir, { recursive: true })

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
function decodePng(buf) {
  let pos = 8, w = 0, h = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4) }
    if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * 4 + 1
  const px = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) raw.copy(px, y * w * 4, y * stride + 1, (y + 1) * stride)
  return { w, h, px }
}
function resize(src, size) {
  const { w, h, px } = src
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) * w / size - 0.5
      const fy = (y + 0.5) * h / size - 0.5
      const x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy))
      const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
      const ax = fx - x0, ay = fy - y0
      const o = (y * size + x) * 4
      for (let c = 0; c < 4; c++) {
        const v =
          px[(y0 * w + x0) * 4 + c] * (1 - ax) * (1 - ay) +
          px[(y0 * w + x1) * 4 + c] * ax * (1 - ay) +
          px[(y1 * w + x0) * 4 + c] * (1 - ax) * ay +
          px[(y1 * w + x1) * 4 + c] * ax * ay
        out[o + c] = Math.round(v)
      }
    }
  }
  return out
}

const src = decodePng(readFileSync(join(root, 'public', 'logo-source.png')))
const r512 = resize(src, 512)
writeFileSync(join(outDir, 'icon-512.png'), encodePng(512, r512))
const side = Math.round(512 * 0.78)
const small = resize(src, side)
const mask = Buffer.alloc(512 * 512 * 4)
for (let i = 0; i < 512 * 512; i++) {
  mask[i * 4] = 255; mask[i * 4 + 1] = 255; mask[i * 4 + 2] = 255; mask[i * 4 + 3] = 255
}
const ox = Math.round((512 - side) / 2)
for (let y = 0; y < side; y++)
  small.copy(mask, ((ox + y * 512) * 4), y * side * 4, (y + 1) * side * 4)
writeFileSync(join(outDir, 'icon-512-maskable.png'), encodePng(512, mask))
writeFileSync(join(outDir, 'icon-192.png'), encodePng(192, resize(src, 192)))
writeFileSync(join(varDir, 'v1.png'), encodePng(384, resize(src, 384)))
writeFileSync(join(varDir, 'v2.png'), encodePng(512, r512))
writeFileSync(join(varDir, 'v3.png'), encodePng(256, resize(src, 256)))
writeFileSync(join(varDir, 'v4.png'), encodePng(512, r512))
console.log('icons générés depuis public/logo-source.png (visuel 18 embarqué tel quel)')
