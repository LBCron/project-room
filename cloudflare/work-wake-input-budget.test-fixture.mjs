// Disposable local Worker data; synthetic backlog cloned from a real producer row.
import { DurableObject } from 'cloudflare:workers';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { DurableDatabase, durableStorage } from './storage.mjs';
export class WorkWakeBudgetProbe extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.db = new DurableDatabase(ctx.storage);
    this.at = 1770000000000;
    this.store = new RoomStore(null, { database: this.db, storagePlatform: durableStorage, now: () => this.at });
  }
  async fetch(request) {
    const s = this.store, db = this.db, { count, kind } = await request.json();
    s.initialize(initialRoom()); s.initialize(initialRoom('other'));
    const owner = s.issueAccessKey('commons', 'owner');
    const identity = s.identities.create('Synthetic work-wake agent');
    const { linkCode } = s.identities.mintLinkCode(identity.identityId, identity.secret, { roomId: 'commons' });
    s.identities.link(owner, 'commons', { identityId: identity.identityId, identityLinkCode: linkCode, memberId: 'worker', displayName: 'Worker', permissions: ['accept_work'] });
    s.transaction(() => s.workWakes.setHost(identity.identityId, 'host', true, 'commons'));
    s.command(owner, 'commons', { id: 'producer', type: 'work.proposed', data: { workItemId: 'task', title: 'Synthetic task', definitionOfDone: 'Synthetic control', mode: 'read', accountableMemberId: 'worker' } });
    const original = db.prepare('SELECT * FROM agent_work_wakes WHERE agent_id=?').get(identity.identityId);
    if (!original) throw Error('real producer did not create a row');
    s.transaction(() => {
      const put = db.prepare('INSERT INTO agent_work_wakes VALUES(?,?,?,?,?,?,?,?,?,?,NULL,NULL)');
      for (let n = 0; n < count; n++) put.run('ww_backlog_' + String(n).padStart(5, '0'), identity.identityId,
        kind === 'opted-out' ? 'other' : 'commons', 'worker', 'task', kind === 'stale' ? -1 : original.work_revision,
        'synthetic-backlog-' + n, original.actor_id, original.pointer, this.at - 100);
    });
    let selected = 0, reads = 0, roomReads = 0;
    const prepare = db.prepare.bind(db), room = s.room.bind(s);
    db.prepare = sql => {
      const statement = prepare(sql);
      if (/SELECT \* FROM agent_work_wakes WHERE agent_id=/.test(sql)) {
        const all = statement.all.bind(statement);
        statement.all = (...args) => { const start = db.rowsRead, rows = all(...args); reads += db.rowsRead - start; selected += rows.length; return rows; };
      }
      return statement;
    };
    s.room = (...args) => { roomReads++; return room(...args); };
    const before = db.rowsRead;
    const page = s.transaction(() => s.agentHeartbeats.pendingWakePage(identity.identityId, { hostId: 'host' }));
    const totalRowsRead = db.rowsRead - before;
    const measured = { selected, reads, roomReads };
    let controls = null;
    if (count === 1000 && kind === 'stale') {
      const pending = () => s.transaction(() => s.agentHeartbeats.pendingWakePage(identity.identityId, { hostId: 'host' })).signals.length;
      s.transaction(() => s.workWakes.setHost(identity.identityId, 'host', false, 'commons'));
      const optedOut = pending();
      s.transaction(() => s.workWakes.setHost(identity.identityId, 'host', true, 'commons'));
      s.wakeQueue.pause(identity.secret, 'commons', { requestId: 'pause', reason: 'Synthetic control' });
      const paused = pending(); s.wakeQueue.resume(identity.secret, 'commons', { requestId: 'resume' });
      const minute = Math.floor(this.at / 60000) % 1440;
      s.attention.mutate(identity.secret, 'commons', { requestId: 'quiet', quietStart: minute, quietEnd: (minute + 2) % 1440, delivery: 'immediate', digestHour: null });
      const quiet = pending();
      s.attention.mutate(identity.secret, 'commons', { requestId: 'unquiet', quietStart: null, quietEnd: null, delivery: 'immediate', digestHour: null });
      const restored = pending();
      s.command(owner, 'commons', { id: 'remove', type: 'member.access_changed', data: { memberId: 'worker', expectedMemberRevision: 0, active: false, permissions: [] } });
      const removed = pending(); controls = { optedOut, paused, quiet, restored, removed };
    }
    return Response.json({ count, kind, controls, selected: measured.selected, candidateRowsRead: measured.reads, totalRowsRead, roomReads: measured.roomReads,
      signals: page.signals.map(w => ({ kind: w.kind, workItemId: w.workItemId, workRevision: w.workRevision, action: w.action, nextRead: w.nextRead })),
      more: page.more, nextCursor: page.nextCursor });
  }
}
export default { fetch(request, env) { return env.ROOM.get(env.ROOM.idFromName(new URL(request.url).pathname)).fetch(request); } };
