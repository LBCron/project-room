# SA-D4 — Fresh-Android Qualification: Tester Packet and Disposable-Fixture Plan

- Lane: SA-D4, record `t-20261101-151-sa-d4-fresh-android-qualification-readin`
- Source: Dot's instruction list, muse-room seq 24683 item 4; Jill's ownership reply seq 24686 item 5; John's 2026-10-31 21:01 PT connection-flow order (items 3 and 5 in the seq 24686 numbering: plugin distribution, fresh Android proof)
- Consumer: Dot (and Jill, for the eventual qualification run)
- Status of this document: PREPARATION ONLY. This packet does not run the qualification. No friend was enrolled, no identity or account was created, and John's existing persistent automation was not touched or stopped in preparing it.
- Grounding rule used throughout: a step's expected behaviour is stated only where the room record or a filed wave artefact documents it. Anything else is marked **TO-VERIFY** and the tester must not treat it as a promise of how the product behaves.

## How to use this packet

- One consenting tester, using their own Android device and their own throwaway account (see Fixture Plan), executes Steps 1–10 in order, in one sitting except where a step says to wait.
- A second person (the run observer, Jill fleet or Dot) watches the Room side from a separate, already-working seat and records Room-side evidence. The tester never needs fleet help to perform the actions; the observer only records.
- Stop rules are absolute: any step's named failure signature stops the run. Do not retry past a stop, do not improvise a workaround, and do not use a different install route, account, or room. Record the failure evidence named for that step and end the run.
- Never capture a credential: no invitation code, password, one-time code, token, or secret may appear in any screenshot, log, or note. If a screen shows one, do not screenshot it; write down only the screen's name and the time.
- Synthetic data only. Both work items use the nonce strings supplied in the Fixture Plan. No real personal data, no money, no bounty, no payment leg is part of this run.

## Actors used in this packet

- **Tester** — the consenting owner of the fresh Android account and device.
- **Dot** — the intended agent the tester connects to. Before the run, Dot supplies her expected member identifier for the qualification room, in the room, so the observer can check identity by exact match. The form of that identifier is **TO-VERIFY** (Dot to name it at run setup).
- **Jill fleet** — creates the disposable `qa-*` room and the two work items, observes Room-side, and files evidence. Jill fleet does not create the tester's account and does not mint an owner-equivalent invitation.
- **Codex** — release and security owner; owner of invitation-redemption recovery, native invitation permissions, and identity continuity (seq 24686 items 1b and 4). Codex is not an actor during the run; his work appears only as gates.
- **Operator (John's operator session)** — retires the room and identities afterwards where retirement is an operator act (see Fixture Plan).

---

## Part 1 — Tester packet: the flow, step by step

### Step 0 — Pre-flight check (before touching the phone)

- **Actor:** Tester, with Jill fleet observer confirming fixture readiness in the Room.
- **Exact action:** Confirm, out loud / in the run note: (a) the device has no prior install of the app/plugin used for this route and the throwaway account has never connected to Project Room before; (b) the qualification room name and the two work-item nonce strings match the Fixture Plan exactly; (c) Dot's expected member identifier has been supplied; (d) every gate marked BINDING in Part 3 is recorded as cleared or the run does not start.
- **Expected observable result:** All four confirmations recorded in the run note with the date and time. If any confirmation cannot be made, there is no run — that is a result, not a failure to improvise around.
- **Evidence to capture:** Run note (text file) listing room name, nonce strings, Dot's expected member identifier, and the gate check. No screenshot at this step.
- **Failure signature (stops the run):** The account or device turns out not to be fresh (prior install, prior connection, or John's or anyone else's existing account/automation is the only one available). Using a non-fresh account invalidates the whole qualification.

### Step 1 — Install the plugin on the fresh Android account

- **Actor:** Tester.
- **Exact action:** On the Android device, signed in only as the throwaway account, follow the genuine friend-install route established by lane SA-D1 (Dot item 1 / John item 3, distribution). Install the Project Room plugin exactly as a friend with no fleet help would. Do not sideload, do not install from a ZIP file, and do not use a private test plugin — seq 24686 item 3 states none of those is proof of the route.
- **Expected observable result:** The plugin installs under the throwaway account and appears as installed in the host app on the device. The exact host app, store/listing name, screens, and prompts are **TO-VERIFY** — SA-D1's gap table is the document that must name them before this run starts; if SA-D1 has not named an exact route, this step cannot begin.
- **Evidence to capture:** Screenshot of the installed-plugin confirmation screen (no credentials visible), plus a run-note line giving install start and finish times and the route used (listing name / link source as named by SA-D1).
- **Failure signature (stops the run):** No genuine friend-install route exists for a fresh account; the only available routes are a ZIP, a private test plugin, or a fleet-assisted install; or installation demands a publisher/account step that has not been completed (name it exactly in the run note — that name is the deliverable of the failed run).

### Step 2 — Approve the invitation

- **Actor:** Tester (approves); Jill fleet (issues the invitation into the `qa-*` room, at the invitation type the Fixture Plan names).
- **Exact action:** Open the invitation for the qualification room on the device and approve/accept it, following the on-screen consent prompts exactly as presented. Read every permission the approval screen names before approving; if the screen asks for a permission not listed in the Fixture Plan, stop instead of approving.
- **Expected observable result:** The tester joins the qualification room as a member, and the observer sees the tester's member appear in that room. Grounded behaviour nearby: invitation redemption is request-ID based and a replay with the same request ID returns the same member (Dot's reproduction, seq 24687, tests 1 and 4). The exact Android consent screens and the permission list they show are **TO-VERIFY**.
- **Evidence to capture:** Screenshot of the final approval/consent screen before confirming (permissions legible, no code or credential visible) and a screenshot after joining showing the room name; observer records the Room-side member identifier assigned to the tester and the time.
- **Failure signature (stops the run):** (a) The invitation is consumed but no saved connection/member results — this is the known lost-redemption-response defect shape (seq 24686 item 1b; Dot seq 24687 test 1); do not re-approve or request a second invitation, record and stop — recovery is Codex's candidate, Gate C3. (b) The approval grants, or asks for, any permission beyond the fixture list, or widens an existing grant. (c) The invitation is expired or revoked on arrival (those states belong to the separate setups and to lane SA-C2's API cases, not to this happy-path run).

### Step 3 — Connect the intended Dot

- **Actor:** Tester (initiates the connection in the room/app as the flow presents it); Dot (accepts/appears as the connected agent).
- **Exact action:** From inside the qualification room, connect to Dot using the connection action the product presents, and confirm the connected agent's identity against the expected member identifier supplied at Step 0.
- **Expected observable result:** The connected agent in the room is exactly the intended Dot: the member identifier matches Dot's supplied identifier character for character, and Dot shows as present/connected in the room. Grounded expectation nearby: on the established golden path a newly joined agent shows up present in the room; whether the Android route shows presence the same way is **TO-VERIFY**. Also **TO-VERIFY**: whether link-admitted and code-invited connections differ in who may wake/talk to the agent on this route — the packet does not assume either.
- **Evidence to capture:** Screenshot showing the connected agent's displayed identity in the room; observer records the connected member identifier from the Room side and the exact-match result against Dot's supplied identifier.
- **Failure signature (stops the run):** The connected member identifier does not match the intended Dot; a different agent, a stale session, or an unidentified member connects; or Dot cannot be connected at all from the fresh account. Identity mismatch is never waived — a run connected to the wrong agent proves nothing.

### Step 4 — Do useful work

- **Actor:** Tester (posts the work); Dot (claims and performs it).
- **Exact action:** The tester posts Work Item 1 exactly as written in the Fixture Plan (a bounded synthetic task carrying nonce 1) as a work item/message in the qualification room, addressed to Dot. Dot claims it and performs it through the connection established in Step 3.
- **Expected observable result:** Dot claims Work Item 1 (claim visible in the room) and completes the task's requested action. Grounded expectation: on the golden path a human posts work, the agent claims it, and the claim is recoverable if its acknowledgement is lost; the Android-presented claim UI, if any, is **TO-VERIFY**.
- **Evidence to capture:** Observer records the work item's identifier and the claim identifier/state from the Room side, with times; tester screenshots the room showing Work Item 1 as claimed by Dot.
- **Failure signature (stops the run):** Work Item 1 cannot be posted from the fresh account; Dot never claims it within the run window (**TO-VERIFY**: the run observer names a concrete wait window at setup, suggested 15 minutes, and records it at Step 0); or a member other than the intended Dot claims it.

### Step 5 — Save a result

- **Actor:** Dot (delivers the result); Tester (confirms it is saved).
- **Exact action:** Dot delivers the Work Item 1 result, containing nonce 1 verbatim, as the work item's result in the room. The tester then explicitly saves the result using whatever save action the product presents (if the product saves automatically with no tester action, the tester records that fact instead — do not invent a save step).
- **Expected observable result:** The result is saved in the room such that it survives the app being closed in Step 6 — i.e. it is a Room-side saved result, not only a screen on the phone. Whether a distinct tester "save" action exists on this route, and what a saved result is called, are **TO-VERIFY**. A receipt for the outcome, if the product issues one, shows its verification status honestly (grounded golden-path expectation); receipt existence on this route is **TO-VERIFY**.
- **Evidence to capture:** The result's identifier in the room (result/message identifier; receipt identifier if one is issued), a screenshot of the saved result on the device, and the observer's Room-side read-back of the same result identifier and nonce.
- **Failure signature (stops the run):** The result exists only on the device or only in a transient view and cannot be read back from the Room side; the saved result's nonce differs from nonce 1; or saving requires an account, permission, or payment step not in the Fixture Plan.

### Step 6 — Close the app

- **Actor:** Tester.
- **Exact action:** Fully close the host app on the Android device (swipe it away from recents; do not merely switch apps, do not uninstall, do not sign out). Leave it closed until Step 8 is complete. Note the time.
- **Expected observable result:** The app is closed on the device. Nothing about the saved result or the connection is deleted by closing: the saved connection survives a listener/client stop in the grounded CLI behaviour (Dot seq 24687 test 5: graceful stop releases the lease but preserves the saved connection); the Android equivalent is **TO-VERIFY** and is exactly what Steps 8–9 test.
- **Evidence to capture:** Run-note line: time the app was closed and the method used (recents swipe). No screenshot (a closed app has nothing to show).
- **Failure signature (stops the run):** Closing is impossible without signing out or uninstalling (record and stop — the flow under test no longer exists); or the device shows the connection/account was removed by closing.

### Step 7 — Receive a request solely through Room

- **Actor:** Jill fleet observer (posts the request in the Room); Dot (relays/performs only as the Fixture Plan states); Tester (receives — passive in this step).
- **Exact action:** While the app is closed, the observer posts Work Item 2 (carrying nonce 2) in the qualification room, addressed to the tester/Dot pair exactly as the Fixture Plan states. No other channel may be used: no SMS, no email, no phone call, no other app notification arranged by the fleet. The tester does not open the app during this step.
- **Expected observable result:** The request reaches the tester solely through the Room — i.e. when the tester next opens the app (Step 9), Work Item 2 is there, and any device notification the tester received came from the Room/host app itself and not from any fleet-arranged side channel. Whether a closed Android app receives a push/background notification for a Room event at all, and in what form, is **TO-VERIFY** — it is one of the main things this qualification exists to establish. Background execution and host permissions are separate grants (seq 24686 item 4) and must not be silently assumed.
- **Evidence to capture:** Observer records Work Item 2's identifier and posting time from the Room side; tester, at Step 9, screenshots the first screen that shows Work Item 2 and notes whether a notification arrived while the app was closed, and if so its exact wording (screenshot of the notification only if it contains no credential or personal data).
- **Failure signature (stops the run):** Work Item 2 can only be delivered by using a side channel; the request was posted to the wrong room or under a different identity; or — recorded at Step 9, but belonging to this step — no trace of Work Item 2 exists anywhere after reconnect.

### Step 8 — Save a reply (app still closed until posting is possible)

- **Actor:** Tester.
- **Exact action:** Without first doing anything else in the app, note how Work Item 2 presented itself, then — once the app is open for this step — post a reply to Work Item 2 containing nonce 2 verbatim, and save it the same way as Step 5. (If the product offers a reply directly from a notification, the tester may use it, and must record that they did; the reply path used is evidence, not a detail.)
- **Expected observable result:** The reply is saved Room-side against Work Item 2, readable by the observer from the separate seat, with nonce 2 intact. The reply-from-notification path, if any, is **TO-VERIFY**.
- **Evidence to capture:** The reply's identifier in the room, a screenshot of the saved reply on the device, and the observer's Room-side read-back (identifier + nonce).
- **Failure signature (stops the run):** The reply can be drafted but not saved; the reply attaches to the wrong work item; or the reply is visible on the device but not readable from the observer's seat.

### Step 9 — Reconnect

- **Actor:** Tester (reopens the app); Dot (re-establishes presence/connection as the flow requires).
- **Exact action:** Reopen the host app on the device, return to the qualification room, and re-establish the connection to Dot if the product requires an explicit reconnect action (record whether it reconnected automatically or required an action, and which). Then verify, in order: the Step 5 saved result is still present; Work Item 2 and the Step 8 saved reply are present; Dot is the same member as in Step 3.
- **Expected observable result:** Reconnection restores the same room, the same tester member, and the same Dot member, with both saved artefacts intact. Grounded nearby expectation: a saved connection is preserved across a stop (seq 24687 test 5); Android session restore behaviour is **TO-VERIFY**.
- **Evidence to capture:** Screenshot of the room after reconnect showing the saved result and the reply; observer records the member identifiers on reconnect and the exact-match results against Steps 2, 3, and 5.
- **Failure signature (stops the run):** Reconnect lands in a different room or under a different member identity; Dot's member differs from Step 3; either saved artefact is missing; or reconnect requires a fresh invitation (that converts this run into the lost-connection defect — record, stop, and route to Gate C3).

### Step 10 — Duplicate delivery handled (no double effect)

- **Actor:** Jill fleet observer (triggers the duplicate); Tester and Dot (observe only — neither re-acts on the duplicate).
- **Exact action:** The observer re-delivers Work Item 2 exactly once, by the Room mechanism the Fixture Plan names at setup (re-post with the same work-item/request identity if the product supports it; the exact mechanism is **TO-VERIFY** and must be named at Step 0 — if no same-identity re-delivery mechanism exists, the observer instead replays the Step 2 redemption/reply path only if the product exposes one to a tester, and otherwise this step is recorded NOT-RUN with the missing mechanism named, not improvised). Neither the tester nor Dot claims, replies to, or re-saves anything for the duplicate.
- **Expected observable result:** No double effect: exactly one claim, one saved reply, and one result exist for Work Item 2 after the duplicate; no second payment/effect/state change of any kind. Grounded expectation: same-request-ID replay returns the same member/connection rather than a second one (seq 24687 tests 1 and 4); whether Room work-item delivery carries the same idempotency on the Android route is **TO-VERIFY** — this step is its test. Note Dot's seq 24687 security boundary: the durable-secret replay test records a current server/client mismatch and is NOT authorisation to install a global identity secret as a room-scoped credential; the tester must never be asked to do anything of that kind to make this step pass.
- **Evidence to capture:** Observer's Room-side counts after the duplicate: number of claims, replies, and results attached to Work Item 2 (each with identifiers), plus a screenshot of the room on the device showing a single effect.
- **Failure signature (stops the run):** Any count exceeds one; a second claim/reply/result appears; the duplicate creates a second member or connection; or handling the duplicate requires the tester to enter any credential or secret.

**Main flow total: 10 steps (Steps 1–10), plus the Step 0 pre-flight.**

---

## Part 2 — Revocation tests (SEPARATE qualification setup — never in the main run, never John's persistent automation)

These tests run only in a second, separately created `qa-*` setup (Fixture Plan, setup B), with its own throwaway invitation and identity, after the main run is filed. They never use the main run's room, the tester's main-run identity, or any of John's existing automation, accounts, or agents.

### Step R1 — Revoked invitation does not join

- **Actor:** Jill fleet (revokes the setup-B invitation before use); Tester (attempts to approve it).
- **Exact action:** Issue a setup-B invitation, revoke it, then have the tester attempt approval exactly as in Step 2.
- **Expected observable result:** Approval is refused and no member is created. (The API-level revoked-invitation case is also lane SA-C2's; this is only the Android-presented leg. Exact refusal wording is **TO-VERIFY**.)
- **Evidence:** Screenshot of the refusal; observer's Room-side record that no new member appeared.
- **Failure signature (stops the setup):** The revoked invitation joins, creates a member, or grants any access.

### Step R2 — Revoked connection stops acting

- **Actor:** Jill fleet / Codex-side owner as the product requires (revokes the setup-B connection after a successful join); Dot-side test identity (attempts to act).
- **Exact action:** In setup B only, complete join + connect, then revoke the connection/invitation, then attempt one Room action (post/claim) through the revoked connection.
- **Expected observable result:** The action is refused after revocation; the previously saved setup-B result remains readable or is removed exactly as the product documents — which of those is correct is **TO-VERIFY** and must be named by Codex (security owner) before this step runs.
- **Evidence:** Observer's Room-side record of the refused action and its error; screenshot of the device-side refusal.
- **Failure signature (stops the setup):** Any action succeeds through the revoked connection, or revocation silently widens or transfers the grant.

### Step R3 — Scope reduction is honoured

- **Actor:** Owner of the grant (named at setup by Codex); Tester/Dot test identity (attempts the removed scope and the retained scope).
- **Exact action:** Reduce the setup-B grant's scope by one named permission, then attempt one action inside the retained scope and one inside the removed scope.
- **Expected observable result:** Retained-scope action succeeds; removed-scope action is refused. The available scopes and the reduction mechanism are **TO-VERIFY** (Dot item 3 names revocation and scope reduction as Codex-candidate qualification cases, seq 24683 item 3).
- **Evidence:** Room-side records of both attempts with identifiers and outcomes.
- **Failure signature (stops the setup):** The removed-scope action succeeds, or the retained-scope action fails because of the reduction.

### Step R4 — Expired invitation does not join

- **Actor:** Jill fleet (issues a setup-B invitation with the shortest available expiry and lets it lapse); Tester (attempts approval after lapse).
- **Exact action:** Attempt approval of the expired invitation exactly as in Step 2.
- **Expected observable result:** Approval is refused as expired; no member is created. (API-level expired-invitation case is lane SA-C2's; exact Android wording **TO-VERIFY**.)
- **Evidence:** Screenshot of the refusal; observer's record that no member appeared; issue and lapse times in the run note.
- **Failure signature (stops the setup):** The expired invitation joins or can be revived without a fresh invitation from the owner.

**Revocation total: 4 steps (R1–R4), all in the separate setup B.**

---

## Part 3 — Disposable-fixture plan

All fixtures are created for this qualification only, are synthetic, and are retired afterwards. Nothing in this plan was created in preparing this packet.

### Setup A — main run fixtures

| Fixture | Exact form / naming | Created by | How | Retired by / how |
|---|---|---|---|---|
| Throwaway Android account | Tester's own new account for the host app, labelled in the run note `qa-android-<run date>`; credentials held only by the tester, never shared, never recorded | Tester (themselves) | Tester creates it on their own device before Step 0, following the host app's normal sign-up | Tester (themselves): sign out, remove the plugin, and delete/close the throwaway account after evidence is filed; if the tester prefers to keep the account, the run note records that it is disconnected and holds no Room grant |
| Android device | Tester's own device, host app freshly installed, no prior Project Room connection | Tester | Fresh install at Step 1 | Tester: uninstall or disconnect the plugin at retirement; device itself is the tester's property and is not a fleet fixture |
| Qualification room | `qa-android-qual-<run date>` (qa-* naming, per wave charter) | Jill fleet (Jill 2 seat) | Created as a disposable QA room containing only the tester member, the intended Dot, and a Jill observer seat | Operator act: archived in the November operator sweep (archiving/retiring QA rooms and identities are operator acts — precedent: SA-S4 residue filing, seq 24680). Named here for that sweep: room `qa-android-qual-<run date>` |
| Tester member identity | Display identity created by the Step 2 approval inside the qa room; member identifier recorded at Step 2 | Arises from the approved invitation (system-created on redemption) | Via Step 2 only — the fleet does not pre-create a tester identity | Operator sweep: identity `qa-android-qual-<run date>` tester member retired with the room; any credential is never persisted by the fleet (precedent: SA-S4, secret held in memory only) |
| Dot connection identity | The intended Dot, identified by the member identifier Dot supplies at Step 0 | Dot (existing seat) / or a disposable Dot test identity if Dot elects one at setup — Dot's choice, recorded at Step 0 | Connected at Step 3 only | If a disposable Dot test identity was used: retired by Dot/Codex with the room in the operator sweep. If Dot's real seat connected: connection to the qa room is removed at room retirement; Dot's seat itself is never retired |
| Invitation (main) | One invitation into the qa room, of the type named at Step 0 setup (code vs link and its talk/permission policy recorded — the policy difference between admission types is **TO-VERIFY** for this route). If an owner-equivalent invitation is required, only John can mint it (reserved gate, Gate H3) | Jill fleet if the invitation type is within its minting ability; otherwise John (owner-equivalent) — named at Step 0, never assumed | Issued immediately before Step 2, single run, shortest practical expiry | If unused or after use: revoked/expired by its issuer; consumed invitations need no retirement beyond room archival. Named for the operator sweep if revocation is an operator act |
| Work Item 1 | Bounded synthetic task text carrying nonce 1: `QA-ANDROID-<run date>-1` plus a unique word the tester chooses at Step 0 (recorded in the run note, making the expected result checkable without personal data) | Jill fleet (text); Tester (posts it) | Posted at Step 4 exactly as written | Lives and dies with the qa room; archived with it in the operator sweep |
| Work Item 2 | Bounded synthetic request carrying nonce 2: `QA-ANDROID-<run date>-2`, posted Room-only at Step 7 while the app is closed | Jill fleet observer | Posted at Step 7; re-delivered once at Step 10 by the mechanism named at Step 0 | Lives and dies with the qa room; archived with it |
| Run evidence set | Run note, screenshots named in Part 1, Room-side identifiers list | Tester + Jill observer | Captured during the run; no credentials in any artefact | Filed on the evidence branch for this qualification when it runs; screenshots containing no credentials may be retained with the filing; anything that accidentally captured a credential is deleted and re-captured, and the incident is noted |

### Setup B — revocation fixtures (separate, created only when R1–R4 are scheduled)

| Fixture | Exact form / naming | Created by | How | Retired by / how |
|---|---|---|---|---|
| Revocation room | `qa-android-revoke-<run date>` (qa-*) | Jill fleet | Separate room, created after the main run is filed; never the main room | Operator sweep: archived, named for the November operator sweep |
| Setup-B invitation(s) | One to be revoked before use (R1), one to join then be revoked (R2/R3), one short-expiry to lapse (R4) | Same issuer rule as Setup A | Issued per-step, immediately before each R step | Revocation/expiry is the test itself; residues named for the operator sweep |
| Setup-B identities | Tester member in setup B (fresh join via the R2 invitation) and a Dot-side test identity if Dot elects one; never the main-run identity, never any of John's persistent agents | Arise on redemption / Dot | Via the R steps only | Operator sweep with the setup-B room |
| Explicit exclusion | John's persistent automation, accounts, agents, and rooms | — | Never enrolled, never stopped, never revoked, never used as a fixture in either setup | — |

---

## Part 4 — Gate table

Every prerequisite for the eventual run, classified. Status is as verified from the room record and this wave's filings at packet time (2026-10-31 ~21:15 PT); anything this lane could not read at source is marked UNVERIFIED.

### CODE gates — code or a named candidate must exist / land first

| # | Gate | Owner | Status (source) |
|---|---|---|---|
| C1 | Item-3 install route: a genuine friend-install route for the plugin on a fresh account — the exact hosted-plugin metadata, review, and disclosure items, with the missing publisher/account step named if the route is not yet genuine. A private test plugin or ZIP does not clear this gate (seq 24686 item 3) | SA-D1 lane (Jill fleet) producing the gap table; Codex as release owner; publisher/account step owner to be named by SA-D1 | OPEN — SA-D1 is IN-FLIGHT (its STATE.md: record `t-20261101-148-sa-d1-distribution-packet-gap-closure-in`, reading Dot's preflight seq 24646). Route not yet established in any filing this lane could read. **This gate binds first (see headline below).** |
| C2 | Dot's TOML conflict fix: existing unmanaged bare/quoted Codex table refuses before login/redeem/config mutation, bytes preserved, managed setup idempotent (Dot item 2, seq 24683; Dot owns the patch on PR #5563 head `61b55ff937842e25d89cdf0bb3af971c97a3cb89`) | Dot (patch); SA-D2 lane (Jill fleet) as independent reviewer at handoff | OPEN — handoff not yet received (SA-D2 STATE.md; seq 24689 item 2: BLOCKED on handoff). Applicability to the Android route specifically is UNVERIFIED: the TOML surface is a desktop Codex config surface; if the Android install route never writes it, C2 gates the desktop leg only, not Step 1. SA-D1/Dot to confirm applicability |
| C3 | Codex recovery candidate: pending-redemption / credential recovery for a lost invitation-redemption response (invite consumed, no saved connection), under Codex's approved room-scoped contract — not a global identity secret installed as a host credential (Dot seq 24687 security boundary) | Codex | OPEN — candidate not yet named (seq 24686 item 1b; seq 24689 item 3: BLOCKED on Codex naming a candidate). Gates the failure path of Step 2 and the fresh-invitation branch of Step 9; the happy path can be attempted without it, but a Step 2 lost-response failure cannot be recovered or passed without it |
| C4 | PR #5563 onboarding changes (the composed onboarding/UI head carrying the adopted fixes) landed and deployed | Codex (sole lander/deployer) | OPEN — #5563 open draft at `61b55ff9` as verified in seq 24686; no landing or deploy recorded in the room record this lane read |
| C5 | Duplicate-delivery idempotency on the Android/Room work-item leg: same-identity re-delivery produces no second claim/reply/result (Step 10) | Codex (recovery/security runtime); Dot (reproduction source, seq 24687) | UNVERIFIED for the work-item leg — server-side same-request-ID redemption replay is grounded by Dot's seq 24687 tests 1 and 4, including a recorded server/client durable-secret mismatch; work-item duplicate behaviour on this route has no grounded source this lane could read |
| C6 | App-closed Room-event delivery on Android: push/background delivery of a Room request to a closed host app, and the reply path from it (Steps 7–8) | Codex (product/runtime); Fo for any browser-presented leg | UNVERIFIED — no documented or observed behaviour for closed-app Android delivery was found in the room record or wave filings this lane read. This is a qualification question, not a known behaviour; the run answers it if C1 and H1 clear |

### BROWSER gates — a live browser venue is required (Fo's territory)

| # | Gate | Owner | Status (source) |
|---|---|---|---|
| B1 | PR #5563 browser qualification (the browser legs of join, consent, first task, saved result at the current head) | Fo (alone executes the reserved #5563 browser lane — Dot seq 24683 item 5; seq 24686 item 2) | OPEN — Fo owns it; SA-C2 asked Fo in-room (seq 24694) what his lane needs; no Fo reply was in the room record this lane read (latest seq read: 24694) |
| B2 | Mobile layout and keyboard behaviour for any web-presented step of the flow | Fo (browser venue, per seq 24686 item 2) | OPEN — explicitly Fo's venue; Jill fleet runs no duplicate browser cases. Note: B1/B2 qualify web-presented legs only; they do not substitute for the native Android run this packet specifies |

### HUMAN / ACTUAL FRESH-ACCOUNT gates — a person must act or consent

| # | Gate | Owner | Status (source) |
|---|---|---|---|
| H1 | A consenting fresh-account owner (the tester): a real person who creates and holds the throwaway account, performs Steps 1–10 on their own device, and consents to the evidence capture named in Part 1 | The tester themselves; if no tester is forthcoming, this becomes a named blocker to John (seq 24686 item 5) | OPEN — no tester enrolled (by instruction: this lane enrolled no one). Co-binding with C1 for the run: the run waits on both, in the order C1 then H1 (a tester cannot start Step 1 before a genuine route exists to install) |
| H2 | Publisher / account-holder steps for hosted plugin distribution, exactly as SA-D1 names them (publisher identity, account enrolment, review/disclosure submissions — no invented publisher details, no legal promises from the fleet) | To be named by SA-D1; account-holder acts are expected to be John's or the publisher account holder's — UNVERIFIED until SA-D1 files | UNVERIFIED — SA-D1 has not yet filed the gap table this lane could read; this gate cannot be described more precisely without inventing publisher details, which seq 24686 item 3 forbids |
| H3 | Owner-equivalent invitation minting, if the qualification room's invitation must be of that type | John (reserved gate: owner-equivalent invites are John's alone) | UNVERIFIED whether this run needs that invitation type — to be settled at Step 0 setup from SA-D1/SA-C2 findings on invitation types; if it is needed, it is a John act and the run waits for it |
| H4 | Dot's availability and identity confirmation for the run window: Dot supplies her expected member identifier before Step 0 and is the connected agent in Steps 3–5 | Dot | OPEN — Dot commissioned this packet (seq 24683 item 4) and is its consumer; a run window and her identifier have not yet been supplied in the room record this lane read |
| H5 | Tester's device and account hygiene: tester creates the account themselves, holds all credentials, performs any publisher/store account prompts personally, and retires the account themselves afterwards | Tester | OPEN — follows from H1; no fleet member may create, hold, or enter the tester's credentials at any step |

### Headline — which gate binds first

**CODE gate C1 binds first.** Dependency order, per seq 24686 item 5 ("the run itself waits on the install route from item 3 and on a consenting account owner"): without SA-D1 establishing a genuine friend-install route — or naming the precise missing publisher/account step (H2) that blocks it — Step 1 cannot begin for any tester, however willing. C1's owner is the SA-D1 lane (Jill fleet) with Codex as release owner and the H2 publisher/account act still to be named by SA-D1. H1 (consenting tester, escalated to John by name if it becomes the binding blocker) is the co-binding human gate immediately behind it. Browser gates B1/B2 and code gates C2–C6 qualify legs of the flow but do not precede C1: C2's Android applicability is itself unverified, C3/C5/C6 are failure-path and delivery questions the run exists to answer, and C4 is Codex's landing act for the composed onboarding head.

---

## Part 5 — What this packet does not do

- It does not run any step, enrol any tester, create any account, identity, invitation, or room, or touch John's persistent automation.
- It does not invent Android screens, store listings, publisher details, installation links, notification behaviour, or save/receipt behaviour: every such item above is marked TO-VERIFY for SA-D1, Fo, Codex, or the run itself to establish.
- It does not widen any grant: room permissions, host permissions, and background execution remain separate (seq 24686 item 4), and no step in this packet asks a tester to approve a permission the Fixture Plan did not name in advance.
