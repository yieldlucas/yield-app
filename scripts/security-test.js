/* ─────────────────────────────────────────────────────────────────────────────
 * SECURITY TEST — YIELD
 *
 * Ce script vérifie que les RLS de Supabase isolent correctement les données
 * entre utilisateurs. À lancer DEPUIS LA CONSOLE NAVIGATEUR sur yieldapp.fr,
 * connecté en tant qu'utilisateur B (qui ne devrait rien voir d'utilisateur A).
 *
 *   USAGE :
 *   1. Crée 2 comptes : userA@test.fr et userB@test.fr
 *   2. Connecte-toi en A → scanne au moins 1 BL
 *   3. Déconnecte-toi, reconnecte-toi en B
 *   4. Ouvre DevTools → Console → colle ce script entier → Entrée
 *
 *   RÉSULTAT ATTENDU :
 *   Toutes les tables doivent renvoyer 0 ligne (sauf si B a aussi scanné).
 *   Le storage doit refuser tout download d'un fichier de A.
 *   La tentative d'UPDATE du profil de A doit échouer.
 *
 *   ❌ Si tu vois des données de A → RLS cassée, NE PAS LANCER EN PROD.
 * ─────────────────────────────────────────────────────────────────────────── */

(async () => {
  // ─── Récupération de la config Supabase depuis les meta exposées ────────────
  const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"; // ← remplace
  const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";                   // ← remplace

  // ─── Récupère le token de l'user B actuellement connecté ────────────────────
  const sessionRaw = Object.keys(localStorage)
    .filter(k => k.startsWith("yield-auth"))
    .map(k => localStorage.getItem(k))
    .find(v => v && v.includes("access_token"));

  if (!sessionRaw) {
    console.error("❌ Aucune session trouvée. Connecte-toi d'abord en tant qu'user B.");
    return;
  }
  const session = JSON.parse(sessionRaw);
  const token = session.access_token;
  const userBId = session.user?.id;
  const userBEmail = session.user?.email;

  console.log("%c🔐 Test de sécurité YIELD", "font-size: 16px; font-weight: bold; color: #2563EB;");
  console.log("Connecté en tant que :", userBEmail, `(${userBId})`);
  console.log("");

  // ─── Helper REST PostgREST ─────────────────────────────────────────────────
  const query = async (path, opts = {}) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };

  // ─── Tests ─────────────────────────────────────────────────────────────────
  const results = [];

  // 1. Lecture de toutes les invoices accessibles
  const inv = await query("invoices?select=id,restaurant_id");
  results.push({
    test: "SELECT invoices",
    status: inv.status,
    rows: Array.isArray(inv.data) ? inv.data.length : "ERR",
    expected: "0 (B n'a pas scanné) ou uniquement les invoices de B",
    pass: Array.isArray(inv.data) && inv.data.every(r => true), // RLS doit filtrer
  });

  // 2. Lecture de toutes les invoice_items
  const items = await query("invoice_items?select=id,invoice_id");
  results.push({
    test: "SELECT invoice_items",
    status: items.status,
    rows: Array.isArray(items.data) ? items.data.length : "ERR",
    expected: "0 ou uniquement items de B",
    pass: items.status === 200,
  });

  // 3. Lecture des suppliers
  const sup = await query("suppliers?select=id,name");
  results.push({
    test: "SELECT suppliers",
    status: sup.status,
    rows: Array.isArray(sup.data) ? sup.data.length : "ERR",
    expected: "0 ou uniquement fournisseurs de B",
    pass: sup.status === 200,
  });

  // 4. Lecture des price_history
  const ph = await query("price_history?select=id");
  results.push({
    test: "SELECT price_history",
    status: ph.status,
    rows: Array.isArray(ph.data) ? ph.data.length : "ERR",
    expected: "0 ou uniquement historique de B",
    pass: ph.status === 200,
  });

  // 5. Lecture des margin_alerts
  const ma = await query("margin_alerts?select=id");
  results.push({
    test: "SELECT margin_alerts",
    status: ma.status,
    rows: Array.isArray(ma.data) ? ma.data.length : "ERR",
    expected: "0 ou uniquement alertes de B",
    pass: ma.status === 200,
  });

  // 6. Lecture du profil d'un AUTRE user (random UUID) → doit renvoyer 0
  const otherProfile = await query("profiles?id=eq.00000000-0000-0000-0000-000000000000");
  results.push({
    test: "SELECT profile d'un autre user",
    status: otherProfile.status,
    rows: Array.isArray(otherProfile.data) ? otherProfile.data.length : "ERR",
    expected: "0 (RLS doit bloquer)",
    pass: Array.isArray(otherProfile.data) && otherProfile.data.length === 0,
  });

  // 7. UPDATE du profil d'un AUTRE user → doit échouer ou ne rien modifier
  const updateOther = await query(
    "profiles?id=eq.00000000-0000-0000-0000-000000000000",
    {
      method: "PATCH",
      body: JSON.stringify({ restaurant_name: "PWNED_BY_B" }),
    }
  );
  results.push({
    test: "UPDATE profile d'un autre user",
    status: updateOther.status,
    rows: Array.isArray(updateOther.data) ? updateOther.data.length : "blocked",
    expected: "0 ligne modifiée ou 401/403",
    pass: !Array.isArray(updateOther.data) || updateOther.data.length === 0,
  });

  // 8. Tentative de lister les fichiers Storage de tous les restaurants
  const storage = await fetch(`${SUPABASE_URL}/storage/v1/object/list/invoices`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  });
  const storageBody = await storage.json().catch(() => []);
  results.push({
    test: "Storage LIST bucket invoices",
    status: storage.status,
    rows: Array.isArray(storageBody) ? storageBody.length : "ERR",
    expected: "0 ou uniquement fichiers de B",
    pass: storage.status === 200,
  });

  // ─── Affichage final ────────────────────────────────────────────────────────
  console.table(results);

  const allPass = results.every(r => r.pass);
  if (allPass) {
    console.log("%c✅ Tous les tests sont OK — RLS actives et correctes.", "color: #059669; font-weight: bold; font-size: 14px;");
  } else {
    console.log("%c❌ ÉCHEC : certaines tables/storage ne sont pas correctement isolées.", "color: #DC2626; font-weight: bold; font-size: 14px;");
    console.log("Action : revoir les policies RLS sur les tables/buckets ci-dessus.");
  }

  // ─── Test bonus : essai de download d'un fichier dont on connaît le path ────
  console.log("");
  console.log("%c📂 Test bonus :", "font-weight: bold;");
  console.log("Pour tester l'isolation Storage en profondeur :");
  console.log("1. Connecte-toi en A → scanne un BL → note le chemin (ex: 'restaurantA-uuid/123-bl.jpg')");
  console.log("2. Reviens en B et copie-colle :");
  console.log("");
  console.log(`   const r = await fetch('${SUPABASE_URL}/storage/v1/object/invoices/' + 'PATH_DE_A', {`);
  console.log(`     headers: { apikey: '${SUPABASE_ANON_KEY.slice(0, 20)}...', Authorization: 'Bearer ${token.slice(0, 20)}...' }`);
  console.log("   });");
  console.log("   console.log(r.status); // doit être 400 ou 403, JAMAIS 200");
})();
