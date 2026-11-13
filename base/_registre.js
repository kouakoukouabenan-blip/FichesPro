/* =====================================================================
   REGISTRE DE LA BASE DOCUMENTAIRE
   ---------------------------------------------------------------------
   Chaque fichier du dossier /base appelle BASE.ajouter({...}).
   Champs d'un document :
     matiere   : "Français" (ou autre matière plus tard)
     type      : "format"      → le modèle officiel de fiche à respecter
                 "progression" → progression annuelle / répartition
                 "modele"      → une fiche de cours exemple (sert de modèle)
                 "guide"       → guide pédagogique, programme, consignes
                 "document"    → tout autre document utile
     classes   : ["6e","5e","4e","3e"]  ou  ["toutes"]
     activites : ["Lecture méthodique", ...]  ou  ["toutes"]
     titre     : nom lisible du document
     contenu   : le texte du document (entre accents graves ` `)
   ===================================================================== */
window.BASE = {
  docs: [],
  matieres: {},           // matière -> { classes:[], activites:[] }
  ajouter(doc) {
    const d = Object.assign({ classes: ["toutes"], activites: ["toutes"], type: "document" }, doc);
    d.id = d.id || ("doc" + this.docs.length);
    this.docs.push(d);
  },
  definirMatiere(nom, cfg) {
    this.matieres[nom] = cfg;
  }
};
