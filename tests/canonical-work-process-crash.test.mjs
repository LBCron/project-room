import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// This is an actual server-process crash after a committed response reaches a
// loopback proxy, before that proxy delivers any response to the caller.
// It covers process death/retry, not power loss or storage hardware failure.
test('canonical HTTP commits survive SIGKILL and lost replies without replay writes', {timeout: 60000}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'canonical-work-crash-'));
  const filename = join(directory, 'room.sqlite');
  const workers = [];
  let worker, keys, loseNext = false, committed;
  let serial = 0;
  const proxy = createServer(async (req, res) => {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const upstream = await fetch(worker.origin + req.url, {
        method: req.method, headers: {Authorization: req.headers.authorization, 'Content-Type': 'application/json'},
        body, signal: AbortSignal.timeout(15000),
      });
      const text = await upstream.text();
      if (loseNext) {
        loseNext = false;
        committed = {status: upstream.status, body: JSON.parse(text), facts: await facts()};
        worker.child.kill('SIGKILL');
        committed.exit = await worker.exited;
        res.destroy();
      } else {
        res.writeHead(upstream.status, {'Content-Type': 'application/json'});
        res.end(text);
      }
    } catch (error) {
      // Unexpected proxy errors must not masquerade as the intended lost reply.
      committed = {fixtureError: error.message};
      res.destroy();
    }
  });
  t.after(async () => {
    for (const entry of workers) {
      if (entry.child.exitCode === null && entry.child.signalCode === null) entry.child.kill('SIGKILL');
    }
    await Promise.all(workers.map(entry => entry.exited));
    proxy.closeAllConnections();
    await new Promise(resolve => proxy.close(resolve));
    await rm(directory, {recursive: true, force: true});
  });

  async function boot(seed = false) {
    const child = fork(new URL('./fixtures/canonical-work-crash-child.mjs', import.meta.url),
      [filename, ...(seed ? ['seed'] : [])], {
        execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        // Do not inherit developer/provider configuration into this fixture.
        env: {PATH: process.env.PATH, TMPDIR: directory, LANG: 'en_US.UTF-8'},
      });
    let diagnostics = '';
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4096); });
    // A failed spawn emits error/close without exit; cleanup must settle too.
    const exited = new Promise(resolve => child.once('close', (code, signal) => resolve({code, signal})));
    const entry = {child, exited};
    workers.push(entry);
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(Error('Child ready timeout: ' + diagnostics)), 15000);
      const onExit = () => finish(Error('Child exited before ready: ' + diagnostics));
      const onError = error => finish(error);
      const onMessage = message => {
        if (message.ready === true) finish(null, message);
      };
      function finish(error, value) {
        clearTimeout(timer);
        child.off('exit', onExit); child.off('error', onError); child.off('message', onMessage);
        if (error) reject(error); else resolve(value);
      }
      child.once('exit', onExit); child.once('error', onError); child.on('message', onMessage);
    });
    worker = {...entry, origin: ready.origin};
    if (seed) keys = ready.keys;
  }
  async function control(method, data = {}) {
    const {child} = worker, id = ++serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(Error('Child control timeout')), 15000);
      const onExit = () => finish(Error('Child exited during control'));
      const onMessage = message => {
        if (message.id === id) finish(message.error ? Error(message.error) : null, message.result);
      };
      function finish(error, value) {
        clearTimeout(timer); child.off('exit', onExit); child.off('message', onMessage);
        if (error) reject(error); else resolve(value);
      }
      child.once('exit', onExit); child.on('message', onMessage);
      child.send({id, method, ...data}, error => { if (error) finish(error); });
    });
  }
  const facts = () => control('facts');
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${proxy.address().port}`;
  async function request(command) {
    const response = await fetch(origin + '/api/rooms/crash-room/commands', {
      method: 'POST', headers: {Authorization: `Bearer ${keys.worker}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(command), signal: AbortSignal.timeout(20000),
    });
    return {status: response.status, body: await response.json()};
  }
  await boot(true);
  const commands = [
    {id: 'lost-accept', type: 'work.accepted', data: {workItemId: 'task', expectedRevision: 0}},
    {id: 'lost-scope', type: 'claim.acquired', data: {
      workItemId: 'task', expectedRevision: 1, repository: 'synthetic/project', ref: 'main', paths: ['result.txt'],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    }},
    {id: 'lost-message', type: 'message.posted', data: {
      messageId: 'saved-result', body: 'Synthetic durable result', workItemId: 'task',
    }},
  ];
  for (const command of commands) await t.test(command.type, async () => {
    const before = await facts();
    committed = null;
    loseNext = true;
    await assert.rejects(request(command), TypeError);
    assert.equal(committed?.fixtureError, undefined);
    assert.equal(committed.status, 201);
    assert.deepEqual(committed.exit, {code: null, signal: 'SIGKILL'});
    assert.equal(committed.body.event.actorId, 'worker');
    assert.equal(committed.facts.head, before.head + 1);
    const saved = committed;
    await boot();
    const cold = await facts();
    assert.deepEqual(cold, saved.facts, 'Committed rows/proofs survive an actual process kill');
    const retry = await request(command);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(retry.body.event.id, saved.body.event.id);
    assert.deepEqual(await facts(), cold, 'Exact retry adds no event, receipt, row or proof');
  });
  await t.test('changed intent and revoked credentials cannot replay a receipt', async () => {
    const beforeConflict = await facts();
    const conflict = await request({...commands[2], data: {...commands[2].data, body: 'Changed intent'}});
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'idempotency_conflict');
    assert.deepEqual(await facts(), beforeConflict);
    assert.deepEqual(await control('revoke', {token: keys.worker}), {revoked: true});
    const beforeAuth = await facts(), revoked = await request(commands[2]);
    assert.equal(revoked.status, 401);
    assert.equal(revoked.body.error.code, 'unauthenticated');
    assert.deepEqual(await facts(), beforeAuth);
  });
  assert.equal(workers.length, 4);
});
