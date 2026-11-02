# Project-offer representation probe

This compares owner offer-list and draft-create requests against synthetic legacy and normalized-current rooms in separate in-memory stores. It starts loopback-only HTTP servers and never contacts production. Both requests use the same synthetic data. The probe verifies the named checkout's exact HEAD and refuses tracked working-tree changes before loading it.

```sh
node project-offer-representation-probe.mjs \
  --repo /path/to/clean/project-room \
  --source FULL_40_CHARACTER_COMMIT_SHA \
  --expect-parity
```

Optionally pass `--git /path/to/git`. Without `--expect-parity`, the probe reports observations and exits successfully after completing them. With it, the probe exits 1 unless both rooms list with HTTP 200, create a draft with HTTP 201, and store one offer row. It also exits nonzero on a source mismatch or runtime failure. The JSON result includes representation, response status/error code, stored row count, a digest of the input, and the source pin. Server diagnostics are written to stderr.

On `9eea8ec403e5849ae307da5cc34a361cb32097bf`, the checked-in receipt has `parity: false`: legacy is 200/201/one row and normalized is 409/409/zero rows. The 409 code is `current_room_context_required`. A wrong source pin was also verified to fail before starting the server. `ProjectOffers.requireOwner` invokes `store.room`, which refuses full projection reads for normalized rooms.

This is a narrow diagnostic, not a complete release gate: it does not qualify publishing, withdrawal, linked-work reviewer rules, authorization races, cold restart, production, or real external submissions. A product fix needs those relevant invariants checked separately.
