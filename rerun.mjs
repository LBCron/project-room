// Consent-fixture contrast rerun (Codex seq 25272).
// Amended fixture vs golden-path-1101: the room OWNER records the room's
// public-receipts opt-in (room.public_receipts_set {enabled:true} via
// POST /api/rooms/{id}/commands) BEFORE the outcome, in addition to the
// original directory toggle. Opt-out rooms record enabled:true then
// enabled:false (recorded opt-out is the last word) plus the original
// directory on->off. Discovery probes use the TRUE public ids:
// deterministic wcr_/wir_ hashes, sha256(roomId\0taskId).slice(0,32),
// cross-checked against the in-room receipt's publicId read-back.
// Secrets stay in-process and are never printed.
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
  return { status: res.status, json, raw: text };
}
const trim = (o, keys) => { const out = {}; if (o && typeof o === "object") for (const k of keys) if (k in o) out[k] = o[k]; return out; };
const pubId = (prefix, roomId, localId) => `${prefix}_${createHash("sha256").update(`${roomId}\0${localId}`).digest("hex").slice(0, 32)}`;

// pin + baseline global list
const pinA = await call("GET", "/api/version");
ev("pin_start", { status: pinA.status, version: trim(pinA.json, ["sourceRevision", "buildId"]) });
const baseList = await call("GET", "/api/public/receipts?limit=50");
const baseReceipts = baseList.json?.receipts ?? [];
ev("baseline_global_list", { status: baseList.status, count: baseReceipts.length, newest: baseReceipts[0] ? { id: baseReceipts[0].id, at: baseReceipts[0].at } : null });

// founder
const fMint = await call("POST", "/api/agent-identities", { body: { displayName: "QA GPCR1 Founder" } });
if (fMint.status === 428) { ev("pow_required", { body: fMint.json }); process.exit(3); }
const founder = { id: fMint.json?.identityId ?? fMint.json?.identity?.id, secret: fMint.json?.secret ?? fMint.json?.identitySecret };
ev("mint_founder", { status: fMint.status, identityId: founder.id });

async function command(rid, type, data) {
  return call("POST", `/api/rooms/${rid}/commands`, { token: founder.secret, body: { id: randomUUID(), type, data } });
}

async function runRoom(tag, kind) {
  const roomId = `qa-gpcr1-${tag}`;
  const taskId = `gpcr1-${tag}-task`;
  const rcId = `rc_${taskId}`;
  const room = await call("POST", "/api/agent-rooms", { token: founder.secret, body: { title: `QA GPCR1 ${tag} ${kind}`, purpose: "Consent-fixture contrast rerun (Codex seq 25272)", roomId } });
  const rid = room.json?.roomId ?? room.json?.room?.id ?? roomId;
  ev(`${tag}_room`, { status: room.status, roomId: rid, kind });

  // Consent act kept from the original fixture: directory toggle on.
  const dirOn = await call("POST", `/api/rooms/${rid}/directory`, { token: founder.secret, body: { publicReceipts: true } });
  ev(`${tag}_dir_on`, { status: dirOn.status, body: trim(dirOn.json, ["publicReceipts", "discoverable"]) });

  // THE AMENDMENT: owner records the room public-receipts opt-in.
  const setOn = await command(rid, "room.public_receipts_set", { enabled: true });
  ev(`${tag}_consent_set_true`, { status: setOn.status, body: setOn.status >= 300 ? setOn.json : trim(setOn.json, ["seq", "id", "type"]) });
  if (kind === "optout") {
    const setOff = await command(rid, "room.public_receipts_set", { enabled: false });
    ev(`${tag}_consent_set_false`, { status: setOff.status, body: setOff.status >= 300 ? setOff.json : trim(setOff.json, ["seq", "id", "type"]) });
    const dirOff = await call("POST", `/api/rooms/${rid}/directory`, { token: founder.secret, body: { publicReceipts: false } });
    ev(`${tag}_dir_off`, { status: dirOff.status, body: trim(dirOff.json, ["publicReceipts", "discoverable"]) });
  }

  // Read-backs: directory status + the room event log's recorded setting events.
  const dirStatus = await call("GET", `/api/rooms/${rid}/directory`, { token: founder.secret });
  ev(`${tag}_dir_status`, { status: dirStatus.status, body: trim(dirStatus.json, ["publicReceipts", "discoverable"]) });
  const evLog = await call("GET", `/api/rooms/${rid}/events?after=0&limit=100`, { token: founder.secret });
  const evs = evLog.json?.events ?? evLog.json?.items ?? [];
  const settingEvents = evs.filter(e => JSON.stringify(e).includes("public_receipts_set")).map(e => trim(e, ["seq", "type", "actorId", "at"]));
  const settingData = evs.filter(e => JSON.stringify(e).includes("public_receipts_set")).map(e => { try { return JSON.parse(JSON.stringify(e)).data ?? null; } catch { return null; } });
  ev(`${tag}_setting_events_readback`, { status: evLog.status, count: settingEvents.length, events: settingEvents, data: settingData });

  // Agent joins.
  const inv = await call("POST", `/api/rooms/${rid}/agent-invites`, { token: founder.secret, body: { profile: "collaborate" } });
  const code = inv.json?.code ?? inv.json?.invite?.code ?? inv.json?.token;
  const red = await call("POST", "/api/agent-invites/redeem", { body: { code, displayName: `QA GPCR1 ${tag} Agent` } });
  const agent = { id: red.json?.identityId ?? red.json?.identity?.id, secret: red.json?.identitySecret ?? red.json?.secret, memberId: red.json?.memberId ?? red.json?.member?.id };
  ev(`${tag}_redeem_agent`, { status: red.status, identityId: agent.id, memberId: agent.memberId });

  // Board outcome.
  const post = await call("POST", `/api/rooms/${rid}/work-claims`, { token: founder.secret, body: { id: taskId, title: `Consent contrast task ${tag}`, reviewPolicy: "distinct_member", acceptanceCriteria: ["artifact returned"] } });
  ev(`${tag}_post`, { status: post.status });
  const claim = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/claim`, { token: agent.secret, body: {} });
  ev(`${tag}_claim`, { status: claim.status, state: (claim.json?.claim ?? claim.json)?.state });
  const prog = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/update`, { token: agent.secret, body: { state: "in_progress" } });
  ev(`${tag}_in_progress`, { status: prog.status, state: (prog.json?.claim ?? prog.json)?.state });
  const artifactText = `Consent contrast result ${tag} for ${taskId}.`;
  const sha = createHash("sha256").update(artifactText).digest("hex");
  const del = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/update`, { token: agent.secret, body: { state: "delivered", delivery: { artifact: { kind: "text", ref: `inline:${taskId}`, sha256: sha }, checks: [{ name: "self-check", result: "pass" }], criteria: [{ criterion: "artifact returned", status: "met" }] } } });
  ev(`${tag}_deliver`, { status: del.status, state: (del.json?.claim ?? del.json)?.state });
  const rev = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/review`, { token: founder.secret, body: { verdict: "approve", summary: "Consent contrast review" } });
  ev(`${tag}_review`, { status: rev.status });
  const close = await call("POST", `/api/rooms/${rid}/work-claims/${taskId}/update`, { token: founder.secret, body: { state: "done" } });
  ev(`${tag}_done`, { status: close.status, state: (close.json?.claim ?? close.json)?.state, at: new Date().toISOString() });

  const inRoom = await call("GET", `/api/rooms/${rid}/receipts/${rcId}`, { token: founder.secret });
  const receipt = inRoom.json?.receipt ?? inRoom.json;
  ev(`${tag}_inroom_receipt`, { status: inRoom.status, receiptId: receipt?.receiptId ?? receipt?.id, publicId: receipt?.publicId ?? null, publicUrl: receipt?.publicUrl ?? null, verification: receipt?.verification?.state ?? null });

  return { tag, kind, rid, taskId, rcId, agentId: agent.id, readbackPublicId: receipt?.publicId ?? null, wcr: pubId("wcr", rid, taskId), wir: pubId("wir", rid, taskId), doneAt: Date.now() };
}

const rooms = [];
for (const [tag, kind] of [["c1", "control"], ["c2", "control"], ["o1", "optout"], ["o2", "optout"]]) {
  rooms.push(await runRoom(tag, kind));
}
const T0 = Date.now();
ev("outcomes_complete", { rooms: rooms.map(r => ({ tag: r.tag, kind: r.kind, rid: r.rid, rcId: r.rcId, readbackPublicId: r.readbackPublicId, wcr: r.wcr, wir: r.wir })) });

async function faces(r) {
  const ids = [r.wcr, r.wir];
  const filtered = await call("GET", `/api/public/receipts?room=${encodeURIComponent(r.rid)}&limit=50`);
  const fList = filtered.json?.receipts ?? [];
  const global = await call("GET", "/api/public/receipts?limit=50");
  const gList = global.json?.receipts ?? [];
  const byId = await fetch(`${BASE}/receipts/${r.wcr}.json`, { headers: { "user-agent": "project-room-agent" } });
  let byIdBody = null;
  try { byIdBody = await byId.json(); } catch { /* no body */ }
  const sm = await fetch(`${BASE}/sitemap.xml`, { headers: { "user-agent": "project-room-agent" } });
  const smText = await sm.text();
  return {
    tag: r.tag, kind: r.kind,
    filteredCount: fList.length,
    filteredHit: fList.some(x => ids.includes(x.id)),
    globalHit: gList.some(x => ids.includes(x.id)),
    globalNewest: gList[0] ? { id: gList[0].id, at: gList[0].at } : null,
    byIdStatus: byId.status,
    byIdId: byIdBody?.id ?? byIdBody?.receipt?.id ?? null,
    sitemapHit: ids.some(id => smText.includes(`/receipts/${id}`)),
  };
}

// Poll: conclude control presence as soon as every face hits; conclude
// opt-out absence only after >=17 min since the last outcome closed.
const ABSENT_AFTER_MS = 17 * 60 * 1000;
const HARD_STOP_MS = 22 * 60 * 1000;
let lastMatrix = null;
for (;;) {
  const matrix = [];
  for (const r of rooms) matrix.push(await faces(r));
  lastMatrix = matrix;
  const elapsed = Date.now() - T0;
  const controls = matrix.filter(m => m.kind === "control");
  const controlAllHit = controls.every(m => m.filteredHit && m.globalHit && m.byIdStatus === 200 && m.sitemapHit);
  ev("faces", { elapsedSec: Math.round(elapsed / 1000), controlAllHit, matrix });
  if (controlAllHit && elapsed >= ABSENT_AFTER_MS) break;
  if (elapsed >= HARD_STOP_MS) break;
  await sleep(60000);
}

const pinB = await call("GET", "/api/version");
ev("final", { status: pinB.status, version: trim(pinB.json, ["sourceRevision", "buildId"]), wallClockSec: lap(), founderId: founder.id, lastMatrix });
