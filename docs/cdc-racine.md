# Racine — Cahier des charges

Module de la suite Skouar. Document destiné à être donné à Mistral Code pour l'implémentation. (Appli renommée : elle s'appelait « Salveto » au début du projet ; nom final : Racine.)

Avant d'attaquer les points suivants : sens-toi libre de découper les points en sous-parties et merger chaque sous-partie avant d'attaquer la suite. N'hésite pas à me poser un maximum de questions avant de commencer à coder si besoin. Ordre de développement conseillé : fondations de saisie (sections 4 à 8) → profil santé (9) → vues (12 à 15) → rapports et exports (16 à 17).

## 1. Mise en place

1.A — Mettre une tuile dans le launcher si ce n'est pas déjà fait, ainsi qu'un picto personnalisé et une description : nom de l'appli Racine, description courte du type « Journal de suivi santé et humeur, 100 % local ».

## 2. Processus de travail (règles transverses, applicables à tout le reste du cahier)

2.A — Règles de données posées avant de coder : utiliser les conventions de persistance de la suite (Dexie, APP_DB_MAP), faire un snapshot avant tout import, et respecter la règle des champs identifiés par id.

2.B — Tests obligatoires à chaque étape : chaque sous-partie mergée s'accompagne de smoke UI qui simulent des clics réels.

2.C — Hors scope explicites : chaque feature précise ce qu'elle ne fait PAS, pour éviter de sur-livrer ou de sous-livrer (les hors scope du module sont listés en section 19).

2.D — Checklist de test manuel par feature : seuls les tests jsdom tournent depuis le sandbox, le rendu réel n'est pas vérifiable de ton côté ; à chaque merge/PR, fournir une checklist courte « quoi cliquer pour vérifier » pour faciliter le tour visuel de l'utilisateur.

2.E — Audit du code existant touché avant d'écrire dessus : relire systématiquement ce qui va être modifié avant de le modifier, pour repérer et corriger en amont d'éventuels bugs latents antérieurs.

## 3. Vision et contraintes

3.A — Racine est un journal de suivi santé et humeur personnel : un endroit unique, strictement local, où l'utilisateur consigne son suivi médical du quotidien (moral, énergie, poids, douleurs, sommeil, symptômes, cycle, traitements, rendez-vous, ordonnances, profil santé). Le nom évoque ce qui pousse en silence sous la surface et nourrit tout le reste : la santé comme racine de la vie quotidienne. Les applis de suivi santé existantes sont massivement en ligne et/ou mobiles ; Racine est l'inverse : desktop, 100 % local, aucun serveur.

3.B — Contraintes absolues :

- 100 % hors ligne, 100 % local.
- Jamais en ligne, jamais synchronisé : exclu explicitement de toute future synchro Drive de la suite.
- Desktop uniquement : si la suite devient une appli smartphone un jour, ce module doit être masqué ou retiré sur mobile (prévoir un simple drapeau de configuration).
- Pas de rappel de prise de médicaments : idée abandonnée par décision ferme (risque d'oubli dangereux si l'appli ne tourne pas). Tous les rappels de Racine sont passifs, uniquement à l'ouverture de l'appli.
- Pas de code PIN : l'appli vit sur l'ordinateur personnel de l'utilisateur, décision actuelle (pourrait venir en v2 si besoin).

## 4. Suivis quotidiens (fondations de saisie)

4.A — Moral : saisie ultra-rapide (boutons 1 à 5 type « mauvais / moyen / bon »), horodatée, texte facultatif.

4.B — Énergie : niveau 1-5 distinct du moral, saisi en un clic au même moment.

4.C — Poids : valeur numérique + date, courbe d'évolution.

4.D — Douleurs/crises : gros bouton « + crise » qui horodate immédiatement, avec intensité (1-10) et notes facultatives à ajouter ensuite.

4.E — Carte du corps cliquable : la localisation d'une crise ou douleur se choisit en cliquant sur une silhouette (zone du corps qui s'illumine), en complément ou à la place d'un texte libre.

4.F — Sommeil : heure de coucher/réveil et qualité perçue (1-5), horodaté.

4.G — Symptômes libres : journal de symptômes généralisés (fièvre, fatigue, digestion, vertiges…) avec type choisi librement, intensité et durée.

4.H — Habitudes et activités : facteurs quotidiens optionnels (sport, sorties, temps d'écran, vie sociale, aliment inhabituel), traités comme déclencheurs potentiels au même titre que le journal des déclencheurs.

4.I — Journal des déclencheurs : pour les crises/douleurs, noter les facteurs suspects (aliment, manque de sommeil, stress, météo…) ; l'appli calcule et affiche les co-occurrences les plus fréquentes des crises. Observation statistique uniquement, jamais de conclusion médicale.

4.J — Note libre datée : entrée « note du jour » sans type imposé (gratitude, observation, contexte : « journée famille », « rentrée stressante »), horodatée, texte seul.

4.K — Onboarding initial : au premier lancement, un écran de configuration propose de choisir les suivis qui intéressent l'utilisateur, pour un premier contact léger plutôt qu'un cockpit.

4.L — Suivis activables/désactivables : à tout moment (paramètres), activer ou désactiver chaque type de suivi ; un suivi désactivé disparaît des boutons de saisie et des écrans dédiés (données conservées, jamais supprimées ; le réactiver restitue tout).

## 5. Traitements et efficacité

5.A — Suivi d'efficacité : à chaque prise constatée d'un traitement, supplément ou activité supposée aider, possibilité de noter son effet ressenti (aucun / léger / marqué / négatif), horodaté et rattaché au traitement.

5.B — Vue « ce qui me fait du bien » : agrégation des retours d'efficacité par traitement/activité, classée du plus bénéfique au moins utile. Observation des retours de l'utilisateur uniquement.

5.C — Observation passive uniquement : aucun conseil, aucune alerte de prise (cf. 3.B).

## 6. Constantes personnalisables

6.A — Mesures « à la carte » : tension, température, glycémie, fréquence cardiaque, etc. L'utilisateur définit ses propres constantes (nom, unité, éventuel seuil indicatif) et saisit leurs valeurs avec la date.

6.B — Chaque constante a sa courbe d'évolution, comme les autres suivis.

## 7. Cycle menstruel

7.A — Enregistrement des périodes (dates de début/fin) et notes par cycle.

7.B — Affichage : durée des cycles, durée des règles, historique par cycle.

7.C — Prévision locale des prochaines périodes : calculée sur la moyenne des cycles passés, affichée à titre purement indicatif (aucune donnée envoyée nulle part).

7.D — Fenêtre ovulatoire indicative : estimation locale à partir de l'historique, affichée à titre purement informatif.

7.E — Symptômes de flux et liés au cycle : chaque entrée de journal peut porter une mention de flux (glaires cervicales) et de phase du cycle, pour rendre les corrélations douleurs/humeur/cycle lisibles.

## 8. Rendez-vous médicaux

8.A — Liste manuelle de RDV : date, heure, praticien, lieu, motif, notes, statut (à venir / passé).

8.B — Bandeau de rappel à l'ouverture : « RDV dans 3 jours » etc. Rien d'autre : pas de notification système, le rappel n'apparaît que dans l'appli.

8.C — Historique conservé : les RDV passés restent consultables.

8.D — Compte-rendu de consultation : après un RDV, fiche « ce que le médecin a dit » : diagnostic évoqué, examens prescrits, prochaine étape, rattachée au RDV correspondant.

8.E — Préparation de consultation : liste « questions à poser au prochain RDV », alimentée au fil des jours, consultable pendant le RDV puis vidée/archivée.

## 9. Profil santé (dossier personnel)

9.A — Fiche profil : antécédents, maladies diagnostiquées, allergies, groupe sanguin, traitements en cours. Informations saisies manuellement, modifiables à tout moment.

9.B — Carnet de vaccination : vaccins reçus, dates, rappels éventuels (le rappel échu peut apparaître dans le bandeau passif, sur le même principe que l'échéancier préventif).

9.C — Antécédents familiaux : notes libres sur les maladies familiales pertinentes.

9.D — Pièces jointes : importer et ranger ses documents (ordonnances scannées, comptes-rendus hospitaliers, résultats d'analyses en PDF ou image), rattachables à un RDV ou à une ordonnance. Stockage local uniquement ; prévoir la gestion du poids (cf. 17.A).

9.E — Carte d'urgence : écran accessible en un clic depuis l'accueil, affichant allergies, groupe sanguin, traitements en cours et personne à contacter. Pensé pour être montré en cas d'urgence ; aucune diffusion automatique.

## 10. Ordonnances

10.A — Fiche par ordonnance : date, médecin, contenu/médicaments (texte), renouvellement nécessaire (case), date de fin si connue.

10.B — Vue liste triée, statut « à renouveler » visible en un coup d'œil.

10.C — Les ordonnances proches de la fin apparaissent dans le bandeau passif d'accueil (« ordonnance X se termine bientôt »). Rappel informatif uniquement : aucune alerte de prise de médicament (cf. 3.B).

10.D — Ce sont des notes de référence, PAS un outil de prise.

## 11. Échéancier de santé préventive

11.A — Suivi des examens de routine : type d'examen (dentiste, ophtalmo, bilan…), périodicité conseillée, date de dernière visite.

11.B — L'échéance approchée apparaît dans le bandeau passif d'accueil, comme les RDV et ordonnances.

## 12. Graphiques

12.A — Une courbe par suivi dans sa propre vue : poids, moral, énergie, sommeil, douleurs, symptômes, constantes personnalisées.

12.B — Chaque courbe : période glissante (ex. 1 mois / 3 mois / 1 an), valeurs brutes au survol.

12.C — Marqueurs d'événements : possibilité d'épingler un événement (« début traitement », « changement de vie », « période de stress ») qui apparaît comme trait vertical sur toutes les courbes, pour lire les corrélations.

12.D — Les croisements de courbes (ex. poids vs moral) sont hors périmètre v1, à envisager en v2.

## 13. Rapports

13.A — Fiche médecin PDF : génère un récapitulatif propre et lisible à montrer en consultation : éléments clés du profil santé, symptômes/crises depuis la dernière visite, courbes clés, traitements en cours et retours d'efficacité, questions à poser. Génération locale uniquement.

13.B — Rapport mensuel lisible : une page « ton mois » : nombre de crises, moral et énergie moyens, sommeil moyen, tendances marquantes.

## 14. Consultation du journal

14.A — Journal chronologique global (tous événements mélangés, filtrable par type : moral, énergie, poids, sommeil, crise, symptôme, constante, cycle, traitement/efficacité, habitude, RDV, ordonnance, marqueur), recherche plein texte sur les notes.

14.B — Recherche plein texte sur les notes. (voir 14.A)

14.C — Vue calendrier mensuelle : chaque jour affiche ses marqueurs (crise, règles, saisie effectuée, jour sans saisie) ; clic sur un jour pour voir ses entrées. Complément visuel de la timeline pour repérer les motifs récurrents et les trous de saisie.

14.D — Modification et suppression : toute entrée du journal est modifiable et supprimable (correction d'une saisie erronée d'hier, suppression d'une crise saisie par erreur), avec confirmation avant suppression.

## 15. Écrans

15.A — Accueil : bandeau passif (RDV, ordonnances, échéances préventives si proches, et rappel de saisie « ton moral du jour n'est pas encore noté »), accès en un clic à la carte d'urgence, boutons de saisie rapide en évidence (+ moral, + énergie, + poids, + crise, + sommeil), résumé du jour.

15.B — Journal : timeline chronologique filtrable + vue calendrier mensuelle (marqueurs par jour, clic pour voir les entrées du jour).

15.C — Courbes : un onglet par suivi, avec les marqueurs d'événements visibles.

15.D — Cycle : vue dédiée par cycle, avec prévision et fenêtre ovulatoire indicatives.

15.E — RDV et Ordonnances : listes dédiées + formulaires, comptes-rendus et pièces jointes rattachés.

15.F — Profil santé : fiche profil, vaccinations, antécédents familiaux, pièces jointes, carte d'urgence.

15.G — Traitements : liste des traitements/activités suivis et vue « ce qui me fait du bien ».

15.H — Préventif : vue échéancier des examens de routine.

15.I — Rapports : fiche médecin PDF et rapport mensuel.

15.J — Paramètres : export/import, gestion des constantes personnalisées, activation/désactivation des suivis (pas de compte, pas de réseau).

## 16. Structure des données (description fonctionnelle)

16.A — Les données forment un journal d'événements datés, chacun typé parmi : moral, énergie, poids, crise, sommeil, symptôme, constante, cycle, traitement/efficacité, habitude, RDV, ordonnance, marqueur d'événement, compte-rendu. Chaque événement porte sa date, ses valeurs propres au type, et des notes éventuelles.

16.B — Champs par type : moral = niveau 1-5 ; énergie = niveau 1-5 ; poids = kg ; crise = intensité 1-10 + localisation (carte du corps) + déclencheurs éventuels ; sommeil = heures coucher/réveil + qualité 1-5 ; symptôme = type + intensité + durée ; constante = référence de constante + valeur ; cycle = dates de début et de fin + flux éventuel ; traitement/efficacité = référence de traitement + effet ressenti ; habitude = référence d'habitude ; RDV = praticien, lieu, motif, statut, compte-rendu et pièces jointes rattachés ; ordonnance = médecin, contenu, à renouveler, date de fin, pièce jointe éventuelle ; marqueur = libellé + date.

16.C — Entités de référence réutilisées par les événements : constantes personnalisées (nom, unité, seuil), traitements/activités suivis, habitudes, échéancier préventif.

16.D — Profil santé : entité unique structurée (antécédents, maladies, allergies, groupe sanguin, traitements en cours, vaccinations, antécédents familiaux, personne à contacter) + pièces jointes rattachables.

16.E — Une entrée de configuration gère le masquage du module sur mobile (cf. 3.B).

16.F — Rétrocompatibilité obligatoire : toute évolution de la structure doit préserver les données existantes ; prévoir un numéro de version de structure et des migrations non destructrices.

## 17. Export / import

17.A — Export JSON obligatoire dès la v1 : salveto-sauvegarde-<date>.json, complet (tous suivis, profil santé, pièces jointes encodées, constantes, échéancier, marqueurs). Prévoir la taille : proposer un export « sans pièces jointes » si le fichier devient trop lourd.

17.B — Import JSON avec validation. Snapshot automatique des données avant tout import (cf. 2.A).

17.C — Aucune donnée de santé ne doit jamais être exportée automatiquement ailleurs que par les boutons d'export manuels (JSON, fiche médecin PDF).

## 18. Checklists de test manuel (exemples de référence)

18.A — Saisir moral + énergie du jour en un clic chacun, vérifier l'horodatage et l'apparition dans le journal.

18.B — Déclencher « + crise », localiser sur la carte du corps, ajouter deux déclencheurs ; vérifier la courbe des douleurs et le calcul des co-occurrences.

18.C — Noter une habitude « sport » et un effet « marqué » pour un traitement ; vérifier la vue « ce qui me fait du bien ».

18.D — Créer un RDV dans 3 jours, fermer/rouvrir l'appli, vérifier le bandeau de rappel ; ajouter un compte-rendu et une pièce jointe au RDV passé.

18.E — Ajouter une question en préparation de consultation, vérifier qu'elle apparaît dans la fiche médecin PDF avec le profil santé.

18.F — Créer une constante « tension », saisir des valeurs, vérifier sa courbe.

18.G — Épingler un marqueur « début traitement », vérifier le trait vertical sur les courbes.

18.H — Saisir trois cycles avec flux, vérifier la durée moyenne, la prévision et la fenêtre ovulatoire indicatives.

18.I — Renseigner le profil santé (allergies, groupe sanguin, traitement), importer un PDF en pièce jointe, vérifier l'affichage de la carte d'urgence en un clic depuis l'accueil.

18.J — Créer une ordonnance « à renouveler » et un examen préventif échu, vérifier le bandeau d'accueil.

18.K — Générer la fiche médecin PDF et le rapport mensuel, vérifier leur lisibilité.

18.L — Exporter puis importer la sauvegarde (avec et sans pièces jointes), vérifier l'intégrité et le snapshot préalable.

18.M — Au premier lancement, suivre l'onboarding et n'activer que quelques suivis ; vérifier que les autres disparaissent des boutons de saisie, puis les réactiver et vérifier la restitution des données.

18.N — Créer une note libre datée, la modifier, supprimer une entrée erronée, vérifier la confirmation avant suppression.

18.O — Vérifier la vue calendrier mensuelle : marqueurs visibles par jour, clic sur un jour listant ses entrées, jours sans saisie identifiables.

## 19. Hors périmètre (ferme)

19.A — Rappels de prise de médicaments (dangereux : risque d'oubli).

19.B — Notifications système de quelque nature que ce soit.

19.C — Synchronisation cloud, sauvegarde automatique externe, version web/mobile.

19.D — Analyse ou diagnostic : Racine enregistre, affiche et observe des co-occurrences ; il n'interprète jamais médicalement.

19.E — Comptage de calories ou suivi nutritionnel chiffré (périmètre hors sujet, carnet alimentaire limité à « l'inhabituel »).

19.F — Mode grossesse.

19.G — Gestion multi-profils (santé de proches/enfants).

19.H — Gamification de la saisie (séries, badges, récompenses) : volontairement exclue du ton de l'appli.
