# Official MCP client against local Native ProjectRoom

Frozen application source a599faa29ff65567e5c080609cb2d000acd33666. Actual @modelcontextprotocol/client 2.4.0, protocol2026-07-28, actual local July workerd with persistent SQLite Durable Object. No runtime source or application dependency changes.

Run official_sdk_native.mjs with LOCAL_LAB_GIT pointing to Git and MINIFLARE_WORKERD_PATH pointing to the existing matching July workerd. Adjust the driver's repo/deps/lab paths for another device. The source checkout must match the exact pin and have no tracked changes. Reuse the isolated mcp2-reference client/dependency lock from evidence/member2-official-sdk-1102 (official-sdk-a599); no install scripts needed. Esbuild and Miniflare resolve from the existing Cloudflare dependency checkout. Compatibility date2026-07-30, nodejs_compat.

The fixture adds local-only doors for synthetic invitation OAuth setup, observation and revocation. Production ProjectRoom.fetch handles all SDK requests, including actual invitation grant validation; no authorization mock. Custom SDK fetch is restricted to the synthetic origin and dispatches directly to Miniflare rather than the network. No external callbacks or email.

Verified discovery authorization, exact post attribution, real Miniflare disposal/reopen retaining SQLite state, existing-token reconnect, exact retry with no duplicate event, revoked grant HTTP401 and no mutation. Six SDK requests carry the pinned protocol header. Synthetic secrets and raw runtime logs are excluded.

This qualifies this local boundary only. It does not clear the separate default OAuth agent enumeration defect, hosted deployment, full release suite, or execution/utilization on the other laptop. Runtime boot warnings for unsigned agent card and relaxed no-mailer configuration remain outside this check.
