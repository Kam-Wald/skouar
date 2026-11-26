import { useEffect, useRef, useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { BREATH, fmt, pomodoroPlan, type PomSegment } from '../logic'
import { notify } from '../../../shared/notify'
import { useDismiss } from '../../../shared/useDismiss'
import { uid, type CkSession } from '../store'

type Mode = 'pomodoro' | 'countdown' | 'chrono' | 'breath'

interface TimerState {
  mode: Mode
  running: boolean
  label: string
  remaining: number
  total: number
  endAt: number
  plan: PomSegment[]
  segIdx: number
  cycles: number
  phaseIdx: number
}

const IDLE: TimerState = { mode: 'pomodoro', running: false, label: 'Prêt', remaining: 0, total: 0, endAt: 0, plan: [], segIdx: 0, cycles: 0, phaseIdx: 0 }

const R = 52
const CIRC = 2 * Math.PI * R

function beep(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new AC()
    const play = (f: number, t0: number) => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.connect(g)
      g.connect(ac.destination)
      o.frequency.value = f
      g.gain.setValueAtTime(0.12, ac.currentTime + t0)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t0 + 0.3)
      o.start(ac.currentTime + t0)
      o.stop(ac.currentTime + t0 + 0.32)
    }
    play(880, 0)
    play(1174, 0.18)
  } catch {
    /* audio indisponible */
  }
}

function notifyOS(title: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title)
  } catch {
    /* notifications indisponibles */
  }
}

const TECHNIQUES: { label: string; desc: string; icon: string; run: (api: { setMode: (m: Mode) => void; startPomodoro: () => void; startCountdown: (min: number) => void; startChrono: () => void; startBreath: () => void; setFocusMin: (n: number) => void; setPauseMin: (n: number) => void; setLongMin: (n: number) => void; setCycles: (n: number) => void }) => void }[] = [
  {
    label: 'Pomodoro 25/5',
    desc: '4 cycles, longue pause 15 min',
    icon: '🍅',
    run: (a) => {
      a.setFocusMin(25)
      a.setPauseMin(5)
      a.setLongMin(15)
      a.setCycles(4)
      a.setMode('pomodoro')
      a.startPomodoro()
    }
  },
  {
    label: '52/17',
    desc: '2 cycles de focus profond',
    icon: '🎯',
    run: (a) => {
      a.setFocusMin(52)
      a.setPauseMin(17)
      a.setLongMin(30)
      a.setCycles(2)
      a.setMode('pomodoro')
      a.startPomodoro()
    }
  },
  {
    label: 'Respiration 4-7-8',
    desc: 'Inspire 4 s, retiens 7 s, expire 8 s',
    icon: '🌬️',
    run: (a) => {
      a.setMode('breath')
      a.startBreath()
    }
  },
  {
    label: 'Timebox 10 min',
    desc: 'Compte à rebours pour une petite tâche',
    icon: '⏳',
    run: (a) => {
      a.setMode('countdown')
      a.startCountdown(10)
    }
  }
]

export default function TodayView({ ctx }: { ctx: CkCtx }): JSX.Element {
  const [t, setT] = useState<TimerState>(IDLE)
  const [mode, setMode] = useState<Mode>('pomodoro')
  const [focusMin, setFocusMin] = useState(25)
  const [pauseMin, setPauseMin] = useState(5)
  const [longMin, setLongMin] = useState(15)
  const [cycles, setCycles] = useState(4)
  const [cdMin, setCdMin] = useState(25)
  const [taskId, setTaskId] = useState('')
  const [pendingEnergy, setPendingEnergy] = useState<string | null>(null)
  const [newRoutine, setNewRoutine] = useState('')
  const [newIcon, setNewIcon] = useState('🧘')
  const [showShutdown, setShowShutdown] = useState(false)
  const [shChecks, setShChecks] = useState([false, false, false])
  const [shNote, setShNote] = useState('')
  const tRef = useRef(t)
  tRef.current = t
  const taskIdRef = useRef(taskId)
  taskIdRef.current = taskId
  useDismiss('ck-shutdown', showShutdown, () => setShowShutdown(false))

  const saveSession = async (kind: CkSession['kind'], label: string, plannedSec: number, actualSec: number): Promise<CkSession> => {
    const s: CkSession = {
      id: uid(),
      taskId: kind === 'focus' && taskIdRef.current ? taskIdRef.current : null,
      label,
      kind,
      plannedSec,
      actualSec,
      at: Date.now(),
      energy: null
    }
    await ctx.addSess(s)
    if (s.taskId) {
      const task = ctx.tasks.find((x) => x.id === s.taskId)
      if (task) await ctx.saveTask({ ...task, actualMin: task.actualMin + Math.round(actualSec / 60) })
    }
    return s
  }

  const startSeg = (plan: PomSegment[], idx: number): void => {
    const seg = plan[idx]
    setT({ mode: 'pomodoro', running: true, label: seg.label, remaining: seg.sec, total: seg.sec, endAt: Date.now() + seg.sec * 1000, plan, segIdx: idx, cycles: 0, phaseIdx: 0 })
  }

  const expire = async (cur: TimerState): Promise<void> => {
    beep()
    if (cur.mode === 'pomodoro') {
      const seg = cur.plan[cur.segIdx]
      const s = await saveSession(seg.kind, seg.label, seg.sec, seg.sec)
      notifyOS(`${seg.label} terminé`)
      notify(`${seg.label} terminé — ${fmt(seg.sec)}`)
      if (seg.kind === 'focus') setPendingEnergy(s.id)
      if (cur.segIdx + 1 < cur.plan.length) startSeg(cur.plan, cur.segIdx + 1)
      else setT({ ...IDLE, mode: 'pomodoro', label: 'Session terminée 🎉' })
    } else if (cur.mode === 'countdown') {
      await saveSession('custom', 'Compte à rebours', cur.total, cur.total)
      notifyOS('Compte à rebours terminé')
      notify('Compte à rebours terminé')
      setT({ ...IDLE, mode: 'countdown', label: 'Terminé 🎉' })
    } else if (cur.mode === 'breath') {
      if (cur.phaseIdx + 1 < BREATH.length) {
        const ph = BREATH[cur.phaseIdx + 1]
        setT({ ...cur, phaseIdx: cur.phaseIdx + 1, label: ph.label, remaining: ph.sec, total: ph.sec, endAt: Date.now() + ph.sec * 1000 })
      } else {
        const ph = BREATH[0]
        setT({ ...cur, phaseIdx: 0, cycles: cur.cycles + 1, label: `${ph.label} (cycle ${cur.cycles + 1})`, remaining: ph.sec, total: ph.sec, endAt: Date.now() + ph.sec * 1000 })
      }
    }
  }

  useEffect(() => {
    if (!t.running) return
    const iv = setInterval(() => {
      const cur = tRef.current
      if (!cur.running) return
      const rem = Math.max(0, Math.round((cur.endAt - Date.now()) / 1000))
      if (rem <= 0) {
        setT({ ...cur, remaining: 0 })
        void expire(cur)
      } else setT({ ...cur, remaining: rem })
    }, 250)
    return () => clearInterval(iv)
  }, [t.running])

  const startPomodoro = (): void => {
    const plan = pomodoroPlan(focusMin, pauseMin, longMin, cycles)
    startSeg(plan, 0)
  }
  const startCountdown = (min: number): void => {
    const sec = Math.max(1, Math.round(min)) * 60
    setT({ ...IDLE, mode: 'countdown', running: true, label: 'Compte à rebours', remaining: sec, total: sec, endAt: Date.now() + sec * 1000 })
  }
  const startChrono = (): void => {
    setT({ ...IDLE, mode: 'chrono', running: true, label: 'Chrono', remaining: 0, total: 0, endAt: Number.MAX_SAFE_INTEGER })
  }
  const startBreath = (): void => {
    const ph = BREATH[0]
    setT({ ...IDLE, mode: 'breath', running: true, label: ph.label, remaining: ph.sec, total: ph.sec, endAt: Date.now() + ph.sec * 1000 })
  }
  const startChronoAtRef = useRef(0)
  const stopTimer = async (): Promise<void> => {
    const cur = tRef.current
    if (cur.mode === 'chrono') {
      const elapsed = Math.round((Date.now() - startChronoAtRef.current) / 1000)
      if (elapsed >= 1) await saveSession('custom', 'Chrono libre', 0, elapsed)
      notify('Chrono arrêté et enregistré')
    }
    setT({ ...IDLE, mode: cur.mode, label: 'En pause' })
  }
  const doStartChrono = (): void => {
    startChronoAtRef.current = Date.now()
    startChrono()
  }

  const pickEnergy = async (n: number): Promise<void> => {
    if (!pendingEnergy) return
    const s = ctx.sessions.find((x) => x.id === pendingEnergy)
    if (s) await ctx.putSess({ ...s, energy: n })
    setPendingEnergy(null)
    notify(`Énergie notée : ${n}/5`)
  }

  const askNotif = async (): Promise<void> => {
    try {
      const p = await Notification.requestPermission()
      if (p === 'granted') notify('Notifications activées 🔔')
    } catch {
      /* ignoré */
    }
  }

  const frac = t.total > 0 ? t.remaining / t.total : t.mode === 'chrono' ? 1 : 0
  const chronoElapsed = t.mode === 'chrono' && t.running ? Math.max(0, Math.round((Date.now() - startChronoAtRef.current) / 1000)) : t.remaining
  const display = t.mode === 'chrono' ? fmt(chronoElapsed) : fmt(t.remaining)
  const openTasks = ctx.tasks.filter((x) => x.col === 'todo' || x.col === 'doing')
  const checkOf = (rid: string): boolean => !!ctx.checks.find((c) => c.day === ctx.today && c.routineId === rid && c.done)

  return (
    <div className="ck-today">
      <section className="ck-card ck-timer-card">
        <div className="ck-modes">
          {(
            [
              ['pomodoro', '🍅 Pomodoro'],
              ['countdown', '⏳ Compte à rebours'],
              ['chrono', '▶️ Chrono'],
              ['breath', '🌬️ Respiration']
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              className={`ck-chip${mode === m ? ' active' : ''}`}
              onClick={() => {
                setMode(m)
                setT({ ...IDLE, mode: m })
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'pomodoro' && !t.running && (
          <div className="ck-pomo-params">
            <label>
              Focus
              <input type="number" min={1} max={180} value={focusMin} onChange={(e) => setFocusMin(Number(e.target.value))} /> min
            </label>
            <label>
              Pause
              <input type="number" min={1} max={60} value={pauseMin} onChange={(e) => setPauseMin(Number(e.target.value))} /> min
            </label>
            <label>
              Longue
              <input type="number" min={1} max={120} value={longMin} onChange={(e) => setLongMin(Number(e.target.value))} /> min
            </label>
            <label>
              Cycles
              <input type="number" min={1} max={8} value={cycles} onChange={(e) => setCycles(Number(e.target.value))} />
            </label>
          </div>
        )}
        {mode === 'countdown' && !t.running && (
          <div className="ck-pomo-params">
            <label>
              Durée
              <input type="number" min={1} max={240} value={cdMin} onChange={(e) => setCdMin(Number(e.target.value))} /> min
            </label>
          </div>
        )}

        <div className="ck-ring-wrap">
          <svg viewBox="0 0 120 120" className="ck-ring">
            <circle cx="60" cy="60" r={R} className="ck-ring-bg" />
            <circle
              cx="60"
              cy="60"
              r={R}
              className={`ck-ring-fg${t.running ? ' on' : ''}`}
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - frac)}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="ck-ring-center">
            <div className="ck-time">{display}</div>
            <div className="ck-timer-label">{t.label}</div>
            {t.mode === 'breath' && <div className="ck-timer-sub">cycle {t.cycles + 1}</div>}
            {t.mode === 'pomodoro' && t.plan.length > 0 && <div className="ck-timer-sub">segment {t.segIdx + 1}/{t.plan.length}</div>}
          </div>
        </div>

        <div className="ck-timer-controls">
          {!t.running ? (
            <button
              className="ck-btn primary"
              onClick={() => {
                if (mode === 'pomodoro') startPomodoro()
                else if (mode === 'countdown') startCountdown(cdMin)
                else if (mode === 'chrono') doStartChrono()
                else startBreath()
              }}
            >
              ▶ Démarrer
            </button>
          ) : (
            <button className="ck-btn" onClick={() => void stopTimer()}>
              ⏸ Arrêter
            </button>
          )}
          {t.running && t.mode !== 'chrono' && (
            <button
              className="ck-btn ghost"
              onClick={() => {
                const cur = tRef.current
                setT({ ...cur, endAt: Date.now() + 1000 })
              }}
            >
              ⏭ Passer
            </button>
          )}
          <button className="ck-btn ghost" onClick={() => setT({ ...IDLE, mode })}>
            ↺ Reset
          </button>
        </div>

        <label className="ck-task-pick">
          Tâche liée
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">— aucune —</option>
            {openTasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.col === 'doing' ? '▶ ' : ''}
                {x.title}
              </option>
            ))}
          </select>
        </label>

        {pendingEnergy && (
          <div className="ck-energy">
            <span>Énergie pendant ce focus ?</span>
            <div className="ck-energy-btns">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="ck-chip" onClick={() => void pickEnergy(n)}>
                  {n}
                </button>
              ))}
              <button className="ck-chip" onClick={() => setPendingEnergy(null)}>
                ✕
              </button>
            </div>
          </div>
        )}

        <button className="ck-btn ghost ck-notif" onClick={() => void askNotif()}>
          🔔 Activer les notifications de fin de session
        </button>
      </section>

      <div className="ck-today-side">
        <section className="ck-card">
          <h3 className="ck-card-title">✅ Checklist du jour</h3>
          <ul className="ck-checks">
            {ctx.routines.map((r) => (
              <li key={r.id} className="ck-check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={checkOf(r.id)}
                    onChange={(e) => void ctx.toggleCheck(r.id, e.target.checked)}
                  />
                  <span>
                    {r.icon} {r.label}
                  </span>
                </label>
                <button className="ck-mini" title="Supprimer la routine" onClick={() => void ctx.removeRoutine(r.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="ck-add-row">
            <input
              className="ck-input"
              placeholder="Nouvelle routine…"
              value={newRoutine}
              onChange={(e) => setNewRoutine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newRoutine.trim()) {
                  void ctx.addRoutine(newRoutine.trim(), newIcon)
                  setNewRoutine('')
                }
              }}
            />
            <input
              className="ck-input ck-icon-input"
              value={newIcon}
              maxLength={4}
              onChange={(e) => setNewIcon(e.target.value)}
              title="Picto"
            />
            <button
              className="ck-btn"
              onClick={() => {
                if (newRoutine.trim()) {
                  void ctx.addRoutine(newRoutine.trim(), newIcon)
                  setNewRoutine('')
                }
              }}
            >
              +
            </button>
          </div>
        </section>

        <section className="ck-card">
          <h3 className="ck-card-title">🧰 Techniques guidées</h3>
          <div className="ck-tech-grid">
            {TECHNIQUES.map((tc) => (
              <button
                key={tc.label}
                className="ck-tech"
                onClick={() =>
                  tc.run({
                    setMode,
                    startPomodoro,
                    startCountdown,
                    startChrono: doStartChrono,
                    startBreath,
                    setFocusMin,
                    setPauseMin,
                    setLongMin,
                    setCycles
                  })
                }
              >
                <span className="ck-tech-icon">{tc.icon}</span>
                <span className="ck-tech-label">{tc.label}</span>
                <span className="ck-tech-desc">{tc.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="ck-card">
          <h3 className="ck-card-title">🌙 Rituel de fermeture</h3>
          {ctx.shutdown?.done ? (
            <div className="ck-shutdown-done">
              <p>Fait aujourd’hui ✅</p>
              {ctx.shutdown.note && <p className="ck-shutdown-note">« {ctx.shutdown.note} »</p>}
              <button className="ck-btn ghost" onClick={() => setShowShutdown(true)}>
                Modifier
              </button>
            </div>
          ) : (
            <p className="ck-hint">Termine ta journée proprement : note la prochaine action de demain.</p>
          )}
          {!ctx.shutdown?.done && (
            <button className="ck-btn primary" onClick={() => setShowShutdown(true)}>
              🌙 Faire mon rituel de fermeture
            </button>
          )}
        </section>
      </div>

      {showShutdown && (
        <div className="ck-pop-backdrop">
          <div className="ck-pop" data-pop="ck-shutdown">
            <h3>🌙 Rituel de fermeture</h3>
            {[
              'La prochaine action de demain est notée',
              'J’ai vidé ma tête (tout est noté dans Cockpit)',
              'J’ai fermé mes onglets et conversations en cours'
            ].map((label, i) => (
              <label key={i} className="ck-check-row">
                <input
                  type="checkbox"
                  checked={shChecks[i]}
                  onChange={(e) => setShChecks((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span>{label}</span>
              </label>
            ))}
            <textarea
              className="ck-input ck-note"
              placeholder="Prochaine action de demain…"
              value={shNote}
              onChange={(e) => setShNote(e.target.value)}
            />
            <div className="ck-pop-actions">
              <button className="ck-btn ghost" onClick={() => setShowShutdown(false)}>
                Annuler
              </button>
              <button
                className="ck-btn primary"
                onClick={() => {
                  void ctx.saveShutdown(true, shNote)
                  setShowShutdown(false)
                }}
              >
                Terminer ma journée ✅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
