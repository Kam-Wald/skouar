import { useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { useDismiss } from '../../../shared/useDismiss'
import { notify } from '../../../shared/notify'
import type { CkTask } from '../store'

export const CK_COLORS = ['#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7']

export default function TaskEditor({ task, ctx, onClose }: { task: CkTask; ctx: CkCtx; onClose: () => void }): JSX.Element {
  const [title, setTitle] = useState(task.title)
  const [estMin, setEstMin] = useState(task.estMin)
  const [color, setColor] = useState(task.color)
  const [value, setValue] = useState(task.value)
  const [urgent, setUrgent] = useState(task.urgent)
  const [important, setImportant] = useState(task.important)
  useDismiss('ck-task', true, onClose)

  const save = async (patch: Partial<CkTask>): Promise<void> => {
    await ctx.saveTask({ ...task, title, estMin, color, value, urgent, important, ...patch })
  }

  const move = async (col: CkTask['col']): Promise<void> => {
    await ctx.saveTask({
      ...task,
      title,
      estMin,
      color,
      value,
      urgent,
      important,
      col,
      doneAt: col === 'done' ? Date.now() : null
    })
    notify(col === 'done' ? 'Tâche terminée 🎉' : `Tâche déplacée`)
    onClose()
  }

  return (
    <div className="ck-pop-backdrop">
      <div className="ck-pop ck-task-pop" data-pop="ck-task">
        <h3>✏️ Tâche</h3>
        <input className="ck-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
        <div className="ck-edit-grid">
          <label>
            Estimé (min)
            <input type="number" min={0} max={999} value={estMin} onChange={(e) => setEstMin(Number(e.target.value))} />
          </label>
          <label>
            Valeur (★)
            <select value={value} onChange={(e) => setValue(Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n >= 4 ? '★' : n >= 2 ? '☆' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ck-colors">
          {CK_COLORS.map((c) => (
            <button
              key={c}
              className={`ck-color-dot${color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
        </div>
        <label className="ck-check-row">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          <span>⚡ Urgent</span>
        </label>
        <label className="ck-check-row">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          <span>🎯 Important</span>
        </label>
        {task.actualMin > 0 && <p className="ck-hint">Temps réel passé : {task.actualMin} min</p>}
        <div className="ck-pop-actions">
          <button className="ck-btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="ck-btn danger"
            onClick={async () => {
              await ctx.deleteTask(task.id)
              notify('Tâche supprimée')
              onClose()
            }}
          >
            🗑 Supprimer
          </button>
          <button className="ck-btn primary" onClick={() => void save({})}>
            Enregistrer
          </button>
        </div>
        <div className="ck-pop-actions">
          {task.col !== 'todo' && (
            <button className="ck-btn ghost" onClick={() => void move('todo')}>
              → À faire
            </button>
          )}
          {task.col !== 'doing' && (
            <button className="ck-btn ghost" onClick={() => void move('doing')}>
              → En cours
            </button>
          )}
          {task.col !== 'done' && (
            <button className="ck-btn ghost" onClick={() => void move('done')}>
              → Terminé ✅
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
