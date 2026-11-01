// Synthetic SQL-only history. These are the production event/member lookup keys;
// no protected serving state or historical proof is manufactured by this fixture.
export function attentionWindowFixture(db, count, mode = 'plain') {
  db.exec(`CREATE TABLE rooms(id TEXT PRIMARY KEY);
    INSERT INTO rooms VALUES('room');
    CREATE TABLE events(room_id TEXT NOT NULL REFERENCES rooms(id),sequence INTEGER NOT NULL,id TEXT NOT NULL UNIQUE,body TEXT NOT NULL,PRIMARY KEY(room_id,sequence));
    CREATE INDEX events_room_type ON events(room_id,json_extract(body,'$.type'));
    CREATE INDEX events_room_work ON events(room_id,json_extract(body,'$.data.workItemId'),sequence);
    CREATE TABLE mention_states(room_id TEXT NOT NULL,message_event_id TEXT NOT NULL,mentioned_member_id TEXT NOT NULL,state TEXT NOT NULL,timeout_at INTEGER,PRIMARY KEY(room_id,message_event_id,mentioned_member_id));
    CREATE INDEX mention_states_member ON mention_states(room_id,mentioned_member_id,state);
    CREATE INDEX mention_states_message ON mention_states(room_id,message_event_id);
    CREATE TABLE mention_observations(room_id TEXT NOT NULL,message_event_id TEXT NOT NULL,mentioned_member_id TEXT NOT NULL,acknowledged_at INTEGER,late_acknowledged_at INTEGER,PRIMARY KEY(room_id,message_event_id,mentioned_member_id));`);
  const insert = db.prepare('INSERT INTO events VALUES(?,?,?,?)');
  const mention = db.prepare('INSERT INTO mention_states VALUES(?,?,?,?,?)');
  for (let seq = 1; seq <= count; seq++) {
    const id = `event-${seq}`;
    const data = { messageId: id, body: 'ordinary synthetic post' };
    if ((mode === 'reply-last' && seq === count) || mode === 'covered-replies') data.replyToId = 'parent';
    insert.run('room', seq, id, JSON.stringify({ id, type: 'message.posted', actorId: 'writer', data }));
    if (mode === 'other-member' || mode === 'covered-replies') mention.run('room', id, mode === 'covered-replies' || seq <= 10 ? 'viewer' : 'other', 'delivered', 1000000);
  }
  const state = { room: { id: 'room' }, messages: [{ id: 'parent', authorId: 'viewer', body: 'parent' }], replyRequests: {} };
  return { db, now: () => 0, room: () => ({ state }), state, readTransaction(fn) {
    if (db.readTransaction) return db.readTransaction(fn);
    db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
}
