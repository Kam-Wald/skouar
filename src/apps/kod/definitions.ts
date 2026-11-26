export interface DefFile {
  key: string
  path: string
  content: string
}

export interface DefHit {
  key: string
  line: number
  col: number
}

export interface DefIndex {
  syms: Map<string, DefHit[]>
}

const offToLC = (v: string, off: number): { line: number; col: number } => {
  const before = v.slice(0, off)
  return { line: before.split('\n').length, col: off - before.lastIndexOf('\n') }
}

export function wordAtOffset(v: string, off: number): { s: number; e: number; w: string } {
  const isW = (c: string): boolean => /[\w$]/.test(c)
  let s = off
  let e = off
  while (s > 0 && isW(v[s - 1])) s--
  while (e < v.length && isW(v[e])) e++
  return { s, e, w: v.slice(s, e) }
}

export function importSpecAtOffset(v: string, off: number): string | null {
  const before = v.slice(0, off)
  const m = before.match(/(?:from|import)\s*['"]([^'"]*)$/)
  if (!m) return null
  const rest = v.slice(off)
  const close = rest.search(/['"]/)
  return m[1] + (close >= 0 ? rest.slice(0, close) : rest)
}

export function buildIndex(files: DefFile[], langs: Record<string, string>): DefIndex {
  const syms = new Map<string, DefHit[]>()
  const push = (name: string, hit: DefHit): void => {
    const arr = syms.get(name) ?? []
    arr.push(hit)
    syms.set(name, arr)
  }
  for (const f of files) {
    const lang = langs[f.key] ?? ''
    const v = f.content
    if (lang === 'javascript' || lang === 'typescript') {
      const re = /(?:export\s+(?:default\s+)?(?:async\s+)?)?(?:function\s*\*?\s*|class\s+)([A-Za-z_$][\w$]*)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(v))) push(m[1], { key: f.key, ...offToLC(v, m.index) })
      const re2 = /(?:export\s+)?(?:const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
      while ((m = re2.exec(v))) push(m[1], { key: f.key, ...offToLC(v, m.index) })
    } else if (lang === 'python' || lang === 'ruby') {
      const re = /^(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/gm
      let m: RegExpExecArray | null
      while ((m = re.exec(v))) push(m[1], { key: f.key, ...offToLC(v, m.index) })
    } else if (lang === 'html' || lang === 'xml') {
      const re = /<(\w+)[^>]*\bid=["']([\w-]+)["']/g
      let m: RegExpExecArray | null
      while ((m = re.exec(v))) push('#' + m[2], { key: f.key, ...offToLC(v, m.index) })
    }
  }
  return { syms }
}

export function resolveImport(spec: string, fromPath: string, files: DefFile[]): DefFile | null {
  if (!spec.startsWith('.')) return null
  const base = fromPath.split('/').slice(0, -1)
  const parts = (base.join('/') + '/' + spec).split('/')
  const norm: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') norm.pop()
    else norm.push(p)
  }
  let target = norm.join('/')
  const tryExt = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.vue', '.svelte', '/index.ts', '/index.js']
  for (const ext of tryExt) {
    const t = target + ext
    const f = files.find((x) => x.path === t || x.path.endsWith('/' + t))
    if (f) return f
  }
  return null
}

export function findDef(index: DefIndex, word: string, currentKey: string): DefHit | null {
  const arr = index.syms.get(word)
  if (!arr || !arr.length) return null
  return arr.find((h) => h.key === currentKey) ?? arr[0]
}
