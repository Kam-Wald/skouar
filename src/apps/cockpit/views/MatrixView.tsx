import { useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { QUADS, quadOf, type Quad } from '../logic'
import { notify } from '../../../shared/notify'
import type { CkTask } from '../store'
import TaskEditor from './TaskEditor'

const ORDER: Quad[] = ['do-now', 'plan', 'delegate', 'drop']

const FLAGS: Record<Quad, { urgent: boolean; important: boolean }> = {
  'do-now': { urgent: true, important: true },
  plan: { urgent: false, important: true },
  delegate: { urgent: true, important: false },
  drop: { urgent: false, important: false }
}

export default function MatrixView({ ctx }: { ctx: CkCtx }): JSX.Element {
  const [editId, setEditId] = useState<string | null>(null)
  const [overQuad, setOverQuad] = useState<Quad | null>(null)
  const open = ctx.tasks.filter((t) => t.col === 'todo' || t.col === 'doing')
  const editTask = ctx.tasks.find((t) => t.id === editId)

  const dropOn = async (q: Quad, e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setOverQuad(null)
    const id = e.dataTransfer.getData('text/plain')
    const task = ctx.tasks.find((t) => t.id === id)
    if (!task) return
    const f = FLAGS[q]
    if (task.urgent === f.urgent && task.important === f.important) return
    await ctx.saveTask({ ...task, urgent: f.urgent, important: f.important })
    notify(`Tâche mise dans « ${QUADS[q].label} »`)
  }

  return (
    <div className="ck-matrix-wrap">
      <p className="ck-hint ck-matrix-hint">
        Glisse une carte d’un quadrant à l’autre pour changer urgent / important. Clique une carte pour l’éditer.
      </p>
      <div className="ck-matrix">
        {ORDER.map((q) => {
          const meta = QUADS[q]
          const tasks = open.filter((t) => quadOf(t) === q)
          return (
            <section
              key={q}
              className={`ck-quad ck-quad-${q}${overQuad === q ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOverQuad(q)
              }}
              onDragLeave={() => setOverQuad((prev) => (prev === q ? null : prev))}
              onDrop={(e) => void dropOn(q, e)}
            >
              <header className="ck-quad-head">
                <strong>{meta.label}</strong>
                <span className="ck-quad-hint">{meta.hint}</span>
                <span className="ck-col-count">{tasks.length}</span>
              </header>
              <p className="ck-quad-advice">{meta.advice}</p>
              <div className="ck-quad-cards">
                {tasks.map((t) => (
                  <article
                    key={t.id}
                    className="ck-card-task"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    onClick={() => setEditId(t.id)}
                  >
                    <span className="ck-dot" style={{ background: t.color }} />
                    <span className="ck-task-title">{t.title}</span>
                    <span className="ck-task-chips">
                      {t.estMin > 0 && <span className="ck-chip-mini">⏱ {t.estMin}</span>}
                      {t.value > 0 && <span className="ck-chip-mini">★ {t.value}</span>}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      {editTask && <TaskEditor task={editTask} ctx={ctx} onClose={() => setEditId(null)} />}
    </div>
  )
}
