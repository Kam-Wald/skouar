import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { ALL_SUIVIS, seedConfig, type SalvetoConfig, type SuiviId } from './logic'
import { loadConfig, saveConfig } from './store'

const LOGO = `${import.meta.env.BASE_URL}app-icons/salveto.svg`

const NAV: { label: string; icon: string; soon?: boolean }[] = [
  { label: 'Accueil', icon: '🏠' },
  { label: 'Journal', icon: '📖', soon: true },
  { label: 'Courbes', icon: '📈', soon: true },
  { label: 'Cycle', icon: '🌸', soon: true },
  { label: 'RDV', icon: '🗓️', soon: true },
  { label: 'Ordonnances', icon: '📄', soon: true },
  { label: 'Traitements', icon: '💊', soon: true },
  { label: 'Préventif', icon: '🩺', soon: true },
  { label: 'Profil santé', icon: '🧾', soon: true },
  { label: 'Rapports', icon: '🗂️', soon: true },
  { label: 'Paramètres', icon: '⚙️', soon: true }
]

export default function SalvetoApp() {
  const [config, setConfig] = useState<SalvetoConfig | null>(null)
  const [checked, setChecked] = useState<Set<SuiviId>>(() => new Set(ALL_SUIVIS.map((s) => s.id)))

  useEffect(() => {
    void loadConfig().then(setConfig)
  }, [])

  if (!config) {
    return (
      <AppShell appId="salveto" appName="Salveto" logo={LOGO}>
        <div className="salveto-main" />
      </AppShell>
    )
  }

  if (!config.onboarded) {
    const toggle = (id: SuiviId): void => {
      const next = new Set(checked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setChecked(next)
    }
    const start = (): void => {
      const c: SalvetoConfig = {
        ...seedConfig(),
        onboarded: true,
        activeSuivis: ALL_SUIVIS.map((s) => s.id).filter((id) => checked.has(id))
      }
      saveConfig(c)
      setConfig(c)
    }
    return (
      <div className="salveto-onboarding">
        <div className="sa-onb-card">
          <img className="sa-onb-logo" src={LOGO} alt="" />
          <h1 className="sa-onb-title">Bienvenue dans Salveto</h1>
          <p className="sa-onb-text">
            Ton journal de suivi santé et humeur, 100 % local : rien ne quitte cet ordinateur. Choisis les suivis qui
            t’intéressent pour commencer léger — tu pourras les activer ou désactiver à tout moment dans les
            paramètres, sans jamais perdre tes données.
          </p>
          <div className="sa-onb-list" role="group" aria-label="Choisir les suivis à activer">
            {ALL_SUIVIS.map((s) => (
              <label key={s.id} className="sa-onb-item">
                <input
                  type="checkbox"
                  checked={checked.has(s.id)}
                  onChange={() => toggle(s.id)}
                  data-suivi={s.id}
                />
                <span className="sa-onb-icon" aria-hidden>
                  {s.icon}
                </span>
                <span>
                  <strong>{s.label}</strong>
                  <span className="sa-onb-desc"> — {s.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" className="db-btn sa-onb-start" disabled={checked.size === 0} onClick={start}>
            C’est parti →
          </button>
        </div>
      </div>
    )
  }

  const active = ALL_SUIVIS.filter((s) => config.activeSuivis.includes(s.id))
  return (
    <AppShell
      appId="salveto"
      appName="Salveto"
      logo={LOGO}
      sidebar={
        <div className="sa-side">
          <p className="sa-side-title">Salveto</p>
          {NAV.map((n) =>
            n.soon ? (
              <span key={n.label} className="sa-side-row soon" aria-disabled>
                <span aria-hidden>{n.icon}</span> {n.label} <em>bientôt</em>
              </span>
            ) : (
              <button key={n.label} type="button" className="sa-side-row active">
                <span aria-hidden>{n.icon}</span> {n.label}
              </button>
            )
          )}
        </div>
      }
    >
      <div className="salveto-main">
        <h1 className="sa-h1">Accueil</h1>
        <p className="sa-muted">Tes suivis actifs :</p>
        <div className="sa-chips">
          {active.map((s) => (
            <span key={s.id} className="sa-chip">
              {s.icon} {s.label}
            </span>
          ))}
        </div>
        <p className="sa-empty">Aucun événement pour l’instant — la saisie rapide arrive à l’étape suivante.</p>
      </div>
    </AppShell>
  )
}
