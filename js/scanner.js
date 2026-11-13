/* =====================================================================
   SCANNER — numériser un support de cours page par page, puis lire le texte (OCR)
   - Photos prises une à une (appareil photo) ou choisies dans la galerie
   - Pages réordonnables, pivotables, supprimables ; « effet scan » (fond blanc, ombres atténuées)
   - Lecture : sur le téléphone (Tesseract, hors connexion après la 1re fois)
               ou en ligne (Gemini, plus fidèle pour les tableaux) ; « Automatique » choisit
   SCANNER.ouvrir({ titre, aide, texte, quand }) · SCANNER.lire(canvases, { mode, onEtat, texte }) → { texte, ia, local }
   (texte : true = texte continu à reproduire tel quel, ex. texte support : retours à la ligne gardés, pas de colonnes « | »)
   Dépend de app.js ($, esc), api.js (API), mesdocs.js (MESDOCS.ajouterTexte).
   ===================================================================== */
const SCANNER = (() => {
  const MAX = 2200;                       // plus grand côté conservé (px)
  let pages = [], el = null, occupe = false, cible = null;   // cible : { titre, aide, texte (bool), quand(texte, r) }
  const cle = () => { try { return API.nettoyerCle(API.reglages().geminiCle); } catch { return ""; } };

  /* ---------- Images ---------- */
  async function charger(fichier) {
    let img;
    try { img = await createImageBitmap(fichier, { imageOrientation: "from-image" }); }
    catch {
      img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image illisible (format non pris en charge ?)")); i.src = URL.createObjectURL(fichier); });
    }
    const k = Math.min(1, MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    img.close && img.close();
    return c;
  }
  function pivoter(src, quarts) {
    const q = ((quarts % 4) + 4) % 4;
    if (!q) return src;
    const c = document.createElement("canvas");
    c.width = q % 2 ? src.height : src.width; c.height = q % 2 ? src.width : src.height;
    const x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2); x.rotate(q * Math.PI / 2);
    x.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }
  // Effet scan : niveaux de gris, fond (ombres, lumière inégale) ramené au blanc, contraste étiré
  function ameliorer(src) {
    const w = src.width, h = src.height;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    // fond estimé : image très réduite puis agrandie (flou large)
    const f = document.createElement("canvas"); f.width = Math.max(8, Math.round(w / 28)); f.height = Math.max(8, Math.round(h / 28));
    const fx = f.getContext("2d"); fx.imageSmoothingQuality = "high"; fx.drawImage(src, 0, 0, f.width, f.height);
    const g = document.createElement("canvas"); g.width = w; g.height = h;
    const gx = g.getContext("2d", { willReadFrequently: true }); gx.imageSmoothingQuality = "high"; gx.filter = "blur(6px)"; gx.drawImage(f, 0, 0, w, h);
    const fond = gx.getImageData(0, 0, w, h).data;
    const hist = new Uint32Array(256), gris = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) {
      const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const b = 0.299 * fond[i] + 0.587 * fond[i + 1] + 0.114 * fond[i + 2];
      const v = Math.min(255, l / Math.max(b, 30) * 245);
      gris[j] = v; hist[gris[j]]++;
    }
    // étirement : 1 % le plus sombre → noir, fond → blanc
    const n = w * h; let cumul = 0, bas = 0, haut = 255;
    for (let v = 0; v < 256; v++) { cumul += hist[v]; if (cumul > n * 0.01) { bas = v; break; } }
    cumul = 0; for (let v = 255; v >= 0; v--) { cumul += hist[v]; if (cumul > n * 0.35) { haut = v; break; } }
    const e = 255 / Math.max(20, haut - bas);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) {
      const v = Math.max(0, Math.min(255, (gris[j] - bas) * e));
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function finale(pg, avecEffet) {
    const k = pg.rot + "|" + avecEffet;
    if (pg.cache?.k === k) return pg.cache.c;
    let c = pivoter(pg.src, pg.rot);
    if (avecEffet) c = ameliorer(c);
    pg.cache = { k, c };
    return c;
  }
  const effet = () => !el || el.querySelector("#sc-effet").checked;

  /* ---------- Lecture sur le téléphone (Tesseract) ---------- */
  let worker = null;
  const url = p => new URL(p, location.href).href;
  function chargerScript(src) {
    return new Promise((ok, ko) => {
      if (window.Tesseract) return ok();
      const s = document.createElement("script"); s.src = src;
      s.onload = ok; s.onerror = () => ko(new Error("Le module de lecture n'a pas pu être chargé. Connecte-toi une première fois pour l'installer."));
      document.head.appendChild(s);
    });
  }
  async function moteur(onEtat) {
    if (worker) return worker;
    onEtat && onEtat("Préparation de la lecture sur le téléphone…");
    await chargerScript(url("vendor/tesseract/tesseract.min.js"));
    let suivi = null;
    worker = await Tesseract.createWorker("fra", 1, {
      workerPath: url("vendor/tesseract/worker.min.js"),
      corePath: url("vendor/tesseract/core/"),
      langPath: url("vendor/tesseract/lang"),
      gzip: false, workerBlobURL: false,
      logger: m => suivi && suivi(m),
      errorHandler: e => console.warn("Lecture :", e)
    });
    worker.suivre = f => { suivi = f; };
    await worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
    return worker;
  }
  async function lireLocal(canvases, onEtat, texteSeul) {
    const w = await moteur(onEtat), morceaux = [];
    for (let i = 0; i < canvases.length; i++) {
      const tete = canvases.length > 1 ? `Page ${i + 1}/${canvases.length}` : "Lecture";
      w.suivre(m => { if (m.status === "recognizing text") onEtat && onEtat(`${tete} : ${Math.round(m.progress * 100)} %`); });
      onEtat && onEtat(`${tete}…`);
      const { data } = await w.recognize(canvases[i]);
      morceaux.push(remettreEnForme(data.text || "", texteSeul));
    }
    w.suivre(null);
    return morceaux.filter(Boolean).join("\n\n");
  }
  // mots coupés en fin de ligne, espaces multiples, lignes vides en trop
  // numéros de ligne du livre (5, 10, 15… en marge) : retirés s'ils tombent sur la bonne ligne (l'appli renumérote)
  function sansNumeros(t) {
    let k = 0;
    return t.split("\n").map(l => {
      if (!l.trim()) return l;
      k++;
      const m = l.match(/^\s*(\d{1,3})\s+(\S.*)$/);
      return m && +m[1] % 5 === 0 && Math.abs(+m[1] - k) <= 2 ? m[2] : l;
    }).join("\n");
  }
  // texte support : numéros de page ou de ligne isolés retirés, pas de séparateur de colonnes
  const remettreEnForme = (t, texteSeul) => {
    t = t.replace(/\r/g, "").replace(/([a-zà-ÿ])-\n([a-zà-ÿ])/g, "$1$2");
    t = texteSeul ? sansNumeros(t.replace(/^[ \t]*\d{1,3}[ \t]*$/gm, "").replace(/[ \t]+/g, " ")) : t.replace(/[ \t]{3,}/g, " | ").replace(/[ \t]+/g, " ");
    return t.replace(/^ +| +$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  };

  /* ---------- Lecture en ligne (Gemini) ---------- */
  async function lireEnLigne(canvases, onEtat) {
    const morceaux = [], n = canvases.length;
    for (let debut = 0; debut < n; debut += 4) {
      const fin = Math.min(n, debut + 4), parties = [];
      for (let i = debut; i < fin; i++) {
        parties.push({ text: `Page ${i + 1} :` }, { inline_data: { mime_type: "image/jpeg", data: canvases[i].toDataURL("image/jpeg", 0.82).split(",")[1] } });
      }
      parties.push({ text: n > 1 ? `Transcris les pages ${debut + 1} à ${fin}, dans l'ordre.` : "Transcris cette page." });
      onEtat && onEtat(n > 1 ? `Lecture des pages ${debut + 1} à ${fin} sur ${n}…` : "Lecture…");
      morceaux.push(await API.transcrire(parties, () => {}));
    }
    return morceaux.join("\n\n");
  }

  /* ---------- Choix du mode ---------- */
  async function lire(canvases, { mode = "auto", onEtat, texte: texteSeul = false } = {}) {
    const enLignePossible = !!cle() && navigator.onLine !== false;
    if (mode === "enligne" && !cle()) throw new Error("La lecture en ligne utilise ta clé Gemini : ajoute-la dans Réglages, ou choisis « Sur le téléphone ».");
    if (mode === "enligne" || (mode === "auto" && enLignePossible)) {
      try { return { texte: await lireEnLigne(canvases, onEtat), ia: true }; }
      catch (e) {
        if (mode === "enligne") throw e;
        console.warn("Lecture en ligne impossible, lecture sur le téléphone :", e);
        onEtat && onEtat("Lecture en ligne indisponible : lecture sur le téléphone…");
      }
    }
    try { return { texte: await lireLocal(canvases, onEtat, texteSeul), local: true }; }
    finally { if (worker) { worker.terminate().catch(() => {}); worker = null; } }
  }

  /* ---------- Interface ---------- */
  function construire() {
    el = document.createElement("div");
    el.id = "scanner"; el.className = "scanner"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Scanner un document");
    el.innerHTML = `
      <div class="sc-tete">
        <h2 id="sc-titre">Scanner un document</h2>
        <button type="button" class="sc-fermer" aria-label="Fermer">✕</button>
      </div>
      <div class="sc-corps">
        <p class="astuce sc-aide" id="sc-aide">Photographie les pages <strong>une par une, dans l'ordre</strong>, bien à plat, sous une bonne lumière, en cadrant au plus près de la feuille. Tu peux ensuite les réordonner, les pivoter ou les retirer.</p>
        <div class="sc-pages" id="sc-pages"></div>
        <div class="sc-ajout">
          <label class="bouton-fichier principal">Photographier une page
            <input type="file" id="sc-photo" accept="image/*" capture="environment">
          </label>
          <label class="bouton-fichier secondaire">Depuis la galerie
            <input type="file" id="sc-galerie" accept="image/*" multiple>
          </label>
        </div>
        <label class="valider sc-opt"><input type="checkbox" id="sc-effet" checked><span>Effet scan : fond blanc, ombres atténuées</span></label>
        <fieldset class="champ">
          <legend>Lecture du texte</legend>
          <div class="segments petit sc-mode" role="radiogroup" aria-label="Lecture du texte">
            <label class="segment"><input type="radio" name="sc-mode" value="auto" checked><span>Automatique</span></label>
            <label class="segment"><input type="radio" name="sc-mode" value="local"><span>Sur le téléphone</span></label>
            <label class="segment"><input type="radio" name="sc-mode" value="enligne"><span>En ligne</span></label>
          </div>
          <p class="meta" id="sc-mode-aide"></p>
        </fieldset>
        <div class="etat" id="sc-etat" hidden><span class="rond"></span><span></span></div>
      </div>
      <div class="sc-pied">
        <button type="button" class="principal" id="sc-lire" disabled>Lire le texte</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector(".sc-fermer").onclick = fermer;
    el.querySelector("#sc-photo").addEventListener("change", e => ajouterFichiers(e));
    el.querySelector("#sc-galerie").addEventListener("change", e => ajouterFichiers(e));
    el.querySelector("#sc-effet").onchange = dessiner;
    el.querySelectorAll('input[name="sc-mode"]').forEach(r => r.onchange = aideMode);
    el.querySelector("#sc-lire").onclick = lancer;
    el.querySelector("#sc-pages").addEventListener("click", e => {
      const b = e.target.closest("button[data-act]"); if (!b || occupe) return;
      const i = +b.closest(".sc-page").dataset.i, act = b.dataset.act;
      if (act === "pivoter") pages[i].rot = (pages[i].rot + 1) % 4;
      else if (act === "avant" && i > 0) [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]];
      else if (act === "apres" && i < pages.length - 1) [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]];
      else if (act === "retirer") pages.splice(i, 1);
      dessiner();
    });
  }
  function aideMode() {
    const m = el.querySelector('input[name="sc-mode"]:checked').value, k = !!cle();
    el.querySelector("#sc-mode-aide").textContent = {
      auto: k ? "En ligne quand la connexion le permet (plus fidèle pour les tableaux), sinon sur le téléphone." : "Sur le téléphone (aucune clé Gemini enregistrée).",
      local: "Sans connexion ni clé. La première fois, le module de lecture (environ 5 Mo) se télécharge ; ensuite il fonctionne hors connexion. Les tableaux sont rendus en texte simple.",
      enligne: k ? "Avec ta clé Gemini : plus fidèle pour les tableaux et les mises en page complexes." : "Nécessite une clé Gemini (Réglages)."
    }[m];
  }
  async function ajouterFichiers(e) {
    const fichiers = [...e.target.files]; e.target.value = "";
    if (!fichiers.length) return;
    etat(`Préparation de ${fichiers.length > 1 ? fichiers.length + " pages" : "la page"}…`);
    for (const f of fichiers) {
      try { pages.push({ src: await charger(f), rot: 0 }); }
      catch (err) { alert(f.name + " : " + err.message); }
    }
    etat(""); dessiner();
    const liste = el.querySelector("#sc-pages"); liste.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function dessiner() {
    const liste = el.querySelector("#sc-pages"), avec = effet();
    liste.innerHTML = pages.length ? "" : `<p class="sc-vide">Aucune page pour l'instant.</p>`;
    pages.forEach((pg, i) => {
      const fig = document.createElement("figure");
      fig.className = "sc-page"; fig.dataset.i = i;
      const c = finale(pg, avec), mini = document.createElement("canvas");
      const k = 360 / Math.max(c.width, c.height);
      mini.width = Math.round(c.width * k); mini.height = Math.round(c.height * k);
      mini.getContext("2d").drawImage(c, 0, 0, mini.width, mini.height);
      fig.appendChild(mini);
      fig.insertAdjacentHTML("beforeend", `<figcaption>Page ${i + 1}</figcaption>
        <div class="sc-outils">
          <button type="button" data-act="avant" aria-label="Avancer la page"${i ? "" : " disabled"}>‹</button>
          <button type="button" data-act="pivoter" aria-label="Pivoter la page">↻</button>
          <button type="button" data-act="apres" aria-label="Reculer la page"${i < pages.length - 1 ? "" : " disabled"}>›</button>
          <button type="button" data-act="retirer" class="sc-suppr" aria-label="Retirer la page">✕</button>
        </div>`);
      liste.appendChild(fig);
    });
    const b = el.querySelector("#sc-lire");
    b.disabled = !pages.length || occupe;
    b.textContent = pages.length > 1 ? `Lire les ${pages.length} pages` : "Lire le texte";
  }
  function etat(t) {
    const e = el.querySelector("#sc-etat");
    e.hidden = !t; e.querySelector("span:last-child").textContent = t || "";
  }
  async function lancer() {
    if (!pages.length || occupe) return;
    occupe = true; dessiner();
    const mode = el.querySelector('input[name="sc-mode"]:checked').value;
    try {
      const avec = effet();
      const toiles = pages.map(pg => finale(pg, avec));
      const r = await lire(toiles, { mode, onEtat: etat, texte: !!cible?.texte });
      if (!r.texte.trim()) throw new Error("Aucun texte reconnu. Reprends les photos plus près de la feuille, avec plus de lumière.");
      const n = pages.length;
      if (cible?.quand) cible.quand(r.texte, { ...r, pages: n });
      else MESDOCS.ajouterTexte(`Document scanné (${n} page${n > 1 ? "s" : ""})`, r.texte, { pages: n, ia: !!r.ia, scan: true });
      pages = []; occupe = false; etat(""); fermer();
    } catch (err) {
      console.error(err);
      occupe = false; etat(""); dessiner();
      alert("La lecture a échoué.\n\n" + err.message);
    }
  }
  const AIDE = "Photographie les pages <strong>une par une, dans l'ordre</strong>, bien à plat, sous une bonne lumière, en cadrant au plus près de la feuille. Tu peux ensuite les réordonner, les pivoter ou les retirer.";
  function ouvrir(o = {}) {
    if (!el) construire();
    cible = o.quand ? o : null;
    el.querySelector("#sc-titre").textContent = o.titre || "Scanner un document";
    el.querySelector("#sc-aide").innerHTML = o.aide || AIDE;
    aideMode(); dessiner();
    el.hidden = false; document.documentElement.classList.add("scanner-actif");
  }
  function fermer() {
    if (occupe) return;
    if (pages.length && !confirm("Abandonner les pages photographiées ?")) return;
    pages = []; el.hidden = true; document.documentElement.classList.remove("scanner-actif");
  }

  return { ouvrir, lire, charger, ameliorer };
})();
