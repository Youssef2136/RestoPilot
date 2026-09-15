-- Harden app_meta per current Supabase RLS guidance (audit 2026-09-15):
-- RLS is already enabled with no policies; this additionally revokes table
-- privileges from the client roles so no grant path remains open even if a
-- permissive policy is ever added (spec FR-017 deny-by-default posture).
revoke all on table public.app_meta from anon, authenticated;
