import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppMeta {
  id: string
  name: string
  description: string
  tag: string
  icon: string
  logo?: string
  soon?: boolean
  desktopOnly?: boolean
  component?: LazyExoticComponent<ComponentType>
}

export const apps: AppMeta[] = [
  {
    id: 'karneto',
    name: 'Karneto',
    description: 'Pages et bases de données type Notion : blocs riches, vues de BDD, graphe de liens, rappels, templates, import/export.',
    tag: 'notes & bdd',
    icon: '📓',
    logo: `${import.meta.env.BASE_URL}app-icons/calepin.svg`
  },
  {
    id: 'skrid',
    name: 'Skrid',
    description: 'Traitement de texte léger, pensé pour écrire un livre (chapitres, compteurs, export PDF).',
    tag: 'écriture',
    icon: '✍️',
    logo: `${import.meta.env.BASE_URL}app-icons/skrid.svg`
  },
  {
    id: 'ler',
    name: 'Ler',
    description: 'Visionneuse et annotatrice de PDF (recherche, surlignage, texte, signature, fusion/extraction de pages).',
    tag: 'pdf',
    icon: '📕',
    logo: `${import.meta.env.BASE_URL}app-icons/ler.svg`
  },
  {
    id: 'skeud',
    name: 'Skeud',
    description: 'Visionneuse + retouche d’images (recadrage, filtres, cadres, traitement par lot).',
    tag: 'photos',
    icon: '🖼️',
    logo: `${import.meta.env.BASE_URL}app-icons/skeud.svg`
  },
  {
    id: 'kod',
    name: 'Kod',
    description: 'Éditeur de code léger : coloration, onglets, arbre de fichiers, recherche.',
    tag: 'éditeur de code',
    icon: '💻',
    logo: `${import.meta.env.BASE_URL}app-icons/kod.svg`
  },
  {
    id: 'cockpit',
    name: 'Cockpit',
    description: 'Pilotage de ta journée : minuteurs Pomodoro, suivi du temps, kanban, matrice urgent/important, rituels.',
    tag: 'productivité & focus',
    icon: '🎛️',
    logo: `${import.meta.env.BASE_URL}app-icons/cockpit.svg`
  },
  {
    id: 'unvez',
    name: 'Unvez',
    description: 'Calculatrices et convertisseur d’unités, avec mémos enregistrés classables en dossiers.',
    tag: 'unités & calcul',
    icon: '📐',
    logo: `${import.meta.env.BASE_URL}app-icons/unvez.svg`,
    component: lazy(() => import('./unvez/UnvezApp'))
  },
  {
    id: 'taol',
    name: 'Taol',
    description: 'Tableur local : formules (SOMME, MOYENNE, SI…), multi-feuilles, export CSV, impression.',
    tag: 'tableur',
    icon: '🧮',
    logo: `${import.meta.env.BASE_URL}app-icons/taol.svg`
  },
  {
    id: 'fichorama',
    name: 'Fichorama',
    description: 'Fiches de notation personnalisables pour tout ce que tu aimes : films, livres, restos, jeux…',
    tag: 'fiches & notation',
    icon: '👢',
    logo: `${import.meta.env.BASE_URL}app-icons/fichorama.svg`,
    component: lazy(() => import('./fichorama/FichoramaApp'))
  },
  {
    id: 'racine',
    name: 'Racine',
    description: 'Journal de suivi santé et humeur, 100 % local.',
    tag: 'santé & humeur',
    icon: '🩺',
    logo: `${import.meta.env.BASE_URL}app-icons/racine.svg`,
    desktopOnly: true,
    component: lazy(() => import('./racine/RacineApp'))
  },
  {
    id: 'tres',
    name: 'Tres',
    description: 'Dessin & présentations : formes, flèches, diapos, export SVG/PNG.',
    tag: 'dessin & vectoriel',
    icon: '✏️',
    logo: `${import.meta.env.BASE_URL}app-icons/tres.svg`,
    soon: true
  },
  {
    id: 'kemm',
    name: 'Kemm',
    description: 'Convertisseur multiformat + compression de fichiers (images, audio, documents, ZIP…).',
    tag: 'fichiers & zip',
    icon: '🔀',
    logo: `${import.meta.env.BASE_URL}app-icons/kemm.svg`,
    soon: true
  },
  {
    id: 'klevet',
    name: 'Klevet',
    description: 'Édition audio (façon Audacity-lite) : enregistrer au micro, couper, gain, fondus, export WAV.',
    tag: 'audio',
    icon: '🎤',
    logo: `${import.meta.env.BASE_URL}app-icons/klevet.svg`,
    soon: true
  },
  {
    id: 'archant',
    name: "Arc'hant",
    description: 'Budget perso : comptes, catégories, graphiques mensuels, export CSV.',
    tag: 'budget',
    icon: '💰',
    logo: `${import.meta.env.BASE_URL}app-icons/archant.svg`,
    soon: true
  }
]
