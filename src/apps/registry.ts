import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppMeta {
  id: string
  name: string
  description: string
  tag: string
  icon: string
  logo?: string
  soon?: boolean
  component?: LazyExoticComponent<ComponentType>
}

export const apps: AppMeta[] = [
  {
    id: 'blocs',
    name: 'Karneto',
    description: 'Pages et bases de données type Notion : blocs riches, 11 vues de BDD, graphe de liens, rappels, 30 templates, import/export.',
    tag: 'notes & bdd',
    icon: '📓',
    logo: `${import.meta.env.BASE_URL}app-icons/calepin.svg`,
    component: lazy(() => import('./blocs/BlocsApp'))
  },
  {
    id: 'skrid',
    name: 'Skrid',
    description: 'Traitement de texte léger, pensé pour écrire un livre (chapitres, compteurs, export PDF).',
    tag: 'écriture',
    icon: '✍️',
    logo: `${import.meta.env.BASE_URL}app-icons/skrid.svg`,
    component: lazy(() => import('./skrid/SkridApp'))
  },
  {
    id: 'ler',
    name: 'Ler',
    description: 'Visionneuse et annotatrice de PDF (recherche, surlignage, texte, signature, fusion/extraction de pages).',
    tag: 'pdf',
    icon: '📕',
    logo: `${import.meta.env.BASE_URL}app-icons/ler.svg`,
    component: lazy(() => import('./ler/LerApp'))
  },
  {
    id: 'skeud',
    name: 'Skeud',
    description: 'Visionneuse + retouche d’images (recadrage, filtres, cadres, traitement par lot).',
    tag: 'photos',
    icon: '🖼️',
    logo: `${import.meta.env.BASE_URL}app-icons/skeud.svg`,
    component: lazy(() => import('./skeud/SkeudApp'))
  },
  {
    id: 'taol',
    name: 'Taol',
    description: 'Tableur local : formules (SOMME, MOYENNE, SI…), multi-feuilles, export CSV, impression.',
    tag: 'tableur',
    icon: '🧮',
    logo: `${import.meta.env.BASE_URL}app-icons/taol.svg`,
    component: lazy(() => import('./taol/TaolApp'))
  },
  {
    id: 'fichorama',
    name: 'Fichorama',
    description: 'Fiches de notation personnalisables (films, livres, restos…) : note /10, champs libres, image, historique de re-notes.',
    tag: 'fiches & notation',
    icon: '🗂️',
    logo: `${import.meta.env.BASE_URL}app-icons/fichorama.svg`,
    component: lazy(() => import('./fichorama/FichoramaApp'))
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
    id: 'kod',
    name: 'Kod',
    description: 'Éditeur de code léger : coloration, onglets, arbre de fichiers, recherche.',
    tag: 'éditeur de code',
    icon: '💻',
    logo: `${import.meta.env.BASE_URL}app-icons/kod.svg`,
    component: lazy(() => import('./kod/KodApp'))
  },
  {
    id: 'kemm',
    name: 'Kemm',
    description: 'Convertisseur multiformat + compression de fichiers (images, audio, documents, ZIP…).',
    tag: 'fichiers & zip',
    icon: '🔄',
    logo: `${import.meta.env.BASE_URL}app-icons/kemm.svg`,
    soon: true
  },
  {
    id: 'cockpit',
    name: 'Cockpit',
    description: 'Pilotage de ta journée : minuteurs Pomodoro, suivi du temps, kanban, matrice urgent/important, rituels.',
    tag: 'productivité & focus',
    icon: '🎛️',
    logo: `${import.meta.env.BASE_URL}app-icons/cockpit.svg`,
    component: lazy(() => import('./cockpit/CockpitApp'))
  },
  {
    id: 'klevet',
    name: 'Klevet',
    description: 'Édition audio (façon Audacity-lite) : enregistrer au micro, couper, gain, fondus, export WAV.',
    tag: 'audio',
    icon: '🎙️',
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
  },
  {
    id: 'unvez',
    name: 'Unvez',
    description: "Calculatrice + convertisseur d'unités (longueur, poids, devises…).",
    tag: 'unités & calcul',
    icon: '📐',
    logo: `${import.meta.env.BASE_URL}app-icons/unvez.svg`,
    component: lazy(() => import('./unvez/UnvezApp'))
  }
]
