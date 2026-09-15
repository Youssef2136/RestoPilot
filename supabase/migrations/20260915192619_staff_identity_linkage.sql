-- Staff identity linkage (spec 003 FR-003; research.md §5; Constitution VI).
--
-- Declares and enforces the one-to-one linkage between a staff profile and
-- its platform Auth identity: profiles.auth_user_id references the primary
-- key of auth.users(id) with the default `no action` (no cascade — deleting
-- an identity a profile still links to fails loudly, extending Phase 1's
-- no-cascade posture to the identity edge).
--
-- Pre-step: clear linkage values that point at non-existent auth users.
-- On the existing development database this nulls feature 002's synthetic
-- ids, so the FK below validates and `npm run db:migrate` stays a valid
-- path on the existing database (FR-023). The seed re-establishes the real
-- linkage via the profiles upsert.

update public.profiles
set auth_user_id = null
where auth_user_id is not null
  and not exists (
    select 1
    from auth.users u
    where u.id = public.profiles.auth_user_id
  );

alter table public.profiles
  add constraint profiles_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id);
