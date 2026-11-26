const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const inline = (s: string): string =>
  s
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

export function renderMd(src: string): string {
  const lines = esc(src).split('\n')
  const out: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  const closeList = (): void => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }
  for (const raw of lines) {
    const line = raw
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      closeList()
      const lvl = h[1].length
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
      continue
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ol) {
      if (listType !== 'ol') {
        closeList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    closeList()
    if (/^\s*---+\s*$/.test(line)) {
      out.push('<hr/>')
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`)
      continue
    }
    if (line.trim() === '') {
      out.push('')
      continue
    }
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  if (inCode) out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
  return out.join('\n')
}

export function renderPreview(src: string, lang: string): string {
  if (lang === 'html') return src
  if (lang === 'markdown') return renderMd(src)
  if (lang === 'svg') return `<img class="kod-svgprev" alt="aperçu svg" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}" />`
  return `<pre>${esc(src)}</pre>`
}
