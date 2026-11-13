# Fiches de Cours — ATIKAN

Application web installable (PWA) qui rédige une fiche de cours complète à partir
du **titre de la leçon**, de la **classe** et de l'**activité**, en s'appuyant sur
les documents injectés dans le dossier `base/`.

Auteur : Donatien Kouabenan — ATIKAN

---

## 1. Clé API gratuite (une seule fois)

1. Va sur https://aistudio.google.com/apikey avec un compte Google.
2. « Create API key » → copie la clé (`AIza…`).
3. Dans l'appli : onglet **Réglages** → colle la clé → Enregistrer.

Secours facultatif : clé Groq gratuite sur https://console.groq.com/keys
(Réglages → Options avancées). L'appli bascule dessus si Gemini est saturé.

Après avoir collé la clé, touche **Tester les clés** : l'appli confirme si Google l'accepte.

La clé reste dans le navigateur de l'appareil, elle n'est pas dans le code.

## 2. Ce que contient la base (dossier `base/`)

| Fichier | Contenu |
|---|---|
| `francais-config.js` | classes, activités officielles, **format officiel** de la fiche (tiré des fiches APC 3e) |
| `francais-progressions.js` | progressions DPFC 2026-2027 de la **6e, 5e, 4e et 3e**, semaine par semaine |
| `francais-fiches-3e.js` | les **79 fiches APC 3e** 2026-2027 (grammaire, orthographe, oral, lecture, œuvre intégrale, écrit) |
| `francais-fiches-6e.js` | les **47 fiches de 6e** (compétences 1 à 5) |
| `francais-guides.js` | le module de formation CNDF/DPFC (déc. 2025) découpé par activité : démarches, évaluation, situations, 2nd cycle, + 2 fiches officielles de 5e |
| `francais-fiches-5e.js` | **97 fiches de 5e** : fiches Word (compétences 1, 3, 4-5) et fiches de leçon CNDF |
| `francais-fiches-4e.js` | **46 fiches de leçon CNDF de 4e** |
| `francais-programmes.js` | **programmes éducatifs et guides d'exécution 6e, 5e, 4e, 3e**, découpés par compétence et par leçon (situations, habiletés, contenus, consignes), + leurs fiches exemples |
| `francais-exercices.js` | **cahier d'exercices 5e** (12 parties) : banque d'exercices pour les évaluations |
| `francais-modeles.js` | emplacement libre pour **tes propres** fiches exemples |
| `mes-documents.js` | documents exportés depuis l'appli (voir « Agrandir la base ») |
| `edhc-config.js` | matière **EDHC** : classes, activités, format officiel de la fiche EDHC |
| `edhc-progressions.js` | progressions annuelles EDHC 2026-2027 (DPFC) de la **6e à la 3e** |
| `edhc-fiches.js` | **25 fiches EDHC** (12 de 5e, 13 de 3e) |
| `edhc-guides.js` | modules de formation EDHC (déc. 2025 – janv. 2026) : programme, situations, stratégies, évaluation, fiche de leçon, TP, didactique, animation |
| `edhc-supports.js` | **tes supports EDHC** : situations d'apprentissage du Collège Moderne de Lataha (3e, 5e), reprises telles quelles dans les fiches, et **interrogations écrites corrigées** (leçons 1 à 5, de la 6e à la 3e) |
| `edhc-manuels.js` | manuels EDHC 3e et 5e (Vallesse), cahier d'habiletés 5e (JD Éditions), corrigés du livre de l'enseignant 5e, 20 sujets type BEPC avec corrigés — joints avec l'autorisation des éditeurs, découpés par leçon (77 documents) |

Pour chaque demande, l'appli envoie à l'IA :
- le format ;
- la progression de la classe ;
- 3 fiches exemples de la même activité, les plus proches du titre, dont au moins une au format détaillé ;
- les guides de l'activité ;
- jusqu'à 3 documents **de la même leçon** : situation d'apprentissage, manuel, cahier d'exercices…

L'onglet **Base** permet de tout consulter et de filtrer.

### Agrandir la base depuis l'appli (sans toucher au code)

Onglet **Base** → **Agrandir la base** :
1. **Choisir des fichiers** : PDF, Word (.docx), texte ou photos. Tu peux en choisir plusieurs à la fois.
   - Les PDF « texte » et les fichiers Word sont lus directement sur le téléphone.
   - Les **PDF scannés** et les **photos** sont lus par reconnaissance de texte : **sur le téléphone** (sans clé, hors connexion après la première fois) ou **en ligne** avec la clé Gemini (plus fidèle pour les tableaux). Plusieurs photos peuvent former un seul document.
   - **Scanner des pages avec l'appareil photo** : photographie le support page par page. Tu peux réordonner, pivoter ou retirer chaque page, et l'« effet scan » met le fond au blanc et atténue les ombres. Choisis ensuite le mode de lecture (Automatique, Sur le téléphone, En ligne) puis **Lire les n pages**. Le texte obtenu arrive dans un brouillon à vérifier, avec le classement proposé et le découpage d'un recueil, comme pour un fichier.
   - La lecture sur le téléphone utilise Tesseract (dossier `vendor/tesseract/`, français). La première lecture télécharge environ 5 Mo ; ensuite elle fonctionne hors connexion.
   - **Coller un texte** : pour un texte copié ailleurs.
2. L'appli propose **la matière, le type, les classes et les activités** : vérifie-les et corrige-les d'un toucher.
3. Un **recueil** (plusieurs fiches dans un seul fichier, ou un programme) est **découpé automatiquement** : chaque partie reçoit son titre, sa classe et son activité.
4. **Ajouter à la base**. Les documents restent sur l'appareil et **passent en priorité** quand l'appli prépare une fiche. Ils apparaissent aussi dans « Modèle à suivre ».
5. **Nouvelle matière** : choisis « ＋ Nouvelle matière… » dans la liste (ex. Histoire-Géographie). Elle apparaît ensuite dans le formulaire, avec un format de fiche générique que tu peux remplacer en important ton format officiel (type « Format de fiche »).

**Mes documents** : modifier ou supprimer chaque document.
- **Sauvegarder (fichier)** puis **Restaurer** : pour garder une copie ou passer sur un autre téléphone.
- **Exporter pour le code** : produit `mes-documents.js`. Remplace celui du dossier `base/`, change `VERSION` dans `sw.js`, puis redéploie : les documents seront disponibles sur tous les appareils.

### Ajouter un document à la main dans le code

```js
BASE.ajouter({
  matiere: "Français",
  type: "modele",                 // format | progression | modele | guide | document
  classes: ["4e"],                // ou ["toutes"]
  activites: ["Lecture méthodique"], // ou ["toutes"]
  titre: "Fiche exemple — Lecture méthodique 4e",
  contenu: `
… texte complet …
`
});
```

- Le texte va entre accents graves `` ` ``. S'il contient lui-même un accent grave, écris `` \` ``.
- L'activité doit être écrite **exactement** comme dans `francais-config.js`.
- Les progressions du 2nd cycle (2nde, 1ère, Tle) ne sont pas encore dans la base : à ajouter dans `francais-progressions.js`.

## 3. Ajouter une matière plus tard

Crée `base/histoire-config.js` (copie de `francais-config.js` avec
`BASE.definirMatiere("Histoire-Géographie", {...})`), ajoute ses fichiers,
puis une ligne `<script src="base/…"></script>` dans `index.html`
(et dans la liste `FICHIERS` de `sw.js`).

## 4. Mettre en ligne (Netlify)

Glisse le dossier entier sur https://app.netlify.com/drop.
Après chaque ajout de documents : change `VERSION` dans `sw.js`
(`fiches-v29` → `fiches-v30`…) puis redéploie, pour que les téléphones
récupèrent la nouvelle base.

## 5. Règles envoyées à l'IA (`js/regles.js`)
À chaque génération, l'IA reçoit les **règles générales** (respect strict du gabarit, densité, citations exactes avec leurs lignes, liste de contrôle finale), puis **le bloc de l'activité choisie** : démarche officielle et exigences propres, pour chaque activité de Français et d'EDHC. Pour modifier une règle, il suffit d'éditer `js/regles.js`.
Lecture méthodique : l'hypothèse générale suit la forme « type + tonalité + thème » ; l'axe 1 porte sur le type et la tonalité, l'axe 2 sur le thème ; le **tableau de vérification est en annexe**.

## 5 bis. Parcours dans l'appli
- **Premier lancement** : l'appli ouvre **Réglages**. Il faut y remplir **Mon profil** (nom, établissement, effectif, et les classes tenues en touchant les pastilles) et y coller la clé Gemini. Les menus ne proposent ensuite que tes classes, et l'en-tête des fiches se remplit tout seul.
- **Ma semaine** (accueil) : les séances de la semaine pour chacune de tes classes, d'après la progression. Chaque séance a son état : un point plein quand elle est prête. **Préparer** ouvre le formulaire déjà rempli, **Ouvrir** affiche la fiche, et « Préparer les n séances à la suite » fait toute la semaine d'une classe. Les flèches ‹ › permettent de voir les semaines voisines.
- **Préparer** : un formulaire court (classe, activité, leçon) avec un seul bouton. Le volet **Affiner** contient la fiche de référence, la semaine, la durée, la page portrait ou paysage, les remarques, **Mon texte support**, **Mon plan** (avec « Me proposer un plan à valider d'abord ») et la page à photocopier.
- **La fiche** s'affiche tout de suite, avec trois boutons : **Télécharger** (PDF, Word, Imprimer), **Partager** et **⋯** (traces écrites seules, page élèves, taille du texte à l'écran, page portrait ou paysage, copier, refaire la fiche). « Demander une modification » se trouve sous la fiche.
- **Mes fiches** : un cahier par classe, rangé par semaine, avec une recherche et un filtre par classe.
- **Année** : toute la progression, semaine par semaine.
- **Réglages** : profil, service de rédaction (clé), base documentaire, sauvegarde.

## 5 ter. Détail des fonctions

- **Nouvelle fiche** : matière, classe, activité, titre, puis **Générer**. Après chaque génération réussie, le formulaire se vide de ce qui est propre à la leçon (titre, semaine, consignes, texte support, plan, modèle choisi). Il garde la matière, la classe, l'activité, la durée, l'établissement, le professeur et l'orientation. **Tout effacer** fait la même chose à la main.
  - Indiquer la **semaine** aide l'appli à retrouver la séance exacte.
  - **Orientation** : portrait ou paysage. Le choix s'applique à l'aperçu, au PDF et au fichier Word, et peut être changé après coup sur la fiche.
  - **Consignes pour l'IA** : un petit texte libre (« situation en milieu rural », « deux exercices »…), ou les boutons de consignes rapides.
  - **Consignes permanentes** (dans Réglages) : elles sont ajoutées à chaque fiche (ex. classes nombreuses, zone rurale).
- **Modèle à suivre** : par défaut l'appli choisit les fiches les plus proches (la meilleure est présentée comme modèle principal). Choisis une fiche dans la liste pour **imposer sa structure à la lettre** (rubriques, colonnes, durées) : le format par défaut et les autres exemples sont alors écartés.
- **Proposer un plan d'abord** : au lieu de générer directement, touche ce bouton. L'appli propose un plan (titres et sous-titres) fondé sur la progression, les guides et les fiches exemples. Sur l'écran **Plan proposé** tu peux :
  - corriger les intitulés, changer le niveau (⇄), déplacer (↑ ↓) ; les titres longs s'affichent en entier sur plusieurs lignes, supprimer ou ajouter des parties ;
  - **commenter** une partie (💬) et laisser une **remarque générale** ;
  - **redemander un plan** à l'IA qui tient compte de tes modifications et commentaires (autant de fois que voulu) ;
  - cocher **« Je valide ce plan »** : le bouton **Générer la fiche** ne s'active qu'à ce moment, et toute nouvelle modification retire la validation.
  Rien n'est rédigé avant la validation. La fiche reprend alors le plan tel quel, et tes commentaires restants servent de consignes pour chaque partie. Si tu as déjà écrit un plan dans « Plan de la fiche », il sert de point de départ. Le plan validé est recopié dans le formulaire (utile pour **Régénérer**).
- **Plan de la fiche** : ajoute tes titres et sous-titres (numérotés I. / 1. automatiquement, réordonnables). L'IA les reprend tels quels, dans l'ordre.
- **Texte support** : colle ton texte dans son propre champ, en gardant les retours à la ligne, ou touche **Scanner le texte avec l'appareil photo** : photographie la page (ou les pages) du livre, et le texte reconnu se place dans le champ, à relire (mêmes modes de lecture que le scanner de la Base ; les numéros de page ou de ligne isolés sont retirés). Il est transmis à part, reproduit mot pour mot et jamais pris pour une consigne. **Forme du texte** (automatique, prose, lettre, poème, théâtre, article, dialogue, affiche) : l'appli respecte la mise en page propre à chaque type. Pour une lettre : date et signature à droite, formule d'appel, alinéas. Pour un poème : un vers par ligne et des strophes séparées. Pour le théâtre : personnages et didascalies. Pour un article : titre et chapeau. Les lignes ou les vers sont numérotés de 5 en 5, à l'écran comme en Word et en PDF.
- **Retoucher** : sur la fiche, écris une consigne (« ajoute un exercice ») puis **Appliquer**. L'IA renvoie la fiche modifiée.
- La fiche est aussi **modifiable directement** : il suffit de cliquer dans le texte.
- **Traces écrites** : colonne élargie (32 %), titres en vert, sous-titres en ocre, règles encadrées, exemples en bleu, remarques en prune. La mise en forme est appliquée automatiquement, même si l'IA l'oublie.
- **Word** télécharge un vrai fichier `.docx` et **PDF** un vrai fichier `.pdf`. En mode paysage, la **page elle-même** est en A4 paysage (29,7 × 21 cm), avec les couleurs conservées. Les bibliothèques d'export (dossier `vendor/`) se chargent au premier export.
- **Traces écrites** : n'affiche que les traces écrites de la fiche (la colonne du déroulement, ou les rubriques « Trace écrite », « Résumé », « Retenons »), à la suite, en portrait. Word, PDF, Partager, Imprimer et Copier portent alors sur les traces seules. **Fiche complète** revient à la fiche.
- **A− / A+** : taille du texte, de 85 % à 200 %. La feuille garde sa largeur et le texte se réorganise. Le réglage ne concerne que la lecture à l'écran : Word, PDF et impression restent en taille normale. Il est retenu.
- **Écran de génération** : sobre, avec une page qui s'écrit, « Rédaction de la fiche… » et une barre de progression. **Masquer** le referme sans arrêter la rédaction.
- **Page élèves** (page à photocopier) : sur une fiche, ce bouton ajoute après la fiche le **texte-support**, la **situation d'apprentissage** et/ou la **situation d'évaluation** (avec une ligne « Nom et prénoms »), chacun sur sa propre page **ou tout sur une même page** (situation d'apprentissage, texte-support, puis situation d'évaluation, dans un seul exemplaire). Elle est toujours en A4 portrait, même pour une fiche en paysage. Les exemplaires sont placés côte à côte sur deux colonnes, sur autant de rangées que la page le permet (choix automatique, ou 1 à 8 par page), avec des traits de découpe. Seuls la situation, le texte et les consignes y figurent : jamais le tableau des habiletés ni les rubriques de la fiche. La page est modifiable à la main. Elle est incluse dans le Word et le PDF de la fiche, et **PDF de cette page seule** l'exporte à part. Dans le formulaire, la case « Ajouter aussi une page à photocopier » l'ajoute automatiquement à chaque fiche.
- **Imprimer** ouvre l'impression du navigateur.
- **Mes fiches** garde tout l'historique sur l'appareil (fiches et devoirs 📝).

### Mon année (onglet Année)
- Choisis la matière et la classe : toute la progression officielle s'affiche semaine par semaine. Les congés sont tirés de `base/calendrier.js` (à mettre à jour chaque année).
- La **semaine en cours** est repérée d'après la date. Si ta classe est en avance ou en retard, décale-la avec **−1 / +1**.
- **Préparer** ouvre le formulaire déjà rempli (classe, activité, leçon, séance, semaine). Il reste à ajouter tes consignes puis à générer.
- **Préparer toute la semaine** génère à la suite toutes les séances qui ne sont pas encore prêtes.
- Une séance passe à ✔ dès qu'une fiche existe pour elle. Tu peux aussi la cocher à la main.

### Devoirs et évaluations
- Dans **Nouvelle**, choisis **📝 Devoir / évaluation**, puis le type : interrogation, devoir surveillé, rédaction, orthographe (dictée), sujet type BEPC, situation d'évaluation ou remédiation. Indique aussi le barème.
- Depuis **Mon année**, les devoirs prévus par la progression arrivent avec les leçons à évaluer déjà indiquées.
- L'appli produit d'abord le **sujet** prêt à photocopier, puis le **corrigé et le barème**, qui commencent sur une **nouvelle page** (Word et PDF) : il suffit d'imprimer la première partie pour les élèves.

### Partager
- **Partager** envoie la fiche en PDF ou en Word (WhatsApp, e-mail…) par le menu de partage du téléphone. Sur ordinateur, le fichier est téléchargé.

### Sauvegarde Google Drive (désactivée pour l'instant)
> Masquée dans l'appli. Pour la réactiver : mettre `DRIVE_ACTIF = true` en haut de `js/drive.js`, puis suivre les étapes ci-dessous.

Les fiches, les documents ajoutés, les réglages et les séances cochées sont copiés dans ton Drive, dans le dossier **« Fiches de Cours (ATIKAN) »**. Les clés API, elles, ne quittent jamais l'appareil. Sur un nouveau téléphone, il suffit de se connecter pour tout retrouver : les deux appareils sont fusionnés et rien n'est effacé.

**À faire une seule fois : créer un identifiant client Google (gratuit, environ 5 minutes)**
1. Va sur https://console.cloud.google.com et crée un projet (ex. « Fiches de Cours »).
2. Ouvre **API et services → Bibliothèque**, cherche **Google Drive API** et clique sur **Activer**.
3. Ouvre **Écran de consentement OAuth** :
   - type **Externe** ;
   - nom de l'appli et ton e-mail ;
   - dans **Utilisateurs test**, ajoute ton adresse Gmail (et celle des collègues qui utiliseront l'appli).
4. Ouvre **Identifiants → Créer des identifiants → ID client OAuth** :
   - type **Application Web** ;
   - **Origines JavaScript autorisées** : `https://fichespro.netlify.app` (ajoute aussi `http://localhost:8000` si tu testes en local).
5. Copie l'**ID client**, qui se termine par `.apps.googleusercontent.com`, et colle-le dans **Réglages → Sauvegarde → Identifiant client**.

**Utilisation**
- **Se connecter à Google Drive** : une sauvegarde est faite tout de suite.
- **Sauvegarde automatique** (activée par défaut) : elle a lieu environ 15 s après chaque nouvelle fiche ou modification, quand l'appli est ouverte et connectée.
- Les boutons **Sauvegarder maintenant**, **Restaurer** et **Ouvrir le dossier Drive** sont aussi disponibles.
- **Envoyer sur Drive** (sur une fiche) range le PDF ou le Word dans le sous-dossier **Fiches**.
- Un point orange sur **Réglages** signale qu'aucune sauvegarde n'a été faite depuis plus de 3 jours.
- Sans Drive, **Sauvegarder dans un fichier** et **Restaurer un fichier** restent disponibles.

## 6. Installer l'appli

Une fois le site en ligne (Netlify, en https) :
- **Android / ordinateur (Chrome, Edge)** : bouton **Installer** en haut de l'écran, ou menu ⋮ puis « Installer l'application ».
- **iPhone / iPad (Safari)** : **Partager** puis **Sur l'écran d'accueil**.

L'appli installée fonctionne **hors ligne** pour consulter la base et les fiches déjà faites. La génération, elle, nécessite Internet.
