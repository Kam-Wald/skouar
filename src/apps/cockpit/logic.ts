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
