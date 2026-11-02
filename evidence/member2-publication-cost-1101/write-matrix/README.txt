Independent post-publication write matrix, 2026-11-01
Source: 62f935f9880a37c6ad9fccb2584c0570a00d2378
No runtime edits. Copy runner to cloudflare/ in this exact source and run Node24.
Expected exit 1 on this pin: six supported pending-open cases fail proof acceptance.
Each case gets its own restored temporary SQLite target; no cross-case poisoning.
Two modes: cold reopen while pending before publication; paired cold reopen after
publication. Both publication paths use unchanged full audit and report verified.
After one mutation, exact retry, addressed read, offline audit, cold reopen,
addressed read and offline audit, inspect message and metadata hashes directly.

Final: 16 cases; supported controls 6/6 pass; pending-open supported 0/6 pass;
4/4 unsupported edit/delete controls refuse409 current_room_context_unavailable
with unchanged projection/event count/proofs, readable and auditable afterward.
Unsupported cases are existing current-format limits, not recovery regressions.

Supported public post / thread reply / private post all accept + exact retry but
leave new message proof missing AND metadata proof stale in pending-open mode.
Warm/cold addressed reads and offline audits throw message field proof changed.
Propose / accept / start work accept + exact retry, with valid messages but stale
integrity_room_state.metadata_hash compared to rooms.projection, warm and cold.
Those three work cases still read and audit successfully: do not claim these
checks detect the metadata deviation or that work becomes unreadable. A stale
legacy carrier proof is measured, not independent proof of business data loss.
All paired supported cold-after-publication controls keep both proof types valid.

Production fix remains Root-owned. Narrow registration cure must preserve sealed
pending writes and full verification. This test establishes no production deploy,
CPU claim, broad schema qualification or private-data behavior beyond synthetic DM.
Initial attempts retained in local workspace: v1 fixture tried unsupported live
member.added; v2 classified edit/delete as supported. Final source seeds member
through initial events and asserts fail-closed edit/delete separately.
