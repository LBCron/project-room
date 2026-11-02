# Actual official MCP client interoperability

Sourcea599faa29ff65567e5c080609cb2d000acd33666, tree7be83d03ca225618552523451c262670f1accdda, clean isolated checkout. Real @modelcontextprotocol/client2.4.0 from the official npm registry was installed only under local-lab/mcp2-reference, outside application dependencies.13registry packages are pinned by the included lock. Top client integrity matches registry SHA512; every lock dependency has registry URL/integrity metadata. npm11.6.2 ran with ignore-scripts/no-audit/no-fund and separate empty user/global config files: no app package/lock changes, global installation, service credential or lifecycle script.

## Previously skipped real-client tests

The two existing opt-in cases now run with ROOM_MCP_REFERENCE_CLIENT pointing to the actual ESM entrypoint.2pass,0fail,0skip: official modern client discovers/lists/calls real Node HTTP; invitation-OAuth client lists allowed attributed tools and posts under its own agent identity. Protocol is pinned2026-07-28. Name filtering limits execution to these two cases, without repeating neighboring suites. This is Node HTTP, not actual Cloudflare Native simply because one fixture variable is named nativeClient.

## New SDK pending-queue lifecycle

A disposable normalized room contains51equal-time pending requests created by ordinary producers, an identity with manage_members and an unprivileged reader. The actual SDK uses modern StreamableHTTP over loopback. Room's full-profile extension is sent through the SDK request API; the returned real tool definition drives the SDK call's schema processing. No SDK patch or hand-crafted substitute transport protocol.

All51unique requests are reached in25/25/1pages; max limit50 and cursor schema are exposed. Oversized omitted-limit read is refused invalid_request. Every requester row remains untrusted with contentTrust metadata. A low-privilege reader presenting an invalid cursor is refused access_denied before cursor decoding, without requester content. Denying an earlier non-anchor row correctly retains current-per-page continuation. Denying the saved anchor returns stale_access_request_cursor; restart without cursor succeeds. All SDK request protocol headers match2026-07-28. Raw keys, requester data and cursor tokens remain private and are not in receipts. No runtime edits.

## Reproduce

Copy the reference package and lock into an isolated directory using their normal package.json/package-lock.json names, then npm ci --ignore-scripts --no-audit --no-fund there with Node24. The lock pins all transitive versions. The qualification drivers contain absolute local checkout/runtime/reference paths; adapt those deliberately. Run only the two existing opt-ins with ROOM_MCP_REFERENCE_CLIENT=file:///path/to/reference/node_modules/@modelcontextprotocol/client/dist/index.mjs, or use the included source-pinned runner. official_sdk_access_pages.mjs contains the producer-driven admin/reader lifecycle and exact assertions.

No package binaries/node_modules, real identities, mail, database or credentials are included in evidence. No production, full-suite, merge/deploy or second-device execution claim. Historical full-unit failures and the separate default OAuth enumeration defect remain open. Root retains integration and release.
