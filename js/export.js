/* =====================================================================
   EXPORT — vrais fichiers Word (.docx) et PDF, page A4 en PORTRAIT
   ou en PAYSAGE (la page elle-même est tournée, pas seulement l'aperçu).
   Les bibliothèques (dossier vendor/) ne sont chargées qu'au premier export.
   ===================================================================== */
const EXPORT = {
  charges: {},
  taille: 1,          // agrandissement du texte (réglé par les boutons A− / A+)
  css() { const k = this.taille || 1; return this.CSS.replace(/font-size:([\d.]+)pt/g, (m, v) => `font-size:${(v * k).toFixed(1)}pt`); },
  charger(src) {
    return this.charges[src] ||= new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok;
      s.onerror = () => { delete this.charges[src]; ko(new Error("Impossible de charger " + src + " (connexion ?)")); };
      document.head.appendChild(s);
    });
  },
  async chargerWord() {
    await this.charger("vendor/docx.min.js");
    await this.charger("vendor/docx-math.min.js");
    await this.charger("vendor/docx-html.min.js");
  },
  async chargerPdf() {
    await this.charger("vendor/pdfmake.min.js");
    await this.charger("vendor/pdfmake-vfs-fonts.js");
    await this.charger("vendor/html-to-pdfmake.min.js");
  },

  /* Copie de la fiche, prête à convertir : largeurs de colonnes explicites, sans attributs d'édition */
  htmlFiche(racine) {
    const copie = racine.cloneNode(true);
    copie.removeAttribute("contenteditable");
    copie.querySelectorAll("[contenteditable]").forEach(e => e.removeAttribute("contenteditable"));
    // texte-support : numéro de ligne suivi d'un espace (pas de marge comme à l'écran), blanc entre les strophes
    copie.querySelectorAll(".ts-num").forEach(s => { s.textContent = s.textContent.trim() + "\u00a0\u00a0\u00a0"; });
    copie.querySelectorAll(".ts-strophe").forEach(p => { const v = document.createElement("p"); v.innerHTML = "&nbsp;"; v.className = "ts-blanc"; p.before(v); });
    // Retour à la ligne après la pastille du moment didactique (« PRÉSENTATION » puis « 5 min »)
    copie.querySelectorAll(".moment").forEach(m => {
      const n = m.nextSibling;
      if (n && n.nodeName !== "BR" && !(n.nodeType === 1 && /^(P|UL|OL|DIV)$/.test(n.nodeName))) m.after(document.createElement("br"));
    });
    return copie;
  },
  largeursColonnes(table) {
    const cols = [...table.querySelectorAll(":scope > colgroup > col")];
    if (!cols.length) return null;
    const v = cols.map(c => parseFloat(c.style.width) || 0);
    const total = v.reduce((a, b) => a + b, 0) || 100;
    return v.map(x => x / total * 100);
  },

  /* Couleurs et styles communs aux deux formats */
  CSS: `
    h1{font-family:Cambria,Georgia,serif;font-size:16pt;text-align:center;color:#1f4d3a;margin:0 0 6pt}
    h2{font-size:11pt;font-weight:bold;color:#ffffff;background-color:#1f4d3a;text-transform:uppercase;margin:9pt 0 4pt;padding:2pt 4pt}
    h3{font-size:10.5pt;font-weight:bold;color:#1f4d3a;margin:7pt 0 3pt}
    p{margin:1pt 0}
    th{background-color:#e5efe9;color:#1f4d3a;font-weight:bold}
    td,th{vertical-align:top}
    td.col-traces{background-color:#fbfdfb}
    .moment{color:#ffffff;background-color:#c8862e;font-weight:bold}
    .te-titre{color:#1f4d3a;font-weight:bold;text-transform:uppercase;border-bottom:1.5pt solid #1f4d3a;margin:5pt 0 2pt}
    .te-sous-titre{color:#9a6418;font-weight:bold;margin:4pt 0 1pt}
    .te-def{background-color:#e5efe9;border-left:3pt solid #2f6b52;padding-left:4pt;margin:2pt 0}
    .te-exemple{color:#1d4f91;font-style:italic;margin:1pt 0 1pt 6pt}
    .te-remarque{color:#7a2e5a;font-size:9pt;margin:2pt 0}
    .te-mot{color:#b0251b;font-weight:bold}
    h2.saut{page-break-before:always}
    .ts-titre{text-align:center;font-weight:bold}
    .ts-source{text-align:right;font-style:italic;font-size:9pt}
    .ts-droite{text-align:right}
    .ts-centre{text-align:center}
    .ts-alinea{text-indent:18pt}
    .ts-personnage{font-weight:bold}
    .ts-didascalie{font-style:italic;color:#555555}
    .ts-chapeau{font-weight:bold}
    .ts-num{color:#8a968e;font-size:8pt}
    .ts-blanc{font-size:4pt}
    .copie-ref{font-size:8pt;color:#5f675f;font-weight:bold}
    .coupe{text-align:center;color:#8a968e;font-size:8pt}
    .copie-sous-titre{font-weight:bold;color:#1f4d3a;font-size:9pt;text-transform:uppercase}
    table.copies-grille td{border:1px dashed #8a968e}`,

  nomFichier(f, ext) {
    return `${f.genre === "devoir" ? "Devoir" : "Fiche"}_${f.req.matiere}_${f.req.classe}_${f.req.titre}`.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 90) + (ext ? "." + ext : "");
  },
  telecharger(blob, nom) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },

  /* Téléchargement direct (boutons Word / PDF) */
  async word(racine, fiche, orientation) { const f = await this.fichierWord(racine, fiche, orientation); this.telecharger(f.blob, f.nom); return f; },
  async pdf(racine, fiche, orientation) { const f = await this.fichierPdf(racine, fiche, orientation); this.telecharger(f.blob, f.nom); return f; },

  /* ---------------- Word (.docx) ---------------- */
  async fichierWord(racine, fiche, orientation) {
    await this.chargerWord();
    const paysage = orientation === "paysage";
    const copie = this.htmlFiche(racine);
    // Largeur des tableaux en % de la largeur utile de la page
    copie.querySelectorAll("table").forEach(t => {
      t.setAttribute("style", "width:100%;border-collapse:collapse");
      const tiret = t.classList.contains("copies-grille");
      t.querySelectorAll("td,th").forEach(c => c.style.border = tiret ? "1px dashed #8a968e" : "1px solid #6b7a70");
      const l = this.largeursColonnes(t);
      if (l) t.querySelectorAll(":scope > colgroup > col").forEach((c, i) => c.setAttribute("style", `width:${l[i].toFixed(1)}%`));
    });
    const contenu = docxHtml.htmlToContent(copie.innerHTML, { stylesheet: this.css() });
    const { Document, Packer, PageOrientation } = docx;
    const cm = v => Math.round(v * 567);          // centimètres → twips
    const doc = new Document({
      creator: "Fiches de Cours — ATIKAN",
      title: fiche.req.titre,
      styles: { default: { document: { run: { font: "Calibri", size: Math.round(20 * (this.taille || 1)) }, paragraph: { spacing: { after: 20 } } } } },
      sections: [{
        properties: {
          page: {
            // dimensions A4 données en portrait ; docx les tourne quand l'orientation est PAYSAGE
            size: { width: cm(21), height: cm(29.7), orientation: paysage ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: paysage ? { top: cm(1.2), bottom: cm(1.2), left: cm(1.4), right: cm(1.4) }
                            : { top: cm(1.4), bottom: cm(1.4), left: cm(1.3), right: cm(1.3) }
          }
        },
        children: [...contenu]
      }]
    });
    const brut = await Packer.toBlob(doc);
    const blob = new Blob([brut], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    return { blob, nom: this.nomFichier(fiche, "docx") };
  },

  /* ---------------- PDF ---------------- */
  async fichierPdf(racine, fiche, orientation) {
    await this.chargerPdf();
    const paysage = orientation === "paysage";
    const k = this.taille || 1, T = v => +(v * k).toFixed(1);
    const copie = this.htmlFiche(racine);
    // la police du PDF n'a pas de flèches : → devient –› (lisible et imprimable)
    const it = document.createTreeWalker(copie, NodeFilter.SHOW_TEXT);
    for (let nd; (nd = it.nextNode());) if (/[→⇒➔]/.test(nd.nodeValue)) nd.nodeValue = nd.nodeValue.replace(/[→⇒➔]/g, "–›");
    // Largeurs des colonnes du déroulement transmises à pdfmake
    copie.querySelectorAll("table").forEach(t => {
      const l = this.largeursColonnes(t);
      const n = Math.max(...[...t.rows].map(r => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)), 1);
      const widths = l && l.length === n ? l.map(x => x.toFixed(1) + "%") : Array(n).fill("*");
      const grille = t.classList.contains("copies-grille");
      t.setAttribute("data-pdfmake", JSON.stringify(grille
        ? { widths: ["*", "*"], dontBreakRows: true, layout: "decoupe" }
        : { widths, dontBreakRows: false, headerRows: t.tHead ? t.tHead.rows.length : 0, layout: "compact" }));
      t.querySelector(":scope > colgroup")?.remove();
    });
    // Bandeaux de rubriques sur toute la largeur (pdfmake ne colore que le texte d'un titre)
    copie.querySelectorAll("h2").forEach(h => {
      const t = document.createElement("table");
      t.setAttribute("data-pdfmake", JSON.stringify({ widths: ["*"], layout: "noBorders" }));
      t.innerHTML = `<tr><td style="background-color:#1f4d3a;color:#ffffff;font-weight:bold;font-size:${T(10.5)}pt"></td></tr>`;
      t.querySelector("td").textContent = h.textContent.trim().toUpperCase();
      if (h.classList.contains("saut")) t.classList.add("saut-page");   // corrigé sur une nouvelle page (voir pageBreakBefore)
      h.replaceWith(t);
    });
    const contenu = htmlToPdfmake(copie.innerHTML, {
      window, tableAutoSize: false, removeExtraBlanks: true,
      defaultStyles: {
        h1: { fontSize: T(15), bold: true, alignment: "center", color: "#1f4d3a", marginBottom: 6 },
        h2: { fontSize: T(10.5), bold: true, color: "#ffffff", background: "#1f4d3a", marginTop: 8, marginBottom: 4 },
        h3: { fontSize: T(10), bold: true, color: "#1f4d3a", marginTop: 6, marginBottom: 3 },
        p: { margin: [0, 1, 0, 1] },
        th: { bold: true, fillColor: "#e5efe9", color: "#1f4d3a" },
        td: {},
        table: { marginBottom: 6 },
        ul: { marginBottom: 2, marginLeft: 4 }, ol: { marginBottom: 2, marginLeft: 4 }
      }
    });
    // Page élèves dans une fiche en paysage : elle repasse en portrait (meilleure mise en page pour photocopier)
    if (paysage) {
      const texte = n => JSON.stringify(n.table?.body || "");
      const debut = contenu.find(n => n.table && [].concat(n.style || []).includes("saut-page") && /photocopier/i.test(texte(n)));
      if (debut) { debut.pageBreak = "before"; debut.pageOrientation = "portrait"; }
    }
    const docDef = {
      pageSize: "A4",
      pageOrientation: paysage ? "landscape" : "portrait",
      pageMargins: paysage ? [34, 30, 34, 34] : [32, 34, 32, 38],
      info: { title: fiche.req.titre, author: "Fiches de Cours — ATIKAN" },
      defaultStyle: { fontSize: T(9), lineHeight: 1.08 },
      styles: {
        "moment": { bold: true, color: "#c8862e", fontSize: T(8.5) },
        "te-titre": { bold: true, color: "#1f4d3a", fontSize: T(9.4), decoration: "underline", marginTop: 4 },
        "te-sous-titre": { bold: true, color: "#9a6418", marginTop: 3 },
        "te-def": { background: "#e5efe9", color: "#163a2b" },
        "te-exemple": { italics: true, color: "#1d4f91" },
        "te-remarque": { color: "#7a2e5a", fontSize: T(8.6) },
        "te-mot": { bold: true, color: "#b0251b" },
        "col-traces": { fillColor: "#fbfdfb" },
        "ts-titre": { alignment: "center", bold: true, marginBottom: 3 },
        "ts-source": { alignment: "right", italics: true, fontSize: T(8), marginTop: 3 },
        "ts-droite": { alignment: "right" },
        "ts-centre": { alignment: "center" },
        "ts-alinea": { leadingIndent: 16 },
                "ts-personnage": { bold: true, marginTop: 3 },
        "ts-didascalie": { italics: true, color: "#555555" },
        "ts-chapeau": { bold: true, marginBottom: 3 },
        "ts-num": { color: "#8a968e", fontSize: T(7.5) },
        "ts-blanc": { fontSize: 4 },
        "copie-ref": { fontSize: T(7.5), color: "#5f675f", bold: true, marginBottom: 2 },
        "copie-nom": { marginBottom: 5 },
        "copie-sous-titre": { bold: true, color: "#1f4d3a", fontSize: T(8.5), marginTop: 4, marginBottom: 1 },
        "coupe": { alignment: "center", color: "#8a968e", fontSize: 7, margin: [0, 10, 0, 10] }
      },
      // le corrigé d'un devoir commence sur une nouvelle page
      pageBreakBefore: node => !node.pageBreak && !!node.table && (Array.isArray(node.style) ? node.style.includes("saut-page") : node.style === "saut-page"),   // le tableau-bandeau seul (pas ses cellules, sinon page vide)
      footer: (page, total) => ({ text: `${fiche.req.matiere} · ${fiche.req.classe} · ${fiche.req.titre} — page ${page}/${total}`, alignment: "center", fontSize: 7, color: "#7b8a80", margin: [0, 10, 0, 0] }),
      content: contenu
    };
    // cellules serrées : traits fins, marges intérieures réduites
    const tableLayouts = { compact: {
      hLineWidth: () => .5, vLineWidth: () => .5, hLineColor: () => "#8a968e", vLineColor: () => "#8a968e",
      paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 1.5, paddingBottom: () => 1.5 },
      decoupe: {   // exemplaires à découper : traits tirés
        hLineWidth: () => .8, vLineWidth: () => .8, hLineColor: () => "#8a968e", vLineColor: () => "#8a968e",
        hLineStyle: () => ({ dash: { length: 4, space: 3 } }), vLineStyle: () => ({ dash: { length: 4, space: 3 } }),
        paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 8, paddingBottom: () => 8 } };
    const pdf = pdfMake.createPdf(docDef, tableLayouts);
    const nom = this.nomFichier(fiche, "pdf");
    // pdfmake 0.3 : getBlob renvoie une promesse
    const brut = await (pdf.getBlob.length ? new Promise(ok => pdf.getBlob(ok)) : pdf.getBlob());
    return { blob: new Blob([brut], { type: "application/pdf" }), nom };
  }
};
