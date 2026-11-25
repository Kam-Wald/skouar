import type { BlockType } from './types'

export interface TemplateSpec {
  name: string
  icon: string
  tag: string
  blocks: { type: BlockType; text: string; done?: boolean }[]
}

export const TEMPLATES: TemplateSpec[] = [
  { name: 'Page vide', icon: '📄', tag: 'Base', blocks: [{ type: 'paragraph', text: '' }] },
  { name: 'Bienvenue', icon: '👋', tag: 'Base', blocks: [
    { type: 'h1', text: 'Bienvenue 👋' },
    { type: 'paragraph', text: 'Tape / pour insérer un bloc, [[ pour lier une page, Ctrl+Z pour annuler.' },
    { type: 'todo', text: 'Essayer le menu /', done: false },
    { type: 'todo', text: 'Créer une base de données ▦', done: false }
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
  { name: 'Réunion', icon: '🧑‍🤝‍🧑', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Réunion — ' },
    { type: 'paragraph', text: 'Participants : ' },
    { type: 'h2', text: 'Ordre du jour' },
    { type: 'numbered', text: '' },
    { type: 'numbered', text: '' },
    { type: 'h2', text: 'Décisions' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Actions' },
    { type: 'todo', text: '', done: false }
  ] },
  { name: 'Projet', icon: '🚀', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Projet ' },
    { type: 'paragraph', text: 'Objectif : ' },
    { type: 'h2', text: 'À faire' },
    { type: 'todo', text: '', done: false },
    { type: 'database', text: 'Suivi' }
  ] },
  { name: 'Suivi de tâches', icon: '✅', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Tâches' },
    { type: 'todo', text: '', done: false },
    { type: 'todo', text: '', done: false },
    { type: 'todo', text: '', done: false }
  ] },
  { name: 'Budget mensuel', icon: '💰', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Budget — ' },
    { type: 'database', text: 'Dépenses' }
  ] },
  { name: 'Lecture (livres)', icon: '📚', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Lectures' },
    { type: 'database', text: 'Bibliothèque' }
  ] },
  { name: 'Films & séries', icon: '🎬', tag: 'Loisirs', blocks: [
    { type: 'h1', text: 'À voir / vus' },
    { type: 'database', text: 'Catalogue' }
  ] },
  { name: 'Recettes', icon: '🍳', tag: 'Cuisine', blocks: [
    { type: 'h1', text: 'Recettes' },
    { type: 'database', text: 'Mes recettes' }
  ] },
  { name: 'Voyage', icon: '✈️', tag: 'Voyage', blocks: [
    { type: 'h1', text: 'Voyage — ' },
    { type: 'h2', text: 'Itinéraire' },
    { type: 'numbered', text: '' },
    { type: 'h2', text: 'Budget' },
    { type: 'database', text: 'Dépenses' },
    { type: 'h2', text: 'Checklist' },
    { type: 'todo', text: 'Passeport', done: false },
    { type: 'todo', text: 'Réservations', done: false }
  ] },
  { name: 'Idées', icon: '💡', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Boîte à idées' },
    { type: 'bullet', text: '' },
    { type: 'bullet', text: '' }
  ] },
  { name: 'Objectifs de l’année', icon: '🎯', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Objectifs ' },
    { type: 'h2', text: 'T1' },
    { type: 'todo', text: '', done: false },
    { type: 'h2', text: 'T2' },
    { type: 'todo', text: '', done: false }
  ] },
  { name: 'Suivi d’habitudes', icon: '📊', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Habitudes' },
    { type: 'database', text: 'Tracker' }
  ] },
  { name: 'CV', icon: '🪪', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Curriculum Vitae' },
    { type: 'h2', text: 'Expériences' },
    { type: 'paragraph', text: '' },
    { type: 'h2', text: 'Compétences' },
    { type: 'bullet', text: '' },
    { type: 'h2', text: 'Formation' },
    { type: 'paragraph', text: '' }
  ] },
  { name: 'Veille / presse', icon: '📰', tag: 'Travail', blocks: [
    { type: 'h1', text: 'Veille' },
    { type: 'database', text: 'Articles à lire' }
  ] },
  { name: 'Contacts (mini-CRM)', icon: '📇', tag: 'Perso', blocks: [
    { type: 'h1', text: 'Contacts' },
    { type: 'database', text: 'Annuaire' }
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
    { type: 'database', text: 'Bibliographie' }
  ] },
  { name: 'Playlist', icon: '🎵', tag: 'Loisirs', blocks: [
    { type: 'h1', text: 'Playlist' },
    { type: 'database', text: 'Morceaux' }
  ] }
]
