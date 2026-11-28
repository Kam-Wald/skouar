import { createAppDb, kvOf } from '../../shared/db'
import { migrateConfig, migrateEvents, seedConfig, type SalvetoConfig, type SalvetoEvent } from './logic'

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

const eventsT = () => db.table<SalvetoEvent, string>('events')

export async function loadEvents(): Promise<SalvetoEvent[]> {
  try {
    return migrateEvents(await eventsT().toArray())
  } catch {
    // IDB indisponible : liste vide en mémoire, aucune écriture
    return []
  }
}

export async function saveEvent(e: SalvetoEvent): Promise<void> {
  try {
    await eventsT().put(e)
  } catch {
    /* stockage indisponible : l’événement reste en mémoire */
  }
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    await eventsT().delete(id)
  } catch {
    /* idem */
  }
}
