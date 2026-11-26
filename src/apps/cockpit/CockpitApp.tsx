import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell, { AppSkeleton } from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import { dayKey, focusByDay, lastDays, WIP_LIMIT, wipExceeded } from './logic'
import {
  addSession,
  delRoutine,
  delTask,
  getShutdown,
  listChecks,
  listSessions,
  listShutdowns,
  listTasks,
  putCheck,
  putRoutine,
  putSession,
  putShutdown,
  putTask,
  seedRoutines,
  uid,
  type CkDayCheck,
  type CkRoutine,
  type CkSession,
  type CkShutdown,
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
  routines: CkRoutine[]
  checks: CkDayCheck[]
  shutdown: CkShutdown | undefined
  shutdownDays: string[]
  today: string
  days: string[]
  reload: () => Promise<void>
  saveTask: (t: CkTask) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addSess: (s: CkSession) => Promise<void>
  putSess: (s: CkSession) => Promise<void>
  toggleCheck: (routineId: string, done: boolean) => Promise<void>
  saveShutdown: (done: boolean, note: string) => Promise<void>
  addRoutine: (label: string, icon: string) => Promise<void>
  removeRoutine: (id: string) => Promise<void>
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
  const [routines, setRoutines] = useState<CkRoutine[]>([])
  const [checks, setChecks] = useState<CkDayCheck[]>([])
  const [shutdown, setShutdown] = useState<CkShutdown | undefined>(undefined)
  const [shutdownDays, setShutdownDays] = useState<string[]>([])
  const [today, setToday] = useState(dayKey(new Date()))
  const todayRef = useRef(today)
  todayRef.current = today

  const reload = useCallback(async () => {
    const t = dayKey(new Date())
    const [s, ta, r, c, sh, shs] = await Promise.all([
      listSessions(),
      listTasks(),
      seedRoutines(),
      listChecks(t),
      getShutdown(t),
      listShutdowns()
    ])
    setSessions(s)
    setTasks(ta)
    setRoutines(r)
    setChecks(c)
    setShutdown(sh)
    setShutdownDays(shs.filter((x) => x.done).map((x) => x.day))
    setToday(t)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
    const iv = setInterval(() => {
      if (dayKey(new Date()) !== todayRef.current) void reload()
    }, 30000)
    return () => clearInterval(iv)
  }, [reload])

  const saveTask = useCallback(
    async (t: CkTask) => {
      await putTask(t)
      setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)))
    },
    []
  )
  const deleteTask = useCallback(async (id: string) => {
    await delTask(id)
    setTasks((prev) => prev.filter((x) => x.id !== id))
  }, [])
  const addSess = useCallback(async (s: CkSession) => {
    await addSession(s)
    setSessions((prev) => [...prev, s].sort((a, b) => a.at - b.at))
  }, [])
  const putSess = useCallback(async (s: CkSession) => {
    await putSession(s)
    setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)))
  }, [])
  const toggleCheck = useCallback(
    async (routineId: string, done: boolean) => {
      const t = dayKey(new Date())
      const existing = checks.find((c) => c.day === t && c.routineId === routineId)
      const row: CkDayCheck = existing
        ? { ...existing, done }
        : { id: uid(), day: t, routineId, done }
      await putCheck(row)
      setChecks((prev) => {
        const i = prev.findIndex((c) => c.id === row.id)
        if (i >= 0) return prev.map((c) => (c.id === row.id ? row : c))
        return [...prev, row]
      })
    },
    [checks]
  )
  const saveShutdown = useCallback(
    async (done: boolean, note: string) => {
      const t = dayKey(new Date())
      const row: CkShutdown = { day: t, done, note, at: Date.now() }
      await putShutdown(row)
      setShutdown(row)
      setShutdownDays((prev) => (done && !prev.includes(t) ? [...prev, t] : prev.filter((d) => d !== t || done)))
      notify(done ? 'Rituel de fermeture noté 🌙' : 'Rituel annulé')
    },
    []
  )
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

  const days = lastDays(7)
  const todayMin = focusByDay(sessions, [today])[0]?.min ?? 0
  const doing = tasks.filter((t) => t.col === 'doing').length

  const ctx: CkCtx = {
    sessions,
    tasks,
    routines,
    checks,
    shutdown,
    shutdownDays,
    today,
    days,
    reload,
    saveTask,
    deleteTask,
    addSess,
    putSess,
    toggleCheck,
    saveShutdown,
    addRoutine,
    removeRoutine
  }

  const sidebar = (
    <nav className="ck-nav">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          className={`ck-nav-item${view === v.id ? ' active' : ''}`}
          onClick={() => setView(v.id)}
        >
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
          <span className={`ck-side-stat-num${wipExceeded(doing) ? ' warn' : ''}`}>
            {doing}/{WIP_LIMIT}
          </span>
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
