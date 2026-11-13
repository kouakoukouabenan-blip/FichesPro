/* CALENDRIER SCOLAIRE 2026-2027 (Côte d'Ivoire) — tiré des progressions officielles (DPFC).
   Sert au tableau « Mon année » pour situer la semaine en cours.
   À mettre à jour chaque année : date du premier lundi et congés. */
BASE.calendrier = {
  annee: "2026-2027",
  debut: "2026-09-14",          // lundi de la première semaine de cours
  fin: "2027-06-11",
  conges: [
    ["2026-10-24", "2026-11-01", "Congés de Toussaint"],
    ["2026-12-19", "2027-01-03", "Congés de Noël et du Nouvel An"],
    ["2027-02-06", "2027-02-14", "Congés de printemps"],
    ["2027-03-20", "2027-04-04", "Congés de Pâques"]
  ]
};
