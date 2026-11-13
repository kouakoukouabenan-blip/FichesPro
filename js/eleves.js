/* =====================================================================
   PAGE À PHOTOCOPIER — texte-support, situation d'apprentissage, situation d'évaluation
   extraits de la fiche et disposés en plusieurs exemplaires par page quand c'est possible
   (pour les élèves ou le cahier de textes). Chaque élément commence sur une nouvelle page.
   Dépend de app.js : $, $$, esc, ficheCourante, sauverHistorique, EXPORT.
   ===================================================================== */
const ELEVES = (() => {
  const ELEMENTS = {
    support: "Texte-support",
    apprentissage: "Situation d'apprentissage",
    evaluation: "Situation d'évaluation"
  };
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  /* ---------- Extraction depuis la fiche ---------- */
  // Rubriques de la fiche qui ne doivent jamais passer sur la page élèves
  const RUBRIQUE = /^\s*(tableau des habilet|habilet[ée]s?\b|supports?\b|moyens|techniques?\b|strat[ée]gies|bibliographie|m[ée]thodes|mat[ée]riel|d[ée]roulement|comp[ée]tence\b|th[èe]me\s*:|le[çc]on\s*\d*\s*:|s[ée]ance\s*\d*\s*:|dur[ée]e\s*:|corrig)/;
  function sectionApres(h, garder = () => true) {
    const d = document.createElement("div");
    for (let n = h.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^H[1-4]$/.test(n.tagName) || n.tagName === "TABLE") break;          // nouveau titre ou tableau (habiletés, déroulement…)
      if (RUBRIQUE.test(norm(n.textContent))) break;                              // « Supports : », « Bibliographie : »…
      if (garder(n)) d.appendChild(n.cloneNode(true));
    }
    return d.textContent.trim() ? d.innerHTML : "";
  }
  function trouverTitre(racine, re) {
    return [...racine.querySelectorAll("h2,h3")].find(h => re.test(norm(h.textContent)));
  }
  function extraire(racine) {
    const r = {};
    // 1. Texte-support (ou corpus)
    let h = trouverTitre(racine, /texte[- ]?support|support de la seance|^corpus|texte d.etude/);
    if (h) {
      // texte mis en page (classes ts-) : on ne garde que ses paragraphes
      const aTs = (() => { for (let n = h.nextElementSibling; n && !/^H[1-4]$/.test(n.tagName); n = n.nextElementSibling) if (n.matches?.('p[class*="ts-"]')) return true; return false; })();
      r.support = sectionApres(h, n => !aTs || n.matches('p[class*="ts-"], ul, ol'));
    }
    if (!r.support) {
      const ts = [...racine.querySelectorAll('p[class*="ts-"]')];
      if (ts.length) r.support = ts.map(p => p.outerHTML).join("");
    }
    // 2. Situation d'apprentissage
    h = trouverTitre(racine, /situation d.apprentissage|exemple de situation/);
    if (h) r.apprentissage = sectionApres(h);
    if (!r.apprentissage) {
      const p = [...racine.querySelectorAll("p")].find(x => /^\s*(exemple de )?situation d.apprentissage\s*:/.test(norm(x.textContent)));
      if (p) r.apprentissage = `<p>${p.innerHTML.replace(/^[\s\S]*?:\s*/, "")}</p>`;
    }
    // 3. Situation d'évaluation : rubrique dédiée, sinon ligne ÉVALUATION du déroulement
    h = trouverTitre(racine, /situation d.evaluation/);
    if (h && !/corrige/.test(norm(h.textContent))) r.evaluation = sectionApres(h);
    if (!r.evaluation) {
      const ligne = [...racine.querySelectorAll("table.deroulement tr, table tr")].find(tr => tr.cells.length >= 3 && /evaluation/.test(norm(tr.cells[0].textContent)) && !/bilan/.test(norm(tr.cells[0].textContent)));
      if (ligne) {
        const td = ligne.querySelector("td.col-enseignant") || ligne.cells[2];
        let html = td.innerHTML;
        // on garde à partir de « Situation d'évaluation » quand l'enseignant a d'abord des consignes de conduite
        const i = Math.max(0, norm(td.textContent).indexOf("situation"));
        // texte d'un seul tenant : on remet les consignes à la ligne
        if (i > 0 || !td.querySelector("br,p,ol,ul")) { const t = td.textContent; html = `<p>${esc(t.slice(i).replace(/^\s*situation d['’][ée]valuation\s*:\s*/i, "")).replace(/\s*(\d+)\s*[.)]\s+/g, "<br>$1. ").replace(/\s*Consignes?\s*:/i, "<br><strong>Consignes :</strong>")}</p>`; }
        r.evaluation = html.replace(/^\s*situation d['’][ée]valuation\s*:\s*/i, "");
      }
    }
    return r;
  }

  /* ---------- Mise en page en plusieurs exemplaires ---------- */
  // Estimation de la place occupée, en lignes de PDF A4 portrait (≈ 66 lignes utiles sous le bandeau) :
  // on compte les lignes réelles (chaque <br>, paragraphe, vers… commence une ligne) en pleine largeur et en demi-largeur,
  // puis on garde la disposition qui donne le plus d'exemplaires sans déborder.
  function copiesAuto(html, entete = 3) {
    const segments = html.replace(/<(br|\/p|\/li|\/tr|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").split("\n").map(s => s.trim()).filter(Boolean);
    const lignes = largeur => segments.reduce((n, s) => n + Math.max(1, Math.ceil(s.length / largeur)), 0) + entete;
    const PAGE = 76;
    const lh = lignes(62);
    // l'exemplaire tient dans une colonne : 2 colonnes, autant de rangées que la hauteur le permet
    if (lh + 2.5 <= PAGE) return Math.min(12, 2 * Math.max(1, Math.floor(PAGE / (lh + 2.5))));
    return 1;                                                                            // trop long : pleine largeur
  }
  function bloc(cle, html, f) {
    const r = f.req;
    const nom = cle === "evaluation" ? `<p class="copie-nom">Nom et prénoms : ……………………………………… Classe : …………</p>` : "";
    return `<p class="copie-ref">${esc(r.matiere)} · ${esc(r.classe)} — ${esc(ELEMENTS[cle])}</p>${nom}<div class="copie-corps">${html}</div>`;
  }
  function page(cle, html, f, copies) {
    const n = copies === "auto" ? copiesAuto(html, cle === "evaluation" ? 3 : 2) : Number(copies) || 1;
    const b = bloc(cle, html, f);
    let corps;
    const coupe = `<p class="coupe">- - - - - - - - - - - - - - - - - - - - - - -  découper  - - - - - - - - - - - - - - - - - - - - - - -</p>`;
    if (n >= 2 && n % 2 === 0) corps = `<table class="copies-grille"><tbody>${`<tr><td>${b}</td><td>${b}</td></tr>`.repeat(Math.ceil(n / 2))}</tbody></table>`;
    else corps = Array(n).fill(`<div class="copie">${b}</div>`).join(coupe);
    return `<h2 class="saut">${esc(ELEMENTS[cle])} — à photocopier (${n} exemplaire${n > 1 ? "s" : ""} par page)</h2>${corps}`;
  }
  /* Tout sur une même page : un seul exemplaire regroupe les éléments choisis
     (ordre de la séance : situation d'apprentissage, texte-support, situation d'évaluation) */
  function pageGroupee(ex, choix, f, copies) {
    const ordre = ["apprentissage", "support", "evaluation"].filter(c => choix.includes(c) && ex[c]);
    const r = f.req;
    const nom = ordre.includes("evaluation") ? `<p class="copie-nom">Nom et prénoms : ……………………………………… Classe : …………</p>` : "";
    const corps = ordre.map(c => `<p class="copie-sous-titre">${esc(ELEMENTS[c])}</p><div class="copie-corps">${ex[c]}</div>`).join("");
    const b = `<p class="copie-ref">${esc(r.matiere)} · ${esc(r.classe)} — ${esc(r.titre.length > 70 ? r.titre.slice(0, 70) + "…" : r.titre)}</p>${nom}${corps}`;
    const n = copies === "auto" ? copiesAuto(corps, 2 + ordre.length + (nom ? 1 : 0)) : Number(copies) || 1;
    const coupe = `<p class="coupe">- - - - - - - - - - - - - - - - - - - - - - -  découper  - - - - - - - - - - - - - - - - - - - - - - -</p>`;
    const contenu = n >= 2 && n % 2 === 0
      ? `<table class="copies-grille"><tbody>${`<tr><td>${b}</td><td>${b}</td></tr>`.repeat(Math.ceil(n / 2))}</tbody></table>`
      : Array(n).fill(`<div class="copie">${b}</div>`).join(coupe);
    return `<h2 class="saut">${ordre.map(c => ELEMENTS[c]).join(" + ")} — à photocopier (${n} exemplaire${n > 1 ? "s" : ""} par page)</h2>${contenu}`;
  }
  function construire(f, choix, copies, groupe = false) {
    const div = document.createElement("div"); div.innerHTML = f.html;
    const ex = extraire(div);
    const presents = choix.filter(c => ex[c]);
    const html = groupe && presents.length > 1 ? pageGroupee(ex, presents, f, copies) : presents.map(c => page(c, ex[c], f, copies)).join("");
    return { html, manquants: choix.filter(c => !ex[c]) };
  }

  /* ---------- Affichage dans la vue fiche ---------- */
  function afficher(f) {
    const el = $("#eleves");
    const html = f && f.eleves && f.eleves.html;
    el.innerHTML = html || "";
    el.hidden = !html || (typeof modeTraces !== "undefined" && modeTraces);
    el.className = "fiche page-eleves portrait";                         // toujours en portrait
    requestAnimationFrame(() => typeof ajusterZoom === "function" && ajusterZoom());
    $("#bouton-eleves").querySelector("b").textContent = html ? "Page élèves (ajoutée)" : "Page élèves";
  }

  function ouvrirDialogue() {
    const f = ficheCourante; if (!f) return;
    const div = document.createElement("div"); div.innerHTML = f.html;
    const ex = extraire(div), choix = f.eleves?.choix || Object.keys(ELEMENTS);
    $$("#dlg-eleves input[name=el]").forEach(c => {
      c.disabled = !ex[c.value];
      c.checked = !!ex[c.value] && choix.includes(c.value);
      c.closest("label").classList.toggle("absent", !ex[c.value]);
    });
    $("#el-copies").value = f.eleves?.copies || "auto";
    const g = !!(f.eleves ? f.eleves.groupe : (() => { try { return localStorage.getItem("fc_eleves_groupe") === "1"; } catch { return false; } })());
    $(`#dlg-eleves input[name=el-dispo][value="${g ? "groupe" : "separe"}"]`).checked = true;
    $("#el-retirer").hidden = !f.eleves?.html;
    $("#dlg-eleves").showModal();
  }
  function appliquer() {
    const f = ficheCourante; if (!f) return;
    const choix = $$("#dlg-eleves input[name=el]:checked").map(c => c.value);
    const copies = $("#el-copies").value;
    const groupe = $("#dlg-eleves input[name=el-dispo]:checked")?.value === "groupe";
    try { localStorage.setItem("fc_eleves_groupe", groupe ? "1" : "0"); } catch {}
    if (!choix.length) return alert("Coche au moins un élément.");
    const { html, manquants } = construire(f, choix, copies, groupe);
    f.eleves = { choix, copies, groupe, html };
    sauverHistorique(f); afficher(f);
    $("#dlg-eleves").close();
    if (manquants.length) alert("Introuvable dans la fiche : " + manquants.map(m => ELEMENTS[m]).join(", ") + ".");
    $("#eleves").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  /* Après une génération, si la case du formulaire est cochée */
  function auto(f) {
    if (!f || f.genre === "devoir") return;
    let oui = false; try { oui = localStorage.getItem("fc_eleves_auto") === "1"; } catch {}
    if (!oui) return;
    let groupe = false; try { groupe = localStorage.getItem("fc_eleves_groupe") === "1"; } catch {}
    const { html } = construire(f, Object.keys(ELEMENTS), "auto", groupe);
    if (html) { f.eleves = { choix: Object.keys(ELEMENTS), copies: "auto", groupe, html }; sauverHistorique(f); }
  }
  /* Pour les exports : fiche + page élèves à la suite */
  function racineAvecEleves(racineFiche) {
    const f = ficheCourante;
    if (!f?.eleves?.html || racineFiche.id !== "fiche") return racineFiche;
    const d = document.createElement("article");
    d.innerHTML = racineFiche.innerHTML + $("#eleves").innerHTML;
    return d;
  }

  function init() {
    $("#bouton-eleves").onclick = ouvrirDialogue;
    $("#el-valider").onclick = e => { e.preventDefault(); appliquer(); };
    $("#el-retirer").onclick = e => {
      e.preventDefault();
      const f = ficheCourante; if (!f) return;
      delete f.eleves; sauverHistorique(f); afficher(f); $("#dlg-eleves").close();
    };
    $("#el-seule").onclick = async e => {
      e.preventDefault();
      if (!ficheCourante?.eleves?.html) appliquer();
      if (!ficheCourante?.eleves?.html) return;
      $("#dlg-eleves").close();
      const f = { ...ficheCourante, req: { ...ficheCourante.req, titre: "Page élèves — " + ficheCourante.req.titre } };
      const r = $("#eleves").cloneNode(true);
      r.querySelector("h2.saut")?.classList.remove("saut");     // pas de page blanche au début
      try { await EXPORT.pdf(r, f, "portrait"); } catch (err) { alert("L'export a échoué.\n\n" + err.message); }
    };
    // corrections à la main sur la page élèves
    let m; $("#eleves").addEventListener("input", () => {
      clearTimeout(m); m = setTimeout(() => { if (ficheCourante?.eleves) { ficheCourante.eleves.html = $("#eleves").innerHTML; sauverHistorique(ficheCourante); } }, 600);
    });
    // case du formulaire, retenue
    const c = $("#eleves-auto");
    try { c.checked = localStorage.getItem("fc_eleves_auto") === "1"; } catch {}
    c.onchange = () => { try { localStorage.setItem("fc_eleves_auto", c.checked ? "1" : "0"); } catch {} };
  }

  return { init, afficher, auto, racineAvecEleves, extraire, construire };
})();
