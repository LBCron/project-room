import { HttpTestRoom } from './http-worker.test-fixture.mjs';
import { RoomStore } from '../server/store.mjs';
import { durableStorage } from './storage.mjs';
import { initialRoom } from '../server/bootstrap.mjs';

export class CanonicalPostContextTestRoom extends HttpTestRoom {
  async fetch() {
    const store = this.store;
    store.maintainMessageCertification = true;
    store.initialize(initialRoom());
    const owner = store.issueAccessKey('commons', 'owner');
    const post = id => store.command(owner, 'commons', {
      id, type: 'message.posted', data: { messageId: id, body: `Body ${id}` }
    });
    post('first');
    while (!store.backfillMessages({ limit: 1000 }).done) {}
    store.checkMessagesParity();
    store.migrateMessageAuthority('commons');
    store.maintainMessageCertification = false;
    const room = store.room;
    let wholeRoomReads = 0;
    store.room = function(...args) { wholeRoomReads++; return room.apply(this, args); };
    try { post('second'); } finally { store.room = room; }
    const raw = JSON.parse(store.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get().projection);
    const cold = new RoomStore(null, { database: store.db, storagePlatform: durableStorage });
    return Response.json({ wholeRoomReads, count: raw.messageAuthority.count,
      hasArray: Object.hasOwn(raw, 'messages'), bodies: cold.room('commons').state.messages.map(message => message.body) });
  }
}
export default { fetch(request, env) { return env.ROOM.getByName('canonical-post-fixture').fetch(request); } };
