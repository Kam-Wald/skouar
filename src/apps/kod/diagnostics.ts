export interface KodIssue {
  line: number
  col: number
  msg: string
}

let parserP: Promise<typeof import('@babel/parser')> | null = null
const getParser = (): Promise<typeof import('@babel/parser')> => (parserP ??= import('@babel/parser'))

const offToLC = (v: string, off: number): { line: number; col: number } => {
  const before = v.slice(0, off)
  return { line: before.split('\n').length, col: off - before.lastIndexOf('\n') }
}

export async function syntaxIssues(code: string, lang: string): Promise<KodIssue[]> {
  const out: KodIssue[] = []
  if (!code) return out
  if (lang === 'json' || lang === 'jsonc') {
    let src = code
    if (lang === 'jsonc') src = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    try {
      JSON.parse(src)
    } catch (e) {
      const msg = (e as Error).message
      const m = msg.match(/position (\d+)/)
      const lc = m ? offToLC(src, Math.min(Number(m[1]), src.length)) : { line: 1, col: 1 }
      out.push({ line: lc.line, col: lc.col, msg: `JSON invalide : ${msg.split(' at ')[0].slice(0, 120)}` })
    }
    return out
  }
  if (lang === 'yaml') {
    code.split('\n').forEach((l, i) => {
      if (/^\s*\t/.test(l)) out.push({ line: i + 1, col: 1, msg: 'tabulation en début de ligne (YAML exige des espaces)' })
    })
    return out
  }
  if (lang === 'javascript' || lang === 'typescript') {
    try {
      const { parse } = await getParser()
      const base = ['jsx', 'topLevelAwait', 'importMeta', 'dynamicImport', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'objectRestSpread', 'optionalCatchBinding', 'bigInt', 'numericSeparator', 'logicalAssignment']
      const plugins = (lang === 'typescript' ? ['typescript', 'decorators-legacy', ...base] : base) as never[]
      try {
        parse(code, { sourceType: 'module', plugins, errorRecovery: false })
      } catch {
        try {
          parse(code, { sourceType: 'script', plugins, errorRecovery: false })
        } catch (e2) {
          const err = e2 as { loc?: { line: number; column: number }; message: string }
          out.push({ line: err.loc?.line ?? 1, col: (err.loc?.column ?? 0) + 1, msg: err.message.replace(/\n/g, ' ').slice(0, 140) })
        }
      }
    } catch { /* parser indisponible */ }
  }
  return out
}
