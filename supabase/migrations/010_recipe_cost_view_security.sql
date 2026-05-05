-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010 — Sécurisation de recipe_cost_view (security_invoker)
--
-- La vue recipe_cost_view (créée en 001) était sans `security_invoker = on`,
-- ce qui signifie qu'elle s'exécute avec les privilèges du créateur (rôle
-- propriétaire postgres) et BYPASS les RLS sur recipes / recipe_ingredients /
-- price_history. Un user authentifié peut potentiellement voir le coût matière
-- de toutes les recettes, tous restaurants confondus, en requêtant la vue
-- directement (la RLS sur les tables sous-jacentes est ignorée).
--
-- security_invoker = on force la vue à respecter les RLS du caller (auth.uid()),
-- alignant son comportement sur celui d'une SELECT directe sur les tables.
-- Disponible depuis Postgres 15 (Supabase tourne sur 15+).
-- ─────────────────────────────────────────────────────────────────────────────

alter view public.recipe_cost_view set (security_invoker = on);
