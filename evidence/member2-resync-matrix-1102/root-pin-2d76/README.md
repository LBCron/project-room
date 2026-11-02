# Exact Root-requested candidate qualification

Root acknowledged resync at Room25939 and requested exact runtime
2d76ffa9f507a1c49571d8685133cf327b3a9c51. Ran the same finite matrix on a
fresh detached checkout of that pin. Exit0: pending7/7, controls7/7, edit
refusals2/2. No shared runtime edits or test-only integrity registration.

The runner and JSONL output are byte-identical to the parent folder artifacts;
receipt.json pins both hashes and this newly tested source SHA. Copy the parent
runner into cloudflare/ at this exact revision and execute with Node24.

This independently qualifies the seven supported post-publication mutation
paths plus refusal controls on the requested source. It does not qualify Native,
large-scale bounds, deployment or the entire release. Root retains release.
