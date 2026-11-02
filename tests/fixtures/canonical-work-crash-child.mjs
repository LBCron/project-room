// Disposable child: only file SQLite, loopback HTTP and parent-owned IPC.
import {createHash} from 'node:crypto';
import {RoomStore} from '../../server/store.mjs';
import {initialRoom} from '../../server/bootstrap.mjs';
import {event} from '../../src/events.js';
import {createRoomServer} from '../../server/http.mjs';
import {auditRecovery} from '../../server/recovery.mjs';

const [filename, seed] = process.argv.slice(2);
const store = new RoomStore(filename);
let keys;
if (seed === 'seed') {
  const events = initialRoom('crash-room');
  events.push(event({roomId: 'crash-room', actorId: 'owner', type: 'member.added', data: {
    memberId: 'worker', displayName: 'Synthetic worker', kind: 'agent',
    permissions: ['accept_work', 'complete_work', 'write_external'],
  }}));
  store.initialize(events, {representation: 'normalized-current-v1'});
  keys = {owner: store.issueAccessKey('crash-room', 'owner'), worker: store.issueAccessKey('crash-room', 'worker')};
  store.command(keys.owner, 'crash-room', {id: 'propose-task', type: 'work.proposed', data: {
    workItemId: 'task', title: 'Synthetic durable task', definitionOfDone: 'Save one result',
    accountableMemberId: 'worker', mode: 'write',
  }});
}
const server = createRoomServer({store});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
process.on('message', ({id, method, token}) => {
  try {
    let result;
    if (method === 'facts') {
      auditRecovery(store);
      const tables = ['rooms', 'operator_actions', 'work_claim_config', 'events', 'commands',
        'work_entities', 'work_claims', 'current_room_records', 'current_room_record_proofs', 'current_room_head'];
      const fingerprints = Object.fromEntries(tables.map(table => {
        const rows = store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
        return [table, {rows: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex')}];
      }));
      result = {head: store.headSequence('crash-room'), fingerprints, auditPassed: true};
    } else if (method === 'revoke') {
      store.revoke(token);
      result = {revoked: true};
    } else throw Error('Unknown fixture method');
    process.send({id, result});
  } catch (error) {
    process.send({id, error: error.message});
  }
});
// Parent failure must not leave a server child behind.
process.on('disconnect', () => process.exit(0));
process.send({ready: true, origin: `http://127.0.0.1:${server.address().port}`, ...(keys ? {keys} : {})});
