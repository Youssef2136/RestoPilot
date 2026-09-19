-- Menu media: the private item-image bucket and its four storage policies
-- (spec 005 FR-021–FR-023; contracts/menu-images.md §1–§3; research.md §4,
-- §10, §11).
--
-- Storage is configured by migration — never through the dashboard — so the
-- bucket's limits and its access rules live in the same canonical workflow as
-- every other schema change (FR-029).
--
-- The load-bearing rule: an object is readable only while a visible menu item
-- references it as its CURRENT image_path. A replaced or cleared image is
-- therefore unretrievable the moment the reference moves, independent of when
-- the bytes are deleted (deleting objects through SQL is unsupported and
-- orphans them — cleanup is always a Storage-API delete, research.md §11).
--
-- No grants are added to storage.objects: the Storage service's own
-- migrations grant table privileges to authenticated; policies alone are the
-- access decision.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read: the current reference of an item in the caller's restaurants is the
-- only thing that makes an object reachable. `storage.objects.name` is
-- qualified deliberately — inside the subquery an unqualified `name` would
-- resolve to menu_items.name.
create policy menu_images_staff_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'restaurant'
    and exists (
      select 1
      from public.menu_items i
      where i.image_path = storage.objects.name
        and i.restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))
    )
  );

-- Upload: only into the owner's own restaurant prefix. The UUID-shape guard
-- runs before the cast so a malformed path cannot raise inside a policy.
create policy menu_images_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'restaurant'
    and (storage.foldername(name))[2]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2]::uuid
      in (select private.owned_restaurant_ids((select auth.uid())))
  );

-- Cleanup: the owner reclaims superseded or orphaned objects under the same
-- prefix rule. Deleting an object never affects an item row (the reference is
-- removed first by set_menu_item_image).
create policy menu_images_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = 'restaurant'
    and (storage.foldername(name))[2]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2]::uuid
      in (select private.owned_restaurant_ids((select auth.uid())))
  );
