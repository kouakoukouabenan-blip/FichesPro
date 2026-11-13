/* =====================================================================
   DICTÉE VOCALE — un micro sur les zones de texte (remarques, texte support, modification…)
   Reconnaissance vocale du navigateur (français), texte inséré à l'endroit du curseur.
   Commandes : « virgule », « point », « point à la ligne », « à la ligne », « deux points »,
   « point-virgule », « point d'interrogation », « point d'exclamation », « ouvrez les guillemets »…
   Nécessite une connexion (la reconnaissance passe par le service du téléphone).
   ===================================================================== */
const DICTEE = (() => {
  const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
  const CIBLES = ["#consignes", "#texte-support", "#retouche-texte", "#consignes-permanentes"];
  let reco = null, champ = null, bouton = null, avant = "", apres = "", acquis = "";

  // commandes de ponctuation dictées
  function ponctuer(t) {
    return (" " + t + " ")
      .replace(/\s+point (?:à|a) la ligne\s+/gi, ".\n").replace(/\s+(?:à|a) la ligne\s+|\s+nouvelle ligne\s+|\s+retour (?:à|a) la ligne\s+/gi, "\n")
      .replace(/\s+nouveau paragraphe\s+/gi, "\n\n")
      .replace(/\s+point[- ]virgule\s+/gi, " ; ").replace(/\s+deux[- ]points\s+/gi, " : ")
      .replace(/\s+point d'interrogation\s+/gi, " ? ").replace(/\s+point d'exclamation\s+/gi, " ! ")
      .replace(/\s+points de suspension\s+/gi, "… ").replace(/\s+virgule\s+/gi, ", ")
      .replace(/\s+ouvre[zr]? les guillemets\s+/gi, " « ").replace(/\s+ferme[zr]? les guillemets\s+/gi, " » ")
      .replace(/\s+ouvre[zr]? la parenthèse\s+/gi, " (").replace(/\s+ferme[zr]? la parenthèse\s+/gi, ") ")
      .replace(/\s+point(?: final)?\s*$/i, ". ").replace(/\s+point\s+(?=[A-ZÀ-Ý])/g, ". ")
      .replace(/ +([,.…)])/g, "$1").replace(/\( +/g, "(").replace(/ *\n */g, "\n").replace(/ {2,}/g, " ")
      .replace(/^ +/, "");
  }
  // majuscule en début de texte et après . ? ! ou retour à la ligne
  function majuscules(t, precedent) {
    const debutPhrase = !precedent.trim() || /[.?!…]\s*$|\n\s*$/.test(precedent);
    t = t.replace(/([.?!…]\s+|\n)([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
    return debutPhrase ? t.replace(/^\s*([a-zà-ÿ])/, m => m.toUpperCase()) : t;
  }
  function ecrire(texte) {
    let t = ponctuer(texte);
    if (!t.trim()) return;
    t = majuscules(t, avant);
    const sep = avant && !/[\s\n(«]$/.test(avant) && !/^[,.;:?!…)\n]/.test(t) ? " " : "";
    champ.value = avant + sep + t.replace(/\s+$/, " ") + apres;
    const pos = (avant + sep + t.replace(/\s+$/, " ")).length;
    champ.setSelectionRange(pos, pos);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function arreter() {
    if (reco) { try { reco.stop(); } catch {} }
  }
  function fin() {
    bouton?.classList.remove("ecoute"); bouton?.setAttribute("aria-pressed", "false");
    if (champ) champ.dispatchEvent(new Event("change", { bubbles: true }));
    reco = null; champ = null; bouton = null;
  }
  function demarrer(c, b) {
    if (reco) { const meme = champ === c; arreter(); if (meme) return; }
    if (navigator.onLine === false) return alert("La dictée a besoin d'une connexion internet.");
    champ = c; bouton = b;
    const debut = c.selectionStart ?? c.value.length, finSel = c.selectionEnd ?? debut;
    avant = c.value.slice(0, debut); apres = c.value.slice(finSel); acquis = "";
    reco = new Reco();
    reco.lang = "fr-FR"; reco.continuous = true; reco.interimResults = true;
    reco.onresult = e => {
      let provisoire = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) acquis += " " + r[0].transcript.trim();
        else provisoire += " " + r[0].transcript.trim();
      }
      ecrire((acquis + provisoire).trim());
    };
    reco.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") alert("Autorise l'accès au micro pour cette appli (icône du cadenas à côté de l'adresse, ou réglages du téléphone), puis réessaie.");
      else if (e.error === "network") alert("La dictée a besoin d'une connexion internet.");
      else if (e.error !== "no-speech" && e.error !== "aborted") console.warn("Dictée :", e.error);
    };
    reco.onend = fin;
    try { reco.start(); } catch (err) { fin(); return; }
    b.classList.add("ecoute"); b.setAttribute("aria-pressed", "true");
    c.focus();
  }

  function equiper(sel) {
    const c = document.querySelector(sel);
    if (!c || c.dataset.dictee) return;
    c.dataset.dictee = "1";
    const zone = document.createElement("span"); zone.className = "dictee-zone";
    c.parentNode.insertBefore(zone, c); zone.appendChild(c);
    const b = document.createElement("button");
    b.type = "button"; b.className = "dictee-micro"; b.setAttribute("aria-label", "Dicter"); b.setAttribute("aria-pressed", "false"); b.title = "Dicter (touche encore pour arrêter)";
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>`;
    b.addEventListener("mousedown", e => e.preventDefault());       // garde la position du curseur
    b.onclick = () => demarrer(c, b);
    zone.appendChild(b);
  }

  function init() {
    if (!Reco) return;
    CIBLES.forEach(equiper);
    document.addEventListener("visibilitychange", () => { if (document.hidden) arreter(); });
  }
  return { init, arreter, disponible: !!Reco };
})();
DICTEE.init();
