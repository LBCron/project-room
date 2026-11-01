// Finite synthetic workload capsule. No network calls, services or schedules.
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { cpus, hostname, totalmem, platform, arch } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, openSync, writeSync, fsyncSync, closeSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const self = fileURLToPath(import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const corpus = () => JSON.stringify(Array.from({ length: 4096 }, (_, i) => ({
  id: `message-${i}`, author: `agent-${i % 17}`, revision: i % 7,
  tags: [`review-${i % 29}`, `room-${i % 11}`],
  body: `Deterministic useful-work fixture ${i}: ${'read review correct recover '.repeat(12)}`,
})));
function packet() {
  const bytes = Buffer.from(corpus());
  const compressed = gzipSync(bytes, { level: 6 });
  return { version: 1, id: 'paired-artifact-20261101-v1', sourceDigest: sha(bytes), records: 4096,
    compressedDigest: sha(compressed), payload: compressed.toString('base64') };
}
function verifyPacket(value) {
  assert.equal(value.version, 1); assert.equal(typeof value.id, 'string');
  const packed = Buffer.from(value.payload, 'base64');
  assert.equal(sha(packed), value.compressedDigest, 'transport digest mismatch');
  const bytes = gunzipSync(packed, { maxOutputLength: 8 * 1024 * 1024 });
  assert.equal(sha(bytes), value.sourceDigest, 'source digest mismatch');
  const rows = JSON.parse(bytes);
  assert.equal(rows.length, value.records);
  const counts = {};
  for (const row of rows) counts[row.author] = (counts[row.author] ?? 0) + 1;
  const valueDigest = sha(JSON.stringify(counts));
  return { records: rows.length, sourceDigest: sha(bytes), resultDigest: valueDigest, authors: Object.keys(counts).length };
}
function receive(packetFile, journalFile, crash) {
  const input = JSON.parse(readFileSync(packetFile));
  const verified = verifyPacket(input);
  const db = new DatabaseSync(journalFile);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, input_digest TEXT NOT NULL, result_json TEXT NOT NULL, executions INTEGER NOT NULL);');
  const old = db.prepare('SELECT * FROM results WHERE id=?').get(input.id);
  if (old) {
    assert.equal(old.input_digest, input.sourceDigest, 'same task ID with different input refused');
    db.close(); return { host: hostname(), cached: true, executions: old.executions, ...JSON.parse(old.result_json) };
  }
  db.exec('BEGIN IMMEDIATE');
  db.prepare('INSERT INTO results VALUES(?,?,?,1)').run(input.id, input.sourceDigest, JSON.stringify(verified));
  if (crash) process.exit(42); // real process exit before COMMIT; SQLite rolls back.
  db.exec('COMMIT'); db.close();
  return { host: hostname(), cached: false, executions: 1, ...verified };
}
function child(args) {
  return new Promise((done, reject) => {
    const started = performance.now(), proc = spawn(process.execPath, ['--max-old-space-size=32', self, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timeout = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('bounded child exceeded 45 seconds')); }, 45000);
    proc.stdout.on('data', x => { out += x; }); proc.stderr.on('data', x => { err += x; });
    proc.on('error', reject);
    proc.on('close', code => { clearTimeout(timeout); done({ code, out, error: err.slice(-2000), elapsedMs: performance.now() - started }); });
  });
}
async function pool(input, concurrency) {
  let next = 0; const results = []; const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (;;) { const i = next++; if (i >= 8) return;
      const result = await child(['cpu', input, String(i)]);
      assert.equal(result.code, 0, result.error); results.push(JSON.parse(result.out));
    }
  }));
  return { concurrency, jobs: results.length, elapsedMs: performance.now() - started,
    workerCpuMs: results.reduce((n, x) => n + x.cpuMs, 0),
    peakWorkerRssKiB: Math.max(...results.map(x => x.maxRSSKiB)),
    deterministic: results.every(x => x.digest === results[0].digest), digest: results[0].digest };
}

async function bench(outputDirectory, serialOnly = false) {
  const output = resolve(outputDirectory); mkdirSync(output, { recursive: true });
  const scratch = mkdtempSync(join(output, 'scratch-'));
  const startedAt = new Date().toISOString(), started = performance.now();
  const cpuStarted = process.cpuUsage();
  const result = { version: 1, host: hostname(), platform: platform(), arch: arch(), node: process.version,
    logicalCpus: cpus().length, memoryBytes: totalmem(), capsuleSha256: sha(readFileSync(self)), startedAt,
    fixture: 'Synthetic 4096 messages; fixed eight CPU jobs; <=32MiB explicit memory buffer and bounded scratch. RSS includes Node overhead.', workloads: {} };
  try {
    const source = Buffer.from(corpus()), file = join(scratch, 'corpus.json'); writeFileSync(file, source);
    // Same work and result, different local process concurrency. Launch cost included.
    result.workloads.cpu = [await pool(file, 1)];
    if (!serialOnly) result.workloads.cpu.push(await pool(file, 2));
    const compressedRuns = [];
    let packed;
    for (let i = 0; i < 5; i++) { const at = performance.now(); packed = gzipSync(source, { level: 6 }); const bytes = gunzipSync(packed); assert.equal(sha(bytes), sha(source)); compressedRuns.push(performance.now() - at); }
    result.workloads.compression = { inputBytes: source.length, outputBytes: packed.length, roundTripMs: compressedRuns, digest: sha(packed) };
    const memory = Buffer.alloc(32 * 1024 * 1024, 7); const memoryStarted = performance.now(); let sum = 0;
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < memory.length; i += 64) sum += memory[i];
    assert.equal(sum, 4 * memory.length / 64 * 7);
    result.workloads.memory = { allocatedBytes: memory.length, cacheLineTouches: 4 * memory.length / 64, elapsedMs: performance.now() - memoryStarted, checksum: sum };

    const server = createServer(async (req, res) => {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks); res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ bytes: bytes.length, digest: sha(bytes) }));
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    try {
      const url = `http://127.0.0.1:${server.address().port}/echo`, requestBytes = Buffer.alloc(16384, 5);
      const measure = async () => {
        const samples = [];
        for (let i = 0; i < 24; i++) {
          const at = performance.now(); const response = await fetch(url, { method: 'POST', body: requestBytes, signal: AbortSignal.timeout(5000) });
          const got = await response.json(); assert.equal(got.digest, sha(requestBytes)); samples.push(performance.now() - at);
        }
        const sorted = [...samples].sort((a, b) => a - b);
        return { requests: samples.length, medianMs: sorted[12], p95Ms: sorted[22] };
      };
      const idle = await measure();
      if (!serialOnly) {
        const background = pool(file, 2), loaded = await measure(); await background;
        result.workloads.loopback = { bytesPerRequest: requestBytes.length, idle, withTwoCpuProcesses: loaded, scope: 'One host loopback; does not measure laptop-to-laptop network or latency under full CPU saturation.' };
      } else result.workloads.loopback = { bytesPerRequest: requestBytes.length, idle, scope: 'One host loopback; serial-only mode avoids concurrent load in reserved memory window.' };
    } finally { await new Promise(done => server.close(done)); }

    const database = join(scratch, 'writer.sqlite'); const db = new DatabaseSync(database);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE rows(id INTEGER PRIMARY KEY, body TEXT);');
    const insert = db.prepare('INSERT INTO rows VALUES(?,?)'), body = 'durable-record '.repeat(64);
    const bulkStarted = performance.now(); db.exec('BEGIN'); for (let i = 0; i < 1000; i++) insert.run(i, body); db.exec('COMMIT');
    const bulkMs = performance.now() - bulkStarted;
    const reader = new DatabaseSync(database, { readOnly: true }); reader.exec('BEGIN');
    const prior = reader.prepare('SELECT count(*) AS n FROM rows').get().n;
    db.exec('BEGIN'); insert.run(1000, body); db.exec('COMMIT');
    const snapshot = reader.prepare('SELECT count(*) AS n FROM rows').get().n; reader.exec('COMMIT');
    const fresh = reader.prepare('SELECT count(*) AS n FROM rows').get().n;
    assert.equal(prior, 1000); assert.equal(snapshot, 1000); assert.equal(fresh, 1001);
    const singleStarted = performance.now(); for (let i = 1001; i < 1101; i++) insert.run(i, body);
    result.workloads.sqlite = { bulkRows: 1000, bulkCommitMs: bulkMs, separateCommits: 100, separateCommitMs: performance.now() - singleStarted,
      walBytesBeforeCheckpoint: statSync(`${database}-wal`).size, snapshotReaderCount: snapshot, freshReaderCount: fresh };
    reader.close(); db.close();

    const diskStarted = performance.now(), artifactFile = join(scratch, 'artifact.gz');
    const fd = openSync(artifactFile, 'w'); writeSync(fd, packed); fsyncSync(fd); closeSync(fd);
    assert.equal(sha(readFileSync(artifactFile)), sha(packed));
    result.workloads.artifactIO = { bytes: packed.length, fsyncAndVerifyMs: performance.now() - diskStarted, digest: sha(packed) };
    const transfer = packet(), transferFile = join(output, 'transfer-packet.json'); writeFileSync(transferFile, JSON.stringify(transfer) + '\n');
    result.workloads.artifactProtocol = { packetSha256: sha(readFileSync(transferFile)), ...verifyPacket(transfer) };
    const tampered = { ...transfer, sourceDigest: '0'.repeat(64) };
    assert.throws(() => verifyPacket(tampered), /source digest mismatch/);
    const journal = join(scratch, 'receiver.sqlite');
    const crashed = await child(['receive-crash', transferFile, journal]); assert.equal(crashed.code, 42);
    const resumed = await child(['receive', transferFile, journal]); assert.equal(resumed.code, 0, resumed.error);
    const first = JSON.parse(resumed.out); assert.equal(first.cached, false); assert.equal(first.executions, 1);
    const retry = await child(['receive', transferFile, journal]); assert.equal(retry.code, 0, retry.error);
    const second = JSON.parse(retry.out); assert.equal(second.cached, true); assert.equal(second.executions, 1);
    result.workloads.recovery = { crashExit: crashed.code, afterCrash: first, duplicate: second, tamperedArtifactRejected: true,
      qualification: 'Real local process crash and SQLite reopen. Not a laptop reboot, physical network partition or external side-effect guarantee.' };
    result.finishedAt = new Date().toISOString(); result.elapsedMs = performance.now() - started;
    const used = process.cpuUsage(cpuStarted); result.parentCpuMs = (used.user + used.system) / 1000; result.parentMaxRSSKiB = process.resourceUsage().maxRSS;
    result.serialOnly = serialOnly;
    result.limits = ['CPU scaling is local 1/2 process comparison, not two-host speedup.', 'Disk and WAL measurements are local APFS/SQLite, not network filesystem tests.', 'Cross-host artifact execution must be separately observed on another host.', 'Synthetic repeatable samples, not production latency or a statistically controlled hardware benchmark.'];
    writeFileSync(join(output, 'workload-results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
const [mode, arg, journal] = process.argv.slice(2);
if (mode === 'cpu') {
  const text = readFileSync(arg, 'utf8'), cpu = process.cpuUsage(); let digest;
  for (let i = 0; i < 32; i++) {
    const rows = JSON.parse(text); const aggregate = rows.map(row => `${row.id}:${row.body.toLowerCase().trim()}:${row.tags.sort().join(',')}`).sort().join('\n'); digest = sha(aggregate);
  }
  const used = process.cpuUsage(cpu); console.log(JSON.stringify({ digest, cpuMs: (used.user + used.system) / 1000, maxRSSKiB: process.resourceUsage().maxRSS }));
} else if (mode === 'bench') await bench(arg ?? 'workload-output', journal === '--serial-only');
else if (mode === 'receive' || mode === 'receive-crash') console.log(JSON.stringify(receive(arg, journal, mode === 'receive-crash')));
else if (mode === 'verify') console.log(JSON.stringify({ host: hostname(), ...verifyPacket(JSON.parse(readFileSync(arg))) }));
else throw new Error('Usage: node two-laptop-workloads.mjs bench OUTPUT_DIR | verify PACKET | receive PACKET JOURNAL | receive-crash PACKET JOURNAL');
