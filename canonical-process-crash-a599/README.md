# Canonical commands: actual process crash after commit, before caller delivery

Exact sourcea599faa29ff65567e5c080609cb2d000acd33666, Node24.22.1. No runtime source edits. Addresses the gap between in-process lost-ack tests and actual process loss with persisted normalized work. Adjust the absolute source/Git/runtime paths in canonical_process_crash_retry.mjs; keep canonical_crash_worker.mjs beside it. Run `node canonical_process_crash_retry.mjs`. The driver checks source pin/tracked cleanliness before and after and removes its temporary SQLite directory.

The child creates production RoomStore on a real SQLite file and production createRoomServer on loopback. Model setup initializes a synthetic owner/worker, normalized room and one proposed write task. Parent receives only synthetic keys over private process IPC. Child environment is minimal, without ambient provider/service credentials. An independent loopback fixture-control listener supplies audited state fingerprints and the synthetic-key revocation door; normal tested commands pass through the production HTTP server.

For each work.accepted, claim.acquired and message.posted command:

1. The caller sends its real HTTP request through the test proxy.
2. The proxy fully observes the production201 response, but sends no headers/body to the caller. It independently records committed state and audit success.
3. The parent kills that child with actual SIGKILL and verifies its exit signal, then destroys the caller connection. Caller fetch fails with no delivered response.
4. A new child process opens the same SQLite file. Its audited head and every named table row fingerprint match the committed state.
5. The caller retries the exact original command. HTTP200/duplicate:true returns the identical saved event; another state fingerprint proves no additional event/command/entity/proof write.

One final successful execution has three verified SIGKILL exits and four child process starts. All three cases pass. A changed-body reuse of the committed message command ID409 idempotency_conflict adds no writes. After explicit synthetic key revocation, retrying the exact saved command401 unauthenticated adds no writes: possession of an old command ID cannot bypass current authentication. Final auditRecovery passes. Ten named authoritative tables are fingerprinted, including rooms, events, commands, work entities, current records/proofs/head, work config, operator actions and legacy work mirror.

Scope: local Node HTTP/process/SQLite durability and authenticated idempotency. This is not a power-loss/disk-controller guarantee, precommit interruption qualification, Workers/Native failure, hosted load test, SDK test, another laptop execution or merge/deploy proof. It does not clear the separately red default OAuth enumeration, standalone charter or pinned-context gaps. Root retains runtime integration/release. No scheduling, generic orchestration, external webhook/email or real user data.
