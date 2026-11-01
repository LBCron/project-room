// room-acp B1: argument parsing, agent detection and the initialize probe
// against the scripted fake ACP agent.
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../room-acp/src/args.mjs";
import { candidates, probe, splitCommand, spawnAgent, childEnvFor, KNOWN_AGENTS } from "../room-acp/src/agents.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { main } from "../room-acp/src/cli.mjs";

const fake = fileURLToPath(new URL("../room-acp/fixtures/fake-agent.mjs", import.meta.url));
const fakeCmd = `"${process.execPath}" "${fake}"`;

test("parseArgs: link, subcommands, options and errors", () => {
  assert.equal(parseArgs(["https://room.trydemigod.com/join/RM-ABC"]).command, "join");
  assert.equal(parseArgs(["doctor", "--agent", "codex"]).agent, "codex");
  assert.equal(parseArgs([]).command, "run");
  assert.equal(parseArgs(["--max-sessions", "2"]).maxSessions, 2);
  assert.throws(() => parseArgs(["--max-sessions", "0"]), /1\.\.32/);
  assert.throws(() => parseArgs(["--nope"]), /unknown option/);
  assert.throws(() => parseArgs(["--agent"]), /needs a value/);
  assert.throws(() => parseArgs(["--respond-to", "everyone"]), /owner or anyone/);
});

test("known agents use the verified ACP commands", () => {
  const byId = Object.fromEntries(KNOWN_AGENTS.map(entry => [entry.id, entry]));
  assert.deepEqual(byId.claude.npx, ["-y", "@agentclientprotocol/claude-agent-acp"]);
  assert.deepEqual(byId.codex.npx, ["-y", "@agentclientprotocol/codex-acp@2.5.0"]);
  assert.deepEqual(byId.goose.args, ["acp"]);
  assert.deepEqual(byId.gemini.args, ["--acp"]);
});

test("candidates: custom command wins; npx fallback only when an agent is named", () => {
  assert.deepEqual(splitCommand('"/a b/node" x.mjs'), { command: "/a b/node", args: ["x.mjs"] });
  assert.equal(candidates({ agentCmd: fakeCmd })[0].id, "custom");
  assert.deepEqual(candidates({ env: { PATH: "" } }), []);
  assert.equal(candidates({ agent: "claude", env: { PATH: "" } })[0].command, "npx");
  assert.throws(() => candidates({ agent: "nope" }), /unknown agent/);
});

test("spawnAgent: child env is an allowlist — no parent credential crosses (RES-0151/RES-0145, one site)", async t => {
  // Dummy sentinels only; nothing here is a real credential.
  const env = {
    PATH: process.env.PATH, HOME: "/tmp/fakehome", CODEX_PATH: "/opt/codex", FAKE_ACP_MODE: "echo",
    OPENAI_API_KEY: "DUMMY-openai", ANTHROPIC_API_KEY: "DUMMY-anthropic", GH_TOKEN: "DUMMY-gh",
    GITHUB_TOKEN: "DUMMY-github", AWS_SECRET_ACCESS_KEY: "DUMMY-aws", AWS_SESSION_TOKEN: "DUMMY-awssession",
    STRIPE_SECRET_KEY: "DUMMY-stripe", NPM_TOKEN: "DUMMY-npm", CUSTOM_UNLISTED_SECRET: "DUMMY-custom",
    ROOM_AGENT_TOKEN: "DUMMY-roomagent", PROJECT_ROOM_SECRET: "DUMMY-projectroom",
    ROOM_TOKEN: "DUMMY-roomtoken", ROOM_CREDENTIAL: "DUMMY-roomcred", ROOM_ACP_X: "DUMMY-roomacp",
  };
  assert.deepEqual(Object.keys(childEnvFor(env)).sort(), ["CODEX_PATH", "FAKE_ACP_MODE", "HOME", "PATH"]);
  const dir = mkdtempSync(pathJoin(tmpdir(), "room-acp-env-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { child, peer } = spawnAgent(
    { id: "dump", label: "Dump", command: process.execPath, args: ["-e", "require('node:fs').writeFileSync('env-dump.json', JSON.stringify(process.env))"] },
    { cwd: dir, env },
  );
  await new Promise(resolve => child.once("exit", resolve));
  peer.close();
  const seen = JSON.parse(readFileSync(pathJoin(dir, "env-dump.json"), "utf8"));
  for (const key of ["PATH", "HOME", "CODEX_PATH", "FAKE_ACP_MODE"]) assert.equal(seen[key], env[key], key);
  for (const key of Object.keys(env)) if (!["PATH", "HOME", "CODEX_PATH", "FAKE_ACP_MODE"].includes(key)) assert.equal(seen[key], undefined, `${key} crossed to the child`);
});

test("probe: initialize against the fake agent reports capabilities", async () => {
  const [candidate] = candidates({ agentCmd: fakeCmd });
  const result = await probe(candidate);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.capabilities.protocolVersion, 1);
  assert.equal(result.capabilities.loadSession, true);
});

test("probe: a missing binary fails without throwing", async () => {
  const result = await probe({ id: "x", label: "X", command: "/nonexistent/acp-agent", args: [] });
  assert.equal(result.ok, false);
});

test("doctor lists the fake agent's capabilities", async () => {
  const lines = [];
  const code = await main(["doctor", "--agent-cmd", fakeCmd], { print: line => lines.push(line) });
  assert.equal(code, 0);
  assert.match(lines.join("\n"), /ok\s+Custom agent \(custom\): protocol 1, loadSession yes/);
});
