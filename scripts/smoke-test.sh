#!/usr/bin/env bash
# Smoke-test Yield — vérifie que la prod répond correctement sur :
#   - les pages publiques (200)
#   - les frontières d'authentification (401 si pas de token)
#   - les validations d'input (400 si mauvais payload)
#   - le bucket Storage en privé (pas de leak public)
#
# Usage : bash scripts/smoke-test.sh [BASE_URL]
#   - BASE_URL par défaut = https://www.yieldapp.fr
#
# Ne nécessite AUCUN secret, AUCUNE auth. Tout est en lecture publique
# ou test des chemins d'erreur. Sécuritaire à lancer n'importe quand.

set -u
BASE_URL="${1:-https://www.yieldapp.fr}"
SUPABASE_URL="https://rlhkvqiwnztapymrvwvj.supabase.co"

PASS=0
FAIL=0
WARN=0

# ─── Couleurs ───
if [ -t 1 ]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; DIM=""; BOLD=""; RESET=""
fi

# ─── Helper ───
check() {
  local name="$1"; local expected="$2"; local actual="$3"; local extra="${4:-}"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1))
    printf "  %s✓%s %s ${DIM}→ %s%s\n" "$GREEN" "$RESET" "$name" "$actual" "$RESET"
  else
    FAIL=$((FAIL+1))
    printf "  %s✗%s %s ${DIM}attendu %s, reçu %s%s\n" "$RED" "$RESET" "$name" "$expected" "$actual" "$RESET"
    [ -n "$extra" ] && printf "    ${DIM}%s%s\n" "$extra" "$RESET"
  fi
}

warn_check() {
  local name="$1"; local expected="$2"; local actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1))
    printf "  %s✓%s %s ${DIM}→ %s%s\n" "$GREEN" "$RESET" "$name" "$actual" "$RESET"
  else
    WARN=$((WARN+1))
    printf "  %s⚠%s %s ${DIM}attendu %s, reçu %s%s\n" "$YELLOW" "$RESET" "$name" "$expected" "$actual" "$RESET"
  fi
}

# Récupère uniquement le code HTTP
status() {
  curl -s -o /dev/null -w "%{http_code}" -m 15 "$@"
}

printf "\n${BOLD}━━━ Smoke-test Yield (%s) ━━━${RESET}\n\n" "$BASE_URL"

# ─── 1. Pages publiques ───
printf "${BOLD}1. Pages publiques${RESET}\n"
check "Landing page accessible"        "200" "$(status "$BASE_URL/")"
check "Manifest PWA"                   "200" "$(status "$BASE_URL/manifest.webmanifest")"
check "Page offline (PWA fallback)"    "200" "$(status "$BASE_URL/offline")"

# ─── 2. Webhook Stripe ───
printf "\n${BOLD}2. Webhook Stripe${RESET}\n"
check "Healthcheck GET sur webhook"    "200" "$(status "$BASE_URL/api/stripe/webhook")"
check "POST sans signature → 400"      "400" "$(status -X POST "$BASE_URL/api/stripe/webhook" -H "Content-Type: application/json" -d '{}')"
check "POST avec mauvaise sig → 400"   "400" "$(status -X POST "$BASE_URL/api/stripe/webhook" -H "Content-Type: application/json" -H "stripe-signature: t=1234,v1=invalid" -d '{}')"

# ─── 3. Frontières d'auth (toutes attendues = 401) ───
printf "\n${BOLD}3. Auth boundaries (sans token)${RESET}\n"
check "POST /api/checkout"             "401" "$(status -X POST "$BASE_URL/api/checkout")"
check "POST /api/billing/portal"       "401" "$(status -X POST "$BASE_URL/api/billing/portal")"
check "POST /api/account/delete"       "401" "$(status -X POST "$BASE_URL/api/account/delete")"
check "POST /api/invoices/process"     "401" "$(status -X POST "$BASE_URL/api/invoices/process")"
check "GET /api/export/csv"            "401" "$(status "$BASE_URL/api/export/csv")"

# Routes dynamiques par-id : besoin d'un id arbitraire (le 401 doit fire AVANT le lookup)
FAKE_ID="00000000-0000-0000-0000-000000000000"
check "GET /api/invoices/[id]/export-pdf"  "401" "$(status "$BASE_URL/api/invoices/$FAKE_ID/export-pdf")"
check "GET /api/invoices/[id]/export-csv"  "401" "$(status "$BASE_URL/api/invoices/$FAKE_ID/export-csv")"

# ─── 4. Storage Supabase — bucket privé ───
printf "\n${BOLD}4. Storage Supabase (bucket privé)${RESET}\n"
# Si le bucket est correctement privé, le endpoint /public/ doit refuser l'accès
# (400 Bad Request ou 404, mais surtout PAS 200).
PUB_STATUS="$(status "$SUPABASE_URL/storage/v1/object/public/invoices/test/fake.jpg")"
if [ "$PUB_STATUS" = "200" ]; then
  FAIL=$((FAIL+1))
  printf "  %s✗%s Bucket invoices accessible publiquement ${DIM}→ %s${RESET}\n" "$RED" "$RESET" "$PUB_STATUS"
  printf "    ${RED}DANGER : un attaquant peut lire les BL de tous les clients.${RESET}\n"
else
  PASS=$((PASS+1))
  printf "  %s✓%s Bucket invoices privé ${DIM}→ %s (pas 200)${RESET}\n" "$GREEN" "$RESET" "$PUB_STATUS"
fi

# ─── 5. Headers de sécurité ───
printf "\n${BOLD}5. Headers HTTPS${RESET}\n"
HSTS=$(curl -sI -m 10 "$BASE_URL/" | grep -i "strict-transport-security" | head -1)
if [ -n "$HSTS" ]; then
  PASS=$((PASS+1))
  printf "  %s✓%s HSTS actif ${DIM}→ %s${RESET}\n" "$GREEN" "$RESET" "$(echo "$HSTS" | tr -d '\r' | cut -c1-60)"
else
  WARN=$((WARN+1))
  printf "  %s⚠%s HSTS absent ${DIM}— Vercel l'ajoute normalement automatiquement${RESET}\n" "$YELLOW" "$RESET"
fi

# ─── 6. Edge function Supabase joignable ───
printf "\n${BOLD}6. Edge function process-invoice${RESET}\n"
# OPTIONS preflight doit passer (CORS), POST sans body doit erreur (400 ou 401)
warn_check "OPTIONS preflight"           "200" "$(status -X OPTIONS "$SUPABASE_URL/functions/v1/process-invoice" -H "Origin: https://www.yieldapp.fr")"
check      "POST sans auth → 401"        "401" "$(status -X POST "$SUPABASE_URL/functions/v1/process-invoice")"

# ─── Récap ───
TOTAL=$((PASS + FAIL + WARN))
printf "\n${BOLD}━━━ Récapitulatif ━━━${RESET}\n"
printf "  %s%d passés%s · " "$GREEN" "$PASS" "$RESET"
printf "%s%d warn%s · " "$YELLOW" "$WARN" "$RESET"
printf "%s%d échecs%s sur %d tests\n\n" "$RED" "$FAIL" "$RESET" "$TOTAL"

# ─── Checklist manuelle ───
printf "${BOLD}━━━ Tests manuels (à faire dans le navigateur) ━━━${RESET}\n\n"
cat <<EOF
Ces tests ne sont pas automatisables (besoin d'un user, d'une caméra, d'un
moyen de paiement Stripe test). Coche-les un par un.

${BOLD}A. Auth + trial${RESET}
  [ ] Signup nouveau compte → reçoit l'email de confirmation
  [ ] Login → atterrit sur /dashboard
  [ ] Bandeau "essai gratuit 14 jours" visible si pas abonné
  [ ] Badge quota "0/200" visible en haut à droite

${BOLD}B. Stripe (mode test, pas live !)${RESET}
  [ ] Clic "S'abonner" → ouvre Stripe Checkout
  [ ] Carte test 4242 4242 4242 4242 → paiement OK
  [ ] Retour /dashboard → bandeau "Activation en cours" puis "Activé"
  [ ] Bouton "Gérer mon abonnement" (profil) → ouvre Customer Portal

${BOLD}C. Scan${RESET}
  [ ] Bouton "Scanner un BL" → modal CameraGuide avec schémas vert/rouge
  [ ] "J'y vais" → caméra système s'ouvre
  [ ] Prendre 2-3 photos d'affilée → 2-3 thumbnails dans le tray du bas
  [ ] Recharger la page → les photos sont toujours dans le tray (IDB)
  [ ] "Envoyer le lot" → batch overlay → messages dynamiques :
       "Lecture des lignes..." → "Analyse des N produits..." → "Calcul des marges..."
  [ ] Une fois fini → la facture apparaît dans la timeline

${BOLD}D. Timeline${RESET}
  [ ] Cards montrent fournisseur en gras + date + total HT + badge variation
  [ ] Filter chips : "Tout" / "En hausse ↗" / "Ce mois" filtrent correctement
  [ ] Clic sur une card processed → ouvre la page détail

${BOLD}E. Page détail (Control Center)${RESET}
  [ ] Photo à gauche desktop / dessus mobile, click pour zoom plein écran
  [ ] Tableau avec libellé, qty, prix unit, variation
  [ ] Ghost pricing : "Avant : X.XX €" en gris sous le prix actuel
  [ ] Clic sur un prix → input numérique → modifier → Enter
  [ ] CTA "Valider les corrections" apparaît en bas
  [ ] Save → toast vert "Corrections enregistrées" + indicateur "Corrigé"
  [ ] Menu Exporter → PDF se télécharge, ouvre proprement
  [ ] Menu Exporter → CSV se télécharge, s'ouvre dans Excel sans soucis d'accents

${BOLD}F. Quota (test si tu peux atteindre 200 scans, sinon SQL trick)${RESET}
  [ ] Triche SQL : update usage_stats set scan_count = 200 where ...
  [ ] Tenter un scan → modal "Vous scannez beaucoup — bravo !"
  [ ] CTA "Découvrir le Pro" → ouvre Stripe Checkout

${BOLD}G. Sécurité (à valider une seule fois)${RESET}
  [ ] DevTools console : essayer
      ${DIM}await supabase.from('profiles').update({is_subscribed: true}).eq('id', user.id)${RESET}
      → doit afficher "is_subscribed can only be modified by service role"

EOF

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
EOF
