# Marge — Cahier des charges

Module de la suite Skouar : visionneuse et annotatrice de PDF complète, 100 % locale. Document destiné à être donné à Mistral Code. Création pure dans le nouveau repo, mais une v1 complète a existé dans l'ancienne version : son relevé exhaustif sert de référence fonctionnelle, la présente cible en reprend tout le fonctionnel validé et l'enrichit des décisions ci-dessous. Le nom « Marge » a été choisi par Camille le 28 nov. 2026 (ex-« Ler », abandonné) : la marge, là où l'on annote depuis que les livres existent.

Avant d'attaquer les points suivants : sens-toi libre de découper les points en sous-parties et merger chaque sous-partie avant d'attaquer la suite. N'hésite pas à me poser un maximum de questions avant de commencer à coder si besoin. Ordre de développement conseillé : bibliothèque (4) → visionneuse et navigation (5) → recherche (6) → annotations (7) → signatures, formulaires et outils sur le document (8 à 10) → fonctions d'appoint (11 à 14) → export/import et données (15 à 16).

## 1. Mise en place

1.A — Mettre une tuile dans le launcher si ce n'est pas déjà fait, ainsi qu'un picto personnalisé et une description : nom de l'appli Marge, description courte du type « Visionneuse et annotatrice de PDF : lecture, recherche, surlignage, signature, fusion et gestion des pages ».

## 2. Processus de travail (règles transverses, applicables à tout le reste du cahier)

2.A — Règles de données posées avant de coder : utiliser les conventions de persistance de la suite (Dexie, APP_DB_MAP), faire un snapshot avant tout import, et respecter la règle des champs identifiés par id.

2.B — Tests obligatoires à chaque étape : chaque sous-partie mergée s'accompagne de smoke UI qui simulent les clics réels ; l'ancienne version n'en avait aucun, c'est corrigé dès la première sous-partie.

2.C — Hors scope explicites : chaque feature précise ce qu'elle ne fait PAS (les hors scope du module sont listés en section 18).

2.D — Checklist de test manuel par feature : seuls les tests jsdom tournent depuis le sandbox, le rendu réel n'est pas vérifiable de ton côté ; à chaque merge/PR, fournir une checklist courte « quoi cliquer pour vérifier » pour faciliter le tour visuel de l'utilisateur.

2.E — Architecture légère et homogène, jamais de monolithe : l'ancienne version tenait dans un seul composant de 1466 lignes ; la nouvelle découpe le code en fonctions pures testables (plages de pages, temps relatif, noms de fichiers, sérialisation des annotations), composants (barre d'outils, popovers, pad de signature, gestionnaire de pages) et modules d'export, sur le même modèle que les autres applis de la suite.

## 3. Vision et contraintes

3.A — L'appli PDF est l'atelier de lecture et de documents du quotidien : ouvrir, lire, annoter, remplir et réorganiser des PDF, sans jamais quitter la machine. Tout ce que l'utilisateur importe, annote ou crée doit lui survivre : la persistance est absolue.

3.B — Contraintes absolues : 100 % hors ligne, 100 % local, aucun réseau ; le rendu et la manipulation des PDF se font intégralement côté client avec les bibliothèques embarquées (rendu et manipulation PDF) ; aucun document ne quitte jamais la machine, sauf par les boutons d'export manuels.

3.C — Les documents sont stockés en entier dans la base de l'appli (le fichier complet avec ses pages), et les annotations sont attachées à chaque document.

## 4. Bibliothèque de documents

4.A — Import : bouton « importer » (sélection multiple de fichiers PDF) ou glisser-déposer n'importe où dans l'appli, avec état visuel pendant le survol ; filtrer par extension et type MIME ; lire le nombre de pages à l'import ; confirmer par un toast.

4.B — Grille de cartes : miniature de la première page rendue localement, titre, nombre de pages, date relative (« il y a X ») ; tri par plus récent par défaut.

4.C — Renommage : double-clic sur le titre d'une carte → champ en place ; valider par Entrée ou perte de focus, annuler par Échap.

4.D — Dossiers : rangement des documents dans des dossiers à un seul niveau (picto + couleur personnalisables, mêmes composants que le reste de la suite) ; un document peut rester « sans dossier » ; supprimer un dossier ne détruit jamais ses documents, ils retombent dans « sans dossier » ; déplacement en glisser-déposer.

4.E — Tri et recherche de bibliothèque : tri par titre, date, nombre de pages ; recherche par nom de document.

4.F — Duplication : bouton « dupliquer » par carte, qui crée une copie de travail (« Copie de X ») avant des annotations risquées.

4.G — Suppression réversible : suppression par bouton par carte, avec toast d'annulation qui restaure le document ET ses annotations.

4.H — Barre de progression de lecture : chaque carte affiche une petite barre de progression remplie selon l'avancement dans le document (dernière page lue / nombre de pages).

4.I — Fusion : sélection multiple de documents (cases à cocher, compteur), bouton « fusionner » actif dès deux documents ; le résultat est un nouveau document de la bibliothèque contenant toutes les pages dans l'ordre de sélection.

4.J — État vide : encart cliquable invitant à importer ou glisser des fichiers PDF.

## 5. Visionneuse et navigation

5.A — Rendu : pages en canvas avec couche texte (sélection de texte native) et calque d'annotations ; rendu déclenché au fur et à mesure du défilement (chargement paresseux, marges de préchargement) pour que les gros documents restent fluides ; seules les pages visibles sont re-rendues au changement de zoom ou de rotation.

5.B — Zoom : préréglages 50 à 300 %, ajustement à la largeur, limites de zoom raisonnables ; molette et raccourcis clavier pris en charge.

5.C — Navigation : boutons page précédente/suivante, champ « page / N », vignettes de toutes les pages dans la sidebar (page courante surlignée), page courante suivie au défilement.

5.D — Mode 2 pages côte à côte, conservé entre les sessions.

5.E — Rotation de vue ±90°, conservée par document.

5.F — Mode nuit : inversion douce des pages pour lire dans le noir.

5.G — Mode présentation : plein écran, une page à la fois, interface masquée ; Échap pour sortir.

5.H — Navigation clavier complète : flèches pour tourner les pages, zoom et recherche au clavier ; l'appli est desktop avant d'être cliquable.

5.I — Signets / sommaire : si le document embarque une table des matières, l'afficher dans la sidebar et permettre la navigation par chapitre.

5.J — Reprise de lecture : chaque document retient sa dernière page lue (enregistrée en continu, sans à-coup) ; à la réouverture, retour exact à cette page.

## 6. Recherche

6.A — Recherche dans le texte du document : champ Ctrl+F, surlignage précis de chaque occurrence sur les pages, compteur « n/N », navigation Entrée / Maj+Entrée en boucle, fermeture par Échap ou clic extérieur ; insensible à la casse ; recherche sur le texte extractible uniquement.

6.B — Recherche dans les annotations : la recherche trouve aussi les contenus écrits par l'utilisateur (textes, notes, notes de page), avec un filtre « texte du document / mes annotations / tout ».

## 7. Annotations

7.A — Outils (barre latérale « Outils », avec raccourci clavier par outil) :

- Sélection de texte → surlignage précis : la sélection native du texte devient un surlignage, avec rectangles fusionnés ligne par ligne.
- Surligner : rectangle au glisser, taille minimale pour éviter les poses accidentelles.
- Dessin libre : tracé continu à la souris.
- Flèche : ligne avec tête de flèche, posée au glisser.
- Cercle : ellipse posée au glisser.
- Texte : bloc de texte posé au clic, avec choix de taille ; validation par Ctrl+Entrée.
- Tampon : libellés prédéfinis (« Lu », « À faire », « Refusé », « Important ») posés au clic, supprimables d'un clic.
- Note : note ponctuelle posée au clic, avec contenu par défaut discret.
- Signature : pose de la signature choisie (cf. section 8).

7.B — Couleurs : palette commune de cinq couleurs pour tous les outils, mémorisée entre les usages.

7.C — Déplacement et modification : toute annotation (y compris surlignage, dessin, flèche, cercle) est déplaçable à la souris après création ; les annotations à contenu (texte, note, tampon) sont rééditables au clic, en conservant leur identité.

7.D — Undo/redo : annuler et rétablir (Ctrl+Z / Ctrl+Y) couvre la pose, le déplacement, la modification et la suppression d'annotations ; un petit historique par session suffit.

7.E — Suppression : par la liste d'annotations ou au clic sur l'annotation selon l'outil, avec confirmation légère et couverture par l'undo.

7.F — Notes de page : en plus des notes ponctuelles, une zone « note de page » par page (l'équivalent d'une marge) pour noter ce que la page recèle, sans point d'ancrage précis ; visible et éditable depuis un panneau et depuis la liste d'annotations.

7.G — Liste d'annotations (sidebar) : compteur, lignes triées par page puis par date avec couleur, type et extrait du contenu ; clic = aller à la page ; bouton d'export/import JSON (cf. 16.A) ; état vide guidé.

7.H — Les annotations sont stockées en coordonnées indépendantes du zoom et de la rotation : elles restent justes quel que soit l'affichage.

## 8. Signatures

8.A — Carnet de signatures : plusieurs signatures nommées (« Camille », « Camille pro », paraphe…), dessinées dans un pad dédié (tracer, effacer, enregistrer), gérées dans la sidebar.

8.B — Pose : la signature se pose au clic à la taille choisie, déplaçable et supprimable comme les autres annotations.

## 9. Formulaires PDF

9.A — Détection des champs : si le document contient des champs de formulaire (champs de saisie, cases à cocher, listes), l'appli les détecte et permet de les remplir directement, 100 % en local.

9.B — Enregistrement : les valeurs saisies sont enregistrées dans le document lui-même (le PDF modifié remplace la version dans la bibliothèque, la modification étant couverte par l'annulation de la bibliothèque) ; possibilité d'exporter le PDF rempli.

9.C — Si le document n'a pas de champs de formulaire, l'utilisateur peut toujours remplir visuellement avec l'outil Texte posé par-dessus.

## 10. Outils sur le document

10.A — Gestion des pages : vue « pages du document » en grille avec vignettes ; réordonner par glisser-déposer et supprimer des pages ; toute action produit un nouveau document modifiable (avec annulation), jamais une perte silencieuse.

10.B — Extraction de pages : saisir une ou des plages (« 1-3, 5 ») → nouveau document contenant ces pages.

10.C — Insertion ciblée : importer les pages d'un autre document de la bibliothèque à l'endroit choisi (« insérer les pages 2-4 de Y après la page 6 »).

10.D — Page blanche : insérer une page blanche à l'endroit voulu.

10.E — Rotation sauvegardée : en plus de la rotation de vue (5.E), une action « tourner la/les pages pour de bon » qui modifie le document (utile pour les scans à l'envers).

10.F — Export d'une page en image : exporter la page courante (ou une sélection) en image PNG.

10.G — Numérotation des pages : ajouter des numéros de page à un document qui n'en a pas (position et départ paramétrables).

10.H — Comparaison côte à côte : ouvrir deux documents (ou deux versions) l'un à côté de l'autre, défilement synchronisé, zoom commun ; pour relire deux versions d'un même contrat ou rapport.

## 11. Carnet de citations

11.A — Export « fiche de lecture » : générer un document propre listant les surlignages et notes du document, par page, avec le contenu extrait et la note éventuelle de l'utilisateur ; export en fichier téléchargeable réutilisable dans l'appli de texte de la suite.

## 12. Reprise de lecture au niveau de la suite

12.A — Le launcher de la suite affiche discrètement, pour l'appli PDF, les documents en cours de lecture (« titre — laissé page 87 »), sur le même principe passif que les rappels de l'appli santé : information à l'ouverture, jamais de notification système.

## 13. Écrans et ergonomie

13.A — Bibliothèque : grille des documents, dossiers dans la sidebar, tri et recherche, boutons importer / fusionner / dupliquer.

13.B — Visionneuse : pages au centre, sidebar avec vignettes, signets, liste d'annotations et outils ; barre de progression de lecture en haut ; pied avec réglages et thème, comme les autres applis.

13.C — Gestion des pages / outils sur le document : vues et popovers dédiés, accessibles depuis la visionneuse et la bibliothèque.

13.D — Règle directrice de la suite : sidebar = organisation (rien n'y change jamais de place), conteneur = action.

13.E — Popovers et toasts comme dans toute la suite (fermeture au clic extérieur et par Échap, jamais d'alertes système), cibles tactiles et raccourcis clavier documentés.

## 14. Structure des données (description fonctionnelle)

14.A — Documents : identifiant, titre, contenu complet (fichier entier), nombre de pages, date de modification, dernière page lue, rotation de vue éventuelle, progression de lecture, dossier de rangement éventuel.

14.B — Annotations : identifiant, document, page, type (surlignage, dessin, flèche, cercle, texte, tampon, note, signature), position et dimensions en coordonnées indépendantes de l'affichage, couleur, contenu textuel éventuel, taille éventuelle, image éventuelle (signature), date ; identifiés par identifiant, jamais par contenu.

14.C — Notes de page : identifiant, document, page, contenu, date.

14.D — Dossiers : identifiant, nom, picto, couleur ; un seul niveau ; documents sans dossier par défaut.

14.E — Signatures : identifiant, nom, image, date de création.

14.F — Réglages : mode 2 pages, mode nuit, couleurs d'outils, signature active.

14.G — Rétrocompatibilité obligatoire : toute évolution de la structure doit préserver les données existantes ; numéro de version de structure et migrations non destructrices, sur le modèle commun de la suite.

## 15. Export / import

15.A — Annotations JSON : export <titre>-annotations.json ; l'import accepte un tableau ou l'objet exporté, ré-attribue au document courant, confirme par toast, signale proprement un fichier invalide ; snapshot automatique avant tout import.

15.B — PDF aplati : export <titre>-annote.pdf avec les annotations incrustées dans le fichier (surlignages en transparence, traits, textes à leur taille, tampons, signatures en image) ; le texte des annotations conserve les accents français (police embarquée pour l'export, plus jamais de « ? » à la place d'un accent) ; noms de fichiers nettoyés pour tous les systèmes.

15.C — Fiche de lecture (cf. 11.A) et page en image (cf. 10.F) : exports manuels par bouton uniquement.

15.D — Les documents eux-mêmes sont couverts par l'export ZIP global de la suite ; aucune donnée ne sort jamais automatiquement de la machine.

## 16. Checklists de test manuel (exemples de référence)

16.A — Importer deux PDF (bouton et glisser-déposer), vérifier miniatures, nombre de pages, tri par date, renommage par double-clic.

16.B — Créer deux dossiers avec picto et couleur, y déplacer des documents par glisser-déposer, supprimer un dossier et vérifier le retour dans « sans dossier ».

16.C — Dupliquer un document, ouvrir l'original, le dupliqué reçoit ses propres annotations sans toucher à l'original.

16.D — Lire un document : zoom préréglages et largeur, mode 2 pages, rotation de vue, mode nuit, mode présentation (Échap pour sortir), navigation clavier complète, signets cliquables si le PDF en a.

16.E — Fermer en page 87, rouvrir : retour exact page 87, barre de progression remplie en conséquence, bandeau du launcher affichant la reprise.

16.F — Ctrl+F : occurrences surlignées, compteur n/N, Entrée/Maj+Entrée, Échap ; chercher un mot présent dans ses annotations avec le filtre « mes annotations ».

16.G — Poser chaque outil d'annotation (sélection précise sur deux lignes, surlignage, dessin, flèche, cercle, texte, tampon, note, signature), puis déplacer chacun ; rééditer un texte et une note ; annuler et rétablir (Ctrl+Z / Ctrl+Y) une pose, un déplacement, une suppression.

16.H — Écrire une note de page, la retrouver dans la liste d'annotations et la modifier.

16.I — Créer deux signatures nommées, en poser chacune, basculer entre elles, en supprimer une.

16.J — Ouvrir un PDF avec formulaire, remplir les champs, fermer/rouvrir : les valeurs sont conservées ; exporter le PDF rempli et le rouvrir.

16.K — Fusionner deux documents ; extraire « 1-3, 5 » ; insérer les pages 2-4 d'un autre document après la page 6 ; insérer une page blanche ; réordonner des pages par glisser-déposer ; supprimer une page ; vérifier chaque résultat et l'annulation.

16.L — Tourner une page « pour de bon », exporter le PDF et le rouvrir : la rotation est dans le fichier.

16.M — Exporter la page 12 en PNG ; numéroter les pages d'un document sans numérotation et vérifier le résultat.

16.N — Comparer deux versions côte à côte : défilement synchronisé, zoom commun.

16.O — Générer la fiche de lecture : surlignages et notes classés par page avec leurs contenus.

16.P — Exporter les annotations JSON, les réimporter sur un autre document ; exporter le PDF aplati et vérifier que les accents français sont intacts dans le fichier obtenu.

16.Q — Supprimer un document, annuler depuis le toast : document ET annotations restaurés.

16.R — Ouvrir un gros PDF (300 pages) : défilement fluide, pas de blocage au chargement.

## 17. Hors périmètre (ferme)

17.A — OCR des PDF scannés : la recherche porte sur le texte extractible uniquement ; pas de reconnaissance de texte sur images (à réévaluer un jour via un module dédié, jamais en silence).

17.B — PDF protégés par mot de passe : message clair « document protégé, non ouvert », sans tentative de déverrouillage.

17.C — Compression de PDF : territoire du futur module de conversion/compression de la suite ; l'appli PDF n'embarque pas de compression.

17.D — Lecture à voix haute, liens profonds inter-applis, marque-pages multiples, statistiques de lecture détaillées, révision flash des surlignages, fenêtre d'étude couplée à l'appli de texte, tampons datés personnalisés : idées écartées par décision de l'utilisateur ; ne pas implémenter sans nouvelle demande.

17.E — Synchronisation cloud, version en ligne, partage : exclus, comme pour toute la suite.
