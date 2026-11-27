import { createAppDb, uid, kvOf } from '../../shared/db'
import type { Workbook, Sheet } from './logic'
import { recalcWorkbook } from './logic'

export { uid }

export const db = createAppDb('skouar-taol', [{ version: 1, stores: { kv: 'key' } }])
const kv = kvOf(db)

const WB_KEY = 'workbook'

export function seedWorkbook(): Workbook {
  const sh: Sheet = {
    id: uid(),
    name: 'Feuil 1',
    cells: {
      A1: { v: 'Élève' },
      B1: { v: 'Note' },
      A2: { v: 'Ana' },
      B2: { v: 15 },
      A3: { v: 'Tom' },
      B3: { v: 12 },
      A4: { v: 'Moyenne' },
      B4: { f: 'MOYENNE(B2:B3)' }
    }
  }
  const wb: Workbook = { sheets: [sh], activeSheetId: sh.id, activeCell: 'A1' }
  recalcWorkbook(wb)
  return wb
}

export async function loadWorkbook(): Promise<Workbook> {
  try {
    const v = await kv.loadKV<Workbook>(WB_KEY)
    if (v && Array.isArray(v.sheets) && v.sheets.length > 0 && typeof v.activeSheetId === 'string') {
      recalcWorkbook(v)
      return v
    }
  } catch {
    // IDB indisponible : on ne touche à rien, on repart sur le seed en mémoire
  }
  return seedWorkbook()
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
export function saveWorkbook(wb: Workbook): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void kv.saveKV(WB_KEY, wb).catch(() => {
      /* stockage indisponible : on garde l'état en mémoire */
    })
  }, 400)
}
