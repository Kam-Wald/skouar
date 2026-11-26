const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export const crc32 = (data: Uint8Array): number => {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const te = new TextEncoder()
const td = new TextDecoder()

const deflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  const CS = (globalThis as unknown as { CompressionStream?: new (f: string) => { readable: ReadableStream; writable: WritableStream } }).CompressionStream
  if (!CS) return data
  const cs = new CS('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const inflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => { readable: ReadableStream; writable: WritableStream } }).DecompressionStream
  if (!DS) return data
  const ds = new DS('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

export async function zipFiles(entries: { name: string; data: string | Uint8Array }[]): Promise<Blob> {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const push = (u8: Uint8Array): void => {
    parts.push(u8)
    offset += u8.length
  }
  const u16 = (v: number): Uint8Array => new Uint8Array([v & 0xff, (v >> 8) & 0xff])
  const u32 = (v: number): Uint8Array => new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff])
  for (const e of entries) {
    const nameB = te.encode(e.name)
    const raw = typeof e.data === 'string' ? te.encode(e.data) : e.data
    const crc = crc32(raw)
    const comp = await deflateRaw(raw)
    const useDeflate = comp.length < raw.length && (globalThis as unknown as { CompressionStream?: unknown }).CompressionStream
    const method = useDeflate ? 8 : 0
    const payload = useDeflate ? comp : raw
    const local = new Uint8Array(30 + nameB.length)
    const dv = new DataView(local.buffer)
    dv.setUint32(0, 0x04034b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 0, true)
    dv.setUint16(8, method, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, 0, true)
    dv.setUint32(14, crc, true)
    dv.setUint32(18, payload.length, true)
    dv.setUint32(22, raw.length, true)
    dv.setUint16(26, nameB.length, true)
    dv.setUint16(28, 0, true)
    local.set(nameB, 30)
    push(local)
    push(payload)
    const cen = new Uint8Array(46 + nameB.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, method, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, payload.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameB.length, true)
    cv.setUint32(42, offset - 30 - nameB.length - payload.length, true)
    cen.set(nameB, 46)
    central.push(cen)
  }
  const cdStart = offset
  let cdSize = 0
  for (const c of central) {
    push(c)
    cdSize += c.length
  }
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, central.length, true)
  ev.setUint16(10, central.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdStart, true)
  push(end)
  return new Blob(parts as BlobPart[])
}

export async function unzipFiles(b: Blob): Promise<ZipEntry[]> {
  const buf = new Uint8Array(await b.arrayBuffer())
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('ZIP invalide (EOCD introuvable)')
  const count = dv.getUint16(eocd + 10, true)
  let ptr = dv.getUint32(eocd + 16, true)
  const out: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) throw new Error('ZIP invalide (central)')
    const method = dv.getUint16(ptr + 10, true)
    const compSize = dv.getUint32(ptr + 20, true)
    const nameLen = dv.getUint16(ptr + 28, true)
    const extraLen = dv.getUint16(ptr + 30, true)
    const commentLen = dv.getUint16(ptr + 32, true)
    const localOff = dv.getUint32(ptr + 42, true)
    const name = td.decode(buf.subarray(ptr + 46, ptr + 46 + nameLen))
    ptr += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue
    const lNameLen = dv.getUint16(localOff + 26, true)
    const lExtraLen = dv.getUint16(localOff + 28, true)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    const comp = buf.subarray(dataStart, dataStart + compSize)
    const data = method === 8 ? await inflateRaw(comp) : comp
    out.push({ name, data })
  }
  return out
}

export const entryText = (e: ZipEntry): string => td.decode(e.data)
