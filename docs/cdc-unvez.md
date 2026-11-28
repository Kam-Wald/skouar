# Unvez — Cahier des charges

Module de la suite Skouar (calculatrices + convertisseur d'unités). Création pure : l'appli est
redéveloppée de zéro dans le nouveau repo, aucun code existant à reprendre.

Découpage en sous-parties, chaque sous-partie mergée avant la suivante. Ordre de développement
conseillé : convertisseur (5) → calculatrices (4) → mémos enregistrés (6) → ergonomie générale (7).

## 1. Mise en place

1.A — Mettre une tuile dans le launcher si ce n'est pas déjà fait, ainsi qu'un picto personnalisé et
une description : nom de l'appli Unvez, description courte du type « Calculatrices et convertisseur
d'unités, avec mémos enregistrés classables en dossiers ».

## 2. Processus de travail (règles transverses, applicables à tout le reste du cahier)

2.A — Règles de données posées avant de coder : utiliser les conventions de persistance de la suite
(Dexie, APP_DB_MAP), faire un snapshot avant tout import, et respecter la règle des champs identifiés
par id.

2.B — Tests obligatoires à chaque étape : chaque sous-partie mergée s'accompagne de smoke UI qui
simulent les clics réels.

2.C — Hors scope explicites : chaque feature précise ce qu'elle ne fait PAS (les hors scope du
module sont listés en section 11).

2.D — Checklist de test manuel par feature : seuls les tests jsdom tournent depuis le sandbox, le
rendu réel n'est pas vérifiable côté dev ; à chaque merge/PR, fournir une checklist courte
« quoi cliquer pour vérifier ».

2.E — Audit du code existant touché avant d'écrire dessus : relire systématiquement ce qui va être
modifié avant de le modifier.

## 3. Vision

3.A — Unvez est l'outil de calcul et conversion du quotidien : une calculatrice simple, une
calculatrice scientifique, et un convertisseur d'unités, réunis par un carnet de calculs enregistrés.
Objectif : un outil léger où rien n'est jetable, chaque calcul ou conversion digne d'intérêt peut
être sauvé, annoté et réutilisé.

3.B — Contrainte absolue : 100 % hors ligne, 100 % local. Aucune donnée externe n'entre dans l'appli
(d'où l'absence de devises, cf. 11.A).

## 4. Calculatrices

4.A — Calculatrice simple : quatre opérations, pourcentage, effacement, comportement attendu d'une
calculette classique.

4.B — Calculatrice scientifique : fonctions usuelles (trigonométrie, logarithmes, puissances/racines),
parenthèses, constantes usuelles (π, g, c) dans un petit dictionnaire accessible.

4.C — Historique/tape : les calculs récents restent visibles ; cliquer une ligne la réutilise.

4.D — Mémoire : boutons mémoire classiques (M+, M-, MR, MC) ou équivalent moderne assumé.

4.E — Copier le résultat en un clic.

4.F — Pourcentages en chaîne : boutons rapides pour appliquer des variations successives
(« −20 % puis −10 % ») au résultat courant ; chaque application reste visible dans la tape.

4.G — Toggle DEG/RAD/GRAD sur la calculatrice scientifique, visible en permanence ; les fonctions
trigonométriques suivent le mode affiché.

4.H — C / CE / retour arrière distincts : effacer l'entrée en cours (CE), tout effacer (C), corriger
le dernier caractère (retour arrière).

4.I — Persistance de la tape : l'historique survit à la fermeture/rouverture de l'appli.

4.J — Affichage lisible : séparateurs de millises et virgule décimale à la française (12 345,67),
notation scientifique pour les très grands/petits résultats (1,5e9).

4.K — Clavier physique : saisie directe au clavier (chiffres, opérateurs, Entrée = « = », retour
arrière), touches scientifiques accessibles au clavier ; l'appli est desktop avant d'être cliquable.

## 5. Convertisseur d'unités

5.A — Familles de la v1 : distance/longueur, poids/masse, volume, température, surface, vitesse,
durées (h/min/s, jours, semaines), données informatiques (bit, octet, ko/Mo/Go/To, KiB/MiB…, bits/s),
angles (degrés, radians, grades, tours), cuisine (tasse/cup, cuillère à soupe/tbsp, cuillère à café/tsp,
once, livre, stick de beurre, thermostats de four).

5.B — Paire d'unités principale : choix de l'unité source et cible, saisie d'un côté ou de l'autre
(bidirectionnel instantané), bouton swap pour échanger source et cible.

5.C — Panneau « toutes les unités de la famille » : dépliable sous la paire principale, montre la
valeur convertie dans toutes les unités de la famille d'un coup.

5.D — Recherche d'unité : taper un fragment (« km », « livre ») retrouve l'unité sans fouiller les
familles.

5.E — Paires récentes/favorites : les paires d'unités utilisées remontent en tête (récents), avec
possibilité d'en épingler certaines (favoris) ; la dernière paire utilisée est pré-chargée à l'ouverture.

5.F — Précision paramétrable : nombre de décimales réglable, avec un arrondi « humain » lisible par
défaut (éviter 0,846732 quand 847 m suffit).

5.G — Pièges de conversion à traiter correctement : la température n'est pas une simple
multiplication (offset + échelle : °C ↔ °F ↔ K) ; les données informatiques distinguent bits et
octets et affichent clairement la base utilisée (décimale ko = 1000 octets vs binaire KiB = 1024
octets), sans conversion cachée entre les deux ; les durées gèrent les valeurs mixtes proprement
(ex. saisir 1 h 30 → 5400 s / 90 min). Vérifier par tests les cas célèbres (0 °C, -40, point
d'ébullition, 1 Go = 1000 Mo en décimal).

5.H — Cuisine, précisions : les unités culinaires ont des conventions variables selon les pays ;
l'appli affiche la convention utilisée — tasse US ≈ 236,6 ml (légale US 240 ml) vs tasse métrique
250 ml, cuillère à soupe US 14,8 ml vs 15 ml métrique. Prévoir le choix de la convention (US ou
métrique), conservé par famille.

5.I — Formule affichée : le facteur de conversion utilisé est visible (ex. 1 km = 0,621371 mile),
pour la confiance et la vérifiabilité ; pour la température, afficher la règle offset + échelle
plutôt qu'un faux facteur.

## 6. Mémos enregistrés (« enregistrer »)

6.A — Bouton « Enregistrer un mémo » présent à côté de chaque calcul (calculatrice) et de chaque
conversion (convertisseur) : fenêtre de création (nom, note facultative, dossier de rangement).
Le mémo sauvegarde l'opération complète (valeur, unités ou opération, résultat, date).

6.B — Sidebar « Mémos enregistrés » : entrée dédiée dans la sidebar ; le conteneur liste les mémos
et les dossiers.

6.C — Dossiers : un seul niveau (pas de sous-dossiers) ; à la création, choix d'un picto/icône (pas
de smiley ; icônes Lucide) et d'une couleur personnalisable (composant ColorSwatches). Dossiers
renommables et supprimables ; supprimer un dossier ne détruit jamais ses mémos, ils retombent dans
« sans dossier ».

6.D — Rangement en drag & drop : chaque mémo peut être déplacé dans un dossier à la souris, en plus
du choix à la création.

6.E — Fond par mémo : choix d'un fond (palette simple) pour chaque mémo.

6.F — Vue mémos : liste des dossiers et des mémos, fond visible, résultat copiable en un clic, mémo
modifiable (nom, note, dossier, fond) et supprimable avec confirmation.

6.G — Réutilisation et mémos vivants : cliquer un mémo recharge son calcul ou sa conversion dans
l'outil correspondant et modifier une valeur recalcule le résultat ; le mémo peut être re-sauvegardé
(version mise à jour) sans créer de doublon.

6.H — Recherche dans les mémos : plein texte sur les noms, notes et valeurs.

6.I — Un mémo peut rester « sans dossier » ; les mémos et dossiers sont partagés entre calculatrices
et convertisseur.

## 7. Ergonomie et écrans

7.A — Accueil : deux modes clairs, « Calculatrice » (simple/scientifique) et « Conversion » (choix de
famille puis paire), plus l'accès aux mémos.

7.B — Sidebar « Mémos enregistrés » : entrée dédiée ; le conteneur liste dossiers (picto + couleur)
et mémos, avec le drag & drop et la recherche.

7.C — Paramètres : décimales, export/import, activation/désactivation éventuelle de la calculatrice
scientifique (pas de compte, pas de réseau).

7.D — Ton sobre et cohérent avec le design system de la suite.

7.E — Structure de la sidebar (de haut en bas) : section « Calculer » avec « Calculatrice »
(sous-choix simple/scientifique) et « Conversion » (la dernière famille utilisée s'ouvre par défaut) ;
section « Mémos enregistrés » avec « Sans dossier » en premier, puis les dossiers (picto + couleur),
bouton « + Nouveau dossier » à côté du titre ; réglages en bas. Règle directrice : sidebar =
organisation (rien n'y change jamais de place), conteneur = action.

7.F — Conteneur principal selon la sélection :

- Calculatrice : le pavé (simple ou scientifique), la tape défilante au-dessus, bouton
  « Enregistrer un mémo » près du résultat courant.
- Conversion : la paire avec swap en premier plan, panneau « toutes les unités » dépliable,
  recherche d'unité en haut, bouton « Enregistrer un mémo ».
- Dossier de mémos : grille des mémos (fond visible, nom, note, résultat, badge du type
  calc/conversion), barre de recherche en haut du conteneur, drag & drop vers les dossiers de la
  sidebar.
- « Sans dossier » : même vue que les dossiers, c'est le dossier par défaut.

## 8. Structure des données (description fonctionnelle)

8.A — Les unités et familles sont définies en interne par l'appli (facteurs de conversion, symboles,
libellés), sans saisie utilisateur ; la température porte sa règle de conversion particulière
(offset + facteur).

8.B — Les mémos enregistrés portent : nom, note facultative, dossier de rangement, fond choisi, type
(calcul ou conversion), l'opération ou les unités concernées, la valeur d'origine, le résultat,
la date.

8.C — Les dossiers portent : nom, icône (Lucide, pas de smiley), couleur ; un seul niveau
d'imbrication ; les mémos sans dossier existent par défaut.

8.D — Rétrocompatibilité obligatoire : toute évolution de la structure doit préserver les données
existantes ; prévoir un numéro de version de structure et des migrations non destructrices.

## 9. Export / import

9.A — Export JSON : unvez-sauvegarde-\<date\>.json, complet (mémos + dossiers + réglages).

9.B — Import JSON avec validation. Snapshot automatique des données avant tout import (cf. 2.A).

## 10. Checklists de test manuel (exemples de référence)

10.A — Calculatrice simple : enchaîner des opérations, vérifier l'historique cliquable et la mémoire.

10.B — Scientifique : calcul avec parenthèses et fonction trigonométrique, vérifier la priorité des
opérations.

10.C — Convertir 100 km en miles, taper dans l'autre sens, vérifier la mise à jour instantanée et le
swap.

10.D — Panneau « toutes les unités » : une valeur saisie en mètres se retrouve en toutes unités de
la famille distance.

10.E — Températures : 0 °C = 32 °F = 273,15 K ; -40 identique en °C et °F ; vérifier chaque conversion
croisée.

10.F — Enregistrer un calcul et une conversion avec nom, note et dossier, vérifier l'apparition dans
« Mémos enregistrés », changer le fond d'un mémo, le déplacer en drag & drop, le modifier, le supprimer
(avec confirmation), puis recharger une entrée.

10.Fbis — Créer un dossier avec icône Lucide et couleur personnalisée, le renommer, le supprimer et
vérifier que ses mémos retombent dans « sans dossier ».

10.G — Rechercher « km » depuis n'importe quelle famille, vérifier le résultat.

10.H — Exporter puis importer la sauvegarde, vérifier l'intégrité et le snapshot préalable.

10.I — Saisir un calcul complet au clavier physique (chiffres, opérateurs, Entrée), vérifier le
résultat et le retour arrière.

10.J — Basculer DEG/RAD et vérifier que sin(90) change bien de valeur selon le mode (1 en degrés,
~0,89 en radians).

10.K — Utiliser une paire d'unités deux fois, fermer/rouvrir l'appli, vérifier qu'elle est
pré-chargée et remonte en tête des récents.

10.L — Fermer/rouvrir l'appli, vérifier que la tape de la calculatrice est toujours là.

10.M — Durées : saisir 1 h 30, vérifier la conversion en minutes (90) et secondes (5400) dans le
panneau « toutes les unités ».

10.N — Données informatiques : convertir 1 Go en Mo en base décimale (1000), vérifier que la base
(ko vs KiB) est affichée et que bits et octets ne se mélangent pas.

10.O — Angles : convertir 180° en radians (π) et en tours (0,5), vérifier l'affichage lisible de π.

10.P — Cuisine : convertir 2 tasses US en ml (≈ 473) puis basculer en convention métrique (500 ml),
vérifier que la convention utilisée est affichée.

## 11. Hors périmètre (ferme)

11.A — Devises : exclues pour toujours. Taux de change = données externes qui changent ; contraire
au 100 % local, et un taux périmé affiché serait une désinformation.

11.B — Synchronisation cloud, version en ligne, calcul formel (résolution d'équations) : exclus.

11.C — Feuille de calcul en lignes type Soulver (variables nommées, unités dans les calculs, calcul
en langage naturel) : exclu — trop complexe à implémenter et déroutant à l'usage pour cette appli.
Ne pas l'implémenter.
