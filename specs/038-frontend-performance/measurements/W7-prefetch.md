# W7 — Prefetch review (T015) — measured decision

**Date**: 2026-10-10 · **Tree**: post-split

## Baseline (measured context)

The post-split navigation costs ARE now chunked: every staff page is its
own lazy chunk (W1's table), and the standing trails probe recorded the
real navigation → listed budget: **audit 1121 ms / reports 1147 ms**
(W4), of which the render/fetch part is sub-second (W4's breakdown: the
RPC medians remain 100–160 ms — the D-yearhaul is mostly one chunk fetch
on first navigation, then CACHED by the browser; subsequent navigations
reuse it).

## The measurement that decides (FR-05)

What a hover-intent prefetch would buy: the FIRST navigation to each
page pays one chunk fetch (chunk sizes recorded in W1's post-split table:
staff pages are 1–35 kB individually; the largest is ManageRestaurantPage
32 kB / ~9 kB gzip). On the recorded profiles that is a *one-time*,
tens-of-kilobytes fetch — inside the fiscal noise the cloud fetch already
adds (the W4 probes include their first chunk fetch and still recorded
sub-second opens).

What it would cost: bandwidth on every hover for staff who never navigate,
plus a correctness surface (identity-readable-only discipline) to
maintain for a measured benefit of less than the cloud fetch's own
variance.

## Result (recorded)

**NOT ADOPTED.** The measured navigation cost post-split is already inside
the budget the cloud fetch itself dominates; prefetch buys nothing
measurable and spends a discipline. The customer token-scoped reads were
NEVER candidates (the invariant stands untouched). If the browser's chunk
cacheMột behavior ever shows first-navigation stalls on the recorded
profiles, this baseline is what a re-measure compares against.

Cache-policy note (FR-04 alignment): the table's prefetched-posture row
records "none adopted (measured)" — the table stays the one written
record.
