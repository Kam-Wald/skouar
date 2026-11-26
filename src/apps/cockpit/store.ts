import { createAppDb, kvOf, uid } from '../../shared/db'

export { uid }

export interface CkSession {
  id: string
  taskId: string | null
  label: string
  kind: 'focus' | 'pause' | 'custom' | 'interrupt'
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
  due: string | null
  tags: string[]
  goalId: string | null
  recur: string | null
}

export interface CkSubtask {
  id: string
  taskId: string
  label: string
  done: boolean
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

export interface CkDayItem {
  id: string
  day: string
  label: string
  done: boolean
}

export interface CkShutdown {
  day: string
  done: boolean
  note: string
  at: number
}

export interface CkGoal {
  id: string
  weekStart: string
  label: string
}

export interface CkReminder {
  id: string
  at: number
  msg: string
  done: boolean
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
  },
  {
    version: 2,
    stores: {
      subtasks: 'id, taskId',
      dayItems: 'id, day',
      goals: 'id, weekStart',
      reminders: 'id, at, done'
    }
  }
])

export const sessionsT = db.table<CkSession, string>('sessions')
export const tasksT = db.table<CkTask, string>('tasks')
export const subtasksT = db.table<CkSubtask, string>('subtasks')
export const routinesT = db.table<CkRoutine, string>('routines')
export const dayChecksT = db.table<CkDayCheck, string>('dayChecks')
export const dayItemsT = db.table<CkDayItem, string>('dayItems')
export const shutdownsT = db.table<CkShutdown, string>('shutdowns')
export const goalsT = db.table<CkGoal, string>('goals')
export const remindersT = db.table<CkReminder, string>('reminders')

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

const normTask = (t: CkTask): CkTask => ({
  ...t,
  due: t.due ?? null,
  tags: t.tags ?? [],
  goalId: t.goalId ?? null,
  recur: t.recur ?? null
})

export const listSessions = (): Promise<CkSession[]> => sessionsT.orderBy('at').toArray()
export const addSession = (s: CkSession): Promise<string> => sessionsT.put(s).then(() => s.id)
export const putSession = (s: CkSession): Promise<string> => sessionsT.put(s).then(() => s.id)
export const delSession = (id: string): Promise<void> => sessionsT.delete(id)
export const listTasks = (): Promise<CkTask[]> => tasksT.orderBy('createdAt').toArray().then((ts) => ts.map(normTask))
export const putTask = (t: CkTask): Promise<string> => tasksT.put(t).then(() => t.id)
export const delTask = (id: string): Promise<void> => tasksT.delete(id)
export const listSubtasks = (): Promise<CkSubtask[]> => subtasksT.toArray()
export const putSubtask = (s: CkSubtask): Promise<string> => subtasksT.put(s).then(() => s.id)
export const delSubtask = (id: string): Promise<void> => subtasksT.delete(id)
export const delSubtasksOf = async (taskId: string): Promise<void> => { await subtasksT.where('taskId').equals(taskId).delete() }
export const listChecks = (day: string): Promise<CkDayCheck[]> => dayChecksT.where('day').equals(day).toArray()
export const putCheck = (c: CkDayCheck): Promise<string> => dayChecksT.put(c).then(() => c.id)
export const delCheck = (id: string): Promise<void> => dayChecksT.delete(id)
export const listDayItems = (day: string): Promise<CkDayItem[]> => dayItemsT.where('day').equals(day).toArray()
export const putDayItem = (i: CkDayItem): Promise<string> => dayItemsT.put(i).then(() => i.id)
export const delDayItem = (id: string): Promise<void> => dayItemsT.delete(id)
export const delDayItemsOfDay = async (day: string): Promise<void> => { await dayItemsT.where('day').equals(day).delete() }
export const getShutdown = (day: string): Promise<CkShutdown | undefined> => shutdownsT.get(day)
export const putShutdown = (s: CkShutdown): Promise<string> => shutdownsT.put(s).then(() => s.day)
export const listShutdowns = (): Promise<CkShutdown[]> => shutdownsT.toArray()
export const putRoutine = (r: CkRoutine): Promise<string> => routinesT.put(r).then(() => r.id)
export const delRoutine = (id: string): Promise<void> => routinesT.delete(id)
export const listGoals = (): Promise<CkGoal[]> => goalsT.toArray()
export const putGoal = (g: CkGoal): Promise<string> => goalsT.put(g).then(() => g.id)
export const delGoal = (id: string): Promise<void> => goalsT.delete(id)
export const listReminders = (): Promise<CkReminder[]> => remindersT.orderBy('at').toArray()
export const putReminder = (r: CkReminder): Promise<string> => remindersT.put(r).then(() => r.id)
export const delReminder = (id: string): Promise<void> => remindersT.delete(id)
export const dueReminders = (now: number): Promise<CkReminder[]> =>
  remindersT.orderBy('at').toArray().then((rs) => rs.filter((r) => !r.done && r.at <= now))

export interface CkExport {
  app: string
  at: number
  sessions: CkSession[]
  tasks: CkTask[]
  subtasks: CkSubtask[]
  routines: CkRoutine[]
  dayChecks: CkDayCheck[]
  dayItems: CkDayItem[]
  shutdowns: CkShutdown[]
  goals: CkGoal[]
  reminders: CkReminder[]
}

export async function exportAll(): Promise<CkExport> {
  const [sessions, tasks, subtasks, routines, dayChecks, dayItems, shutdowns, goals, reminders] = await Promise.all([
    sessionsT.toArray(),
    tasksT.toArray(),
    subtasksT.toArray(),
    routinesT.toArray(),
    dayChecksT.toArray(),
    dayItemsT.toArray(),
    shutdownsT.toArray(),
    goalsT.toArray(),
    remindersT.toArray()
  ])
  return { app: 'skouar-cockpit', at: Date.now(), sessions, tasks, subtasks, routines, dayChecks, dayItems, shutdowns, goals, reminders }
}

export async function importAll(data: CkExport): Promise<void> {
  await Promise.all([
    sessionsT.clear(), tasksT.clear(), subtasksT.clear(), routinesT.clear(),
    dayChecksT.clear(), dayItemsT.clear(), shutdownsT.clear(), goalsT.clear(), remindersT.clear()
  ])
  await Promise.all([
    sessionsT.bulkPut(data.sessions ?? []),
    tasksT.bulkPut(data.tasks ?? []),
    subtasksT.bulkPut(data.subtasks ?? []),
    routinesT.bulkPut(data.routines ?? []),
    dayChecksT.bulkPut(data.dayChecks ?? []),
    dayItemsT.bulkPut(data.dayItems ?? []),
    shutdownsT.bulkPut(data.shutdowns ?? []),
    goalsT.bulkPut(data.goals ?? []),
    remindersT.bulkPut(data.reminders ?? [])
  ])
}
