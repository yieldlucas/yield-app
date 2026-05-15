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
