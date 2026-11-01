// RES-0140 (AP-1 T2-L04a-C9): applyPullRequestWebhook was an
// unauthenticated settlement export that enumerated the whole claim
// registry per call — any direct caller could settle claims with a
// fabricated pull_request payload, and one call decoded every claim in
// every room. The export now verifies the delivery itself with the same
// HMAC verifier and secret the PR webhook route uses
// (server/github-app/verify.mjs, GITHUB_PR_WEBHOOK_SECRET), refuses
// unverified calls before touching the store, and SQL-selects only the
// claims linked to the payload's pull URL.
//
// These tests run the real boundary: a real RoomStore, claims created
// and claimed through the real work-claim routes, settlement attempted
// through the export exactly as a direct caller would.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { handleWorkClaims } from "../server/work-claim-routes.mjs";
import { applyPullRequestWebhook } from "../server/claim-pr-sync.mjs";
import { handlePrWebhookPayload, PR_WEBHOOK_SECRET_ENV } from "../server/claim-autolink.mjs";

const URL_A = "https://github.com/Uuriko/project-room/pull/7";
const SECRET = "res-0140-fixture-secret";
const PAYLOAD = { action: "closed", pull_request: { html_url: URL_A, merged: true, state: "closed" } };

// The export reads its secret from the env, exactly as the route does;
// the caller presents only the raw body and its signature header.
const sign = (payload, signingKey = SECRET) => {
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    signature256: "sha256=" + createHmac("sha256", signingKey).update(rawBody).digest("hex"),
    env: { [PR_WEBHOOK_SECRET_ENV]: SECRET },
  };
};

async function fixture(t) {
  const store = new RoomStore(":memory:");
  store.initialize(initialRoom("commons"));
  t.after(() => store.close());
  const helpers = {
    json: (_res, status, value) => ({ status, value }),
    reject: (status, code, message) => { const error = new Error(message); error.status = status; error.code = code; throw error; },
    body: async req => req.body,
  };
  const call = (route, id, body) => handleWorkClaims({
    req: { method: route === "list" || route === "read" ? "GET" : "POST", body },
    res: {},
    url: new URL("https://room.example/api/rooms/commons/work-claims"),
    store, roomId: "commons",
    auth: { member: { id: "owner", kind: "human", permissions: [] } },
    workClaimRoute: route, workClaimId: id, helpers,
    registry: store.workClaims,
    githubToken: null,
  });
  await call("create", null, { id: "target", files: ["docs/a.md"], pullRequest: URL_A });
  await call("claim", "target", {});
  await call("create", null, { id: "template", files: ["docs/t.md"] });
  const template = store.workClaims.get("commons", "template");
  store.workClaims.set("room-b", { ...template, id: "bystander-b" });
  store.workClaims.set("room-c", { ...template, id: "bystander-c" });
  store.workClaims.set("room-c", { ...template, id: "bystander-c2" });
  // Instrument registry reads from here on: the export's own reads are
  // what these tests measure, so seeding reads stay out of the counts.
  const reads = { list: [], get: [] };
  const originalList = store.workClaims.list.bind(store.workClaims);
  const originalGet = store.workClaims.get.bind(store.workClaims);
  store.workClaims.list = (roomId, ...rest) => { reads.list.push(roomId); return originalList(roomId, ...rest); };
  store.workClaims.get = (roomId, claimId, ...rest) => { reads.get.push(`${roomId}/${claimId}`); return originalGet(roomId, claimId, ...rest); };
  return { store, reads };
}

test("an unauthenticated call is refused before the store is touched", async t => {
  const { store, reads } = await fixture(t);
  const out = await applyPullRequestWebhook(store, PAYLOAD);
  assert.deepEqual(out.applied, []);
  assert.equal(out.refused, "missing_signature");
  const item = store.workClaims.get("commons", "target");
  assert.equal(item.state, "claimed");
  assert.equal(item.pullRequest.outcome, null);
  assert.deepEqual(reads.list, [], "no registry enumeration");
  assert.deepEqual(reads.get.filter(entry => entry !== "commons/target"), [], "no bystander reads");
});

test("a forged signature is refused, and a divergent payload object cannot override the signed body", async t => {
  const { store } = await fixture(t);
  const forged = await applyPullRequestWebhook(store, PAYLOAD, sign(PAYLOAD, "some-other-secret"));
  assert.deepEqual(forged.applied, []);
  assert.equal(forged.refused, "mismatch");
  assert.equal(store.workClaims.get("commons", "target").state, "claimed");
  // The caller passes a payload object claiming the PR closed unmerged,
  // but the signed body says merged: the signed body governs, so the
  // claim settles as merged — the unsigned object settles nothing.
  const divergent = await applyPullRequestWebhook(store,
    { ...PAYLOAD, pull_request: { ...PAYLOAD.pull_request, merged: false } }, sign(PAYLOAD));
  assert.deepEqual(divergent.applied, [{ roomId: "commons", claimId: "target", outcome: "merged" }]);
  const item = store.workClaims.get("commons", "target");
  assert.equal(item.state, "done");
  assert.equal(item.pullRequest.outcome, "merged");
});

test("a signature-valid delivery settles, decoding only the linked claims", async t => {
  const { store, reads } = await fixture(t);
  const out = await applyPullRequestWebhook(store, PAYLOAD, sign(PAYLOAD));
  assert.deepEqual(out.applied, [{ roomId: "commons", claimId: "target", outcome: "merged" }]);
  const item = store.workClaims.get("commons", "target");
  assert.equal(item.state, "done");
  assert.equal(item.pullRequest.outcome, "merged");
  assert.deepEqual(reads.list, [], "settlement never lists a room's claims");
  assert.ok(reads.get.every(entry => entry === "commons/target"),
    `only the linked claim is decoded, got: ${reads.get.join(", ")}`);
  // A replay of the same genuine delivery is inert (link already settled).
  const replay = await applyPullRequestWebhook(store, PAYLOAD, sign(PAYLOAD));
  assert.deepEqual(replay.applied, []);
});

test("the webhook core cannot settle without the forwarded delivery material", async t => {
  const { store } = await fixture(t);
  const unsigned = await handlePrWebhookPayload(store, PAYLOAD, {});
  assert.equal(unsigned.ok, true);
  assert.deepEqual(unsigned.settled, []);
  assert.equal(store.workClaims.get("commons", "target").state, "claimed");
  const signed = await handlePrWebhookPayload(store, PAYLOAD, { webhook: sign(PAYLOAD) });
  assert.equal(signed.ok, true);
  assert.deepEqual(signed.settled, [{ roomId: "commons", claimId: "target", outcome: "merged" }]);
  assert.equal(store.workClaims.get("commons", "target").state, "done");
});
