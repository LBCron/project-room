# Pending access-request baseline at f021

Requested by Root26073; exact clean sourcef02132a1c921af7953368a7340f6d03b87a78d28. These experiments are local, synthetic and finite; no production load, API/UI source edits, request decisions or permission changes are part of this baseline.

Actual Native HTTP through ProjectRoom: seed25 then1000 normal pending requests using distinct real local agent identities and the normal AccessRequests producer. Equal created timestamps deliberately model a burst. Both owner and manage_members admin return the whole queue with no continuation:9362B at25,360362B at1000. Repeated owner warm physical rows803->3728, admin813->3738, zero writes and unknown counters. Native owner needs-attention separately stays1543rows/~1.7KB/zero items in the empty-work fixture. Constructor/seeding excluded; no CPU or production performance claim. Replacing store.room with a throwing sentinel confirms these Native reads do not hydrate the room/history.

Actual full Chromium app with real account-session sign-in and local Node SQLite server: owner/admin25 and1000 cases. No fabricated API replies. At1000, one queue response paints1000request rows and3000buttons; owner9000nodes/admin10000nodes. At25:25rows/75buttons and225or250nodes. No paging controls. Last request remains reachable; partial permission editor+Escape restores initiating keyboard focus, and admin cannot grant complete_work. No decisions submitted; pending counts unchanged; no page errors. Node browser backend is separate from Native physical-cost experiment.

Environment: Node24.22.1, Native Miniflare4.20260730.0/esbuild0.28.2/July workerd; browser Playwright1.62.1/existing Chromium cache1234. Reproducer scripts, raw sanitized-cost logs and receipt included. No installation or automation.

Initial private harness setup mistakes were corrected before these results: Native internal HTTP needed the fixture Host/visitor headers used by existing fixtures; Playwright CommonJS entry needed require rather than synthetic named ESM import; existing human-account binding had to be reused rather than rebound. None was classified as a runtime regression. Credentials and request bodies remain inside disposable local fixtures; logs expose only synthetic IDs/counts/costs, not credentials.

Root owns sponsorship shape and merge/deploy. Follow-up pagination implementation is separate and still under test; these are baseline receipts, not evidence that implementation is complete.
