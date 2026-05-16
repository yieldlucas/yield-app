# UI à concevoir — Validation des pending_matches (Fix audit C4 Temps 2)

**Statut** : backend livré dans la mission audit (migration 026 + edge function).
UI complète à concevoir post-merge, après les premiers retours ambassadeurs Gers.

Ce document est le brief de référence pour le futur sprint UI. Il fige les
décisions produit prises pendant la mission audit pour qu'elles ne soient pas
re-débattues en chambre, et il cadre le périmètre minimal attendu.

---

## Pourquoi cette UI n'a pas été livrée dans la mission audit

Décision prise lors du Fix C4 Temps 2 (15 mai 2026) :

1. L'estimation honnête de l'UI complète était 5-6h, à la limite haute du
   budget mission.
2. L'UI de validation est un **moment de vérité produit** : elle mérite des
   retours utilisateurs réels (volume de pendings réels, friction perçue,
   workflow chef en cuisine) avant d'être designée.
3. Le pire scénario serait une UI bancale qui sort au lancement, crée plus
   de friction qu'elle n'en résout, et doit être refaite après 2 mois.

V1 livrée : compteur informatif sur la page détail facture ("X produits
ressemblent à un existant — en attente de validation"). Aucune interaction.

---

## Contexte technique pour le futur dev

### Données disponibles en base

- **`invoice_items.pending_match = true`** + **`invoice_items.product_id = NULL`**
  → la ligne du BL est conservée (total_ht reste correct), mais le produit
  n'est pas encore identifié.
- **`pending_product_matches`** (table) contient pour chaque pending :
  - `invoice_item_id` (FK vers la ligne BL concernée)
  - `raw_label`, `normalized_label`, `unit`
  - `candidate_product_ids` (jsonb) : tableau `[{ product_id, name, similarity }]`
    trié par similarité décroissante, max 5 candidats, seuil 0.85
  - `resolved_at` (null tant que pas résolu)
  - `resolution` : `'merged'` (le chef a validé un candidat) ou `'created_new'`
    (le chef a refusé tous les candidats et créé un nouveau produit)

### Endpoint API à créer

`POST /api/invoices/[invoiceId]/resolve-match`

Body (cas merge) :
```json
{
  "pending_match_id": "uuid",
  "action": "merge",
  "candidate_product_id": "uuid"
}
```

Body (cas create new) :
```json
{
  "pending_match_id": "uuid",
  "action": "create_new"
}
```

Comportements serveur :

**Action `merge`** :
1. UPDATE `invoice_items SET product_id = <candidate>, pending_match = false`
2. INSERT `price_history` avec `(product_id = <candidate>, supplier_id, price_ht = unit_price_ht, invoice_id, source = 'invoice')`
3. Lire `getLastPrice(product_id, supplier_id)` AVANT l'insert (sinon on récupère le prix qu'on est en train d'écrire) → si variation > seuil, INSERT `margin_alerts`
4. UPDATE `pending_product_matches SET resolved_at = now(), resolution = 'merged'`
5. UPDATE `invoices.total_ht` recalcul (ou laisser inchangé si on considère que le total était déjà juste)

**Action `create_new`** :
1. INSERT `products` (name = raw_label, name_normalized, unit, supplier_id)
2. UPDATE `invoice_items SET product_id = <new>, pending_match = false`
3. INSERT `price_history` (pas d'alerte : c'est un premier prix)
4. UPDATE `pending_product_matches SET resolved_at = now(), resolution = 'created_new'`

---

## User story

> En tant que chef restaurateur, quand mon dernier scan de BL contient des
> lignes qui ressemblent à des produits que j'ai déjà en base, je veux pouvoir
> en un coup d'œil voir ces lignes, savoir à quel produit existant elles
> ressemblent, et décider rapidement si c'est le même article ou un nouveau,
> sans avoir à fouiller manuellement mon catalogue produits.

---

## Wireframe textuel

Sur la page détail facture (`/dashboard/invoices/[id]`), entre le bandeau
récap et la liste des items, afficher une section dédiée si pending_matches
non résolus :

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ 3 produits ressemblent à un existant — à valider            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Ligne BL : "Tomate grappe BIO 4kg"                        │  │
│  │ Quantité : 2  |  Prix unit : 6.80 €  |  Total : 13.60 €  │  │
│  │                                                            │  │
│  │ Vous avez peut-être déjà ce produit :                     │  │
│  │   • Tomate grappe 4 kg          [C'est le même]   91%     │  │
│  │   • Tomate cerise BIO 500g      [C'est le même]   87%     │  │
│  │                                                            │  │
│  │                              [Non, c'est un nouveau produit] │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Ligne BL : "Filet de saumon frais"                       │  │
│  │ ...                                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Une carte par pending. Pour chaque candidat (max 5) : bouton "C'est le même".
Un bouton global "Non, c'est un nouveau produit" en bas de la carte.

Le pourcentage de similarité est affiché de manière discrète (gris pâle) à
droite du candidat. Il sert d'aide à la décision mais ne doit pas être central.

---

## Comportements précis des boutons

### Bouton "C'est le même" (sur un candidat)

1. Confirmation discrète : tooltip ou inline ("Lier cette ligne à <nom du candidat> ?")
2. Au clic confirmé : POST `/api/invoices/[id]/resolve-match` avec action `merge`
3. Pendant la requête : spinner sur le bouton, carte légèrement opacifiée
4. Au retour 200 : la carte disparaît (animation slide-up), le compteur global
   décrémente. Si la liste est vide, le bandeau global disparaît.
5. Toast en bas d'écran : "Lié à <nom du candidat>. L'historique des prix de
   ce produit a été mis à jour."
6. Si une alerte a été déclenchée par la résolution (variation prix > seuil) :
   le toast inclut "Alerte créée : <produit> +X%".

### Bouton "Non, c'est un nouveau produit"

1. Confirmation : modal "Créer un nouveau produit avec le libellé '<raw_label>' ?"
2. Au clic confirmé : POST avec action `create_new`
3. Pendant la requête : spinner sur le bouton
4. Au retour 200 : la carte disparaît, le compteur décrémente.
5. Toast : "Nouveau produit créé : <raw_label>"

---

## Gestion des cas multi-items (Cas 2 du brief Temps 2)

Si un BL contient plusieurs lignes du même raw_label qui ressemblent au même
candidat (ex: 3 lignes "Tomate grappe BIO" qui matchent "Tomate grappe") :

- **V1** (à livrer) : chaque pending est une carte distincte, le chef valide
  une par une. Acceptable au volume actuel.
- **V2 envisagée** : bouton "Appliquer à toutes les lignes similaires" qui
  groupe les 3 résolutions en un appel. À considérer si on observe >50% des
  BL avec des pendings dupliqués.

---

## Comportement post-résolution

**Côté base de données** :
- `invoice_items.product_id` renseigné, `pending_match = false`
- `pending_product_matches.resolved_at` rempli
- `price_history` row insérée
- Éventuelle `margin_alerts` row insérée si variation > seuil

**Côté UI** :
- La carte de pending disparaît de la zone de validation
- La ligne apparaît dans la liste des items "standards" de la facture
- Le compteur du bandeau global décrémente
- Si la facture avait variation_pct = null (parce que tous les comparables
  étaient en pending), le recalcul peut éventuellement déclencher une vraie
  variation. À acter : recalcul automatique au moment de la résolution OU
  recalcul périodique ?

**Côté chef** :
- Le chef voit immédiatement le résultat de son action (toast + carte disparue)
- Aucune action de rafraîchissement manuelle nécessaire

---

## Cas particuliers (à acter avant le sprint UI)

### 1. Le chef ferme la page sans résoudre

Les pendings restent en base. Au prochain affichage de cette facture, ils
réapparaissent. Pas d'auto-résolution, pas de timeout. (Décision Temps 2)

### 2. Le chef résout un pending sur un BL ancien après plusieurs scans

Si la résolution `merge` insère un `price_history` avec une date plus récente
que le scan du BL (`recorded_at = now()`), l'historique aura une row avec un
prix "ancien" daté d'aujourd'hui. Légère incohérence d'horodatage.

**Reco** : utiliser `recorded_at = invoice.created_at` (la date du scan
original) au lieu de `now()` lors de la résolution. À documenter dans le
endpoint API.

### 3. Le candidat sélectionné a une unité différente de l'item

**Impossible par construction Temps 2** : `findSimilarProducts` filtre déjà
par `.eq("unit", item.unit)`. Tous les candidats retournés ont le même unit
que l'item entrant.

### 4. Le candidat sélectionné a été supprimé entre le scan et la résolution

Improbable (les products ne sont pas supprimables via l'UI aujourd'hui) mais
théoriquement possible. L'endpoint API doit vérifier que le `candidate_product_id`
existe encore avant d'appliquer le merge, et retourner 404 si non. Le frontend
affiche alors un message d'erreur et propose "Créer un nouveau produit" à la
place.

---

## Tests manuels à prévoir

1. Scan d'un BL avec une ligne ressemblant à un produit existant → carte
   pending affichée avec le bon candidat.
2. Clic sur "C'est le même" → carte disparaît, item apparaît dans la liste
   standard, price_history row créée.
3. Clic sur "Non, c'est un nouveau produit" → nouveau row dans products,
   item lié.
4. Scan d'un BL avec aucune correspondance → INSERT direct comme avant,
   pas de carte pending.
5. Scan d'un BL avec 3 lignes similaires au même candidat → 3 cartes pending
   distinctes.
6. Si une variation prix > seuil est détectée à la résolution → alerte
   marge créée et visible dans le dashboard.

---

## Estimation effort UI

- Endpoint API `/api/invoices/[id]/resolve-match` : 2h
- Composant React (carte pending + boutons + spinner + toast) : 2-3h
- Intégration page détail facture + tests manuels : 1h

**Total** : 5-6h sur un sprint dédié. À déclencher après 2-3 semaines de
production avec les 15 ambassadeurs Gers (volume de pendings réel observé).
