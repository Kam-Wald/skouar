export const fmt = (sec: number): string => {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const lastDays = (n: number, now = new Date()): string[] => {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push(dayKey(d))
  }
  return out
}

export interface PomSegment {
  kind: 'focus' | 'pause'
  sec: number
  label: string
}

export function pomodoroPlan(focusMin: number, pauseMin: number, longMin: number, cycles: number): PomSegment[] {
  const out: PomSegment[] = []
  const c = Math.max(1, Math.min(8, Math.round(cycles)))
  for (let i = 0; i < c; i++) {
    out.push({ kind: 'focus', sec: Math.max(1, focusMin) * 60, label: `Focus ${i + 1}/${c}` })
    const last = i === c - 1
    out.push({ kind: 'pause', sec: Math.max(1, last ? longMin : pauseMin) * 60, label: last ? 'Longue pause' : 'Pause' })
  }
  return out
}

export interface SessLike {
  kind: string
  actualSec: number
  at: number
  energy?: number | null
}

export function focusByDay(sessions: SessLike[], days: string[]): { day: string; min: number }[] {
  const map = new Map<string, number>()
  for (const d of days) map.set(d, 0)
  for (const s of sessions) {
    if (s.kind !== 'focus') continue
    const k = dayKey(new Date(s.at))
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + s.actualSec / 60)
  }
  return days.map((day) => ({ day, min: Math.round((map.get(day) ?? 0) * 10) / 10 }))
}

export function estVsActual(tasks: { estMin: number }[], sessions: SessLike[]): { est: number; act: number } {
  const est = tasks.reduce((a, t) => a + t.estMin, 0)
  const act = Math.round(sessions.filter((s) => s.kind === 'focus').reduce((a, s) => a + s.actualSec, 0) / 60)
  return { est, act }
}

export interface TaskLike {
  id: string
  title: string
  col: string
  estMin: number
  urgent?: boolean
  important?: boolean
  value?: number
  doneAt?: number | null
}

export function pareto(tasks: TaskLike[]): { id: string; title: string; value: number; cum: number }[] {
  const done = tasks.filter((t) => t.doneAt && (t.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const total = done.reduce((a, t) => a + (t.value ?? 0), 0)
  if (!total) return []
  const rows: { id: string; title: string; value: number; cum: number }[] = []
  let acc = 0
  for (const t of done) {
    acc += t.value ?? 0
    rows.push({ id: t.id, title: t.title, value: t.value ?? 0, cum: acc / total })
    if (acc / total >= 0.8) break
  }
  return rows
}

export type Quad = 'do-now' | 'plan' | 'delegate' | 'drop'

export const quadOf = (t: { urgent: boolean; important: boolean }): Quad =>
  t.urgent && t.important ? 'do-now' : !t.urgent && t.important ? 'plan' : t.urgent && !t.important ? 'delegate' : 'drop'

export const QUADS: Record<Quad, { label: string; hint: string; advice: string }> = {
  'do-now': { label: 'Faire maintenant', hint: 'urgent + important', advice: 'Bloque du temps maintenant, une seule à la fois.' },
  plan: { label: 'Planifier', hint: 'important, pas urgent', advice: 'Mets un créneau cette semaine dans ton agenda.' },
  delegate: { label: 'Déléguer', hint: 'urgent, pas important', advice: 'Confie-la à quelqu’un, ou timeboxe-la à 15 min.' },
  drop: { label: 'Supprimer', hint: 'ni urgent ni important', advice: 'Si elle traîne depuis 2 semaines sans avancer, supprime-la.' }
}

export const WIP_LIMIT = 3

export const wipExceeded = (doing: number, limit = WIP_LIMIT): boolean => doing > limit

export function energyByDay(sessions: SessLike[], days: string[]): { day: string; avg: number | null }[] {
  const sums = new Map<string, { s: number; n: number }>()
  for (const s of sessions) {
    if (!s.energy) continue
    const k = dayKey(new Date(s.at))
    const e = sums.get(k) ?? { s: 0, n: 0 }
    e.s += s.energy
    e.n++
    sums.set(k, e)
  }
  return days.map((day) => {
    const e = sums.get(day)
    return { day, avg: e && e.n ? Math.round((e.s / e.n) * 10) / 10 : null }
  })
}

export function bestEnergyHour(sessions: SessLike[]): number | null {
  const byHour = new Map<number, { s: number; n: number }>()
  for (const s of sessions) {
    if (!s.energy) continue
    const h = new Date(s.at).getHours()
    const e = byHour.get(h) ?? { s: 0, n: 0 }
    e.s += s.energy
    e.n++
    byHour.set(h, e)
  }
  let best: number | null = null
  let bestAvg = 0
  for (const [h, e] of byHour) {
    const avg = e.s / e.n
    if (e.n >= 2 && avg > bestAvg) {
      bestAvg = avg
      best = h
    }
  }
  return best
}

export interface Advice {
  icon: string
  text: string
}

export function adviceFor(input: {
  tasks: TaskLike[]
  sessions: SessLike[]
  days: string[]
  today: string
  shutdownDays: string[]
  now?: Date
}): Advice[] {
  const out: Advice[] = []
  const { tasks, sessions, today, shutdownDays } = input
  const todo = tasks.filter((t) => t.col === 'todo')
  const doing = tasks.filter((t) => t.col === 'doing')
  const big = todo.find((t) => t.estMin > 120)
  if (big) out.push({ icon: '✂️', text: `« ${big.title} » est estimée à ${Math.round((big.estMin / 60) * 10) / 10} h : découpe-la en étapes de moins de 2 h.` })
  if (wipExceeded(doing.length)) out.push({ icon: '🚧', text: `Tu as ${doing.length} tâches en cours (limite ${WIP_LIMIT}) : termine-en une avant d'en commencer une autre.` })
  const twoMin = todo.filter((t) => t.estMin <= 2)
  if (twoMin.length) out.push({ icon: '⚡', text: `Règle des 2 minutes : ${twoMin.length} tâche(s) à ≤ 2 min dans ta liste — fais-les maintenant.` })
  const todayInt = sessions.filter((s) => s.kind === 'interrupt' && dayKey(new Date(s.at)) === today).length
  if (todayInt >= 3) out.push({ icon: '\ud83d\ude35', text: `${todayInt} interruptions aujourd’hui : essaie un bloc de 25 min avec le téléphone éteint.` })
  const prev = input.days[input.days.length - 2]
  if (prev && !shutdownDays.includes(prev) && !shutdownDays.includes(today)) out.push({ icon: '🌙', text: 'Pas de rituel de fermeture hier : ce soir, note juste la prochaine action de demain.' })
  const todayFocus = sessions.filter((s) => s.kind === 'focus' && dayKey(new Date(s.at)) === today).reduce((a, s) => a + s.actualSec, 0) / 60
  if (todayFocus < 25) out.push({ icon: '🎯', text: `Aujourd’hui : ${Math.round(todayFocus)} min de focus. 25 min, c’est le seuil pour avancer sereinement.` })
  const beh = bestEnergyHour(sessions)
  if (beh !== null) out.push({ icon: '🔋', text: `Ton énergie est la plus haute vers ${beh} h : garde tes tâches importantes pour ce créneau.` })
  const p = pareto(tasks)
  if (p.length >= 2) out.push({ icon: '📐', text: `${p.length} tâche(s) terminée(s) = 80 % de ta valeur : concentre-toi d’abord sur ce type de tâches.` })
  return out.slice(0, 5)
}

export function reviewSummary(input: { weekMin: number; est: number; act: number; paretoRows: number; totalDone: number }): string[] {
  const lines: string[] = []
  lines.push(`Cette semaine : ${Math.round(input.weekMin)} min de focus sur 7 jours (${Math.round(input.weekMin / 7)} min/jour en moyenne).`)
  if (input.est > 0 && input.act > 0) {
    const ratio = input.act / input.est
    lines.push(
      ratio <= 1.1
        ? `Prévu vs réel : ${input.act} min réelles pour ${input.est} min prévues — tes estimations sont justes.`
        : `Prévu vs réel : ${input.act} min réelles pour ${input.est} min prévues (${Math.round(ratio * 100)} %) — tes tâches prennent plus de temps que prévu : réduis les estimations ou découpe.`
    )
  }
  if (input.paretoRows > 0 && input.totalDone > 0) lines.push(`Pareto : ${input.paretoRows} tâche(s) sur ${input.totalDone} terminée(s) concentrent 80 % de la valeur.`)
  return lines
}

export const BREATH = [
  { label: 'Inspire', sec: 4 },
  { label: 'Retiens', sec: 7 },
  { label: 'Expire', sec: 8 }
] as const

export const weekStartOf = (d = new Date()): string => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return dayKey(x)
}

export type DueChip = 'today' | 'late' | 'future' | null

export const dueChip = (t: { due?: string | null }, today: string): DueChip => {
  if (!t.due) return null
  if (t.due === today) return 'today'
  return t.due < today ? 'late' : 'future'
}

export function interruptionsByDay(sessions: SessLike[], days: string[]): { day: string; n: number }[] {
  const map = new Map<string, number>()
  for (const d of days) map.set(d, 0)
  for (const s of sessions) {
    if (s.kind !== 'interrupt') continue
    const k = dayKey(new Date(s.at))
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1)
  }
  return days.map((day) => ({ day, n: map.get(day) ?? 0 }))
}

export interface RecurLike {
  id: string
  title: string
  col: string
  estMin: number
  urgent?: boolean
  important?: boolean
  color?: string
  value?: number
  tags?: string[]
  due?: string | null
  goalId?: string | null
  recur?: string | null
  doneAt?: number | null
  actualMin?: number
  createdAt: number
}

export function nextRecurAt(recur: string, afterAt: number): number | null {
  const d = new Date(afterAt)
  const atMidnight = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  if (recur === 'daily') return atMidnight(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
  const wd = Number(recur)
  if (!Number.isInteger(wd) || wd < 0 || wd > 6) return null
  let add = (wd - d.getDay() + 7) % 7
  if (add === 0) add = 7
  return atMidnight(new Date(d.getFullYear(), d.getMonth(), d.getDate() + add))
}

export function spawnRecurring<T extends RecurLike>(tasks: T[], now = Date.now(), uidFn: () => string = () => Math.random().toString(36).slice(2)): T[] {
  const out: T[] = []
  for (const t of tasks) {
    if (t.col !== 'done' || !t.recur || !t.doneAt) continue
    const next = nextRecurAt(t.recur, t.doneAt)
    if (next === null || next > now) continue
    const openClone = tasks.some((x) => x.id !== t.id && x.col !== 'done' && x.title === t.title && (x.recur ?? null) === t.recur)
    if (openClone) continue
    out.push({ ...t, id: uidFn(), col: 'todo', createdAt: now, doneAt: null, actualMin: 0, due: null } as T)
  }
  return out
}

export function goalProgress(
  goals: { id: string; weekStart: string; label: string }[],
  tasks: { goalId?: string | null; col: string }[],
  weekStart: string
): { id: string; label: string; done: number; total: number; pct: number }[] {
  return goals
    .filter((g) => g.weekStart === weekStart)
    .map((g) => {
      const linked = tasks.filter((t) => t.goalId === g.id)
      const done = linked.filter((t) => t.col === 'done').length
      return { id: g.id, label: g.label, done, total: linked.length, pct: linked.length ? done / linked.length : 0 }
    })
}

export const breathPos = (phaseIdx: number, remaining: number, total: number): number => {
  if (total <= 0) return 0
  if (phaseIdx === 0) return 1 - remaining / total
  if (phaseIdx === 1) return 1
  return remaining / total
}

export const parseTaskLines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)

export const allTags = (tasks: { tags?: string[] }[]): string[] =>
  [...new Set(tasks.flatMap((t) => t.tags ?? []))].sort((a, b) => a.localeCompare(b))

export const RECUR_LABELS: Record<string, string> = {
  daily: 'Tous les jours',
  '0': 'Dimanche',
  '1': 'Lundi',
  '2': 'Mardi',
  '3': 'Mercredi',
  '4': 'Jeudi',
  '5': 'Vendredi',
  '6': 'Samedi'
}

export interface CheckLike {
  done: boolean
  count?: number
}

export function checkState(routine: { target?: number }, check?: CheckLike | null): { mode: 'bool' | 'count'; done: boolean; count: number; target: number } {
  const target = routine.target ?? 0
  if (target <= 0) return { mode: 'bool', done: !!check?.done, count: check?.done ? 1 : 0, target: 0 }
  const count = Math.max(0, check?.count ?? 0)
  return { mode: 'count', done: count >= target, count, target }
}

export function weekTrend(sessions: SessLike[], now = new Date()): { thisMin: number; prevMin: number; pct: number | null } {
  const all = lastDays(14, now)
  const fb = focusByDay(sessions, all)
  const thisMin = fb.slice(7).reduce((a, d) => a + d.min, 0)
  const prevMin = fb.slice(0, 7).reduce((a, d) => a + d.min, 0)
  return { thisMin: Math.round(thisMin), prevMin: Math.round(prevMin), pct: prevMin > 0 ? Math.round(((thisMin - prevMin) / prevMin) * 100) : null }
}

export type SortMode = 'created' | 'due' | 'value' | 'est'

export function sortTasks<T extends { title: string; createdAt: number; due?: string | null; value?: number; estMin: number; tags?: string[] }>(tasks: T[], mode: SortMode, today: string): T[] {
  const out = [...tasks]
  if (mode === 'due') out.sort((a, b) => (a.due ?? '9999') .localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt)
  else if (mode === 'value') out.sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.createdAt - b.createdAt)
  else if (mode === 'est') out.sort((a, b) => b.estMin - a.estMin || a.createdAt - b.createdAt)
  else out.sort((a, b) => a.createdAt - b.createdAt)
  return out
}

export const filterTasks = <T extends { title: string; tags?: string[] }>(tasks: T[], q: string): T[] => {
  const needle = q.trim().toLowerCase()
  if (!needle) return tasks
  return tasks.filter((t) => t.title.toLowerCase().includes(needle) || (t.tags ?? []).some((tg) => tg.toLowerCase().includes(needle)))
}

export function reviewMarkdown(input: {
  weekStart: string
  days: string[]
  fb: { day: string; min: number }[]
  eb: { day: string; avg: number | null }[]
  ib: { day: string; n: number }[]
  eva: { est: number; act: number }
  paretoRows: { title: string; value: number; cum: number }[]
  lines: string[]
  trend: { thisMin: number; prevMin: number; pct: number | null }
}): string {
  const L: string[] = []
  L.push(`# Revue Cockpit — semaine du ${input.weekStart}`)
  L.push('')
  L.push(`Tendance vs semaine précédente : ${input.trend.pct === null ? 'n/a' : `${input.trend.pct > 0 ? '+' : ''}${input.trend.pct} %`} (${input.trend.thisMin} min vs ${input.trend.prevMin} min).`)
  L.push('')
  L.push('## Focus par jour (min)')
  L.push('')
  for (const d of input.fb) L.push(`- ${d.day} : ${Math.round(d.min)} min${input.eb.find((e) => e.day === d.day)?.avg ? ` · énergie ${input.eb.find((e) => e.day === d.day)?.avg}/5` : ''}${input.ib.find((i) => i.day === d.day)?.n ? ` · ${input.ib.find((i) => i.day === d.day)?.n} interruption(s)` : ''}`)
  L.push('')
  L.push(`## Prévu vs réel : ${input.eva.act} min réelles pour ${input.eva.est} min prévus (7 jours)`)
  L.push('')
  if (input.paretoRows.length) {
    L.push('## Pareto (80 % de la valeur)')
    L.push('')
    for (const r of input.paretoRows) L.push(`- ${r.title} — ★${r.value} (${Math.round(r.cum * 100)} % cumulé)`)
    L.push('')
  }
  L.push('## Bilan')
  L.push('')
  for (const l of input.lines) L.push(`- ${l}`)
  L.push('')
  return L.join('\n')
}
