interface EmNode {
  tag: string
  id: string
  classes: string[]
  attrs: string[]
  text: string
  mult: number
  children: EmNode[]
}

const parseAbbr = (abbr: string): EmNode[] | null => {
  let pos = 0
  const parseNode = (): EmNode | null => {
    let tag = ''
    const c0 = abbr[pos]
    if (c0 === '.' || c0 === '#') tag = 'div'
    else {
      const m = abbr.slice(pos).match(/^[a-zA-Z][\w-]*/)
      if (m) {
        tag = m[0]
        pos += m[0].length
      }
    }
    const node: EmNode = { tag: tag || 'div', id: '', classes: [], attrs: [], text: '', mult: 1, children: [] }
    let any = tag !== ''
    while (pos < abbr.length) {
      const c = abbr[pos]
      if (c === '#') {
        const m = abbr.slice(pos + 1).match(/^[\w$-]+/)
        if (!m) return null
        node.id = m[0]
        pos += 1 + m[0].length
        any = true
      } else if (c === '.') {
        const m = abbr.slice(pos + 1).match(/^[\w$-]+/)
        if (!m) return null
        node.classes.push(m[0])
        pos += 1 + m[0].length
        any = true
      } else if (c === '[') {
        const end = abbr.indexOf(']', pos)
        if (end < 0) return null
        const a = abbr.slice(pos + 1, end).trim()
        if (a) node.attrs.push(a)
        pos = end + 1
        any = true
      } else if (c === '*') {
        const m = abbr.slice(pos + 1).match(/^\d+/)
        if (!m) return null
        node.mult = Math.max(1, parseInt(m[0], 10))
        pos += 1 + m[0].length
        any = true
      } else if (c === '{') {
        const end = abbr.indexOf('}', pos)
        if (end < 0) return null
        node.text = abbr.slice(pos + 1, end)
        pos = end + 1
        any = true
      } else break
    }
    return any ? node : null
  }
  const root: EmNode = { tag: '', id: '', classes: [], attrs: [], text: '', mult: 1, children: [] }
  const stack: EmNode[] = [root]
  while (pos < abbr.length) {
    const c = abbr[pos]
    if (c === '+' || c === '>' || c === '^') {
      pos++
      if (c === '^' && stack.length > 1) stack.pop()
      const n = parseNode()
      if (!n) return null
      stack[stack.length - 1].children.push(n)
      if (abbr[pos] === '>') stack.push(n)
    } else {
      const n = parseNode()
      if (!n) return null
      stack[stack.length - 1].children.push(n)
      if (abbr[pos] === '>') stack.push(n)
    }
  }
  return root.children
}

export function expandEmmet(abbr: string, lang: string): string | null {
  const s = abbr.trim()
  if (!s) return null
  if (lang === 'css') {
    if (!/^[a-zA-Z.#[:*][\w.#:\[\]*()\-"'>, ]*$/.test(s) || s.includes('{') || s.includes(';')) return null
    return `${s} {\n\u0001\n}`
  }
  if (lang !== 'html' && lang !== 'xml' && lang !== 'vue' && lang !== 'svelte') return null
  if (s === '!') {
    return '<!doctype html>\n<html lang="fr">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>\u0001</title>\n</head>\n<body>\n  \u0001\n</body>\n</html>'
  }
  if (!/^[a-zA-Z][\w#.\-*+>^(){}\[\]$@:="'& ]*$/.test(s)) return null
  const children = parseAbbr(s)
  if (!children || !children.length) return null
  let counter = 0
  const out: string[] = []
  const renderOne = (n: EmNode, depth: number): void => {
    for (let k = 0; k < n.mult; k++) {
      const rep = (x: string): string => {
        if (!x.includes('$')) return x
        return x.replace(/\$/g, String(n.mult > 1 ? k + 1 : ++counter))
      }
      const ind = '  '.repeat(depth)
      const attrs =
        (n.id ? ` id="${rep(n.id)}"` : '') +
        (n.classes.length ? ` class="${n.classes.map(rep).join(' ')}"` : '') +
        n.attrs.map((a) => ' ' + rep(a)).join('')
      const text = rep(n.text)
      if (!n.children.length) {
        out.push(`${ind}<${n.tag}${attrs}>${text}</${n.tag}>`)
      } else {
        out.push(`${ind}<${n.tag}${attrs}>${text}`)
        n.children.forEach((c) => renderOne(c, depth + 1))
        out.push(`${ind}</${n.tag}>`)
      }
    }
  }
  children.forEach((c) => renderOne(c, 0))
  return out.join('\n')
}
