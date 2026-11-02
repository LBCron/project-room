# Emergency exact-pair rollback review

Current source bbb8b348423f002b3c636207ecc175faa3a2b573, target 6a64ad3039600de2b382a16faead57f33dd304e3. Current canonical allocation 80c8b834-358c-4ee5-af91-7fa4b351db65; current entry ae0d2cb2-7ed4-486e-a4d5-4bc088ab730a. Targets 65e553f4-f96f-4f7f-a4d4-ac8e18c209a5 and ebd621f5-fc73-43af-bc41-374df1b22e20, recorded before deploy 41363708931.

## Old code against new data

The only intervening application change is #5651. Store, storage adapter, schema/writer fence and OAuth storage definitions are byte-identical (blob proof adjacent). Schema is 44 in both versions. No room namespace, migration, binding class or storage reset is requested. The changed OAuth principal and event-subscription principal values are opaque JSON in the same tables, not a schema migration.

Synthetic qualification actually creates canonical room data, managed identity and existing access/refresh grants with bbb8; issues its new account-owned principal, backs up SQLite, closes, then opens with exact 6a64 code. Old code reads the same room, validates and rotates a legacy grant, posts and retries without a duplicate. Unsupported new principal access/refresh fail closed without consuming/revoking its saved row. Reopening with bbb8 restores that grant, legacy rotated access, identity link and posted sequence. No production rows were fetched or modified by this test.

This establishes source/format compatibility, not a proof that every production row is healthy or that rollback will cure the outage. New account-owned Claude connections temporarily cannot authenticate on 6a64. Preserve their rows and existing seats; do not ask owners to recreate identity. Old code lacks #5651 discovery/registration/consent improvements. That is an intentional temporary availability tradeoff during the storage incident.

## Retained runtime

Rebuilt the exact target source package independently; the existing verifier checked every archive file against it, exact tag/commit and unchanged published release metadata. Adjacent receipt: 669 archive files, SHA256 cfda14e979c92e1d7c7a832fbb47220112db9f8d1afa2e1ba055b223130b5eff. No release asset was replaced or republished.

## Worker bindings

Reviewed the complete wrangler diff: only static Claude client preferredRoomId/preferredMemberId changed. DO namespace IDs, class, migrations, database storage, backup KV and entry routing are unchanged. Rollback uses the exact retained allocations; workflow preflight independently rechecks their immutable module source/schema and current stable allocation before mutation. No credentials or grants are widened. Both doors roll back together through the existing serialized workflow.

## Incident limitations and verification

Grok branch 703819014db8a3bc6196918880fe242dc40a6ddf records storage-operation timeouts causing resets, with no observed CPU/memory exceptions. Absence of those exceptions does not establish a cause. No existing flag disables all #5651 new paths. Storage usage against the cap and a Claude-specific retry loop are not established. After rollback, verify both allocated source IDs, readiness, health and useful work; transient ready alone is insufficient. If storage still resets, retain data and pursue storage diagnostics rather than repeated redeploys.
