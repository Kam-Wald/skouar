import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell, { AppSkeleton } from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { dayKey, focusByDay, lastDays, spawnRecurring, weekStartOf, WIP_LIMIT, wipExceeded } from './logic'
import { notifyOS } from './fx'
import {
  addSession,
  delDayItem,
  delDayItemsOfDay,
  delGoal,
  delReminder,
  delRoutine,
  delSession,
  delSubtask,
  delSubtasksOf,
  delTask,
  dueReminders,
  exportAll,
  getShutdown,
  importAll,
  listChecks,
  listDayItems,
  listGoals,
  listReminders,
  listSessions,
  listShutdowns,
  listSubtasks,
  listTasks,
  loadKV,
  putCheck,
  putDayItem,
  putGoal,
  putReminder,
  putRoutine,
  putSession,
  putShutdown,
  putSubtask,
  putTask,
  saveKV,
  seedRoutines,
  uid,
  type CkDayCheck,
  type CkDayItem,
  type CkExport,
  type CkGoal,
  type CkReminder,
  type CkRoutine,
  type CkSession,
  type CkShutdown,
  type CkSubtask,
  type CkTask
} from './store'
import TodayView from './views/TodayView'
import KanbanView from './views/KanbanView'
import MatrixView from './views/MatrixView'
import ReviewView from './views/ReviewView'
import AdviceView from './views/AdviceView'

export type ViewId = 'today' | 'kanban' | 'matrix' | 'review' | 'advice'

export interface CkCtx {
  sessions: CkSession[]
  tasks: CkTask[]
  subtasks: CkSubtask[]
  routines: CkRoutine[]
  checks: CkDayCheck[]
  dayItems: CkDayItem[]
  shutdown: CkShutdown | undefined
  shutdownDays: string[]
  goals: CkGoal[]
  reminders: CkReminder[]
  todayTask: string
  today: string
  days: string[]
  reload: () => Promise<void>
  saveTask: (t: CkTask) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addSess: (s: CkSession) => Promise<void>
  putSess: (s: CkSession) => Promise<void>
  delSess: (id: string) => Promise<void>
  toggleCheck: (routineId: string, done: boolean) => Promise<void>
  toggleDayItem: (id: string, done: boolean) => Promise<void>
  addDayItem: (label: string) => Promise<void>
  removeDayItem: (id: string) => Promise<void>
  resetToday: () => Promise<void>
  saveShutdown: (done: boolean, note: string) => Promise<void>
  addRoutine: (label: string, icon: string) => Promise<void>
  removeRoutine: (id: string) => Promise<void>
  addSubtask: (taskId: string, label: string) => Promise<void>
  toggleSubtask: (st: CkSubtask, done: boolean) => Promise<void>
  removeSubtask: (id: string) => Promise<void>
  addGoal: (label: string) => Promise<void>
  removeGoal: (id: string) => Promise<void>
  addReminder: (at: number, msg: string) => Promise<void>
  removeReminder: (id: string) => Promise<void>
  setTodayTask: (id: string) => Promise<void>
  exportData: () => Promise<void>
  importData: (file: File) => Promise<void>
}

const VIEWS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: '⏱️' },
  { id: 'kanban', label: 'Kanban', icon: '🗂️' },
  { id: 'matrix', label: 'Matrice', icon: '🎯' },
  { id: 'review', label: 'Revue', icon: '📊' },
  { id: 'advice', label: 'Conseils', icon: '💡' }
]

export default function CockpitApp(): JSX.Element {
  const [view, setView] = useState<ViewId>('today')
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<CkSession[]>([])
  const [tasks, setTasks] = useState<CkTask[]>([])
  const [subtasks, setSubtasks] = useState<CkSubtask[]>([])
  const [routines, setRoutines] = useState<CkRoutine[]>([])
  const [checks, setChecks] = useState<CkDayCheck[]>([])
  const [dayItems, setDayItems] = useState<CkDayItem[]>([])
  const [shutdown, setShutdown] = useState<CkShutdown | undefined>(undefined)
  const [shutdownDays, setShutdownDays] = useState<string[]>([])
  const [goals, setGoals] = useState<CkGoal[]>([])
  const [reminders, setReminders] = useState<CkReminder[]>([])
  const [todayTask, setTodayTaskState] = useState('')
  const [today, setToday] = useState(dayKey(new Date()))
  const todayRef = useRef(today)
  todayRef.current = today

  const reload = useCallback(async () => {
    const t = dayKey(new Date())
    const [s, ta, st, r, c, di, sh, shs, gl, rm, tt] = await Promise.all([
      listSessions(),
      listTasks(),
      listSubtasks(),
      seedRoutines(),
      listChecks(t),
      listDayItems(t),
      getShutdown(t),
      listShutdowns(),
      listGoals(),
      listReminders(),
      loadKV<string>('todayTask')
    ])
    const spawned = spawnRecurring(ta, Date.now(), uid)
    for (const sp of spawned) await putTask(sp)
    const allTasks = spawned.length ? [...ta, ...spawned].sort((a, b) => a.createdAt - b.createdAt) : ta
    setSessions(s)
    setTasks(allTasks)
    setSubtasks(st)
    setRoutines(r)
    setChecks(c)
    setDayItems(di)
    setShutdown(sh)
    setShutdownDays(shs.filter((x) => x.done).map((x) => x.day))
    setGoals(gl)
    setReminders(rm)
    setTodayTaskState(tt ?? '')
    setToday(t)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
    const ivDay = setInterval(() => {
      if (dayKey(new Date()) !== todayRef.current) void reload()
    }, 30000)
    const ivRem = setInterval(async () => {
      const due = await dueReminders(Date.now())
      for (const r of due) {
        notify(`🔔 ${r.msg}`)
        notifyOS(`🔔 ${r.msg}`)
        await putReminder({ ...r, done: true })
      }
      if (due.length) void reload()
    }, 15000)
    return () => {
      clearInterval(ivDay)
      clearInterval(ivRem)
    }
  }, [reload])

  const saveTask = useCallback(async (t: CkTask) => {
    await putTask(t)
    setTasks((prev) => {
      const i = prev.findIndex((x) => x.id === t.id)
      if (i < 0) return [...prev, t].sort((a, b) => a.createdAt - b.createdAt)
      return prev.map((x) => (x.id === t.id ? t : x))
    })
  }, [])
  const deleteTask = useCallback(async (id: string) => {
    await delTask(id)
    await delSubtasksOf(id)
    setTasks((prev) => prev.filter((x) => x.id !== id))
    setSubtasks((prev) => prev.filter((s) => s.taskId !== id))
  }, [])
  const addSess = useCallback(async (s: CkSession) => {
    await addSession(s)
    setSessions((prev) => [...prev, s].sort((a, b) => a.at - b.at))
  }, [])
  const putSess = useCallback(async (s: CkSession) => {
    await putSession(s)
    setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)))
  }, [])
  const delSess = useCallback(async (id: string) => {
    await delSession(id)
    setSessions((prev) => prev.filter((x) => x.id !== id))
  }, [])
  const toggleCheck = useCallback(
    async (routineId: string, done: boolean) => {
      const t = dayKey(new Date())
      const existing = checks.find((c) => c.day === t && c.routineId === routineId)
      const row: CkDayCheck = existing ? { ...existing, done } : { id: uid(), day: t, routineId, done }
      await putCheck(row)
      setChecks((prev) => {
        const i = prev.findIndex((c) => c.id === row.id)
        if (i >= 0) return prev.map((c) => (c.id === row.id ? row : c))
        return [...prev, row]
      })
    },
    [checks]
  )
  const toggleDayItem = useCallback(async (id: string, done: boolean) => {
    const it = dayItems.find((x) => x.id === id)
    if (!it) return
    await putDayItem({ ...it, done })
    setDayItems((prev) => prev.map((x) => (x.id === id ? { ...x, done } : x)))
  }, [dayItems])
  const addDayItem = useCallback(async (label: string) => {
    const row: CkDayItem = { id: uid(), day: dayKey(new Date()), label, done: false }
    await putDayItem(row)
    setDayItems((prev) => [...prev, row])
  }, [])
  const removeDayItem = useCallback(async (id: string) => {
    await delDayItem(id)
    setDayItems((prev) => prev.filter((x) => x.id !== id))
  }, [])
  const resetToday = useCallback(async () => {
    const t = dayKey(new Date())
    for (const c of checks) await putCheck({ ...c, done: false })
    await delDayItemsOfDay(t)
    setChecks((prev) => prev.map((c) => ({ ...c, done: false })))
    setDayItems([])
    notify('Journée remise à zéro 🧹 (2 cases laissées)')
  }, [checks])
  const saveShutdown = useCallback(async (done: boolean, note: string) => {
    const t = dayKey(new Date())
    const row: CkShutdown = { day: t, done, note, at: Date.now() }
    await putShutdown(row)
    setShutdown(row)
    setShutdownDays((prev) => (done && !prev.includes(t) ? [...prev, t] : prev.filter((d) => d !== t || done)))
    notify(done ? 'Rituel de fermeture noté 🌙' : 'Rituel annulé')
  }, [])
  const addRoutine = useCallback(async (label: string, icon: string) => {
    const r: CkRoutine = { id: uid(), label, icon }
    await putRoutine(r)
    setRoutines((prev) => [...prev, r])
  }, [])
  const removeRoutine = useCallback(async (id: string) => {
    await delRoutine(id)
    setRoutines((prev) => prev.filter((r) => r.id !== id))
    setChecks((prev) => prev.filter((c) => c.routineId !== id))
  }, [])
  const addSubtask = useCallback(async (taskId: string, label: string) => {
    const st: CkSubtask = { id: uid(), taskId, label, done: false }
    await putSubtask(st)
    setSubtasks((prev) => [...prev, st])
  }, [])
  const toggleSubtask = useCallback(async (st: CkSubtask, done: boolean) => {
    await putSubtask({ ...st, done })
    setSubtasks((prev) => prev.map((x) => (x.id === st.id ? { ...x, done } : x)))
  }, [])
  const removeSubtask = useCallback(async (id: string) => {
    await delSubtask(id)
    setSubtasks((prev) => prev.filter((x) => x.id !== id))
  }, [])
  const addGoal = useCallback(async (label: string) => {
    const g: CkGoal = { id: uid(), weekStart: weekStartOf(), label }
    await putGoal(g)
    setGoals((prev) => [...prev, g])
    notify('Objectif ajouté 🎯')
  }, [])
  const removeGoal = useCallback(async (id: string) => {
    await delGoal(id)
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }, [])
  const addReminder = useCallback(async (at: number, msg: string) => {
    const r: CkReminder = { id: uid(), at, msg, done: false }
    await putReminder(r)
    setReminders((prev) => [...prev, r].sort((a, b) => a.at - b.at))
    notify('Rappel programmé 🔔')
  }, [])
  const removeReminder = useCallback(async (id: string) => {
    await delReminder(id)
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }, [])
  const setTodayTask = useCallback(async (id: string) => {
    await saveKV('todayTask', id)
    setTodayTaskState(id)
  }, [])
  const exportData = useCallback(async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cockpit-export-${dayKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    notify('Données exportées 💾')
  }, [])
  const importData = useCallback(async (file: File) => {
    const text = await file.text()
    const data = JSON.parse(text) as CkExport
    if (data.app !== 'skouar-cockpit') throw new Error('Fichier non reconnu')
    await importAll(data)
    await reload()
    notify('Données importées 📥')
  }, [reload])

  const days = lastDays(7)
  const todayMin = focusByDay(sessions, [today])[0]?.min ?? 0
  const doing = tasks.filter((t) => t.col === 'doing').length

  const ctx: CkCtx = {
    sessions, tasks, subtasks, routines, checks, dayItems, shutdown, shutdownDays, goals, reminders, todayTask,
    today, days, reload, saveTask, deleteTask, addSess, putSess, delSess, toggleCheck, toggleDayItem, addDayItem,
    removeDayItem, resetToday, saveShutdown, addRoutine, removeRoutine, addSubtask, toggleSubtask, removeSubtask,
    addGoal, removeGoal, addReminder, removeReminder, setTodayTask, exportData, importData
  }

  const sidebar = (
    <nav className="ck-nav">
      {VIEWS.map((v) => (
        <button key={v.id} className={`ck-nav-item${view === v.id ? ' active' : ''}`} onClick={() => setView(v.id)}>
          <span className="ck-nav-icon">{v.icon}</span>
          <span>{v.label}</span>
        </button>
      ))}
      <div className="ck-side-stats">
        <div>
          <span className="ck-side-stat-num">{Math.round(todayMin)}</span>
          <span className="ck-side-stat-label">min de focus aujourd’hui</span>
        </div>
        <div>
          <span className={`ck-side-stat-num${wipExceeded(doing) ? ' warn' : ''}`}>{doing}/{WIP_LIMIT}</span>
          <span className="ck-side-stat-label">tâches en cours</span>
        </div>
      </div>
    </nav>
  )

  if (loading) return <AppSkeleton />

  return (
    <AppShell
      appId="cockpit"
      appName="Cockpit"
      logo={`${import.meta.env.BASE_URL}app-icons/cockpit.svg`}
      sidebar={sidebar}
      mainClass="blocs-main ck-main"
    >
      {view === 'today' && <TodayView ctx={ctx} />}
      {view === 'kanban' && <KanbanView ctx={ctx} />}
      {view === 'matrix' && <MatrixView ctx={ctx} />}
      {view === 'review' && <ReviewView ctx={ctx} />}
      {view === 'advice' && <AdviceView ctx={ctx} />}
    </AppShell>
  )
}

