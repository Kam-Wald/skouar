import { useRef, useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { energyByDay, estVsActual, focusByDay, fmt, goalProgress, interruptionsByDay, pareto, reviewSummary, weekStartOf } from '../logic'
import { notify } from '../../../shared/notify'
import { useDismiss } from '../../../shared/useDismiss'
import type { CkSession } from '../store'

const dayLabel = (day: string): string => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })

function dayKeyLocal(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function SessionEditor({ s, ctx, onClose }: { s: CkSession; ctx: CkCtx; onClose: () => void }): JSX.Element {
  const [label, setLabel] = useState(s.label)
  const [min, setMin] = useState(Math.round(s.actualSec / 60))
  const [energy, setEnergy] = useState(s.energy ?? 0)
  useDismiss('ck-sess', true, onClose)
  return (
    <div className="ck-pop-backdrop">
      <div className="ck-pop" data-pop="ck-sess">
        <h3>✏️ Session</h3>
        <input className="ck-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="ck-edit-grid">
          <label>
            Durée (min)
            <input type="number" min={0} max={999} value={min} onChange={(e) => setMin(Number(e.target.value))} />
          </label>
          <label>
            Énergie
            <select value={energy} onChange={(e) => setEnergy(Number(e.target.value))}>
              <option value={0}>—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
            </select>
          </label>
        </div>
        <div className="ck-pop-actions">
          <button className="ck-btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="ck-btn danger"
            onClick={async () => {
              await ctx.delSess(s.id)
              notify('Session supprimée')
              onClose()
            }}
          >
            🗑 Supprimer
          </button>
          <button
            className="ck-btn primary"
            onClick={async () => {
              await ctx.putSess({ ...s, label, actualSec: Math.max(0, Math.round(min)) * 60, energy: energy || null })
              notify('Session corrigée')
              onClose()
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewView({ ctx }: { ctx: CkCtx }): JSX.Element {
  const [editSess, setEditSess] = useState<string | null>(null)
  const [newGoal, setNewGoal] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fb = focusByDay(ctx.sessions, ctx.days)
  const max = Math.max(1, ...fb.map((d) => d.min))
  const weekMin = fb.reduce((a, d) => a + d.min, 0)
  const weekSessions = ctx.sessions.filter((s) => ctx.days.includes(dayKeyLocal(s.at)))
  const eva = estVsActual(ctx.tasks.filter((t) => t.col !== 'done'), weekSessions)
  const eb = energyByDay(ctx.sessions, ctx.days)
  const ib = interruptionsByDay(ctx.sessions, ctx.days)
  const p = pareto(ctx.tasks)
  const done = ctx.tasks.filter((t) => t.col === 'done')
  const lines = reviewSummary({ weekMin, est: eva.est, act: eva.act, paretoRows: p.length, totalDone: done.length })
  const recent = [...ctx.sessions].sort((a, b) => b.at - a.at).slice(0, 12)
  const ws = weekStartOf()
  const gp = goalProgress(ctx.goals, ctx.tasks, ws)
  const editSession = ctx.sessions.find((s) => s.id === editSess)

  return (
    <div className="ck-review">
      <section className="ck-card">
        <h3 className="ck-card-title">📊 Focus sur 7 jours</h3>
        <div className="ck-bars">
          {fb.map((d) => (
            <div key={d.day} className="ck-bar-col">
              <span className="ck-bar-val">{d.min > 0 ? `${Math.round(d.min)}` : ''}</span>
              <div className="ck-bar-track">
                <div className={`ck-bar${d.day === ctx.today ? ' today' : ''}`} style={{ height: `${Math.max(2, (d.min / max) * 100)}%` }} />
              </div>
              <span className="ck-bar-label">{dayLabel(d.day)}</span>
            </div>
          ))}
        </div>
        <div className="ck-energy-row">
          {eb.map((d) => (
            <div key={d.day} className="ck-energy-cell" title={`${dayLabel(d.day)} : énergie ${d.avg ?? '—'}/5`}>
              <span className="ck-energy-dot" data-e={d.avg ?? 0} />
              <span>{d.avg !== null ? d.avg.toFixed(1) : '—'}</span>
            </div>
          ))}
        </div>
        <div className="ck-energy-row">
          {ib.map((d) => (
            <div key={d.day} className="ck-energy-cell" title={`${dayLabel(d.day)} : ${d.n} interruption(s)`}>
              <span className="ck-int-dot">{d.n > 0 ? '😵' : ''}</span>
              <span>{d.n > 0 ? d.n : '—'}</span>
            </div>
          ))}
        </div>
        <p className="ck-hint">Ligne du haut : énergie moyenne notée après chaque focus. Ligne du bas : interruptions notées (😵).</p>
      </section>

      <section className="ck-card">
        <h3 className="ck-card-title">🎯 Objectifs de la semaine (semaine du {new Date(`${ws}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})</h3>
        <ul className="ck-goals">
          {gp.map((g) => (
            <li key={g.id} className="ck-goal-row">
              <span className="ck-pareto-title">{g.label}</span>
              <span className="ck-pareto-bar"><span style={{ width: `${g.pct * 100}%` }} /></span>
              <span className="ck-pareto-val">{g.total ? `${g.done}/${g.total} tâches` : 'aucune tâche liée'}</span>
              <button className="ck-mini" onClick={() => void ctx.removeGoal(g.id)}>✕</button>
            </li>
          ))}
          {gp.length === 0 && <li className="ck-hint">1 à 3 objectifs pour la semaine, puis lie-les aux tâches dans l’éditeur de carte 🎯.</li>}
        </ul>
        <div className="ck-add-row">
          <input
            className="ck-input"
            placeholder="+ Nouvel objectif de semaine…"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newGoal.trim()) { void ctx.addGoal(newGoal.trim()); setNewGoal('') } }}
          />
          <button className="ck-btn" onClick={() => { if (newGoal.trim()) { void ctx.addGoal(newGoal.trim()); setNewGoal('') } }}>+</button>
        </div>
      </section>

      <div className="ck-review-grid">
        <section className="ck-card">
          <h3 className="ck-card-title">⚖️ Prévu vs réel (7 jours)</h3>
          <div className="ck-vs">
            <div>
              <span className="ck-vs-num">{eva.est}</span>
              <span className="ck-vs-label">min prévus (tâches ouvertes)</span>
            </div>
            <div>
              <span className="ck-vs-num">{eva.act}</span>
              <span className="ck-vs-label">min réelles de focus</span>
            </div>
          </div>
        </section>

        <section className="ck-card">
          <h3 className="ck-card-title">📐 Pareto (tâches terminées)</h3>
          {p.length === 0 && <p className="ck-hint">Termine des tâches avec une valeur ★ pour voir quelles tâches portent 80 % du résultat.</p>}
          <ul className="ck-pareto">
            {p.map((r) => (
              <li key={r.id}>
                <span className="ck-pareto-title">{r.title}</span>
                <span className="ck-pareto-bar"><span style={{ width: `${r.cum * 100}%` }} /></span>
                <span className="ck-pareto-val">★{r.value} · {Math.round(r.cum * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="ck-card">
        <h3 className="ck-card-title">📝 Revue honnête de la semaine</h3>
        <ul className="ck-review-lines">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="ck-card">
        <h3 className="ck-card-title">🕘 Historique des sessions (clic ✏️ pour corriger)</h3>
        {recent.length === 0 && <p className="ck-hint">Aucune session pour l’instant — lance un minuteur dans « Aujourd’hui ».</p>}
        <ul className="ck-sess">
          {recent.map((s) => (
            <li key={s.id}>
              <span className={`ck-sess-kind ${s.kind}`}>{s.kind === 'focus' ? '🍅' : s.kind === 'pause' ? '☕' : s.kind === 'interrupt' ? '😵' : '⏱'}</span>
              <span className="ck-sess-label">{s.label}</span>
              <span className="ck-sess-meta">
                {new Date(s.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {fmt(s.actualSec)}
                {s.energy ? ` · ⚡${s.energy}` : ''}
              </span>
              <button className="ck-mini" onClick={() => setEditSess(s.id)}>✏️</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="ck-card">
        <h3 className="ck-card-title">💾 Données</h3>
        <div className="ck-pop-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="ck-btn" onClick={() => void ctx.exportData()}>💾 Exporter en JSON</button>
          <button className="ck-btn" onClick={() => fileRef.current?.click()}>📥 Importer un JSON</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) ctx.importData(f).catch(() => notify('Import impossible : fichier non reconnu'))
              e.target.value = ''
            }}
          />
        </div>
        <p className="ck-hint">Export complet (tâches, sessions, routines, rappels…) pour sauvegarder ou transférer. L’import remplace les données actuelles.</p>
      </section>

      {editSession && <SessionEditor s={editSession} ctx={ctx} onClose={() => setEditSess(null)} />}
    </div>
  )
}
