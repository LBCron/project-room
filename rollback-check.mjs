// Rollback proof at the exact flaky thresholds where the composed tree
// gains one roomAuthority read (post: fails at n=4; claim: fails at n=5;
// fund swept here too). After the throw: no bounty row beyond expectation,
// no partial journal movement, state unchanged, conservation exact.
import { DatabaseSync } from "node:sqlite";
const serverDir = process.argv[2];
const { BountyEscrow } = await import(serverDir + "/bounty-escrow.mjs");
const ROOM = "room-rb";
const JILL = "id:agent/jill", GROK = "id:agent/grokbot", INSTINCT = "id:agent/instinct", OWNER = "owner";
const nowMs = 1_786_000_000_000;
const isoFuture = ms => new Date(nowMs + ms).toISOString();
const fullMembers = () => ({
  [JILL]: { active: true, kind: "agent" }, [GROK]: { active: true, kind: "agent" },
  [INSTINCT]: { active: true, kind: "agent" }, [OWNER]: { active: true, kind: "human" },
});
function makeEscrow() {
  const db = new DatabaseSync(":memory:");
  const transaction = fn => {
    db.exec("SAVEPOINT rb");
    try { const out = fn(); db.exec("RELEASE rb"); return out; }
    catch (e) { db.exec("ROLLBACK TO rb"); db.exec("RELEASE rb"); throw e; }
  };
  const store = { db, transaction, readTransaction: transaction, now: () => nowMs,
    roomAuthority: () => ({ sequence: 1, ownerId: OWNER, members: fullMembers() }) };
  const escrow = new BountyEscrow(store, { now: () => nowMs });
  escrow.ensureGenesis(ROOM);
  return { escrow, db, store };
}
const rows = (db, t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE room_id = ?`).get(ROOM).n;
const flaky = (store, n) => {
  let calls = 0;
  store.roomAuthority = () => {
    calls++;
    if (calls > n) throw new Error("simulated late authority read failure");
    return { sequence: 1, ownerId: OWNER, members: fullMembers() };
  };
};
const out = {};

// post at the delta threshold (n = 4)
{
  const { escrow, db, store } = makeEscrow();
  const genesisJournal = rows(db, "bounty_journal");
  flaky(store, 4);
  let err = null;
  try { escrow.postBounty(ROOM, { poster: JILL, title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000) }); }
  catch (e) { err = e.message; }
  out.postDelta = { threw: err, bountyRows: rows(db, "bounty_records"), journalRows: rows(db, "bounty_journal"), genesisJournal,
    conservation: escrow.verifyConservation(ROOM).ok };
}
// fund sweep: find thresholds on this tree
{
  const okAt = [];
  for (let n = 0; n <= 12; n++) {
    const { escrow, store } = makeEscrow();
    const p = escrow.postBounty(ROOM, { poster: JILL, title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000), verifierId: INSTINCT });
    flaky(store, n);
    try { escrow.fundBounty(ROOM, p.bounty.bountyId, { funder: JILL }); okAt.push(n); } catch { /* threshold */ }
  }
  out.fundSuccessThresholds = okAt;
}
// fund at its failing threshold: money must be untouched (bounty stays proposed, no lock movement)
{
  const { escrow, db, store } = makeEscrow();
  const p = escrow.postBounty(ROOM, { poster: JILL, title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000), verifierId: INSTINCT });
  const journalAfterPost = rows(db, "bounty_journal");
  const failAt = out.fundSuccessThresholds.length ? Math.min(...out.fundSuccessThresholds) - 1 : null;
  let err = null, stateAfter = null;
  if (failAt !== null && failAt >= 0) {
    flaky(store, failAt);
    try { escrow.fundBounty(ROOM, p.bounty.bountyId, { funder: JILL }); } catch (e) { err = e.message; }
    store.roomAuthority = () => ({ sequence: 1, ownerId: OWNER, members: fullMembers() });
    stateAfter = escrow._getBounty(ROOM, p.bounty.bountyId).state;
  }
  out.fundDelta = { failAt, threw: err, stateAfter, journalRows: rows(db, "bounty_journal"), journalAfterPost,
    conservation: escrow.verifyConservation(ROOM).ok };
}
// claim at the delta threshold (n = 5)
{
  const { escrow, db, store } = makeEscrow();
  const p = escrow.postBounty(ROOM, { poster: JILL, title: "T", criteria: "C", amount: 10, deadline: isoFuture(3_600_000), verifierId: INSTINCT });
  escrow.fundBounty(ROOM, p.bounty.bountyId, { funder: JILL });
  const journalAfterFund = rows(db, "bounty_journal");
  flaky(store, 5);
  let err = null;
  try { escrow.claimBounty(ROOM, p.bounty.bountyId, { claimant: GROK }); } catch (e) { err = e.message; }
  store.roomAuthority = () => ({ sequence: 1, ownerId: OWNER, members: fullMembers() });
  const stateAfter = escrow._getBounty(ROOM, p.bounty.bountyId).state;
  out.claimDelta = { threw: err, stateAfter, journalRows: rows(db, "bounty_journal"), journalAfterFund,
    conservation: escrow.verifyConservation(ROOM).ok };
}
console.log(JSON.stringify(out, null, 1));
