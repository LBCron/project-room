import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("#3892: deep-link claim reveal reports failure like the click path", () => {
  const start = source.indexOf("async function revealClaimRecord(id)");
  assert.ok(start >= 0, "revealClaimRecord exists");
  const body = source.slice(start, source.indexOf("\nfunction ", start));
  assert.match(body, /if \(!await navigationBoardRevealClaim\?\.\(id\)\) notice\(SOURCE_UNAVAILABLE_NOTICE, true\);/);
  assert.doesNotMatch(body, /^\s*await navigationBoardRevealClaim\?\.\(id\);\s*$/m, "result must not be discarded");
});
