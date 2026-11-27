import { describe, it, expect } from 'vitest'
import {
  CalcError,
  colToIndex,
  csvExport,
  evalNode,
  fmtDisplay,
  indexToCol,
  keyOf,
  parseFormula,
  parseInput,
  parseKey,
  recalcWorkbook,
  serializeFormula,
  shiftRefs,
  type Sheet,
  type Workbook
} from '../src/apps/taol/logic'

function wb1(cells: Sheet['cells']): Workbook {
  const sh: Sheet = { id: 's1', name: 'Feuil 1', cells }
  const wb: Workbook = { sheets: [sh], activeSheetId: 's1', activeCell: 'A1' }
  recalcWorkbook(wb)
  return wb
}

const val = (wb: Workbook, key: string) => {
  const sh = wb.sheets[0]
  const p = parseKey(key)!
  return sh.cells[key]?.v
}

describe('refs A1', () => {
  it('colToIndex / indexToCol', () => {
    expect(colToIndex('A')).toBe(0)
    expect(colToIndex('Z')).toBe(25)
    expect(colToIndex('AA')).toBe(26)
    expect(indexToCol(0)).toBe('A')
    expect(indexToCol(26)).toBe('AA')
    expect(keyOf(26, 0)).toBe('AA1')
  })
  it('parseKey', () => {
    expect(parseKey('B12')).toEqual({ col: 1, row: 11 })
    expect(parseKey('$AB$3')).toEqual({ col: 27, row: 2 })
    expect(parseKey('nimp')).toBeNull()
  })
})

describe('parseur de formules', () => {
  it('nombres avec virgule ou point, priorités, parenthèses, &, comparaison', () => {
    expect(evalNode(parseFormula('1,5+2*3'), ctx())).toBe(7.5)
    expect(evalNode(parseFormula('(1+2)*3'), ctx())).toBe(9)
    expect(evalNode(parseFormula('"a"&"b"'), ctx())).toBe('ab')
    expect(evalNode(parseFormula('2^3'), ctx())).toBe(8)
    expect(evalNode(parseFormula('5>3'), ctx())).toBe(true)
    expect(evalNode(parseFormula('5%'), ctx())).toBe(0.05)
  })
  it('erreurs de syntaxe', () => {
    expect(() => parseFormula('1+')).toThrow(CalcError)
    expect(() => parseFormula('=SOMME(')).toThrow(CalcError)
    expect(() => evalNode(parseFormula('FOO(1)'), ctx())).toThrow(CalcError)
  })
})

function ctx() {
  return { currentSheet: 's1', stack: [] as string[], getCell: () => null }
}

describe('calcul sur classeur (recalc)', () => {
  it('SOMME/MOYENNE/MIN/MAX/NB sur plage', () => {
    const wb = wb1({ A1: { v: 10 }, A2: { v: 20 }, A3: { v: 30 }, B1: { f: 'SOMME(A1:A3)' }, B2: { f: 'MOYENNE(A1:A3)' }, B3: { f: 'MIN(A1:A3)' }, B4: { f: 'MAX(A1:A3)' }, B5: { f: 'NB(A1:A3)' } })
    expect(val(wb, 'B1')).toBe(60)
    expect(val(wb, 'B2')).toBe(20)
    expect(val(wb, 'B3')).toBe(10)
    expect(val(wb, 'B4')).toBe(30)
    expect(val(wb, 'B5')).toBe(3)
  })

  it('références en chaîne et relatives/absolues', () => {
    const wb = wb1({ A1: { v: 5 }, B1: { f: 'A1*2' }, B2: { f: 'B1+$A$1' } })
    expect(val(wb, 'B1')).toBe(10)
    expect(val(wb, 'B2')).toBe(15)
  })

  it('SI / ET / OU / NON', () => {
    const wb = wb1({
      A1: { v: 15 },
      B1: { f: 'SI(A1>10;"grand";"petit")' },
      B2: { f: 'ET(A1>10;VRAI)' },
      B3: { f: 'OU(FAUX;A1<100)' },
      B4: { f: 'NON(FAUX)' }
    })
    expect(val(wb, 'B1')).toBe('grand')
    expect(val(wb, 'B2')).toBe(true)
    expect(val(wb, 'B3')).toBe(true)
    expect(val(wb, 'B4')).toBe(true)
  })

  it('division par zéro, fonction inconnue, texte non numérique', () => {
    const wb = wb1({ A1: { f: '1/0' }, A2: { f: 'INCONNUE(1)' }, A3: { f: '"abc"+1' } })
    expect(val(wb, 'A1')).toEqual({ e: '#DIV/0!' })
    expect(val(wb, 'A2')).toEqual({ e: '#NOM?' })
    expect(val(wb, 'A3')).toEqual({ e: '#VALEUR!' })
  })

  it('référence circulaire → #CIRC!', () => {
    const wb = wb1({ A1: { f: 'B1+1' }, B1: { f: 'A1+1' } })
    expect(val(wb, 'A1')).toEqual({ e: '#CIRC!' })
    expect(val(wb, 'B1')).toEqual({ e: '#CIRC!' })
  })

  it('référence inter-feuilles Feuil2!A1', () => {
    const s1: Sheet = { id: 's1', name: 'Feuil 1', cells: { A1: { f: "'Feuil 2'!A1*10" } } }
    const s2: Sheet = { id: 's2', name: 'Feuil 2', cells: { A1: { v: 4 } } }
    const wb: Workbook = { sheets: [s1, s2], activeSheetId: 's1', activeCell: 'A1' }
    recalcWorkbook(wb)
    expect(s1.cells.A1.v).toBe(40)
  })
})

describe('saisie cellule', () => {
  it('parseInput', () => {
    expect(parseInput('=A1+B1')).toEqual({ f: 'A1+B1' })
    expect(parseInput('12,5')).toEqual({ v: 12.5 })
    expect(parseInput('VRAI')).toEqual({ v: true })
    expect(parseInput('bonjour')).toEqual({ v: 'bonjour' })
  })
  it('fmtDisplay', () => {
    expect(fmtDisplay(null)).toBe('')
    expect(fmtDisplay(0.1 + 0.2)).toBe('0.3')
    expect(fmtDisplay(true)).toBe('VRAI')
    expect(fmtDisplay({ e: '#DIV/0!' })).toBe('#DIV/0!')
  })
})

describe('copier : ajustement des références', () => {
  it('shiftRefs décale les relatifs, garde les absolus', () => {
    const n = parseFormula('A1+$B$2+B1')
    const s = serializeFormula(shiftRefs(n, 2, 3))
    expect(s).toBe('C4+$B$2+D4')
  })
})

describe('export CSV', () => {
  it('séparateur « ; », décimale « , », BOM, échappement', () => {
    const wb = wb1({ A1: { v: 'Nom' }, B1: { v: 12.5 }, A2: { v: 'a;b' }, A3: { f: 'B1*2' } })
    const csv = csvExport(wb.sheets[0])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\n')
    expect(lines[0]).toBe('Nom;12,5')
    expect(lines[1]).toBe('"a;b";')
    expect(lines[2]).toBe('25;')
  })
})

describe('vue tri/filtre (PR A)', () => {
  it('viewRows : tri croissant/décroissant sur une colonne, clés A1 inchangées', async () => {
    const { viewRows, emptyView } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's1', name: 'F', cells: { A1: { v: 'b' }, A2: { v: 'a' }, A3: { v: 'c' }, B1: { v: 3 }, B2: { v: 1 }, B3: { v: 2 } } }
    const asc = viewRows(sh, { sort: { col: 0, dir: 1 }, filters: {} })
    expect(asc).toEqual([1, 0, 2])
    const desc = viewRows(sh, { sort: { col: 0, dir: -1 }, filters: {} })
    expect(desc).toEqual([2, 0, 1])
    const numAsc = viewRows(sh, { sort: { col: 1, dir: 1 }, filters: {} })
    expect(numAsc).toEqual([1, 2, 0])
    expect(emptyView().sort).toBeNull()
  })

  it('viewRows : filtre par valeurs de colonne', async () => {
    const { viewRows } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's1', name: 'F', cells: { A1: { v: 'x' }, A2: { v: 'y' }, A3: { v: 'x' } } }
    expect(viewRows(sh, { sort: null, filters: { 0: ['x'] } })).toEqual([0, 2])
    expect(viewRows(sh, { sort: null, filters: { 0: ['x', 'y'] } })).toEqual([0, 1, 2])
  })
})

describe('TSV (PR A)', () => {
  it('serialize/parse roundtrip, formules en =…', async () => {
    const { tsvSerializeRange, tsvParse, parseInput } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's1', name: 'F', cells: { A1: { v: 'txt' }, B1: { v: 12.5 }, A2: { f: 'B1*2' } } }
    const tsv = tsvSerializeRange(sh, 0, 0, 1, 1)
    expect(tsv).toBe('txt\t12.5\n=B1*2\t')
    const grid = tsvParse(tsv)
    expect(grid).toEqual([['txt', '12.5'], ['=B1*2', '']])
    expect(parseInput(grid[1][0])).toEqual({ f: 'B1*2' })
  })
})

describe('barre de statut + recherche (PR A)', () => {
  it('statusOf', async () => {
    const { statusOf } = await import('../src/apps/taol/logic')
    expect(statusOf([1, 2, 'a', null, true])).toEqual({ nb: 2, somme: 3, moyenne: 1.5 })
    expect(statusOf([])).toEqual({ nb: 0, somme: 0, moyenne: null })
  })
  it('searchCells trouve valeurs et formules', async () => {
    const { searchCells } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's1', name: 'F', cells: { A1: { v: 'Lapin' }, B2: { f: 'A1&"-2026"' }, C3: { v: 42 } } }
    expect(searchCells(sh, 'lapin').map((p) => p.row)).toEqual([0])
    expect(searchCells(sh, 'a1').length).toBeGreaterThanOrEqual(1)
    expect(searchCells(sh, 'zzz')).toEqual([])
  })
})
