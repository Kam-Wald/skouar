import { createAppDb, kvOf, uid } from '../../shared/db'
import { seedData, type FichoramaData } from './logic'

export { uid }

export const db = createAppDb('skouar-fichorama', [{ version: 1, stores: { kv: 'key' } }])
const kv = kvOf(db)

const DATA_KEY = 'data'

export async function loadData(): Promise<FichoramaData> {
  try {
    const v = await kv.loadKV<FichoramaData>(DATA_KEY)
    if (v && v.version === 1 && Array.isArray(v.categories) && Array.isArray(v.fiches)) return v
  } catch {
    // IDB indisponible : on ne touche à rien, on repart sur le seed en mémoire
  }
  return seedData()
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
export function saveData(d: FichoramaData): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void kv.saveKV(DATA_KEY, d).catch(() => {
      /* stockage indisponible : on garde l'état en mémoire */
    })
  }, 400)
}
