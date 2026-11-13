/* =====================================================================
   ÉCRAN DE GÉNÉRATION — sobre : une page qui s'écrit, un titre, une barre.
   VOILE.ouvrir({ titre, sous }) · VOILE.etat(texte) · VOILE.titre(t, sous) · VOILE.fermer()
   (« sous » sert seulement au compteur de la préparation d'une semaine, ex. « Fiche 2 sur 6 »)
   ===================================================================== */
const VOILE = (() => {
  let el = null, ouvert = false;

  function construire() {
    el = document.createElement("div");
    el.id = "voile"; el.className = "voile"; el.hidden = true;
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = `
      <div class="voile-centre">
        <svg class="voile-page" viewBox="0 0 64 80" aria-hidden="true">
          <path class="voile-feuille" d="M8 4h34l14 14v56a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
          <path class="voile-coin" d="M42 4v12a2 2 0 0 0 2 2h12"/>
          <line class="voile-l" x1="16" y1="32" x2="48" y2="32"/>
          <line class="voile-l" x1="16" y1="42" x2="44" y2="42"/>
          <line class="voile-l" x1="16" y1="52" x2="48" y2="52"/>
          <line class="voile-l" x1="16" y1="62" x2="36" y2="62"/>
        </svg>
        <p class="voile-titre"></p>
        <p class="voile-sous"></p>
        <div class="voile-barre"><span></span></div>
        <p class="voile-conseil">Garde l'appli ouverte pendant la rédaction.</p>
      </div>
      <button type="button" class="voile-masquer">Masquer</button>`;
    document.body.appendChild(el);
    el.querySelector(".voile-masquer").onclick = () => fermer();
  }

  function fermer() {
    if (!el || el.hidden) return;
    ouvert = false;
    el.classList.remove("ouvert");
    document.documentElement.classList.remove("voile-actif");
    setTimeout(() => { if (!ouvert) el.hidden = true; }, 250);
  }

  return {
    ouvrir({ titre = "Rédaction en cours…", sous = "" } = {}) {
      if (!el) construire();
      el.querySelector(".voile-titre").textContent = titre;
      el.querySelector(".voile-sous").textContent = /^Fiche \d+ sur \d+$/.test(sous) ? sous : "";
      el.hidden = false; ouvert = true;
      document.documentElement.classList.add("voile-actif");
      requestAnimationFrame(() => el.classList.add("ouvert"));
    },
    etat() {},                                   // l'étape détaillée n'est plus affichée
    titre(t, sous) {
      if (!el) return;
      if (t) el.querySelector(".voile-titre").textContent = t;
      el.querySelector(".voile-sous").textContent = sous && /^Fiche \d+ sur \d+$/.test(sous) ? sous : "";
    },
    fermer
  };
})();
