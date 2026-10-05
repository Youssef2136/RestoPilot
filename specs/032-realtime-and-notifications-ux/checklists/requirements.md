# specs/032 — Requirements checklist (R1–R8)

- **R1** FR-01: one connection model; no duplicate badge — audit recorded in baseline; policy module unifies announcements. **Check:** policy unit tests; existing shell/board journeys pass.
- **R2** FR-02: cue announcement + affordance + no payload — existing pins hold; NEW supersede unit pin; NEW E2E no-payload assertion. **Check:** new unit + E2E.
- **R3** FR-03: freshness on live lists + honest poll cadence — already pinned both sides; audited, nothing added. **Check:** existing customer.menu/cashier/kitchen pins pass.
- **R4** FR-04: reconnect → recovery refetch → confirmation — existing (SUBSCRIBED refetch + transient recovered banner, pinned). **Check:** shell.test + cashier.operations journeys pass.
- **R5** FR-05: banner states + detail panel + 'ordering not affected' + truthful actor. **Check:** new unit copy tests + nearing_expiration E2E with the panel.
- **R6** FR-06: disabled surfaced where the contract exposes it — existing dashboard banner (pinned) + console. **Check:** platform.surfaces pins pass untouched.
- **R7** FR-07: one announcement policy; no duplicate announcements; toasts excluded from passive events. **Check:** policy unit tests; grep shows components source copy from the module.
- **R8** FR-08: activity panel NOT built; no notification store/RPC invented. **Check:** no new tables/RPCs in the diff.
