/* =====================================================================
   MON PROFIL — saisi une seule fois (Réglages)
   Nom, établissement, effectif habituel, et les classes tenues (matière + classe).
   Les menus de l'appli ne proposent ensuite que ces classes, et l'en-tête des fiches se remplit seul.
   ===================================================================== */
const PROFIL = (() => {
  const CLE = "fc_profil";
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; } };
  const ecrire = p => { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch {} window.dispatchEvent(new Event("profil-modifie")); };

  // reprise des anciennes saisies du formulaire (établissement, professeur) au premier lancement
  (() => {
    const p = lire();
    if (p.professeur !== undefined) return;
    try {
      const d = JSON.parse(localStorage.getItem("fc_dernier")) || {};
      if (d.professeur || d.etablissement) ecrire({ professeur: d.professeur || "", etablissement: d.etablissement || "", effectif: d.effectif || "", classes: [] });
    } catch {}
  })();

  const tenues = () => (lire().classes || []).filter(x => BASE.matieres[x.matiere]);
  return {
    lire, ecrire, tenues,
    complet: () => tenues().length > 0,
    /* matières proposées (null = toutes) */
    matieres() { const t = tenues(); return t.length ? [...new Set(t.map(x => x.matiere))] : null; },
    /* classes proposées pour une matière (null = toutes celles de la matière) */
    classes(matiere) { const t = tenues().filter(x => x.matiere === matiere).map(x => x.classe); return t.length ? (BASE.matieres[matiere]?.classes || []).filter(c => t.includes(c)) : null; },

    /* Carte « Mon profil » des Réglages */
    init() {
      const zone = document.getElementById("profil-classes");
      const dessiner = () => {
        const p = lire(), choisies = new Set((p.classes || []).map(x => x.matiere + "|" + x.classe));
        zone.innerHTML = Object.entries(BASE.matieres).map(([m, cfg]) => `
          <fieldset class="profil-matiere"><legend>${esc(m)}</legend>
            <div class="profil-puces">${(cfg.classes || []).map(c => `<label class="puce-choix"><input type="checkbox" value="${esc(m + "|" + c)}"${choisies.has(m + "|" + c) ? " checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div>
          </fieldset>`).join("");
        document.getElementById("profil-nom").value = p.professeur || "";
        document.getElementById("profil-etab").value = p.etablissement || "";
        document.getElementById("profil-effectif").value = p.effectif || "";
      };
      dessiner();
      document.getElementById("form-profil").onsubmit = e => {
        e.preventDefault();
        const classes = [...zone.querySelectorAll("input:checked")].map(i => { const [matiere, classe] = i.value.split("|"); return { matiere, classe }; });
        ecrire({ professeur: document.getElementById("profil-nom").value.trim(), etablissement: document.getElementById("profil-etab").value.trim(), effectif: document.getElementById("profil-effectif").value.trim(), classes });
        const ok = document.getElementById("profil-ok"); ok.hidden = false; setTimeout(() => ok.hidden = true, 1800);
      };
      window.addEventListener("donnees-restaurees", dessiner);
    }
  };
})();
