/* =====================================================================
   GOOGLE DRIVE — sauvegarde complète et envoi des fiches
   - Connexion Google (Google Identity Services), autorisation « drive.file » :
     l'appli ne voit QUE les fichiers qu'elle a elle-même créés dans ton Drive.
   - Dossier « Fiches de Cours (ATIKAN) » :
       fiches-cours-sauvegarde.json   (sauvegarde complète, mise à jour à chaque fois ;
                                       Drive garde les versions précédentes)
       Fiches/                         (fiches envoyées en Word et en PDF)
   - Sauvegarde automatique quand tu es connecté (après chaque modification).
   L'identifiant client Google (Client ID) se crée une fois sur console.cloud.google.com.
   ===================================================================== */
/* Désactivé pour l'instant : passer à true pour réafficher la sauvegarde Google Drive */
const DRIVE_ACTIF = false;

const DRIVE = (() => {
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const API = "https://www.googleapis.com/drive/v3", UPLOAD = "https://www.googleapis.com/upload/drive/v3";
  const DOSSIER = "Fiches de Cours (ATIKAN)", SOUS_DOSSIER = "Fiches", FICHIER = "fiches-cours-sauvegarde.json";
  const reg = () => { try { return JSON.parse(localStorage.getItem("fc_drive") || "{}"); } catch { return {}; } };
  const majReg = o => { try { localStorage.setItem("fc_drive", JSON.stringify({ ...reg(), ...o })); } catch {} };
  let jeton = null, expire = 0, clientJeton = null, attente = null;
  try { const j = JSON.parse(sessionStorage.getItem("fc_drive_jeton") || "null"); if (j && j.expire > Date.now() + 60000) { jeton = j.jeton; expire = j.expire; } } catch {}

  /* ---------------- Connexion ---------------- */
  const connecte = () => !!jeton && Date.now() < expire - 60000;
  function chargerGIS() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = () => ok(); s.onerror = () => ko(new Error("Impossible de joindre Google (connexion internet ?)."));
      document.head.appendChild(s);
    });
  }
  // À appeler depuis un toucher (Google ouvre une petite fenêtre de connexion)
  async function connecter(forcer = false) {
    if (connecte() && !forcer) return jeton;
    const clientId = (reg().clientId || "").trim();
    if (!clientId) throw new Error("Colle d'abord ton identifiant client Google (voir « Comment obtenir l'identifiant client »).");
    await chargerGIS();
    return new Promise((ok, ko) => {
      attente = { ok, ko };
      if (!clientJeton || clientJeton._id !== clientId) {
        clientJeton = google.accounts.oauth2.initTokenClient({
          client_id: clientId, scope: SCOPE,
          callback: rep => {
            const a = attente; attente = null;
            if (rep.error) return a?.ko(new Error(rep.error === "access_denied" ? "Accès refusé dans la fenêtre Google." : "Google a refusé la connexion : " + (rep.error_description || rep.error)));
            jeton = rep.access_token; expire = Date.now() + (Number(rep.expires_in) || 3600) * 1000;
            try { sessionStorage.setItem("fc_drive_jeton", JSON.stringify({ jeton, expire })); } catch {}
            majReg({ connu: true });
            a?.ok(jeton); afficherEtat();
          },
          error_callback: err => {
            const a = attente; attente = null;
            a?.ko(new Error(err?.type === "popup_closed" ? "Fenêtre Google fermée avant la fin." : err?.type === "popup_failed_to_open" ? "La fenêtre Google n'a pas pu s'ouvrir (bloqueur de fenêtres ?)." : "Connexion Google impossible."));
          }
        });
        clientJeton._id = clientId;
      }
      clientJeton.requestAccessToken({ prompt: reg().connu ? "" : "consent" });
    });
  }
  function deconnecter() {
    if (jeton && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(jeton, () => {});
    jeton = null; expire = 0;
    try { sessionStorage.removeItem("fc_drive_jeton"); } catch {}
    majReg({ connu: false, dossierId: null, sousDossierId: null, fichierId: null, derniereDistante: null });
    afficherEtat();
  }

  /* ---------------- Appels à l'API Drive ---------------- */
  async function appel(url, options = {}, essai = 0) {
    if (!connecte()) throw Object.assign(new Error("Non connecté à Google Drive."), { type: "jeton" });
    const rep = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: "Bearer " + jeton } });
    if (rep.status === 401) { jeton = null; expire = 0; throw Object.assign(new Error("La connexion Google a expiré : reconnecte-toi."), { type: "jeton" }); }
    if ((rep.status === 429 || rep.status >= 500) && essai < 2) { await new Promise(r => setTimeout(r, 1500 * (essai + 1))); return appel(url, options, essai + 1); }
    if (!rep.ok) {
      const d = await rep.json().catch(() => ({}));
      const msg = d.error?.message || `erreur ${rep.status}`;
      throw new Error(/has not been used|is disabled|accessNotConfigured/i.test(msg)
        ? "L'API Google Drive n'est pas activée dans ton projet Google Cloud (étape 2 du guide)." : "Google Drive : " + msg);
    }
    return rep;
  }
  const json = async (url, o) => (await appel(url, o)).json();
  const echapper = v => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  async function chercher(nom, parent, dossier) {
    const q = [`name='${echapper(nom)}'`, "trashed=false", parent ? `'${parent}' in parents` : null,
      dossier ? "mimeType='application/vnd.google-apps.folder'" : "mimeType!='application/vnd.google-apps.folder'"].filter(Boolean).join(" and ");
    const r = await json(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=10&spaces=drive`);
    return r.files || [];
  }
  async function existe(id) {
    if (!id) return false;
    try { const f = await json(`${API}/files/${id}?fields=id,trashed`); return !f.trashed; } catch { return false; }
  }
  async function dossier(nom, parent, cle) {
    const r = reg();
    if (await existe(r[cle])) return r[cle];
    const trouve = (await chercher(nom, parent, true))[0];
    const id = trouve ? trouve.id : (await json(`${API}/files?fields=id`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nom, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) })
    })).id;
    majReg({ [cle]: id });
    return id;
  }
  const dossierPrincipal = () => dossier(DOSSIER, null, "dossierId");
  const dossierFiches = async () => dossier(SOUS_DOSSIER, await dossierPrincipal(), "sousDossierId");
  // Envoi « multipart » : métadonnées + contenu ; mise à jour si l'identifiant est donné
  async function envoyer({ nom, type, contenu, parent, id }) {
    const limite = "fc" + Math.random().toString(36).slice(2);
    const meta = id ? { name: nom } : { name: nom, parents: [parent] };
    const corps = new Blob([
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${limite}\r\nContent-Type: ${type}\r\n\r\n`, contenu, `\r\n--${limite}--`
    ]);
    const url = id ? `${UPLOAD}/files/${id}?uploadType=multipart&fields=id,name,modifiedTime,webViewLink`
                   : `${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink`;
    return json(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": `multipart/related; boundary=${limite}` }, body: corps });
  }

  /* ---------------- Sauvegarde / restauration ---------------- */
  let enCours = null;
  async function sauvegarder({ silencieux = false } = {}) {
    if (enCours) return enCours;
    enCours = (async () => {
      etat(silencieux ? "Sauvegarde automatique…" : "Sauvegarde sur Google Drive…", "travail");
      const parent = await dossierPrincipal();
      let id = reg().fichierId;
      if (!(await existe(id))) id = (await chercher(FICHIER, parent))[0]?.id || null;
      // La sauvegarde du Drive a été modifiée ailleurs (autre téléphone, ordinateur) depuis notre dernier envoi :
      // on la fusionne d'abord avec cet appareil, pour ne rien écraser.
      if (id) {
        const meta = await json(`${API}/files/${id}?fields=modifiedTime`);
        const notre = reg().derniereDistante;
        if (!notre || Date.parse(meta.modifiedTime) > Date.parse(notre) + 2000) {
          etat("Fusion avec la sauvegarde du Drive…", "travail");
          try { await SAUVEGARDE.appliquer(await (await appel(`${API}/files/${id}?alt=media`)).json()); }
          catch (err) { if (!/n'est pas une sauvegarde/.test(err.message)) throw err; }
        }
      }
      const contenu = JSON.stringify(await SAUVEGARDE.contenu());
      const f = await envoyer({ nom: FICHIER, type: "application/json", contenu, parent, id });
      majReg({ fichierId: f.id, derniere: new Date().toISOString(), derniereDistante: f.modifiedTime, taille: contenu.length });
      afficherEtat();
      return f;
    })();
    try { return await enCours; }
    catch (err) { etat("Échec de la sauvegarde : " + err.message, "erreur"); throw err; }
    finally { enCours = null; }
  }
  async function restaurer() {
    etat("Recherche de ta sauvegarde sur Google Drive…", "travail");
    const parent = await dossierPrincipal();
    const f = (await chercher(FICHIER, parent))[0];
    if (!f) { afficherEtat(); throw new Error("Aucune sauvegarde trouvée dans ton Drive. Fais d'abord « Sauvegarder maintenant » depuis l'appareil qui a tes fiches."); }
    const s = await (await appel(`${API}/files/${f.id}?alt=media`)).json();
    const r = await SAUVEGARDE.appliquer(s);
    majReg({ fichierId: f.id });
    afficherEtat();
    return { ...r, date: s.date };
  }

  /* ---------------- Envoi d'une fiche (Word + PDF) ---------------- */
  async function envoyerFiche(fichiers) {
    const parent = await dossierFiches();
    const liens = [];
    for (const { blob, nom } of fichiers) liens.push(await envoyer({ nom, type: blob.type || "application/octet-stream", contenu: blob, parent }));
    return liens;
  }

  /* ---------------- Sauvegarde automatique ---------------- */
  let minuteur = null;
  window.addEventListener("donnees-modifiees", () => {
    if (!DRIVE_ACTIF) return;
    afficherEtat();
    if (!reg().auto || !connecte()) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(() => sauvegarder({ silencieux: true }).catch(() => {}), 15000);
  });
  // Avant de quitter l'appli : dernière tentative si des modifications attendent
  document.addEventListener("visibilitychange", () => {
    if (DRIVE_ACTIF && document.visibilityState === "hidden" && reg().auto && connecte() && aSauvegarder()) { clearTimeout(minuteur); sauvegarder({ silencieux: true }).catch(() => {}); }
  });
  const aSauvegarder = () => SAUVEGARDE.derniereModif() > Date.parse(reg().derniere || 0);

  /* ---------------- Affichage (Réglages) ---------------- */
  const ilYa = iso => {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 90) return "à l'instant";
    if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
    const j = Math.round(s / 86400); return `il y a ${j} jour${j > 1 ? "s" : ""}`;
  };
  function etat(texte, genre = "") {
    const el = document.getElementById("drive-etat"); if (!el) return;
    el.textContent = texte; el.className = "drive-etat " + genre;
  }
  function afficherEtat() {
    const r = reg(), el = document.getElementById("drive-etat"); if (!el) return;
    const c = connecte();
    document.getElementById("drive-connecter").hidden = c;
    document.getElementById("drive-actions").hidden = !c;
    document.getElementById("drive-deconnecter").hidden = !c && !r.connu;
    const attenteModif = aSauvegarder();
    if (!r.clientId) etat("Pas encore configuré : colle ton identifiant client Google ci-dessous.", "");
    else if (c) etat(r.derniere ? `Connecté · dernière sauvegarde ${ilYa(r.derniere)}${attenteModif ? " · modifications à sauvegarder" : ""}` : "Connecté · aucune sauvegarde pour l'instant", attenteModif ? "attention" : "ok");
    else etat(r.derniere ? `Dernière sauvegarde ${ilYa(r.derniere)}${attenteModif ? " · des modifications ne sont pas sauvegardées" : ""} · connecte-toi pour sauvegarder` : "Prêt : touche « Se connecter à Google Drive ».", attenteModif ? "attention" : "");
    const pastille = document.querySelector('.onglet[data-vue="reglages"]');
    if (pastille) pastille.classList.toggle("a-sauver", !!r.derniere && attenteModif && Date.now() - Date.parse(r.derniere) > 3 * 86400000);
  }

  async function action(bouton, fn) {
    const lib = bouton.textContent; bouton.disabled = true;
    try { await connecter(); await fn(); }
    catch (err) { if (err.type === "jeton") { try { await connecter(true); await fn(); } catch (e) { alert(e.message); } } else alert(err.message); afficherEtat(); }
    finally { bouton.disabled = false; bouton.textContent = lib; }
  }

  function init() {
    if (!DRIVE_ACTIF) return;
    document.getElementById("bloc-drive").hidden = false;
    document.getElementById("envoyer-drive").hidden = false;
    const r = reg();
    const champ = document.getElementById("drive-client");
    champ.value = r.clientId || "";
    champ.addEventListener("change", () => {
      const v = champ.value.replace(/\s/g, "");
      champ.value = v;
      if (v !== reg().clientId) { clientJeton = null; jeton = null; majReg({ clientId: v, connu: false }); }
      afficherEtat();
    });
    document.getElementById("drive-origine").textContent = location.origin;
    document.getElementById("drive-auto").checked = r.auto !== false;
    if (r.auto === undefined) majReg({ auto: true });
    document.getElementById("drive-auto").onchange = e => majReg({ auto: e.target.checked });
    // Connexion : la sauvegarde existante du Drive est fusionnée avec cet appareil, puis mise à jour
    document.getElementById("drive-connecter").onclick = e => action(e.currentTarget, () => sauvegarder());
    document.getElementById("drive-sauver").onclick = e => action(e.currentTarget, () => sauvegarder());
    document.getElementById("drive-restaurer").onclick = e => action(e.currentTarget, async () => {
      if (!confirm("Récupérer la sauvegarde de ton Drive sur cet appareil ?\nRien n'est effacé : elle est ajoutée à ce qui s'y trouve déjà.")) return;
      const res = await restaurer();
      alert(`Récupéré depuis Drive (sauvegarde du ${new Date(res.date).toLocaleString("fr-FR")}) : ${SAUVEGARDE.resume(res)}.`);
    });
    document.getElementById("drive-ouvrir").onclick = e => action(e.currentTarget, async () => {
      const id = await dossierPrincipal();
      window.open(`https://drive.google.com/drive/folders/${id}`, "_blank", "noopener");
    });
    document.getElementById("drive-deconnecter").onclick = () => { if (confirm("Se déconnecter de Google Drive sur cet appareil ?")) deconnecter(); };
    afficherEtat();
    setInterval(afficherEtat, 60000);
  }

  return { init, connecter, connecte, sauvegarder, restaurer, envoyerFiche, configure: () => !!reg().clientId, action };
})();
DRIVE.init();
