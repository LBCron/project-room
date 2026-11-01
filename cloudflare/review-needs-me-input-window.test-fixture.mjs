// Isolated synthetic query qualification only; never deployed.
import { DurableObject } from 'cloudflare:workers';
import { repliesOf, mentionHorizon } from '../server/needs-me.mjs';
import { attentionWindowFixture } from '../tests/helpers/review-needs-me-input-window-fixture.mjs';
export class ReviewedAttentionWindowRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url), count = Number(url.searchParams.get('count')), mode = url.searchParams.get('mode');
    let measured = false, rowsRead = 0, payloadBytes = 0, payloadRows = 0;
    const sql = this.ctx.storage.sql;
    const execute = (text, args) => {
      const cursor = sql.exec(text, ...args), rows = cursor.toArray();
      if (measured) {
        if (!Number.isSafeInteger(cursor.rowsRead)) throw Error('Worker rowsRead unavailable');
        rowsRead += cursor.rowsRead;
        payloadRows += rows.filter(row => typeof row.body === 'string').length;
        for (const row of rows) for (const key of ['body','id','eventId']) if (typeof row[key] === 'string') payloadBytes += new TextEncoder().encode(row[key]).length;
      }
      return rows;
    };
    const db = { readTransaction: fn => this.ctx.storage.transactionSync(fn), exec: text => execute(text, []), prepare: text => ({ all: (...args) => execute(text, args), get: (...args) => execute(text, args)[0], run: (...args) => execute(text, args) }) };
    const store = this.ctx.storage.transactionSync(() => attentionWindowFixture(db, count, mode));
    if (mode === 'legal-escaped' || mode === 'escaped-batch' || mode === 'oversized') {
      for (let sequence = 1; sequence <= count; sequence++) {
        const row = db.prepare('SELECT body FROM events WHERE room_id=? AND sequence=?').get('room', sequence);
        const body = JSON.parse(row.body); body.data.body = mode === 'oversized' ? 'x'.repeat(1048577) : '\u0001'.repeat(65536);
        db.prepare('UPDATE events SET body=? WHERE room_id=? AND sequence=?').run(JSON.stringify(body), 'room', sequence);
      }
    }
    measured = true;
    let scan, refusal = null;
    try { scan = mode === 'other-member' ? mentionHorizon(store, 'room', 'viewer', 0, count) : repliesOf(store, 'room', 'viewer', 0, count, store.state); } catch(error) { refusal = { status: error.status ?? 500, code: error.code ?? 'unknown' }; }
    return Response.json({ count, mode, rowsRead, payloadBytes, payloadRows, refusal, scan });
  }
}
export default { fetch(request, env) { return env.ROOM.getByName(new URL(request.url).search).fetch(request); } };
