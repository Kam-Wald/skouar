const KW: Record<string, string> = {
  js: 'const|let|var|function|return|if|else|for|while|import|from|export|default|new|class|extends|async|await|try|catch|throw|typeof|null|undefined|true|false|switch|case|break',
  ts: 'const|let|var|function|return|if|else|for|while|import|from|export|default|new|class|extends|async|await|try|catch|throw|typeof|null|undefined|true|false|interface|type|implements|public|private|readonly|enum|as|string|number|boolean|any|void',
  python: 'def|return|if|elif|else|for|while|import|from|class|try|except|finally|with|as|lambda|None|True|False|print|in|not|and|or|is|pass|break|continue|raise',
  json: 'true|false|null',
  css: 'color|background|margin|padding|display|flex|grid|border|font|width|height|position|top|left|right|bottom|gap|radius|shadow|transform|transition|hover|important',
  bash: 'echo|cd|ls|mkdir|rm|cp|mv|sudo|apt|npm|git|export|if|then|fi|for|do|done|cat|chmod|curl|pip',
  sql: 'SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|JOIN|ON|AND|OR|NULL|ORDER|BY|GROUP|LIMIT|AS|DROP|ALTER'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function highlightCode(src: string, lang: string): string {
  const kw = KW[lang.toLowerCase()] ?? ''
  let s = esc(src)
  const stash: string[] = []
  const keep = (html: string): string => {
    stash.push(html)
    return `\u0001${stash.length - 1}\u0002`
  }
  s = s.replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)/g, (m) => keep(`<span class="tok-com">${m}</span>`))
  s = s.replace(/("[^"\n]*"|'[^'\n]*'|`[^`]*`)/g, (m) => keep(`<span class="tok-str">${m}</span>`))
  if (kw) s = s.replace(new RegExp(`\\b(${kw})\\b`, 'gi'), (m) => keep(`<span class="tok-kw">${m}</span>`))
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, (m) => keep(`<span class="tok-num">${m}</span>`))
  s = s.replace(/(&lt;\/?[a-zA-Z][^&\n]*?&gt;)/g, (m) => keep(`<span class="tok-tag">${m}</span>`))
  return s.replace(/\u0001(\d+)\u0002/g, (_, i) => stash[Number(i)])
}
