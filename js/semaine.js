/* =====================================================================
   MA SEMAINE — l'accueil : les séances de la semaine pour les classes du profil
   Chaque séance : activité, durée, intitulé, état (à préparer / prête) et un bouton.
   Dépend de app.js, annee.js, profil.js.
   ===================================================================== */
const SEMAINE = (() => {
  let ecart = 0;                                   // navigation ‹ › autour de la semaine en cours

  function afficher() {
    const zone = $("#sem-liste");
    const cour = ANNEE.semaineCourante(), n = Math.max(1, cour + ecart);
    const cal = ANNEE.semainesScolaires(), dates = cal.find(s => s.n === n);
    $("#sem-num").textContent = `Semaine ${n}`;
    $("#sem-dates").textContent = dates ? ANNEE.libelleDates(dates) : "";
    $("#sem-ici").hidden = ecart === 0;
    $("#sem-badge").hidden = ecart !== 0;

    const tenues = PROFIL.tenues();
    if (!tenues.length) {
      zone.innerHTML = `<div class="carte sem-vide"><h3>Bienvenue</h3><p>Indique d'abord tes classes dans ton profil : l'appli affichera ici les séances de la semaine, d'après la progression officielle.</p><button type="button" class="principal" data-aller="reglages">Remplir mon profil</button></div>`;
      return;
    }
    // congé juste avant cette semaine ?
    const conge = (() => { const i = cal.findIndex(s => s.n === n); return i > 0 && cal[i - 1].conge ? cal[i - 1].conge : null; })();
    const cartes = tenues.map(({ matiere, classe }) => {
      const p = ANNEE.progression(matiere, classe);
      if (!p) return `<section class="carte sem-classe"><h3>${esc(matiere)} · ${esc(classe)}</h3><p class="meta">Pas de progression pour cette classe dans la base.</p></section>`;
      const s = p.semaines.find(x => x.n === n);
      if (!s || !s.items.length) return `<section class="carte sem-classe"><h3>${esc(matiere)} · ${esc(classe)}</h3><p class="meta">Rien de prévu cette semaine.</p></section>`;
      const aFaire = s.items.filter(x => !ANNEE.estFait(x.id)).length;
      return `<section class="carte sem-classe" data-m="${esc(matiere)}" data-c="${esc(classe)}">
        <div class="sem-tete"><h3>${esc(matiere)} · ${esc(classe)}</h3><span class="sem-compte">${s.items.length - aFaire}/${s.items.length} prêtes</span></div>
        <ul class="sem-items">${s.items.map(x => {
          const f = ANNEE.ficheDe(x.id), fait = ANNEE.estFait(x.id);
          return `<li class="sem-item${fait ? " fait" : ""}" data-id="${esc(x.id)}">
            <span class="sem-etat" aria-hidden="true"></span>
            <div class="sem-txt"><span class="sem-act">${x.devoir ? '<b class="etiquette">Devoir</b> ' : ""}${esc(x.activite)} · ${esc(x.duree)}</span><span class="sem-titre">${esc(x.titre)}</span></div>
            ${f ? `<button type="button" class="secondaire petit sem-voir">Ouvrir</button>` : fait ? `<span class="sem-faite">Faite</span>` : `<button type="button" class="principal petit sem-prep">Préparer</button>`}
          </li>`; }).join("")}</ul>
        ${aFaire > 1 ? `<button type="button" class="lien-action sem-tout">Préparer les ${aFaire} séances à la suite</button>` : ""}
      </section>`;
    });
    zone.innerHTML = (conge && ecart >= 0 ? `<p class="sem-conge">Retour de ${esc(conge.replace(/^Congés de\s*/i, "congés de ").replace(/^congés de congés/i, "congés"))}</p>` : "") + cartes.join("");
  }

  function trouver(m, c, id) {
    const p = ANNEE.progression(m, c);
    for (const s of p?.semaines || []) { const it = s.items.find(x => x.id === id); if (it) return { p, s, it }; }
    return null;
  }

  function init() {
    $("#sem-prec").onclick = () => { ecart--; afficher(); };
    $("#sem-suiv").onclick = () => { ecart++; afficher(); };
    $("#sem-ici").onclick = () => { ecart = 0; afficher(); };
    $("#sem-autre").onclick = () => { viderFormulaire(); ouvrir("nouvelle"); };
    $("#sem-liste").addEventListener("click", e => {
      const aller = e.target.closest("[data-aller]"); if (aller) return ouvrir(aller.dataset.aller);
      const carte = e.target.closest(".sem-classe"); if (!carte) return;
      const m = carte.dataset.m, c = carte.dataset.c;
      if (e.target.closest(".sem-tout")) return ANNEE.preparerSemaine(ANNEE.semaineCourante() + ecart, m, c);
      const li = e.target.closest(".sem-item"); if (!li) return;
      const t = trouver(m, c, li.dataset.id); if (!t) return;
      if (e.target.closest(".sem-voir")) afficherFiche(ANNEE.ficheDe(t.it.id));
      else if (e.target.closest(".sem-prep")) { viderFormulaire(); prefillDemande(ANNEE.demandeDepuis(t.p, t.s, t.it)); ouvrir("nouvelle"); }
    });
    ["profil-modifie", "fiches-maj", "donnees-restaurees"].forEach(ev => window.addEventListener(ev, () => { if (!$("#vue-semaine").hidden) afficher(); }));
  }
  return { init, afficher };
})();
