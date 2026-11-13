/* =====================================================================
   MON ANNÉE — la progression devient un tableau de séances
   - Semaine par semaine : chaque séance de la progression, son activité, sa durée
   - Statut : fiche faite (préparée dans l'appli) ou cochée à la main
   - « Préparer » : préremplit le formulaire ; « Préparer toute la semaine » : génère les fiches à la suite
   - Les devoirs de la progression ouvrent le mode « Devoir » avec les leçons à évaluer
   Dépend de app.js (chargé avant) : $, $$, esc, norm, BASE, HISTO, ouvrir, produireFiche, afficherFiche, prefillDemande.
   ===================================================================== */
const ANNEE = (() => {
  const LS_FAIT = "fc_fait", LS_DECALAGE = "fc_semaine_decalage", LS_CHOIX = "fc_annee_choix";
  const lireLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const ecrireLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const MOIS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

  /* ---------------- Calendrier : semaines de cours (hors congés) ---------------- */
  const jour = s => { const [a, m, j] = s.split("-").map(Number); return new Date(a, m - 1, j); };
  function semainesScolaires() {
    const c = BASE.calendrier; if (!c) return [];
    const conges = c.conges.map(([a, b, nom]) => ({ a: jour(a), b: jour(b), nom }));
    const liste = []; let n = 0;
    for (let l = jour(c.debut); l <= jour(c.fin); l = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 7)) {
      const v = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 4);
      const conge = conges.find(x => l >= x.a && v <= x.b);
      if (conge) { liste.push({ conge: conge.nom, lundi: l, vendredi: v }); continue; }
      liste.push({ n: ++n, lundi: l, vendredi: v });
    }
    return liste;
  }
  const libelleDates = s => `${s.lundi.getDate()}${s.lundi.getMonth() !== s.vendredi.getMonth() ? " " + MOIS[s.lundi.getMonth()] : ""}–${s.vendredi.getDate()} ${MOIS[s.vendredi.getMonth()]}`;
  function semaineEstimee() {
    const auj = new Date(), cal = semainesScolaires().filter(s => s.n);
    if (!cal.length) return 1;
    if (auj < cal[0].lundi) return 1;
    let n = cal[cal.length - 1].n;
    for (const s of cal) if (auj <= new Date(s.vendredi.getFullYear(), s.vendredi.getMonth(), s.vendredi.getDate() + 2)) { n = s.n; break; }
    return n;
  }
  const semaineCourante = () => Math.max(1, semaineEstimee() + Number(lireLS(LS_DECALAGE, 0)));

  /* ---------------- Lecture des progressions ---------------- */
  const DUREE = t => { const m = t.match(/\((\d+)\s*h\s*(\d+)?\s*(?:min|mn)?\)|\((\d+)\s*(?:min|mn)\)/i); return m ? (m[3] ? `${m[3]} min` : `${m[1]} h${m[2] ? " " + m[2] : ""}`) : ""; };
  function activiteFr(col, texte, lecon, contexte) {
    const t = norm(texte), l = norm(lecon || "");
    if (col === 0) return /orthograph/.test(t + " " + l) ? "Orthographe" : "Grammaire";
    if (col === 1) return contexte.oeuvre ? "Étude de l'œuvre intégrale" : "Expression orale";
    if (col === 2) {
      if (/exploitation/.test(t)) return "Exploitation de texte";
      if (/remediation|lecture.comprehension|comprehension/.test(t) && !/methodique/.test(t)) return "Lecture compréhension (remédiation)";
      return "Lecture méthodique";
    }
    if (/compte rendu/.test(t)) return "Compte rendu de devoir";
    if (/devoir|evaluation\s*\d|evaluation\s*:/.test(t) && !/preparation/.test(t)) return "Évaluation (devoir)";
    if (/preparation du devoir d.orthographe/.test(t)) return "Orthographe";
    if (/lecture.comprehension/.test(t)) return "Lecture compréhension (remédiation)";
    return "Expression écrite";
  }
  function typeDevoir(texte) {
    const t = norm(texte);
    if (!/devoir/.test(t) || /compte rendu|preparation/.test(t)) return null;
    if (/orthographe/.test(t)) return "Devoir d'orthographe (dictée + questions)";
    if (/redaction|resume|article|texte argumentatif|portrait|recit|lettre/.test(t)) return "Devoir de rédaction";
    return "Devoir surveillé";
  }
  function lireFrancais(doc) {
    const L = doc.contenu.split("\n");
    const cols = ((L.find(l => /^Format\s*:/.test(l)) || "").split("|").slice(1).map(s => s.trim())).filter(Boolean);
    const semaines = [], courant = cols.map(() => ""), ctx = { oeuvre: false };
    let trimestre = "", n = 0;
    for (const ligne of L) {
      if (/TRIMESTRE/.test(ligne)) { trimestre = ligne.trim(); continue; }
      const m = ligne.match(/^S(\d{1,2})\s*\(([^)]*)\)\s*\|(.*)$/);
      if (!m) continue;
      const num = Number(m[1]), cellules = m[3].split("|").map(s => s.trim());
      const items = [];
      cellules.forEach((cel, col) => {
        const parties = cel.split(/\s;\s/).map(s => s.trim()).filter(Boolean);
        let precedente = "";
        parties.forEach((p, k) => {
          let lecon = courant[col], seance = p;
          const lm = p.match(/^((?:Le[cç]on|LE[CÇ]ON|Expression orale, Le[cç]on)[^—]*?)\s+—\s+(.*)$/);
          if (lm) { lecon = lm[1].replace(/^Expression orale,\s*/, ""); seance = lm[2]; courant[col] = lecon; }
          else if (/^Le[cç]on\b/i.test(p)) { courant[col] = p; lecon = p; }
          if (col === 1) {
            if (/œuvre intégrale|oeuvre integrale/i.test(lecon + " " + p)) ctx.oeuvre = true;
            if (/^(Expression orale|Le[cç]on\s*\d*\s*:\s*L.(exposé|dialogue|débat)|Le[cç]on\s*:\s*Le débat)/i.test(lecon) && !/œuvre/i.test(lecon)) ctx.oeuvre = false;
          }
          // « Exploitation du texte » se rattache à la lecture méthodique qui précède
          if (/^Exploitation (du|de) texte/i.test(p) && precedente) seance = `${p} — ${precedente.replace(/^S\.?\s*\d+\s*:\s*/i, "")}`;
          if (/^Activit[ée]s? de renforcement/i.test(p) && precedente) seance = `${p} (après : ${precedente.replace(/\s*\([^)]*\)\s*$/, "")})`;
          const activite = activiteFr(col, p, lecon, ctx);
          const titre = lecon && !/^Le[cç]on/i.test(seance) && !/^(Évaluation|Compte rendu|Activit|Préparation|Remédiation|Lecture.compr)/i.test(seance) ? `${lecon} — ${seance}` : seance;
          items.push({
            id: `${doc.matiere}|${doc.classes[0]}|S${num}|${col}|${k}`, col, colonne: cols[col] || "", activite,
            titre: titre.replace(/\s+/g, " ").trim(), lecon, seance,
            duree: DUREE(p) || (col === 3 ? "2 h" : "1 h"), devoir: typeDevoir(p)
          });
          precedente = p;
        });
      });
      semaines.push({ n: num, mois: m[2], trimestre, items });
      n = num;
    }
    return { matiere: doc.matiere, classe: doc.classes[0], colonnes: cols, semaines };
  }
  function lireEdhc(doc) {
    const cal = semainesScolaires();
    const parDate = d => cal.find(s => s.n && d >= s.lundi && d <= new Date(s.vendredi.getFullYear(), s.vendredi.getMonth(), s.vendredi.getDate() + 2));
    const moisNum = { janv: 0, "févr": 1, fevr: 1, "fév": 1, mars: 2, avr: 3, avril: 3, mai: 4, juin: 5, juil: 6, sept: 8, oct: 9, nov: 10, "déc": 11, dec: 11, janvier: 0, "février": 1, octobre: 9, novembre: 10, "décembre": 11, septembre: 8 };
    const semaines = new Map(); let competence = "", trimestre = "";
    for (const ligne of doc.contenu.split("\n")) {
      if (/^COMP[ÉE]TENCE/i.test(ligne)) { competence = ligne.trim(); continue; }
      const m = ligne.match(/^Du\s+(\d{1,2})\s*(?:er)?\s*([a-zéû.]+)?\s*(\d{4})?\s+au\s+(\d{1,2})\s+([a-zéû.]+)\s+(\d{4})\s*:\s*(.+)$/i);
      if (!m) continue;
      const finMois = moisNum[m[5].replace(".", "").toLowerCase()] ?? 0, annee = Number(m[6]);
      const debMois = m[2] ? (moisNum[m[2].replace(".", "").toLowerCase()] ?? finMois) : finMois;
      const debAnnee = m[3] ? Number(m[3]) : (debMois > finMois ? annee - 1 : annee);
      const deb = new Date(debAnnee, debMois, Number(m[1]));
      const texte = m[7].trim();
      if (/cong[ée]s/i.test(texte)) continue;
      const s = parDate(deb); if (!s) continue;
      const t = norm(texte);
      const activite = /^devoir/.test(t) ? "Devoir / Évaluation" : /revision|prise de contact|prerequis/.test(t) ? "Révision / Remédiation" : "Leçon (séance d'apprentissage)";
      if (!semaines.has(s.n)) semaines.set(s.n, { n: s.n, mois: MOIS[s.lundi.getMonth()], trimestre, competence, items: [] });
      const sem = semaines.get(s.n);
      sem.items.push({ id: `${doc.matiere}|${doc.classes[0]}|S${s.n}|0|${sem.items.length}`, col: 0, colonne: "EDHC", activite, titre: texte.replace(/\s*\((\d+\s*h)\)\s*$/i, ""), lecon: texte, seance: texte,
        duree: (texte.match(/\((\d+)\s*h\)/i) || [, ""])[1] ? texte.match(/\((\d+)\s*h\)/i)[1] + " h" : "1 h",
        devoir: /^devoir/.test(t) ? "Devoir surveillé" : null, competence });
    }
    return { matiere: doc.matiere, classe: doc.classes[0], colonnes: ["EDHC"], semaines: [...semaines.values()].sort((a, b) => a.n - b.n) };
  }
  const cache = new Map();
  function progression(matiere, classe) {
    const cle = matiere + "|" + classe;
    if (cache.has(cle)) return cache.get(cle);
    const doc = BASE.docs.find(d => d.type === "progression" && d.matiere === matiere && d.classes.includes(classe) && /^S\d{2}|^Du\s+\d/m.test(d.contenu));
    let p = null;
    if (doc) p = /^S\d{2}\s*\(/m.test(doc.contenu) ? lireFrancais(doc) : lireEdhc(doc);
    cache.set(cle, p);
    return p;
  }

  /* ---------------- Statut des séances ---------------- */
  const faitesMain = () => lireLS(LS_FAIT, {});
  const ficheDe = id => HISTO.find(f => f.req?.planId === id);
  const estFait = id => !!ficheDe(id) || !!faitesMain()[id];

  /* Leçons à évaluer pour un devoir : séances des semaines précédentes, depuis le devoir du même type */
  function notionsDevoir(p, sem, item) {
    // rédaction → leçons d'expression écrite ; orthographe → grammaire/orthographe ; autre devoir → tout sauf l'oral
    const cols = p.colonnes.length === 1 ? [0] : item.devoir?.includes("orthographe") ? [0] : item.devoir?.includes("rédaction") ? [3] : [0, 2, 3];
    const notions = [];
    for (let i = p.semaines.findIndex(s => s.n === sem.n) - 1; i >= 0 && notions.length < 8; i--) {
      const s = p.semaines[i];
      if (s.items.some(x => x.devoir === item.devoir && x !== item)) break;
      s.items.filter(x => cols.includes(x.col) && !x.devoir && !/compte rendu|renforcement|remédiation|préparation|lecture.compréhension|révision|prise de contact/i.test(x.titre))
        .forEach(x => notions.unshift((x.seance || x.titre).replace(/^S\.?\s*\d+\s*:\s*/i, "")));
    }
    return [...new Set(notions)];
  }
  function demandeDepuis(p, sem, item) {
    const base = { matiere: p.matiere, classe: p.classe, activite: item.activite, titre: item.titre, semaine: String(sem.n), duree: item.duree, planId: item.id };
    if (item.devoir) {
      const notions = notionsDevoir(p, sem, item);
      return { ...base, genre: "devoir", typeEval: item.devoir,
        activite: item.devoir.includes("orthographe") ? (BASE.matieres[p.matiere]?.activites.includes("Orthographe") ? "Orthographe" : item.activite) : (item.col === 3 ? "Expression écrite" : item.activite),
        titre: `${item.titre}${notions.length ? " — leçons évaluées : " + notions.join(" ; ") : ""}` };
    }
    return { ...base, genre: "fiche" };
  }

  /* ---------------- Affichage ---------------- */
  let file = null;           // préparation de semaine en cours
  function remplirChoix() {
    const ch = lireLS(LS_CHOIX, {});
    const classesDe = m => (PROFIL.classes(m) || BASE.matieres[m].classes || []);
    const avecProg = (PROFIL.matieres() || Object.keys(BASE.matieres)).filter(m => classesDe(m).some(c => progression(m, c)));
    const selM = $("#an-matiere"), selC = $("#an-classe");
    const m = avecProg.includes(ch.matiere) ? ch.matiere : avecProg.includes($("#matiere").value) ? $("#matiere").value : avecProg[0];
    selM.innerHTML = avecProg.map(x => `<option${x === m ? " selected" : ""}>${esc(x)}</option>`).join("");
    const classes = (m ? classesDe(m) : []).filter(c => progression(m, c));
    const c = classes.includes(ch.classe) ? ch.classe : classes.includes($("#classe").value) ? $("#classe").value : classes[classes.length - 1];
    selC.innerHTML = classes.map(x => `<option${x === c ? " selected" : ""}>${esc(x)}</option>`).join("");
  }
  function afficher(defiler = true) {
    const m = $("#an-matiere").value, c = $("#an-classe").value;
    ecrireLS(LS_CHOIX, { matiere: m, classe: c });
    const p = m && c ? progression(m, c) : null;
    const cour = semaineCourante();
    $("#an-courante").textContent = "S" + String(cour).padStart(2, "0");
    const cal = semainesScolaires();
    const calN = new Map(cal.filter(s => s.n).map(s => [s.n, s]));
    $("#an-estimee").textContent = Number(lireLS(LS_DECALAGE, 0)) ? "(corrigée)" : "(estimée d'après le calendrier)";
    if (!p) { $("#an-liste").innerHTML = `<p class="vide">Pas de progression pour ce choix. Ajoute-la dans Base → Agrandir la base (type « Progression »).</p>`; $("#an-resume").textContent = ""; return; }
    let total = 0, faits = 0;
    const html = [];
    let derniereConge = null;
    for (const s of p.semaines) {
      const dates = calN.get(s.n);
      // bandeau de congés entre deux semaines
      const conge = cal.find(x => x.conge && dates && x.vendredi < dates.lundi && (!derniereConge || x.lundi > derniereConge));
      if (conge && conge.conge !== derniereConge?.nom) { html.push(`<div class="an-conge">${esc(conge.conge)}</div>`); derniereConge = { nom: conge.conge, ...conge }; }
      const nbFait = s.items.filter(x => estFait(x.id)).length;
      total += s.items.length; faits += nbFait;
      const aFaire = s.items.filter(x => !estFait(x.id)).length;
      const classe = ["an-sem", s.n === cour ? "courante" : "", s.n < cour ? "passee" : "", nbFait === s.items.length && s.items.length ? "complete" : ""].join(" ");
      html.push(`<details class="${classe}" data-n="${s.n}"${s.n === cour || s.n === cour + 1 ? " open" : ""}>
        <summary><span class="an-num">S${String(s.n).padStart(2, "0")}</span>
          <span class="an-quand">${esc(s.mois || "")}${dates ? " · " + libelleDates(dates) : ""}${s.n === cour ? ' <b class="an-badge">cette semaine</b>' : ""}</span>
          <span class="an-prog">${nbFait}/${s.items.length}</span></summary>
        ${s.competence && p.colonnes.length === 1 ? `<p class="meta an-comp">${esc(s.competence)}</p>` : ""}
        <ul class="an-items">${s.items.map(x => {
          const f = ficheDe(x.id), fait = estFait(x.id);
          return `<li class="an-item${fait ? " fait" : ""}${x.devoir ? " devoir" : ""}" data-id="${esc(x.id)}">
            <button type="button" class="an-coche" aria-label="${fait ? "Marquer à faire" : "Marquer comme fait"}" title="${f ? "Fiche préparée dans l'appli" : "Cocher si cette séance est faite"}"${f ? " disabled" : ""}>${fait ? "✓" : ""}</button>
            <div class="an-txt"><span class="an-act">${x.devoir ? '<b class="etiquette">Devoir</b> ' : ""}${esc(x.activite)} · ${esc(x.duree)}</span><span class="an-titre">${esc(x.titre)}</span></div>
            ${f ? `<button type="button" class="an-voir">Ouvrir</button>` : `<button type="button" class="an-prep">Préparer</button>`}
          </li>`; }).join("")}</ul>
        ${aFaire ? `<button type="button" class="principal an-tout">Préparer toute la semaine (${aFaire} fiche${aFaire > 1 ? "s" : ""})</button>` : `<p class="ok an-ok">✓ Semaine prête</p>`}
        <div class="an-file" hidden></div>
      </details>`);
    }
    $("#an-liste").innerHTML = html.join("");
    $("#an-resume").textContent = `${faits} séance${faits > 1 ? "s" : ""} prête${faits > 1 ? "s" : ""} sur ${total} · ${p.semaines.length} semaines`;
    if (file) majFile();
    if (defiler) requestAnimationFrame(() => {
      const el = document.querySelector(`.an-sem[data-n="${cour}"]`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: "instant" in window ? "instant" : "auto" });
    });
  }
  const trouver = id => {
    const p = progression($("#an-matiere").value, $("#an-classe").value);
    for (const s of p?.semaines || []) { const it = s.items.find(x => x.id === id); if (it) return { p, s, it }; }
    return null;
  };

  /* Préparer toute la semaine : les fiches sont générées l'une après l'autre */
  async function preparerSemaine(n, matiere = $("#an-matiere").value, classe = $("#an-classe").value) {
    if (file) return alert("Une préparation est déjà en cours.");
    const p = progression(matiere, classe);
    const s = p.semaines.find(x => x.n === n);
    const items = s.items.filter(x => !estFait(x.id));
    if (!items.length) return;
    if (!confirm(`Préparer ${items.length} fiche${items.length > 1 ? "s" : ""} pour la semaine ${n} ?\nCompte environ 1 minute par fiche. Tu peux continuer à utiliser l'appli pendant ce temps.`)) return;
    file = { n, total: items.length, fait: 0, en: "", erreurs: [] };
    majFile();
    VOILE.ouvrir({ titre: `Préparation de la semaine ${n}…` });
    const orientation = LS.get("fc_dernier", {}).orientation || "portrait";
    for (const it of items) {
      file.en = it.titre; majFile();
      VOILE.titre(`Préparation de la semaine ${n}…`, `Fiche ${file.fait + 1} sur ${file.total}`);
      try {
        const pr = PROFIL.lire();
        const req = { ...demandeDepuis(p, s, it), orientation, etablissement: pr.etablissement || "", professeur: pr.professeur || "", effectif: pr.effectif || "", consignesPermanentes: (API.reglages().consignesPermanentes || "").trim() };
        await produireFiche(req, t => { file.etat = t; majFile(); VOILE.etat(t); });
        file.fait++;
      } catch (err) {
        file.erreurs.push(`${it.activite} : ${err.message}`);
        if (/quota|clé/i.test(err.message)) break;
      }
      if (!$("#vue-annee").hidden) afficher(false);
      window.dispatchEvent(new Event("fiches-maj"));
    }
    const bilan = file; file = null;
    VOILE.fermer();
    if (!$("#vue-annee").hidden) afficher(false);
    window.dispatchEvent(new Event("fiches-maj"));
    alert(`Semaine ${bilan.n} : ${bilan.fait} fiche${bilan.fait > 1 ? "s" : ""} préparée${bilan.fait > 1 ? "s" : ""} sur ${bilan.total}.` + (bilan.erreurs.length ? "\n\nProblèmes :\n" + bilan.erreurs.join("\n") : "\nElles sont dans « Mes fiches »."));
  }
  function majFile() {
    const el = document.querySelector(`.an-sem[data-n="${file?.n}"] .an-file`);
    if (!el || !file) return;
    el.hidden = false;
    el.innerHTML = `<div class="etat"><span class="rond"></span><span>Fiche ${file.fait + 1}/${file.total} : ${esc(file.en.slice(0, 80))}${file.etat ? " — " + esc(file.etat) : ""}</span></div>`;
    const b = el.parentElement.querySelector(".an-tout"); if (b) b.disabled = true;
  }

  function init() {
    $("#an-matiere").onchange = () => { const ch = lireLS(LS_CHOIX, {}); ecrireLS(LS_CHOIX, { matiere: $("#an-matiere").value, classe: ch.classe }); remplirChoix(); afficher(); };
    $("#an-classe").onchange = () => afficher();
    $("#an-moins").onclick = () => { ecrireLS(LS_DECALAGE, Number(lireLS(LS_DECALAGE, 0)) - 1); afficher(); };
    $("#an-plus").onclick = () => { ecrireLS(LS_DECALAGE, Number(lireLS(LS_DECALAGE, 0)) + 1); afficher(); };
    $("#an-liste").addEventListener("click", e => {
      const li = e.target.closest(".an-item"), sem = e.target.closest(".an-sem");
      if (e.target.closest(".an-tout")) return preparerSemaine(Number(sem.dataset.n));
      if (!li) return;
      const t = trouver(li.dataset.id); if (!t) return;
      if (e.target.closest(".an-coche")) {
        const f = faitesMain(); f[t.it.id] ? delete f[t.it.id] : (f[t.it.id] = true); ecrireLS(LS_FAIT, f); SAUVEGARDE.modifie(); afficher(false);
      } else if (e.target.closest(".an-voir")) afficherFiche(ficheDe(t.it.id));
      else if (e.target.closest(".an-prep")) { viderFormulaire(); prefillDemande(demandeDepuis(t.p, t.s, t.it)); ouvrir("nouvelle"); }
    });
    window.addEventListener("donnees-restaurees", () => { cache.clear(); });
  }
  return { init, afficher, remplirChoix, progression, semaineCourante, semainesScolaires, libelleDates, demandeDepuis, estFait, ficheDe, preparerSemaine, cache, avant: () => { remplirChoix(); afficher(); } };
})();
ANNEE.init();
