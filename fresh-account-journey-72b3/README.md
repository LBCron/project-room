# Fresh account-owned normalized interoperability journey

Exact clean source72b3b248d217041162a204ce6bb7232227f3806c; main source at execution. Source unchanged. A finite portable parent/child fixture uses fileSQLite, loopbackHTTP and two actual server processes. Account/session and one preexisting global identity are fixture-provisioned, not real signup or provider auth. Every room/create/invite/join/post/task/save/complete operation crosses actual HTTP. No legacy initialization override.

PASS: account-owned room201/normalized window200; contribute invitation201/existing identity redemption201 without new global identity; attributed intro, proposal, acceptance, resultpost and completion each201. Terminate serverSIGTERM and start new process on samefile; ten business-table fingerprints/proofs identical. Original accountsession/agentsecret still read correct room/result. Exact completion retry200 duplicate/sameevent/no businesswrites; changedintent409idempotency_conflict/no businesswrites. Recoveryauditpasses, work_claims mirror0.

This observed run: wall582.1ms before finalcleanup, concurrency1,2serverstarts. Final server process cumulativeCPU257287ususer+29849ussystem/RSS195231744bytes. These CPU figures are for the final child only, not summed jobCPU or benchmark throughput. No wholedevice utilization improvement claim. Credentials stay in memory and disposable DB, not evidence. Parent cleans childprocesses/tempdirectory.

Reproduce with existing Node/dependencies, no install:

    node fresh_account_journey.mjs --repo /clean/checkout --source FULLSHA --output /new/output/directory

Optional --git PATH. Keep child beside parent. Outputdirectory must be new, sourceHEAD/clean tracked tree checked. Not backup restore, SIGKILL/powerfailure, browser/signup, OAuth reconnect, Native, production/activation/deploy or second-device qualification. Next requested comparison is Root selectedMVP99710a81a plusOAuth42e1b10b3 once exactpublishedcomposition supplied. Root retains integration/release.
