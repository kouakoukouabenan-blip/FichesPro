/* Matière FRANÇAIS — classes et activités proposées dans l'appli.
   Les noms d'activités doivent être écrits EXACTEMENT comme dans les documents de la base. */
BASE.definirMatiere("Français", {
  classes: ["6e", "5e", "4e", "3e", "2nde", "1ère", "Tle"],
  activites: [
    "Grammaire",
    "Orthographe",
    "Expression orale",
    "Lecture méthodique",
    "Exploitation de texte",
    "Lecture compréhension (remédiation)",
    "Étude de l'œuvre intégrale",
    "Expression écrite",
    "Évaluation (devoir)",
    "Compte rendu de devoir",
    "Perfectionnement de la langue",
    "Commentaire composé",
    "Dissertation littéraire",
    "Résumé / Discussion"
  ]
});

/* ---------------------------------------------------------------------
   FORMAT OFFICIEL DE LA FICHE — tiré des fiches APC 3e 2026-2027.
   S'applique à toutes les classes et activités.
   --------------------------------------------------------------------- */
BASE.ajouter({
  id: "format-francais-apc",
  matiere: "Français",
  type: "format",
  titre: "Format officiel de la fiche de cours APC (Français)",
  contenu: `
TITRE : FICHE DE COURS — FRANÇAIS [CLASSE] — [ACTIVITÉ EN MAJUSCULES]

1. EN-TÊTE (tableau à 2 lignes)
   Établissement : … | Année scolaire : 2026-2027 | Professeur : …
   Classe : … | Discipline : Français | Durée : … | Semaine : n° (mois)

2. IDENTIFICATION (lignes en gras)
   Compétence n : libellé exact selon l'activité —
     • Expression orale → Compétence 1 : Traiter des situations relatives à la production des énoncés oraux.
     • Lecture méthodique, exploitation de texte, remédiation, œuvre intégrale → Compétence 2 : Traiter des situations relatives à la construction du sens de textes divers.
     • Expression écrite → Compétence 3 : Traiter des situations relatives à la rédaction des écrits divers.
     • Grammaire → Compétence 4 : Traiter des situations relatives à l'utilisation des outils grammaticaux divers.
     • Orthographe → Compétence 5 : Traiter des situations relatives à l'orthographe correcte des mots.
   Activité : …
   Leçon n : … (intitulé exact de la progression)
   Séance n : … (intitulé exact de la progression)

3. EXEMPLE DE SITUATION (situation d'apprentissage)
   Contexte proche du vécu des élèves (établissement, quartier, village, Côte d'Ivoire), circonstance, puis tâche :
   « Ils s'organisent pour … afin de … ». Pour la lecture : le titre du texte-support est annoncé dans la situation.

4. TABLEAU DES HABILETÉS ET CONTENUS (2 colonnes : Habiletés | Contenus)
   Habiletés à l'infinitif : Identifier, Connaître, Analyser, Interpréter, Utiliser, Appliquer, Rédiger…
   Contenus précis, introduits par « – ».

5. RUBRIQUES
   Supports / moyens didactiques : …
   Techniques pédagogiques : …
   Bibliographie : Programme éducatif et guide d'exécution de Français, classe de … (DPFC) ; Progressions à usage pédagogique 1er cycle 2026-2027 (CNDF/SCOD/DPFC/IGENA).

6. SUPPORT DE LA SÉANCE (selon l'activité)
   Grammaire / Orthographe : « Corpus » de phrases numérotées P1, P2… liées à la situation.
   Lecture : « Texte-support » complet (titre, texte, source ou « Texte-support conçu pour la fiche »).
   Expression écrite : sujet et/ou texte modèle.
   Expression orale : situation de communication, dialogue ou thème.

7. DÉROULEMENT DE LA SÉANCE (tableau à 5 colonnes)
   | Moments didactiques / Durée | Stratégies pédagogiques | Activités de l'enseignant | Activités des élèves | Traces écrites |
   Lignes :
   PRÉSENTATION (5 min) — Situation d'apprentissage : faire lire la situation, questions de découverte, annonce de la leçon et de la séance (trace : titres leçon/séance).
   DÉVELOPPEMENT (… min) — étapes numérotées avec leur durée, propres à l'activité (ex. grammaire : observation/manipulation → formulation ; lecture méthodique : lecture, hypothèse générale, vérification par axes, bilan). Questions précises du professeur, réponses attendues des élèves, traces écrites rédigées (règles, exemples).
   ÉVALUATION (… min) — situation d'évaluation + consignes numérotées ; élèves : traitent la situation, correction collective.
   La somme des durées est égale à la durée de la séance.

8. CORRIGÉ INDICATIF / CRITÈRES D'ÉVALUATION
   Réponses attendues numérotées.
`
});
