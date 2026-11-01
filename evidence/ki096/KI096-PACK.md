# KI-096 evidence pack — /agent-signin.html 404 (QA11-13) + strict `next` form (QA11-11)

Prepared by Jill's fleet (sync-and-help wave, unasked-help lane) for Fo,
who owns KI-096. This pack is the re-test the ledger row asks for.

**Verdict: STILL-OPEN, unchanged.** The /agent-signin.html 404
reproduces exactly on current production, on both doors. The
strict-naming leg remains message-level only. Nothing about this item
was fixed by any flip since the help-wave retest.

## The item

Ledger row (docs/KNOWN-ISSUES.md:159, current main): "KI-096 | Strict
body names bad key; /agent-signin.html 404 | QA11-11/13 | stale |
#4896 closed; agent-signin.html now on main | bug | P3 | S | Fo |
Re-test; likely fixed. Claimed by Fo (23867)".

Two legs, per PR #4896 (closed unmerged) and the HW-S8 retest
(~/workspace/wave-2026-10-31-help/lanes/S8/FILING.md, executed at pin
1ab906c3):

- **QA11-13:** GET /agent-signin.html returns 404 while
  GET /agent-signin serves the page. HW-S8: STILL REPRODUCES.
- **QA11-11:** strict-input 422s name the bad key in the `message`
  (HW-S8 verified live: search and typing probes), but the error
  `next` is still the generic "Correct the named fields and resend."
  — not #4896's specified form ("Offending: <keys>. Accepted keys:
  <keys>. Resend without the extra fields.").

The row's "agent-signin.html now on main; likely fixed" note refers
to the template asset file being present on main. It is present (see
code path below) — as a packaged template that is deliberately not
served raw. Its presence does not make the URL serve. This pack is
that retest: not fixed.

## Current production evidence (2026-11-01, executed this lane)

Both doors agree: sourceRevision
513d3ee8471464803fd3c70dea2fe9ce30f27ad0, buildId
2026-11-01T18:30:36.961Z (GET /api/version, app door and entry door).

| Request | Result |
|---|---|
| GET room.trydemigod.com/agent-signin.html | **404** application/json, code `not_found` |
| GET room.trydemigod.com/room/agent-signin.html | **404** application/json, code `not_found` |
| GET www.getdasha.com/room/agent-signin.html | **404** application/json, code `not_found` |
| GET /agent-signin.html with browser Accept | **404** text/html (the styled HTML 404 page) |
| GET /agent-signin (control) | 200 text/html, 1,414 B; markers `agent-signin-ui`, `agent-signin-home`, `agent-signin-enter`, `agent-signin-page` all present |

Full 404 body (app door, this run):

```json
{"error":{"code":"not_found","message":"Not found"},"status":"action_required","reason":"not_found","hint":"That path or id does not exist — nothing was changed. Re-list the resource and use a current id; do not guess ids.","next":[{"command":"Re-list the resource (e.g. GET /api/public-work/tasks) and retry with a current id; do not guess ids"},{"tool":"room_check_access"}],"operationId":"op_fR9uApPx","category":"not_found"}
```

Contrast — every sibling standalone page's .html form redirects to
its canonical extensionless URL on the same production build:

| Request | Result |
|---|---|
| GET /join.html | 301 → /join |
| GET /room/join.html | 301 → /room/join |
| GET /about.html | 301 → /about |
| GET /offers.html | 301 → /offers |
| GET /index.html | 301 → / |

/agent-signin.html is the only one of the standalone pages whose
.html form 404s. (Non-existent pages — receipts.html, privacy.html,
signin.html — also 404, as they should; no such pages exist.)

## Code path at current main

Read from a fresh clone at main
82de0f8b42f7bbcb1fd3e92368b43d18280a319a (2026-11-01).

- `server/http.mjs:3323-3334` — the only door to the page:
  `agentSigninPageMatch = /^\/(?:room\/)?agent-signin\/?$/`; on match
  it serves `loadAsset("agent-signin.html")` with `{{ASSET_BASE}}`
  substituted. The `.html` suffix matches nothing, so the request
  falls through the HTML-404 branch (`server/http.mjs:3339-3344`,
  browser Accept) to `reject(404, "not_found", "Not found")`
  (`server/http.mjs:3345`).
- `server/http.mjs:2365-2368` — the sibling pattern in production:
  `/join.html` and `/room/join.html` (GET/HEAD) get
  `301, Location: pathname.replace(/\.html$/, "") + url.search`.
- `server/public-assets.mjs:3` —
  `templateAssetPaths = ['join.html', 'agent-signin.html']`: both
  pages are templates, packaged and not served raw. Serving the
  file statically is therefore not an available shape; the route is
  the door, same as join.
- `server/http.mjs:144-147` — the compare pages state the house
  convention in a comment: "extensionless canonical URLs".
- `tests/agent-signin-page.test.js` — covers `/agent-signin`,
  `/agent-signin/`, `/room/agent-signin` only (200 + markers, HEAD,
  POST 405). No .html case exists at main; a cure needs one added.

## Cure shapes (Fo / Codex pick; nothing built by this lane)

- **Option A — 301 to the extensionless URL (recommended).** Add
  `/agent-signin.html` and `/room/agent-signin.html` beside the
  join handler at `server/http.mjs:2365`, same two-line shape,
  query string preserved. Reasons: it is the exact pattern the
  sibling standalone agent page (join) uses in production today; it
  keeps one canonical URL, matching the extensionless-canonical
  convention the compare pages state; it is the smallest possible
  diff. This was PR #4195's shape — #4195 is closed unmerged and
  its branch is recorded stale/conflicting
  (docs/ARCHIVED-WORK.md:181), so this needs a fresh small PR, not
  a revival.
- **Option B — serve 200 at the .html URL.** Extend the route
  regex at `server/http.mjs:3326` with `(?:\.html)?`. This was PR
  #4896's shape (also closed unmerged; its body notes the two
  approaches conflict). It serves identical content at two URLs.
- Either way: add the .html cases (both doors' path forms) to
  `tests/agent-signin-page.test.js`.
- **Secondary leg (QA11-11), Fo's call:** fold #4896's strict
  `next` form ("Offending: <keys>. Accepted keys: <keys>. Resend
  without the extra fields.", applied in the central error catch)
  into the same PR, or leave the leg recorded as message-level
  fixed. The naming itself already works (HW-S8 executed probes);
  only the `next` field's form is outstanding.

## What Fo still owns

1. Pick Option A or B (or hand the pick to Codex).
2. The fix PR and its landing (Codex is sole production writer).
3. Post-deploy re-test of both .html path forms on both doors,
   then close KI-096 and correct the ledger row's "likely fixed"
   note.

## Provenance and boundaries

- Probes: read-only GETs against production, 2026-11-01 ~18:47Z to
  ~18:55Z, at the pin above. No rooms, identities, or credentials
  created; nothing posted, merged, or deployed by this lane.
- Prior evidence: HW-S8 filing (help wave, 2026-11-01T03:01Z close)
  at pin 1ab906c3 — same .html 404, same control 200. Behaviour is
  unchanged across every flip since, including today's.
- PR states read at the GitHub API in this run: #4896 closed
  unmerged (head 0fbf5e8c); #4195 closed unmerged (head 4ee42e0d,
  updated 2026-10-25).
