import type { CkCtx } from '../CockpitApp'
import { energyByDay, estVsActual, focusByDay, fmt, pareto, reviewSummary } from '../logic'

const dayLabel = (day: string): string =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })

export default function ReviewView({ ctx }: { ctx: CkCtx }): JSX.Element {
  const fb = focusByDay(ctx.sessions, ctx.days)
  const max = Math.max(1, ...fb.map((d) => d.min))
  const weekMin = fb.reduce((a, d) => a + d.min, 0)
  const weekSessions = ctx.sessions.filter((s) => ctx.days.includes(dayKeyLocal(s.at)))
  const eva = estVsActual(ctx.tasks.filter((t) => t.col !== 'done'), weekSessions)
  const eb = energyByDay(ctx.sessions, ctx.days)
  const p = pareto(ctx.tasks)
  const done = ctx.tasks.filter((t) => t.col === 'done')
  const lines = reviewSummary({ weekMin, est: eva.est, act: eva.act, paretoRows: p.length, totalDone: done.length })
  const recent = [...ctx.sessions].sort((a, b) => b.at - a.at).slice(0, 10)

  return (
    <div className="ck-review">
      <section className="ck-card">
        <h3 className="ck-card-title">📊 Focus sur 7 jours</h3>
        <div className="ck-bars">
          {fb.map((d) => (
            <div key={d.day} className="ck-bar-col">
              <span className="ck-bar-val">{d.min > 0 ? `${Math.round(d.min)}` : ''}</span>
              <div className="ck-bar-track">
                <div
                  className={`ck-bar${d.day === ctx.today ? ' today' : ''}`}
                  style={{ height: `${Math.max(2, (d.min / max) * 100)}%` }}
                />
              </div>
              <span className="ck-bar-label">{dayLabel(d.day)}</span>
            </div>
          ))}
        </div>
        <div className="ck-energy-row">
          {eb.map((d) => (
            <div key={d.day} className="ck-energy-cell" title={`${dayLabel(d.day)} : énergie moyenne ${d.avg ?? '—'}/5`}>
              <span className="ck-energy-dot" data-e={d.avg ?? 0} />
              <span>{d.avg !== null ? d.avg.toFixed(1) : '—'}</span>
            </div>
          ))}
        </div>
        <p className="ck-hint">Énergie moyenne notée après chaque focus (1 = crevé, 5 = en forme).</p>
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
                <span className="ck-pareto-bar">
                  <span style={{ width: `${r.cum * 100}%` }} />
                </span>
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
        <h3 className="ck-card-title">🕘 Historique des sessions</h3>
        {recent.length === 0 && <p className="ck-hint">Aucune session pour l’instant — lance un minuteur dans « Aujourd’hui ».</p>}
        <ul className="ck-sess">
          {recent.map((s) => (
            <li key={s.id}>
              <span className={`ck-sess-kind ${s.kind}`}>{s.kind === 'focus' ? '🍅' : s.kind === 'pause' ? '☕' : '⏱'}</span>
              <span className="ck-sess-label">{s.label}</span>
              <span className="ck-sess-meta">
                {new Date(s.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {fmt(s.actualSec)}
                {s.energy ? ` · ⚡${s.energy}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function dayKeyLocal(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
