import { createAppDb, kvOf, uid } from '../../shared/db'

export { uid }

export interface CkSession {
  id: string
  taskId: string | null
  label: string
  kind: 'focus' | 'pause' | 'custom'
  plannedSec: number
  actualSec: number
  at: number
  energy: number | null
}

export interface CkTask {
  id: string
  title: string
  col: 'todo' | 'doing' | 'done'
  estMin: number
  urgent: boolean
  important: boolean
  color: string
  value: number
  createdAt: number
  doneAt: number | null
  actualMin: number
}

export interface CkRoutine {
  id: string
  label: string
  icon: string
}

export interface CkDayCheck {
  id: string
  day: string
  routineId: string
  done: boolean
}

export interface CkShutdown {
  day: string
  done: boolean
  note: string
  at: number
}

export const db = createAppDb('skouar-cockpit', [
  {
    version: 1,
    stores: {
      sessions: 'id, at, taskId',
      tasks: 'id, col, createdAt, doneAt',
      routines: 'id',
      dayChecks: 'id, day, routineId',
      shutdowns: 'day',
      kv: 'id'
    }
  }
])

export const sessionsT = db.table<CkSession, string>('sessions')
export const tasksT = db.table<CkTask, string>('tasks')
export const routinesT = db.table<CkRoutine, string>('routines')
export const dayChecksT = db.table<CkDayCheck, string>('dayChecks')
export const shutdownsT = db.table<CkShutdown, string>('shutdowns')

const kv = kvOf(db)
export const loadKV = kv.loadKV
export const saveKV = kv.saveKV

export async function seedRoutines(): Promise<CkRoutine[]> {
  const existing = await routinesT.toArray()
  if (existing.length) return existing
  const defs: CkRoutine[] = [
    { id: uid(), label: 'Boire un verre d’eau', icon: '💧' },
    { id: uid(), label: 'Pause yeux 20-20-20 (5 min)', icon: '👀' },
    { id: uid(), label: 'Étirements 2 min', icon: '🧘' },
    { id: uid(), label: 'Air frais 2 min', icon: '🌬️' }
  ]
  await routinesT.bulkPut(defs)
  return defs
}

export const listSessions = (): Promise<CkSession[]> => sessionsT.orderBy('at').toArray()
export const addSession = (s: CkSession): Promise<string> => sessionsT.put(s).then(() => s.id)
export const putSession = (s: CkSession): Promise<string> => sessionsT.put(s).then(() => s.id)
export const delRoutine = (id: string): Promise<void> => routinesT.delete(id)
export const putRoutine = (r: CkRoutine): Promise<string> => routinesT.put(r).then(() => r.id)
export const listShutdowns = (): Promise<CkShutdown[]> => shutdownsT.toArray()
export const listTasks = (): Promise<CkTask[]> => tasksT.orderBy('createdAt').toArray()
export const putTask = (t: CkTask): Promise<string> => tasksT.put(t).then(() => t.id)
export const delTask = (id: string): Promise<void> => tasksT.delete(id)
export const listChecks = (day: string): Promise<CkDayCheck[]> => dayChecksT.where('day').equals(day).toArray()
export const putCheck = (c: CkDayCheck): Promise<string> => dayChecksT.put(c).then(() => c.id)
export const getShutdown = (day: string): Promise<CkShutdown | undefined> => shutdownsT.get(day)
export const delCheck = (id: string): Promise<void> => dayChecksT.delete(id)
export const putShutdown = (s: CkShutdown): Promise<string> => shutdownsT.put(s).then(() => s.day)
