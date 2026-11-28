import { uid } from '../../shared/db'
import { db, type Category, type Sheet, type SheetValues } from './store'

export type SortKey = 'note' | 'date' | 'titre' | 'fav'

export function validateSheet(cat: Category, title: string, note: number, values: SheetValues): string | null {
  if (!title.trim()) return 'Le titre est obligatoire'
  if (!isFinite(note) || note < 0 || note > 10) return 'La note doit être entre 0 et 10'
  for (const f of cat.fields) {
    const v = values[f.id]
    if (f.required && (v === undefined || v === null || v === '')) return `Le champ « ${f.label} » est obligatoire`
    if (v !== undefined && v !== null && v !== '' && f.type === 'liste' && f.options && f.options.length > 0 && !f.options.includes(String(v))) {
      return `« ${f.label} » doit être parmi : ${f.options.join(', ')}`
    }
  }
  return null
}

export function makeSheet(
  catId: string,
  title: string,
  note: number,
  values: SheetValues,
  comment: string,
  fav: boolean,
  image: Blob | null
): Sheet {
  const now = Date.now()
  return {
    id: uid(),
    categoryId: catId,
    title: title.trim(),
    note,
    notes: [{ value: note, date: now }],
    fav,
    comment,
    image,
    values,
    createdAt: now,
    updatedAt: now
  }
}

export async function saveSheet(s: Sheet): Promise<void> {
  s.updatedAt = Date.now()
  await db.table<Sheet, string>('sheets').put(s)
}

export async function deleteSheet(id: string): Promise<void> {
  await db.table<Sheet, string>('sheets').delete(id)
}

export function addNote(s: Sheet, value: number, date = Date.now()): Sheet {
  return { ...s, note: value, notes: [...s.notes, { value, date }], updatedAt: date }
}

export function sortSheets(sheets: Sheet[], key: SortKey): Sheet[] {
  const arr = [...sheets]
  if (key === 'note') arr.sort((a, b) => b.note - a.note || b.createdAt - a.createdAt)
  else if (key === 'date') arr.sort((a, b) => b.createdAt - a.createdAt)
  else if (key === 'titre') arr.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  else arr.sort((a, b) => Number(b.fav) - Number(a.fav) || b.note - a.note)
  return arr
}

export function searchSheets(sheets: Sheet[], q: string): Sheet[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return sheets
  return sheets.filter((s) => `${s.title} ${s.comment}`.toLowerCase().includes(needle))
}

export function fmtNote(n: number): string {
  return `${String(n).replace('.', ',')}/10`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR')
}

export function imageUrl(b: Blob | null): string | null {
  if (!b) return null
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') return URL.createObjectURL(b)
  return null
}

export async function resizeImage(file: File, maxW = 400, quality = 0.82): Promise<Blob> {
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

export async function quotaWarning(): Promise<string | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (est?.quota && est.usage) {
      const ratio = est.usage / est.quota
      if (ratio > 0.8) return `Stockage utilisé à ${Math.round(ratio * 100)} % — pense à exporter tes données (⚙️ Réglages).`
    }
  } catch {
    // storage API indisponible
  }
  return null
}
