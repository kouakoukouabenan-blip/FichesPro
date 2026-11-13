/* =====================================================================
   CONTRÔLE AUTOMATIQUE — la fiche est vérifiée avant d'être montrée
   - Contrôles mesurables sur le HTML : rubriques obligatoires, colonnes, traces écrites,
     exigences de l'activité (ex. lecture méthodique : hypothèse générale, 2 axes, annexe),
     texte support et plan reproduits, durées, total des points d'un devoir…
   - S'il manque quelque chose : UNE demande de complément au service de rédaction,
     puis nouveau contrôle ; on garde la meilleure version.
   CONTROLE.verifier(html, req, genre) → [{ id, libelle, demande }]
   CONTROLE.corriger(fiche, manques, onEtat) → fiche complétée (ou inchangée)
   Dépend de app.js : norm, preparerFiche, systemePour ; devoir.js : DEVOIR ; api.js : API.
   ===================================================================== */
const CONTROLE = (() => {
  const n = s => (s || "").toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const dom = html => { const d = document.createElement("div"); d.innerHTML = html; return d; };
  const titres = d => [...d.querySelectorAll("h1,h2,h3,th,strong,b,p.te-titre")].map(e => n(e.textContent)).join(" | ");

  // minutes d'une durée écrite « 55 min », « 1 h », « 1h30 », « 2 heures »
  function minutes(t) {
    t = n(t);
    const h = t.match(/(\d+)\s*h(?:eures?)?\s*(\d+)?/), m = t.match(/(\d+)\s*min/);
    if (h) return +h[1] * 60 + (+h[2] || 0);
    return m ? +m[1] : null;
  }

  function deroulement(d) {
    return [...d.querySelectorAll("table")].find(t => {
      const tete = n((t.tHead || t.rows[0])?.textContent || "");
      return /trace|activites? de l.enseignant|strategies|moments?/.test(tete);
    });
  }

  function verifierFiche(d, req, texte, tt) {
    const m = [], a = n(req.activite), impose = !!req.modeleId;
    const ajoute = (id, libelle, demande) => m.push({ id, libelle, demande });
    if (!d.querySelector("h1")) ajoute("titre", "Titre de la fiche", "Ajoute le titre de la fiche en <h1>.");
    if (!/situation d.apprentissage/.test(texte)) ajoute("situation", "Situation d'apprentissage", "Ajoute la rubrique « Situation d'apprentissage » (contexte, circonstance, tâche).");
    if (!impose && !/habilete/.test(tt)) ajoute("habiletes", "Tableau des habiletés et contenus", "Ajoute le tableau des habiletés et contenus (2 colonnes : Habiletés | Contenus).");
    const der = deroulement(d);
    if (!der) ajoute("deroulement", "Tableau de déroulement", "Ajoute le tableau de déroulement complet (ligne d'en-tête dans <thead>, une ligne <tr> par étape).");
    else {
      if (!impose && !/trace/.test(n((der.tHead || der.rows[0]).textContent))) ajoute("col-traces", "Colonne « Traces écrites »", "La dernière colonne du tableau de déroulement doit s'intituler « Traces écrites » et contenir le texte exact à copier par les élèves.");
      // réponses des élèves creuses
      const creuses = [...der.querySelectorAll("td")].filter(td => /^(les )?(eleves? )?(repondent|participent|ecoutent|relevent|lisent|observent|executent|font l.exercice)\.?$/.test(n(td.textContent).trim())).length;
      if (creuses >= 2) ajoute("reponses", "Réponses attendues des élèves", "Dans la colonne « Activités des élèves », remplace les formules creuses (« répondent », « participent »…) par les réponses attendues complètes.");
      // somme des durées
      const duree = minutes(req.duree || "");
      if (duree) {
        const premieres = [...der.querySelectorAll("tbody tr")].map(tr => tr.cells[0]?.textContent || "");
        const somme = premieres.reduce((s, c) => s + (minutes(c) || 0), 0);
        if (somme && Math.abs(somme - duree) > 5) ajoute("durees", `Durées (${somme} min au lieu de ${duree})`, `La somme des durées des moments didactiques fait ${somme} min : ajuste-les pour qu'elle fasse exactement ${duree} min.`);
      }
    }
    if (d.querySelectorAll(".te-titre,.te-def,.te-sous-titre").length < 3 && !/trace|resume|retenons/.test(tt))
      ajoute("traces", "Traces écrites", "Rédige des traces écrites complètes (titres, règles ou idées essentielles, exemples) avec les classes te-titre, te-sous-titre, te-def, te-exemple.");
    if (!/evaluation/.test(texte)) ajoute("evaluation", "Évaluation", "Ajoute le moment d'évaluation avec une situation d'évaluation de même famille (2 à 4 consignes) et son corrigé.");
    if (!/corrige|reponses? attendues?/.test(texte)) ajoute("corrige", "Corrigé", "Ajoute le corrigé complet de l'évaluation (réponses rédigées).");

    // exigences de l'activité
    const lm = /lecture methodique/.test(a) || (/oeuvre integrale/.test(a) && /lecture methodique/.test(n(req.titre)));
    if (lm) {
      if (!/hypothese generale/.test(texte)) ajoute("lm-hypothese", "Hypothèse générale", "Formule l'hypothèse générale (type + tonalité si pertinente + thème en groupe nominal).");
      if (!(/axe\s*1|premier axe/.test(texte) && /axe\s*2|second axe|deuxieme axe/.test(texte))) ajoute("lm-axes", "Les deux axes de lecture", "Présente exactement deux axes de lecture : axe 1 = type (et tonalité), axe 2 = thème.");
      const annexe = [...d.querySelectorAll("h2,h3")].find(h => /annexe|tableau de verification/.test(n(h.textContent)));
      let tableAnnexe = false;
      for (let x = annexe?.nextElementSibling; x && !/^H[12]$/.test(x.tagName); x = x.nextElementSibling) if (x.tagName === "TABLE" || x.querySelector?.("table")) { tableAnnexe = true; break; }
      if (!annexe || !tableAnnexe) ajoute("lm-annexe", "Tableau de vérification en annexe", "Après le tableau de déroulement, ajoute <h2>ANNEXE — TABLEAU DE VÉRIFICATION DE L'HYPOTHÈSE GÉNÉRALE</h2> suivi du tableau à 5 colonnes (Axes de lecture | Entrées choisies | Relevé des indices textuels | Analyse des indices | Interprétation), citations exactes avec lignes.");
      if (!/bilan/.test(texte)) ajoute("lm-bilan", "Bilan", "Ajoute le bilan qui confronte les résultats des axes à l'hypothèse générale.");
    }
    if (/^grammaire|^orthographe/.test(a)) {
      if (!/\bp1\b/.test(texte) || !/\bp3\b/.test(texte)) ajoute("corpus", "Corpus numéroté (P1, P2…)", "Présente un corpus de 4 à 8 phrases numérotées P1, P2… liées à la situation, et renvoie à ces numéros dans les questions.");
      if (!/exercice|application/.test(texte)) ajoute("exercices", "Exercices d'application", "Ajoute deux exercices d'application de difficulté croissante, avec leur corrigé.");
    }
    if (/^orthographe/.test(a) && !/dictee/.test(texte)) ajoute("dictee", "Mini-dictée", "Ajoute une mini-dictée de 3 à 5 phrases sur la règle, avec son corrigé.");
    if (/expression orale/.test(a) && !/grille/.test(texte)) ajoute("grille", "Grille d'observation", "Ajoute une grille d'observation pour l'évaluation orale (fond, langue, voix, attitude).");
    return m;
  }

  function verifierDevoir(d, req, texte) {
    const m = [], ajoute = (id, libelle, demande) => m.push({ id, libelle, demande });
    const html = d.innerHTML, i = html.search(/<h2[^>]*class="[^"]*saut/i);
    if (i < 0 && !/corrige/.test(texte)) ajoute("corrige", "Corrigé et barème", "Ajoute après le sujet : <h2 class=\"saut\">CORRIGÉ ET BARÈME (réservé au professeur)</h2>, avec la réponse attendue et les points de chaque question.");
    const bareme = parseFloat(String(req.bareme || "20").replace(",", "."));
    const sujet = n(dom(i >= 0 ? html.slice(0, i) : html).textContent);
    const pts = [...sujet.matchAll(/\((\d+(?:[.,]\d+)?)\s*(?:pts?|points?)\)/g)].map(x => parseFloat(x[1].replace(",", ".")));
    const total = pts.reduce((s, x) => s + x, 0);
    if (pts.length >= 2 && Math.abs(total - bareme) > 0.01) ajoute("points", `Total des points (${total} au lieu de ${bareme})`, `Le total des points du sujet fait ${total} : ajuste les points des questions pour obtenir exactement ${bareme}, et reporte-les dans le barème du corrigé.`);
    if (!/nom et prenoms?/.test(texte)) ajoute("nom", "Ligne « Nom et prénoms »", "Ajoute dans l'en-tête du sujet la ligne « Nom et prénoms : …… ».");
    return m;
  }

  function verifier(html, req, genre) {
    const d = dom(html), texte = n(d.textContent), tt = titres(d);
    const m = genre === "devoir" ? verifierDevoir(d, req, texte) : verifierFiche(d, req, texte, tt);
    // communs : texte support et plan reproduits, aucun reste de Markdown ou d'espace à remplir
    const support = n(req.texteSupport || "").replace(/[^a-z0-9 ]/g, "").trim();
    if (support.length > 40) {
      const brut = texte.replace(/[^a-z0-9 ]/g, "").replace(/\b\d{1,3}\b/g, "").replace(/\s+/g, " ");
      const debut = support.split(" ").slice(0, 8).join(" ");
      if (!brut.includes(debut)) m.push({ id: "support", libelle: "Texte support reproduit", demande: "Reproduis intégralement, mot pour mot, le texte support fourni par le professeur, à l'endroit prévu." });
    }
    const plan = (req.plan || []).map(p => n(p.t).replace(/[^a-z0-9 ]/g, "").trim()).filter(t => t.length > 3);
    const absents = plan.filter(t => !texte.replace(/[^a-z0-9 ]/g, "").includes(t.slice(0, 28)));
    if (absents.length) m.push({ id: "plan", libelle: `Plan imposé (${absents.length} titre${absents.length > 1 ? "s" : ""} absent${absents.length > 1 ? "s" : ""})`, demande: "Reprends tels quels, dans l'ordre, tous les titres et sous-titres du plan imposé par le professeur." });
    if (/\|\s*-{3,}\s*\||\*\*[^*]+\*\*|\[(a completer|\.\.\.|…)\]|lorem ipsum|xxx/.test(texte))
      m.push({ id: "reste", libelle: "Passages inachevés ou mal mis en forme", demande: "Supprime les restes de mise en forme (|, **, [à compléter]…) et rédige entièrement les passages laissés à compléter." });
    return m;
  }

  const longueur = html => dom(html).textContent.replace(/\s+/g, " ").length;

  async function corriger(f, manques, onEtat) {
    const demande = `===== FICHE ACTUELLE (HTML) =====
${f.html}

===== POINTS À COMPLÉTER (contrôle de conformité) =====
${manques.map((x, i) => `${i + 1}. ${x.demande}`).join("\n")}

Complète ou corrige UNIQUEMENT ces points et renvoie le document COMPLET (toutes les rubriques). Ne raccourcis rien, ne supprime rien de ce qui est correct${f.opts?.support ? ", reproduis le texte support mot pour mot" : ""}${f.opts?.plan ? ", garde les titres du plan imposé" : ""}.`;
    const sys = f.genre === "devoir" ? DEVOIR.systeme(f.req.matiere) : systemePour(f.req.matiere, f.opts || {}, f.req.activite, f.req.titre);
    onEtat && onEtat("Complément de la fiche…");
    const html = preparerFiche(await API.generer(sys, demande, () => {}));
    const reste = verifier(html, f.req, f.genre);
    // on garde la version complétée si elle règle des points sans perdre de contenu
    if (reste.length < manques.length && longueur(html) >= longueur(f.html) * 0.85) return { html, reste };
    return { html: f.html, reste: manques };
  }

  return { verifier, corriger };
})();
