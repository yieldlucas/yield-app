-- ─────────────────────────────────────────────────────────────────────────────
-- Script de vérification migrations 020 / 021 / 022
--
-- Usage : copier-coller intégralement dans Supabase Dashboard → SQL Editor
-- → Run. Le résultat est une table { check, status, detail } qui retourne
-- PASS / FAIL pour chaque verrou critique.
--
-- Si tout est vert → migrations correctement appliquées, prod-ready.
-- Si un FAIL → ré-applique la migration concernée.
-- ─────────────────────────────────────────────────────────────────────────────

with checks as (

-- ═══ MIGRATION 020 ════════════════════════════════════════════════════════════

  -- 020.1 — Colonne trial_reminder_sent_at sur profiles
  select
    '020.1 column profiles.trial_reminder_sent_at' as check_name,
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'trial_reminder_sent_at'
    ) then 'PASS' else 'FAIL' end as status,
    'Idempotency cron trial-reminders' as detail

  union all

  -- 020.2 — Colonne last_monthly_recap_sent_at sur profiles
  select
    '020.2 column profiles.last_monthly_recap_sent_at',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'last_monthly_recap_sent_at'
    ) then 'PASS' else 'FAIL' end,
    'Idempotency cron monthly-recap'

  union all

  -- 020.3 — Signature monthly_recap_candidates avec les nouvelles colonnes
  select
    '020.3 RPC monthly_recap_candidates returns extended stats',
    case when (
      select count(*) = 8 from information_schema.routines r
      join information_schema.parameters p on p.specific_name = r.specific_name
      where r.routine_schema = 'public'
        and r.routine_name = 'monthly_recap_candidates'
        and p.parameter_mode = 'OUT'
        and p.parameter_name in (
          'user_id', 'email', 'restaurant_name', 'invoices_count',
          'alerts_count_period', 'recipes_total', 'top_rise_product', 'top_rise_pct'
        )
    ) then 'PASS' else 'FAIL' end,
    'La RPC retourne stats per-user scopées (fix data leak)'

  union all

-- ═══ MIGRATION 021 ════════════════════════════════════════════════════════════

  -- 021.1 — Trigger anti-tampering présent
  select
    '021.1 trigger trg_prevent_subscription_tampering exists',
    case when exists (
      select 1 from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'profiles'
        and trigger_name = 'trg_prevent_subscription_tampering'
    ) then 'PASS' else 'FAIL' end,
    'Trigger BEFORE UPDATE bloque les colonnes sensibles'

  union all

  -- 021.2 — Trigger couvre bien trial_extra_days, referral_code, referred_by_code,
  -- founder_number, normalized_email (recherche dans le source de la fonction).
  select
    '021.2 trigger function covers all sensitive columns',
    case when (
      select bool_and(pg_get_functiondef(p.oid) like '%' || col || '%')
      from pg_proc p, unnest(array[
        'trial_extra_days', 'referral_code', 'referred_by_code',
        'founder_number', 'normalized_email'
      ]) as col
      where p.proname = 'prevent_subscription_tampering' and p.pronamespace = 'public'::regnamespace
    ) then 'PASS' else 'FAIL' end,
    'Couvre trial_extra_days + referral_code + referred_by_code + founder_number + normalized_email'

  union all

  -- 021.3 — RPC apply_referral_code utilise le bypass GUC
  select
    '021.3 apply_referral_code uses bypass GUC',
    case when (
      select pg_get_functiondef(p.oid) like '%app.allow_profile_tamper%'
      from pg_proc p
      where p.proname = 'apply_referral_code' and p.pronamespace = 'public'::regnamespace
    ) then 'PASS' else 'FAIL' end,
    'RPC set le bypass avant son UPDATE privilégié'

  union all

  -- 021.4 — RPC assign_founder_metadata utilise le bypass GUC
  select
    '021.4 assign_founder_metadata uses bypass GUC',
    case when (
      select pg_get_functiondef(p.oid) like '%app.allow_profile_tamper%'
      from pg_proc p
      where p.proname = 'assign_founder_metadata' and p.pronamespace = 'public'::regnamespace
    ) then 'PASS' else 'FAIL' end,
    'RPC set le bypass avant son UPDATE privilégié'

  union all

-- ═══ MIGRATION 022 ════════════════════════════════════════════════════════════

  -- 022.1 — RLS activée sur profiles
  select
    '022.1 RLS enabled on public.profiles',
    case when (
      select relrowsecurity from pg_class
      where oid = 'public.profiles'::regclass
    ) then 'PASS' else 'FAIL' end,
    'Sans RLS, n''importe quel user voit tous les profils'

  union all

  -- 022.2 — Policy SELECT auth.uid() = id
  select
    '022.2 SELECT policy "Users select own profile" exists',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
        and policyname = 'Users select own profile' and cmd = 'SELECT'
    ) then 'PASS' else 'FAIL' end,
    'User voit uniquement sa propre ligne'

  union all

  -- 022.3 — Policy UPDATE avec with check
  select
    '022.3 UPDATE policy has WITH CHECK',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
        and policyname = 'Users update own profile' and cmd = 'UPDATE'
        and with_check is not null
    ) then 'PASS' else 'FAIL' end,
    'with_check empêche d''écrire id = autre user'

  union all

  -- 022.4 — Trigger anti-tampering couvre désormais email
  select
    '022.4 trigger blocks email modification',
    case when (
      select pg_get_functiondef(p.oid) like '%new.email is distinct from old.email%'
      from pg_proc p
      where p.proname = 'prevent_subscription_tampering' and p.pronamespace = 'public'::regnamespace
    ) then 'PASS' else 'FAIL' end,
    'profiles.email verrouillé côté client (source de vérité = auth.users)'

)

select check_name, status, detail
from checks
order by check_name;
