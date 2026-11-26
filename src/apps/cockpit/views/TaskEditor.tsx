import { useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { useDismiss } from '../../../shared/useDismiss'
import { notify } from '../../../shared/notify'
import { RECUR_LABELS, weekStartOf } from '../logic'
import type { CkTask } from '../store'

export const CK_COLORS = ['#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7']

export default function TaskEditor({ task, ctx, onClose }: { task: CkTask; ctx: CkCtx; onClose: () => void }): JSX.Element {
  const [title, setTitle] = useState(task.title)
  const [estMin, setEstMin] = useState(task.estMin)
  const [color, setColor] = useState(task.color)
  const [value, setValue] = useState(task.value)
  const [urgent, setUrgent] = useState(task.urgent)
  const [important, setImportant] = useState(task.important)
  const [due, setDue] = useState(task.due ?? '')
  const [tags, setTags] = useState((task.tags ?? []).join(', '))
  const [goalId, setGoalId] = useState(task.goalId ?? '')
  const [recur, setRecur] = useState(task.recur ?? '')
  const [newSub, setNewSub] = useState('')
  useDismiss('ck-task', true, onClose)

  const subs = ctx.subtasks.filter((s) => s.taskId === task.id)
  const weekGoals = ctx.goals.filter((g) => g.weekStart === weekStartOf())

  const current = (): CkTask => ({
    ...task,
    title: title.trim() || task.title,
    estMin,
    color,
    value,
    urgent,
    important,
    due: due || null,
    tags: tags.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean),
    goalId: goalId || null,
    recur: recur || null
  })

  const save = async (): Promise<void> => {
    await ctx.saveTask(current())
    notify('Tâche enregistrée')
    onClose()
  }

  const move = async (col: CkTask['col']): Promise<void> => {
    await ctx.saveTask({ ...current(), col, doneAt: col === 'done' ? Date.now() : null })
    notify(col === 'done' ? 'Tâche terminée 🎉' : 'Tâche déplacée')
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
                <option key={n} value={n}>{n} {n >= 4 ? '★' : n >= 2 ? '☆' : ''}</option>
              ))}
            </select>
          </label>
          <label>
            Échéance
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label>
            Récurrence
            <select value={recur} onChange={(e) => setRecur(e.target.value)}>
              <option value="">Aucune</option>
              {Object.entries(RECUR_LABELS).map(([k, label]) => (
                <option key={k} value={k}>🔁 {label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="ck-field">
          Tags (séparés par des virgules)
          <input className="ck-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#pro, #urgent…" />
        </label>
        <label className="ck-field">
          Objectif de la semaine
          <select className="ck-input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Aucun</option>
            {weekGoals.map((g) => (
              <option key={g.id} value={g.id}>🎯 {g.label}</option>
            ))}
          </select>
        </label>
        <div className="ck-colors">
          {CK_COLORS.map((c) => (
            <button key={c} className={`ck-color-dot${color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} title={c} />
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

        <div className="ck-subtasks">
          <p className="ck-col-sub">Sous-tâches ({subs.filter((s) => s.done).length}/{subs.length})</p>
          <ul className="ck-checks">
            {subs.map((s) => (
              <li key={s.id} className="ck-check-row">
                <label>
                  <input type="checkbox" checked={s.done} onChange={(e) => void ctx.toggleSubtask(s, e.target.checked)} />
                  <span className={s.done ? 'ck-done' : ''}>{s.label}</span>
                </label>
                <button className="ck-mini" onClick={() => void ctx.removeSubtask(s.id)}>✕</button>
              </li>
            ))}
          </ul>
          <div className="ck-add-row">
            <input
              className="ck-input"
              placeholder="+ Sous-tâche…"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSub.trim()) {
                  void ctx.addSubtask(task.id, newSub.trim())
                  setNewSub('')
                }
              }}
            />
            <button className="ck-btn" onClick={() => { if (newSub.trim()) { void ctx.addSubtask(task.id, newSub.trim()); setNewSub('') } }}>+</button>
          </div>
        </div>

        {task.actualMin > 0 && <p className="ck-hint">Temps réel passé : {task.actualMin} min</p>}
        <div className="ck-pop-actions">
          <button className="ck-btn ghost" onClick={onClose}>Annuler</button>
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
          <button className="ck-btn primary" onClick={() => void save()}>Enregistrer</button>
        </div>
        <div className="ck-pop-actions">
          {task.col !== 'todo' && <button className="ck-btn ghost" onClick={() => void move('todo')}>→ À faire</button>}
          {task.col !== 'doing' && <button className="ck-btn ghost" onClick={() => void move('doing')}>→ En cours</button>}
          {task.col !== 'done' && <button className="ck-btn ghost" onClick={() => void move('done')}>→ Terminé ✅</button>}
        </div>
      </div>
    </div>
  )
}
