import { useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { WIP_LIMIT, wipExceeded } from '../logic'
import { notify } from '../../../shared/notify'
import { uid, type CkTask } from '../store'
import TaskEditor from './TaskEditor'

const COLS: { id: CkTask['col']; label: string; icon: string }[] = [
  { id: 'todo', label: 'À faire', icon: '📥' },
  { id: 'doing', label: 'En cours', icon: '▶️' },
  { id: 'done', label: 'Terminé', icon: '✅' }
]

export default function KanbanView({ ctx }: { ctx: CkCtx }): JSX.Element {
  const [editId, setEditId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState<Record<string, string>>({})
  const [overCol, setOverCol] = useState<CkTask['col'] | null>(null)

  const doing = ctx.tasks.filter((t) => t.col === 'doing').length
  const editTask = ctx.tasks.find((t) => t.id === editId)

  const addTask = async (col: CkTask['col']): Promise<void> => {
    const title = (newTitle[col] ?? '').trim()
    if (!title) return
    const t: CkTask = {
      id: uid(),
      title,
      col,
      estMin: 30,
      urgent: false,
      important: col === 'doing',
      color: '#64748b',
      value: 3,
      createdAt: Date.now(),
      doneAt: null,
      actualMin: 0
    }
    await ctx.saveTask(t)
    setNewTitle((prev) => ({ ...prev, [col]: '' }))
    notify('Tâche ajoutée')
  }

  const dropOn = async (col: CkTask['col'], e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setOverCol(null)
    const id = e.dataTransfer.getData('text/plain')
    const task = ctx.tasks.find((t) => t.id === id)
    if (!task || task.col === col) return
    await ctx.saveTask({ ...task, col, doneAt: col === 'done' ? Date.now() : null })
    notify(col === 'done' ? 'Tâche terminée 🎉' : 'Tâche déplacée')
  }

  return (
    <div className="ck-kanban-wrap">
      {wipExceeded(doing) && (
        <div className="ck-banner warn">
          🚧 {doing} tâches en cours (limite {WIP_LIMIT}) : termine-en une avant d’en commencer une autre.
        </div>
      )}
      <div className="ck-kanban">
        {COLS.map((c) => {
          const tasks = ctx.tasks.filter((t) => t.col === c.id)
          return (
            <section
              key={c.id}
              className={`ck-col${overCol === c.id ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(c.id)
              }}
              onDragLeave={() => setOverCol((prev) => (prev === c.id ? null : prev))}
              onDrop={(e) => void dropOn(c.id, e)}
            >
              <header className="ck-col-head">
                <span>
                  {c.icon} {c.label}
                </span>
                <span className="ck-col-count">{tasks.length}</span>
              </header>
              <div className="ck-col-cards">
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
                      {t.actualMin > 0 && <span className="ck-chip-mini">✓ {t.actualMin}</span>}
                      {t.value > 0 && <span className="ck-chip-mini">★ {t.value}</span>}
                      {t.urgent && <span className="ck-chip-mini">⚡</span>}
                      {t.important && <span className="ck-chip-mini">🎯</span>}
                    </span>
                  </article>
                ))}
              </div>
              <div className="ck-add-row">
                <input
                  className="ck-input"
                  placeholder="+ Nouvelle tâche…"
                  value={newTitle[c.id] ?? ''}
                  onChange={(e) => setNewTitle((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addTask(c.id)
                  }}
                />
                <button className="ck-btn" onClick={() => void addTask(c.id)}>
                  +
                </button>
              </div>
            </section>
          )
        })}
      </div>
      {editTask && <TaskEditor task={editTask} ctx={ctx} onClose={() => setEditId(null)} />}
    </div>
  )
}
