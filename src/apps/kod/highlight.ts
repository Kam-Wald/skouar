export function langOf(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const map: Record<string, string> = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
    json: 'json', jsonc: 'json',
    html: 'html', htm: 'html', vue: 'html', svelte: 'html',
    css: 'css', scss: 'css', less: 'css',
    md: 'markdown', markdown: 'markdown',
    py: 'python', rb: 'ruby', sh: 'bash', bash: 'bash', zsh: 'bash',
    yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', env: 'ini', cfg: 'ini',
    xml: 'xml', svg: 'xml', sql: 'sql',
    java: 'java', kt: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cs: 'csharp',
    go: 'go', rs: 'rust', php: 'php', lua: 'lua', pl: 'perl', r: 'r', swift: 'swift',
    diff: 'diff', txt: 'text', log: 'text'
  }
  return map[ext] ?? 'text'
}

interface LangRule {
  comments: string[]
  keywords: string[]
  extra?: string[]
}

const KW = {
  js: 'const let var function return if else for while do switch case break continue new delete typeof instanceof in of class extends super this null undefined true false async await try catch finally throw yield import export from default static get set void',
  ts: 'const let var function return if else for while do switch case break continue new delete typeof instanceof in of class extends super this null undefined true false async await try catch finally throw yield import export from default static get set void interface type enum implements declare namespace abstract readonly public private protected keyof infer never unknown any string number boolean symbol object',
  py: 'def return if elif else for while import from as class pass break continue lambda with try except finally raise global nonlocal assert del in is not and or None True False self print async await yield',
  rb: 'def end if elsif else unless for while do begin rescue ensure raise return yield lambda proc self nil true false and or not in case when then class module require attr_accessor',
  sh: 'if then else elif fi for while do done case esac function in return exit echo export local declare source set unset shift trap',
  sql: 'select from where insert into values update set delete create table drop alter index join inner left right outer on group by order having limit offset as distinct union all case when then else end null primary key foreign references',
  java: 'public private protected class interface enum extends implements static final void int long double float boolean char byte short new return if else for while do switch case break continue try catch finally throw this super null true false import package instanceof abstract synchronized volatile transient',
  c: 'int char float double void long short unsigned signed const static struct union enum typedef if else for while do switch case break continue return goto sizeof typeof',
  cpp: 'int char float double void long short unsigned signed const static struct union enum class namespace template typename public private protected virtual override new delete return if else for while do switch case break continue try catch throw this nullptr true false include using',
  cs: 'public private protected internal class interface struct enum namespace using static void int long double float bool string object new return if else for foreach while do switch case break continue try catch finally throw this base null true false var async await',
  go: 'package import func return if else for range switch case break continue type struct interface map chan go defer select var const nil true false',
  rs: 'fn let mut const struct enum impl trait pub use mod return if else for while loop match break continue crate self Self super where async await move unsafe type dyn',
  php: 'function return if else elseif foreach while do switch case break continue class interface trait extends implements public private protected static new try catch finally throw echo print include require namespace use this null true false',
  lua: 'local function end if then else elseif for while do return break repeat until in nil true false and or not',
  swift: 'func let var class struct enum protocol extension import return if else guard for while do switch case break continue default nil true false self Self super init deinit typealias associatedtype',
  yaml: 'true false null yes no'
}

const LANGS: Record<string, LangRule> = {
  javascript: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.js.split(' ') },
  typescript: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.ts.split(' ') },
  json: { comments: [], keywords: ['true', 'false', 'null'] },
  html: { comments: ['<!--[\\s\\S]*?-->'], keywords: [] },
  xml: { comments: ['<!--[\\s\\S]*?-->'], keywords: [] },
  css: { comments: ['\\/\\*[\\s\\S]*?\\*\\/'], keywords: ['important', 'media', 'keyframes', 'import', 'root'] },
  markdown: { comments: [], keywords: [], extra: ['(^|\\n)(#{1,6})[^\\n]*', '\\[[^\\]\\n]*\\]\\([^)\\n]*\\)', '`[^`\\n]*`'] },
  python: { comments: ['#[^\\n]*', '"""[\\s\\S]*?"""'], keywords: KW.py.split(' ') },
  ruby: { comments: ['#[^\\n]*'], keywords: KW.rb.split(' ') },
  bash: { comments: ['#[^\\n]*'], keywords: KW.sh.split(' ') },
  yaml: { comments: ['#[^\\n]*'], keywords: KW.yaml.split(' ') },
  toml: { comments: ['#[^\\n]*'], keywords: [] },
  ini: { comments: ['[;#][^\\n]*'], keywords: [] },
  sql: { comments: ['--[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.sql.split(' ') },
  java: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.java.split(' ') },
  c: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.c.split(' ') },
  cpp: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.cpp.split(' ') },
  csharp: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.cs.split(' ') },
  go: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.go.split(' ') },
  rust: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.rs.split(' ') },
  php: { comments: ['//[^\\n]*', '#[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.php.split(' ') },
  lua: { comments: ['--\\[\\[\\s\\S]*?\\]\\]|--[^\\n]*'], keywords: KW.lua.split(' ') },
  perl: { comments: ['#[^\\n]*'], keywords: ['sub', 'my', 'our', 'local', 'use', 'return', 'if', 'else', 'elsif', 'unless', 'while', 'for', 'foreach', 'package', 'print'] },
  r: { comments: ['#[^\\n]*'], keywords: ['function', 'if', 'else', 'for', 'while', 'return', 'library', 'require', 'TRUE', 'FALSE', 'NULL', 'NA'] },
  swift: { comments: ['//[^\\n]*', '\\/\\*[\\s\\S]*?\\*\\/'], keywords: KW.swift.split(' ') },
  diff: { comments: [], keywords: [] },
  text: { comments: [], keywords: [] }
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function highlight(code: string, lang: string): string {
  const rule = LANGS[lang] ?? LANGS.text
  const e = esc(code)
  const parts: string[] = []
  if (rule.comments.length) parts.push(`(?<c>${rule.comments.join('|')})`)
  if (lang === 'html' || lang === 'xml') parts.push('(?<t><\\/?[a-zA-Z][^>]*?\\/?>)')
  parts.push('(?<s>"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`)')
  if (rule.keywords.length) parts.push(`(?<k>\\b(?:${rule.keywords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b)`)
  parts.push('(?<n>\\b\\d[\\w.]*\\b)')
  parts.push('(?<f>[a-zA-Z_$][\\w$]*(?=\\s*\\())')
  if (rule.extra?.length) parts.push(`(?<h>${rule.extra.join('|')})`)
  if (!parts.length) return e
  const re = new RegExp(parts.join('|'), 'g')
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(e))) {
    out += e.slice(last, m.index)
    const g = m.groups ?? {}
    const cls = g.c ? 'tok-c' : g.t ? 'tok-t' : g.s ? 'tok-s' : g.k ? 'tok-k' : g.n ? 'tok-n' : g.f ? 'tok-f' : g.h ? 'tok-h' : 'tok-p'
    out += `<span class="${cls}">` + m[0] + '</span>'
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  out += e.slice(last)
  return out
}
