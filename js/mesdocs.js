/* =====================================================================
   MES DOCUMENTS — agrandir la base depuis l'appli
   - Import de PDF, Word (.docx), texte, page web ou photo
   - Lecture sur l'appareil (pdf.js, mammoth) ; PDF scannés et photos : reconnaissance du texte
     sur le téléphone (Tesseract, voir scanner.js) ou en ligne (Gemini)
   - Classement automatique (matière, type, classes, activités) à vérifier
   - Découpage automatique d'un recueil en fiches séparées
   - Stockage sur l'appareil (IndexedDB) ; sauvegarde / restauration / export pour le code
   Dépend de app.js : $, $$, esc, BASE, norm, afficherBase, remplirModeles, remplirSelect, API.
   ===================================================================== */
const MESDOCS = (() => {
  /* ---------------- Stockage : module commun (stockage.js) ---------------- */
  const { tous, mettre, enlever } = STOCK;

  /* ---------------- Constantes ---------------- */
  const TYPES = { modele: "Fiche exemple", progression: "Progression", guide: "Guide / programme", document: "Document (exercices, sujets, cours…)", format: "Format de fiche" };
  const CLASSES_DEFAUT = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Tle"];
  const ACTIVITES_DEFAUT = ["Leçon (séance d'apprentissage)", "Devoir / Évaluation", "Révision / Remédiation"];
  const FORMAT_GENERIQUE = matiere => `TITRE : FICHE DE COURS — ${matiere.toUpperCase()} — [CLASSE]

1. EN-TÊTE (tableau) : Établissement · Année scolaire · Professeur · Discipline : ${matiere} · Classe · Durée · Date / Semaine
2. IDENTIFICATION : Compétence · Thème · Leçon · Séance (intitulés exacts de la progression)
3. SITUATION D'APPRENTISSAGE : contexte proche du vécu des élèves (Côte d'Ivoire), circonstance, tâche (« Ils décident de … afin de … »)
4. TABLEAU DES HABILETÉS ET CONTENUS (2 colonnes : Habiletés | Contenus)
5. SUPPORTS DIDACTIQUES · MÉTHODES ET TECHNIQUES · BIBLIOGRAPHIE
6. DÉROULEMENT (tableau à 5 colonnes) : Moments didactiques / Durée | Stratégies pédagogiques | Activités de l'enseignant | Activités des élèves | Traces écrites
   PRÉSENTATION (≈ 5 min) — DÉVELOPPEMENT (parties numérotées, questions précises, réponses attendues, traces écrites rédigées) — ÉVALUATION (situation d'évaluation + consignes)
7. CORRIGÉ / RÉSUMÉ DE LA LEÇON`;

  /* ---------------- Utilitaires ---------------- */
  const idNouveau = () => "perso-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  const sansExtension = n => n.replace(/\.[^.]+$/, "").replace(/^[0-9a-f]{8}-/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const nb = n => n.toLocaleString("fr-FR");
  const telecharger = (contenu, nom, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenu], { type }));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const chargerScript = src => new Promise((ok, ko) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return ok();
    const s = document.createElement("script"); s.src = src; s.dataset.src = src;
    s.onload = ok; s.onerror = () => ko(new Error("Impossible de charger " + src + " (connexion ?)"));
    document.head.appendChild(s);
  });
  const fichierEnBase64 = blob => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });

  /* ---------------- Extraction du texte ---------------- */
  // Tableaux HTML (Word) → « cellule | cellule », paragraphes → lignes
  function htmlVersTexte(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const lignes = [];
    const texteCellule = c => [...c.querySelectorAll("p,li")].map(p => p.textContent.trim()).filter(Boolean).join(" / ") || c.textContent.trim();
    const parcourir = n => {
      for (const e of n.children) {
        const t = e.tagName;
        if (t === "TABLE") {
          lignes.push("[TABLEAU]");
          [...e.rows].forEach(r => { const v = [...r.cells].map(texteCellule); if (v.some(Boolean)) lignes.push(v.join(" | ")); });
          lignes.push("[/TABLEAU]");
        } else if (/^(P|H[1-6]|LI|PRE|BLOCKQUOTE)$/.test(t)) {
          const v = e.textContent.replace(/\s+/g, " ").trim();
          if (v) lignes.push((t === "LI" ? "- " : "") + v);
        } else parcourir(e);
      }
    };
    parcourir(doc.body);
    return lignes.join("\n");
  }

  let pdfjsLib = null;
  async function pdfjs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await import(new URL("vendor/pdfjs/pdf.min.js", location.href).href);
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.min.js", location.href).href;
    return pdfjsLib;
  }
  // Reconstitue les lignes d'une page PDF à partir des positions ; grands écarts horizontaux → « | » (colonnes)
  function lignesPage(items) {
    const el = items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10 }));
    el.sort((a, b) => b.y - a.y || a.x - b.x);
    const lignes = [];
    for (const e of el) {
      const l = lignes[lignes.length - 1];
      if (l && Math.abs(l.y - e.y) <= Math.max(2.5, Math.min(l.h, e.h) * 0.45)) l.items.push(e);
      else lignes.push({ y: e.y, h: e.h, items: [e] });
    }
    return lignes.map(l => {
      l.items.sort((a, b) => a.x - b.x);
      let t = "", fin = null;
      for (const e of l.items) {
        if (fin !== null) {
          const ecart = e.x - fin;
          t += ecart > Math.max(14, e.h * 1.6) ? " | " : (ecart > e.h * 0.15 && !/\s$/.test(t) && !/^\s/.test(e.s) ? " " : "");
        }
        t += e.s; fin = e.x + e.w;
      }
      return t.replace(/\s+/g, " ").trim();
    }).filter(Boolean);
  }
  async function lirePdf(fichier, onEtat) {
    const lib = await pdfjs();
    const pdf = await lib.getDocument({ data: await fichier.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onEtat && onEtat(`Lecture de la page ${p}/${pdf.numPages}…`);
      const page = await pdf.getPage(p);
      pages.push(lignesPage((await page.getTextContent()).items).join("\n"));
      page.cleanup();
    }
    const texte = pages.join("\n\n");
    const scanne = texte.replace(/\s/g, "").length < pdf.numPages * 120;
    return { texte, pages: pdf.numPages, scanne, pdf };
  }
  // PDF scanné : pages rendues en images puis transcrites par Gemini, 4 pages par envoi
  async function lirePdfAvecIA(fichier, onEtat) {
    const lib = await pdfjs();
    const pdf = await lib.getDocument({ data: await fichier.arrayBuffer() }).promise;
    const n = pdf.numPages, morceaux = [];
    for (let debut = 1; debut <= n; debut += 4) {
      const parties = [], fin = Math.min(n, debut + 3);
      for (let p = debut; p <= fin; p++) {
        onEtat && onEtat(`Préparation de la page ${p}/${n}…`);
        const page = await pdf.getPage(p);
        const vp0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2.2, 1500 / vp0.width) });
        const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        parties.push({ text: `Page ${p} :` }, { inline_data: { mime_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.8).split(",")[1] } });
        page.cleanup();
      }
      parties.push({ text: `Transcris les pages ${debut} à ${fin}.` });
      morceaux.push(await API.transcrire(parties, () => onEtat && onEtat(`Lecture automatique : pages ${debut}-${fin} sur ${n}…`)));
    }
    return { texte: morceaux.join("\n\n"), pages: n, scanne: false, ia: true };
  }
  // Photos : lecture en ligne si une clé Gemini est enregistrée, sinon sur le téléphone (scanner.js)
  async function lireImages(fichiers, onEtat) {
    const toiles = [];
    for (let i = 0; i < fichiers.length; i++) {
      onEtat && onEtat(`Préparation de la photo ${i + 1}/${fichiers.length}…`);
      toiles.push(SCANNER.ameliorer(await SCANNER.charger(fichiers[i])));
    }
    const r = await SCANNER.lire(toiles, { mode: "auto", onEtat });
    return { texte: r.texte, pages: fichiers.length, ia: !!r.ia, local: !!r.local };
  }
  // PDF scanné lu sur le téléphone : pages rendues en images puis reconnues une à une
  async function lirePdfLocal(fichier, onEtat) {
    const lib = await pdfjs();
    const pdf = await lib.getDocument({ data: await fichier.arrayBuffer() }).promise;
    const toiles = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onEtat && onEtat(`Préparation de la page ${p}/${pdf.numPages}…`);
      const page = await pdf.getPage(p);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(3, 2000 / vp0.width) });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      toiles.push(SCANNER.ameliorer(c)); page.cleanup();
    }
    const r = await SCANNER.lire(toiles, { mode: "local", onEtat });
    return { texte: r.texte, pages: pdf.numPages, scanne: false, local: true };
  }
  async function extraire(fichier, onEtat) {
    const nom = fichier.name.toLowerCase(), type = fichier.type;
    if (nom.endsWith(".pdf") || type === "application/pdf") return lirePdf(fichier, onEtat);
    if (nom.endsWith(".docx")) {
      onEtat && onEtat("Lecture du fichier Word…");
      await chargerScript("vendor/mammoth.browser.min.js");
      const r = await mammoth.convertToHtml({ arrayBuffer: await fichier.arrayBuffer() });
      return { texte: htmlVersTexte(r.value) };
    }
    if (/\.(doc|odt|rtf|pptx?|xlsx?)$/.test(nom)) throw new Error("Format non pris en charge. Enregistre ce fichier en PDF ou en Word (.docx), puis réessaie.");
    if (/\.(html?|xhtml)$/.test(nom)) return { texte: htmlVersTexte(await fichier.text()) };
    if (type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/.test(nom)) return lireImages([fichier], onEtat);
    return { texte: await fichier.text() };
  }
  const nettoyer = t => t.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  /* ---------------- Classement automatique ---------------- */
  // fin de mot compatible avec les lettres accentuées (\b ne les reconnaît pas)
  const F = "(?![0-9A-Za-zÀ-ÿ])";
  const MOTIFS_CLASSES = {
    "6e": new RegExp(`\\b6\\s?(?:e|è|ème|eme|ieme|ième)${F}|sixi[eè]me`, "i"), "5e": new RegExp(`\\b5\\s?(?:e|è|ème|eme|ieme|ième)${F}|cinqui[eè]me`, "i"),
    "4e": new RegExp(`\\b4\\s?(?:e|è|ème|eme|ieme|ième)${F}|quatri[eè]me`, "i"), "3e": new RegExp(`\\b3\\s?(?:e|è|ème|eme|ieme|ième)${F}|troisi[eè]me`, "i"),
    "2nde": new RegExp(`\\b2\\s?(?:nde|nd)${F}|\\bseconde${F}`, "i"),
    "1ère": new RegExp(`\\b1\\s?(?:ère|ere|re)${F}(?!\\s*(?:s[ée]ance|le[cç]on|partie|ann[ée]e))|\\bpremi[eè]re${F}(?!\\s*(?:s[ée]ance|le[cç]on|partie))`, "i"),
    "Tle": new RegExp(`\\bt(?:le|erminale)${F}`, "i")
  };
  const classesExplicites = (texte, dispo) => {
    const m = texte.slice(0, 1500).match(/(?:classe|niveau)s?\s*:?\s*(?:de\s+)?([^\n|]{1,30})/i);
    if (!m) return null;
    const v = dispo.filter(c => MOTIFS_CLASSES[c]?.test(m[1]));
    return v.length ? v : null;
  };
  function devinerClasses(texte, matiere, fenetre = 8000) {
    const dispo = (BASE.matieres[matiere]?.classes) || CLASSES_DEFAUT;
    const exp = classesExplicites(texte, dispo);       // « Classe : 5e » / « Niveau : 3ème » en priorité
    if (exp) return exp;
    const zone = texte.slice(0, fenetre);
    const comptes = dispo.map(c => [c, (zone.match(new RegExp(MOTIFS_CLASSES[c]?.source || "$^", "gi")) || []).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    if (!comptes.length) return ["toutes"];
    return comptes.filter(x => x[1] >= comptes[0][1] * 0.6).map(x => x[0]).slice(0, 3);
  }
  function activiteLecture(t) {
    t = norm(t);
    if (/exploitation/.test(t)) return "Exploitation de texte";
    if (/lecture suivie|oeuvre integrale/.test(t)) return "Étude de l'œuvre intégrale";
    if (/comprehension|remediation/.test(t)) return "Lecture compréhension (remédiation)";
    return "Lecture méthodique";
  }
  function devinerActivites(texte, matiere) {
    const dispo = BASE.matieres[matiere]?.activites || [];
    if (!dispo.length) return ["toutes"];
    const debut = texte.slice(0, 2500);
    const ligne = debut.match(/activit[ée]s?\s*:\s*([^\n|]{2,60})/i);
    const chercher = v => {
      const n = norm(v);
      if (/^lecture\b/.test(n) && dispo.includes("Lecture méthodique")) return activiteLecture(debut);
      return dispo.find(a => { const na = norm(a).replace(/\s*\(.*\)/, ""); return n.includes(na) || na.includes(n.replace(/[.\s]+$/, "")); });
    };
    if (ligne) { const a = chercher(ligne[1]); if (a) return [a]; }
    const nd = norm(debut);
    const comptes = dispo.map(a => [a, nd.split(norm(a).replace(/\s*\(.*\)/, "")).length - 1]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    if (comptes.length) return [comptes[0][0]];
    if (/\blecture\b/i.test(debut) && dispo.includes("Lecture méthodique")) return [activiteLecture(debut)];
    return ["toutes"];
  }
  function devinerType(texte, nom) {
    const debut = norm(nom + " " + texte.slice(0, 600)), large = norm(texte.slice(0, 5000));
    if (/progression/.test(debut)) return "progression";
    if (/programmes? educatifs?|guides? d.execution|modules?\b.*formation|formation des enseignants|instructions officielles/.test(large)) return "guide";
    if (/progression annuelle/.test(norm(texte.slice(0, 2000)))) return "progression";
    if (/fiche de (cours|lecon|preparation)|deroulement|traces? ecrites?|plan du cours|moments? didactiques?/.test(large)) return "modele";
    if (/exercices?|devoir|sujet|epreuve/.test(debut)) return "document";
    return "document";
  }
  function devinerMatiere(texte, defaut) {
    const t = norm(texte.slice(0, 3000));
    if (/\bedhc\b|education aux droits de l.homme/.test(t) && BASE.matieres["EDHC"]) return "EDHC";
    for (const m of Object.keys(BASE.matieres)) if (m !== "Français" && t.includes(norm(m))) return m;
    if (/\bfrancais\b/.test(t) && BASE.matieres["Français"]) return "Français";
    return BASE.matieres[defaut] ? defaut : Object.keys(BASE.matieres)[0];
  }
  function titreSegment(seg, defaut) {
    const lignes = seg.split("\n").map(l => l.replace(/\s+/g, " ").trim());
    // sans les mentions de durée collées au titre (« DUREE : 02 H », « HEURE : 1H »)
    const pris = re => (lignes.find(l => re.test(l)) || "").split(" | ")[0].replace(/\.?\s*(dur[ée]e|heure)\s*:?\s*\d+\s*h.*$/i, "").replace(/[\s.]+$/, "").slice(0, 110);
    const t = [pris(/^le[cç]on\s*\d*\s*:/i), pris(/^s[ée]ance\s*\d*\s*:/i)].filter(Boolean).join(" — ");
    return t || lignes.find(l => l.length > 8 && !/^(date|classe|discipline|minist|r[ée]publique)/i.test(l))?.slice(0, 110) || defaut;
  }

  /* ---------------- Découpage d'un recueil en fiches ---------------- */
  const DELIMITEURS = [
    /^date\s*:/i,
    /^fiche\s+(?:de\s+)?(?:cours|le[cç]on|pr[ée]paration|p[ée]dagogique)\b(?!.*\bfran[cç]ais\b\s*$)/i,
    /^(?:page de garde\b|discipline\s*:)/i,
    /^activit[ée]\s*:[^|/]*$/i,
    /^le[cç]on\s*\d*\s*:[^|/]*$/i
  ];
  function decouper(texte) {
    const L = texte.split("\n");
    for (const re of DELIMITEURS) {
      let idx = L.map((l, i) => re.test(l.trim()) ? i : -1).filter(i => i >= 0);
      if (idx.length < 2) continue;
      // inclure les lignes d'en-tête juste au-dessus (classe, compétence…)
      idx = idx.map(i => { let a = i; while (a > 0 && a > i - 3 && /^(classe|comp[ée]tence|niveau|date)\b/i.test(L[a - 1].trim())) a--; return a; });
      const segs = [];
      if (idx[0] > 0 && L.slice(0, idx[0]).join("\n").trim().length > 600) segs.push(L.slice(0, idx[0]).join("\n"));
      idx.forEach((a, k) => segs.push(L.slice(a, idx[k + 1] ?? L.length).join("\n")));
      // fusionner les morceaux trop courts avec le précédent
      const fusion = [];
      segs.forEach(s => { if (fusion.length && s.trim().length < 600) fusion[fusion.length - 1] += "\n" + s; else fusion.push(s); });
      const tailles = fusion.map(s => s.length).sort((a, b) => a - b);
      if (fusion.length >= 2 && tailles[Math.floor(tailles.length / 2)] >= 800) return fusion.map(s => s.trim());
    }
    return null;
  }
  // Long document non découpé : parties d'environ 10 000 caractères, coupées entre deux paragraphes
  function enParties(texte, taille = 10000) {
    if (texte.length <= taille * 1.4) return [texte];
    const paras = texte.split(/\n(?=\S)/), parts = [];
    let cur = "";
    for (const p of paras) {
      if (cur.length + p.length > taille && cur.length > taille * 0.5) { parts.push(cur); cur = ""; }
      cur += (cur ? "\n" : "") + p;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
  }

  /* ---------------- Brouillons d'import ---------------- */
  const brouillons = new Map();   // id → { id, nom, texte, pages, segments, fichier, etat, msg, info }

  function optionsMatieres(sel) {
    return Object.keys(BASE.matieres).map(m => `<option${m === sel ? " selected" : ""}>${esc(m)}</option>`).join("") + `<option value="__nouvelle">＋ Nouvelle matière…</option>`;
  }
  function cases(nomGroupe, valeurs, coches) {
    const toutes = coches.includes("toutes");
    return [`<label class="choix"><input type="checkbox" name="${nomGroupe}" value="toutes"${toutes ? " checked" : ""}><span>Toutes</span></label>`]
      .concat(valeurs.map(v => `<label class="choix"><input type="checkbox" name="${nomGroupe}" value="${esc(v)}"${!toutes && coches.includes(v) ? " checked" : ""}><span>${esc(v)}</span></label>`)).join("");
  }
  const lireCases = (el, nom) => { const v = [...el.querySelectorAll(`input[name="${nom}"]:checked`)].map(i => i.value); return !v.length || v.includes("toutes") ? ["toutes"] : v; };

  function rendreBrouillon(b) {
    let el = document.querySelector(`.brouillon[data-id="${b.id}"]`);
    if (!el) {
      el = document.createElement("div"); el.className = "brouillon"; el.dataset.id = b.id;
      $("#brouillons").prepend(el);
    }
    const prete = b.etat === "pret";
    const info = b.info || {};
    const cfg = BASE.matieres[info.matiere] || { classes: CLASSES_DEFAUT, activites: [] };
    const nbSeg = b.segments?.length || 0;
    el.innerHTML = `
      <div class="b-tete">
        <div class="b-nom"><strong>${esc(b.nom)}</strong><span class="b-etat ${b.etat}">${esc(b.msg || "")}</span></div>
        <button type="button" class="b-retirer" aria-label="Retirer">✕</button>
      </div>
      ${b.etat === "erreur" ? `<p class="b-erreur">${esc(b.erreur || "")}</p>` : ""}
      ${b.etat === "lecture" ? `<div class="etat"><span class="rond"></span><span>${esc(b.msg || "Lecture…")}</span></div>` : ""}
      ${prete ? `
      <p class="meta">${nb(b.texte.length)} caractères${b.pages ? ` · ${b.pages} page${b.pages > 1 ? "s" : ""}` : ""}${b.ia ? " · lu automatiquement" : b.local ? " · reconnu sur le téléphone" : ""}</p>
      ${b.scanne ? `<div class="b-alerte">Ce PDF contient très peu de texte : c'est sûrement un document scanné.
         <div class="grille2"><button type="button" class="secondaire b-local">Lire sur le téléphone</button><button type="button" class="secondaire b-ia"${API.nettoyerCle(API.reglages().geminiCle) ? "" : " disabled title=\"Clé Gemini nécessaire\""}>Lire en ligne (Gemini)</button></div></div>` : ""}
      ${b.local ? `<p class="b-conseil">Texte reconnu sur le téléphone : relis-le (touche « Voir ou corriger le texte ») avant de l'ajouter. Certaines lettres ou certains tableaux peuvent être mal rendus.</p>` : ""}
      ${nbSeg ? `<div class="b-decoupe">
         <label class="valider"><input type="checkbox" class="b-decouper" ${b.decouper !== false ? "checked" : ""}><span>Ce document contient <strong>${nbSeg} parties</strong> (fiches ou leçons) : les ajouter séparément (recommandé)</span></label>
         <p class="meta">Chaque partie reçoit son titre, sa classe et son activité reconnus automatiquement. Les choix ci-dessous servent quand l'appli ne les reconnaît pas.</p>
         <ul class="b-apercu">${b.segments.slice(0, 6).map(s => `<li>${esc(s.titre)} <small>· ${esc(s.classes.join(", "))} · ${esc(s.activites.join(", "))}</small></li>`).join("")}${nbSeg > 6 ? `<li><small>… et ${nbSeg - 6} autres</small></li>` : ""}</ul>
       </div>` : (b.texte.length > 14000 && info.type !== "progression" ? `<label class="valider"><input type="checkbox" class="b-parties" ${b.parties !== false ? "checked" : ""}><span>Long document : le ranger en parties d'environ 10 000 caractères (le bon passage sera plus facile à retrouver)</span></label>` : "")}
      <label>Titre<input class="b-titre" value="${esc(info.titre || "")}"></label>
      <div class="grille2">
        <label>Matière<select class="b-matiere">${optionsMatieres(info.matiere)}</select></label>
        <label>Type<select class="b-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${k === info.type ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      <fieldset class="b-groupe"><legend>Classes</legend><div class="choix-liste">${cases("cl-" + b.id, cfg.classes, info.classes || ["toutes"])}</div></fieldset>
      <fieldset class="b-groupe"><legend>Activités</legend><div class="choix-liste">${cases("ac-" + b.id, cfg.activites, info.activites || ["toutes"])}</div></fieldset>
      <details class="plus"><summary>Voir ou corriger le texte ${b.ia || b.local ? "lu automatiquement" : "extrait"}</summary>
        <textarea class="b-texte" rows="10">${esc(b.texte)}</textarea></details>
      <button type="button" class="principal b-ajouter">${b.edition ? "Enregistrer les modifications" : nbSeg && b.decouper !== false ? `Ajouter les ${nbSeg} parties à la base` : "Ajouter à la base"}</button>` : ""}`;
    lierBrouillon(el, b);
  }
  function lireFormulaire(el, b) {
    b.info = {
      titre: el.querySelector(".b-titre").value.trim() || b.nom,
      matiere: el.querySelector(".b-matiere").value,
      type: el.querySelector(".b-type").value,
      classes: lireCases(el, "cl-" + b.id),
      activites: lireCases(el, "ac-" + b.id)
    };
    b.texte = el.querySelector(".b-texte").value;
    const d = el.querySelector(".b-decouper"); if (d) b.decouper = d.checked;
    const p = el.querySelector(".b-parties"); if (p) b.parties = p.checked;
  }
  function lierBrouillon(el, b) {
    el.querySelector(".b-retirer").onclick = () => { brouillons.delete(b.id); el.remove(); majCompteBrouillons(); };
    if (b.etat !== "pret") return;
    // cases « Toutes » exclusives
    el.querySelectorAll(".choix-liste").forEach(g => g.addEventListener("change", e => {
      if (e.target.value === "toutes" && e.target.checked) g.querySelectorAll("input").forEach(i => { if (i !== e.target) i.checked = false; });
      else if (e.target.checked) { const t = g.querySelector('input[value="toutes"]'); if (t) t.checked = false; }
    }));
    el.querySelector(".b-matiere").onchange = async e => {
      if (e.target.value === "__nouvelle") {
        const m = await nouvelleMatiere();
        if (!m) { e.target.value = b.info.matiere; return; }
        e.target.innerHTML = optionsMatieres(m);
      }
      lireFormulaire(el, b);
      b.info.classes = devinerClasses(b.texte, b.info.matiere);
      b.info.activites = devinerActivites(b.texte, b.info.matiere);
      if (b.segments) b.segments = analyserSegments(b.segments.map(s => s.texte), b.info);
      rendreBrouillon(b);
    };
    el.querySelector(".b-type").onchange = () => { lireFormulaire(el, b); rendreBrouillon(b); };
    const dc = el.querySelector(".b-decouper"); if (dc) dc.onchange = () => { lireFormulaire(el, b); rendreBrouillon(b); };
    const ia = el.querySelector(".b-ia"); if (ia) ia.onclick = () => relireAvecIA(b);
    const lo = el.querySelector(".b-local"); if (lo) lo.onclick = () => relireAvecIA(b, true);
    el.querySelector(".b-ajouter").onclick = async e => {
      lireFormulaire(el, b);
      e.target.disabled = true; e.target.textContent = "Ajout…";
      try {
        const n = await enregistrerBrouillon(b);
        brouillons.delete(b.id);
        el.outerHTML = `<p class="ok b-fait">✓ ${esc(b.nom)} : ${n} document${n > 1 ? "s" : ""} ${b.edition ? "mis à jour" : "ajouté" + (n > 1 ? "s" : "") + " à la base"}.</p>`;
        majCompteBrouillons(); apresChangement();
      } catch (err) { alert("L'ajout a échoué.\n\n" + err.message); e.target.disabled = false; e.target.textContent = "Ajouter à la base"; }
    };
  }
  function analyserSegments(textes, info) {
    const dispo = (BASE.matieres[info.matiere]?.classes) || CLASSES_DEFAUT;
    return textes.map((t, i) => ({
      texte: t,
      titre: titreSegment(t, `${info.titre} (${i + 1})`),
      // classe : celle écrite dans la fiche, sinon celle du document entier, sinon celle devinée dans la fiche
      classes: classesExplicites(t, dispo) || (info.classes[0] !== "toutes" ? info.classes : devinerClasses(t, info.matiere, 3000)),
      activites: (a => a[0] === "toutes" ? info.activites : a)(devinerActivites(t, info.matiere))
    }));
  }
  function preparerInfos(b) {
    const matiere = devinerMatiere(b.texte, $("#matiere").value);
    b.info = {
      titre: sansExtension(b.nom), matiere,
      type: devinerType(b.texte, b.nom),
      classes: devinerClasses(b.texte, matiere),
      activites: devinerActivites(b.texte, matiere)
    };
    const segs = b.info.type === "progression" ? null : decouper(b.texte);
    b.segments = segs ? analyserSegments(segs, b.info) : null;
    if (b.segments) b.info.type = b.info.type === "document" ? "modele" : b.info.type;
  }
  async function traiterFichier(fichier) {
    const b = { id: idNouveau(), nom: fichier.name, fichier, etat: "lecture", msg: "Lecture…" };
    brouillons.set(b.id, b); rendreBrouillon(b); majCompteBrouillons();
    try {
      const r = await extraire(fichier, m => { b.msg = m; const s = document.querySelector(`.brouillon[data-id="${b.id}"] .etat span:last-child`); if (s) s.textContent = m; });
      Object.assign(b, { texte: nettoyer(r.texte || ""), pages: r.pages, scanne: !!r.scanne, ia: !!r.ia, local: !!r.local });
      if (!b.texte && !b.scanne) throw new Error("Aucun texte trouvé dans ce fichier.");
      preparerInfos(b);
      b.etat = "pret"; b.msg = b.scanne ? "à lire automatiquement" : "à vérifier";
    } catch (err) {
      console.error(err);
      b.etat = "erreur"; b.msg = "erreur"; b.erreur = err.message;
    }
    rendreBrouillon(b);
  }
  async function relireAvecIA(b, local = false) {
    b.etat = "lecture"; b.msg = "Lecture automatique…"; rendreBrouillon(b);
    try {
      const suivi = m => { const s = document.querySelector(`.brouillon[data-id="${b.id}"] .etat span:last-child`); if (s) s.textContent = m; };
      const r = local ? await lirePdfLocal(b.fichier, suivi) : await lirePdfAvecIA(b.fichier, suivi);
      Object.assign(b, { texte: nettoyer(r.texte), scanne: false, ia: !local, local });
      preparerInfos(b);
      b.etat = "pret"; b.msg = "à vérifier";
    } catch (err) { b.etat = "erreur"; b.msg = "erreur"; b.erreur = err.message; }
    rendreBrouillon(b);
  }
  async function enregistrerBrouillon(b) {
    const { titre, matiere, type, classes, activites } = b.info;
    const base = { matiere, type, perso: true, source: b.nom, date: new Date().toISOString() };
    let docs;
    if (b.edition) {
      docs = [{ ...base, id: b.edition, titre, classes, activites, contenu: b.texte.trim() }];
    } else if (b.segments && b.decouper !== false) {
      // le texte a pu être corrigé à la main : on redécoupe le texte final
      const segs = analyserSegments(decouper(b.texte) || [b.texte], b.info);
      docs = segs.map(s => ({ ...base, id: idNouveau(), titre: `${s.titre}`, classes: s.classes, activites: s.activites, contenu: s.texte }));
    } else if (b.parties !== false && b.texte.length > 14000 && type !== "progression") {
      const parts = enParties(b.texte);
      docs = parts.map((p, i) => ({ ...base, id: idNouveau(), titre: `${titre} — partie ${i + 1}/${parts.length}` + ((l => l ? ` (${l})` : "")(p.split("\n").find(l => l.trim().length > 10)?.trim().slice(0, 60))), classes, activites, contenu: p.trim() }));
    } else {
      docs = [{ ...base, id: idNouveau(), titre, classes, activites, contenu: b.texte.trim() }];
    }
    docs.forEach(d => { if (!d.contenu) throw new Error("Le texte est vide."); });
    await mettre("docs", docs);
    docs.forEach(d => {
      const i = BASE.docs.findIndex(x => x.id === d.id);
      i >= 0 ? BASE.docs.splice(i, 1, d) : BASE.docs.push(d);
    });
    SAUVEGARDE.modifie();
    return docs.length;
  }
  function majCompteBrouillons() {
    const n = [...brouillons.values()].filter(b => b.etat === "pret").length;
    $("#tout-ajouter").hidden = n < 2;
    $("#tout-ajouter").textContent = `Tout ajouter (${n} fichiers)`;
  }

  /* ---------------- Matières ajoutées ---------------- */
  async function nouvelleMatiere() {
    const nom = (prompt("Nom de la nouvelle matière (ex. : Histoire-Géographie, Anglais, SVT) :") || "").trim();
    if (!nom) return null;
    if (BASE.matieres[nom]) return nom;
    const acts = (prompt("Activités de cette matière, séparées par des virgules :", ACTIVITES_DEFAUT.join(", ")) || "").split(",").map(s => s.trim()).filter(Boolean);
    const cfg = { nom, classes: CLASSES_DEFAUT, activites: acts.length ? acts : ACTIVITES_DEFAUT };
    await mettre("matieres", cfg);
    BASE.definirMatiere(nom, { classes: cfg.classes, activites: cfg.activites });
    const fmt = { id: "perso-format-" + norm(nom).replace(/[^a-z0-9]+/g, "-"), matiere: nom, type: "format", perso: true, classes: ["toutes"], activites: ["toutes"],
      titre: `Format de fiche — ${nom} (générique, à remplacer par ton format officiel)`, contenu: FORMAT_GENERIQUE(nom), date: new Date().toISOString() };
    await mettre("docs", fmt); BASE.docs.push(fmt); SAUVEGARDE.modifie();
    rafraichirFormulaire();
    return nom;
  }
  function rafraichirFormulaire() {
    const sel = $("#matiere"), avant = sel.value;
    remplirSelect(sel, Object.keys(BASE.matieres), true);
    if (avant !== sel.value || true) sel.onchange && sel.onchange();
  }

  /* ---------------- Liste « Mes documents » ---------------- */
  function afficherListe() {
    const mes = BASE.docs.filter(d => d.perso).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    $("#mes-compte").textContent = mes.length ? `${mes.length} document${mes.length > 1 ? "s" : ""} ajouté${mes.length > 1 ? "s" : ""} sur cet appareil` : "Aucun document ajouté pour l'instant.";
    $("#mes-liste").innerHTML = mes.slice(0, 300).map(d => `
      <li><div class="m-info"><strong>${esc(d.titre)}</strong>
        <small>${esc(d.matiere)} · ${esc(TYPES[d.type] || d.type)} · ${esc(d.classes.join(", "))} · ${esc(d.activites.join(", "))} · ${nb(d.contenu.length)} car.</small></div>
        <button type="button" class="m-modif" data-id="${esc(d.id)}">Modifier</button>
        <button type="button" class="suppr m-suppr" data-id="${esc(d.id)}" aria-label="Supprimer">✕</button></li>`).join("");
    $("#mes-outils").hidden = !mes.length;
  }
  async function supprimer(id) {
    await enlever("docs", id); SAUVEGARDE.modifie();
    const i = BASE.docs.findIndex(d => d.id === id); if (i >= 0) BASE.docs.splice(i, 1);
    apresChangement();
  }
  function modifier(id) {
    const d = BASE.docs.find(x => x.id === id); if (!d) return;
    const b = { id: idNouveau(), nom: d.titre, texte: d.contenu, etat: "pret", msg: "modification", edition: d.id,
      info: { titre: d.titre, matiere: d.matiere, type: d.type, classes: d.classes, activites: d.activites } };
    brouillons.set(b.id, b); rendreBrouillon(b);
    document.querySelector(`.brouillon[data-id="${b.id}"]`).scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function apresChangement() {
    afficherListe();
    if (!$("#vue-base").hidden) baseOriginale();
    if (typeof remplirModeles === "function") remplirModeles();
  }

  /* ---------------- Sauvegarde / restauration / export ---------------- */
  const contenuSauvegarde = () => SAUVEGARDE.contenu();
  async function sauvegarder() {
    const s = await contenuSauvegarde();
    if (!s.docs.length && !s.fiches.length) return alert("Rien à sauvegarder pour l'instant.");
    telecharger(JSON.stringify(s), `fiches-cours-sauvegarde-${s.date.slice(0, 10)}.json`, "application/json");
  }
  async function restaurer(fichier) {
    let s;
    try { s = JSON.parse(await fichier.text()); } catch { return alert("Ce fichier n'est pas une sauvegarde valide."); }
    try { alert("Restauré : " + SAUVEGARDE.resume(await SAUVEGARDE.appliquer(s)) + "."); }
    catch (err) { alert(err.message); }
  }
  async function exporterPourCode() {
    const s = await contenuSauvegarde();
    if (!s.docs.length) return alert("Aucun document à exporter.");
    const lignes = [`/* MES DOCUMENTS — exportés depuis l'appli le ${new Date().toLocaleDateString("fr-FR")}.
   Remplace le fichier base/mes-documents.js du site par celui-ci, puis redéploie :
   ces documents seront alors intégrés au code et disponibles sur tous les appareils. */`];
    s.matieres.forEach(m => lignes.push(`if (!BASE.matieres[${JSON.stringify(m.nom)}]) BASE.definirMatiere(${JSON.stringify(m.nom)}, ${JSON.stringify({ classes: m.classes, activites: m.activites })});`));
    s.docs.forEach(d => { const { perso, ...reste } = d; lignes.push("BASE.ajouter(" + JSON.stringify({ ...reste, integre: true }, null, 1) + ");"); });
    telecharger(lignes.join("\n\n") + "\n", "mes-documents.js", "text/javascript");
  }

  /* ---------------- Coller un texte ---------------- */
  function collerTexte() {
    const b = { id: idNouveau(), nom: "Texte collé", texte: "", etat: "pret", msg: "colle ton texte ci-dessous" };
    b.info = { titre: "", matiere: $("#matiere").value, type: "document", classes: ["toutes"], activites: ["toutes"] };
    brouillons.set(b.id, b); rendreBrouillon(b);
    const el = document.querySelector(`.brouillon[data-id="${b.id}"]`);
    el.querySelector("details").open = true;
    const ta = el.querySelector(".b-texte");
    ta.placeholder = "Colle ici le texte (fiche, progression, cours, sujet…)";
    // dès que du texte est collé, l'appli propose un classement
    ta.addEventListener("change", () => {
      if (!ta.value.trim() || b.info.titre) return;
      b.texte = nettoyer(ta.value); b.nom = "Texte collé";
      preparerInfos(b); b.info.titre = titreSegment(b.texte, "Texte collé"); rendreBrouillon(b);
      document.querySelector(`.brouillon[data-id="${b.id}"] details`).open = true;
    }, { once: true });
    ta.focus();
  }

  /* ---------------- Texte venu du scanner ---------------- */
  function ajouterTexte(nom, texte, o = {}) {
    const b = { id: idNouveau(), nom, texte: nettoyer(texte), pages: o.pages, ia: !!o.ia, local: !o.ia, etat: "pret", msg: "à vérifier" };
    brouillons.set(b.id, b);
    preparerInfos(b);
    b.info.titre = titreSegment(b.texte, nom);
    rendreBrouillon(b); majCompteBrouillons();
    const e = document.querySelector(`.brouillon[data-id="${b.id}"]`);
    if (b.local) e.querySelector("details").open = true;
    e.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- Démarrage ---------------- */
  let baseOriginale = null;
  async function init() {
    // La liste « Mes documents » est rafraîchie à chaque ouverture de l'onglet Base
    baseOriginale = afficherBase;
    afficherBase = function () { baseOriginale(); afficherListe(); };

    $("#fichiers-ajout").addEventListener("change", e => {
      const fichiers = [...e.target.files]; e.target.value = "";
      const images = fichiers.filter(f => f.type.startsWith("image/"));
      const autres = fichiers.filter(f => !f.type.startsWith("image/"));
      autres.forEach(traiterFichier);
      // plusieurs photos d'un même document : un seul brouillon, lu en une fois par l'IA
      if (images.length > 1 && confirm(`${images.length} photos sélectionnées.\nOK : ce sont les pages d'un même document (lues ensemble).\nAnnuler : un document par photo.`)) {
        const b = { id: idNouveau(), nom: `${images.length} photos`, etat: "lecture", msg: "Lecture…" };
        brouillons.set(b.id, b); rendreBrouillon(b);
        lireImages(images, m => { const s = document.querySelector(`.brouillon[data-id="${b.id}"] .etat span:last-child`); if (s) s.textContent = m; })
          .then(r => { Object.assign(b, { texte: nettoyer(r.texte), pages: r.pages, ia: r.ia, local: r.local }); preparerInfos(b); b.etat = "pret"; b.msg = "à vérifier"; })
          .catch(err => { b.etat = "erreur"; b.msg = "erreur"; b.erreur = err.message; })
          .finally(() => rendreBrouillon(b));
      } else images.forEach(traiterFichier);
    });
    $("#coller-texte").onclick = collerTexte;
    $("#scanner-ouvrir").onclick = () => SCANNER.ouvrir();
    $("#tout-ajouter").onclick = async () => {
      for (const el of $$(".brouillon")) { const btn = el.querySelector(".b-ajouter"); if (btn) { btn.click(); await new Promise(r => setTimeout(r, 150)); } }
    };
    $("#mes-liste").addEventListener("click", e => {
      const m = e.target.closest(".m-modif"), s = e.target.closest(".m-suppr");
      if (m) modifier(m.dataset.id);
      if (s && confirm("Supprimer ce document de la base ?")) supprimer(s.dataset.id);
    });
    $("#mes-tout-suppr").onclick = async () => {
      if (!confirm("Supprimer TOUS les documents ajoutés sur cet appareil ? (Pense à faire une sauvegarde avant.)")) return;
      for (const d of BASE.docs.filter(x => x.perso)) await enlever("docs", d.id);
      for (let i = BASE.docs.length - 1; i >= 0; i--) if (BASE.docs[i].perso) BASE.docs.splice(i, 1);
      SAUVEGARDE.modifie(); apresChangement();
    };
    $("#sauvegarder").onclick = sauvegarder;
    $("#exporter-code").onclick = exporterPourCode;
    $("#restaurer").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) restaurer(f); });

    window.addEventListener("donnees-restaurees", () => { rafraichirFormulaire(); apresChangement(); });

    // Chargement des documents et matières ajoutés sur cet appareil
    try {
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      const [matieres, docs] = await Promise.all([tous("matieres"), tous("docs")]);
      matieres.forEach(m => { if (!BASE.matieres[m.nom]) BASE.definirMatiere(m.nom, { classes: m.classes, activites: m.activites }); });
      const dejaLa = new Set(BASE.docs.map(d => d.id));      // un document déjà intégré au code n'est pas chargé deux fois
      docs.forEach(d => { if (!dejaLa.has(d.id)) BASE.docs.push({ ...d, perso: true }); });
      if (matieres.length) rafraichirFormulaire();
      if (docs.length && typeof remplirModeles === "function") remplirModeles();
      if (!$("#vue-base").hidden) afficherBase();
    } catch (err) {
      console.warn("Mes documents indisponibles :", err);
      $("#mes-compte").textContent = "Le stockage local n'est pas disponible dans ce navigateur (navigation privée ?).";
    }
  }
  return { init, ajouterTexte, extraire, decouper, devinerClasses, devinerActivites, devinerType, htmlVersTexte, lignesPage, enParties };
})();
MESDOCS.init();
