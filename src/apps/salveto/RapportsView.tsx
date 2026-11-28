import { useState } from 'react'
import { notify } from '../../shared/notify'
import { downloadPdf } from '../blocs/pdf'
import { buildFicheMedecinPdf } from './pdf'
import {
  MOIS,
  dernierRdvPasse,
  monthRange,
  statsMois,
  tendance,
  todayDay,
  type ProfilSante,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs
} from './logic'

interface Props {
  events: SalvetoEvent[]
  refs: SalvetoRefs
  config: SalvetoConfig
  profil: ProfilSante
}

export default function RapportsView({ events, refs, config, profil }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [busy, setBusy] = useState(false)

  const { from, to } = monthRange(year, month)
  const stats = statsMois(events, from, to)
  const prev = monthRange(year, month - 1)
  const statsPrev = statsMois(events, prev.from, prev.to)

  const shift = (n: number): void => {
    const d = new Date(year, month + n, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const genererPdf = async (): Promise<void> => {
    setBusy(true)
    try {
      const bytes = buildFicheMedecinPdf({ profil, events, refs, config })
      try {
        downloadPdf(bytes, `salveto-fiche-medecin-${todayDay()}.pdf`)
        notify('Fiche médecin PDF générée et téléchargée localement')
      } catch {
        notify('Fiche médecin PDF générée (téléchargement indisponible dans ce contexte)')
      }
    } catch {
      notify('Génération PDF indisponible dans ce contexte')
    } finally {
      setBusy(false)
    }
  }

  const rdv = dernierRdvPasse(events)

  return (
    <>
      <h1 className="sa-h1">Rapports</h1>
      <p className="sa-cooc-note">Génération 100 % locale — aucune donnée de santé n’est jamais exportée automatiquement.</p>

      <section className="sa-rapport sa-printable">
        <div className="sa-cal-head">
          <button type="button" className="db-btn sa-no-print" onClick={() => shift(-1)}>
            ‹
          </button>
          <strong>
            Ton mois — {MOIS[month]} {year}
          </strong>
          <button type="button" className="db-btn sa-no-print" onClick={() => shift(1)}>
            ›
          </button>
          <button
            type="button"
            className="db-btn sa-no-print"
            onClick={() => {
              try {
                window.print()
              } catch {
                /* impression indisponible */
              }
            }}
          >
            🖨 Imprimer
          </button>
        </div>
        <ul className="sa-cooc-list">
          <li>
            💥 Crises ce mois : <strong>{stats.nbCrises}</strong>
          </li>
          <li>
            🙂 Moral moyen : <strong>{stats.moyMoral ?? '—'}/5</strong> ({tendance(stats.moyMoral, statsPrev.moyMoral)} vs mois
            dernier)
          </li>
          <li>
            ⚡ Énergie moyenne : <strong>{stats.moyEnergie ?? '—'}/5</strong> ({tendance(stats.moyEnergie, statsPrev.moyEnergie)})
          </li>
          <li>
            🌙 Sommeil moyen (qualité) : <strong>{stats.moySommeil ?? '—'}/5</strong> (
            {tendance(stats.moySommeil, statsPrev.moySommeil)})
          </li>
          {stats.moyPoids != null && (
            <li>
              ⚖️ Poids moyen : <strong>{stats.moyPoids} kg</strong>
            </li>
          )}
          <li>
            📝 Saisies : <strong>{stats.nbSaisies}</strong> entrées sur <strong>{stats.joursSaisis}</strong> jours —{' '}
            {stats.joursSansSaisie} jour(s) sans saisie
          </li>
        </ul>
      </section>

      <section className="sa-panel">
        <p className="sa-panel-title">🩺 Fiche médecin (PDF, généré localement)</p>
        <p className="sa-cooc-note">
          Profil santé, symptômes/crises depuis la dernière consultation
          {rdv ? ` (${rdv.label ?? 'RDV'} du ${rdv.date.slice(0, 10)})` : ''}, courbes clés, traitements et retours
          d’efficacité, questions à poser.
        </p>
        <button type="button" className="db-btn sa-panel-save" disabled={busy} onClick={() => void genererPdf()}>
          {busy ? 'Génération…' : 'Générer la fiche médecin (PDF)'}
        </button>
      </section>
    </>
  )
}
