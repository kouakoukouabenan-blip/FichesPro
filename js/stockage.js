/* =====================================================================
   STOCKAGE SUR L'APPAREIL (IndexedDB) + SAUVEGARDE COMPLÈTE
   - docs     : documents ajoutés à la base depuis l'appli
   - matieres : matières ajoutées
   - fiches   : toutes les fiches générées (historique)
   La sauvegarde (fichier ou Google Drive) contient tout cela + les réglages, sans les clés API.
   ===================================================================== */
const STOCK = (() => {
  const NOM = "fiches-cours-mesdocs", VERSION = 2;
  let promesse = null;
  const db = () => promesse ||= new Promise((ok, ko) => {
    if (!("indexedDB" in window)) return ko(new Error("Stockage indisponible dans ce navigateur."));
    const r = indexedDB.open(NOM, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const [store, cle] of [["docs", "id"], ["matieres", "nom"], ["fiches", "id"]])
        if (!d.objectStoreNames.contains(store)) d.createObjectStore(store, { keyPath: cle });
    };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); };
    r.onerror = () => { promesse = null; ko(r.error); };
    r.onblocked = () => ko(new Error("L'appli est ouverte dans un autre onglet : ferme-le puis recharge la page."));
  });
  const tx = async (store, mode, fn) => {
    const d = await db();
    return new Promise((ok, ko) => {
      const t = d.transaction(store, mode), s = t.objectStore(store);
      const res = fn(s);
      t.oncomplete = () => ok(res && "result" in res ? res.result : undefined);
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error || new Error("Enregistrement annulé (espace plein ?)"));
    });
  };
  return {
    tous: store => tx(store, "readonly", s => s.getAll()),
    un: (store, id) => tx(store, "readonly", s => s.get(id)),
    mettre: (store, obj) => tx(store, "readwrite", s => { (Array.isArray(obj) ? obj : [obj]).forEach(o => s.put(o)); }),
    enlever: (store, id) => tx(store, "readwrite", s => { (Array.isArray(id) ? id : [id]).forEach(i => s.delete(i)); }),
    vider: store => tx(store, "readwrite", s => { s.clear(); })
  };
})();

const SAUVEGARDE = {
  /* Signale une modification (pour la sauvegarde automatique sur Drive) */
  modifie() {
    try { localStorage.setItem("fc_modifie", String(Date.now())); } catch {}
    window.dispatchEvent(new Event("donnees-modifiees"));
  },
  derniereModif: () => Number(localStorage.getItem("fc_modifie") || 0),

  async contenu() {
    const r = (() => { try { return JSON.parse(localStorage.getItem("fc_reglages") || "{}"); } catch { return {}; } })();
    const [matieres, docs, fiches] = await Promise.all([STOCK.tous("matieres"), STOCK.tous("docs"), STOCK.tous("fiches")]);
    return {
      app: "fiches-cours", version: 2, date: new Date().toISOString(),
      matieres, docs, fiches,
      // réglages utiles, sans les clés API (qui ne quittent jamais l'appareil)
      reglages: { consignesPermanentes: r.consignesPermanentes || "", geminiModele: r.geminiModele || "", groqModele: r.groqModele || "" },
      profil: (() => { try { return JSON.parse(localStorage.getItem("fc_profil") || "null"); } catch { return null; } })(),
      // séances cochées « faites » dans Mon année
      fait: (() => { try { return JSON.parse(localStorage.getItem("fc_fait") || "{}"); } catch { return {}; } })()
    };
  },

  /* Fusionne une sauvegarde avec ce qui est sur l'appareil (rien n'est effacé) */
  async appliquer(s) {
    if (!s || s.app !== "fiches-cours" || !Array.isArray(s.docs)) throw new Error("Ce fichier n'est pas une sauvegarde de l'appli Fiches de Cours.");
    for (const m of s.matieres || []) {
      await STOCK.mettre("matieres", m);
      if (!BASE.matieres[m.nom]) BASE.definirMatiere(m.nom, { classes: m.classes, activites: m.activites });
    }
    const docs = s.docs.filter(d => d.id && d.contenu).map(d => ({ ...d, perso: true }));
    if (docs.length) await STOCK.mettre("docs", docs);
    docs.forEach(d => { const i = BASE.docs.findIndex(x => x.id === d.id); i >= 0 ? BASE.docs.splice(i, 1, d) : BASE.docs.push(d); });
    // fiches : on garde la version la plus récemment modifiée
    const locales = new Map((await STOCK.tous("fiches")).map(f => [f.id, f]));
    const fiches = (s.fiches || []).filter(f => f && f.id && f.html && f.req)
      .filter(f => !locales.has(f.id) || (f.modifie || f.date || "") >= (locales.get(f.id).modifie || locales.get(f.id).date || ""));
    if (fiches.length) await STOCK.mettre("fiches", fiches);
    if (s.reglages) {
      try {
        const r = JSON.parse(localStorage.getItem("fc_reglages") || "{}");
        for (const k of ["consignesPermanentes", "geminiModele", "groqModele"]) if (!r[k] && s.reglages[k]) r[k] = s.reglages[k];
        localStorage.setItem("fc_reglages", JSON.stringify(r));
      } catch {}
    }
    if (s.profil && typeof s.profil === "object") {
      try { const local = JSON.parse(localStorage.getItem("fc_profil") || "{}"); if (!(local.classes || []).length) { localStorage.setItem("fc_profil", JSON.stringify(s.profil)); window.dispatchEvent(new Event("profil-modifie")); } } catch {}
    }
    if (s.fait && typeof s.fait === "object") {
      try { localStorage.setItem("fc_fait", JSON.stringify({ ...JSON.parse(localStorage.getItem("fc_fait") || "{}"), ...s.fait })); } catch {}
    }
    window.dispatchEvent(new Event("donnees-restaurees"));
    return { docs: docs.length, fiches: fiches.length, matieres: (s.matieres || []).length };
  },

  resume: r => [r.docs && `${r.docs} document${r.docs > 1 ? "s" : ""}`, r.fiches && `${r.fiches} fiche${r.fiches > 1 ? "s" : ""}`, r.matieres && `${r.matieres} matière${r.matieres > 1 ? "s" : ""}`].filter(Boolean).join(", ") || "rien de nouveau"
};
