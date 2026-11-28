import { notify } from '../../shared/notify'
import { listQuestions } from './agenda'
import { ficheMedecinData, genFicheMedecinPDF, rapportMensuel } from './rapports'
import type { HealthEvent, Profile, RefEntity } from './store'

interface Props {
  events: HealthEvent[]
  refs: RefEntity[]
  profile: Profile
}

const fmtAvg = (n: number | null): string => (n === null ? '—' : String(n).replace('.', ','))

export default function RapportsView({ events, refs, profile }: Props): JSX.Element {
  const r = rapportMensuel(events)
  const fiche = ficheMedecinData(profile, events, refs, [], Date.now())

  const downloadPdf = async (): Promise<void> => {
    try {
      const questions = await listQuestions()
      const data = ficheMedecinData(profile, events, refs, questions, Date.now())
      const bytes = await genFicheMedecinPDF(data)
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `fiche-medecin-${new Date().toISOString().slice(0, 10)}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      }
      notify('Fiche médecin PDF générée (100 % local)')
    } catch {
      notify('Génération du PDF impossible')
    }
  }

  return (
    <section className="ra-view">
      <h2>Rapports</h2>
      <p className="ra-muted">Génération locale uniquement — aucune donnée de santé ne sort automatiquement (17.C).</p>

      <h3>Ton mois — {r.label}</h3>
      <div className="ra-stats-grid">
        <div className="ra-stat-card">
          <strong>{r.nbCrises}</strong>
          <span>crise{r.nbCrises > 1 ? 's' : ''}</span>
        </div>
        <div className="ra-stat-card">
          <strong>{fmtAvg(r.avgMoral)}</strong>
          <span>moral moyen /5</span>
        </div>
        <div className="ra-stat-card">
          <strong>{fmtAvg(r.avgEnergie)}</strong>
          <span>énergie moyenne /5</span>
        </div>
        <div className="ra-stat-card">
          <strong>{fmtAvg(r.avgSommeil)}</strong>
          <span>sommeil moyen /5</span>
        </div>
        <div className="ra-stat-card">
          <strong>{r.joursSaisis}</strong>
          <span>jour(s) saisi(s) sur {r.totalEntrees} entrée(s)</span>
        </div>
      </div>

      <h3>Fiche médecin (PDF)</h3>
      <p className="ra-muted">
        Profil santé, {fiche.crises.length} crise(s) et {fiche.symptomes.length} symptôme(s) depuis la dernière visite
        {fiche.depuis ? ` (${new Date(fiche.depuis).toLocaleDateString('fr-FR')})` : ''}, {fiche.traitements.length} traitement(s) avec retours
        d’efficacité, questions à poser.
      </p>
      <button type="button" className="db-btn primary" aria-label="Générer la fiche médecin (PDF)" onClick={() => void downloadPdf()}>
        📄 Générer la fiche médecin (PDF)
      </button>
    </section>
  )
}
