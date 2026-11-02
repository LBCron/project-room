# Independent current-candidate write matrix

Runtime 7211928474dd6a1d8ee0660e40f2113770996431, Node v24.22.1.
Existing finite matrix: seven supported mutations in each constructor mode,
plus two unsupported edit refusal controls. Pending 7/7, controls 7/7, refusals
2/2 pass. Proofs, exact retries, warm/cold reads, offline audits and selected
live-storage synthetic deletion checks all pass. No user data or credentials.

Baseline 6f5a pending 0/7 is historical evidence in eec248a. No test-only
registration intervention is used here: current real constructor code is tested.

Only runner adaptation: final publication now returns several 202 continuations
while its independent audit progresses. Continue with each returned revision/seal
until 200 verified, capped at 2000 requests per case. Preserve original pending
reopen and cold-after controls. No oracle bypass. The unchanged older runner first
stopped at its obsolete one-request-publication assertion: fixture incompatibility,
not a runtime regression finding.

Reproduce: check out the runtime SHA, copy the included runner into cloudflare/
and run it with Node 24. JSONL retains every case and the summary. receipt.json
pins runner and output. Runtime files were unchanged when executing the matrix.

No runtime edits, Native qualification, deployment, power-loss test, large-input
bound, or overall release approval. Root retains integration/release ownership.
