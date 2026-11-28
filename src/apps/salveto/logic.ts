export const SCHEMA_VERSION = 1

export type SuiviId =
  | 'moral'
  | 'energie'
  | 'poids'
  | 'crise'
  | 'sommeil'
  | 'symptome'
  | 'habitude'
  | 'note'
  | 'constante'
  | 'traitement'
  | 'cycle'
  | 'rdv'
  | 'marqueur'

export interface SuiviDef {
  id: SuiviId
  label: string
  desc: string
  icon: string
}

export const ALL_SUIVIS: SuiviDef[] = [
  { id: 'moral', label: 'Moral', desc: 'Ton humeur du jour, de 1 à 5', icon: '🙂' },
  { id: 'energie', label: 'Énergie', desc: 'Ton niveau d’énergie, de 1 à 5', icon: '⚡' },
  { id: 'poids', label: 'Poids', desc: 'Ta courbe de poids', icon: '⚖️' },
  { id: 'crise', label: 'Crises & douleurs', desc: 'Bouton « + crise », intensité et localisation', icon: '💥' },
  { id: 'sommeil', label: 'Sommeil', desc: 'Heures de coucher/réveil et qualité', icon: '🌙' },
  { id: 'symptome', label: 'Symptômes', desc: 'Fièvre, fatigue, digestion, vertiges…', icon: '🤒' },
  { id: 'habitude', label: 'Habitudes & activités', desc: 'Sport, sorties, écran, aliment inhabituel…', icon: '🏃' },
  { id: 'note', label: 'Note libre', desc: 'Une pensée, un contexte, daté', icon: '✏️' },
  { id: 'constante', label: 'Constantes', desc: 'Tension, température, glycémie… à la carte', icon: '🌡️' },
  { id: 'traitement', label: 'Traitements & efficacité', desc: 'Ce qui te fait du bien, effet ressenti', icon: '💊' },
  { id: 'cycle', label: 'Cycle menstruel', desc: 'Périodes et prévisions indicatives', icon: '🌸' },
  { id: 'rdv', label: 'RDV & ordonnances', desc: 'Rendez-vous, comptes-rendus, ordonnances', icon: '🗓️' },
  { id: 'marqueur', label: 'Marqueurs', desc: 'Événements épinglés sur les courbes', icon: '📌' }
]

export const SUIVI_IDS: SuiviId[] = ALL_SUIVIS.map((s) => s.id)

export interface SalvetoConfig {
  version: 1
  onboarded: boolean
  desktopOnly: boolean
  activeSuivis: SuiviId[]
}

export function seedConfig(): SalvetoConfig {
  return { version: 1, onboarded: false, desktopOnly: true, activeSuivis: [...SUIVI_IDS] }
}

export function migrateConfig(raw: unknown): SalvetoConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.version !== 'number' || r.version < 1 || r.version > SCHEMA_VERSION) return undefined
  const known = new Set<string>(SUIVI_IDS)
  const active = Array.isArray(r.activeSuivis)
    ? r.activeSuivis.filter((x): x is SuiviId => typeof x === 'string' && known.has(x))
    : [...SUIVI_IDS]
  return {
    ...(r as object),
    version: 1,
    onboarded: r.onboarded === true,
    desktopOnly: r.desktopOnly !== false,
    activeSuivis: active
  } as SalvetoConfig
}

export function isSuiviActive(config: SalvetoConfig, id: SuiviId): boolean {
  return config.activeSuivis.includes(id)
}
