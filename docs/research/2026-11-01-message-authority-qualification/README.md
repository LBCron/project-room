# Message authority qualification

Exact source: 9dc769a1ed8279b1925ffd46232fc3bd1367d114, draft PR #5581. Source is independently under review; it is not merged, deployed or used for production conversion.

80 focused Node checks passed: 55 operator/authority/projection/cold-package cases plus 25 independent-write-proof/operator-archive cases. Four actual workerd cases passed: the prior engine case, real process restart across conversion/edit/retry/reverse, persistent corruption refusal, and a 1000-message size sample. Source preflight and affected ESLint pass. Existing tests were not relabelled full CI: hosted mechanical/safety checks passed, heavy hosted jobs were skipped while draft.

The initial HTTP route tests fail before implementation. A distinct direct-engine regression reproduces reverse accepting corrupted canonical payload under a stale independent proof; the new guard passes. The larger-body workerd workload correctly refused the hydrated byte budget; its red expectation log is retained as an over-budget sample, not hidden or counted as a passing eligible conversion. Corrected eligible workload changed its synthetic body size, not the limits.

Workerd size sample: 1002 events / 415742 event bytes; 1000 message rows / 461780 admitted bytes; raw projection 257608 bytes, conservative hydrated upper bound 719388; canonical projection 751 bytes. Observed plan/execute wall times around14/81 ms are local measurements, not production CPU/latency.

Graphify source map is committed-source, offline/code-only, modelCalls0, partial/truncated and advisory. Targeted query finds the new operator caller and write-integrity dependency; actual tests establish behavior.

Oversized and archived histories remain unsupported by this narrow operator door. In particular it cannot yet convert muse-room. Bounded archived-source qualification and continuation remain work. No private backup, raw production log, credential or private SQL database is included.
