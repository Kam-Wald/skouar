import type { BlockType, PropType } from './types'

export interface TplCol {
  name: string
  type: PropType
  options?: string[]
}

export interface TemplateSpec {
  name: string
  icon: string
  tag: string
  blocks: { type: BlockType; text: string; done?: boolean; progress?: number; cols?: TplCol[] }[]
}

export const TEMPLATES: TemplateSpec[] = [
  { name: 'Page vide', icon: '📄', tag: 'Base', blocks: [{ type: 'paragraph', text: '' }] },
  { name: 'Bienvenue', icon: '👋', tag: 'Base', blocks: [
    { type: 'h1', text: 'Bienvenue 👋' },
    { type: 'paragraph', text: 'Tape / pour insérer un bloc, [[ pour lier une page, Ctrl+Z pour annuler.' },
    { type: 'todo', text: 'Essayer le menu /', done: false },
    { type: 'todo', text: 'Créer une base de données ■', done: false }
  ] },
  { name: 'Journal quotidien', icon: '📅', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Journal — ' },
    { type: 'h2', text: 'Ce matin' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Cet après-midi' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Ce soir' },
    { type: 'todo', text: '', done: false }
  ] },
  { name: 'Routine matinale', icon: '☀️', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Routine du matin ☀️' },
    { type: 'paragraph', text: 'Progression de la routine :' },
    { type: 'progress', text: '', progress: 0 },
    { type: 'todo', text: 'Réveil & verre d’eau', done: false },
    { type: 'todo', text: '10 min de mobilité / étirements', done: false },
    { type: 'todo', text: 'Petit-déjeuner', done: false },
    { type: 'todo', text: 'Lecture 15 min', done: false },
    { type: 'todo', text: 'Objectif du jour', done: false }
  ] },
  { name: 'Routine du soir', icon: '🌙', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Routine du soir 🌙' },
    { type: 'progress', text: '', progress: 0 },
    { type: 'todo', text: 'Écran éteint 30 min avant le coucher', done: false },
    { type: 'todo', text: 'Préparer les affaires de demain', done: false },
    { type: 'todo', text: '3 choses positives de la journée', done: false },
    { type: 'todo', text: 'Lecture au lit', done: false }
  ] },
  { name: 'Réunion', icon: '🧑‍🤝‍🧑', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Réunion — ' },
    { type: 'paragraph', text: 'Participants : ' },
    { type: 'h2', text: 'Ordre du jour' },
    { type: 'numbered', text: '' },
    { type: 'numbered', text: '' },
    { type: 'h2', text: 'Décisions' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Actions' },
    { type: 'database', text: 'Actions', cols: [
      { name: 'Action', type: 'text' },
      { name: 'Responsable', type: 'text' },
      { name: 'Échéance', type: 'date' },
      { name: 'Statut', type: 'status', options: ['À faire', 'En cours', 'Terminé'] }
    ] }
  ] },
  { name: 'Compte-rendu de réunion', icon: '📝', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Compte-rendu — ' },
    { type: 'paragraph', text: 'Date : ' },
    { type: 'h2', text: 'Résumé' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Points clés' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Actions à suivre' },
    { type: 'database', text: 'Actions', cols: [
      { name: 'Action', type: 'text' },
      { name: 'Responsable', type: 'text' },
      { name: 'Échéance', type: 'date' },
      { name: 'Statut', type: 'status', options: ['À faire', 'En cours', 'Terminé'] }
    ] }
  ] },
  { name: 'Projet', icon: '🚀', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Projet ' },
    { type: 'paragraph', text: 'Objectif : ' },
    { type: 'h2', text: 'Avancement' },
    { type: 'progress', text: '', progress: 0 },
    { type: 'h2', text: 'À faire' },
    { type: 'todo', text: '', done: false },
    { type: 'database', text: 'Suivi', cols: [
      { name: 'Tâche', type: 'text' },
      { name: 'Statut', type: 'status', options: ['À faire', 'En cours', 'Terminé'] },
      { name: 'Priorité', type: 'select', options: ['Haute', 'Moyenne', 'Basse'] },
      { name: 'Échéance', type: 'date' },
      { name: 'Responsable', type: 'text' }
    ] }
  ] },
  { name: 'Suivi de tâches', icon: '✅', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Tâches' },
    { type: 'todo', text: '', done: false },
    { type: 'todo', text: '', done: false },
    { type: 'todo', text: '', done: false }
  ] },
  { name: 'Budget mensuel', icon: '💰', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Budget — ' },
    { type: 'database', text: 'Dépenses', cols: [
      { name: 'Date', type: 'date' },
      { name: 'Poste', type: 'text' },
      { name: 'Catégorie', type: 'select', options: ['Alimentation', 'Logement', 'Transport', 'Loisirs', 'Santé', 'Autre'] },
      { name: 'Montant', type: 'number' },
      { name: 'Moyen', type: 'select', options: ['Carte', 'Espèces', 'Virement'] }
    ] }
  ] },
  { name: 'Lecture (livres)', icon: '📚', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Lectures' },
    { type: 'database', text: 'Bibliothèque', cols: [
      { name: 'Titre', type: 'text' },
      { name: 'Auteur', type: 'text' },
      { name: 'Statut', type: 'status', options: ['À lire', 'En cours', 'Lu'] },
      { name: 'Note', type: 'number' },
      { name: 'Lu le', type: 'date' }
    ] }
  ] },
  { name: 'Films & séries', icon: '🎬', tag: 'Loisirs', blocks: [
    { type: 'h1', text: 'À voir / vus' },
    { type: 'database', text: 'Catalogue', cols: [
      { name: 'Titre', type: 'text' },
      { name: 'Type', type: 'select', options: ['Film', 'Série'] },
      { name: 'Vu', type: 'checkbox' },
      { name: 'Note', type: 'number' }
    ] }
  ] },
  { name: 'Recettes', icon: '🍳', tag: 'Cuisine', blocks: [
    { type: 'h1', text: 'Recettes' },
    { type: 'database', text: 'Mes recettes', cols: [
      { name: 'Nom', type: 'text' },
      { name: 'Type', type: 'select', options: ['Entrée', 'Plat', 'Dessert'] },
      { name: 'Temps (min)', type: 'number' },
      { name: 'Difficulté', type: 'select', options: ['Facile', 'Moyen', 'Expert'] }
    ] }
  ] },
  { name: 'Menu de la semaine', icon: '🍽️', tag: 'Cuisine', blocks: [
    { type: 'h1', text: 'Menus de la semaine' },
    { type: 'database', text: 'Menus', cols: [
      { name: 'Jour', type: 'select', options: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] },
      { name: 'Midi', type: 'text' },
      { name: 'Soir', type: 'text' },
      { name: 'Courses faites', type: 'checkbox' }
    ] }
  ] },
  { name: 'Voyage', icon: '✈️', tag: 'Voyage', blocks: [
    { type: 'h1', text: 'Voyage — ' },
    { type: 'h2', text: 'Itinéraire' },
    { type: 'numbered', text: '' },
    { type: 'h2', text: 'Budget' },
    { type: 'database', text: 'Dépenses', cols: [
      { name: 'Date', type: 'date' },
      { name: 'Poste', type: 'text' },
      { name: 'Montant', type: 'number' },
      { name: 'Lieu', type: 'location' }
    ] },
    { type: 'h2', text: 'Checklist' },
    { type: 'todo', text: 'Passeport', done: false },
    { type: 'todo', text: 'Réservations', done: false }
  ] },
  { name: 'Idées', icon: '💡', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Boîte à idées' },
    { type: 'bullet', text: '' },
    { type: 'bullet', text: '' }
  ] },
  { name: 'Wishlist / envies', icon: '🎁', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Envies & wishlist' },
    { type: 'database', text: 'Wishlist', cols: [
      { name: 'Article', type: 'text' },
      { name: 'Prix', type: 'number' },
      { name: 'Priorité', type: 'select', options: ['Haute', 'Moyenne', 'Basse'] },
      { name: 'Lien', type: 'url' },
      { name: 'Acheté', type: 'checkbox' }
    ] }
  ] },
  { name: 'Liens utiles', icon: '🔖', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Pense-bête de liens' },
    { type: 'database', text: 'Liens', cols: [
      { name: 'Titre', type: 'text' },
      { name: 'URL', type: 'url' },
      { name: 'Catégorie', type: 'select', options: ['Dev', 'Perso', 'Admin', 'Loisirs'] },
      { name: 'Note', type: 'text' }
    ] }
  ] },
  { name: 'Idées de cadeaux', icon: '🎂', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Idées cadeaux' },
    { type: 'database', text: 'Cadeaux', cols: [
      { name: 'Pour', type: 'text' },
      { name: 'Idée', type: 'text' },
      { name: 'Budget', type: 'number' },
      { name: 'Lien', type: 'url' },
      { name: 'Offert', type: 'checkbox' }
    ] }
  ] },
  { name: 'Objectifs de l’année', icon: '🎯', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Objectifs ' },
    { type: 'database', text: 'Objectifs', cols: [
      { name: 'Objectif', type: 'text' },
      { name: 'Catégorie', type: 'select', options: ['Santé', 'Travail', 'Perso', 'Finances', 'Loisirs'] },
      { name: 'Échéance', type: 'date' },
      { name: 'Avancement %', type: 'number' },
      { name: 'Statut', type: 'status', options: ['En cours', 'Atteint', 'Abandonné'] }
    ] }
  ] },
  { name: 'Suivi d’habitudes', icon: '📊', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Habitudes' },
    { type: 'database', text: 'Tracker', cols: [
      { name: 'Habitude', type: 'text' },
      { name: "Aujourd'hui", type: 'checkbox' },
      { name: 'Série (jours)', type: 'number' }
    ] }
  ] },
  { name: 'CV', icon: '🪪', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Prénom Nom — Poste recherché' },
    { type: 'paragraph', text: 'E-mail · Téléphone · Ville · LinkedIn' },
    { type: 'h2', text: 'Profil' },
    { type: 'paragraph', text: '2-3 lignes de présentation…' },
    { type: 'h2', text: 'Expériences professionnelles' },
    { type: 'database', text: 'Expériences', cols: [
      { name: 'Poste', type: 'text' },
      { name: 'Entreprise', type: 'text' },
      { name: 'Période', type: 'text' },
      { name: 'Missions', type: 'text' }
    ] },
    { type: 'h2', text: 'Formation' },
    { type: 'database', text: 'Formation', cols: [
      { name: 'Diplôme', type: 'text' },
      { name: 'École', type: 'text' },
      { name: 'Année', type: 'text' }
    ] },
    { type: 'h2', text: 'Compétences' },
    { type: 'bullet', text: '' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Langues & divers' },
    { type: 'bullet', text: '' }
  ] },
  { name: 'Veille / presse', icon: '📰', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Veille' },
    { type: 'database', text: 'Articles à lire', cols: [
      { name: 'Titre', type: 'text' },
      { name: 'URL', type: 'url' },
      { name: 'Source', type: 'text' },
      { name: 'Lu', type: 'checkbox' }
    ] }
  ] },
  { name: 'Contacts (mini-CRM)', icon: '📇', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Contacts' },
    { type: 'database', text: 'Annuaire', cols: [
      { name: 'Nom', type: 'text' },
      { name: 'E-mail', type: 'email' },
      { name: 'Téléphone', type: 'phone' },
      { name: 'Société', type: 'text' }
    ] }
  ] },
  { name: 'Cours / études', icon: '🎓', tag: 'Études', blocks: [
    { type: 'h1', text: 'Cours — ' },
    { type: 'h2', text: 'Résumé' },
    { type: 'bullet', text: '' },
    { type: 'quote', text: 'Citation clé' },
    { type: 'h2', text: 'Questions' },
    { type: 'todo', text: '', done: false }
  ] },
  { name: 'Recherche', icon: '🔬', tag: 'Études', blocks: [
    { type: 'h1', text: 'Recherche — ' },
    { type: 'h2', text: 'Problématique' },
    { type: 'paragraph', text: '' },
    { type: 'h2', text: 'Hypothèses' },
    { type: 'numbered', text: '' },
    { type: 'h2', text: 'Sources' },
    { type: 'database', text: 'Bibliographie', cols: [
      { name: 'Titre', type: 'text' },
      { name: 'Auteur', type: 'text' },
      { name: 'Année', type: 'number' },
      { name: 'URL', type: 'url' },
      { name: 'Lu', type: 'checkbox' }
    ] }
  ] },
  { name: 'Playlist', icon: '🎵', tag: 'Loisirs', blocks: [
    { type: 'h1', text: 'Playlist' },
    { type: 'database', text: 'Morceaux', cols: [
      { name: 'Titre', type: 'text' },
      { name: 'Artiste', type: 'text' },
      { name: 'Album', type: 'text' },
      { name: 'Durée (min)', type: 'number' },
      { name: 'Écouté', type: 'checkbox' }
    ] }
  ] },
  { name: 'Travaux / rénovation', icon: '🔨', tag: 'Maison', blocks: [
    { type: 'h1', text: 'Travaux — ' },
    { type: 'database', text: 'Chantiers', cols: [
      { name: 'Pièce', type: 'text' },
      { name: 'Travaux', type: 'text' },
      { name: 'Budget', type: 'number' },
      { name: 'Statut', type: 'status', options: ['À faire', 'En cours', 'Terminé'] },
      { name: 'Priorité', type: 'select', options: ['Haute', 'Moyenne', 'Basse'] }
    ] }
  ] }
]
