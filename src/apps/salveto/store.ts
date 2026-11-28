import { createAppDb, kvOf } from '../../shared/db'
import { migrateConfig, seedConfig, type SalvetoConfig } from './logic'

export const db = createAppDb('skouar-salveto', [
  { version: 1, stores: { kv: 'key', events: 'id, type, date' } }
])
const kv = kvOf(db)

const CONFIG_KEY = 'config'

export async function loadConfig(): Promise<SalvetoConfig> {
  try {
    const v = await kv.loadKV<unknown>(CONFIG_KEY)
    const m = migrateConfig(v)
    if (m) return m
  } catch {
    // IDB indisponible : on repart sur le seed en mémoire, aucune écriture silencieuse
  }
  return seedConfig()
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
export function saveConfig(c: SalvetoConfig): void {
  localStorage.setItem('skouar:salveto:desktopOnly', c.desktopOnly ? '1' : '0')
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void kv.saveKV(CONFIG_KEY, c).catch(() => {
      /* stockage indisponible : l’état reste en mémoire */
    })
  }, 400)
}
