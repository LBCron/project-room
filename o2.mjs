// Supplementary opt-out room o2 (fresh founder): the main run's o2 room
// creation was refused 429 (room-creation rate limit) and the room never
// existed. Same opt-out fixture as o1: directory on, owner records
// room.public_receipts_set {enabled:true} then {enabled:false},
// directory off, Board outcome to done, then anonymous faces polled
// with the deterministic public ids for >=17 min before absence is
// concluded. Secrets stay in-process and are never printed.
import { createHash, randomUUID } from "node:crypto";

const BASE = "https://room.trydemigod.com";
const UA = { "user-agent": "project-room-agent", "content-type": "application/json" };
const t0 = Date.now();
const lap = () => Math.round((Date.now() - t0) / 100) / 10;
function ev(step, data) { console.log(JSON.stringify({ step, t: lap(), ...data })); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...UA, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, json };
}
const trim = (o, keys) => { const out = {}; if (o && typeof o === "object") for (const k of keys) if (k in o) out[k] = o[k]; return out; };
const pubId = (prefix, roomId, localId) => `${prefix}_${createHash("sha256").update(`${roomId}\0${localId}`).digest("hex").slice(0, 32)}`;

const pinA = await call("GET", "/api/version");
ev("pin_start", { status: pinA.status, version: trim(pinA.json, ["sourceRevision", "buildId"]) });
const fMint = await call("POST", "/api/agent-identities", { body: { displayName: "QA GPCR1 O2 Founder" } });
if (fMint.status === 428) { ev("pow_required", { body: fMint.json }); process.exit(3); }
const founder = { id: fMint.json?.identityId ?? fMint.json?.identity?.id, secret: fMint.json?.secret ?? fMint.json?.identitySecret };
ev("mint_founder", { status: fMint.status, identityId: founder.id });

const rid = "qa-gpcr1-o2";
const taskId = "gpcr1-o2-task";
const rcId = `rc_${taskId}`;
const room = await call("POST", "/api/agent-rooms", { token: founder.secret, body: { title: "QA GPCR1 o2 optout", purpose: "Consent-fixture contrast rerun (Codex seq 25272), supplementary o2", roomId: rid } });
ev("o2_room", { status: room.status, roomId: room.json?.roomId ?? rid });
if (room.status !== 201) { ev("o2_room_failed", { body: room.json }); process.exit(4); }

const dirOn = await call("POST", `/api/rooms/${rid}/directory`, { token: founder.secret, body: { publicReceipts: true } });
ev("o2_dir_on", { status: dirOn.status, body: trim(dirOn.json, ["publicReceipts", "discoverable"]) });
const command = (type, data) => call("POST", `/api/rooms/${rid}/commands`, { token: founder.secret, body: { id: randomUUID(), type, data } });
const setOn = await command("room.public_receipts_set", { enabled: true });
ev("o2_consent_set_true", { status: setOn.status });
const setOff = await command("room.public_receipts_set", { enabled: false });
ev("o2_consent_set_false", { status: setOff.status });
const dirOff = await call("POST", `/api/rooms/${rid}/directory`, { token: founder.secret, body: { publicReceipts: false } });
ev("o2_dir_off", { status: dirOff.status, body: trim(dirOff.json, ["publicReceipts", "discoverable"]) });
const dirStatus = await call("GET", `/api/rooms/${rid}/directory`, { token: founder.secret });
ev("o2_dir_status", { status: dirStatus.status, body: trim(dirStatus.json, ["publicReceipts", "discoverable"]) });
const evLog = await call("GET", `/api/rooms/${rid}/events?after=0&limit=100`, { token: founder.secret });
const evs = evLog.json?.events ?? evLog.json?.items ?? [];
ev("o2_setting_events_readback", { status: evLog.status, count: evs.filter(e => JSON.stringify(e).includes("public_receipts_set")).length });

const inv = await call("POST", `/api/rooms/${rid}/agent-invites`, { token: founder.secret, body: { profile: "collaborate" } });
const code = inv.json?.code ?? inv.json?.invite?.code ?? inv.json?.token;
const red = await call("POST", "/api/agent-invites/redeem", { body: { code, displayName: "QA GPCR1 o2 Agent" } });
const agent = { id: red.json?.identityId ?? red.json?.identity?.id, secret: red.json?.identitySecret ?? red.json?.secret, memberId: red.json?.memberId ?? red.json?.member?.id };
ev("o2_redeem_agent", { status: red.status, identityId: agent.id, memberId: agent.memberId });

const post = await call("POST", `/api/rooms/${rid}/work-claims`, { token: founder.secret, body: { id: taskId, title: "Consent contrast task o2", reviewPolicy: "distinct_member", acceptanceCriteria: ["artifact returned"] } });
ev("o2_post", { status: post.status });
const claim = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/claim`, { token: agent.secret, body: {} });
ev("o2_claim", { status: claim.status, state: (claim.json?.claim ?? claim.json)?.state });
const prog = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/update`, { token: agent.secret, body: { state: "in_progress" } });
ev("o2_in_progress", { status: prog.status, state: (prog.json?.claim ?? prog.json)?.state });
const sha = createHash("sha256").update(`Consent contrast result o2 for ${taskId}.`).digest("hex");
const del = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/update`, { token: agent.secret, body: { state: "delivered", delivery: { artifact: { kind: "text", ref: `inline:${taskId}`, sha256: sha }, checks: [{ name: "self-check", result: "pass" }], criteria: [{ criterion: "artifact returned", status: "met" }] } } });
ev("o2_deliver", { status: del.status, state: (del.json?.claim ?? del.json)?.state });
const rev = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/review`, { token: founder.secret, body: { verdict: "approve", summary: "Consent contrast review" } });
ev("o2_review", { status: rev.status });
const close = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/update`, { token: founder.secret, body: { state: "done" } });
ev("o2_done", { status: close.status, state: (close.json?.claim ?? close.json)?.state, at: new Date().toISOString() });
const inRoom = await call("GET", `/api/rooms/${rid}/receipts/${rcId}`, { token: founder.secret });
const receipt = inRoom.json?.receipt ?? inRoom.json;
const wcr = pubId("wcr", rid, taskId), wir = pubId("wir", rid, taskId);
ev("o2_inroom_receipt", { status: inRoom.status, receiptId: receipt?.receiptId ?? receipt?.id, publicId: receipt?.publicId ?? null, publicUrl: receipt?.publicUrl ?? null, verification: receipt?.verification?.state ?? null, wcr, wir });

const T0 = Date.now();
const ABSENT_AFTER_MS = 17 * 60 * 1000;
for (;;) {
  const ids = [wcr, wir];
  const filtered = await call("GET", `/api/public/receipts?room=${encodeURIComponent(rid)}&limit=50`);
  const fList = filtered.json?.receipts ?? [];
  const global = await call("GET", "/api/public/receipts?limit=50");
  const gList = global.json?.receipts ?? [];
  const byId = await fetch(`${BASE}/receipts/${wcr}.json`, { headers: { "user-agent": "project-room-agent" } });
  const sm = await fetch(`${BASE}/sitemap.xml`, { headers: { "user-agent": "project-room-agent" } });
  const smText = await sm.text();
  const elapsed = Date.now() - T0;
  ev("o2_faces", { elapsedSec: Math.round(elapsed / 1000), filteredCount: fList.length, filteredHit: fList.some(x => ids.includes(x.id)), globalHit: gList.some(x => ids.includes(x.id)), globalNewest: gList[0] ? { id: gList[0].id, at: gList[0].at } : null, byIdStatus: byId.status, sitemapHit: ids.some(id => smText.includes(`/receipts/${id}`)) });
  if (elapsed >= ABSENT_AFTER_MS) break;
  await sleep(60000);
}
const pinB = await call("GET", "/api/version");
ev("o2_final", { status: pinB.status, version: trim(pinB.json, ["sourceRevision", "buildId"]), wallClockSec: lap(), founderId: founder.id, agentId: agent.id });
