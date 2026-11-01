// Adversarial set for PR #5579 recheck — run once per tree:
//   node adversarial.mjs <abs path to tree>/server
// Prints one JSON object with per-scenario outcomes.
import { DatabaseSync } from "node:sqlite";

const serverDir = process.argv[2];
const { BountyEscrow } = await import(serverDir + "/bounty-escrow.mjs");
let undisputableWarnings = null;
try {
  ({ undisputableWarnings } = await import(serverDir + "/bounty-disputability.mjs"));
} catch { /* pre-fix tree */ }

const ROOM = "room-adv";
const JILL = "id:agent/jill";
const GROK = "id:agent/grokbot";
const INSTINCT = "id:agent/instinct";
const OWNER = "owner";
const nowMs = 1_786_000_000_000;
const isoFuture = ms => new Date(nowMs + ms).toISOString();

const fullMembers = () => ({
  [JILL]: { active: true, kind: "agent", displayName: "jill" },
  [GROK]: { active: true, kind: "agent", displayName: "grokbot" },
  [INSTINCT]: { active: true, kind: "agent", displayName: "instinct" },
  [OWNER]: { active: true, kind: "human", displayName: "owner" },
});
const pairMembers = () => ({
  [GROK]: { active: true, kind: "agent", displayName: "grokbot" },
  [OWNER]: { active: true, kind: "human", displayName: "owner" },
});

// handler: mutable roomAuthority behaviour, swappable after genesis.
function makeEscrow(handler, opts = {}) {
  const db = new DatabaseSync(":memory:");
  const transaction = fn => {
    db.exec("SAVEPOINT adv_test");
    try { const out = fn(); db.exec("RELEASE adv_test"); return out; }
    catch (error) { db.exec("ROLLBACK TO adv_test"); db.exec("RELEASE adv_test"); throw error; }
  };
  const store = {
    db, transaction, readTransaction: transaction, now: () => nowMs,
    roomAuthority: roomId => handler(roomId),
  };
  if (opts.noAuthority) delete store.roomAuthority;
  const escrow = new BountyEscrow(store, { now: () => nowMs, ...(opts.escrowOpts ?? {}) });
  escrow.ensureGenesis(ROOM);
  return { escrow, db };
}
const goodHandler = members => () => ({ sequence: 1, ownerId: OWNER, members });
const rows = (db, t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE room_id = ?`).get(ROOM).n;
const outcome = fn => {
  try { const r = fn(); return { ok: true, warnings: r?.warnings ?? null, state: r?.bounty?.state ?? null }; }
  catch (e) { return { ok: false, error: `${e.code ?? e.name}: ${e.message}` }; }
};
const post = (escrow, args) => () => escrow.postBounty(ROOM, { title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000), ...args });

const out = { tree: serverDir, hasWarningsExport: typeof undisputableWarnings === "function" };

// ---- S1: read-error, membership source hard down -------------------------
{
  let mode = "good";
  const handler = roomId => {
    if (mode === "throw") throw new Error("simulated authority read failure");
    return { sequence: 1, ownerId: OWNER, members: fullMembers() };
  };
  const { escrow, db } = makeEscrow(handler);
  mode = "throw";
  const r = outcome(post(escrow, { poster: JILL }));
  out.s1_alwaysThrowPost = { ...r, bountyRows: rows(db, "bounty_records"), journalRows: rows(db, "bounty_journal") };
}

// ---- S2: read-error, source fails after N calls (post) -------------------
{
  const successAt = [];
  for (let n = 0; n <= 60; n++) {
    let calls = 0;
    const handler = () => {
      calls++;
      if (calls > n) throw new Error("simulated late authority read failure");
      return { sequence: 1, ownerId: OWNER, members: fullMembers() };
    };
    const { escrow } = makeEscrow(() => ({ sequence: 1, ownerId: OWNER, members: fullMembers() }));
    // rebuild with counting handler from the start but genesis already done:
    escrow.store.roomAuthority = handler;
    const r = outcome(post(escrow, { poster: JILL }));
    if (r.ok) successAt.push(n);
  }
  out.s2_flakyPostSuccessThresholds = successAt;
}

// ---- S2b: read-error surfacing mid-claim ---------------------------------
{
  const successAt = [];
  for (let n = 0; n <= 60; n++) {
    const { escrow } = makeEscrow(goodHandler(fullMembers()));
    const posted = escrow.postBounty(ROOM, { poster: JILL, title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000), verifierId: INSTINCT });
    escrow.fundBounty(ROOM, posted.bounty.bountyId, { funder: JILL });
    let calls = 0;
    escrow.store.roomAuthority = () => {
      calls++;
      if (calls > n) throw new Error("simulated late authority read failure");
      return { sequence: 1, ownerId: OWNER, members: fullMembers() };
    };
    const r = outcome(() => escrow.claimBounty(ROOM, posted.bounty.bountyId, { claimant: GROK }));
    if (r.ok) successAt.push(n);
  }
  out.s2b_flakyClaimSuccessThresholds = successAt;
}

// ---- S3: no membership source (legacy string lanes) ----------------------
{
  const { escrow } = makeEscrow(null, { noAuthority: true, escrowOpts: { allowLegacyStringLanes: true } });
  const r = outcome(post(escrow, { poster: JILL }));
  let conservation = null;
  try { conservation = escrow.verifyConservation(ROOM).ok; } catch (e) { conservation = `threw: ${e.message}`; }
  out.s3_noMembershipSource = { ...r, conservation };
}

// ---- S4: unknown values into the pure derivation --------------------------
if (undisputableWarnings) {
  const t = (label, input) => {
    try { const w = undisputableWarnings(input); out[`s4_${label}`] = { n: w.length, text: w.join(" | ").slice(0, 60) }; }
    catch (e) { out[`s4_${label}`] = { threw: `${e.name}: ${e.message}` }; }
  };
  t("noDecider", { poster: "P" });
  t("deciderIsPoster", { poster: "P", verifier: "P" });
  t("deciderIsExecutor", { poster: "P", verifier: "D", claimant: "D" });
  t("deciderOverridesVerifier", { poster: "P", verifier: "P", disputeDecider: "D", memberLanes: ["P", "D", "X"] });
  t("pairTrap", { poster: "P", verifier: "D", memberLanes: ["P", "D"] });
  t("lanesNotArray", { poster: "P", verifier: "D", memberLanes: "P,D" });
  t("emptyStringClaimant", { poster: "P", verifier: "D", memberLanes: ["P", "D"], claimant: "" });
  t("verifierZero", { poster: "P", verifier: 0 });
  t("deciderNumeric", { poster: "P", disputeDecider: 42, memberLanes: ["P", "D"] });
  t("emptyInput", {});
  t("lanesNullEntries", { poster: "P", verifier: "D", memberLanes: [null, undefined] });
  t("executorBeatsPairLeg", { poster: "P", verifier: "D", claimant: "D", memberLanes: ["P", "D"] });
  t("ghostDecider3Room", { poster: "P", verifier: "id:agent/ghost", memberLanes: ["P", "A", "B"] });
}

// ---- S5: one bad row in the members map (pair config, through real acts) --
function badRowCase(label, mutate) {
  const members = pairMembers();
  mutate(members);
  let built;
  try { built = makeEscrow(goodHandler(members)); }
  catch (e) { out[`s5_${label}`] = { ok: false, stage: "genesis", error: `${e.code ?? e.name}: ${e.message}` }; return; }
  const { escrow, db } = built;
  const r = outcome(post(escrow, { poster: OWNER, verifierId: GROK }));
  let conservation = null;
  try { conservation = escrow.verifyConservation(ROOM).ok; } catch (e) { conservation = `threw: ${e.message}`; }
  out[`s5_${label}`] = { ...r, conservation, bountyRows: rows(db, "bounty_records") };
}
badRowCase("stringMemberRow", m => { m["id:agent/junk"] = "corrupt-string-row"; });
badRowCase("stringFalseActive", m => { m["id:agent/ghost"] = { active: "false", kind: "agent" }; });
badRowCase("inactiveThird", m => { m["id:agent/ghost"] = { active: false, kind: "agent" }; });
badRowCase("nullMemberRow", m => { m["id:agent/junk"] = null; });
badRowCase("throwingActiveGetter", m => {
  const poison = {};
  Object.defineProperty(poison, "active", { enumerable: true, get() { throw new Error("poisoned member row"); } });
  m["id:agent/poison"] = poison;
});
{
  // "__proto__" as an OWN enumerable key — arises when the members map is
  // itself produced by JSON.parse; bracket assignment would only set the
  // prototype, so the whole map is built by parsing here.
  const members = JSON.parse('{"id:agent/grokbot": {"active": true, "kind": "agent"}, "owner": {"active": true, "kind": "human"}, "__proto__": {"active": true, "kind": "agent"}}');
  let built = null;
  try { built = makeEscrow(goodHandler(members)); }
  catch (e) { out.s5_protoKey = { ok: false, stage: "genesis", error: `${e.code ?? e.name}: ${e.message}`, ownKeys: Object.keys(members) }; }
  if (built) {
    const { escrow, db } = built;
    const r = outcome(post(escrow, { poster: OWNER, verifierId: GROK }));
    let conservation = null;
    try { conservation = escrow.verifyConservation(ROOM).ok; } catch (e) { conservation = `threw: ${e.message}`; }
    out.s5_protoKey = { ...r, conservation, bountyRows: rows(db, "bounty_records"), ownKeys: Object.keys(members) };
  }
}

// ---- S6: lifecycle equivalence (warnings stripped) ------------------------
{
  const { escrow } = makeEscrow(goodHandler(fullMembers()));
  const seq = [];
  const step = (label, fn) => { const r = outcome(fn); seq.push(`${label}:${r.ok ? r.state ?? "ok" : "ERR"}`); return r; };
  const p = escrow.postBounty(ROOM, { poster: JILL, title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000) });
  seq.push(`post:${p.bounty.state}:warn=${Array.isArray(p.warnings) ? p.warnings.length : "absent"}`);
  step("fund", () => escrow.fundBounty(ROOM, p.bounty.bountyId, { funder: JILL }));
  step("claim", () => escrow.claimBounty(ROOM, p.bounty.bountyId, { claimant: GROK }));
  step("submit", () => escrow.submitWork(ROOM, p.bounty.bountyId, { claimant: GROK, evidence: { evidenceUrl: "https://example.com/pr/1", summary: "did" } }));
  step("accept", () => escrow.acceptWork(ROOM, p.bounty.bountyId, { acceptor: JILL, verifierAttestation: { at: new Date(nowMs).toISOString(), note: "reviewed", citations: [{ criterionId: "c1", verdict: "pass" }] } }));
  step("dispute", () => escrow.disputeBounty(ROOM, p.bounty.bountyId, { challenger: JILL, bond: 2.5, grounds: "criteria not met" }));
  out.s6_lifecycle = { seq, conservation: escrow.verifyConservation(ROOM).ok };
}

console.log(JSON.stringify(out, null, 1));
