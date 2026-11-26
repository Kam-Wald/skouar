import type { Block, Page } from './types'
import { cellDisplay } from './fields'
import { stripHtml } from './tree'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50

export interface Line {
  text: string
  size: number
  font: 1 | 2 | 3
  indent: number
  gapBefore: number
}

function sanitize(s: string): string {
  return s
    .replace(/•/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[☐☑]/g, '[ ]')
    .replace(/[^\x00-\xFF]/g, '?')
}

function escPdf(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function wrap(text: string, size: number, indent: number): string[] {
  const maxChars = Math.max(20, Math.floor((PAGE_W - 2 * MARGIN - indent * 8) / (size * 0.5)))
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  return out.length ? out : ['']
}

function pushWrapped(lines: Line[], text: string, size: number, font: 1 | 2 | 3, indent: number, gapBefore = 0): void {
  for (const l of wrap(text, size, indent)) lines.push({ text: l, size, font, indent, gapBefore })
  lines[lines.length - 1].gapBefore = gapBefore
}

function blockLines(b: Block, lines: Line[], depth: number, num: { n: number }): void {
  const ind = depth * 16
  const t = stripHtml(b.text).trim()
  switch (b.type) {
    case 'h1':
      pushWrapped(lines, t, 17, 2, ind, 12)
      break
    case 'h2':
      pushWrapped(lines, t, 14, 2, ind, 10)
      break
    case 'h3':
    case 'h4':
      pushWrapped(lines, t, 12, 2, ind, 8)
      break
    case 'bullet':
      pushWrapped(lines, '- ' + t, 11, 1, ind + 8)
      break
    case 'numbered':
      num.n += 1
      pushWrapped(lines, `${num.n}. ${t}`, 11, 1, ind + 8)
      break
    case 'todo':
      pushWrapped(lines, `${b.done ? '[x]' : '[ ]'} ${t}`, 11, 1, ind + 8)
      break
    case 'quote':
      pushWrapped(lines, '" ' + t + '"', 11, 1, ind + 8, 2)
      break
    case 'code':
      for (const l of (b.text || ' ').split('\n')) lines.push({ text: l || ' ', size: 9, font: 3, indent: ind + 8, gapBefore: 0 })
      lines.push({ text: '', size: 9, font: 3, indent: ind, gapBefore: 6 })
      break
    case 'divider':
      lines.push({ text: '------------------------------', size: 10, font: 1, indent: ind, gapBefore: 8 })
      break
    case 'callout':
      pushWrapped(lines, '> ' + t, 11, 1, ind + 8, 2)
      break
    case 'image':
      lines.push({ text: '[Image]', size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'gallery':
      lines.push({ text: `[Galerie — ${(b.srcs ?? []).length} image(s)]`, size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'video':
      lines.push({ text: '[Vidéo]', size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'audio':
      lines.push({ text: '[Audio]', size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'pdf':
      lines.push({ text: `[PDF — ${b.fileName ?? 'document'}]`, size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'file':
    case 'archive':
      lines.push({ text: `[Fichier — ${b.fileName ?? 'fichier'}]`, size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'embed':
      lines.push({ text: `[Embed — ${b.src ?? ''}]`, size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'math':
      pushWrapped(lines, 'f(x) = ' + t, 10, 3, ind + 8)
      break
    case 'progress':
      lines.push({ text: `Progression : ${b.progress ?? 0}%`, size: 10, font: 1, indent: ind, gapBefore: 2 })
      break
    case 'qr':
      lines.push({ text: `[QR code — ${t}]`, size: 10, font: 1, indent: ind, gapBefore: 4 })
      break
    case 'countdown':
      lines.push({ text: `Compte à rebours — ${b.due ?? 'pas de date'}`, size: 10, font: 1, indent: ind, gapBefore: 2 })
      break
    case 'pageembed':
      pushWrapped(lines, '-> ' + t, 11, 1, ind + 8)
      break
    case 'button':
      pushWrapped(lines, `[${t || 'Bouton'}]${b.href ? ' ' + b.href : ''}`, 11, 2, ind)
      break
    case 'toc':
      break
    case 'table': {
      for (const row of b.table ?? []) pushWrapped(lines, row.map((c) => stripHtml(c).trim()).filter(Boolean).join(' | '), 10, 1, ind + 4, 1)
      break
    }
    case 'database': {
      const db = b.db
      if (db) {
        pushWrapped(lines, t || 'Base de données', 12, 2, ind, 8)
        for (const r of db.rows) {
          const parts = db.columns
            .map((c) => `${c.name}: ${cellDisplay(r.cells[c.id])}`)
            .filter((p) => !p.endsWith(': '))
          if (parts.length) pushWrapped(lines, parts.join(' · '), 10, 1, ind + 8, 1)
        }
      }
      break
    }
    case 'toggle':
      pushWrapped(lines, t || 'Menu dépliant', 11, 2, ind, 4)
      break
    default:
      if (t) pushWrapped(lines, t, 11, 1, ind, 2)
  }
  if (b.type === 'toggle' || b.type === 'columns' || b.type === 'column') {
    for (const c of b.children ?? []) blockLines(c, lines, b.type === 'column' ? depth : depth + 1, num)
  }
}

export function buildPdf(lines: Line[]): Uint8Array {
  const pages: string[] = []
  let cur = ''
  let y = PAGE_H - MARGIN
  for (const l of lines) {
    const h = l.size + 4
    for (const w of wrap(l.text, l.size, l.indent)) {
      if (y - h < MARGIN) {
        pages.push(cur)
        cur = ''
        y = PAGE_H - MARGIN
      }
      y -= h + (l.gapBefore || 0)
      if (y < MARGIN) {
        pages.push(cur)
        cur = ''
        y = PAGE_H - MARGIN
      }
      cur += `BT /F${l.font} ${l.size} Tf 1 0 0 1 ${MARGIN + l.indent} ${y.toFixed(1)} Tm (${escPdf(sanitize(w))}) Tj ET\n`
    }
  }
  pages.push(cur)

  const nPages = pages.length
  const bodies: string[] = []
  bodies.push('<< /Type /Catalog /Pages 2 0 R >>')
  bodies.push(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${nPages} >>`
  )
  pages.forEach((content, i) => {
    const pn = 3 + i * 2
    bodies.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${3 + nPages * 2} 0 R /F2 ${4 + nPages * 2} 0 R /F3 ${5 + nPages * 2} 0 R >> >> /Contents ${pn + 1} 0 R >>`
    )
    bodies.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
  })
  bodies.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  bodies.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  bodies.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>')

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  bodies.forEach((b, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${b}\nendobj\n`
  })
  const xrefPos = out.length
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`

  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return bytes
}

export type PdfLine = Line

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPagePdf(page: Page): void {
  const title = stripHtml(page.title).trim() || 'Sans titre'
  const lines: Line[] = [
    { text: title, size: 20, font: 2, indent: 0, gapBefore: 0 },
    { text: `Calepin — Skouar · ${new Date().toLocaleDateString('fr-FR')}`, size: 9, font: 1, indent: 0, gapBefore: 4 },
    { text: '', size: 6, font: 1, indent: 0, gapBefore: 8 }
  ]
  const num = { n: 0 }
  for (const b of page.blocks) blockLines(b, lines, 0, num)
  const bytes = buildPdf(lines)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
