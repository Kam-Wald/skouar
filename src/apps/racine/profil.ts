import { uid } from '../../shared/db'
import { saveAttachment, type Attachment } from './store'

export const MAX_ATTACHMENT = 8 * 1024 * 1024

export function validateAttachment(f: { name: string; size: number }): string | null {
  if (f.size > MAX_ATTACHMENT) return `Pièce jointe trop lourde (max 8 Mo) : ${f.name}`
  return null
}

export async function resizeImage(file: File, maxW = 1400, quality = 0.82): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== 'function') return file
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxW / bmp.width)
    if (scale >= 1) {
      bmp.close?.()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close?.()
      return file
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.()
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob a échoué'))), 'image/jpeg', quality)
    )
  } catch {
    return file
  }
}

export async function addAttachment(file: File, eventId: string | null): Promise<{ ok: true; a: Attachment } | { ok: false; error: string }> {
  const err = validateAttachment(file)
  if (err) return { ok: false, error: err }
  const blob = file.type.startsWith('image/') ? await resizeImage(file) : file
  const a: Attachment = {
    id: uid(),
    name: file.name,
    mime: blob.type || file.type || 'application/octet-stream',
    size: blob.size,
    blob,
    eventId,
    createdAt: Date.now()
  }
  await saveAttachment(a)
  return { ok: true, a }
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} Mo`
}

export function attachmentUrl(a: Attachment): string | null {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') return URL.createObjectURL(a.blob)
  return null
}

export async function quotaWarning(): Promise<string | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (est?.quota && est.usage) {
      const ratio = est.usage / est.quota
      if (ratio > 0.8) return `Stockage utilisé à ${Math.round(ratio * 100)} % — pense à exporter tes données (⚙️ → Racine).`
    }
  } catch {
    // storage API indisponible
  }
  return null
}
