# Checklist de validation terrain — Yield

**Outil de bord pour les tests end-to-end sur bons de livraison réels.**

Ce document accompagne Lucas lors de la phase pilote avec les 15 ambassadeurs
du Gers. Il sert à valider que les correctifs apportés lors de l'audit
technique tiennent face à des bons de livraison (BL) réels, avant tout
passage en mode payant.

## 1. Objectif du document

**Pour qui** : Lucas, accompagné de l'ambassadeur lors de chaque session
d'installation chez le restaurateur.

**Quand** : avant la bascule du compte en mode payant, idéalement pendant
la première session « concierge » d'installation chez chaque ambassadeur.
Une seconde passe est possible un mois plus tard pour valider les corrections
de bugs trouvés en première passe.

**Pourquoi** : les correctifs de l'audit technique (regroupés sous les codes
C1 à C6) ont été validés par simulation mentale et par lecture du code, mais
pas confrontés à des BL réels avec leurs imperfections (libellés exotiques,
photos de travers, fournisseurs locaux mal connus de l'IA, etc.). Ce
protocole permet d'identifier les bugs résiduels avant qu'un client payant
ne les rencontre.

**Comment l'utiliser** : ce document est conçu pour être **imprimé**. Lucas
remplit les fiches de la section 7 au stylo pendant les tests, debout en
cuisine, le téléphone dans l'autre main. Une version numérique reste
disponible dans le repo pour synthèse post-tests.

---

## 2. Prérequis avant de commencer les tests

Avant la première session de test, vérifier que les éléments suivants sont
en place :

- ☐ Migration **024** (`supplier_id` sur `price_history` — Fix C5) appliquée
  sur Supabase production. Vérifier via SQL Editor :
  `select count(*) from public.price_history where supplier_id is null;` →
  proche de 0 attendu.

- ☐ Migration **025** (`name_normalized` sur `products` — Fix C4 Temps 1)
  appliquée + **script de backfill exécuté** :
  `npx tsx scripts/backfill-product-names.ts --apply`. Vérifier :
  `select count(*) from public.products where name_normalized is null;` → 0.

- ☐ Migration **026** (extension `pg_trgm` + table `pending_product_matches`
  + colonne `invoice_items.pending_match` — Fix C4 Temps 2) appliquée.

- ☐ Sentry configuré dans Vercel (`SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`).
  Facultatif mais fortement recommandé : permet de capturer les erreurs
  imprévues qui apparaîtraient lors des tests sans avoir à fouiller dans
  les logs Vercel à la main.

- ☐ Compte test fonctionnel sur l'app (idéalement le compte ambassadeur
  lui-même, sinon un compte test dédié pour ne pas polluer la base
  ambassadeur).

- ☐ Téléphone chargé, lumière correcte sur la zone de scan en cuisine,
  espace propre pour poser le BL à plat.

- ☐ **15 à 20 BL physiques collectés**, couvrant les 5 catégories de la
  section 3. Ces BL peuvent venir de l'ambassadeur lui-même (ses BL
  récents) ou être collectés en amont auprès de contacts du Gers.

- ☐ Ce document **imprimé en plusieurs exemplaires** (un par session
  ambassadeur), avec stylo bille.

**Termes techniques utilisés dans ce document** (explication à la première
occurrence) :

- **BL** : bon de livraison fournisseur. Le document papier ou PDF que le
  livreur dépose à la réception.
- **OCR** : reconnaissance optique de caractères. C'est l'étape où l'IA lit
  le BL pour en extraire les lignes produits/prix.
- **Quasi-match** : libellé qui ressemble à un produit déjà en base mais
  n'est pas identique (ex : « Tomate grappe BIO 4 kg » vs « Tomate grappe
  4 kg »).
- **needs_review** : drapeau interne posé par l'app sur une ligne suspecte
  (prix aberrant, divergence quantité × prix vs total, libellé vide).
- **Pending match** : ligne en attente de validation chef parce qu'un
  produit similaire existe déjà — l'app demande confirmation avant de créer
  un doublon.

---

## 3. Protocole de collecte des BL

**Objectif** : couvrir une diversité de fournisseurs et de niveaux de
difficulté pour que les tests soient représentatifs de la réalité terrain.

| Catégorie | Quantité min | Sources suggérées |
| --- | --- | --- |
| Grossistes nationaux | 3 | Metro, Promocash, Pomona, Brake, Sysco |
| Distributeurs régionaux | 2 | France Frais, Transgourmet |
| Fournisseurs locaux Gers | 3 | Bouchers, primeurs, fromagers du département |
| BL difficiles | 4 | Manuscrit, photo de travers, multi-pages, raturé |
| Cas limites volontaires | 3 | BL avec prix fabriqué aberrant, libellé inconnu, changement de fournisseur sur produit existant |

### Sources locales potentielles dans le Gers

Quelques pistes pour la catégorie « Fournisseurs locaux ». Liste indicative,
à adapter selon le réseau de l'ambassadeur :

- Boucheries du marché de **L'Isle-Jourdain** (marché vendredi matin)
- Primeurs sur le marché d'**Auch** (mardi/samedi matin, place de la
  Libération)
- Fromager artisanal autour de **Lectoure** (filière Côtes de Gascogne)
- Producteurs en vente directe via **Bienvenue à la Ferme Gers**
- Coopérative **Vivadour** (légumes, céréales) pour les BL « grossiste
  agricole »

### À noter avant chaque scan

Pour que les tests soient interprétables après coup, Lucas note les éléments
suivants sur la fiche de relevé (section 7) **avant** le scan :

- Nom du fournisseur
- Date du BL
- Nombre de lignes visibles
- Présence de mentions spéciales (BIO, AOP, IGP, etc.)
- Qualité de l'état du document (lisibilité, photo redressée ou non,
  multi-pages, ratures)

---

## 4. Cas de test détaillés par fix corrigé

Les 6 cas qui suivent valident un correctif précis de l'audit. Ils sont
listés dans l'ordre chronologique de complexité, pas dans l'ordre numérique
des codes. Lucas exécute ces tests en priorité, dans l'ordre indiqué.

### Test C1 — Conversion d'unité dans l'impact marge

**Contexte préalable** : le compte test a au moins une recette enregistrée
qui utilise 200 g de farine. Le produit « Farine » existe en base, enregistré
en kilogramme (unité = `kg`), avec un prix de référence (par exemple 1,00 €/kg).

**Action à effectuer** :

- Scanner un BL où la farine apparaît avec une hausse de prix de 1,00 €/kg
  (soit un nouveau prix de 2,00 €/kg si la référence était 1,00 €).
- Attendre la fin du traitement IA (poll 30-60 secondes).
- Ouvrir la facture créée, observer la section « Recettes impactées » sur
  le dashboard ou dans le détail du produit Farine.

**Comportement attendu** :

- Un encart « Recettes affectées » apparaît avec la recette qui utilise la
  farine.
- L'impact marge affiché par portion est **proche de 0,20 €** (soit
  1,00 €/kg × 200 g = 1,00 € × 0,2 = 0,20 €).
- L'alerte de variation de prix est créée (visible dans la cloche
  notifications du dashboard).

**Comportement à NE PAS observer** :

- Impact marge affiché à **200 €** par portion → signe que la conversion
  d'unité (g → kg) n'est pas appliquée. C'était exactement le bug que C1
  corrige.
- Impact marge supérieur à 1,00 € par portion pour cet exemple → anomalie.
- Impact marge inférieur à 0,05 € → anomalie (sous-évaluation).

**Critère de validation** : ☐ OK    ☐ KO    ☐ Anomalie partielle

**Notes** :

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

### Test C3 — Seuils de santé des recettes

**Contexte préalable** : le compte test contient 3 recettes avec des marges
brutes respectivement de 50 %, 60 % et 70 %. Si nécessaire, ajuster les prix
de vente ou les quantités d'ingrédients pour atteindre ces valeurs avant le
test.

**Action à effectuer** :

- Ouvrir la page « Mes recettes » depuis le dashboard.
- Observer la pastille de couleur ou le badge de chaque recette.
- Ouvrir aussi le bandeau « Santé de votre carte » sur le dashboard pour
  vérifier la cohérence du compteur.

**Comportement attendu** :

- Recette à **50 % de marge** → affichée en **rouge / critique** (zone
  `< 55 %`).
- Recette à **60 % de marge** → affichée en **orange / à surveiller** (zone
  `55-65 %`).
- Recette à **70 % de marge** → affichée en **vert / saine** (zone `≥ 65 %`).
- Le compteur « Santé de votre carte » sur le dashboard cohérent avec ces
  3 recettes (par exemple « 1 critique, 1 à surveiller, 1 saine »).

**Comportement à NE PAS observer** :

- Anciens seuils visibles : « < 70 % critique », « 70-75 % à surveiller »,
  « ≥ 75 % saine » → signe que l'ancien code stale n'a pas été remplacé.
- Couleurs incohérentes avec les pourcentages (ex : 60 % en vert).
- Compteur dashboard qui ne matche pas le nombre réel de recettes par état.

**Critère de validation** : ☐ OK    ☐ KO    ☐ Anomalie partielle

**Notes** :

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

### Test C4 Temps 1 — Normalisation des libellés produits

**Contexte préalable** : la base produits du compte test ne contient **aucun
produit** qui ressemble à « Tomate grappe ». Vérifier dans la page « Mes
recettes » → « Catalogue produits » ou via une recherche.

**Action à effectuer** :

- **Action 1** : créer un BL test (ou utiliser un vrai BL) contenant la
  ligne `TOMATE GRAPPE 4KG` (tout en majuscules, sans espace entre 4 et KG).
  Scanner ce BL et attendre la fin du traitement.
- **Action 2** : créer un second BL test contenant la ligne
  `Tomate grappe 4 kg` (casse mixte, espace entre 4 et kg). Scanner ce
  second BL et attendre la fin du traitement.

**Comportement attendu** :

- Après Action 1 : un nouveau produit « TOMATE GRAPPE 4KG » apparaît dans
  le catalogue.
- Après Action 2 : **aucun nouveau produit n'est créé**. L'app reconnaît la
  variation orthographique et lie la nouvelle ligne au produit existant du
  premier scan. L'historique de prix du produit s'enrichit d'un second
  point.

**Comportement à NE PAS observer** :

- Deux produits distincts dans le catalogue (« TOMATE GRAPPE 4KG » et
  « Tomate grappe 4 kg ») → signe que la normalisation `name_normalized`
  ne fonctionne pas ou que la migration 025 n'a pas été appliquée.
- L'app refuse silencieusement le second scan (status `error` sans message).

**Critère de validation** : ☐ OK    ☐ KO    ☐ Anomalie partielle

**Notes** :

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

### Test C4 Temps 2 — Détection des quasi-matches (produits ressemblants)

**Contexte préalable** : à la suite du Test C4 Temps 1, un produit
« Tomate grappe 4 kg » existe en base avec son historique de prix.

**Action à effectuer** :

- Créer un BL test contenant la ligne `Tomate grappe BIO 4kg` (l'ajout de
  « BIO » est la différence par rapport au produit existant). Scanner ce
  BL.

**Comportement attendu** :

- Sur la page détail de la facture créée, un **bandeau jaune** apparaît :
  « X produit(s) ressemble(nt) à un existant — en attente de validation ».
- Aucune nouvelle entrée n'est créée dans le catalogue produits (le doublon
  est évité).
- La ligne « Tomate grappe BIO 4kg » apparaît dans la liste des items de
  la facture avec un état distinct (visuellement marquée comme en attente).
- **Aucune alerte de hausse de prix n'est déclenchée** sur cette ligne.
- Côté base : dans Supabase Studio, table `pending_product_matches`, une
  nouvelle ligne existe avec `raw_label = "Tomate grappe BIO 4kg"` et un
  tableau `candidate_product_ids` non vide.

**Comportement à NE PAS observer** :

- Création silencieuse d'un nouveau produit « Tomate grappe BIO 4kg » dans
  le catalogue (cas où la détection n'aurait pas tourné).
- Alerte de hausse de prix déclenchée alors que ce n'est pas la même
  référence produit.
- Crash ou erreur 500 pendant le scan.

**Critère de validation** : ☐ OK    ☐ KO    ☐ Anomalie partielle

**Notes** :

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

### Test C5 — Alertes par fournisseur (anti faux positifs inter-fournisseurs)

**Contexte préalable** : compte test propre. Aucun produit « Tomate » ne
doit avoir d'historique de prix au début du test.

**Action à effectuer** :

- **Action 1** : scanner un BL Metro qui contient « Tomate » à **2,00 €/kg**.
- **Action 2** : scanner un BL Promocash qui contient la même tomate à
  **3,00 €/kg**.
- **Action 3** : scanner un second BL Metro avec tomate à **2,50 €/kg**.
- **Action 4** : scanner un second BL Promocash avec tomate à **3,30 €/kg**.

**Comportement attendu** :

- Après Action 1 : produit Tomate créé, historique = 1 ligne (Metro 2 €).
  **Aucune alerte** (premier prix de référence).
- Après Action 2 : historique enrichi (Promocash 3 €). **Aucune alerte**
  malgré la différence 2 € → 3 € car c'est un premier scan chez ce
  fournisseur, pas une hausse.
- Après Action 3 : **alerte +25 %** déclenchée chez Metro (de 2 € à 2,50 €).
- Après Action 4 : **alerte +10 %** déclenchée chez Promocash (de 3 € à
  3,30 €).

**Comportement à NE PAS observer** :

- Alerte déclenchée à l'Action 2 (« +50 % chez Promocash ») → ce serait une
  fausse alerte inter-fournisseurs, exactement le bug que C5 corrige.
- Mélange des historiques (l'alerte de l'Action 3 doit comparer 2,50 € à
  2 € chez Metro, pas à 3 € chez Promocash).
- Alerte sur l'Action 4 qui comparerait à un prix Metro.

**Critère de validation** : ☐ OK    ☐ KO    ☐ Anomalie partielle

**Notes** :

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

### Test C6 — Sanity check sur prix hallucinés par l'IA

**Contexte préalable** : compte test fonctionnel.

**Action à effectuer** :

Deux pistes selon la facilité :

- **Piste A (préférée)** : trouver un BL réel où l'IA pourrait halluciner
  un prix (BL difficile, lisibilité moyenne). Scanner et observer.
- **Piste B (à défaut)** : fabriquer un BL test en éditant un BL existant
  avec un prix volontairement aberrant (par exemple coller à la main
  « 50 000,00 € » sur un produit). Scanner ce BL truqué.

**Comportement attendu** :

- L'item au prix aberrant est créé dans la facture mais **flaggé needs_review**
  (drapeau interne). Côté UI : pas d'affichage spécifique en V1 (la
  fonctionnalité d'affichage des needs_review est documentée en TODO),
  mais le comportement de fond est :
- **Aucune entrée n'est ajoutée à l'historique de prix** (`price_history`)
  pour cet item.
- **Aucune alerte de hausse** n'est déclenchée.
- Côté Supabase Studio, table `invoice_items` : la ligne existe avec
  `matched = false`. Côté Sentry (si configuré) : un événement de niveau
  `warn` est remonté avec le scope `[audit-fix C6]`.

**Comportement à NE PAS observer** :

- Le prix aberrant rentre dans l'historique de prix → toutes les futures
  alertes sur ce produit seront polluées par cette valeur.
- L'alerte « +50 000 % » apparaît sur le dashboard.
- Crash du pipeline de scan.

**Critère de validation** : ☐ OK    ☐ KO    ☐ Anomalie partielle

**Notes** :

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

## 5. Cas de test transverses

Tests qui ne ciblent pas un fix précis mais qui valident la robustesse
générale du produit. À cocher au fur et à mesure.

- **OCR sur BL flou ou photographié de travers**
  - Action : scanner un BL volontairement flou ou pris à 30° d'inclinaison.
  - Attendu : l'app accepte le scan, lance le traitement IA, et soit
    extrait les lignes lisibles soit affiche un message d'erreur clair
    (« BL illisible, réessayez avec une photo plus nette »).
  - Anomalie : crash, écran blanc, ou facture créée avec des données
    fantaisistes sans flag needs_review.
  - ☐ OK    ☐ KO

- **BL multi-pages (recto-verso ou plusieurs feuilles)**
  - Action : scanner les pages une par une en utilisant le bouton « Ajouter
    une page » dans le scanner, puis valider l'ensemble.
  - Attendu : toutes les pages sont traitées comme une facture unique, le
    total et les items reflètent l'ensemble du BL.
  - Anomalie : seule la première page est traitée, ou plusieurs factures
    distinctes sont créées.
  - ☐ OK    ☐ KO

- **BL manuscrit (BL des petits fournisseurs locaux)**
  - Action : scanner un BL écrit à la main.
  - Attendu : taux de réussite OCR raisonnable (50 % minimum sur les lignes
    lisibles), pas de crash, items en needs_review ou matched=false là où
    l'IA a un doute.
  - Anomalie : crash, ou items créés avec des prix manifestement faux sans
    flag de revue.
  - ☐ OK    ☐ KO

- **Coupure réseau pendant l'upload**
  - Action : couper le wifi/4G juste après avoir lancé un scan.
  - Attendu : message d'erreur clair, possibilité de reprendre le scan une
    fois la connexion rétablie. Aucune facture « fantôme » créée en base.
  - Anomalie : spinner infini, ou facture créée avec status `pending`
    indéfiniment.
  - ☐ OK    ☐ KO

- **Scan d'un BL en double**
  - Action : scanner deux fois le même BL (même fournisseur, même numéro,
    même date) à 5 minutes d'intervalle.
  - Attendu : le second scan est détecté comme doublon (message « Cette
    facture a déjà été scannée le... ») ou la déduplication est silencieuse
    mais visible côté base (pas de double entrée).
  - Anomalie : 2 factures distinctes créées, l'historique de prix est
    pollué d'un point doublon.
  - ☐ OK    ☐ KO

- **Suppression d'une facture**
  - Action : depuis le détail d'une facture, utiliser la fonction
    « Supprimer » (si disponible) ou demander à Lucas comment supprimer
    manuellement.
  - Attendu : la facture disparaît du dashboard, les `invoice_items` sont
    supprimés en cascade, les recettes liées au produit ne sont pas cassées
    (le produit reste, son historique de prix est juste raccourci).
  - Anomalie : crash sur les pages recettes liées après suppression, ou
    données orphelines en base.
  - ☐ OK    ☐ KO

---

## 6. Tests UI / UX

Tests d'utilisabilité à exécuter dans l'ordre, idéalement en demandant à
l'ambassadeur de réaliser les actions lui-même pour observer sa friction
réelle.

- **Navigation principale**
  - L'ambassadeur passe seul du dashboard à la page factures, à la page
    recettes, à son profil, et revient au dashboard. Hésitation à observer ?
  - ☐ Fluide    ☐ Friction mineure    ☐ Friction majeure

- **Comportement responsive**
  - Tester l'app sur téléphone (vertical), tablette (horizontal), desktop.
  - Les éléments critiques (bouton de scan, liste des factures, alertes)
    restent accessibles et lisibles.
  - ☐ Conforme    ☐ Problème sur un format
  - Format en cause : _________________________________

- **États vides**
  - Compte tout neuf : aucun BL, aucune recette, aucune alerte.
  - Le dashboard affiche-t-il des messages explicites (« Scannez votre
    premier BL pour démarrer », etc.) ou des écrans vides anxiogènes ?
  - ☐ Messages clairs    ☐ Écrans vides confus

- **Onboarding du premier scan**
  - Compter le nombre de clics entre « ouverture de l'app » et
    « premier BL scanné avec succès » pour un compte tout neuf.
  - Cible : ≤ 5 clics. Si supérieur, identifier l'étape la plus pénible.
  - Nombre de clics relevé : ___

- **Messages d'erreur**
  - Provoquer plusieurs erreurs (mauvais format de fichier, photo
    illisible, réseau coupé). Les messages affichés sont-ils
    compréhensibles par un chef non technique ?
  - ☐ Tous clairs    ☐ Au moins un message technique illisible
  - Message problématique noté : _________________________________

---

## 7. Fiche de relevé par BL (à photocopier autant de fois que nécessaire)

Une fiche par BL testé. Lucas la remplit au stylo pendant le test.

```
═══════════════════════════════════════════════════════════════
  BL #_____                          Date du test : ___/___/______
═══════════════════════════════════════════════════════════════

  Fournisseur : __________________________________________
  Date du BL  : ___/___/______
  Nombre de lignes : _____

  Qualité photo :
    ☐ Excellente   ☐ Bonne   ☐ Moyenne   ☐ Mauvaise

  Mentions spéciales :
    ☐ BIO    ☐ AOP    ☐ IGP    ☐ Manuscrit    ☐ Multi-pages

  Catégorie du test (cf. section 3) :
    ☐ Grossiste national
    ☐ Distributeur régional
    ☐ Fournisseur local Gers
    ☐ BL difficile
    ☐ Cas limite volontaire

  ─── Résultat OCR ───

    ☐ Succès complet
    ☐ Succès partiel (    /    lignes correctement extraites)
    ☐ Échec total

  ─── Chiffres relevés ───

  Items créés en base       : _____
  Items en pending_match    : _____
  Items en needs_review     : _____
  Alertes générées          : _____

  ─── Bugs observés ───

  ____________________________________________________________

  ____________________________________________________________

  ____________________________________________________________

  ____________________________________________________________

  ─── Sévérité globale ───

    ☐ Aucun problème
    ☐ Friction mineure (usable mais à améliorer)
    ☐ Friction majeure (utilisable avec contournement)
    ☐ Bloquant (utilisateur ne peut pas continuer)

  ─── Notes libres ───

  ____________________________________________________________

  ____________________________________________________________

  ____________________________________________________________

═══════════════════════════════════════════════════════════════
```

---

## 8. Synthèse à remplir en fin de tests

Après l'ensemble des sessions ambassadeurs, Lucas remplit cette synthèse à
partir des fiches de la section 7.

### Tableau récapitulatif par catégorie

| Catégorie | BL testés | Taux succès OCR | Bugs critiques | Bugs mineurs |
| --- | --- | --- | --- | --- |
| Grossistes nationaux | _____ | _____ % | _____ | _____ |
| Distributeurs régionaux | _____ | _____ % | _____ | _____ |
| Fournisseurs locaux Gers | _____ | _____ % | _____ | _____ |
| BL difficiles | _____ | _____ % | _____ | _____ |
| Cas limites volontaires | _____ | _____ % | _____ | _____ |
| **Total** | _____ | _____ % | _____ | _____ |

### Liste exhaustive des bugs identifiés à corriger avant lancement payant

| # | Description du bug | Fichier(s) suspecté(s) | Sévérité | Priorité | Statut |
| --- | --- | --- | --- | --- | --- |
| 01 | ____________________________ | _________ | __ | __ | À faire |
| 02 | ____________________________ | _________ | __ | __ | À faire |
| 03 | ____________________________ | _________ | __ | __ | À faire |
| 04 | ____________________________ | _________ | __ | __ | À faire |
| 05 | ____________________________ | _________ | __ | __ | À faire |
| 06 | ____________________________ | _________ | __ | __ | À faire |
| 07 | ____________________________ | _________ | __ | __ | À faire |
| 08 | ____________________________ | _________ | __ | __ | À faire |

**Légende sévérité** : B = Bloquant, J = Friction majeure, M = Friction
mineure.
**Légende priorité** : 1 = avant lancement, 2 = post-lancement < 30j, 3 =
backlog.

---

## 9. Procédure post-tests

Une fois la phase de tests terminée et la synthèse de la section 8
complétée, Lucas suit cette procédure.

1. **Lucas synthétise les bugs identifiés** dans le tableau de la section 8
   en agrégeant les remontées de chaque fiche de relevé.

2. **Lucas trie les bugs par criticité** : d'abord les Bloquants, puis les
   Frictions majeures, enfin les Frictions mineures. Les Bloquants doivent
   tous être traités avant le passage en mode payant.

3. **Lucas crée une nouvelle branche git** dédiée :
   `git checkout -b audit-post-qa-fixes` à partir de `main` (une fois la
   branche `audit-fix-critical` mergée).

4. **Pour chaque bug Bloquant ou majeur**, Lucas rédige un prompt précis
   pour Claude Code, en suivant le même format que les prompts de la
   mission audit (contexte / procédure / livrables attendus / format
   commit). Un prompt par bug pour ne pas mélanger les périmètres.

5. **Une fois les bugs Bloquants traités**, Lucas relance les tests des
   sections 4 et 5 sur les BL qui avaient révélé les bugs corrigés. La
   correction est validée seulement si le scénario reproduit donne un
   résultat OK.

6. **Quand zéro bug Bloquant reste et que les Frictions majeures sont
   soit corrigées soit explicitement reportées au backlog**, Lucas donne
   le feu vert au passage en mode payant : activation du checkout Stripe
   live, communication aux ambassadeurs, démarrage de la facturation.

---

## Annexe — Récap des migrations audit à appliquer

Pour mémoire, ces migrations doivent être appliquées sur Supabase
production avant de démarrer les tests de la section 4. Détail complet
dans `docs/deployment-notes.md`.

| Migration | Fix associé | Action manuelle additionnelle |
| --- | --- | --- |
| 020 | Cron monthly-recap | Aucune |
| 021 | Anti-tampering profils | Aucune |
| 022 | RLS profiles | Aucune |
| 023 | Seuils recettes 55/65 | Aucune |
| 024 | supplier_id sur price_history | Backfill SQL automatique |
| 025 | name_normalized sur products | `npx tsx scripts/backfill-product-names.ts --apply` |
| 026 | pg_trgm + pending_product_matches | Aucune |

---

*Document généré dans le cadre de la mission audit (branche `audit-fix-critical`).
Dernière mise à jour : 15 mai 2026.*
