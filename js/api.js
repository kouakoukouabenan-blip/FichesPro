/* =====================================================================
   APPELS IA — Google Gemini (gratuit, clé AI Studio) + Groq en secours
   - Clé Gemini envoyée dans l'en-tête officiel « x-goog-api-key »
     (indispensable pour les nouvelles clés d'authentification « AQ. »).
   - Modèles détectés automatiquement si ceux par défaut n'existent plus.
   ===================================================================== */
const API = {
  GEMINI_BASE: "https://generativelanguage.googleapis.com/v1beta",
  GEMINI_MODELES: ["gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-2.5-flash"],
  GROQ_BASE: "https://api.groq.com/openai/v1",
  GROQ_PREFERENCES: ["openai/gpt-oss-120b", "llama-4-maverick", "kimi-k2", "qwen3-32b", "llama-3.3-70b", "openai/gpt-oss-20b", "llama-4-scout"],

  reglages() {
    try { return JSON.parse(localStorage.getItem("fc_reglages") || "{}"); }
    catch { return {}; }
  },
  memo(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem("fc_api_" + k) || "null");
      localStorage.setItem("fc_api_" + k, JSON.stringify(v));
    } catch { return null; }
  },
  // Retire espaces, retours à la ligne et guillemets collés par erreur
  nettoyerCle: c => (c || "").replace(/[\s"'«»]/g, ""),

  async generer(systeme, demande, onEtat) {
    const r = this.reglages();
    const gCle = this.nettoyerCle(r.geminiCle), qCle = this.nettoyerCle(r.groqCle);
    if (!gCle && !qCle) throw new Error("Aucune clé API. Ouvre « Réglages » pour coller ta clé Gemini gratuite.");
    const erreurs = [];

    if (gCle) {
      try { return await this.avecGemini(gCle, r.geminiModele, systeme, demande, onEtat); }
      catch (e) { erreurs.push("Gemini : " + e.message); }
    }
    if (qCle) {
      try { return await this.avecGroq(qCle, r.groqModele, systeme, demande, onEtat); }
      catch (e) { erreurs.push("Groq : " + e.message); }
    }
    throw new Error(erreurs.join("\n\n"));
  },

  /* ---------------- Gemini ---------------- */
  async avecGemini(cle, modeleChoisi, systeme, demande, onEtat) {
    const deja = this.memo("gemini_modele");
    let candidats = [...new Set([modeleChoisi, deja, ...this.GEMINI_MODELES].filter(Boolean))];
    let derniere = null, liste = false;
    for (let i = 0; i < candidats.length; i++) {
      const m = candidats[i];
      try {
        onEtat && onEtat(`Rédaction avec Gemini (${m})…`);
        let t, essai = 0;
        // coupure réseau : on réessaie le même modèle (2 fois), après le retour de la connexion
        for (;;) {
          try { t = await this.gemini(cle, m, systeme, demande); break; }
          catch (e) {
            if (e.type !== "reseau" || essai >= 2) throw e;
            essai++; onEtat && onEtat(`Connexion coupée : nouvel essai (${essai}/2)…`);
            await this.attendreReseau(3000 * essai);
          }
        }
        this.memo("gemini_modele", m);
        return t;
      } catch (e) {
        derniere = e;
        if (e.type === "cle") throw e;                       // inutile d'essayer d'autres modèles
        if (e.type === "reseau") throw Object.assign(new Error("la connexion internet a été coupée pendant la rédaction. Vérifie ton réseau (données mobiles ou Wi-Fi), garde l'appli ouverte au premier plan pendant la préparation, puis réessaie."), { type: "reseau" });
        if (e.type === "modele" && !liste && i === candidats.length - 1) {
          liste = true;                                       // aucun modèle par défaut : on demande la liste à Google
          const dispo = await this.modelesGemini(cle).catch(() => []);
          candidats.push(...dispo.filter(x => !candidats.includes(x)).slice(0, 3));
        }
      }
    }
    throw derniere || new Error("aucun modèle disponible");
  },

  async appelGemini(url, cle, options = {}, viaParametre = false) {
    const u = viaParametre ? url + (url.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(cle) : url;
    const headers = { ...(options.headers || {}) };
    if (!viaParametre) headers["x-goog-api-key"] = cle;
    try { return await fetch(u, { ...options, headers }); }
    catch (e) {   // « Failed to fetch » : la connexion a été coupée (réseau, appli mise en arrière-plan…)
      throw Object.assign(new Error("connexion internet interrompue"), { type: "reseau" });
    }
  },
  /* Attend que le téléphone soit de nouveau en ligne et l'appli au premier plan */
  async attendreReseau(ms) {
    await new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 60 && (!navigator.onLine || document.hidden); i++) await new Promise(r => setTimeout(r, 1000));
  },

  async gemini(cle, modele, systeme, demande) {
    const url = `${this.GEMINI_BASE}/models/${modele}:generateContent`;
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systeme }] },
        // « demande » : un texte, ou une liste de parties (texte + images/PDF en base64) pour la lecture de documents
        contents: [{ role: "user", parts: Array.isArray(demande) ? demande : [{ text: demande }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 16000 }
      })
    };
    let rep = await this.appelGemini(url, cle, options);
    // Anciennes clés « AIza » : si l'en-tête est refusé, on réessaie avec ?key=
    if ((rep.status === 401 || rep.status === 403) && cle.startsWith("AIza")) rep = await this.appelGemini(url, cle, options, true);
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw this.erreurGemini(rep.status, data, cle);
    const cand = data.candidates?.[0];
    const texte = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
    if (!texte) {
      const raison = cand?.finishReason || data.promptFeedback?.blockReason;
      throw Object.assign(new Error("réponse vide" + (raison ? ` (${raison})` : "")), { type: "vide" });
    }
    return texte;
  },

  erreurGemini(statut, data, cle) {
    const msg = data.error?.message || `erreur ${statut}`;
    const raison = JSON.stringify(data.error?.details || "");
    if (statut === 401 || statut === 403 || /API key|API_KEY|credential|ACCESS_TOKEN/i.test(msg + raison)) {
      return Object.assign(new Error(
        "clé refusée par Google. Vérifie qu'elle est complète (sans espace), qu'elle vient bien de aistudio.google.com/apikey, " +
        "et que l'« API Generative Language » est activée pour son projet. Si le problème continue, crée une nouvelle clé." +
        (cle.startsWith("AQ.") ? " (Clé de type « AQ. » détectée.)" : "") + `\n[détail : ${msg}]`), { type: "cle" });
    }
    if (statut === 404 || /not found|is not supported/i.test(msg)) return Object.assign(new Error(`modèle indisponible (${msg})`), { type: "modele" });
    if (statut === 429) return Object.assign(new Error("quota gratuit atteint pour le moment : réessaie dans une minute (ou demain si le quota du jour est épuisé)."), { type: "quota" });
    if (statut >= 500) return Object.assign(new Error("serveur Google surchargé, réessaie dans un instant."), { type: "serveur" });
    return new Error(msg);
  },

  async modelesGemini(cle) {
    let rep = await this.appelGemini(`${this.GEMINI_BASE}/models?pageSize=200`, cle);
    if (!rep.ok && cle.startsWith("AIza")) rep = await this.appelGemini(`${this.GEMINI_BASE}/models?pageSize=200`, cle, {}, true);
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw this.erreurGemini(rep.status, data, cle);
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => m.name.replace(/^models\//, ""))
      .filter(n => /flash|pro/.test(n) && !/image|tts|audio|live|embedding|vision|robotics|computer/.test(n))
      .sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || (/lite/.test(a) - /lite/.test(b)) || b.localeCompare(a));
  },

  /* ---------------- Groq ---------------- */
  async avecGroq(cle, modeleChoisi, systeme, demande, onEtat) {
    let modele = modeleChoisi || this.memo("groq_modele");
    if (!modele) modele = await this.meilleurModeleGroq(cle);
    try {
      onEtat && onEtat(`Rédaction avec Groq (${modele})…`);
      const t = await this.groq(cle, modele, systeme, demande);
      this.memo("groq_modele", modele);
      return t;
    } catch (e) {
      if (e.type !== "modele") throw e;
      const autre = await this.meilleurModeleGroq(cle, modele);   // modèle retiré : on en prend un autre
      onEtat && onEtat(`Rédaction avec Groq (${autre})…`);
      const t = await this.groq(cle, autre, systeme, demande);
      this.memo("groq_modele", autre);
      return t;
    }
  },

  async modelesGroq(cle) {
    const rep = await fetch(`${this.GROQ_BASE}/models`, { headers: { "Authorization": "Bearer " + cle } });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw this.erreurGroq(rep.status, data);
    return (data.data || []).filter(m => m.active !== false).map(m => m.id)
      .filter(id => !/whisper|tts|guard|embed|playai|orpheus|compound|distil/i.test(id));
  },

  async meilleurModeleGroq(cle, exclu) {
    const dispo = (await this.modelesGroq(cle)).filter(m => m !== exclu);
    for (const p of this.GROQ_PREFERENCES) {
      const m = dispo.find(id => id.includes(p));
      if (m) return m;
    }
    if (dispo.length) return dispo[0];
    throw new Error("aucun modèle de texte disponible sur ce compte Groq.");
  },

  async groq(cle, modele, systeme, demande) {
    const rep = await fetch(`${this.GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cle },
      body: JSON.stringify({
        model: modele, temperature: 0.4, max_tokens: 8000,
        messages: [{ role: "system", content: systeme }, { role: "user", content: demande }]
      })
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw this.erreurGroq(rep.status, data);
    const t = data.choices?.[0]?.message?.content || "";
    if (!t) throw new Error("réponse vide");
    return t;
  },

  erreurGroq(statut, data) {
    const msg = data.error?.message || `erreur ${statut}`;
    if (statut === 401) return Object.assign(new Error("clé Groq refusée : vérifie-la sur console.groq.com/keys."), { type: "cle" });
    if (statut === 404 || /does not exist|decommissioned|not found/i.test(msg)) return Object.assign(new Error(`modèle indisponible (${msg})`), { type: "modele" });
    if (statut === 413 || /too large|context|tokens per minute|TPM/i.test(msg)) return Object.assign(new Error("demande trop longue pour le quota gratuit de Groq ; utilise plutôt Gemini."), { type: "quota" });
    if (statut === 429) return Object.assign(new Error("quota gratuit atteint, réessaie dans une minute."), { type: "quota" });
    return new Error(msg);
  },

  /* ---------------- Lecture de documents scannés / photos (Gemini) ---------------- */
  SYSTEME_TRANSCRIPTION: `Tu transcris fidèlement des documents pédagogiques photographiés ou scannés (fiches de cours, progressions, programmes, sujets, cahiers).
Recopie TOUT le texte lisible, dans l'ordre de lecture, sans rien résumer, corriger, traduire ni ajouter.
- Conserve les titres, numérotations, puces et retours à la ligne utiles.
- Tableaux : une ligne par rangée, cellules séparées par « | » (ligne d'en-tête comprise).
- Mot illisible : écris [illisible].
- Plusieurs pages : commence chaque page par « --- page N --- » (N = numéro donné dans la demande).
Réponds uniquement par le texte transcrit, sans commentaire ni bloc de code.`,
  async transcrire(parties, onEtat) {
    const r = this.reglages(), cle = this.nettoyerCle(r.geminiCle);
    if (!cle) throw new Error("La lecture des PDF scannés et des photos se fait avec Gemini : ajoute ta clé Gemini dans Réglages.");
    const t = await this.avecGemini(cle, r.geminiModele, this.SYSTEME_TRANSCRIPTION, parties, onEtat);
    return t.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  },

  /* ---------------- Test des clés (Réglages) ---------------- */
  async tester() {
    const r = this.reglages(), lignes = [];
    const g = this.nettoyerCle(r.geminiCle), q = this.nettoyerCle(r.groqCle);
    if (g) {
      try {
        const ms = await this.modelesGemini(g);
        lignes.push(`✓ Gemini : clé acceptée (${ms.length} modèles, ex. ${ms.slice(0, 2).join(", ") || "—"}).`);
      } catch (e) { lignes.push("✗ Gemini : " + e.message); }
    } else lignes.push("— Gemini : pas de clé.");
    if (q) {
      try { lignes.push(`✓ Groq : clé acceptée, modèle retenu : ${await this.meilleurModeleGroq(q)}.`); }
      catch (e) { lignes.push("✗ Groq : " + e.message); }
    } else lignes.push("— Groq : pas de clé (facultatif).");
    return lignes.join("\n");
  }
};
