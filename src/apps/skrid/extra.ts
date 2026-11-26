import { stripHtml } from '../blocs/tree'
import { ficheTypeOf, type SkridDoc } from './store'

const escF = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function ficheHtml(d: SkridDoc): string {
  const ft = ficheTypeOf(d)
  const rows = ft.fields
    .map((f) => `<tr><th>${escF(f)}</th><td>${escF(d.fields?.[f] ?? '') || '<br>'}</td></tr>`)
    .join('')
  return `<h2>${ft.icon} ${escF(d.title.trim() || 'Sans titre')}</h2><p><em>${escF(ft.label)}</em></p><table class="skrid-table"><tbody>${rows}</tbody></table>`
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function streakOf(daily: Record<string, number>): number {
  let n = 0
  const cur = new Date()
  if (!((daily[todayKey(cur)] ?? 0) > 0)) cur.setDate(cur.getDate() - 1)
  for (;;) {
    if ((daily[todayKey(cur)] ?? 0) > 0) {
      n++
      cur.setDate(cur.getDate() - 1)
    } else break
  }
  return n
}

export function lastNDays(daily: Record<string, number>, n: number): { key: string; day: string; full: string; words: number }[] {
  const out: { key: string; day: string; full: string; words: number }[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = todayKey(d)
    out.push({
      key,
      day: String(d.getDate()),
      full: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      words: daily[key] ?? 0
    })
  }
  return out
}

function inlineMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  const el = node as HTMLElement
  const inner = Array.from(el.childNodes).map(inlineMd).join('')
  switch (el.tagName.toLowerCase()) {
    case 'b':
    case 'strong':
      return `**${inner}**`
    case 'i':
    case 'em':
      return `*${inner}*`
    case 's':
    case 'del':
    case 'strike':
      return `~~${inner}~~`
    case 'a':
      return `[${inner}](${el.getAttribute('href') ?? ''})`
    case 'img':
      return `![${el.getAttribute('alt') ?? ''}](${String(el.getAttribute('src') ?? '').slice(0, 96)})`
    case 'br':
      return '\n'
    default:
      return inner
  }
}

export function htmlToMarkdown(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  const blocks = Array.from(div.children).length ? Array.from(div.children) : [div]
  const out: string[] = []
  for (const el of blocks) {
    if (el.tagName === 'DIV') {
      const t = stripHtml(el.innerHTML).trim()
      if (t) out.push(t, '')
      continue
    }
    const tag = el.tagName.toLowerCase()
    const text = () => stripHtml(el.innerHTML).trim()
    if (tag === 'h1') out.push(`# ${text()}`, '')
    else if (tag === 'h2') out.push(`## ${text()}`, '')
    else if (tag === 'h3') out.push(`### ${text()}`, '')
    else if (tag === 'h4') out.push(`#### ${text()}`, '')
    else if (tag === 'blockquote') out.push(...text().split('\n').map((l) => `> ${l}`), '')
    else if (tag === 'pre') out.push('```', stripHtml(el.innerHTML), '```', '')
    else if (tag === 'hr') out.push('---', '')
    else if (tag === 'ul' || tag === 'ol') {
      Array.from(el.children).forEach((li, i) => {
        const t = Array.from(li.childNodes).map(inlineMd).join('').trim()
        if (tag === 'ol') out.push(`${i + 1}. ${t}`)
        else if (li.classList.contains('task')) out.push(`- [${li.classList.contains('done') ? 'x' : ' '}] ${t}`)
        else out.push(`- ${t}`)
      })
      out.push('')
    } else if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr')).map(
        (tr) => '| ' + Array.from(tr.children).map((td) => stripHtml(td.innerHTML).trim().replace(/\|/g, '\\|')).join(' | ') + ' |'
      )
      if (rows.length) {
        const cols = rows[0].split('|').length - 2
        out.push(rows[0], '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |', ...rows.slice(1), '')
      }
    } else if (tag === 'img') {
      out.push(`![${el.getAttribute('alt') ?? ''}](${String(el.getAttribute('src') ?? '').slice(0, 96)})`, '')
    } else {
      const t = Array.from(el.childNodes).map(inlineMd).join('').trim()
      if (t) out.push(t, '')
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function standaloneHtml(title: string, bookTitle: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(bookTitle)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 0 auto; padding: 2rem 1.25rem 4rem; line-height: 1.75; color: #1c1c1c; background: #fff; }
  h1, h2, h3, h4 { font-family: system-ui, sans-serif; line-height: 1.25; }
  blockquote { border-left: 3px solid #999; margin: 0.8em 0; padding: 2px 14px; color: #555; }
  pre { background: #f4f4f4; border-radius: 8px; padding: 10px 14px; overflow-x: auto; font-size: 0.85em; white-space: pre-wrap; }
  img { max-width: 100%; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  a { color: #0b5fff; }
  hr { border: none; border-top: 1px solid #ccc; }
  .skrid-com { background: #fff3bf; border-bottom: 2px solid #e8b93e; }
  header { border-bottom: 1px solid #ddd; margin-bottom: 2rem; padding-bottom: 1rem; color: #666; font-family: system-ui, sans-serif; font-size: 0.85rem; }
</style>
</head>
<body>
<header>${esc(bookTitle)} — exporté de Skrid (Skouar) le ${new Date().toLocaleDateString('fr-FR')}</header>
<h1>${esc(title)}</h1>
${contentHtml}
</body>
</html>`
}

export function wordHtml(title: string, contentHtml: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6;">${contentHtml}</body></html>`
}
