import { useState } from 'react'
import type { CkCtx } from '../CockpitApp'
import { allTags, dueChip, parseTaskLines, WIP_LIMIT, wipExceeded } from '../logic'
import { notify } from '../../../shared/notify'
import { useDismiss } from '../../../shared/useDismiss'
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
  const [tag, setTag] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  useDismiss('ck-import', showImport, () => setShowImport(false))

  const doing = ctx.tasks.filter((t) => t.col === 'doing').length
  const editTask = ctx.tasks.find((t) => t.id === editId)
  const tags = allTags(ctx.tasks)
  const visible = (t: CkTask): boolean => !tag || (t.tags ?? []).includes(tag)

  const addTask = async (col: CkTask['col'], title: string): Promise<void> => {
    const clean = title.trim()
    if (!clean) return
    const t: CkTask = {
      id: uid(), title: clean, col, estMin: 30, urgent: false, important: col === 'doing',
      color: '#64748b', value: 3, createdAt: Date.now(), doneAt: null, actualMin: 0,
      due: null, tags: [], goalId: null, recur: null
    }
    await ctx.saveTask(t)
  }

  const doImport = async (): Promise<void> => {
    const lines = parseTaskLines(importText)
    for (const l of lines) await addTask('todo', l)
    notify(`${lines.length} tâche(s) importée(s) 📋`)
    setImportText('')
    setShowImport(false)
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

  const subCount = (taskId: string): string | null => {
    const subs = ctx.subtasks.filter((s) => s.taskId === taskId)
    return subs.length ? `☑ ${subs.filter((s) => s.done).length}/${subs.length}` : null
  }

  return (
    <div className="ck-kanban-wrap">
      {wipExceeded(doing) && (
        <div className="ck-banner warn">🚧 {doing} tâches en cours (limite {WIP_LIMIT}) : termine-en une avant d’en commencer une autre.</div>
      )}
      <div className="ck-kanban-toolbar">
        <div className="ck-tag-filters">
          <button className={`ck-chip${tag === '' ? ' active' : ''}`} onClick={() => setTag('')}>Tous</button>
          {tags.map((tg) => (
            <button key={tg} className={`ck-chip${tag === tg ? ' active' : ''}`} onClick={() => setTag(tag === tg ? '' : tg)}>#{tg}</button>
          ))}
        </div>
        <button className="ck-btn ghost" onClick={() => setShowImport(true)}>📋 Importer une liste</button>
      </div>
      <div className="ck-kanban">
        {COLS.map((c) => {
          const tasks = ctx.tasks.filter((t) => t.col === c.id && visible(t))
          return (
            <section
              key={c.id}
              className={`ck-col${overCol === c.id ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(c.id) }}
              onDragLeave={() => setOverCol((prev) => (prev === c.id ? null : prev))}
              onDrop={(e) => void dropOn(c.id, e)}
            >
              <header className="ck-col-head">
                <span>{c.icon} {c.label}</span>
                <span className="ck-col-count">{tasks.length}</span>
              </header>
              <div className="ck-col-cards">
                {tasks.map((t) => {
                  const dc = dueChip(t, ctx.today)
                  const sc = subCount(t.id)
                  return (
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
                        {t.recur && <span className="ck-chip-mini" title="Récurrente">🔁</span>}
                        {dc && <span className={`ck-chip-mini ck-due-${dc}`}>{dc === 'late' ? '⚠️' : dc === 'today' ? '📅' : '🗓'}</span>}
                        {sc && <span className="ck-chip-mini">{sc}</span>}
                        {t.estMin > 0 && <span className="ck-chip-mini">⏱ {t.estMin}</span>}
                        {t.actualMin > 0 && <span className="ck-chip-mini">✓ {t.actualMin}</span>}
                        {t.value > 0 && <span className="ck-chip-mini">★ {t.value}</span>}
                        {t.urgent && <span className="ck-chip-mini">⚡</span>}
                        {t.important && <span className="ck-chip-mini">🎯</span>}
                        {(t.tags ?? []).map((tg) => <span key={tg} className="ck-chip-mini">#{tg}</span>)}
                      </span>
                    </article>
                  )
                })}
              </div>
              <div className="ck-add-row">
                <input
                  className="ck-input"
                  placeholder="+ Nouvelle tâche…"
                  value={newTitle[c.id] ?? ''}
                  onChange={(e) => setNewTitle((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void addTask(c.id, newTitle[c.id] ?? ''); setNewTitle((prev) => ({ ...prev, [c.id]: '' })) } }}
                />
                <button className="ck-btn" onClick={() => { void addTask(c.id, newTitle[c.id] ?? ''); setNewTitle((prev) => ({ ...prev, [c.id]: '' })) }}>+</button>
              </div>
            </section>
          )
        })}
      </div>
      {editTask && <TaskEditor task={editTask} ctx={ctx} onClose={() => setEditId(null)} />}
      {showImport && (
        <div className="ck-pop-backdrop">
          <div className="ck-pop" data-pop="ck-import">
            <h3>📋 Importer une liste</h3>
            <p className="ck-hint">Une tâche par ligne (les « - » sont nettoyés).</p>
            <textarea className="ck-input ck-note" placeholder={'- Rappeler le plombier\nPréparer la présentation\n- Lire 20 pages'} value={importText} onChange={(e) => setImportText(e.target.value)} />
            <div className="ck-pop-actions">
              <button className="ck-btn ghost" onClick={() => setShowImport(false)}>Annuler</button>
              <button className="ck-btn primary" onClick={() => void doImport()}>Importer dans « À faire »</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
