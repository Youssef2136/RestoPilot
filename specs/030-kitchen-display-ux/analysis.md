# Analysis: Kitchen Display UX (Phase 10)

Cross-checked the plan against the frozen contracts, the queue RPC, and the seed fixture:

1. **The queue's channel-blindness is structural**: `get_kitchen_queue` joins `dining_tables`
   through `sessions.table_id` — the seeded channel demo sessions (delivery `...8003`,
   takeaway `...8004`) carry `table_id: null`, so their tickets naturally render
   `table_label: null`. The card MUST NOT print 'Table null' — 'Counter order' is the honest
   head. No address key exists anywhere in the payload; the board never fabricates one (FR-09
   double-blind).
2. **The money-free assertion reads `section` innerText** — the re-skin's helper copy must
   avoid the words subtotal/tax/total/price ENTIRELY on this route (e.g. the empties say
   'Nothing waiting' — never 'waiting on totals'). The LiveBadge ('Updated Xs ago') is safe.
3. **`new` tickets are kitchen-visible by contract** and the contract's clarification says the
   cashier accepts first: the incoming column renders the state honestly ('awaiting cashier')
   with NO action button — the D3 decision, matching the pinned full-journey walk (which acts
   only from `accepted`).
4. **Column heading text is NOT pinned** (only `data-kitchen-column` values + the card hooks +
   button names); the human labels ('Incoming (awaiting cashier)' / 'In preparation' / 'Ready
   to serve') are free vocabulary — chosen for two-metre reading.
5. **The merged preparing column (accepted+preparing) is the contract's own shape** (the page
   already merged; the ticket's own `data-ticket-state` distinguishes within the column —
   full-journey asserts on the ticket hook, not the column).
6. **Marina T1 remains the right scratch fixture** (dan's only branch; the lock + state-agnostic
   flip proven in 029). The channel demo sessions are NOT used to drive tickets (they're
   customer-surface-fed; submitting through them needs the token-entry route the E2E suites
   avoid driving directly) — the blindness re-assert instead reads the LIVE board after a real
   dine-in submission and asserts the absence of the seeded address string globally.
7. **No data-layer change**: age derives from `created_at` client-side as DISPLAY ONLY (D2's
   honesty note); the parser stays untouched.

Verdict: NO blocking gaps; D1–D4 resolve the plan's clarifies within the frozen contracts. Proceed to IMPLEMENT.
