import { createAppDb, kvOf } from '../../shared/db'
import {
  migrateConfig,
  migrateEvents,
  migrateProfil,
  migrateRefs,
  seedConfig,
  seedProfil,
  seedRefs,
  type Attachment,
  type ProfilSante,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs
} from './logic'

export const db = createAppDb('skouar-salveto', [
  { version: 1, stores: { kv: 'key', events: 'id, type, date' } },
  { version: 2, stores: { attachments: 'id, refId, refType, createdAt' } }
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

const REFS_KEY = 'refs'

export async function loadRefs(): Promise<SalvetoRefs> {
  try {
    const v = await kv.loadKV<unknown>(REFS_KEY)
    const m = migrateRefs(v)
    if (m) return m
  } catch {
    // IDB indisponible : seed en mémoire, aucune écriture
  }
  return seedRefs()
}

let refsTimer: ReturnType<typeof setTimeout> | undefined
export function saveRefs(r: SalvetoRefs): void {
  if (refsTimer) clearTimeout(refsTimer)
  refsTimer = setTimeout(() => {
    void kv.saveKV(REFS_KEY, r).catch(() => {
      /* stockage indisponible : l’état reste en mémoire */
    })
  }, 300)
}

const PROFIL_KEY = 'profil'

export async function loadProfil(): Promise<ProfilSante> {
  try {
    const v = await kv.loadKV<unknown>(PROFIL_KEY)
    const m = migrateProfil(v)
    if (m) return m
  } catch {
    // IDB indisponible : seed en mémoire, aucune écriture
  }
  return seedProfil()
}

let profilTimer: ReturnType<typeof setTimeout> | undefined
export function saveProfil(p: ProfilSante): void {
  if (profilTimer) clearTimeout(profilTimer)
  profilTimer = setTimeout(() => {
    void kv.saveKV(PROFIL_KEY, p).catch(() => {
      /* stockage indisponible : l’état reste en mémoire */
    })
  }, 300)
}

const attT = () => db.table<Attachment, string>('attachments')

export async function loadAttachments(): Promise<Attachment[]> {
  try {
    return await attT().toArray()
  } catch {
    return []
  }
}

export async function saveAttachment(a: Attachment): Promise<void> {
  try {
    await attT().put(a)
  } catch {
    /* stockage indisponible : la PJ reste en mémoire */
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  try {
    await attT().delete(id)
  } catch {
    /* idem */
  }
}
