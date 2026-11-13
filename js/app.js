/* =====================================================================
   FICHES DE COURS — logique principale
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- Navigation ---------- */
let vueActuelle = "", vueAvantFiche = "semaine", vueAvantFormulaire = "semaine";
function ouvrir(vue) {
  if (vue === "fiche" && vueActuelle && vueActuelle !== "fiche") vueAvantFiche = ["nouvelle", "plan"].includes(vueActuelle) ? vueAvantFormulaire : vueActuelle;
  if (vue === "nouvelle" && vueActuelle && !["nouvelle", "plan", "fiche"].includes(vueActuelle)) vueAvantFormulaire = vueActuelle;
  vueActuelle = vue;
  $$(".vue").forEach(v => v.hidden = v.id !== "vue-" + vue);
  const onglet = { fiche: vueAvantFiche === "semaine" || vueAvantFiche === "annee" ? vueAvantFiche : "historique", plan: "nouvelle", base: "reglages" }[vue] || vue;
  $$(".onglet").forEach(b => b.classList.toggle("actif", b.dataset.vue === onglet));
  $("main").classList.toggle("large", vue === "fiche");
  if (vue === "historique") afficherHistorique();
  if (vue === "base") afficherBase();
  if (vue === "annee" && typeof ANNEE !== "undefined") ANNEE.avant();
  if (vue === "semaine" && typeof SEMAINE !== "undefined") SEMAINE.afficher();
  window.scrollTo(0, 0);
}
$$(".onglet").forEach(b => b.onclick = () => ouvrir(b.dataset.vue));
document.addEventListener("click", e => { const a = e.target.closest("[data-aller]"); if (a && !a.closest("#sem-liste")) ouvrir(a.dataset.aller); });
/* Petit message discret en bas de l'écran */
function signaler(texte) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = texte; t.classList.add("visible");
  clearTimeout(t._m); t._m = setTimeout(() => t.classList.remove("visible"), 2200);
}

/* ---------- Formulaire ---------- */
const DEVOIR_TYPES = ["Interrogation écrite", "Devoir surveillé", "Devoir de rédaction", "Devoir d'orthographe (dictée + questions)", "Sujet type BEPC", "Situation d'évaluation (APC)", "Exercices de remédiation / d'entraînement"];
const orientationChoisie = () => document.querySelector('input[name="orientation"]:checked')?.value || "portrait";
function remplirSelect(sel, valeurs, garder) {
  const avant = garder ? sel.value : null;
  sel.innerHTML = valeurs.map(v => `<option>${esc(v)}</option>`).join("");
  if (avant && valeurs.includes(avant)) sel.value = avant;
}
function appliquerProfil() {
  const p = PROFIL.lire();
  $("#etablissement").value = p.etablissement || ""; $("#professeur").value = p.professeur || ""; $("#effectif").value = p.effectif || "";
  $("#marque-sous").textContent = p.etablissement || "Préparation des cours";
  const mats = PROFIL.matieres() || Object.keys(BASE.matieres);
  remplirSelect($("#matiere"), mats, true);
  $("#champ-matiere").hidden = mats.length === 1;
  $("#matiere").onchange && $("#matiere").onchange();
}
/* Scanner (scanner.js) → un champ du formulaire : le texte reconnu y est placé, à relire */
function scannerVers(sel, { titre, aide, nom, bloc, fin = "avant de préparer la fiche" }) {
  SCANNER.ouvrir({
    titre, aide, texte: true,
    quand(texte) {
      const champ = $(sel), avant = champ.value.trim();
      champ.value = avant && confirm("Le champ contient déjà un texte.\nOK : ajouter le texte scanné à la suite.\nAnnuler : le remplacer.") ? avant + "\n\n" + texte : texte;
      if (bloc) $(bloc).open = true;
      ["input", "change"].forEach(t => champ.dispatchEvent(new Event(t, { bubbles: true })));
      champ.focus(); champ.setSelectionRange(0, 0); champ.scrollTop = 0;
      champ.scrollIntoView({ behavior: "smooth", block: "center" });
      signaler(`Texte placé dans « ${nom} » : relis-le ${fin}.`);
    }
  });
}
const AIDE_CONSIGNES = "Photographie tes consignes (notes, sujet, exercice, extrait du guide…) <strong>page par page</strong>, bien à plat et bien éclairées. Le texte reconnu s'ajoute au champ des remarques ; relis-le. <strong>Écrit à la main ?</strong> Choisis « En ligne » : la lecture sur le téléphone ne reconnaît bien que le texte imprimé.";
function initFormulaire() {
  $("#support-scanner").onclick = () => scannerVers("#texte-support", { titre: "Scanner le texte support", nom: "Mon texte support", bloc: "#bloc-support",
    aide: "Photographie le texte <strong>page par page, dans l'ordre</strong>, bien à plat et bien éclairé, en cadrant seulement le texte (sans les pages voisines). Les retours à la ligne et les vers sont conservés." });
  $("#consignes-scanner").onclick = () => scannerVers("#consignes", { titre: "Scanner des consignes", nom: "Remarques pour cette fiche", aide: AIDE_CONSIGNES });
  const perm = $("#consignes-permanentes-scanner");
  if (perm) perm.onclick = () => scannerVers("#consignes-permanentes", { titre: "Scanner des remarques permanentes", nom: "Remarques permanentes", fin: "puis touche Enregistrer", aide: AIDE_CONSIGNES });
  remplirSelect($("#matiere"), PROFIL.matieres() || Object.keys(BASE.matieres));
  const maj = () => {
    const cfg = BASE.matieres[$("#matiere").value] || { classes: [], activites: [] };
    remplirSelect($("#classe"), PROFIL.classes($("#matiere").value) || cfg.classes, true);
    remplirSelect($("#activite"), cfg.activites, true);
    if (typeof remplirModeles === "function" && $("#modele")) remplirModeles();
    $("#titre").placeholder = $("#matiere").value === "EDHC"
      ? "Ex. : Les organisations humanitaires (séance 1)"
      : "Ex. : L'expression du but dans la phrase complexe";
  };
  $("#matiere").onchange = maj;
  const d = LS.get("fc_dernier", {});
  if (d.matiere && BASE.matieres[d.matiere]) $("#matiere").value = d.matiere;
  maj();
  ["classe", "activite", "duree"].forEach(k => { const el = $("#" + k); if (d[k] && (el.tagName !== "SELECT" || [...el.options].some(o => o.value === d[k]))) el.value = d[k]; });
  appliquerProfil();
  window.addEventListener("profil-modifie", appliquerProfil);
  remplirModeles();
  const o = document.querySelector(`input[name="orientation"][value="${d.orientation || "portrait"}"]`);
  if (o) o.checked = true;

  $("#type-eval").innerHTML = DEVOIR_TYPES.map(t => `<option>${esc(t)}</option>`).join("");
  $$('input[name="genre"]').forEach(r => r.onchange = majGenre);
  $("#titre").addEventListener("input", () => { if ($("#plan-id").value) { $("#plan-id").value = ""; $("#depuis-progression").hidden = true; } });
  ["#classe", "#matiere"].forEach(sel => $(sel).addEventListener("change", () => { $("#plan-id").value = ""; $("#depuis-progression").hidden = true; }));
  majGenre();
  $("#vider-formulaire").onclick = () => { viderFormulaire(); $("#titre").focus(); };

  // Consignes rapides : un toucher ajoute la consigne au champ
  $$(".chip").forEach(c => c.onclick = () => {
    const t = $("#consignes"), v = c.textContent.trim();
    if (t.value.includes(v)) return;
    t.value = (t.value.trim() ? t.value.trim().replace(/[.;,]?$/, " ; ") : "") + v;
    c.classList.add("utilise");
  });
}

/* ---------- Modèle à suivre ---------- */
function remplirModeles() {
  const sel = $("#modele"), avant = sel.value;
  const mots = motsCles($("#titre").value);
  const liste = BASE.docs
    .filter(d => (d.type === "modele" || d.type === "format") && norm(d.matiere) === norm($("#matiere").value) && correspond(d.classes, $("#classe").value) && correspond(d.activites, $("#activite").value))
    .map(d => ({ d, s: mots.filter(m => norm(d.titre).includes(m)).length }))
    .sort((a, b) => b.s - a.s);
  sel.innerHTML = `<option value="">Automatique — fiches les plus proches</option>` + liste.map(({ d }) =>
    `<option value="${esc(d.id)}" title="${esc(d.titre)}">${d.type === "format" ? "Format — " : ""}${esc(d.titre.length > 85 ? d.titre.slice(0, 85) + "…" : d.titre)}</option>`).join("");
  if (avant && liste.some(x => x.d.id === avant)) sel.value = avant;
  aideModele();
}
function aideModele() {
  $("#modele-aide").textContent = $("#modele").value
    ? "La fiche reprendra exactement la structure de cette fiche (rubriques, colonnes, durées). Seul le contenu sera nouveau."
    : "La fiche suit les fiches de la base les plus proches. Choisis une fiche pour reprendre sa structure à la lettre.";
}

/* ---------- Plan de la fiche (titres / sous-titres) ---------- */
function lirePlan() {
  return $$("#plan-liste li").map(li => ({ n: Number(li.dataset.n), t: li.querySelector("input").value }));
}
function numeroterPlan() {
  const lignes = $$("#plan-liste li"), lib = etiquettesPlan(lirePlan());
  lignes.forEach((li, i) => {
    li.querySelector(".plan-num").textContent = lib[i];
    li.className = "plan-ligne n" + li.dataset.n;
  });
}
function ajouterLignePlan(n, texte = "", apres = null, focus = true) {
  const li = document.createElement("li");
  li.dataset.n = n;
  li.innerHTML = `<span class="plan-num"></span><input placeholder="${n === 2 ? "Sous-titre" : "Titre de la partie"}" autocomplete="off">
    <button type="button" data-act="niveau" title="Passer de titre à sous-titre">⇄</button>
    <button type="button" data-act="haut" title="Monter">↑</button>
    <button type="button" data-act="bas" title="Descendre">↓</button>
    <button type="button" data-act="suppr" title="Supprimer">✕</button>`;
  li.querySelector("input").value = texte;
  apres ? apres.after(li) : $("#plan-liste").appendChild(li);
  numeroterPlan();
  if (focus) li.querySelector("input").focus();
}
function initPlan() {
  $("#plan-titre").onclick = () => ajouterLignePlan(1);
  $("#plan-sous").onclick = () => ajouterLignePlan(2);
  const liste = $("#plan-liste");
  liste.addEventListener("input", numeroterPlan);
  liste.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();                                   // ne pas envoyer le formulaire
    const li = e.target.closest("li");
    ajouterLignePlan(Number(li.dataset.n), "", li);
  });
  liste.addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const li = b.closest("li");
    if (b.dataset.act === "niveau") li.dataset.n = li.dataset.n === "1" ? "2" : "1";
    if (b.dataset.act === "haut" && li.previousElementSibling) li.previousElementSibling.before(li);
    if (b.dataset.act === "bas" && li.nextElementSibling) li.nextElementSibling.after(li);
    if (b.dataset.act === "suppr") li.remove();
    numeroterPlan();
  });
  $("#modele").onchange = aideModele;
  $("#classe").addEventListener("change", remplirModeles);
  $("#activite").addEventListener("change", remplirModeles);
  let t; $("#titre").addEventListener("input", () => { clearTimeout(t); t = setTimeout(remplirModeles, 400); });
}

/* ---------- Sélection des documents pertinents ---------- */
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const correspond = (liste, valeur) => (liste || []).some(x => norm(x) === "toutes" || norm(x) === norm(valeur));
const exact = (liste, valeur) => (liste || []).some(x => norm(x) === norm(valeur));

const VIDES = new Set(["dans", "avec", "pour", "des", "les", "une", "sur", "par", "aux", "est", "son", "ses", "qui", "que", "pas", "del", "lecon", "seance", "texte", "phrase", "etude", "expression", "unique"]);
const motsCles = t => [...new Set(norm(t).replace(/\b[ldjmnstc]['’]/g, " ").split(/[^a-z0-9]+/).filter(m => m.length > 2 && !VIDES.has(m)))];

function choisirDocuments(req, budget) {
  const docs = BASE.docs.filter(d => norm(d.matiere) === norm(req.matiere) || norm(d.matiere) === "toutes");
  const mots = motsCles(req.titre + " " + (req.consignes || ""));
  const sem = (req.semaine || "").match(/\d+/)?.[0];
  // numéro de leçon demandé : un document d'une AUTRE leçon (situation d'apprentissage, manuel…) est écarté
  const nums = [...(req.titre || "").matchAll(/le[çc]on\s*(\d+)/gi)].map(m => m[1]);
  const lecon = new Set(nums).size === 1 ? nums[0] : null;   // plusieurs leçons (devoir) : pas de filtre
  const autreLecon = d => { const n = d.titre.match(/le[çc]on\s*(\d+)/i)?.[1]; return !!(lecon && n && n !== lecon); };
  const pertinence = d => {
    const titre = norm(d.titre), debut = norm(d.contenu.slice(0, 1500));
    let s = mots.filter(m => titre.includes(m)).length * 2 + mots.filter(m => debut.includes(m)).length * 0.5;
    if (sem && d.type === "modele" && new RegExp("semaine " + Number(sem) + "\\b").test(titre)) s += 3;
    return s;
  };
  const score = d => {
    let s = 0;
    if (d.type === "document" && autreLecon(d)) return -1;
    if (exact(d.classes, req.classe)) s += 4; else if (correspond(d.classes, req.classe)) s += 1; else if (d.type !== "modele") return -1;
    if (exact(d.activites, req.activite)) s += 5; else if (correspond(d.activites, req.activite)) s += 1;
    else if (d.type !== "progression") return -1;
    return s + pertinence(d) + (d.perso || d.integre ? 2 : 0);   // tes documents passent en priorité
  };
  const prio = { format: 0, progression: 1, modele: 2, guide: 3, document: 4 };
  // Les guides (très volumineux) ne doivent pas noyer le modèle : quota et plafond réduits.
  // Un modèle n'est plus tronqué (la plus longue fiche de la base fait ~35 000 signes).
  const quota = { format: 1, progression: 1, modele: 3, guide: 3, document: 3 };   // documents : situation d'apprentissage, manuel, cahier d'exercices…
  const plafond = { format: 8000, progression: 14000, modele: 40000, guide: 12000, document: 12000 };
  const parType = {};
  docs.map(d => ({ d, s: score(d) })).filter(x => x.s >= 0)
    .sort((a, b) => prio[a.d.type] - prio[b.d.type] || b.s - a.s)
    .forEach(x => { (parType[x.d.type] = parType[x.d.type] || []).push(x.d); });

  // MODÈLE IMPOSÉ par le professeur : sa structure remplace le format par défaut et les autres fiches exemples
  const impose = req.modeleId ? BASE.docs.find(d => d.id === req.modeleId && (d.type === "modele" || d.type === "format")) : null;
  let reserve = 0, contenuImpose = "";
  if (impose) {
    delete parType.format; delete parType.modele;
    contenuImpose = impose.contenu.trim();
    const cap = Math.min(45000, Math.round(budget * 0.7));
    if (contenuImpose.length > cap) contenuImpose = contenuImpose.slice(0, cap) + "\n[…suite du modèle non incluse…]";
    reserve = contenuImpose.length;
  } else {
    // Aucune fiche exemple pour cette activité (ex. devoir d'EDHC) : on prend les fiches les plus proches de la matière
    if (!parType.modele) {
      const proches = docs.filter(d => d.type === "modele")
        .map(d => ({ d, s: (exact(d.classes, req.classe) ? 4 : 0) + pertinence(d) }))
        .sort((a, b) => b.s - a.s).slice(0, 2).map(x => x.d);
      if (proches.length) parType.modele = proches;
    }
    // Format : un format injecté par l'utilisateur passe avant le format livré
    if (parType.format && parType.format.length > 1) parType.format = parType.format.filter(d => !/^format-(francais-apc|edhc)$/.test(d.id));
    // Fiches exemples : au moins une au format officiel détaillé quand il en existe
    if (parType.modele) {
      const choix = parType.modele.slice(0, quota.modele);
      const officielle = d => /fiche 3e|fiche officielle|fiche edhc/i.test(d.titre);
      if (!choix.some(officielle)) {
        const o = parType.modele.find(officielle);
        if (o) choix[Math.min(choix.length, quota.modele - 1)] = o;
      }
      parType.modele = choix;
    }
  }

  const retenus = []; let total = reserve;
  for (const t of Object.keys(prio)) {
    for (const d of (parType[t] || []).slice(0, quota[t])) {
      let contenu = d.contenu.trim();
      if (contenu.length > plafond[t]) contenu = contenu.slice(0, plafond[t]) + "\n[…suite du document non incluse…]";
      if (total + contenu.length > budget) {
        const reste = budget - total;
        if (reste < 2000) continue;
        contenu = contenu.slice(0, reste) + "\n[…document tronqué…]";
      }
      retenus.push({ ...d, contenu }); total += contenu.length;
    }
  }
  if (impose) retenus.push({ ...impose, contenu: contenuImpose, role: "impose" });
  else { const p = retenus.find(d => d.type === "modele"); if (p) p.role = "principal"; }

  // Ordre d'envoi : références générales d'abord, modèle à suivre TOUT À LA FIN (juste avant la demande)
  const ordre = { document: 0, guide: 1, progression: 2, format: 3, modele: 4 };
  return retenus.sort((a, b) => (a.role === "impose") - (b.role === "impose") || ordre[a.type] - ordre[b.type]);
}

/* ---------- Plan imposé : numérotation I. / 1. ---------- */
const ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function etiquettesPlan(plan) {
  let t = 0, s = 0;
  return plan.map(p => !p.t.trim() ? "" : p.n === 2 ? `${++s}.` : (s = 0, `${ROMAINS[t++] || t}.`));
}
function planEnTexte(plan) {
  const lib = etiquettesPlan(plan);
  return plan.map((p, i) => lib[i] ? (p.n === 2 ? "    " : "") + lib[i] + " " + p.t.trim() : "").filter(Boolean).join("\n");
}

/* ---------- Consignes de sortie (communes à la génération et à la retouche) ---------- */
function consignesSortie(impose) {
  return `SORTIE
Réponds UNIQUEMENT par un fragment HTML (aucune balise html/head/body, aucun bloc \`\`\`).
N'utilise JAMAIS la syntaxe Markdown : pas de tableaux avec « | » et « --- », pas de **gras**, pas de *italique*, pas de # titres. Uniquement des balises HTML (<table>, <strong>, <em>, <h2>…).
Balises autorisées : h1, h2, h3, p, span, ul, ol, li, table, thead, tbody, tr, th, td, strong, em, u, br.
- h1 : titre de la fiche ; h2 : grandes rubriques (Situation d'apprentissage, Déroulement…).
${impose
    ? "- Tableaux : reprends ceux du MODÈLE IMPOSÉ, avec exactement les mêmes colonnes et les mêmes intitulés de colonnes. S'il contient un tableau de déroulement, mets sa ligne d'en-tête dans <thead> et une ligne <tr> par étape."
    : "- Tableaux pour l'en-tête, les habiletés/contenus et le DÉROULEMENT. Le tableau de déroulement a une ligne d'en-tête dans <thead> et une ligne <tr> par étape ; sa dernière colonne s'intitule « Traces écrites »."}
- Dans la 1re colonne du déroulement, écris le moment didactique ainsi : <span class="moment">PRÉSENTATION</span> puis la durée.
- MISE EN FORME DES TRACES ÉCRITES (obligatoire, uniquement avec ces classes) :
  <p class="te-titre">I. Titre de partie</p>
  <p class="te-sous-titre">1. Sous-titre</p>
  <p class="te-def">Définition, règle ou idée essentielle à retenir</p>
  <p class="te-exemple">Ex. : exemple</p>
  <p class="te-remarque">Remarque / N.B. : …</p>
  et <span class="te-mot">mot-clé</span> pour un mot important.
  La colonne des traces écrites doit être riche : titres, sous-titres, règles et exemples rédigés comme dans le cahier de l'élève.`;
}
const CONSIGNES_SORTIE = consignesSortie(false);

const LIBELLES = {
  format: "FORMAT OFFICIEL DE LA FICHE (à respecter strictement)",
  progression: "PROGRESSION OFFICIELLE DE LA CLASSE",
  modele: "FICHE EXEMPLE (modèle de démarche, de style et de niveau de détail)",
  guide: "GUIDE PÉDAGOGIQUE OFFICIEL (référence de contenu, pas de structure)",
  document: "DOCUMENT DE RÉFÉRENCE",
  principal: "FICHE EXEMPLE PRINCIPALE (la plus proche de la demande : suis de près son découpage du déroulement, ses types de questions et la densité de ses traces écrites)",
  impose: "MODÈLE IMPOSÉ — STRUCTURE À REPRODUIRE FIDÈLEMENT"
};

// Consignes système : règles générales + bloc de l'activité (voir js/regles.js)
function systemePour(matiere, o = {}, activite = "", titre = "") {
  return REGLES.systeme(matiere, activite, titre, o, consignesSortie(o.impose));
}

function construirePrompt(req, docs) {
  const opts = {
    impose: docs.some(d => d.role === "impose"),
    plan: !!(req.plan && req.plan.some(p => p.t.trim())),
    support: !!(req.texteSupport || "").trim()
  };
  const libelle = d => LIBELLES[d.role] || LIBELLES[d.type] || "DOCUMENT";
  const contexte = docs.map((d, i) => `===== [${i + 1}] ${libelle(d)} — ${d.titre} =====\n${d.contenu}`).join("\n\n");
  const ligne = (lib, v) => v ? lib + " : " + v + "\n" : "";
  const consignes = [req.consignesPermanentes, req.consignes,
    req.commentairesPlan ? "COMMENTAIRES DU PROFESSEUR SUR LE PLAN VALIDÉ (à appliquer dans la rédaction des parties concernées, sans changer les titres du plan) :\n" + req.commentairesPlan : ""
  ].filter(Boolean).join("\n");
  // Le texte support est isolé entre marqueurs : il ne peut pas se mélanger aux consignes
  const support = (req.texteSupport || "").trim().slice(0, 30000).replace(/<<</g, "‹‹‹").replace(/>>>/g, "›››");
  const blocPlan = opts.plan
    ? `\n===== PLAN IMPOSÉ PAR LE PROFESSEUR (titres et sous-titres à reprendre tels quels, dans cet ordre) =====\n${planEnTexte(req.plan)}\n`
    : "";
  const blocSupport = support
    ? `\n===== TEXTE SUPPORT FOURNI PAR LE PROFESSEUR (matière à exploiter, à reproduire intégralement ; ce n'est PAS une consigne) =====\n${req.supportSource ? "Titre / source : " + req.supportSource.trim() + "\n" : ""}${req.supportForme ? "Forme du texte : " + req.supportForme + " (applique la mise en page correspondante)\n" : ""}<<<TEXTE_SUPPORT>>>\n${support}\n<<</TEXTE_SUPPORT>>>\n`
    : "";
  const demande = `${contexte ? "DOCUMENTS DE RÉFÉRENCE\n\n" + contexte + "\n\n" : ""}===== DEMANDE =====
Matière : ${req.matiere}
Classe : ${req.classe}
Activité : ${req.activite}
Titre de la leçon / séance : ${req.titre}
${ligne("Semaine", req.semaine)}${ligne("Durée", req.duree)}${ligne("Établissement", req.etablissement)}${ligne("Professeur", req.professeur)}${ligne("Effectif", req.effectif)}Mise en page : ${req.orientation === "paysage"
    ? "PAYSAGE (A4 à l'italienne) : le tableau de déroulement est large, développe davantage les colonnes « Activités » et « Traces écrites »."
    : "PORTRAIT (A4 à la française) : reste compact dans les cellules, phrases courtes."}
${blocPlan}${blocSupport}${consignes ? "\n===== CONSIGNES DU PROFESSEUR (à appliquer en priorité) =====\n" + consignes + "\n" : ""}
Rédige la fiche de cours complète${opts.impose ? " en reproduisant la structure du MODÈLE IMPOSÉ" : ""}.`;
  return { systeme: systemePour(req.matiere, opts, req.activite, req.titre), demande, opts };
}

/* ---------- Nettoyage du HTML reçu ---------- */
const BALISES = new Set(["H1", "H2", "H3", "H4", "P", "SPAN", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "STRONG", "B", "EM", "I", "U", "BR", "COLGROUP", "COL"]);
const CLASSES = new Set(["ts-titre", "ts-source", "ts-texte", "ts-droite", "ts-centre", "ts-alinea", "ts-vers", "ts-strophe", "ts-personnage", "ts-didascalie", "ts-chapeau", "ts-num", "saut", "te-titre", "te-sous-titre", "te-def", "te-exemple", "te-remarque", "te-mot", "moment", "deroulement", "col-moment", "col-strategies", "col-enseignant", "col-eleves", "col-traces"]);
function nettoyer(html) {
  html = html.replace(/^[\s\S]*?```(?:html)?\s*/i, m => /```/.test(m) ? "" : m).replace(/```[\s\S]*$/, "");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const parcourir = n => {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 1) {
        if (!BALISES.has(c.tagName)) {
          if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META"].includes(c.tagName)) { c.remove(); return; }
          parcourir(c); c.replaceWith(...c.childNodes); return;
        }
        [...c.attributes].forEach(a => {
          if (a.name === "class") {
            const ok = a.value.split(/\s+/).filter(x => CLASSES.has(x));
            ok.length ? c.setAttribute("class", ok.join(" ")) : c.removeAttribute("class");
          } else if (!["colspan", "rowspan"].includes(a.name)) c.removeAttribute(a.name);
        });
        parcourir(c);
      } else if (c.nodeType !== 3) c.remove();
    });
  };
  const racine = doc.body.firstChild; parcourir(racine);
  return racine.innerHTML;
}

/* ---------- Mise en forme : tableau de déroulement et traces écrites ---------- */
const LARGEURS = {
  5: { "col-moment": 14, "col-strategies": 11, "col-enseignant": 24, "col-eleves": 19, "col-traces": 32 },
  4: { "col-moment": 12, "col-enseignant": 30, "col-eleves": 22, "col-traces": 36 }
};
function classeColonne(t) {
  t = norm(t);
  if (/trace/.test(t)) return "col-traces";
  if (/moment|duree|plan du cours/.test(t) && !/strateg/.test(t)) return "col-moment";
  if (/strateg|methode|technique/.test(t)) return "col-strategies";
  if (/eleve|apprenant/.test(t)) return "col-eleves";
  if (/enseignant|professeur|maitre/.test(t)) return "col-enseignant";
  return "";
}
// Classe une ligne de trace écrite quand l'IA n'a pas mis de classe
function classeLigne(texte) {
  const t = texte.trim();
  if (!t) return "";
  if (/^(?:[IVX]{1,4}\s*[-.)/–—]|[A-H]\s*[-.)]\s|partie\b)/i.test(t)) return "te-titre";
  if (/^(?:\d{1,2}\s*[-.)°]|[a-h]\s*\))\s*\S/.test(t)) return "te-sous-titre";
  if (/^(?:ex\b|ex\.|exemples?\b|e\.g\.)/i.test(t)) return "te-exemple";
  if (/^(?:n\.?\s?b\.?|remarques?|attention|retenons?)\b/i.test(t)) return /^retenons?/i.test(t) ? "te-def" : "te-remarque";
  if (/^(?:d[ée]finition|r[èe]gle|on appelle|on entend par)/i.test(t)) return "te-def";
  return "";
}
function formaterTraces(td) {
  if (td.querySelector('[class^="te-"]')) return;          // déjà mis en forme par l'IA
  // Découpe le contenu en lignes (séparées par <br>) et les enveloppe dans des <p> classés
  const lignes = [], courant = [];
  const pousser = () => { if (courant.length) { lignes.push(courant.splice(0)); } };
  [...td.childNodes].forEach(n => {
    if (n.nodeName === "BR") pousser();
    else if (["P", "UL", "OL", "TABLE", "H3", "H4"].includes(n.nodeName)) { pousser(); lignes.push([n]); }
    else courant.push(n);
  });
  pousser();
  td.innerHTML = "";
  lignes.forEach(noeuds => {
    if (noeuds.length === 1 && ["UL", "OL", "TABLE"].includes(noeuds[0].nodeName)) { td.appendChild(noeuds[0]); return; }
    const p = noeuds.length === 1 && noeuds[0].nodeName === "P" ? noeuds[0] : Object.assign(document.createElement("p"), {});
    if (p !== noeuds[0]) noeuds.forEach(n => p.appendChild(n));
    if (!p.textContent.trim()) return;
    const c = classeLigne(p.textContent);
    if (c) p.className = c;
    td.appendChild(p);
  });
}
function mettreEnForme(racine) {
  racine.querySelectorAll("table").forEach(table => {
    const lignes = [...table.rows];
    const entete = lignes.find(r => /trace/i.test(r.textContent) && r.cells.length >= 4);
    if (!entete) return;
    table.classList.add("deroulement");
    const classes = [...entete.cells].map(c => classeColonne(c.textContent));
    const n = classes.filter(Boolean).length;
    const largeurs = LARGEURS[n === 5 ? 5 : 4];
    table.querySelector("colgroup")?.remove();
    const cg = document.createElement("colgroup");
    classes.forEach(c => { const col = document.createElement("col"); col.style.width = ((largeurs[c] || Math.round(100 / classes.length))) + "%"; cg.appendChild(col); });
    table.prepend(cg);
    [...entete.cells].forEach((c, i) => { if (classes[i]) c.style.width = (largeurs[classes[i]] || 0) + "%"; });
    lignes.forEach(r => {
      if (r === entete || r.cells.length !== classes.length) return;
      [...r.cells].forEach((td, i) => {
        if (classes[i]) td.classList.add(classes[i]);
        if (classes[i] === "col-traces") formaterTraces(td);
        // moment didactique écrit en gras (« PRÉSENTATION (5 min) ») : pastille comme les autres fiches
        if (classes[i] === "col-moment" && !td.querySelector(".moment")) {
          const s = td.querySelector("strong, b");
          if (s && /^[A-ZÉÈÀÂÎÔÛÇ' ]{4,}/.test(s.textContent.trim())) { const m = document.createElement("span"); m.className = "moment"; m.textContent = s.textContent.trim(); s.replaceWith(m); }
        }
      });
    });
  });
  return racine;
}
function sautApresMoment(racine) {
  racine.querySelectorAll(".moment").forEach(m => {
    const n = m.nextSibling;
    if (n && n.nodeName !== "BR" && !(n.nodeType === 1 && /^(P|UL|OL|DIV)$/.test(n.nodeName))) m.after(document.createElement("br"));
  });
}
/* ---------- Réponse en Markdown au lieu de HTML : conversion automatique ----------
   Il arrive que le service réponde avec la syntaxe Markdown (| tableaux |, **gras**, # titres).
   Affichés tels quels, ces signes rendent la fiche illisible : on les convertit en HTML. */
const estMarkdown = t => {
  const html = (t.match(/<(table|tr|td|h[1-3]|p|ul|ol)\b/gi) || []).length;
  const md = (t.match(/^\s*\|.*\|\s*$/gm) || []).length + (t.match(/\|\s*:?-{3,}:?\s*\|/g) || []).length * 5
    + (t.match(/\*\*[^*\n]+\*\*/g) || []).length + (t.match(/^#{1,4}\s/gm) || []).length * 3;
  return md >= 3 && md > html;
};
function mdEnLigne(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(«>])\*([^*\n]+?)\*(?=[\s).,;:!?»<]|$)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "$1");
}
function mdBlocs(texte) {
  // paragraphes, titres, listes (hors tableaux)
  const out = [];
  texte.split(/\n\s*\n/).forEach(bloc => {
    const lignes = bloc.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lignes.length) return;
    if (lignes.every(l => /^[-*•]\s+/.test(l))) { out.push("<ul>" + lignes.map(l => `<li>${mdEnLigne(l.replace(/^[-*•]\s+/, ""))}</li>`).join("") + "</ul>"); return; }
    lignes.forEach((l, i) => {
      const h = l.match(/^(#{1,4})\s+(.*)$/);
      if (h) { const n = Math.min(3, h[1].length); out.push(`<h${n}>${mdEnLigne(h[2].replace(/\*\*/g, ""))}</h${n}>`); return; }
      if (/^-{3,}$|^\*{3,}$/.test(l)) return;
      out.push(`<p>${mdEnLigne(l)}</p>`);
    });
  });
  return out.join("\n");
}
function mdVersHtml(texte) {
  let t = texte.replace(/\r/g, "").replace(/^```(?:html|markdown|md)?\s*/i, "").replace(/```\s*$/, "");
  const morceaux = [];
  // repère un tableau : ligne d'en-tête | a | b | suivie d'une ligne | --- | --- |
  const re = /(^|\n)[ \t]*(\|[^\n]*\|)[ \t]*\n[ \t]*(\|[ \t:|-]*-{3,}[ \t:|-]*\|)[ \t]*/;
  for (let m; (m = t.match(re));) {
    const debut = m.index + m[1].length;
    morceaux.push(mdBlocs(t.slice(0, debut)));
    const cellules = s => s.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    const n = cellules(m[3]).length;
    let entete = cellules(m[2]);
    const lignes = [];
    // corps : on lit les cellules de « | » en « | », même si une cellule tient sur plusieurs lignes
    let reste = t.slice(m.index + m[0].length);
    const jetons = reste.split("|");
    let i = 0, consomme = 0, fin = false;
    if (jetons.length < 2 || jetons[0].trim()) { fin = true; }
    else { consomme += jetons[0].length + 1; i = 1; }
    while (!fin && i < jetons.length) {
      const ligne = [];
      while (ligne.length < n && i < jetons.length - 1) { ligne.push(jetons[i]); consomme += jetons[i].length + 1; i++; }
      if (ligne.length < n) { fin = true; break; }
      lignes.push(ligne);
      const ecart = jetons[i] ?? "";
      if (i >= jetons.length - 1 || ecart.trim()) { fin = true; break; }   // texte après la ligne : fin du tableau
      consomme += ecart.length + 1; i++;
    }
    const cel = c => mdEnLigne(c.trim().replace(/\n{2,}/g, "<br>").replace(/\n/g, "<br>").replace(/(<br>\s*){3,}/g, "<br><br>"));
    // en-tête de tableau « fusionné » avec une ligne de titre : on garde tel quel
    morceaux.push(`<table><thead><tr>${entete.map(c => `<th>${cel(c)}</th>`).join("")}</tr></thead><tbody>${lignes.map(l => `<tr>${l.map(c => `<td>${cel(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    t = reste.slice(consomme);
  }
  morceaux.push(mdBlocs(t));
  return morceaux.join("\n");
}

function preparerFiche(html) {
  if (estMarkdown(html)) html = mdVersHtml(html);
  else html = html.replace(/\*\*([^*<>\n]+?)\*\*/g, "<strong>$1</strong>");   // restes de **gras** dans du HTML
  const div = document.createElement("div");
  div.innerHTML = nettoyer(html);
  mettreEnForme(div); sautApresMoment(div);
  return div.innerHTML;
}

/* ---------- Ajustement de la feuille à la largeur de l'écran ---------- */
// La taille du texte (A− / A+) agrandit le contenu SANS élargir la feuille : la feuille est
// rendue plus étroite de ce facteur puis zoomée d'autant, le texte se réorganise dans la page.
function ajusterZoom() {
  const cadre = $(".feuille-cadre");
  if ($("#vue-fiche").hidden) return;
  const t = TAILLE.valeur();
  let ajuste = false;
  // la fiche (ou les traces) et la page élèves sont chacune réduites à la largeur de l'écran
  [racineFiche(), $("#eleves")].filter(f => f && !f.hidden).forEach(f => {
    const paysage = f.classList.contains("paysage");
    f.style.zoom = 1;
    f.style.width = t === 1 ? "" : `calc(${paysage ? 297 : 210}mm / ${t})`;
    f.style.minHeight = t === 1 ? "" : `calc(${paysage ? 210 : 297}mm / ${t})`;
    const dispo = cadre.clientWidth - 4, largeur = f.offsetWidth * t;
    const a = largeur > dispo; ajuste = ajuste || a;
    f.style.zoom = (t * (a ? Math.max(0.3, dispo / largeur) : 1)).toFixed(3);
  });
  cadre.classList.toggle("ajustee", ajuste);
}

/* ---------- Taille du texte ---------- */
const TAILLE = {
  NIVEAUX: [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2],
  valeur() { const v = Number(localStorage.getItem("fc_taille")); return this.NIVEAUX.includes(v) ? v : 1; },
  appliquer() {
    const v = this.valeur(), i = this.NIVEAUX.indexOf(v);
    $("#taille-val").textContent = Math.round(v * 100) + " %";
    $("#taille-moins").disabled = i <= 0; $("#taille-plus").disabled = i >= this.NIVEAUX.length - 1;
    document.documentElement.style.setProperty("--taille", v);
    // A− / A+ ne concerne que la lecture à l'écran : Word, PDF et impression restent en taille normale (sinon 17 pages et plus)
    requestAnimationFrame(ajusterZoom);
  },
  changer(pas) {
    const i = this.NIVEAUX.indexOf(this.valeur()), n = this.NIVEAUX[Math.min(this.NIVEAUX.length - 1, Math.max(0, i + pas))];
    try { localStorage.setItem("fc_taille", String(n)); } catch {}
    this.appliquer();
  }
};
$("#taille-moins").onclick = () => TAILLE.changer(-1);
$("#taille-plus").onclick = () => TAILLE.changer(1);
TAILLE.appliquer();

/* ---------- Traces écrites seules ---------- */
let modeTraces = false;
const racineFiche = () => modeTraces ? $("#traces") : $("#fiche");
function extraireTraces(racine) {
  const blocs = [];
  // 1. colonne « Traces écrites » du tableau de déroulement
  racine.querySelectorAll("td.col-traces").forEach(td => { if (td.textContent.trim()) blocs.push(td.innerHTML); });
  // 2. sinon : rubriques intitulées « Trace(s) écrite(s) », « Résumé », « Retenons »…
  if (!blocs.length) {
    racine.querySelectorAll("h2,h3").forEach(h => {
      if (!/trace|r[ée]sum[ée]|retenons|le[çc]on [àa] retenir/i.test(h.textContent)) return;
      const niveau = h.tagName, morceau = document.createElement("div");
      morceau.appendChild(Object.assign(document.createElement("h3"), { textContent: h.textContent.trim() }));
      for (let n = h.nextElementSibling; n && !(n.tagName === "H2" || (niveau === "H3" && n.tagName === "H3")); n = n.nextElementSibling) morceau.appendChild(n.cloneNode(true));
      if (morceau.textContent.trim()) blocs.push(morceau.innerHTML);
    });
  }
  // annexes (ex. tableau de vérification de l'hypothèse générale en lecture méthodique)
  racine.querySelectorAll("h2").forEach(h => {
    if (!/annexe|tableau de v[ée]rification/i.test(h.textContent)) return;
    const morceau = document.createElement("div");
    morceau.appendChild(Object.assign(document.createElement("h3"), { textContent: h.textContent.trim() }));
    for (let x = h.nextElementSibling; x && x.tagName !== "H2"; x = x.nextElementSibling) morceau.appendChild(x.cloneNode(true));
    if (morceau.textContent.trim()) blocs.push(morceau.innerHTML);
  });
  return blocs;
}
function afficherTraces(oui) {
  if (oui && ficheCourante) {
    const blocs = extraireTraces($("#fiche"));
    if (!blocs.length) { alert("Cette fiche ne contient pas de colonne ni de rubrique « Traces écrites »."); oui = false; }
    else {
      const r = ficheCourante.req, tr = $("#traces");
      tr.innerHTML = `<h1>TRACES ÉCRITES</h1><p class="traces-ref"></p>` + blocs.map(b => `<div class="traces-bloc">${b}</div>`).join("");
      tr.querySelector(".traces-ref").textContent = `${r.matiere} · ${r.classe} — ${r.titre}`;
    }
  }
  modeTraces = !!oui;
  $("#fiche").hidden = modeTraces; $("#traces").hidden = !modeTraces;
  $("#eleves").hidden = modeTraces || !(ficheCourante && ficheCourante.eleves && ficheCourante.eleves.html);
  const b = $("#voir-traces");
  b.setAttribute("aria-pressed", String(modeTraces));
  b.querySelector("b").textContent = modeTraces ? "Fiche complète" : "Traces écrites seules";
  $("#bandeau-traces").hidden = !modeTraces;
  $$('input[name="orientation-fiche"]').forEach(x => x.disabled = modeTraces);   // les traces sont toujours en portrait
  requestAnimationFrame(ajusterZoom);
}
$("#voir-traces").onclick = () => afficherTraces(!modeTraces);
$("#quitter-traces").onclick = () => afficherTraces(false);
// Fiche et orientation utilisées pour les fichiers (traces écrites : portrait, nom de fichier distinct)
const ficheExport = () => modeTraces ? { ...ficheCourante, req: { ...ficheCourante.req, titre: "Traces écrites — " + ficheCourante.req.titre } } : ficheCourante;
const orientationExport = () => modeTraces ? "portrait" : (ficheCourante.orientation || ficheCourante.req.orientation || "portrait");
addEventListener("resize", () => requestAnimationFrame(ajusterZoom));

/* ---------- Orientation ---------- */
function appliquerOrientation(o) {
  o = o === "paysage" ? "paysage" : "portrait";
  const f = $("#fiche");
  f.classList.toggle("paysage", o === "paysage");
  f.classList.toggle("portrait", o === "portrait");
  $("#style-page").textContent = `@page{size:A4 ${o === "paysage" ? "landscape" : "portrait"};margin:${o === "paysage" ? "10mm 12mm" : "12mm"}}`;
  const r = document.querySelector(`input[name="orientation-fiche"][value="${o}"]`);
  if (r) r.checked = true;
  requestAnimationFrame(ajusterZoom);
}
$$('input[name="orientation-fiche"]').forEach(r => r.onchange = () => {
  if (!ficheCourante) return;
  ficheCourante.orientation = r.value;
  appliquerOrientation(r.value);
  sauverHistorique(ficheCourante);
});

/* ---------- Génération ---------- */
let ficheCourante = null;
const genreChoisi = () => document.querySelector('input[name="genre"]:checked')?.value || "fiche";
function lireDemande() {
  const req = Object.fromEntries(["matiere", "classe", "activite", "titre", "semaine", "duree", "etablissement", "professeur", "effectif", "consignes"].map(k => [k, $("#" + k).value.trim()]));
  req.orientation = orientationChoisie();
  req.genre = genreChoisi();
  req.planId = $("#plan-id").value;
  req.texteSupport = $("#texte-support").value.trim();
  req.supportSource = $("#support-source").value.trim();
  req.supportForme = $("#support-forme").value;
  req.consignesPermanentes = (API.reglages().consignesPermanentes || "").trim();
  if (req.genre === "devoir") {
    req.typeEval = $("#type-eval").value;
    req.bareme = $("#bareme").value.trim() || "20";
    req.modeleId = ""; req.plan = [];
  } else {
    req.modeleId = $("#modele").value;
    req.plan = lirePlan().filter(p => p.t.trim());
  }
  return req;
}
/* Vide les informations propres à la leçon (après une génération réussie, ou bouton « Nouvelle fiche vierge »).
   On garde ce qui ne change pas d'une fiche à l'autre : matière, classe, activité, durée, établissement,
   professeur, effectif, orientation, type de document. */
function viderFormulaire() {
  ["#titre", "#semaine", "#consignes", "#texte-support", "#support-source", "#plan-id"].forEach(s => { const el = $(s); if (el) el.value = ""; });
  if ($("#support-forme")) $("#support-forme").value = "";
  if ($("#modele")) { $("#modele").value = ""; aideModele(); }
  $("#plan-liste").innerHTML = ""; numeroterPlan();
  $("#depuis-progression").hidden = true; $("#depuis-progression").textContent = "";
  ["#bloc-plan", "#bloc-support"].forEach(s => { const el = $(s); if (el) el.open = false; });
  if (typeof planEnCours !== "undefined") planEnCours = null;
  if ($("#reprendre-plan")) $("#reprendre-plan").hidden = true;
  $("#sources").innerHTML = "";
}

/* Rédige une fiche (ou un devoir) et l'enregistre ; ne touche pas à l'affichage */
async function produireFiche(req, onEtat) {
  const r = API.reglages();
  const budget = r.geminiCle ? 120000 : 18000;   // Groq gratuit : contexte plus court
  const devoir = req.genre === "devoir";
  const docs = devoir ? DEVOIR.choisirDocuments(req, budget) : choisirDocuments(req, budget);
  const { systeme, demande, opts } = devoir ? DEVOIR.construire(req, docs) : construirePrompt(req, docs);
  const brut = await API.generer(systeme, demande, onEtat);
  const fiche = { id: Date.now(), date: new Date().toISOString(), req, genre: devoir ? "devoir" : "fiche", orientation: req.orientation, html: preparerFiche(brut), sources: docs.map(d => d.titre), opts };
  sauverHistorique(fiche);
  ELEVES.auto(fiche);                      // page à photocopier, si la case est cochée
  return { fiche, docs };
}
async function generer(req) {
  LS.set("fc_dernier", req);
  const devoir = req.genre === "devoir";
  const bouton = $("#generer"); bouton.disabled = true;
  ouvrir("nouvelle");
  $("#etat").hidden = false; $("#etat-texte").textContent = "Préparation…";
  VOILE.ouvrir({ titre: devoir ? "Rédaction du devoir…" : "Rédaction de la fiche…" });
  const budget = API.reglages().geminiCle ? 120000 : 18000;
  const docs = devoir ? DEVOIR.choisirDocuments(req, budget) : choisirDocuments(req, budget);
  $("#sources").innerHTML = docs.length ? "Documents de référence : " + docs.map(d => `<span class="puce">${d.role === "impose" ? "Modèle imposé : " : ""}${esc(d.titre)}</span>`).join(" ") : "Aucun document trouvé pour ce choix : format par défaut uniquement.";
  try {
    const { fiche } = await produireFiche(req, t => { $("#etat-texte").textContent = t; VOILE.etat(t); });
    VOILE.fermer();
    afficherFiche(fiche);
    viderFormulaire();                       // la prochaine fiche part d'un formulaire propre
  } catch (err) {
    VOILE.fermer();
    alert((devoir ? "La préparation du devoir" : "La préparation de la fiche") + " n'a pas abouti.\n\n" + err.message);
  } finally {
    bouton.disabled = false; $("#etat").hidden = true;
  }
}
$("#formulaire").onsubmit = e => {
  e.preventDefault();
  const req = lireDemande();
  if (req.titre) generer(req);
};

/* ---------- Fiche de cours / devoir : bascule du formulaire ---------- */
function majGenre() {
  const devoir = genreChoisi() === "devoir";
  $("#bloc-devoir").hidden = !devoir;
  ["#bloc-modele", "#modele-aide", "#bloc-plan", "#proposer-plan", "#aide-plan"].forEach(sel => { const el = $(sel); if (el) el.hidden = devoir; });
  if (devoir) $("#reprendre-plan").hidden = true;
  $("#titre-formulaire").textContent = devoir ? "Préparer un devoir" : "Préparer une séance";
  $("#libelle-titre").textContent = devoir ? "Leçons ou notions évaluées" : "Leçon / séance";
  $("#titre").placeholder = devoir ? "Ex. : L'expression de la cause, de la conséquence et du but" : ($("#matiere").value === "EDHC" ? "Ex. : Les organisations humanitaires (séance 1)" : "Ex. : L'expression du but dans la phrase complexe");
  $("#generer").textContent = devoir ? "Préparer le devoir et son corrigé" : "Préparer la fiche";
  if (devoir && !$("#duree").value) $("#duree").value = "1 h";
}
/* Préremplit le formulaire (depuis « Mon année ») */
function prefillDemande(req) {
  if (BASE.matieres[req.matiere]) { $("#matiere").value = req.matiere; $("#matiere").onchange && $("#matiere").onchange(); }
  if ([...$("#classe").options].some(o => o.value === req.classe)) $("#classe").value = req.classe;
  if ([...$("#activite").options].some(o => o.value === req.activite)) $("#activite").value = req.activite;
  $("#titre").value = req.titre || "";
  $("#semaine").value = req.semaine || "";
  if (req.duree) $("#duree").value = req.duree;
  const g = document.querySelector(`input[name="genre"][value="${req.genre === "devoir" ? "devoir" : "fiche"}"]`); if (g) g.checked = true;
  if (req.typeEval && [...$("#type-eval").options].some(o => o.value === req.typeEval)) $("#type-eval").value = req.typeEval;
  $("#plan-id").value = req.planId || "";
  const bandeau = $("#depuis-progression");
  bandeau.hidden = !req.planId;
  bandeau.textContent = req.planId ? `Séance de la progression · semaine ${req.semaine} · ${req.genre === "devoir" ? req.typeEval : req.activite}` : "";
  majGenre(); remplirModeles();
  window.scrollTo(0, 0);
}

function afficherFiche(f) {
  // fiche enregistrée avec des signes Markdown (| --- |, **…**) : on la répare une fois pour toutes
  if (/\|\s*:?-{3,}:?\s*\|/.test(f.html || "")) {
    const brut = f.html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li)>/gi, "\n\n").replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    f.html = preparerFiche(mdVersHtml(brut));
    sauverHistorique(f);
  }
  ficheCourante = f;
  const t = f.req.titre.length > 110 ? f.req.titre.slice(0, 110) + "…" : f.req.titre;
  $("#fiche-titre").textContent = t;
  $("#fiche-titre").title = f.req.titre;
  $("#fiche-meta").textContent = `${f.genre === "devoir" ? (f.req.typeEval || "Devoir") : f.req.activite} · ${f.req.matiere} · ${f.req.classe}${f.req.semaine ? " · semaine " + f.req.semaine : ""}`;
  $("#fiche").innerHTML = f.html;
  afficherTraces(false);
  ELEVES.afficher(f);
  ouvrir("fiche");
  appliquerOrientation(f.orientation || f.req.orientation);
}

/* Retouche de la fiche par une consigne */
$("#retouche").onsubmit = async e => {
  e.preventDefault();
  const consigne = $("#retouche-texte").value.trim();
  if (!consigne || !ficheCourante) return;
  const bouton = $("#retouche button"); bouton.disabled = true; $("#etat-retouche").hidden = false;
  VOILE.ouvrir({ titre: "Modification de la fiche…" });
  const demande = `===== FICHE ACTUELLE (HTML) =====
${$("#fiche").innerHTML}

===== CONSIGNE DE RETOUCHE DU PROFESSEUR =====
${consigne}

Applique la consigne et renvoie la fiche COMPLÈTE modifiée (toutes les rubriques, pas seulement la partie modifiée). Conserve tout ce que la consigne ne demande pas de changer${ficheCourante.opts?.support ? ", et reproduis le texte support mot pour mot" : ""}${ficheCourante.opts?.plan ? ", et garde les titres et sous-titres du plan imposé" : ""}.`;
  try {
    const sys = ficheCourante.genre === "devoir" ? DEVOIR.systeme(ficheCourante.req.matiere) : systemePour(ficheCourante.req.matiere, ficheCourante.opts || {}, ficheCourante.req.activite, ficheCourante.req.titre);
    const brut = await API.generer(sys, demande, () => {});
    ficheCourante.html = preparerFiche(brut);
    ficheCourante.retouches = [...(ficheCourante.retouches || []), consigne];
    sauverHistorique(ficheCourante);
    $("#fiche").innerHTML = ficheCourante.html;
    if (modeTraces) afficherTraces(true);
    if (ficheCourante.eleves) { ficheCourante.eleves.html = ELEVES.construire(ficheCourante, ficheCourante.eleves.choix, ficheCourante.eleves.copies, ficheCourante.eleves.groupe).html; sauverHistorique(ficheCourante); ELEVES.afficher(ficheCourante); }
    $("#retouche-texte").value = "";
    signaler("Fiche modifiée");
  } catch (err) {
    VOILE.fermer();
    alert("La modification n'a pas abouti.\n\n" + err.message);
  } finally {
    bouton.disabled = false; $("#etat-retouche").hidden = true; VOILE.fermer();
  }
};

/* Sauvegarde des corrections faites à la main */
let minuterie;
$("#fiche").addEventListener("input", () => {
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { if (!ficheCourante) return; ficheCourante.html = $("#fiche").innerHTML; sauverHistorique(ficheCourante); }, 600);
});

/* ---------- Export ---------- */
// Vrais fichiers : la page A4 est tournée en paysage quand la fiche est en paysage
async function exporter(format, bouton) {
  if (!ficheCourante) return;
  const orientation = orientationExport();
  const libelle = bouton.textContent;
  bouton.disabled = true; bouton.textContent = "Création…";
  try {
    await EXPORT[format](ELEVES.racineAvecEleves(racineFiche()), ficheExport(), orientation);
    bouton.textContent = "✓ " + libelle;
  } catch (err) {
    console.error(err);
    alert(`L'export ${format === "word" ? "Word" : "PDF"} a échoué.\n\n${err.message}`);
    bouton.textContent = libelle;
  } finally {
    bouton.disabled = false;
    setTimeout(() => { bouton.textContent = libelle; }, 1800);
  }
}
/* Partager (WhatsApp, e-mail…) et envoyer sur Google Drive : choix du format */
function choisirFormat(titre, aide) {
  const d = $("#choix-format");
  $("#choix-titre").textContent = titre; $("#choix-aide").textContent = aide;
  return new Promise(ok => {
    if (typeof d.showModal !== "function") return ok(prompt(titre + " — écris pdf, word ou les2", "pdf") || "");
    d.returnValue = ""; d.showModal();
    d.addEventListener("close", () => ok(d.returnValue), { once: true });
  });
}
async function fichiersFiche(format) {
  const o = orientationExport(), r = ELEVES.racineAvecEleves(racineFiche()), f = ficheExport(), l = [];
  if (format === "pdf" || format === "les2") l.push(await EXPORT.fichierPdf(r, f, o));
  if (format === "word" || format === "les2") l.push(await EXPORT.fichierWord(r, f, o));
  return l;
}
$("#partager").onclick = async e => {
  if (!ficheCourante) return;
  const b = e.currentTarget, lib = b.textContent;
  const format = await choisirFormat("Partager la fiche", "Choisis le format à envoyer (WhatsApp, e-mail, Bluetooth…).");
  if (!format) return;
  b.disabled = true; b.textContent = "Préparation…";
  try {
    const l = await fichiersFiche(format);
    const fichiers = l.map(f => new File([f.blob], f.nom, { type: f.blob.type }));
    if (navigator.canShare && navigator.canShare({ files: fichiers })) {
      await navigator.share({ files: fichiers, title: ficheCourante.req.titre, text: `${ficheCourante.genre === "devoir" ? "Devoir" : "Fiche"} — ${ficheCourante.req.classe} — ${ficheCourante.req.titre}` });
    } else {
      l.forEach(f => EXPORT.telecharger(f.blob, f.nom));
      alert("Ce navigateur ne permet pas le partage direct : le fichier a été téléchargé. Tu peux l'envoyer depuis tes Téléchargements.");
    }
  } catch (err) { if (err.name !== "AbortError") alert("Le partage a échoué.\n\n" + err.message); }
  finally { b.disabled = false; b.textContent = lib; }
};
$("#envoyer-drive").onclick = async e => {
  if (!ficheCourante) return;
  const b = e.currentTarget, lib = b.textContent;
  if (!DRIVE.configure()) { if (confirm("Google Drive n'est pas encore configuré. Ouvrir Réglages → Sauvegarde ?")) { ouvrir("reglages"); $("#carte-sauvegarde").scrollIntoView({ behavior: "smooth" }); } return; }
  const format = await choisirFormat("Envoyer sur Google Drive", "Le fichier sera rangé dans « Fiches de Cours (ATIKAN) / Fiches ».");
  if (!format) return;
  await DRIVE.action(b, async () => {
    b.textContent = "Envoi…";
    const l = await DRIVE.envoyerFiche(await fichiersFiche(format));
    if (l[0]?.webViewLink && confirm(`Envoyé dans ton Drive (${l.map(x => x.name).join(", ")}).\nOuvrir le fichier ?`)) window.open(l[0].webViewLink, "_blank", "noopener");
  });
};
$("#fiche-retour").onclick = () => ouvrir(vueAvantFiche || "historique");
$("#btn-telecharger").onclick = () => $("#dlg-telecharger").showModal();
$("#btn-plus").onclick = () => $("#dlg-plus").showModal();
// une action choisie dans une feuille d'actions referme la feuille (toucher le fond aussi)
["#dlg-telecharger", "#dlg-plus"].forEach(s => $(s).addEventListener("click", e => { if (e.target.closest(".ligne-action") || e.target === $(s)) $(s).close(); }));
$("#exporter-word").onclick = () => exporter("word", $("#btn-telecharger"));
$("#exporter-pdf").onclick = () => exporter("pdf", $("#btn-telecharger"));
$("#imprimer").onclick = () => {
  // impression des traces : page en portrait le temps de l'impression
  const avant = $("#style-page").textContent;
  if (modeTraces) $("#style-page").textContent = "@page{size:A4 portrait;margin:12mm}";
  window.print();
  $("#style-page").textContent = avant;
};
$("#copier").onclick = async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([racineFiche().innerHTML], { type: "text/html" }), "text/plain": new Blob([racineFiche().innerText], { type: "text/plain" }) })]);
  } catch { try { await navigator.clipboard.writeText(racineFiche().innerText); } catch {} }
  signaler("Fiche copiée");
};
$("#regenerer").onclick = () => {
  if (!ficheCourante) return;
  if (!confirm("Refaire cette fiche ? Une nouvelle version sera rédigée ; l'actuelle reste dans « Mes fiches ».")) return;
  const req = { ...ficheCourante.req, orientation: ficheCourante.orientation || ficheCourante.req.orientation, consignesPermanentes: (API.reglages().consignesPermanentes || "").trim() };
  generer(req);
};

/* ---------- Historique (fiches enregistrées sur l'appareil, IndexedDB) ---------- */
let HISTO = [];                       // plus récentes d'abord
function sauverHistorique(f) {
  f.modifie = new Date().toISOString();
  const i = HISTO.findIndex(x => x.id === f.id);
  if (i >= 0) HISTO.splice(i, 1);
  HISTO.unshift(f);
  STOCK.mettre("fiches", f).catch(err => {
    console.warn("Fiche gardée en secours dans le navigateur :", err);
    LS.set("fc_historique", HISTO.slice(0, 60));
  });
  SAUVEGARDE.modifie();
  window.dispatchEvent(new Event("fiches-maj"));
}
function supprimerFiche(id) {
  HISTO = HISTO.filter(f => f.id != id);
  STOCK.enlever("fiches", Number(id) || id).catch(() => {});
  SAUVEGARDE.modifie();
}
async function chargerHistorique() {
  try {
    // reprise de l'ancien historique (stocké dans un espace limité du navigateur)
    const ancien = LS.get("fc_historique", []);
    if (ancien.length) { await STOCK.mettre("fiches", ancien); localStorage.removeItem("fc_historique"); }
    HISTO = (await STOCK.tous("fiches")).sort((a, b) => (b.id || 0) - (a.id || 0));
  } catch (err) {
    console.warn("Historique en mode secours :", err);
    HISTO = LS.get("fc_historique", []);
  }
  if (!$("#vue-historique").hidden) afficherHistorique();
}
window.addEventListener("donnees-restaurees", chargerHistorique);
let filtreClasse = "";
function afficherHistorique() {
  const q = norm($("#recherche").value);
  const cle = f => `${f.req.matiere} · ${f.req.classe}`;
  // puces de classes
  const classes = [...new Set(HISTO.map(cle))].sort();
  if (filtreClasse && !classes.includes(filtreClasse)) filtreClasse = "";
  $("#filtre-classes").innerHTML = classes.length > 1 ? ["", ...classes].map(c => `<button type="button" class="puce-filtre${c === filtreClasse ? " actif" : ""}" data-classe="${esc(c)}">${c ? esc(c) : "Toutes"}</button>`).join("") : "";
  const liste = HISTO.filter(f => (!filtreClasse || cle(f) === filtreClasse) && (!q || norm(f.req.titre + " " + f.req.activite + " " + f.req.classe + " " + f.req.matiere + " " + (f.genre || "") + " semaine " + (f.req.semaine || "")).includes(q)));
  if (!liste.length) { $("#liste-historique").innerHTML = `<p class="vide">${HISTO.length ? "Aucune fiche ne correspond." : "Aucune fiche pour l'instant. Commence par « Ma semaine »."}</p>`; return; }
  // regroupement : classe, puis semaine (les plus récentes d'abord)
  const groupes = new Map();
  liste.forEach(f => { const k = cle(f); if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(f); });
  const sem = f => Number(f.req.semaine) || 0;
  $("#liste-historique").innerHTML = [...groupes].map(([k, fs]) => {
    fs.sort((a, b) => sem(b) - sem(a) || (b.id || 0) - (a.id || 0));
    let derniere = null;
    return `<li class="hist-groupe"><h3>${esc(k)} <small>${fs.length} fiche${fs.length > 1 ? "s" : ""}</small></h3><ul>${fs.map(f => {
      const s = sem(f), tete = s !== derniere ? `<li class="hist-sem">${s ? "Semaine " + s : "Sans semaine"}</li>` : "";
      derniere = s;
      return tete + `<li><button class="ligne" data-id="${f.id}">
        <strong>${esc(f.req.titre)}</strong>
        <span>${f.genre === "devoir" ? '<b class="etiquette">Devoir</b> ' : ""}${esc(f.genre === "devoir" ? (f.req.typeEval || "") : f.req.activite)} · ${new Date(f.date).toLocaleDateString("fr-FR")}${f.eleves?.html ? " · page élèves" : ""}</span>
      </button><button class="suppr" data-suppr="${f.id}" aria-label="Supprimer">✕</button></li>`;
    }).join("")}</ul></li>`;
  }).join("");
  $$("#liste-historique [data-id]").forEach(b => b.onclick = () => afficherFiche(HISTO.find(f => f.id == b.dataset.id)));
  $$("#liste-historique [data-suppr]").forEach(b => b.onclick = () => {
    if (!confirm("Supprimer cette fiche ?")) return;
    supprimerFiche(b.dataset.suppr); afficherHistorique(); window.dispatchEvent(new Event("fiches-maj"));
  });
  $$("#filtre-classes [data-classe]").forEach(b => b.onclick = () => { filtreClasse = b.dataset.classe; afficherHistorique(); });
}
$("#recherche").oninput = afficherHistorique;

/* ---------- Vue de la base ---------- */
function afficherBase() {
  const types = { format: "Format", progression: "Progression", modele: "Fiche exemple", guide: "Guide", document: "Document" };
  const filtre = norm($("#filtre-base").value);
  const liste = BASE.docs.filter(d => !filtre || norm(d.matiere + " " + d.titre + " " + d.classes.join(" ") + " " + d.activites.join(" ") + " " + d.type).includes(filtre));
  $("#liste-base").innerHTML = liste.map(d => `
    <details class="doc" data-id="${d.id}"><summary>${d.perso ? '<span class="type t-perso">Perso</span> ' : ""}<span class="type t-${d.type}">${types[d.type] || d.type}</span> ${esc(d.titre)}
      <small>${esc(d.matiere)} · ${esc(d.classes.join(", "))} · ${esc(d.activites.join(", "))} · ${d.contenu.length.toLocaleString("fr-FR")} car.</small></summary><pre></pre></details>`).join("");
  $$("#liste-base details").forEach(el => el.addEventListener("toggle", () => {
    const pre = el.querySelector("pre");
    if (el.open && !pre.textContent) pre.textContent = BASE.docs.find(d => d.id === el.dataset.id).contenu;
  }));
  const parMatiere = {};
  BASE.docs.forEach(d => parMatiere[d.matiere] = (parMatiere[d.matiere] || 0) + 1);
  $("#compte-base").textContent = `${BASE.docs.length} documents — ` + Object.entries(parMatiere).map(([m, n]) => `${m} : ${n}`).join(" · ") + (filtre ? ` — ${liste.length} affiché(s)` : "");
}
$("#filtre-base").oninput = afficherBase;

/* ---------- Réglages ---------- */
function initReglages() {
  const r = API.reglages();
  $("#gemini-cle").value = r.geminiCle || "";
  $("#gemini-modele").value = r.geminiModele || "";
  $("#groq-cle").value = r.groqCle || "";
  $("#groq-modele").value = r.groqModele || "";
  $("#consignes-permanentes").value = r.consignesPermanentes || "";
  const enregistrer = () => {
    const avant = API.reglages();
    const apres = {
      geminiCle: API.nettoyerCle($("#gemini-cle").value), geminiModele: $("#gemini-modele").value.trim(),
      groqCle: API.nettoyerCle($("#groq-cle").value), groqModele: $("#groq-modele").value.trim(),
      consignesPermanentes: $("#consignes-permanentes").value.trim()
    };
    // Clé ou modèle changés : on oublie le modèle mémorisé
    if (avant.geminiCle !== apres.geminiCle || avant.geminiModele !== apres.geminiModele) API.memo("gemini_modele", null);
    if (avant.groqCle !== apres.groqCle || avant.groqModele !== apres.groqModele) API.memo("groq_modele", null);
    LS.set("fc_reglages", apres);
    $("#gemini-cle").value = apres.geminiCle; $("#groq-cle").value = apres.groqCle;
  };
  $("#form-reglages").onsubmit = e => {
    e.preventDefault();
    enregistrer();
    $("#reglages-ok").hidden = false; setTimeout(() => $("#reglages-ok").hidden = true, 1800);
  };
  $("#tester-cles").onclick = async () => {
    enregistrer();
    const b = $("#tester-cles"), out = $("#resultat-test");
    b.disabled = true; b.textContent = "Test en cours…"; out.hidden = false; out.textContent = "Connexion aux services…";
    try { out.textContent = await API.tester(); }
    catch (e) { out.textContent = "Erreur : " + e.message; }
    finally { b.disabled = false; b.textContent = "Tester les clés"; }
  };
}

/* ---------- Installation (PWA) ---------- */
const estInstallee = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let invitation = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); invitation = e;
  $("#installer").hidden = false;
});
window.addEventListener("appinstalled", () => { invitation = null; $("#installer").hidden = true; $("#aide-installation").hidden = true; });
$("#installer").onclick = async () => {
  if (invitation) {
    invitation.prompt();
    const { outcome } = await invitation.userChoice;
    if (outcome === "accepted") $("#installer").hidden = true;
    invitation = null;
  } else {
    ouvrir("reglages"); $("#aide-installation").scrollIntoView({ behavior: "smooth" });
  }
};
function initInstallation() {
  if (estInstallee()) return;
  $("#aide-installation").hidden = false;
  $(estIOS ? "#aide-ios" : "#aide-autre").hidden = false;
  if (estIOS) $("#installer").hidden = false;   // Safari n'a pas d'invite automatique : le bouton ouvre l'aide
}

/* ---------- Démarrage ---------- */
initFormulaire();
initPlan();
chargerHistorique();
initReglages();
initInstallation();
function demarrer() {
  const vueDemandee = location.hash.slice(1);
  const sansCle = !(API.reglages().geminiCle || API.reglages().groqCle);
  ouvrir(sansCle || !PROFIL.complet() ? "reglages" : (["semaine", "nouvelle", "annee", "historique", "base", "reglages"].includes(vueDemandee) ? vueDemandee : "semaine"));
}
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js");
