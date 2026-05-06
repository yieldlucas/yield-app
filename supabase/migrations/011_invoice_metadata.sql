-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011 — Métadonnées de facture pour fiabiliser la détection PDF
--                 et propager les messages d'erreur précis au client.
--
-- Contexte : avant, l'edge function devinait le type du fichier en regardant
-- l'extension du filename (`split(".").pop()`). Fragile :
--   - filename sans extension → traité comme JPEG → Anthropic refuse le PDF
--   - filename avec un point dans le nom (rare mais arrive) → détection foirée
--
-- On stocke maintenant le MIME type fourni par le navigateur au moment de
-- l'upload (file.type), et l'edge function s'en sert avec un fallback
-- magic-byte (premiers octets du blob) pour les cas où le navigateur n'a pas
-- envoyé de Content-Type correct.
--
-- error_message : permet à l'edge function d'écrire un message PRÉCIS quand
-- le scan échoue (ex: "Ce format PDF n'est pas supporté"). Le polling client
-- le remonte au chef au lieu d'un générique "Lecture impossible".
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.invoices
  add column if not exists content_type  text,
  add column if not exists error_message text;

comment on column public.invoices.content_type is
  'MIME type du fichier uploadé (file.type côté navigateur). Utilisé par l''edge function pour distinguer image vs PDF.';

comment on column public.invoices.error_message is
  'Message d''erreur user-facing quand status=error. NULL si succès ou pas encore traité.';
