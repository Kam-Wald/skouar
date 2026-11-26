import { describe, it, expect } from 'vitest'
import { highlight, langOf } from '../src/apps/kod/highlight'
import { renderPreview, renderMd } from '../src/apps/kod/preview'
import { KOD_TEMPLATES, templateGroups } from '../src/apps/kod/templates'
import { expandEmmet } from '../src/apps/kod/emmet'
import { diffLines } from '../src/apps/kod/diff'
import { parseKeymapText, keymapToText, comboOf, DEFAULT_KEYMAP } from '../src/apps/kod/keymap'
import { syntaxIssues } from '../src/apps/kod/diagnostics'
import { zipFiles, unzipFiles, entryText, crc32 } from '../src/apps/kod/zip'
import { buildIndex, findDef, resolveImport, wordAtOffset, importSpecAtOffset } from '../src/apps/kod/definitions'

describe('highlight', () => {
  it('langOf', () => {
    expect(langOf('a.ts')).toBe('typescript')
    expect(langOf('a.vue')).toBe('html')
    expect(langOf('a.unknown')).toBe('text')
  })
  it('highlight ne jette jamais et renvoie une string', () => {
    const samples: [string, string][] = [
      ['const a = 1 // x\n', 'javascript'],
      ['def f():\n    pass\n', 'python'],
      ['<div class="x">hi</div>\n', 'html'],
      ['# Titre\n\ntexte **gras**\n', 'markdown'],
      ['SELECT * FROM t;\n', 'sql'],
      ['{"a": 1}\n', 'json']
    ]
    for (const [code, lang] of samples) {
      const out = highlight(code, lang)
      expect(typeof out).toBe('string')
      expect(out.length).toBeGreaterThan(0)
    }
  })
})

describe('preview', () => {
  it('renderMd basique', () => {
    const html = renderMd('# Titre\n\n- a\n- b\n')
    expect(html).toContain('<h1>Titre</h1>')
    expect(html).toContain('<li>a</li>')
  })
  it('renderPreview svg', () => {
    expect(renderPreview('<svg></svg>', 'svg')).toContain('data:image/svg+xml')
  })
})

describe('templates', () => {
  it('34 modèles, 5 groupes, JSON valides', () => {
    expect(KOD_TEMPLATES.length).toBe(34)
    expect(templateGroups()).toEqual(['Langages', 'Projet', 'Docs', 'Config', 'Extraits'])
    for (const t of KOD_TEMPLATES) {
      expect(t.label && t.group && t.path && t.icon && t.content.trim()).toBeTruthy()
      if (t.path.endsWith('.json')) JSON.parse(t.content.replaceAll('{{titre}}', 'x'))
    }
  })
})

describe('emmet', () => {
  it('expansions', () => {
    expect(expandEmmet('ul>li*3', 'html')).toBe('<ul>\n  <li></li>\n  <li></li>\n  <li></li>\n</ul>')
    expect(expandEmmet('div#app.c1>p{Hello}', 'html')).toBe('<div id="app" class="c1">\n  <p>Hello</p>\n</div>')
    expect(expandEmmet('div>span^a', 'html')).toBe('<div>\n  <span></span>\n</div>\n<a></a>')
    expect(expandEmmet('ul>li.item$*3', 'html')).toBe('<ul>\n  <li class="item1"></li>\n  <li class="item2"></li>\n  <li class="item3"></li>\n</ul>')
    expect(expandEmmet('.card', 'css')).toBe('.card {\n\u0001\n}')
    expect(expandEmmet('div p', 'html')).toBeNull()
    expect(expandEmmet('div>p', 'javascript')).toBeNull()
    expect(expandEmmet('!', 'html')!.startsWith('<!doctype html>')).toBe(true)
  })
})

describe('diff', () => {
  it('lignes', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc').map((r) => r.type + r.text).join(',')).toBe('samea,delb,addx,samec')
    expect(diffLines('', '')).toEqual([])
  })
})

describe('keymap', () => {
  it('parse/roundtrip/combo', () => {
    expect(parseKeymapText('find: C-S-F\nbad\nsave = c-s\nunknown: C-X')).toEqual({ find: 'CS-F', save: 'C-S' })
    expect(parseKeymapText(keymapToText({ find: 'CS-F' }))).toEqual({ find: 'CS-F' })
    expect(comboOf({ ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'F' })).toBe('CS-F')
    expect(comboOf({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, key: 'ArrowUp' })).toBe('A-ArrowUp')
    expect(DEFAULT_KEYMAP.save).toBe('C-S')
    expect(parseKeymapText('gotoDef: C-F12')).toEqual({ gotoDef: 'C-F12' })
  })
})

describe('diagnostics', () => {
  it('erreurs et ok', async () => {
    expect((await syntaxIssues('const x = {', 'typescript')).length).toBeGreaterThanOrEqual(1)
    expect((await syntaxIssues('const x: number = 1\nexport default x\n', 'typescript')).length).toBe(0)
    expect((await syntaxIssues('function {', 'javascript')).length).toBeGreaterThanOrEqual(1)
    expect((await syntaxIssues('{"a": 1,}', 'json')).length).toBe(1)
    expect((await syntaxIssues('{"a":1}', 'json')).length).toBe(0)
    expect((await syntaxIssues('a: 1\n\tb: 2', 'yaml')).length).toBe(1)
    expect((await syntaxIssues('x', 'python')).length).toBe(0)
  })
})

describe('zip', () => {
  it('crc32 connu', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('roundtrip', async () => {
    const blob = await zipFiles([
      { name: 'src/a.ts', data: 'const x = 1\n'.repeat(200) },
      { name: 'docs/note éà.md', data: '# accents éàù ç\n' },
      { name: 'bin.dat', data: new Uint8Array([0, 1, 2, 255, 128]) }
    ])
    const back = await unzipFiles(blob)
    expect(back.length).toBe(3)
    expect(entryText(back.find((e) => e.name === 'src/a.ts')!)).toBe('const x = 1\n'.repeat(200))
    expect(entryText(back.find((e) => e.name === 'docs/note éà.md')!)).toBe('# accents éàù ç\n')
    expect(Array.from(back.find((e) => e.name === 'bin.dat')!.data).join(',')).toBe('0,1,2,255,128')
  })
  it('lit un ZIP externe (fixture python)', async () => {
    const b64 = 'UEsDBBQAAAAIAHtxel1DZls9KAAAACYAAAALAAAAc3JjL21haW4udHNLrSjILypRSCvNSy7JzM9TyEjNycnX0FSoVihKLSktylMwMVKo5QIAUEsDBBQAAAgIAHtxel1UWrE4GgAAABgAAAARAAAAZG9jcy9ub3RlIMOpw6AubWRTVgjJLClK5eJKzs8rSc0rVTi88vCCwzu5AFBLAwQUAAAACAB7cXpdAAAAAAIAAAAAAAAACQAAAGVtcHR5LnR4dAMAUEsBAhQDFAAAAAgAe3F6XUNmWz0oAAAAJgAAAAsAAAAAAAAAAAAAAIABAAAAAHNyYy9tYWluLnRzUEsBAhQDFAAACAgAe3F6XVRasTgaAAAAGAAAABEAAAAAAAAAAAAAAIABUQAAAGRvY3Mvbm90ZSDDqcOgLm1kUEsBAhQDFAAAAAgAe3F6XQAAAAACAAAAAAAAAAkAAAAAAAAAAAAAAIABmgAAAGVtcHR5LnR4dFBLBQYAAAAAAwADAK8AAADDAAAAAAA='
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const entries = await unzipFiles(new Blob([bytes]))
    expect(entries.length).toBe(3)
    expect(entryText(entries.find((e) => e.name === 'src/main.ts')!)).toBe('export function hello() { return 42 }\n')
    expect(entryText(entries.find((e) => e.name === 'docs/note éà.md')!)).toBe('# Titre\n\ncontenu éàù\n')
    expect(entryText(entries.find((e) => e.name === 'empty.txt')!)).toBe('')
  })
})

describe('definitions', () => {
  const files = [
    { key: 'a', path: 'src/main.ts', content: "import { helper } from './util'\nexport function main() {\n  return helper()\n}\n" },
    { key: 'b', path: 'src/util.ts', content: 'export function helper(): number {\n  return 42\n}\nexport const VERSION = 1\n' },
    { key: 'c', path: 'app.py', content: 'def calculer(x):\n    return x * 2\n' }
  ]
  const langs = { a: 'typescript', b: 'typescript', c: 'python' }
  it('index + findDef + imports', () => {
    const idx = buildIndex(files, langs)
    expect(findDef(idx, 'helper', 'a')).toMatchObject({ key: 'b', line: 1 })
    expect(findDef(idx, 'main', 'a')).toMatchObject({ key: 'a', line: 2 })
    expect(findDef(idx, 'calculer', 'c')?.line).toBe(1)
    expect(wordAtOffset(files[0].content, files[0].content.indexOf('helper()') + 2).w).toBe('helper')
    expect(importSpecAtOffset(files[0].content, files[0].content.indexOf('./util') + 3)).toBe('./util')
    expect(resolveImport('./util', 'src/main.ts', files)?.key).toBe('b')
    expect(resolveImport('../util', 'src/deep/x.ts', files)?.key).toBe('b')
    expect(resolveImport('react', 'src/main.ts', files)).toBeNull()
  })
})
