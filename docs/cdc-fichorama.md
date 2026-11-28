# Fichorama — Cahier des charges

Module de la suite Skouar. Création pure dans le nouveau repo.

Découpage en sous-parties, chaque sous-partie mergée avant la suivante. Ordre de développement
conseillé : fiches et catégories (4 à 6) → consultation et tri (7 à 8) → structure de données et
export/import (9 à 10).

## 1. Mise en place

1.A — Mettre une tuile dans le launcher si ce n'est pas déjà fait, ainsi qu'un picto personnalisé et
une description : nom de l'appli Fichorama, description courte du type « Fiches de notation
personnalisables pour tout ce que tu aimes : films, livres, restos, jeux… ».

## 2. Processus de travail (règles transverses)

2.A — Règles de données posées avant de coder : conventions de persistance de la suite (Dexie,
APP_DB_MAP), snapshot avant tout import, champs identifiés par id.

2.B — Tests obligatoires à chaque étape : smoke UI simulant des clics réels à chaque sous-partie mergée.

2.C — Hors scope explicites par feature (hors scope du module en section 12).

2.D — Checklist de test manuel courte à chaque PR (seuls les tests jsdom tournent en sandbox).

2.E — Audit du code existant touché avant d'écrire dessus.

## 3. Vision et contraintes

3.A — Fichorama = fiches de notation personnalisables pour tout ce qu'on veut noter (films, livres,
albums, restos, expos, jeux vidéo, recettes…), avec une note, des commentaires et des champs adaptés
à chaque catégorie. Apps existantes du concept (Trakt, Letterboxd…) figées par domaine et en ligne ;
Fichorama est local, léger et totalement personnalisable.

3.B — Contrainte absolue : 100 % hors ligne, 100 % local. Pas de réseau, pas de télémétrie.

## 4. Fiches

4.A — Créer, modifier (à tout moment), supprimer, consulter une fiche. Chaque fiche appartient à une
et une seule catégorie et affiche les champs de cette catégorie.

4.B — Image par fiche, indispensable dès la v1 : importée depuis le disque. Redimensionnement
raisonnable (max ~400 px de large) pour limiter le poids, alerte claire si le quota de stockage est
dépassé.

4.C — Note sur 10 (échelle unique et ferme).

4.D — Commentaire libre (texte long).

4.E — Re-notation dès la v1 : bouton « re-noter » enregistre une nouvelle note avec sa date ;
l'ancienne note est conservée dans l'historique de la fiche et visible dans la vue détail (frise des avis).

4.F — Champs communs à toutes les fiches, non modifiables par catégorie : titre, note actuelle,
date d'ajout, favori (booléen).

## 5. Catégories

5.A — Catégories intégrées au premier lancement, avec modèle de champs par défaut : Films
(réalisateur, année, genre, durée), Livres (auteur, année, genre, lu le), Albums (artiste, année,
genre), Mangas/BD (auteur, tome, année), Jeux vidéo (studio, plateforme, année), Restaurants (adresse,
prix moyen, spécialités), Bars (adresse, ambiance), Musées/Expos (ville, date visite, type d'art),
Recettes (type de plat, difficulté, temps).

5.B — Création d'une catégorie : nom, puis choix des champs à afficher (parmi les types disponibles).

5.C — Paramètres par catégorie : à tout moment ajuster la liste des champs affichés (ajouter, retirer,
réordonner), renommer la catégorie, ou la supprimer avec avertissement sur les fiches concernées
(choix : supprimer les fiches ou les déplacer vers une autre catégorie).

5.D — Modifier les champs d'une catégorie ne doit jamais détruire les valeurs déjà saisies dans les
fiches existantes (règle détaillée en section 9).

## 6. Types de champs disponibles

6.A — texte : texte court (ex. réalisateur).
6.B — texte-long : texte multi-lignes (ex. résumé).
6.C — nombre : nombre, décimal autorisé (ex. prix moyen).
6.D — date : saisie de date (ex. année de sortie, date de visite).
6.E — liste : liste de choix dont les valeurs sont définies dans les paramètres du champ (ex. genre,
spécialités).
6.F — case-a-cocher : booléen (ex. « à revoir », « déjà lu »).
6.G — Chaque champ d'une catégorie est défini par : nom d'affichage, type, options éventuelles
(ex. valeurs de liste), caractère obligatoire (facultatif par défaut).

## 7. Consultation et tri

7.A — Vue par catégorie et vue toutes fiches confondues.

7.B — Tri : par note (défaut), par date d'ajout, par titre, par favoris.

7.C — Filtres : favoris, plage de notes, recherche plein texte sur titre + commentaires.

7.D — Statistiques simples en haut de page : nombre de fiches, note moyenne (globale et par catégorie).

## 8. Écrans

8.A — Accueil : liste des catégories sous forme de cartes (nb de fiches, note moyenne), bouton
nouvelle catégorie, barre de recherche globale.

8.B — Vue catégorie : grille de fiches (vignette image, titre, note), tris/filtres, bouton
« nouvelle fiche ».

8.C — Fiche détail : image, champs, note, historique des re-notes, commentaire, boutons
modifier/re-noter.

8.D — Formulaire fiche (création/modification) : champs de la catégorie dans l'ordre défini.

8.E — Paramètres catégorie : gestion des champs, renommage, suppression (cf. 5.C).

## 9. Structure des données (description fonctionnelle)

9.A — Données = catégories + fiches ; chaque fiche référence sa catégorie, porte les champs communs
(titre, note actuelle, favori, image, commentaire, date d'ajout), les valeurs de ses champs
personnalisés, et un historique de notes datées (chaque re-notation ajoute une entrée note + date).

9.B — Les valeurs personnalisées d'une fiche sont indexées par champ de la catégorie (id), de façon stable.

9.C — Règle de conservation : supprimer un champ d'une catégorie masque la donnée dans les fiches
mais ne l'efface pas ; recréer un champ équivalent doit retrouver les valeurs existantes.

9.D — Rétrocompatibilité obligatoire : numéro de version de structure et migrations non destructrices.

## 10. Export / import

10.A — Export JSON complet (catégories + fiches + images encodées) : fichorama-sauvegarde-\<date\>.json.

10.B — Import JSON avec validation et message en cas de fichier invalide ; fusion ou remplacement au
choix de l'utilisateur. Snapshot automatique des données avant tout import (cf. 2.A).

## 11. Checklists de test manuel (exemples de référence)

11.A — Créer une catégorie « Concerts » avec champs personnalisés, puis créer une fiche dedans,
vérifier l'affichage et le tri.

11.B — Re-noter une fiche, vérifier que l'ancienne note apparaît dans la frise des avis.

11.C — Supprimer un champ d'une catégorie, vérifier que les fiches ne perdent rien, recréer le champ
et vérifier la restitution.

11.D — Exporter puis importer la sauvegarde (fusion ET remplacement), vérifier l'intégrité.

## 12. Hors périmètre v1 (ferme)

12.A — Synchronisation cloud (y compris Google Drive) : exclue pour ce module comme pour toute la suite.

12.B — Partage ou publication des fiches en ligne.

12.C — Import automatique depuis des bases en ligne (TMDB etc.) : contraire au 100 % local.
