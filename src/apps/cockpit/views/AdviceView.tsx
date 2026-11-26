import type { CkCtx } from '../CockpitApp'
import { adviceFor } from '../logic'

const TIPS: { icon: string; title: string; text: string }[] = [
  {
    icon: '🧱',
    title: 'Blocs de deep work',
    text: 'Une seule tâche importante par bloc de 50–90 min, téléphone ailleurs. Le multitâche coûte ~40 % de temps réel.'
  },
  {
    icon: '☕',
    title: 'Les pauses comptent',
    text: 'Une vraie pause toutes les 60–90 min restaure mieux qu’une demi-pause scrollée. Note-les, elles font partie du travail.'
  },
  {
    icon: '⚡',
    title: 'Règle des 2 minutes',
    text: 'Si une tâche prend moins de 2 minutes, fais-la tout de suite plutôt que de la noter.'
  },
  {
    icon: '🌙',
    title: 'Rituel de fermeture',
    text: '5 minutes le soir pour noter la prochaine action de demain : le cerveau se libère et dort mieux.'
  },
  {
    icon: '✂️',
    title: 'Découpe avant de commencer',
    text: 'Une tâche de plus de 2 h estimée n’est pas une tâche, c’est un projet. Découpe-la en étapes actionnables.'
  },
  {
    icon: '📏',
    title: 'Estime, puis compare',
    text: 'Note ton estimation avant de commencer, compare après : tes estimations s’affinent toutes seules avec tes vraies données.'
  }
]

export default function AdviceView({ ctx }: { ctx: CkCtx }): JSX.Element {
  const advices = adviceFor({
    tasks: ctx.tasks,
    sessions: ctx.sessions,
    days: ctx.days,
    today: ctx.today,
    shutdownDays: ctx.shutdownDays
  })

  return (
    <div className="ck-advice">
      <section className="ck-card">
        <h3 className="ck-card-title">💡 Conseils basés sur tes données</h3>
        {advices.length === 0 && (
          <p className="ck-hint">Pas encore assez de données pour des conseils personnalisés — utilise le minuteur et le kanban quelques jours.</p>
        )}
        <ul className="ck-advice-list">
          {advices.map((a, i) => (
            <li key={i} className="ck-advice-card">
              <span className="ck-advice-icon">{a.icon}</span>
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="ck-card">
        <h3 className="ck-card-title">📚 Conseils généraux</h3>
        <div className="ck-tips">
          {TIPS.map((t) => (
            <div key={t.title} className="ck-tip">
              <span className="ck-tip-icon">{t.icon}</span>
              <div>
                <strong>{t.title}</strong>
                <p>{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
