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
