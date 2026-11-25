import type { Block, BlockType, Page } from './types'
import { createBlock, uid } from './store'
import { stripHtml } from './tree'

const TYPE_BY_MD: [RegExp, BlockType][] = [
  [/^######\s+/, 'h4'],
  [/^#####\s+/, 'h3'],
  [/^####\s+/, 'h3'],
  [/^###\s+/, 'h3'],
  [/^##\s+/, 'h2'],
  [/^#\s+/, 'h1'],
  [/^>\s?/, 'quote'],
  [/^```/, 'code'],
  [/^---+$/, 'divider'],
  [/^[-*]\s+\[ \]\s+/, 'todo'],
  [/^[-*]\s+\[x\]\s+/i, 'todo'],
  [/^[-*]\s+/, 'bullet'],
  [/^\d+[.)]\s+/, 'numbered']
]

export function parseMarkdown(md: string, titleFallback: string): { title: string; blocks: Block[] } {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let title = ''
  let inCode = false
  let codeBuf: string[] = []

  const pushBlock = (type: BlockType, text: string, done?: boolean) => {
    const b = createBlock(type, text)
    if (type === 'todo') b.done = done ?? false
    blocks.push(b)
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        pushBlock('code', codeBuf.join('\n'))
        codeBuf = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    if (!line.trim()) continue
    let matched = false
    for (const [re, type] of TYPE_BY_MD) {
      const m = line.match(re)
      if (m) {
        let text = line.slice(m[0].length)
        let done: boolean | undefined
        if (type === 'todo') {
          done = /\[x\]/i.test(m[0])
          text = text
        }
        pushBlock(type, text, done)
        if (type === 'h1' && !title) title = stripHtml(text).trim()
        matched = true
        break
      }
    }
    if (!matched) pushBlock('paragraph', line)
  }
  if (inCode && codeBuf.length) pushBlock('code', codeBuf.join('\n'))
  if (blocks.length === 0) pushBlock('paragraph', '')
  return { title: title || titleFallback, blocks }
}

function mdEscape(s: string): string {
  return s.replace(/[*`[\]]/g, '\\$&')
}

export function toMarkdown(page: Page): string {
  const out: string[] = [`# ${stripHtml(page.title).trim() || 'Sans titre'}`, '']
  const walk = (blocks: Block[], depth: number) => {
    for (const b of blocks) {
      const t = stripHtml(b.text)
      switch (b.type) {
        case 'h1': out.push(`# ${t}`); break
        case 'h2': out.push(`## ${t}`); break
        case 'h3': out.push(`### ${t}`); break
        case 'h4': out.push(`#### ${t}`); break
        case 'quote': out.push(`> ${t}`); break
        case 'code': out.push('```', t, '```'); break
        case 'divider': out.push('---'); break
        case 'bullet': out.push(`- ${t}`); break
        case 'numbered': out.push(`1. ${t}`); break
        case 'todo': out.push(`- [${b.done ? 'x' : ' '}] ${t}`); break
        case 'image': if (b.src && !b.src.startsWith('data:')) out.push(`![image](${b.src})`); break
        case 'button': out.push(`[${t || 'bouton'}](${b.href ?? ''})`); break
        case 'toc': break
        case 'database': {
          const db = b.db
          if (db) {
            out.push(`**${t || 'Base de données'}** (${db.rows.length} lignes)`, '')
            if (db.rows.length) {
              out.push('| ' + db.columns.map((c) => c.name).join(' | ') + ' |')
              out.push('| ' + db.columns.map(() => '---').join(' | ') + ' |')
              for (const r of db.rows) {
                out.push('| ' + db.columns.map((c) => String(r.cells[c.id] ?? '')).join(' | ') + ' |')
              }
              out.push('')
            }
          }
          break
        }
        default: if (t.trim()) out.push(t)
      }
      if (b.children) walk(b.children, depth + 1)
    }
  }
  walk(page.blocks, 0)
  return out.join('\n') + '\n'
}

export function exportFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function newPageId(): string {
  return uid()
}
