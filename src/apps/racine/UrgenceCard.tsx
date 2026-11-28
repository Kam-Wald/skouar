import type { Profile } from './store'

interface Props {
  profile: Profile
  onClose: () => void
}

export default function UrgenceCard({ profile, onClose }: Props): JSX.Element {
  const Row = ({ label, value }: { label: string; value: string }): JSX.Element => (
    <div className="ra-urgence-row">
      <span className="ra-urgence-label">{label}</span>
      <span className="ra-urgence-value">{value.trim() || '—'}</span>
    </div>
  )
  return (
    <div className="ra-urgence-overlay" role="dialog" aria-label="Carte d’urgence">
      <div className="ra-urgence">
        <div className="ra-urgence-head">
          <h1>🚨 Carte d’urgence</h1>
          <button type="button" className="db-btn" aria-label="Fermer la carte d’urgence" onClick={onClose}>
            ✕ Fermer
          </button>
        </div>
        <p className="ra-muted">À montrer en cas d’urgence. Aucune donnée n’est diffusée automatiquement.</p>
        <Row label="Allergies" value={profile.allergies} />
        <Row label="Groupe sanguin" value={profile.groupeSanguin} />
        <Row label="Traitements en cours" value={profile.traitementsCours} />
        <Row label="Maladies diagnostiquées" value={profile.maladies} />
        <Row label="Antécédents" value={profile.antecedents} />
        <Row label="Personne à contacter" value={profile.contactUrgence} />
      </div>
    </div>
  )
}
