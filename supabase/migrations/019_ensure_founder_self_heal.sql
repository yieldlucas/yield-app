-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019 — Self-heal founder metadata
--
-- Problème observé : un user peut se retrouver sans referral_code ni
-- founder_number si le webhook auth/user-created a échoué pour lui (timing,
-- panne réseau, mauvaise config webhook côté Supabase Dashboard). Du coup :
--   - L'user n'a pas de code à partager (parrainer)
--   - Plus grave : un autre user qui tape son code reçoit "invalid_code"
--     car le code est inexistant (référentiel non rempli)
--
-- Cette migration ajoute une RPC `ensure_founder_metadata()` SANS PARAM
-- que tout user authentifié peut appeler pour s'auto-attribuer numéro + code
-- s'il n'en a pas. Self-heal au mount du dashboard si referralCode est null.
--
-- Différence avec assign_founder_metadata(uuid) : celle-ci prend un user_id
-- (réservée au webhook service_role). La nouvelle utilise auth.uid() et est
-- safe à exposer aux authenticated users (impossible de toucher un autre user).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.ensure_founder_metadata()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  -- Délègue à la fonction existante (assignée par created_at, race-safe).
  perform public.assign_founder_metadata(caller_id);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ensure_founder_metadata() to authenticated;
