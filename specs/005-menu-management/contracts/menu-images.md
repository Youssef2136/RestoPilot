# Contract: Menu Images (Supabase Storage)

**Feature**: 005-menu-management | **Date**: 2026-09-17

The project's first Storage surface (master plan §33; spec FR-021–FR-023). The
bucket, its limits, and its policies are created by migration — Storage changes
follow the same canonical workflow as schema changes; nothing is configured
through the dashboard. Decisions and rejected alternatives: [research.md](./research.md)
§4, §10, §11.

---

## 1. Bucket

| Property | Value | Enforced by |
|----------|-------|-------------|
| `id` / `name` | `menu-images` | migration (`insert into storage.buckets … on conflict (id) do update`) |
| `public` | `false` | Storage service — no public URL exists for a private bucket |
| `file_size_limit` | `5242880` (5 MiB) | Storage service — oversized uploads are rejected with `413 EntityTooLarge` before any policy runs |
| `allowed_mime_types` | `array['image/jpeg', 'image/png', 'image/webp']` | Storage service — other types are rejected (`400 InvalidMimeType`) |

Limits live on the bucket, not in application code: a direct Storage call with a
user token is subject to exactly the same bounds as the UI's upload. The
database-side backstop is the `image_path` shape check on `menu_items`
([data-model.md](./data-model.md)).

## 2. Path grammar

```text
restaurant/<restaurant_id>/item/<item_id>/<name>.<ext>
```

- `restaurant_id` and `item_id` are the literal UUIDs of the owning rows.
- `<name>` matches `[A-Za-z0-9._-]{1,120}`; `<ext>` ∈ `jpg | jpeg | png | webp`.
- The client builds it (`menuImages.ts`), the RPC re-validates it against the
  item before recording it, and the table check refuses any other shape — the
  path is thus both the tenant binding and the object's identity.

## 3. Policies (`storage.objects`)

All four are scoped to `bucket_id = 'menu-images'`; folder segments are compared
as text with a UUID-shape guard before any cast, so a malformed path cannot
raise inside a policy. **No grants are added**: the Storage service's own
migrations grant table privileges to `authenticated`; the policies are the
access decision (research.md §11).

| Policy | Operation | Predicate |
|--------|-----------|-----------|
| `menu_images_staff_select` | `select` | the object's `name` equals some `menu_items.image_path` whose `restaurant_id ∈ private.staff_restaurant_ids(auth.uid())` |
| `menu_images_owner_insert` | `insert` | `(storage.foldername(name))[1] = 'restaurant'` and `[2]` is UUID-shaped and `∈ private.owned_restaurant_ids(auth.uid())` |
| `menu_images_owner_delete` | `delete` | same as insert |
| — | `update` | no policy: replacement is insert + delete |

Consequences that the tests must prove:

1. **An object is readable only while a visible item references it.** Replacing
   an image makes the old object unretrievable at transaction commit, even
   though the bytes are removed later (§5).
2. **Nothing is enumerable.** There is no policy under which an unreferenced
   object, another restaurant's object, or the bucket's contents as a list can
   be reached by a client.
3. **Read is not implied by upload.** An owner can insert into their prefix; an
   unreferenced upload is invisible to everyone until the RPC records it.

## 4. Client flow (`menuImages.ts`)

**Display** (staff UI): for each item whose `image_path` is set, the client
requests a **signed URL** with a short TTL through the Storage API
(`createSignedUrl`, TTL ≈ 10 minutes, cached in memory for the session and
refreshed on expiry). Signing is itself subject to the select policy, so a
stale path yields an error rather than an image. Signed URLs are for
authenticated staff display in this phase; public delivery of images to
customers is feature `007`'s decision (research.md §4).

**Add / replace** (owner):

1. pre-check locally: type in the allowed set, size ≤ 5 MiB (immediate
   feedback; the bucket is the authority);
2. upload to the grammar of §2 with a fresh `<name>` (a UUID) — the insert
   policy and bucket limits decide;
3. call `set_menu_item_image(item_id, path)`; the call returns the **previous**
   path and audits the change;
4. if a previous path was returned, delete that object through the Storage API
   (best effort).

**Remove** (owner): call `set_menu_item_image(item_id, null)`, then delete the
returned previous object through the Storage API.

**Failure handling**:

| Failure | Behaviour |
|---------|-----------|
| Pre-check fails | nothing is uploaded; the field shows the bound that failed |
| Upload rejected (413/400) | the item is unchanged; the message names the failed limit (type or size) |
| Upload succeeds, RPC fails | the object is unreferenced → unreadable by policy; the client offers a retry (which re-uses the uploaded path) and never records the path locally |
| RPC succeeds, cleanup delete fails | the item is correct and the old object is already unreadable (policy); the orphaned bytes are reclaimable by an owner delete — the accepted residual (research.md §11), not an error shown to the user |

Ordering is deliberately **upload → record → delete old**: every intermediate
state has a defined, non-broken rendering, and the item never references a
missing object (FR-021).

## 5. Deletion is never done in SQL

Deleting through SQL removes the metadata row and **orphans the file** in the
underlying store (documented by Supabase: "Deleting objects should always be
done via the Storage API"), so no function, trigger, or test may delete from
`storage.objects` to "clean up". Cleanup is always a Storage-API delete by the
owner (the delete policy authorizes the path prefix), and the correctness of
"the previous file is no longer retrievable" comes from the read policy of §3,
not from the deletion happening promptly.

## 6. Out of contract

- No public bucket, no public-read policy, no anonymous access, no CDN/transform
  configuration (feature `007` decides customer delivery).
- No signed upload URLs, no Edge Function, no service-role key: the
  authenticated path with policies is the whole mechanism.
- No image transformation, resizing, or format conversion in this phase.
- No garbage-collection sweep for unreferenced objects, and no storage-usage
  reporting (research.md §11, §18).
- No content sniffing beyond the declared MIME type and extension
  (research.md §10, §18).
