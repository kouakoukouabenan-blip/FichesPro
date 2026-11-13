/* Matière EDHC — Éducation aux Droits de l'Homme et à la Citoyenneté */
BASE.definirMatiere("EDHC", {
  classes: ["6e", "5e", "4e", "3e", "2nde", "1ère", "Tle"],
  activites: [
    "Leçon (séance d'apprentissage)",
    "Devoir / Évaluation",
    "Révision / Remédiation"
  ]
});

/* FORMAT OFFICIEL DE LA FICHE EDHC — tiré des fiches EDHC 5e et 3e */
BASE.ajouter({
  id: "format-edhc",
  matiere: "EDHC",
  type: "format",
  titre: "Format officiel de la fiche de cours EDHC",
  contenu: `
TITRE : FICHE DE COURS — EDHC — [CLASSE]

1. EN-TÊTE (tableau)
   Établissement : … | Année scolaire : 2026-2027 | Professeur : …
   Discipline : Éducation aux Droits de l'Homme et à la Citoyenneté (EDHC) | Classe : … | Durée : 1 h | Date : …

2. IDENTIFICATION
   Compétence n : libellé exact de la progression (ex. Compétence 1 : Traiter une situation relative aux droits de l'homme, aux droits de l'enfant et au droit international humanitaire (DIH)).
   Thème : …
   Leçon n : … (intitulé exact de la progression)   Séance : 1, 2 ou séance unique

3. SITUATION D'APPRENTISSAGE
   Des élèves de la classe de … de l'établissement vivent ou observent un problème concret (famille, école, quartier, village).
   Tâche : « Pour …, ils décident de s'informer sur … afin de comprendre … et de … ».

4. TABLEAU DES HABILETÉS ET CONTENUS (2 colonnes : Habiletés | Contenus)
   Habiletés usuelles en EDHC : Définir, Connaître, Comprendre, Appliquer, Argumenter (en faveur de…), Respecter, Traiter (une situation relative à…).

5. MOYENS
   Supports didactiques : situation d'apprentissage ; texte(s) support(s) — articles de la Constitution ivoirienne, de la Convention relative aux droits de l'enfant (20 novembre 1989), de la Déclaration universelle des droits de l'homme, de lois ivoiriennes… ; images.
   Méthodes et techniques : interrogative, interro-expositive, discussion dirigée, travail de groupe, jeu de rôles, brainstorming.
   Bibliographie : programme éducatif et guide d'exécution EDHC ; textes officiels utilisés.

6. DÉROULEMENT (tableau à 5 colonnes)
   | Moments didactiques / Durée | Stratégies pédagogiques / Plan du cours | Activités de l'enseignant | Activités des élèves | Traces écrites |
   PRÉSENTATION (5 à 7 min) : salutations, appel, date, rappel de la séance précédente ou des prérequis, lecture de la situation d'apprentissage, questions sur la situation (de qui parle-t-on ? quel est le problème ? que décident-ils ?), annonce de la leçon (trace : titre de la leçon).
   DÉVELOPPEMENT (≈ 40 min) : parties numérotées (I. Définitions / notions — II. … — III. Importance / conséquences / attitudes à adopter). Pour chaque partie : lecture du texte support, questions précises, réponses attendues, explication du professeur, trace écrite rédigée ; exercices d'application numérotés avec leur correction.
   ÉVALUATION (≈ 10 min) : situation d'évaluation tirée de la vie courante + 3 consignes (1. Identifie le problème posé ; 2. Énumère / cite… ; 3. Indique ta décision ou ton attitude et justifie-la) ; traitement attendu ; consigne de recherche pour la séance suivante si utile.
   Le total des durées = 1 h.

7. RÉSUMÉ DE LA LEÇON (trace écrite finale) puis TEXTE(S) SUPPORT(S) en annexe (articles cités en entier).
`
});
