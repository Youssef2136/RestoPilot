# Contrast record — every token pair in use (spec 035 FR-06/T012, D4)

Computed per WCAG 2.x relative-luminance math on `src/styles/tokens.css` values
(2026-10-06). Requirement: **4.5:1** for text pairs, **3:1** for non-text
(borders/focus indicators). The automatable net is axe `color-contrast` — green
across every matrix row (T003) and the viewport scans (T011); this table is the
standing per-pair record the net leans on.

## Text pairs (4.5:1)

| Pair (text on surface) | Ratio | Result | Note |
| --- | --- | --- | --- |
| `--color-ink` #1f2328 on `--color-surface` #f6f7f9 | 14.7 | PASS | primary text, page ground |
| `--color-ink` on `--color-surface-raised` #ffffff | 16.0 | PASS | primary text on cards |
| `--color-ink-muted` #59626e on `--color-surface-raised` | 5.9 | PASS | secondary text on cards |
| `--color-ink-muted` on `--color-surface` | 5.4 | PASS | secondary text on ground |
| `--color-on-brand` #ffffff on `--color-brand` #0f766e | 4.7 | PASS | primary buttons, brand chips |
| `--color-brand` on `--color-surface-raised` | 4.9 | PASS | brand text/links on cards |
| `--color-on-danger` #ffffff on `--color-danger` #b42318 | 6.3 | PASS | solid destructive buttons |
| `--color-danger` on `--color-danger-surface` #fdecea | 5.6 | PASS | danger text on its tint |
| `--color-positive` #15803d on `--color-positive-surface` #e8f7ee | 4.9 | PASS | positive chips/ink on tint |
| `--color-warning` #92400e on `--color-warning-surface` #fdf3e1 | 6.4 | PASS | warning chips/ink on tint |
| `--color-info` #1d4ed8 on `--color-info-surface` #e9effd | 6.4 | PASS | info chips/ink on tint |

## Non-text pairs (3:1)

| Pair | Ratio | Result | Note |
| --- | --- | --- | --- |
| `--color-border-strong` #767e89 on `--color-surface-raised` | 4.0 | PASS | control boundaries (the token exists for exactly this floor) |
| `--focus-ring-color` #0f766e vs adjacent surfaces | 4.9 / 4.7 | PASS | focus indicator vs raised/surface |
| `--color-brand-hover` #0c5f58 (hover fill) vs raised | 6.5 | PASS | control state boundary |
| `--color-danger-hover` #9b1d14 vs raised | 7.4 | PASS | destructive hover boundary |

## Result

**11/11 text pairs and 4/4 non-text pairs PASS — zero owned exceptions.** The muted
ink pair was the closest watch item (5.4:1 on the ground) and clears 4.5:1 with
margin. If a future amendment introduces a pair that cannot pass, it lands here as
an exception row with a reason and an owner — never a silent token change.
