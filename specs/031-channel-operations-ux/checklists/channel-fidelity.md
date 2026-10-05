# Channel Fidelity Checklist — 031 (the refusal-preservation focus)

The Master Plan names refusal-preservation fidelity as this phase's checklist focus. Every row is a way the UI could LIE about a channel boundary; each must be proven false.

| # | Lie to prevent | Guard | Proof |
| --- | --- | --- | --- |
| F1 | UI implies adding is possible above the cutoff | add controls carry real `disabled` + the linked reason when crossed | channel.operations closed-state DOM + axe |
| F2 | UI blocks the server's authority (submit disabled / cart cleared / refusal paraphrased) | submit stays enabled; cart lines untouched; alert text = server message verbatim | FR-011 journey: 'already on its way' + 'Hummus × 2' preserved |
| F3 | UI disables adds before the client KNOWS (speculative closing) | derivation reads only the resolved rounds payload; error/pending → open | cutoffState unit (pending/error paths) |
| F4 | The mirror diverges from the server's EXISTS clause | cutoffCrossed reads EVERY round (voided included — the payload carries no voided flag; server parity is the contract) | cutoffState unit + migration reference |
| F5 | Kitchen claims channel knowledge ('Deliver to', address, delivery copy) | kitchen code untouched; blindness asserted over a LIVE delivery round | channel.operations kitchen assertion |
| F6 | Sessions list invents a channel it cannot verify (payload lacks session_type) | neutral 'Counter session' marker only; per-channel claim recorded as §3.8 conflict, not rendered | D5 + contract ledger |
| F7 | Unavailable-session refusal loses the cart/token (regression of 010's preservation rules) | channel.entry unit untouched and green; entry E2E pins pass | unit suite + session.surfaces |
| F8 | Takeaway pickup announcement fires for delivery/dine-in or repeats | announcement derives from channel + `ready` milestone crossing, rendered with the state | channel.operations takeaway leg |
| F9 | Timeline claims a state the payload doesn't carry | unknown/voided states fall back to the raw chip, never a milestone | timeline unit |
| F10 | Filter hides rounds the board owes the cashier (cued/refusal lost) | filter defaults All; filtering is presentation-only over the same cards; cued marker + refusal routing operate on rendered cards | channel.operations filter test + cashier.operations green |
