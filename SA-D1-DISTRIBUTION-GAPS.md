# SA-D1 FILING — Distribution packet gap closure: independent review of Dot's plugin preflight (seq 24646)

- Lane record: `t-20261101-148-sa-d1-distribution-packet-gap-closure-in`
- Ask: Dot's instruction list, muse-room seq 24683, item 1 (priority 1), under John Potter's 2026-10-31 21:01 PT connection-flow order.
- Consumer: Dot (and Codex as release owner).
- Date of this review: 2026-10-31 PT (sources fetched 2026-11-01 ~04:05 UTC).
- Falsifier check: the table below states, for every hosted-plugin metadata / review / disclosure requirement found in the fetched publisher documentation, whether it is MET, MISSING (with proposed owner), or UNVERIFIED. The falsifier therefore does not fire — with one structural exception named as Finding 1: the packet-side status of most items is UNVERIFIED because the preflight itself could not be read.

## Finding 1 (first finding): the preflight is not retrievable from this fleet

- Dot's preflight post, muse-room seq 24646, is **not visible to Jill's seat**. Room reads in this run (room_read_messages via the room-journal MCP client) return seq 24638 followed by seq 24648; seqs 24639–24647 return nothing to this seat. The patch's contents could not be extracted in-room.
- The plan copy Dot cites — ChatGPT page `page_0093507b110c81919e43988fd381081d`, library-file `libfile_02a95c38edc08191ac921d066839b0bc`, SHA `f6b9485aded984849a0248fd7a7fa5341a6016c75db54c3ec0fa756953a1cd3a` (all three identifiers as given by Dot in seq 24683, copied character-for-character) — is **not readable from this fleet**: a direct fetch of `https://chatgpt.com/space/page_0093507b110c81919e43988fd381081d` in this run returned a sign-in screen only (page content: "ChatGPT / OR"). The SHA therefore cannot be re-verified at source.
- Jill's seq 24686 reply already asks Dot to drop a readable handoff in-room. As of this lane's last room read (seqs through 24695), no distribution-preflight handoff has arrived; Dot's seq 24687 readable drop is the executable reproduction for her item-2/TOML lanes, not the preflight.
- Consequence: every packet-content item below is graded UNVERIFIED (claimed covered by an offline preflight this lane cannot read), and every portal-side act is graded MISSING (Dot's own seq 24678: the preflight patch is "awaiting adoption"; the preflight is offline by Dot's own description in seq 24683). This lane did not wait idle for the handoff, per charter.

## Conclusion (install route)

**A genuine friend-install route IS established end-to-end on paper, with every platform step sourced (route R1–R6 below) — but no step of the publisher chain has been performed, and the precise missing publisher/account step is: a verified publisher identity and a plugin draft in the owning OpenAI organization (organization + project selected, individual/business identity verification completed for the publish name, submitter holding Apps Management Write). No portal submission exists; Dot's preflight is offline and unreadable from this fleet, so the packet meant to fill the portal is itself UNVERIFIED.** A private test install (John's Dot-test install) or a ZIP is not distribution — Dot says the same at seq 24601 ("Project Room distributable plugin availability remains unverified; John's private Dot-test install is not friend distribution").

### The route, step by step (each step sourced)

- R1. Publisher completes the portal chain: select owning organization/project → complete identity verification → upload ZIP → clear automated metadata/skill findings → connect MCP server and pass the tool scan → complete domain verification → enter review information and reviewer credentials → Submit for review with policy attestations → approval → **Publish plugin**. Source: S1 (full flow).
- R2. After publication, a friend finds the plugin by **direct link to the directory listing** or by **searching the exact publication name**. Directory main pages show only OpenAI-selected plugins, so the direct link / exact-name search is the reliable route. Source: S3 (Discovery; Publication FAQ).
- R3. In ChatGPT — including the Android app — the friend opens **Settings > Plugins**, selects the plugin, and selects **Install plugin**. (S4 notes very old iOS/Android versions label this surface "Apps".) Source: S4.
- R4. The friend selects **Connect** and completes the plugin's own authorization: sign in to the account with access, review requested services/permissions, complete provider authorization. Installing a plugin does not replace the app's own account authorization. Source: S4.
- R5. The friend uses the plugin via **@**-mention or the **+** menu in a conversation. Source: S4.
- R6. **Room-specific leg (not platform-sourced, not yet proven):** the pasted Project Room invite must survive this native consent flow and bind the friend's exact identity/access, then work across app-close/reconnect without a duplicate member. This is Dot's fresh-account Android gate (seq 24601), which has not yet been executed on a fresh account. The platform legs R1–R5 are established on paper; the Room-invite leg R6 remains unproven until that gate runs (Dot's item 4, a separate lane).

### Why the alternatives are not the route

- **Custom MCP connection / Developer Mode** is the documented path "for private or workspace-only use" (S3) — per-account self-setup, not distribution to a friend. Dot verified at seq 24601 that the Room's personal custom-MCP guide is web-based and not proven for Android creation, so it also fails John's Android requirement.
- **A plugin that depends on lifecycle hooks cannot be submitted at all** (portal rejects packages with lifecycle hooks or app references): its only documented fallback is manual install in Codex desktop (S1). If Dot's package uses hooks, the friend-Android route dies here — flagged as row B7 below, UNVERIFIED.

## Verified sources (all fetched in this run unless noted)

- **S1** — OpenAI, "Upload and submit your plugin", developers.openai.com/plugins/deploy/submission. Portal flow, identity, ZIP upload, metadata/skills checks, MCP connect/scan, auth configuration and limitations, domain-verification details, review information, submit/publish, complete manifest metadata examples.
- **S2** — OpenAI, "Plugin guidelines", developers.openai.com/plugins/plugin-guidelines. Naming/description rules, privacy policy content minimums, restricted data, transparency, commerce rules, support contact, developer verification, tool naming/descriptions/annotations, tool data handling, testing and test credentials.
- **S3** — OpenAI, "Remote MCP server review requirements", developers.openai.com/plugins/deploy/app-review. Organization verification, api.apps.write/read permissions, remote MCP server requirements, review form fields, rejection grounds and FAQs, discovery, publication, continuous review, EU data-residency note.
- **S4** — OpenAI Help Center, "Connected apps in ChatGPT", help.openai.com/en/articles/11487775-connected-apps-in-chatgpt. User-side install/connect flow (Settings > Plugins → Install plugin → Connect → provider authorization), Android/iOS note, @-mention use.
- **S5** — Dot's room posts read in this run: seq 24601 (Android qualification gate; distributable availability unverified), seq 24678 (preflight patch 24646 awaiting adoption), seq 24683 (the ask itself, with the page/library/SHA identifiers).
- Secondary corroboration only (not load-bearing): OpenAI's package guide at developers.openai.com/plugins/build/plugins, surfaced in search results this run, confirms the manifest layout (root plugin.json, extensions.com.openai.interface / review / publication blocks).

Status key: **MET** = established from a source read in this run. **MISSING** = established not performed / not in existence on any record available to this lane. **UNVERIFIED** = the requirement is real and sourced, but whether Dot's packet satisfies it cannot be checked because the preflight is unreadable (Finding 1). Proposed owners are proposals only; nothing here decides a John gate.

## Gap table

### A. Publisher / account prerequisites (portal-side)

| # | Requirement | Status | Verified source | Proposed owner |
|---|---|---|---|---|
| A1 | Owning **organization and project** selected in the plugin submission portal; the portal draft exists under that org/project | MISSING — no portal draft on any record available to this lane; the preflight is offline (S5, seq 24678/24683) | S1, "Confirm access and publishing identity" | Publisher-account holder |
| A2 | **Verified developer identity** — individual verification to publish under a personal name, business verification for a business name; enforced during review, unverified name = rejection | MISSING — no verification on record | S3, "Organization verification"; S1 | John (identity verification is the account holder's own act; proposed, not decided) |
| A3 | Submitter holds **Apps Management Write** (`api.apps.write`); `api.apps.read` to view drafts/status. Org owners have both automatically; owners grant to non-owners via org roles | MISSING | S3, "Plugin submission permissions"; S1 | Org owner (John) grants; Codex as proposed submitter |
| A4 | Owning project uses **global data residency** — projects with EU data residency cannot submit plugins containing apps/MCP for review | UNVERIFIED | S3, EU data-residency note | Publisher-account holder |

### B. Package and listing metadata (plugin.json / mcp.json inside the ZIP)

| # | Requirement | Status | Verified source | Proposed owner |
|---|---|---|---|---|
| B1 | Root identity fields: `name`, `version`, `description`, `author` {name, email, url}, `homepage`, `repository`, `license`, `keywords` | UNVERIFIED | S1, complete metadata examples | Dot |
| B2 | `interface.displayName` obeying naming rules: no overly generic single-word names; do not append "MCP", "MCP Server", or "Plugin" to a company/product name | UNVERIFIED | S1 example; S2, "Plugin name, description, and prompts" | Dot |
| B3 | `interface.developerName` consistent with the verified identity — the directory displays the name associated with the verified developer identity chosen at draft creation | UNVERIFIED | S1, "Create the draft" step 2; S1 example | Dot + publisher-account holder |
| B4 | `interface.shortDescription` and `interface.longDescription`: accurate, straightforward; no pricing, subscription, free-trial, discount or promotion claims; no unverifiable claims; no disparagement of alternatives | UNVERIFIED | S1 example; S2, "Subtitles and descriptions" | Dot |
| B5 | `interface.category` | UNVERIFIED | S1 example | Dot |
| B6 | `interface.capabilities` list | UNVERIFIED | S1 example | Dot |
| B7 | Package contains **no lifecycle hooks** and **no app references** (`apps` / `.app.json`) — the portal cannot accept either; a hooks-dependent plugin's only fallback is manual Codex-desktop install, which is not the friend-Android route | UNVERIFIED — route-critical | S1, "Remove lifecycle hooks before public directory submission…" | Dot / Codex |
| B8 | `mcp.json` declares the MCP server; **only one MCP server can be connected per plugin**; the MCP server must be in the **initial** ZIP (adding one to a skills-only plugin later is not supported) | UNVERIFIED | S1, "Connect and scan your MCP server"; "Create the draft" | Codex (release owner) + Dot |
| B9 | ZIP contains **no private credentials or secrets** | UNVERIFIED | S1, "Keep private credentials and secrets out of the ZIP" | Dot |
| B10 | `onboardingSkill` → `skills/get-started/SKILL.md` with valid name and description in the YAML header; all bundled skills pass the required automated security scans | UNVERIFIED | S1, metadata examples and "Check skills"; S2, Testing (skills scanned) | Dot |
| B11 | Visual assets referenced by the manifest exist in the package under `./assets/`: `composerIcon`, `composerIconDark`, `logo`, `logoDark`, `screenshots` (the reference example ships "the four icon files and screenshot") | UNVERIFIED | S1, metadata examples | Dot |
| B12 | `interface.brandColor` / `brandColorDark` (present in the reference manifest; completeness item) | UNVERIFIED | S1 example | Dot |
| B13 | `interface.defaultPrompt` starter prompts — the Directory shows example prompts; **screenshots are no longer shown in the Directory** | UNVERIFIED | S1 example; S2, "Plugin name, description, and prompts" | Dot |
| B14 | Four public URLs in `interface` — `websiteURL`, `supportURL`, `privacyPolicyURL`, `termsOfServiceURL` — each publicly accessible without auth and identifying the **same publisher** as the submission | UNVERIFIED — no such URLs are on record in-room | S1, "Public URLs must be accessible and identify the same publisher as the submission"; S1 example | Publisher-account holder (hosting) + Dot (values) |

### C. MCP server, authentication, domain (hosted side)

| # | Requirement | Status | Verified source | Proposed owner |
|---|---|---|---|---|
| C1 | An MCP server for Project Room exists and is hosted in production use (the fleet's room traffic runs over it) | MET — component existence only; this is not a submission and not distribution | S5 (room operation, this run) | — |
| C2 | Submission endpoint is a **stable, public HTTPS** MCP URL; not a local or testing endpoint; tunnels are for testing only and not accepted | UNVERIFIED | S3, "Remote MCP server requirements"; S1, "With MCP" | Codex |
| C3 | **Domain verification**: the portal's exact challenge token served as plain text at `https://<challenge-base-host>/.well-known/openai-apps-challenge` on the MCP hostname or an eligible parent domain | MISSING — not performed on any record available to this lane; this lane is barred from performing it (no domain challenge per the ask) | S1, "Domain verification details" | Codex (serves the token on the production host) inside the publisher-account holder's portal session |
| C4 | **Portal-supported authentication only**: none, OAuth, or mixed unauthenticated/OAuth. The portal has no API-key, bearer-token, Basic, or custom-header connection flow; public submission rejects nonempty server `headers` in the package | UNVERIFIED — whether the Room MCP's auth maps to a supported method is not established by any readable source | S1, "Authentication limitations" | Codex |
| C5 | If OAuth: registration method declared in `mcp.json` (`provided` / `dcr` / `cimd`); callback URL registered with the provider; client secret entered in the portal only (the manifest rejects `clientSecret` in `mcp.json`); where workspace domain restrictions apply, a UserInfo endpoint returning `email` and `email_verified: true` with `openid` and `email` scopes | UNVERIFIED | S1, "Configure authentication for submission"; OpenAI, "Submit your Claude Code plugin to OpenAI" (developers.openai.com/plugins/guides/submit-claude-plugin, surfaced in this run's search) for the UserInfo requirement | Codex |
| C6 | Every tool: unique, human-readable, verb-named; **non-empty description that matches the tool's schema and actual behaviour** (mismatch is a rejection ground) | UNVERIFIED | S2, "Tools"; S3, rejection FAQ | Codex (server) / Dot (preflight check) |
| C7 | Every tool carries **explicit boolean annotations** `readOnlyHint`, `destructiveHint`, `openWorldHint` matching behaviour (write-style actions such as posting messages are not read-only; irreversible sends are destructive) | UNVERIFIED | S2, "Correct annotation"; S3, annotation FAQ | Codex |
| C8 | Tool responses return only task-relevant data — no diagnostic/telemetry/internal identifiers (session, trace, request IDs), timestamps, internal account IDs, logs, or auth secrets in outputs | UNVERIFIED | S2, "Tool data handling"; S3, rejection FAQ | Codex |
| C9 | If the server returns UI: a **CSP** allowing the exact domains components fetch from; iframe origins declared with a justification (can trigger extra review/escalation) | UNVERIFIED — whether the plugin returns UI is itself not established from readable sources | S3, "Remote MCP server requirements"; S2, "UI" | Codex |
| C10 | Portal scans passed: package metadata & skills findings resolved, MCP tool scan findings resolved; required scans must complete before submit | MISSING — portal-side act, not performed | S1, "Check metadata" / "Check skills" / "Connect and scan your MCP server" | Publisher-account holder + Codex |

### D. Review packet (portal Review details / manifest `review` and `publication` blocks)

| # | Requirement | Status | Verified source | Proposed owner |
|---|---|---|---|---|
| D1 | **Five positive test cases**: scenario, user prompt, expected tools, expected result; each run on the test account before submitting | UNVERIFIED | S1, "Complete review information" | Dot |
| D2 | **Three negative test cases**: prompt/scenario where the plugin should not act, why, and the expected refusal, clarification, or safe fallback | UNVERIFIED | S1, "Complete review information" | Dot |
| D3 | **Video walkthrough** demonstrating the test cases and functionality, at an accessible recording URL (`review.demo_recording_url`) | UNVERIFIED | S1, "Complete review information"; S1 example | Dot |
| D4 | **Release notes** for the submitted version (`publication.release_notes`) | UNVERIFIED | S1, "Complete review information"; S1 example | Dot / Codex |
| D5 | **Reviewer credentials**: a dedicated test account with login URL, workspace/tenant details, and sign-in instructions; sample data only, never a real user's account; works **immediately without MFA approval, email or SMS codes, magic links, or private-network access**; entered separately in portal **Review details** (never inside the ZIP) and kept available for subsequent reviews | MISSING — no such account is on record in-room, and the portal entry is a separate act an offline packet cannot contain by design | S1, "Complete review information"; S2, "Test credentials"; S3, rejection FAQ | Codex (provision the account) / publisher-account holder (portal entry) |
| D6 | **Policy attestations** completed at Submit-for-review | MISSING — portal act, not performed | S1, "Submit the draft" | Publisher-account holder |
| D7 | **Publication settings**: `publication.countries` availability list; translations (`publication.translations`) where supplied | UNVERIFIED | S1 example; S3 ("publicly available in the countries you define during submission") | Dot / publisher-account holder |
| D8 | **Publish** action after approval — the plugin appears in the universal directory only after the publisher selects Publish | MISSING — nothing has been submitted or approved | S1, "Submit the draft"; S3, "Publish the plugin" and FAQ | Publisher-account holder |

### E. Disclosure and policy compliance

| # | Requirement | Status | Verified source | Proposed owner |
|---|---|---|---|---|
| E1 | **Privacy policy content minimums**: categories of personal data collected, purposes of use, categories of recipients, data retention timelines, and user controls; published, followed at all times, readable by users **before installing** | UNVERIFIED — no plugin privacy-policy URL or text is on record in-room. (Fleet note, not a source for this row: Jill's decided disclosure posture — the ~35-day backup tail and search-indexing/link-sharing disclosures — is input to this text, not a published plugin policy.) | S2, "Privacy policy" | Dot (drafting) / publisher-account holder (publication) |
| E2 | **Disclosure completeness vs behaviour**: every user-related data type any tool returns must be disclosed in the privacy policy — undisclosed returned data is a named rejection ground | UNVERIFIED | S3, rejection FAQ ("Your plugin returns user-related data types that are not disclosed in your privacy policy") | Codex + Dot |
| E3 | **Data-practice disclosure**: no surveillance, tracking, or behavioural profiling — including metadata such as timestamps, IP addresses, or query patterns — unless explicitly disclosed, narrowly scoped, and subject to meaningful user control | UNVERIFIED | S2, "Transparency and user control" | Dot / Codex |
| E4 | **Restricted data bar**: the plugin must not collect, solicit, or process PCI data, PHI, government identifiers, or **access credentials and authentication secrets (API keys, MFA/OTP codes, passwords)** | UNVERIFIED — flagged: the Room connection flow handles invite credentials end-to-end, so the packet must show the plugin never solicits or collects credentials as data | S2, "Restricted data" | Dot / Codex |
| E5 | **Commerce disclosure and rule**: the manifest carries `review.commerce` and `review.commerce_description`; the guidelines allow commerce only for physical goods and bar selling digital products or services **including tokens or credits**, directly or via freemium upsells | UNVERIFIED — **conflict risk flagged**: Project Room's in-room ledger-credit / bounty surface must be adjudicated against this rule before a truthful commerce declaration can be made; this lane makes no legal claim about it | S1 example (`review.commerce`); S2, "Commerce and monetization" | Codex (feature-scope adjudication) / Dot |
| E6 | **General-audience suitability**: suitable for general audiences including ages 13–17; no explicit targeting of under-13s; compliance with OpenAI usage policies | UNVERIFIED | S2, "Safety" / "Appropriateness" | Dot |
| E7 | **No implied OpenAI endorsement; fair play; authorized access**: no model-readable field may manipulate model selection of other plugins; third-party integrations only with authorization and ToS compliance; unofficial pass-through connectors to third-party services cannot be approved | UNVERIFIED | S2, "Purpose and originality" / "Fair play" / "Third-party content and integrations" | Dot |

## Counts

- Total requirements tabled: **43**
- MET: **1** (C1 — component existence only)
- MISSING: **8** (A1, A2, A3, C3, C10, D5, D6, D8) — every one is a publisher/account or portal-side act; none is performable by this fleet lane under the ask's limits (no publication, no domain challenge, no credentials).
- UNVERIFIED: **34** (A4; B1–B14; C2, C4–C9; D1–D4, D7; E1–E7) — each is a real, sourced requirement whose packet-side satisfaction sits inside Dot's unreadable preflight.

## UNVERIFIED items (named, per the acceptance shape)

All 34 UNVERIFIED rows above, and in particular the route-critical ones: **B7** (lifecycle hooks / app references would make the package unsubmittable), **C4** (portal supports only none/OAuth/mixed auth — API-key/bearer flows cannot complete setup), **C2** (stable public HTTPS endpoint, no tunnels), **E5** (commerce declaration vs the bar on selling credits), **E1/E2** (privacy policy existence, content, and completeness against actual tool outputs). Also unverifiable as a whole: the preflight's own SHA and contents (Finding 1).

## What would close this lane's gaps

1. Dot drops the preflight in a readable form in-room (already asked, seq 24686) → rows B, D1–D4, D7, E1–E7 can be re-graded MET/MISSING against the actual packet in one short recheck.
2. Codex (release owner) confirms C2, C4, C5, C9 against the production MCP server and adjudicates E5's feature scope.
3. The publisher-account holder performs A1–A3 (org/project, identity verification, permissions) — A2 is John's own act if publishing under his name or Demigod's; proposed here, not decided.
4. C3 (domain challenge) and D5 (reviewer test account) are performed at submission time by Codex + the publisher-account holder; both are barred to this lane by the ask itself.

No publication, domain challenge, credential handling, or legal promise was made by this lane. No publisher details, installation links, or legal claims were invented: every requirement above traces to a fetched OpenAI source (S1–S4), and every Project Room-side fact traces to Dot's own room posts (S5).
