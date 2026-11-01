# Independent finite codec check

Candidate: `f4e2e862cac2c8c048e5b9ce889554c13c787621`.
Codec SHA-256: `c99bcb69ca82ba09d75a267f7b74cfbc0db76f998fb1fb5742e760fb0aaebcc0`.

Result: no counterexample found in the finite offline scanner/framing check.
412 valid synthetic cases and 5,669 split executions completed 559,344 scanner
steps in the initial pass. The extended pass completed 560,788 steps and emitted
36,773 records. Seventeen invalid-input families refused;
26 budget/control contrasts passed. Executable and raw JSON receipt are beside
this handoff. No runtime files were changed.

The differential reference is exact `JSON.parse` content for the supported
root projection shape, including messages and partitioned replyRequests.
The probe reconstructs the partitioned values with own properties and compares
them deeply to that reference. Child key raw offsets, parent framing counts,
record offsets, honest consumed bytes, output records and control/input sizes
are independently checked. The corpus uses deterministic seed `0x519ea271`.

Coverage includes byte widths 1, 2, 3, 7, 31 and 16,384 plus irregular widths;
one-record and 32-record budgets; ordinary Unicode, split four-byte UTF-8,
escaped quotes/backslashes/control characters, escaped and lone surrogates,
BOM inside strings, nested objects/arrays, prototype-like own keys, -0,
underflow and overflow number semantics. Dedicated large strings position
Unicode and escapes around the real 16 KiB boundaries.

Admission controls include a 131,072-byte exact leaf and +1 refusal, depth 64
and +1 refusal, 64 top-level keys and +1 refusal, a 200-byte key and +1 refusal,
overlong input, invalid max-record values, oversized control fields and invalid
cursor/depth/key-array controls. Extended controls cover 200-byte multibyte keys,
512-byte raw escaped keys, exact 8 KiB serialized control/+1 and the 4 MiB source
offset/+1 API bounds. Observed maximum normal scan control was 1,892 bytes,
maximum value span 131,072 bytes and maximum scanner input 16,384 bytes.
Observed maxima are measurements for this corpus, not proofs of all budgets.

Malformed JSON and invalid UTF-8 families refuse, including overlong sequences,
surrogate encoding, truncated multibyte input and code points above U+10FFFF.
Duplicate-key policy intentionally differs from JSON.parse and belongs to the
caller’s SQLite-tree/leaf-identity admission; this probe does not claim to test
those transactional protections.

Run at the exact candidate with Node 24:

```sh
node docs/research/2026-11-01-member2-codec-check/probe.mjs /tmp/fresh-codec-review.json
```

The output path must be fresh. This is pure offline codec evidence, not a
Worker restart test, source-trust/receipt review, complete semantic replay,
archive membership qualification or production activation approval. Root’s
declared pre-H provenance remains UNKNOWN. No backup was copied, broad suite
rerun, deployment attempted or production mutation made.
