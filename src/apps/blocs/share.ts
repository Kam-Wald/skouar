import type { Block, Page } from './types'
import { cellDisplay } from './fields'
import { exportFile } from './markdown'
import { stripHtml } from './tree'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function blockHtml(b: Block): string {
  const kids = (b.children ?? []).map(blockHtml).join('')
  switch (b.type) {
    case 'h1':
      return `<h1>${b.text || '&nbsp;'}</h1>`
    case 'h2':
      return `<h2>${b.text || '&nbsp;'}</h2>`
    case 'h3':
      return `<h3>${b.text || '&nbsp;'}</h3>`
    case 'h4':
      return `<h4>${b.text || '&nbsp;'}</h4>`
    case 'bullet':
      return `<li>${b.text || '&nbsp;'}</li>`
    case 'numbered':
      return `<li>${b.text || '&nbsp;'}</li>`
    case 'todo':
      return `<p class="todo">${b.done ? '☑' : '☐'} ${b.text || ''}${b.due ? ` <small>(${esc(b.due.replace('T', ' '))})</small>` : ''}</p>`
    case 'quote':
      return `<blockquote>${b.text || ''}</blockquote>`
    case 'code':
      return `<pre><code>${esc(b.text)}</code></pre>`
    case 'divider':
      return '<hr>'
    case 'callout':
      return `<div class="callout">💡 ${b.text || ''}</div>`
    case 'image':
      return b.src ? `<img src="${b.src}" alt="">` : ''
    case 'gallery':
      return `<div class="gallery">${(b.srcs ?? []).map((s) => `<img src="${s}" alt="">`).join('')}</div>`
    case 'video':
      return b.src ? `<video controls src="${b.src}"></video>` : ''
    case 'audio':
      return b.src ? `<audio controls src="${b.src}"></audio>` : ''
    case 'pdf':
      return b.src ? `<p>📕 <a href="${b.src}" download="${esc(b.fileName ?? 'document.pdf')}">${esc(b.fileName ?? 'PDF')}</a></p>` : ''
    case 'file':
    case 'archive':
      return b.src ? `<p>📦 <a href="${b.src}" download="${esc(b.fileName ?? 'fichier')}">${esc(b.fileName ?? 'Fichier')}</a></p>` : ''
    case 'embed':
      return b.src ? `<iframe src="${b.src}" class="embed"></iframe>` : ''
    case 'math':
      return `<p class="math">∑ ${esc(stripHtml(b.text))}</p>`
    case 'progress':
      return `<div class="progress"><div style="width:${b.progress ?? 0}%"></div></div>`
    case 'qr':
      return `<p class="qr">▦ ${esc(stripHtml(b.text))}</p>`
    case 'countdown':
      return `<p>⏳ ${b.due ? esc(b.due.replace('T', ' ')) : '—'}</p>`
    case 'pageembed':
      return `<p>🔗 ${esc(stripHtml(b.text))}</p>`
    case 'button':
      return b.href ? `<p><a class="btn" href="${b.href}">${b.text || b.href}</a></p>` : `<p><span class="btn">${b.text || 'Bouton'}</span></p>`
    case 'toc':
      return ''
    case 'toggle':
      return `<details${kids ? ' open' : ''}><summary>${b.text || 'Menu'}</summary>${kids}</details>`
    case 'columns':
      return `<div class="cols">${kids}</div>`
    case 'column':
      return `<div class="col">${kids}</div>`
    case 'table': {
      const rows = b.table ?? []
      return `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`
    }
    case 'database': {
      const db = b.db
      if (!db) return ''
      const head = db.columns.map((c) => `<th>${esc(c.name)}</th>`).join('')
      const body = db.rows
        .map((r) => `<tr>${db.columns.map((c) => `<td>${esc(cellDisplay(r.cells[c.id]))}</td>`).join('')}</tr>`)
        .join('')
      return `<p class="db-name">■ ${esc(stripHtml(b.text).trim() || 'Base de données')}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
    }
    default:
      return `<p>${b.text || '&nbsp;'}</p>`
  }
}

export function exportPageHtml(page: Page): void {
  const title = stripHtml(page.title).trim() || 'Sans titre'
  const coverBar =
    page.cover && (page.cover.kind === 'color' || page.cover.kind === 'pattern')
      ? `<div class="cover" style="height:90px;border-radius:12px;margin-bottom:18px;background:${page.cover.kind === 'color' ? page.cover.value : '#312e81'}"></div>`
      : ''
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Calepin</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; color: #101828; background: #fff; line-height: 1.6; }
  h1 { font-size: 2rem; margin: 0.2em 0; } h2 { font-size: 1.5rem; margin: 1em 0 0.3em; } h3 { font-size: 1.2rem; margin: 1em 0 0.3em; } h4 { font-size: 1.05rem; margin: 1em 0 0.3em; }
  ul { padding-left: 1.4em; } li { margin: 2px 0; }
  blockquote { border-left: 3px solid #c7d2fe; margin: 8px 0; padding: 2px 12px; color: #475467; }
  pre { background: #0b0f19; color: #e6eaf2; padding: 12px 14px; border-radius: 10px; overflow-x: auto; font-size: 0.85rem; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  hr { border: none; border-top: 1px solid #e4e7ec; margin: 18px 0; }
  .callout { background: #eef2ff; border-left: 3px solid #4f46e5; padding: 8px 12px; border-radius: 0 8px 8px 0; margin: 8px 0; }
  img { max-width: 100%; border-radius: 10px; margin: 8px 0; }
  .gallery { display: flex; flex-wrap: wrap; gap: 8px; } .gallery img { width: 160px; height: 120px; object-fit: cover; }
  video, .embed { width: 100%; aspect-ratio: 16/9; border-radius: 10px; margin: 8px 0; border: 1px solid #e4e7ec; }
  .progress { width: 220px; height: 8px; background: #e4e7ec; border-radius: 999px; overflow: hidden; } .progress div { height: 100%; background: #4f46e5; }
  .todo small { color: #667085; }
  table { border-collapse: collapse; margin: 10px 0; font-size: 0.92rem; } th, td { border: 1px solid #e4e7ec; padding: 6px 10px; text-align: left; } th { background: #f6f7f9; }
  .db-name { font-weight: 600; margin: 14px 0 4px; }
  details { margin: 6px 0; } summary { cursor: default; font-weight: 600; }
  .cols { display: flex; gap: 12px; } .col { flex: 1; }
  .btn { display: inline-block; background: #4f46e5; color: #fff; padding: 6px 14px; border-radius: 8px; text-decoration: none; }
  .math, .qr { font-family: ui-monospace, Menlo, Consolas, monospace; background: #f6f7f9; padding: 6px 10px; border-radius: 8px; display: inline-block; }
  header.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .page-icon { font-size: 2rem; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e4e7ec; color: #98a2b3; font-size: 0.8rem; font-family: ui-monospace, Menlo, Consolas, monospace; }
</style>
</head>
<body>
<header class="page-head"><span class="page-icon">${page.icon ?? '📓'}</span><h1>${esc(title)}</h1></header>
${coverBar}
${page.blocks.map(blockHtml).join('\n')}
<footer>Page partagée depuis Calepin — Skouar · local-first · ${new Date().toLocaleDateString('fr-FR')}</footer>
</body>
</html>`
  exportFile(`${title.replace(/[\\/:*?"<>|]/g, '-')}.html`, html, 'text/html')
}
