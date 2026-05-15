# Notes de déploiement

Procédures manuelles à exécuter lors du déploiement de certaines migrations
qui nécessitent une action côté code applicatif en plus du `ALTER TABLE`.

## Migration 024 — `supplier_id` sur `price_history` (Fix audit C5)

Ordre d'exécution **impératif** :

1. Appliquer `024_price_history_supplier.sql` dans Supabase SQL Editor (le backfill SQL s'exécute automatiquement, idempotent).
2. Vérifier post-migration :

   ```sql
   select count(*) from public.price_history
    where invoice_id is not null and supplier_id is null;
   ```

   Doit retourner `0`.
3. **Puis seulement après** déployer l'edge function modifiée (commit `28924bd`).
   Si l'edge function est déployée avant la migration, les INSERT échoueront
   (colonne `supplier_id` inexistante).

Fenêtre entre étapes 1 et 3 : courte (~minutes). Les nouveaux scans dans cette
fenêtre créeront des rows sans `supplier_id` mais le caller `getLastPrice` les
ignorera naturellement → pas d'alerte fantôme.

---

## Migration 025 — `name_normalized` sur `products` (Fix audit C4 Temps 1)

Cette migration ajoute la colonne nullable + index, mais **NE FAIT PAS** le
backfill en SQL. La normalisation utilise du JS (`toLowerCase`, `NFD`, mapping
ligatures `œ→oe`, regex unités) qui ne se reproduit pas trivialement en SQL
sans risque de divergence. Le backfill se fait via un script Node dédié.

Ordre d'exécution **impératif** :

1. Appliquer `025_products_name_normalized.sql` dans Supabase SQL Editor.
   La colonne est nullable, les rows existantes restent à `null` pour l'instant.
2. Vérifier en `--dry-run` (mode par défaut) que le script trouve les bons rows :

   ```bash
   npx tsx scripts/backfill-product-names.ts
   ```

   Inspecte la sortie : les libellés à normaliser doivent ressembler à ce que tu
   attends ("TOMATE 4KG" → "tomate 4 kg", etc.).
3. Lancer le backfill réel :

   ```bash
   npx tsx scripts/backfill-product-names.ts --apply
   ```

   Idempotent (relançable). Le script saute les rows déjà correctes et celles
   dont le `name` est illisible (vide après normalisation).
4. Vérifier post-backfill :

   ```sql
   select count(*) from public.products where name_normalized is null;
   ```

   Doit être proche de `0` (sauf produits dont le `name` est aberrant).
5. **Puis seulement après** déployer l'edge function modifiée (commit du Fix C4
   Temps 1). Si l'edge function est déployée avant le backfill, les nouveaux
   scans matcheront `.eq("name_normalized", ...)` sur des rows à `null` et
   créeront des doublons artificiels.

Pré-requis env vars pour le script :

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (bypasse RLS pour UPDATE en masse)

---

## Migration 026 — pg_trgm + pending_product_matches (Fix audit C4 Temps 2)

Pas de backfill nécessaire (la table `pending_product_matches` est vide à
la création, les pending_matches futurs seront créés au fur et à mesure
des nouveaux scans).

Procédure :

1. Appliquer `026_pg_trgm_pending_matches.sql` dans Supabase SQL Editor.
   La migration active `pg_trgm`, crée l'index trigram GIN, ajoute la
   colonne `invoice_items.pending_match` et crée la table `pending_product_matches`
   avec RLS.
2. Vérifier post-migration :

   ```sql
   select extname from pg_extension where extname = 'pg_trgm';
   -- → 1 row
   select count(*) from public.pending_product_matches;
   -- → 0
   select column_name from information_schema.columns
    where table_name = 'invoice_items' and column_name = 'pending_match';
   -- → 1 row
   ```

3. Déployer l'edge function modifiée. Les nouveaux scans dont les libellés
   ressemblent à des produits existants généreront des rows pending_product_matches.

**UI complète** : à concevoir dans un cycle dédié, brief dans
[`docs/ui-todo-pending-matches.md`](./ui-todo-pending-matches.md). En attendant,
la V1 affiche un compteur informatif sur la page détail facture
(`X produits ressemblent à un existant — en attente de validation`) sans
permettre l'interaction.

---

## Fix I4 — Configuration Sentry (monitoring d'erreurs en production)

Le SDK `@sentry/nextjs` est installé et instrumenté côté code. Reste à
créer le projet Sentry, récupérer le DSN, et ajouter les variables d'env
dans Vercel.

### Étapes côté Lucas (one-shot, ~15 min)

1. Aller sur [sentry.io](https://sentry.io) → créer un compte gratuit
   (free tier suffisant pour V1 : 5 000 errors + 10 000 perf events / mois).
2. Créer un nouveau projet → choisir **Next.js** comme plateforme.
3. Copier le **DSN** affiché (format `https://xxx@oxxx.ingest.sentry.io/yyy`).
4. Dans Vercel Dashboard → Project Settings → Environment Variables, ajouter
   (pour les 3 environnements Production, Preview, Development) :

   | Nom | Valeur | Obligatoire ? |
   | --- | --- | --- |
   | `SENTRY_DSN` | DSN copié | ✅ Oui |
   | `NEXT_PUBLIC_SENTRY_DSN` | Même DSN | ✅ Oui (pour le bundle browser) |
   | `SENTRY_ORG` | Slug de l'organisation Sentry | ⏭️ Optionnel (sourcemaps) |
   | `SENTRY_PROJECT` | Slug du projet Sentry | ⏭️ Optionnel (sourcemaps) |
   | `SENTRY_AUTH_TOKEN` | Token user (Sentry → Settings → Auth Tokens) | ⏭️ Optionnel (sourcemaps) |
   | `AUDIT_SENTRY_TEST_SECRET` | Valeur aléatoire — générer via `openssl rand -hex 32` | ✅ Oui (test endpoint) |

   **Note sur `SENTRY_AUTH_TOKEN`** : sans ce token, les sourcemaps ne sont
   pas uploadées et les stack traces remontent minifiées dans Sentry. Reste
   lisible avec un peu d'effort. À ajouter quand la lisibilité devient un
   problème terrain, pas obligatoire en V1.

   **Note sur `AUDIT_SENTRY_TEST_SECRET`** : DOIT être distinct du DSN. Générer
   avec `openssl rand -hex 32` côté terminal et coller la valeur. Cette var
   sert UNIQUEMENT à protéger l'endpoint de test `/api/sentry-test` — peut
   être supprimée plus tard (l'endpoint devient alors 404, ce qui est OK).

5. Redéployer (un push ou trigger manuel Vercel).

### Procédure de test post-déploiement

Une fois l'app redéployée avec les env vars :

```bash
curl "https://www.yieldapp.fr/api/sentry-test?secret=$AUDIT_SENTRY_TEST_SECRET"
```

(Remplacer `$AUDIT_SENTRY_TEST_SECRET` par la vraie valeur — ne pas commiter !)

Attendu :

- Réponse HTTP : 500 (le endpoint throw volontairement)
- Dashboard Sentry : nouvel event "[audit-fix I4] Sentry test triggered..."
  visible **sous 60 secondes**
- Tags présents : `release: <git_sha>`, scope, environment

Si l'event n'apparaît PAS : vérifier les env vars Vercel, vérifier les
logs Vercel Functions (l'init Sentry doit avoir tourné), vérifier que
`NEXT_PUBLIC_SENTRY_DSN` est bien set ET re-déployé (les vars publiques
s'embarquent au build, pas en runtime).

**⚠️ L'endpoint `/api/sentry-test` n'est PAS un endpoint de monitoring
continu.** C'est un endpoint de validation de configuration. Un seul appel
est nécessaire pour valider, puis la var `AUDIT_SENTRY_TEST_SECRET` peut
être supprimée. Rate-limité à 1 appel / minute pour éviter le spam Sentry.

### Filtrage PII

Le `beforeSend` configuré dans `sentry.{server,client,edge}.config.ts`
redacte automatiquement les champs sensibles dans les events Sentry :

- `email`, `raw_label`, `name`, `password`, `token`, `access_token`,
  `refresh_token`, `authorization`, `apikey`, `api_key`

Si tu ajoutes un nouveau champ sensible côté code, **étends la liste
`PII_KEYS`** dans les 3 fichiers `sentry.*.config.ts` ET dans `lib/logger.ts`
pour rester cohérent.

### Sampling

- **`tracesSampleRate: 0.1`** : 10% des transactions performance capturées.
  Conservateur pour économiser le quota free tier. À monter quand on aura
  un quota payant.
- **`sampleRate` (erreurs)** : laissé au défaut **1.0** = TOUTES les erreurs
  remontent. Ne pas baisser sur un projet à 15 ambassadeurs en bêta.
- **Session Replays** : désactivés (`replaysSessionSampleRate: 0`,
  `replaysOnErrorSampleRate: 0`). Feature lourde qui bouffe le quota.

### TODO — Brancher Sentry sur l'edge function Supabase

L'edge function `supabase/functions/process-invoice/index.ts` tourne en
**Deno isolé** (pas Node.js). Le SDK `@sentry/nextjs` ne la couvre PAS.
Les 3 call sites `captureException` dans ce fichier continuent de logger
via `console.warn/error` — **visibles dans Supabase Dashboard → Edge
Functions → Logs** (filtre niveau `error` ou `warn`).

En attendant le sub-fix dédié (`@sentry/deno` + setup Supabase Function
secrets, estimation 2-3h), configure une **alerte Supabase Logflare** sur
les patterns `[audit-fix C` et `error` pour être notifié des crashes de
l'edge function par mail.

### Suggestions d'alertes Sentry

À configurer dans Sentry → Alerts → Create Alert Rule :

1. **Email toutes erreurs prod** : `environment:production AND level:error`
   → notification immédiate. Démarrer large, raffiner après les premiers
   jours.
2. **Alerte spéciale process-invoice** : `tag:scope:"invoices/process"`
   → c'est le cœur métier, à monitorer en priorité.
3. **Alerte webhooks** : `tag:scope:"stripe/webhook"` OR
   `tag:scope:"webhooks/auth/user-created"` → critiques pour billing + signup.

---

## Fix audit PRO-LIMIT — Memo : Fair Use du forfait Pro (à implémenter lors de la commercialisation Pro)

Ce memo documente le **plan d'implémentation différé** du fair use technique
sur le forfait Pro. **Aucun code n'a été modifié dans la mission audit** pour
ce fix : c'est une décision délibérée (Voie 3), prise après analyse de l'écart
entre le brief initial et l'état réel du produit.

### Contexte business

Le forfait Pro à 39,99€/mois est annoncé "scans illimités" sur la landing,
mais **n'est pas commercialisé** en V1 (bloc "Bientôt — Me prévenir" qui
collecte des leads via mailto, aucun Stripe checkout actif vers ce forfait).

Pourquoi un fair use sera nécessaire à la commercialisation :

- Coût API Claude par scan : ~0,10–0,15€ (Sonnet vision + tokens output)
- Marge unitaire Pro : (39,99€ − coûts fixes Stripe/Vercel/Supabase) / N_scans
- À partir de **~300 scans/mois**, la marge nette par client Pro devient mince
- Au-delà de **~1000 scans/mois**, marge négative — un dark kitchen ou
  traiteur événementiel à 2000-3000 BL/mois nous coûterait plus cher que
  son abonnement

Pourquoi ce n'est pas implémenté en V1 audit :

- Forfait Pro non commercialisé, aucun risque économique immédiat
- Tous les abonnés actuels sont en Starter à 200 scans hard (cf
  `MONTHLY_SCAN_QUOTA` dans `app/api/invoices/process/route.ts`)
- Le scope réel du Pro va au-delà des "scans illimités" : multi-établissement,
  gestion comptable, comparaison fournisseurs. Les seuils ne peuvent pas être
  calibrés correctement aujourd'hui sans cette vision produit complète
- Coder maintenant créerait de la dette technique latente sur du code mort
  jusqu'à un événement business futur (commercialisation)

### Plan d'implémentation à exécuter au moment du lancement Pro

À suivre intégralement, dans cet ordre, le jour où le bouton de checkout Pro
devient actif :

1. **Stripe** : créer le Price Pro à 39,99€ dans Stripe Dashboard (mode live ET
   test). Récupérer les `price_id` Starter et Pro.
2. **Migration `subscription_tier`** : ajouter colonne `subscription_tier text`
   à `profiles` (valeurs `'starter'` | `'pro'` | `NULL`). Nullable. Pas de
   CHECK constraint stricte pour faciliter l'évolution future (`'pro_multi'`,
   `'enterprise'`, etc.).
3. **Index** : créer index partiel
   `CREATE INDEX ... ON profiles(subscription_tier) WHERE subscription_tier IS NOT NULL`
   pour accélérer les queries de filtrage par tier.
4. **Trigger anti-tampering** : étendre `prevent_subscription_tampering()`
   (cf migration 022) pour protéger `subscription_tier` — sinon un user
   pourrait s'auto-promouvoir Pro via DevTools (`supabase.from('profiles').update({subscription_tier:'pro'})`).
5. **Table `user_fair_use_alerts`** : créer table
   `(id, user_id, month text, alerted_at timestamptz)` avec contrainte
   `UNIQUE (user_id, month)` pour idempotence email admin. RLS owner via
   `restaurants.owner_id`.
6. **Backfill** : `UPDATE profiles SET subscription_tier = 'starter' WHERE is_subscribed = true`
   (tous les users actuels sont Starter par construction historique). À inclure
   dans la migration `subscription_tier` pour atomicité.
7. **Env vars Vercel** : ajouter `STRIPE_PRICE_ID_STARTER` et
   `STRIPE_PRICE_ID_PRO` (preview + production). Documenter qu'ils doivent
   matcher les Stripe Price IDs en mode live ET test.
8. **Webhook Stripe** (`app/api/stripe/webhook/route.ts`) : sur les events
   `customer.subscription.created` / `customer.subscription.updated`, lire
   `subscription.items.data[0].price.id`, mapper vers tier, mettre à jour
   `profiles.subscription_tier`. Sur `customer.subscription.deleted` →
   `subscription_tier = NULL` (déjà géré pour `is_subscribed`, à étendre).
9. **Logique d'autorisation** (`/api/invoices/process`) : remplacer
   `MONTHLY_SCAN_QUOTA = 200` constant par un quota tier-aware :
   - `tier === 'starter'` → 200 scans hard (préservé)
   - `tier === 'pro'` → fair use soft + hard (cf seuils ci-dessous)
   - `tier === null` (pas abonné) → flow trial 14j existant (préservé)
10. **Email admin idempotent** via Resend : au 3e fair_use_warning du mois
    pour un même user, envoyer "User X a dépassé 1000 scans ce mois. Action
    commerciale recommandée." Idempotence via `user_fair_use_alerts`.
11. **UI** : distinguer "YIELD Starter" / "YIELD Pro" sur :
    - `app/dashboard/profile/page.tsx` (carte abonnement)
    - `app/dashboard/_components/SubscriptionBanners.tsx` (ActivatedBanner)
    - `app/dashboard/_components/QuotaExceededModal.tsx` (le copy du
      "Bientôt — Forfait Pro" doit être retiré une fois le Pro live)
12. **CGV** (`app/terms/page.tsx`) : ajouter un paragraphe explicite sur le
    fair use. Texte recommandé : "Le forfait Pro inclut un usage 'fair use'
    adapté à un restaurant standard, plafonné techniquement à N scans par
    mois. Au-delà, nous adaptons votre formule en concertation. Les structures
    multi-établissements ou à très haute rotation peuvent contacter notre
    équipe pour un forfait sur-mesure." (N à fixer au moment de la
    commercialisation selon les seuils retenus.)

### Note sur la calibration des seuils

Les seuils 1000/1500 mentionnés dans le rapport d'audit initial étaient basés
sur un Pro = "scans illimités" sans services additionnels. Avec un Pro =
"multi-établissement + gestion comptable + comparaison fournisseurs", un user
Pro avec 3-5 établissements est légitime à 3-5× le volume de scans d'un Starter.

La calibration finale dépendra de :

- Nombre moyen d'établissements par client Pro
- Volume moyen de scans par établissement par mois
- Retours utilisateurs sur la friction perçue dans les premières semaines

**Reco initiale** (à valider au moment de l'implémentation) :

- `PRO_FAIR_USE_SOFT_LIMIT = 1500` — avertissement (continue de servir, log
  warning, email admin à partir du 3e du mois)
- `PRO_FAIR_USE_HARD_LIMIT = 3000` — blocage avec message courtois invitant
  à contacter l'équipe pour un sur-mesure

À ajuster après 1-2 mois d'usage Pro réel observé.

### Quick wins avant lancement Pro (out of scope audit)

Choses qui peuvent être faites en amont du lancement Pro sans toucher au code
business courant :

- Préparer le contenu CGV pour le Pro (paragraphe fair use, voir étape 12
  ci-dessus)
- Préparer un template Resend "Votre usage Pro dépasse le seuil normal" + un
  template admin "User X a dépassé 1000 scans ce mois"
- Préparer un endpoint admin `/api/admin/scan-usage` qui retourne par user
  le compte de scans du mois (utile pour debug commercial et pour
  pré-identifier les futurs power users)

### Estimation de charge

Implémentation complète au moment du lancement Pro : **5–6 heures**.

Décomposition :

- Migrations (`subscription_tier` + `user_fair_use_alerts` + trigger étendu) : 1h
- Backfill : 5 min (inclus dans migration)
- Webhook Stripe enrichi (mapping price_id → tier) : 1h
- Logique d'autorisation tier-aware : 1h
- Email admin idempotent : 30-45 min
- UI starter vs pro (3 fichiers) : 1-2h
- Tests manuels end-to-end : 30 min

---

## Fix audit R3 — Pages légales (CGU/CGV, Privacy, Mentions légales)

Trois pages légales en place avec des placeholders `[À COMPLÉTER : ...]` à
remplir une fois l'immatriculation officielle finalisée.

**⚠️ Ces documents ont été rédigés sans avocat. La structure est sérieuse et
complète pour un SaaS B2B FR, mais ce n'est PAS un avis juridique.**
Faire relire par un avocat ou un service en ligne (Captain Contrat / LegalPlace,
budget ~150-300 € HT) **avant le premier paiement encaissé**.

### Pages livrées

- `/legal` (`app/legal/page.tsx`) : mentions légales LCEN (éditeur, hébergeur,
  directeur de publication, responsable RGPD, propriété intellectuelle)
- `/terms` (`app/terms/page.tsx`) : CGU + CGV fusionnés (objet, accès,
  abonnement, rétractation B2B, résiliation, garantie 7j, disponibilité,
  responsabilité, propriété intellectuelle, force majeure, juridiction)
- `/privacy` (`app/privacy/page.tsx`) : politique de confidentialité RGPD
  (responsable traitement, données collectées, finalités, sous-traitants
  incluant Sentry + Resend, durée conservation, droits utilisateurs,
  sécurité, cookies, transferts hors UE, mention feature comparaison
  anonymisée k-anonymisation ≥ 5)

Lien `/legal` ajouté au footer de la landing (`app/page.tsx`).

### Placeholders à remplir (29 occurrences sur 3 fichiers)

Lancer `npm run check:legal` pour la liste exacte avec ligne + preview.

Synthèse par valeur métier (un même placeholder peut apparaître plusieurs fois) :

- Raison sociale exacte
- Forme juridique (EI / EURL / autre)
- Capital social (`"Capital de X €"` ou `"Non applicable (EI)"`)
- SIRET (14 chiffres)
- SIREN (9 chiffres)
- Code APE/NAF
- RCS ville et numéro (`"Non applicable (EI)"` si auto-entrepreneur)
- TVA intracommunautaire (`"Non assujetti (franchise en base)"` si EI)
- Adresse postale complète du siège
- Nom et prénom du représentant légal (= directeur de publication)
- Nom et prénom du responsable RGPD (peut être identique en EI)
- Juridiction compétente (tribunaux de la ville du siège)
- Téléphone de contact (optionnel)
- Date d'entrée en vigueur (DD/MM/YYYY)

### Procédure de remplissage et de déploiement

1. **Phase pré-SIRET** (actuelle) : laisser les placeholders. Activer le bandeau
   draft via env var Vercel sur preview + production :

   ```bash
   NEXT_PUBLIC_LEGAL_DRAFT=true
   ```

   Le bandeau ambre "⚠️ Document en cours de finalisation" s'affiche en haut
   des 3 pages.

2. **Création de l'auto-entreprise** : déposer le dossier en ligne, recevoir
   les notifications SIRET/SIREN/RCS.

3. **Remplir les placeholders** : faire un find/replace global dans le projet,
   ou éditer chaque fichier manuellement (`app/legal/page.tsx`,
   `app/terms/page.tsx`, `app/privacy/page.tsx`). Pour la date, format
   DD/MM/YYYY.

4. **Vérifier** :

   ```bash
   npm run check:legal
   ```

   Doit afficher `✓ Aucun placeholder résiduel`. Si placeholders restants, la
   commande les liste avec fichier:ligne.

5. **Relire par un avocat** (~150-300 € HT). Captain Contrat / LegalPlace
   proposent des forfaits CGU/CGV/Privacy à prix fixe.

6. **Supprimer `NEXT_PUBLIC_LEGAL_DRAFT`** des env vars Vercel.

7. **Déployer** : le hook prebuild (`scripts/check-legal-placeholders.ts`)
   vérifie `NODE_ENV=production` ET absence de placeholders. Si placeholder
   résiduel + production → exit 1, build Vercel échoue avec liste des
   placeholders concernés.

### Architecture séparation /cgu et /cgv à terme

V1 : CGU et CGV fusionnés dans `/terms` (12 sections). C'est acceptable pour
un SaaS B2B au lancement et la majorité des concurrents font pareil.

À discuter avec l'avocat lors de la revue juridique :

- Séparation `/cgu` (règles d'usage) et `/cgv` (paiement, abonnement) avec
  conditions d'acceptation distinctes — utile au lancement du forfait Pro
  pour clarifier les responsabilités contractuelles différenciées
- Création d'un `/cookies` dédié si on déploie du tracking analytics (V1
  utilise uniquement des cookies strictement nécessaires, mention courte
  dans `/privacy` suffit)

### TODO CRITIQUE — Consentement explicite utilisateur

**À régler avant le premier paiement encaissé** (cf article L221-15 et
suivants du Code de la consommation, et obligations preuve d'acceptation
contractuelle).

Aujourd'hui, l'inscription utilise un "browse wrap" implicite ("En continuant,
vous acceptez nos CGU et notre politique de confidentialité"). Acceptable
juridiquement en B2B au démarrage, mais une preuve explicite est plus solide.

À implémenter dans un sprint dédié (estimation **1.5-2 heures**) :

1. **Case à cocher obligatoire** dans le formulaire d'inscription
   (`app/page.tsx` étape email) avant le bouton "Recevoir le code OTP". Texte :
   "J'accepte les [CGU/CGV](/terms), la [Politique de confidentialité](/privacy)
   et les [Mentions légales](/legal)."
2. **Migration** : 2 colonnes sur `profiles` :
   - `cgv_accepted_at timestamptz` (nullable jusqu'à acceptation)
   - `cgv_version text` (semver type "1.0.0" — la version des CGV acceptée)
3. **Stockage au signup** : enregistrer `cgv_accepted_at = now()` et
   `cgv_version = "1.0.0"` au moment du `verifyOtp` réussi
4. **Check serveur** lors du checkout Stripe (`/api/checkout`) : refuser
   `payment_method_collection` si `cgv_accepted_at IS NULL` (cas migration
   pour les comptes pré-feature)

**Bonus à prévoir : re-consentement** quand les CGV changeront de version
majeure (passage 1.0.0 → 2.0.0). Au login, si `cgv_version < CURRENT_CGV_VERSION`,
afficher un modal "Nos conditions ont évolué. Merci de relire et de
réaccepter." Mise à jour de `cgv_accepted_at` et `cgv_version` après
acceptation. Cette logique n'est nécessaire qu'à la première bump de version
majeure, pas en V1.

### Estimation de charge — pages légales

Implémentation initiale (cette mission) : **~3 heures** (réalisée).

Suite à exécuter au moment de l'immatriculation :

- Remplissage des placeholders : 30 min
- Relecture avocat : 1 semaine d'attente externe, ~150-300 € HT
- Suppression `NEXT_PUBLIC_LEGAL_DRAFT` + redéploiement : 5 min

Consentement explicite (sprint dédié avant premier encaissement) : **1.5-2 heures**.
