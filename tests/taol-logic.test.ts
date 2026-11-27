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

describe('mise en forme (PR B)', () => {
  it('fmtWithStyle : formats de nombre', async () => {
    const { fmtWithStyle } = await import('../src/apps/taol/logic')
    expect(fmtWithStyle(0.5, { numFmt: 'percent' })).toBe('50 %')
    expect(fmtWithStyle(1234.5, { numFmt: 'number' })).toContain('234,50')
    expect(fmtWithStyle(1234.5, { numFmt: 'euro' })).toContain('€')
    expect(fmtWithStyle('2026-01-05', { numFmt: 'date' })).toBe('05/01/2026')
    expect(fmtWithStyle(42)).toBe('42')
    expect(fmtWithStyle('x', { numFmt: 'text' })).toBe('x')
    expect(fmtWithStyle(42, { numFmt: 'general' })).toBe('42')
  })

  it('applyStyle pose et efface des styles sur une plage', async () => {
    const { applyStyle } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's', name: 'F', cells: { A1: { v: 1 } } }
    applyStyle(sh, { c1: 0, r1: 0, c2: 1, r2: 0 }, { bold: true, color: '#ff0000', align: 'center' })
    expect(sh.cells.A1.s).toEqual({ bold: true, color: '#ff0000', align: 'center' })
    expect(sh.cells.B1.s).toEqual({ bold: true, color: '#ff0000', align: 'center' })
    applyStyle(sh, { c1: 0, r1: 0, c2: 0, r2: 0 }, { bold: null, color: '' })
    expect(sh.cells.A1.s).toEqual({ align: 'center' })
    applyStyle(sh, { c1: 0, r1: 0, c2: 0, r2: 0 }, { align: null })
    expect(sh.cells.A1.s).toBeUndefined()
    expect(sh.cells.B1.s?.bold).toBe(true)
  })

  it('fusion / coveredBy / unmerge', async () => {
    const { mergeCells, coveredBy, unmergeAt } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's', name: 'F', cells: { A1: { v: 'x' }, B2: { v: 2 }, C3: { v: 3 } } }
    const anchor = mergeCells(sh, { c1: 0, r1: 0, c2: 1, r2: 1 })
    expect(anchor).toBe('A1')
    expect(sh.cells.B2).toBeUndefined()
    expect(sh.cells.C3).toBeDefined()
    expect(coveredBy(sh, 0, 0)).toBe('A1')
    expect(coveredBy(sh, 1, 1)).toBe('A1')
    expect(coveredBy(sh, 5, 5)).toBeNull()
    unmergeAt(sh, 1, 1)
    expect(coveredBy(sh, 1, 1)).toBeNull()
    expect(sh.merged && Object.keys(sh.merged).length).toBe(0)
  })

  it('cfMatch', async () => {
    const { cfMatch } = await import('../src/apps/taol/logic')
    const rule = { col: 0, op: '>' as const, value: 10, bg: '#fee2e2' }
    expect(cfMatch(rule, 11)).toBe(true)
    expect(cfMatch(rule, 10)).toBe(false)
    expect(cfMatch(rule, '11')).toBe(false)
    expect(cfMatch(rule, null)).toBe(false)
    expect(cfMatch({ ...rule, op: '<' as const }, 9)).toBe(true)
    expect(cfMatch({ ...rule, op: '<' as const }, 10)).toBe(false)
  })

  it('colSparkMax par colonne + setColWidth clamp', async () => {
    const { colSparkMax, setColWidth } = await import('../src/apps/taol/logic')
    const sh: Sheet = { id: 's', name: 'F', cells: { A1: { v: 5 }, A2: { v: -20 }, B1: { v: 999 }, AA1: { v: 12345 } } }
    expect(colSparkMax(sh, 0)).toBe(20)
    expect(colSparkMax(sh, 1)).toBe(999)
    expect(colSparkMax(sh, 26)).toBe(12345)
    setColWidth(sh, 0, 500)
    expect(sh.widths?.[0]).toBe(400)
    setColWidth(sh, 1, 10)
    expect(sh.widths?.[1]).toBe(30)
    setColWidth(sh, 0, null)
    expect(sh.widths?.[0]).toBeUndefined()
    expect(sh.widths?.[1]).toBe(30)
  })
})

describe('structure (PR C) : insérer/supprimer lignes & colonnes', () => {
  it('noms de feuille avec espace : roundtrip quoté', async () => {
    const { parseFormula, serializeFormula } = await import('../src/apps/taol/logic')
    expect(serializeFormula(parseFormula("'Feuil 1'!A1+Data!B2"))).toBe("'Feuil 1'!A1+Data!B2")
    expect(serializeFormula(parseFormula('SOMME(#REF!;B1)'))).toBe('SOMME(#REF!;B1)')
  })

  it('insertRowsWb décale cellules, refs (absolus, inter-feuilles) — les refs au-dessus ne bougent pas', async () => {
    const { insertRowsWb } = await import('../src/apps/taol/logic')
    const wb: Workbook = {
      sheets: [
        { id: 's1', name: 'Feuil 1', cells: { A1: { v: 10 }, A3: { f: '$A$1+A1*2' }, B5: { v: 9 } } },
        { id: 's2', name: 'Data', cells: { A1: { f: "'Feuil 1'!A3+Data!B5" } } }
      ],
      activeSheetId: 's1',
      activeCell: 'A1'
    }
    insertRowsWb(wb, 's1', 1, 2)
    const s1 = wb.sheets[0]
    expect(s1.cells.A1).toEqual({ v: 10 })
    expect(s1.cells.A3).toBeUndefined()
    expect(s1.cells.A5).toEqual({ f: '$A$1+A1*2' })
    expect(s1.cells.B7).toEqual({ v: 9 })
    expect(wb.sheets[1].cells.A1.f).toBe("'Feuil 1'!A5+Data!B5")
  })

  it('deleteRowsWb : plage rognée, cellules supprimées, #REF! si ref supprimée, refs au-delà reculent', async () => {
    const { deleteRowsWb } = await import('../src/apps/taol/logic')
    const wb: Workbook = {
      sheets: [
        {
          id: 's1',
          name: 'F',
          cells: { A1: { f: 'SOMME(A2:A4)' }, A2: { v: 1 }, A3: { v: 2 }, A4: { v: 3 }, A5: { v: 5 }, A6: { f: 'A5+1' }, B1: { f: 'A3' } }
        }
      ],
      activeSheetId: 's1',
      activeCell: 'A1'
    }
    deleteRowsWb(wb, 's1', 1, 2)
    const s1 = wb.sheets[0]
    expect(s1.cells.A1.f).toBe('SOMME(A2:A2)')
    expect(s1.cells.A2).toEqual({ v: 3 })
    expect(s1.cells.A3).toEqual({ v: 5 })
    expect(s1.cells.A4).toEqual({ f: 'A3+1' })
    expect(s1.cells.A5).toBeUndefined()
    expect(s1.cells.B1.f).toBe('#REF!')
    expect(serializeFormula(parseFormula(s1.cells.B1.f!))).toBe('#REF!')
  })

  it('insertColsWb/deleteColsWb : cellules, largeurs, validations, cf, fusions suivent la colonne', async () => {
    const { insertColsWb, deleteColsWb } = await import('../src/apps/taol/logic')
    const sh: Sheet = {
      id: 's1',
      name: 'F',
      cells: { B2: { v: 1 } },
      widths: { 1: 120 },
      validations: { 1: ['a', 'b'] },
      cf: [{ col: 1, op: '>', value: 5, bg: '#fee2e2' }],
      merged: { B2: { c1: 1, r1: 1, c2: 2, r2: 1 } }
    }
    const wb: Workbook = { sheets: [sh], activeSheetId: 's1', activeCell: 'A1' }
    insertColsWb(wb, 's1', 0, 1)
    expect(sh.cells.C2).toEqual({ v: 1 })
    expect(sh.cells.B2).toBeUndefined()
    expect(sh.widths?.[2]).toBe(120)
    expect(sh.validations?.[2]).toEqual(['a', 'b'])
    expect(sh.cf?.[0].col).toBe(2)
    expect(sh.merged?.C2).toEqual({ c1: 2, r1: 1, c2: 3, r2: 1 })
    deleteColsWb(wb, 's1', 2, 2)
    expect(sh.cells.C2).toBeUndefined()
    expect(sh.widths?.[2]).toBeUndefined()
    expect(sh.validations?.[2]).toBeUndefined()
    expect(sh.cf ?? []).toHaveLength(0)
  })
})
