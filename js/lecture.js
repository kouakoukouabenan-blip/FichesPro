/* =====================================================================
   MODE LECTURE — la fiche en plein écran, sans les menus
   - Fiche portrait → écran en portrait ; fiche paysage → écran en paysage
     (verrouillage de l'orientation quand le téléphone le permet, sinon « Pivoter l'affichage »)
   - Page ajustée à la largeur de l'écran, A− / A+ pour agrandir, défilement libre
   - Quitter : ✕, touche Retour du téléphone ou Échap
   Dépend de app.js : $, racineFiche, signaler.
   ===================================================================== */
const LECTURE = (() => {
  let el, scene, page, paysage = false, mult = 1, ouvert = false, minuteur = null;
  const PAS = [1, 1.25, 1.5, 1.75, 2, 2.5];

  function construire() {
    el = document.createElement("div");
    el.id = "lecture"; el.className = "lecture"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Mode lecture");
    el.innerHTML = `
      <div class="lc-scene">
        <div class="lc-barre">
          <button type="button" class="lc-quitter" aria-label="Quitter le mode lecture">✕</button>
          <span class="lc-titre"></span>
          <button type="button" class="lc-pivoter" hidden>Pivoter l'affichage</button>
          <div class="lc-taille" role="group" aria-label="Taille">
            <button type="button" class="lc-moins" aria-label="Plus petit">A−</button>
            <button type="button" class="lc-plus" aria-label="Plus grand">A+</button>
          </div>
        </div>
        <div class="lc-defile"><div class="lc-pages"></div></div>
        <p class="lc-conseil" hidden>Tourne ton téléphone pour lire cette fiche en paysage, ou touche « Pivoter l'affichage ».</p>
      </div>`;
    document.body.appendChild(el);
    scene = el.querySelector(".lc-scene");
    el.querySelector(".lc-quitter").onclick = () => fermer();
    el.querySelector(".lc-moins").onclick = () => zoom(-1);
    el.querySelector(".lc-plus").onclick = () => zoom(1);
    el.querySelector(".lc-pivoter").onclick = () => { scene.classList.toggle("pivote"); majConseil(); ajuster(); };
    // barre discrète : elle s'efface pendant la lecture et revient au toucher
    el.querySelector(".lc-defile").addEventListener("click", montrerBarre);
    el.querySelector(".lc-defile").addEventListener("scroll", () => el.classList.add("calme"), { passive: true });
    addEventListener("resize", () => { if (ouvert) { majConseil(); ajuster(); } });
    addEventListener("keydown", e => { if (ouvert && e.key === "Escape") fermer(); });
    addEventListener("popstate", () => { if (ouvert) fermer(true); });
    document.addEventListener("fullscreenchange", () => { if (ouvert && !document.fullscreenElement && plein) fermer(); });
  }
  function montrerBarre() {
    el.classList.remove("calme");
    clearTimeout(minuteur); minuteur = setTimeout(() => el.classList.add("calme"), 3500);
  }

  /* largeur de la page ajustée à l'écran, multipliée par A− / A+ */
  function ajuster() {
    const zone = el.querySelector(".lc-defile");
    el.querySelectorAll(".lc-pages .fiche").forEach(f => {
      f.style.zoom = 1;
      const dispo = zone.clientWidth - 16;
      f.style.zoom = (dispo / f.offsetWidth * mult).toFixed(3);
    });
    el.querySelector(".lc-moins").disabled = mult <= PAS[0];
    el.querySelector(".lc-plus").disabled = mult >= PAS[PAS.length - 1];
  }
  function zoom(sens) {
    const i = Math.max(0, Math.min(PAS.length - 1, PAS.indexOf(mult) + sens));
    mult = PAS[i]; ajuster(); montrerBarre();
  }

  /* écran tenu dans le mauvais sens et verrouillage impossible : conseil + bouton « Pivoter » */
  function majConseil() {
    const ecranPaysage = innerWidth > innerHeight, pivote = scene.classList.contains("pivote");
    const accord = (ecranPaysage !== pivote) === paysage;
    el.querySelector(".lc-pivoter").hidden = accord && !pivote;
    el.querySelector(".lc-conseil").hidden = accord || pivote;
  }

  let plein = false;
  async function ouvrir() {
    if (!el) construire();
    const racine = racineFiche();
    if (!racine || !racine.innerHTML.trim()) return;
    paysage = racine.classList.contains("paysage");
    const pages = el.querySelector(".lc-pages");
    pages.innerHTML = "";
    [racine, $("#eleves")].filter(f => f && !f.hidden && f.innerHTML.trim()).forEach(f => {
      const c = f.cloneNode(true);
      c.removeAttribute("id"); c.removeAttribute("contenteditable"); c.removeAttribute("style");
      c.querySelectorAll("[contenteditable]").forEach(x => x.removeAttribute("contenteditable"));
      pages.appendChild(c);
    });
    el.querySelector(".lc-titre").textContent = $("#fiche-titre").textContent;
    scene.classList.remove("pivote");
    mult = 1; ouvert = true; el.hidden = false;
    document.documentElement.classList.add("lecture-active");
    history.pushState({ lecture: true }, "");
    el.querySelector(".lc-defile").scrollTop = 0;

    // plein écran puis verrouillage de l'orientation (Android) ; ailleurs, l'affichage suit le téléphone
    plein = false;
    try { if (el.requestFullscreen && !document.fullscreenElement) { await el.requestFullscreen({ navigationUI: "hide" }); plein = true; } } catch {}
    try { if (plein && screen.orientation?.lock) await screen.orientation.lock(paysage ? "landscape" : "portrait"); } catch {}
    setTimeout(() => { majConseil(); ajuster(); }, plein ? 350 : 0);
    majConseil(); ajuster(); montrerBarre();
  }

  async function fermer(depuisRetour = false) {
    if (!ouvert) return;
    ouvert = false;
    try { screen.orientation?.unlock && screen.orientation.unlock(); } catch {}
    if (document.fullscreenElement) { plein = false; try { await document.exitFullscreen(); } catch {} }
    el.hidden = true; scene.classList.remove("pivote");
    el.querySelector(".lc-pages").innerHTML = "";
    document.documentElement.classList.remove("lecture-active");
    if (!depuisRetour && history.state?.lecture) history.back();
  }

  return { ouvrir, fermer };
})();
$("#btn-lecture").onclick = () => LECTURE.ouvrir();
$("#lecture-ligne").onclick = () => { $("#dlg-plus").close(); LECTURE.ouvrir(); };
