// Linear parity acceptance suite. Runs the 36 probes against a local server
// and ratchets: the score may only go up. Set LINEAR_PARITY_REPORT=1 to print
// the table. Update BASELINE when a capability moves to parity.
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";
import { createAcceptanceFixture } from "../../scripts/acceptance-fixture.mjs";
import { createRoomServer } from "../../server/http.mjs";
import { linkWithProof } from "../helpers/link-with-proof.mjs";
import { runProbes } from "./parity-probes.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = { capabilities: 36, minPoints: 17.5 };

test("Linear parity: 36 probes run and score does not regress", async () => {
  const f = createAcceptanceFixture();
  const server = createRoomServer({ store: f.store });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const id = f.store.identities.create("ParityAgent");
    linkWithProof(f.store, f.keys.owner, "commons", id, { memberId: "parity-agent", displayName: "ParityAgent", permissions: ["accept_work", "complete_work"] });
    const out = await runProbes({ origin, secret: f.keys.owner, mcpSecret: id.secret, roomId: "commons", repo });
    if (process.env.LINEAR_PARITY_REPORT) console.log(JSON.stringify(out, null, 1));
    assert.equal(out.rows.length, BASELINE.capabilities);
    assert.ok(out.points >= BASELINE.minPoints, `parity points ${out.points} < ${BASELINE.minPoints}`);
    for (const r of ["Issues / tasks", "Labels", "Hosted MCP", "Inbox", "API"]) assert.equal(out.rows.find((x) => x.cap === r).status, "parity", r);
  } finally {
    server.closeAllConnections(); await new Promise((r) => server.close(r)); f.store.close();
    try { rmSync(f.directory, { recursive: true, force: true }); } catch {}
  }
});
