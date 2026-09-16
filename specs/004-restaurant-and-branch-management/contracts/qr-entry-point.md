# Contracts: Restaurant QR Entry Point (Phase 3)

**Feature**: 004-restaurant-and-branch-management | **Date**: 2026-09-16

The external customer-facing artifact this phase introduces: one
restaurant-level QR code whose payload is the restaurant's public entry URL
(spec FR-018/FR-019, US5; master plan §3.1/§3.2/§14/§17). The DB side carries
no special surface — the payload derives from the restaurant's public
identifier (`restaurants.slug`), which the caller already reads under the
existing policies; generation is client-side. Decisions and alternatives:
[research.md](../research.md) §8–§9.

---

## 1. Payload derivation (the load-bearing rule)

```text
entryUrl(restaurant) = `${origin}/r/${restaurant.slug}`
```

- `/r/:restaurantSlug` is feature 001's public restaurant route — the
  restaurant's public entry page. This phase does not build the customer
  experience behind it.
- `origin` is the application's own origin
  (`window.location.origin` at render time). The dashboard and the public
  entry page are one deployment in V1; no configuration value participates,
  and no new environment variable exists.
- The payload is derived fresh from the restaurant's **current** slug every
  time the artifact is rendered or downloaded. Nothing is cached, stored, or
  versioned: after a public-identifier change, the next rendering encodes the
  new URL, and the application retains or encodes the old identifier nowhere —
  no alias, no redirect, no history (FR-004). What a previously printed code
  or shared link resolves to afterwards is the public route's semantics —
  feature 001's placeholder and feature `007-customer-access-and-session` —
  not a guarantee of this phase (§4).

## 2. Artifact formats

| Output | Mechanism | Purpose |
|--------|-----------|---------|
| SVG string | `qrcode` `toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })` | Print-quality download (vector) and in-page display |
| PNG data URL | `qrcode` `toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 1024 })` | Raster download for tools that need PNG |

Both outputs encode the byte-identical payload of §1; the module exposes the
payload builder separately so tests and the UI assert the exact string. The
panel also renders the payload as visible text next to the code, so the target
is verifiable without decoding.

**Download**: the downloaded file is one artifact per format; there is no
per-table or per-branch variant, and no server-side artifact storage
(no Storage bucket is used).

## 3. Authorization and visibility

- Viewing/downloading the QR is an owner action (FR-018, US5 scenario 3):
  the panel renders only for `canManageRestaurant(restaurantId)`
  ([management-client.md](./management-client.md)); the underlying data
  (the restaurant row with its slug) is already owner-readable under the
  existing policies, and non-owners of the restaurant cannot read it at all.
- Obtaining the QR exposes nothing beyond the public entry URL, which is
  public by design (FR-019): the encoding does not disclose configuration
  data, and no configuration table becomes publicly readable.

## 4. Guarantees

1. **Stability while the identifier is unchanged** (US5 scenario 4): the same
   restaurant, same slug ⇒ byte-identical payload on every render/download.
2. **No branch or table information** (US5 scenario 2, SC-005): the payload
   grammar is exactly `origin/r/<slug>`; there is no code path that appends a
   branch or table identifier. Dynamic/per-table QR codes are out of V1 scope
   (master plan §3.2) and unscheduled here.
3. **Currency after an identifier change** (FR-004): re-rendering after a
   confirmed change yields the new URL; the old identifier no longer addresses
   this restaurant and is retained or encoded nowhere by the application.
4. **Configuration privacy** (FR-019): the only public surface is the
   restaurant's existing public entry page.
5. **Non-guarantee — resolution of old codes and identifier reuse** (FR-004):
   this phase makes no promise that an old printed code or shared link "stops
   resolving" — resolution is the public route's semantics (feature 001's
   placeholder; feature `007-customer-access-and-session`). Because a released
   identifier is immediately reusable (global uniqueness; no alias, no
   redirect, no history), an old link may later point at a *different*
   restaurant.

## 5. Verification

- **Automated (unit)**: the payload builder is pinned by tests for
  representative slugs and origins; generation is smoke-tested to return a
  non-empty SVG and PNG data URL for the same payload.
- **Manual (quickstart)**: a downloaded artifact is decoded with a phone
  camera or any scanner and must resolve to the restaurant's public entry URL
  — including the post-identifier-change round: a freshly downloaded code
  encodes the new URL, and the earlier one no longer addresses this
  restaurant (what it then resolves to is feature 001/007 semantics, §4).
- **Automated (browser, e2e)**: the panel renders for the owner with the
  payload text visible and is absent for non-owners and the super admin.

## 6. Non-goals

- The customer flow behind the QR (restaurant page content, branch selection,
  table selection, customer identity, sessions, ordering) — features
  007–008.
- Dynamic/per-table QR codes, QR analytics, QR rotation, branded QR styling
  beyond what the artifact requires.
- Serving QR images from the platform (Storage) or any server-side generation
  endpoint.
