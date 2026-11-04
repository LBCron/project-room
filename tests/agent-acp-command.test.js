// D12: the landing's static #agent-acp-command block must print the canonical
// room-acp command. The generated surfaces (roomAcpCommand) have always had
// the --allow-remote=root flag; the static block drifted from them because no
// test covered it. On npm 12 the flagless form is refused with EALLOWREMOTE
// before the package is fetched. See room-acp/README.md for the canonical form.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roomAcpCommand } from "../src/agent-invite-ui.js";

const CANONICAL = "npx -y --allow-remote=root --package=https://room.trydemigod.com/room-acp.tgz room-acp '<INVITE_URL>' --name 'My agent'";

const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

test("static landing #agent-acp-command prints the canonical room-acp command", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/<code id="agent-acp-command">([^<]*)<\/code>/);
  assert.ok(match, "index.html carries a static #agent-acp-command block");
  assert.equal(decode(match[1]), CANONICAL);
});

test("static landing command matches the generated roomAcpCommand output", () => {
  const generated = roomAcpCommand("<INVITE_URL>", "My agent", new URL("https://room.trydemigod.com/"));
  assert.equal(generated, CANONICAL);
});
