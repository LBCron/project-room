"""Offline, source-pinned SQLite-work census. Synthetic in-memory stores only."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time

REPO = os.environ.get('PROJECT_ROOM_CENSUS_REPO', str(Path(__file__).resolve().parents[3]))
PIN = 'eb3edf071f4dd4dec9e67bdcfbb041123b001ed8'
ROOT = Path(__file__).resolve().parent
OUT = Path(os.environ.get('PROJECT_ROOM_CENSUS_OUTPUT', str(ROOT / 'evidence/needs-me-5582-sql-census-1101.json')))
SIZES = (1000, 10000)
MAX_PROGRESS_CALLS = 5_000_000
MAX_QUERY_SECONDS = 5


def source(path):
    return subprocess.check_output(['git', 'show', PIN + ':' + path], cwd=REPO, text=True)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def exact_template(text, prefix):
    candidates = [part for part in re.findall(r'`([^`]*)`', text, re.S) if part.lstrip().startswith(prefix)]
    if len(candidates) != 1:
        raise AssertionError(('ambiguous source query', prefix, len(candidates)))
    return candidates[0]


def profile(db, sql, params):
    # Compile/warm this exact statement before counting; query text is unchanged.
    expected = db.execute(sql, params).fetchall()
    plan = [list(row) for row in db.execute('EXPLAIN QUERY PLAN ' + sql, params)]
    bytecode = db.execute('EXPLAIN ' + sql, params).fetchall()
    progress = 0
    started = time.monotonic()

    def observe():
        nonlocal progress
        progress += 1
        return int(progress > MAX_PROGRESS_CALLS or (
            progress % 4096 == 0 and time.monotonic() - started > MAX_QUERY_SECONDS))

    db.set_progress_handler(observe, 1)
    try:
        rows = db.execute(sql, params).fetchall()
    finally:
        db.set_progress_handler(None, 0)
    elapsed = (time.monotonic() - started) * 1000
    assert rows == expected
    return {
        'returnedRows': len(rows),
        'returnedBodyBytes': sum(len(row[2].encode()) for row in rows),
        'progressCallbacksEvery1': progress,
        'instrumentedElapsedMs': round(elapsed, 3),
        'explainQueryPlan': plan,
        'bytecodeOpcodeCounts': dict(sorted({op: sum(row[1] == op for row in bytecode)
                                           for op in {row[1] for row in bytecode}}.items())),
        'sequenceMin': min((row[1] if sql.lstrip().startswith('SELECT id,') else row[0] for row in rows), default=None),
        'sequenceMax': max((row[1] if sql.lstrip().startswith('SELECT id,') else row[0] for row in rows), default=None),
    }


def fixture(n, mode, event_schema, mention_schema, indices):
    assert n in SIZES
    db = sqlite3.connect(':memory:')
    db.executescript('PRAGMA page_size=4096; PRAGMA max_page_count=8192; CREATE TABLE rooms(id TEXT PRIMARY KEY);')
    db.executescript(event_schema + ';' + mention_schema)
    for statement in indices:
        db.execute(statement)
    events, mentions = [], []
    for sequence in range(1, n + 1):
        event_id = f'event-{sequence:05d}'
        body = {'id': event_id, 'type': 'message.posted', 'actorId': 'writer',
                'data': {'messageId': f'message-{sequence:05d}', 'body': 'synthetic ordinary top-level post'}}
        if mode == 'reply-last' and sequence == n:
            body['data']['replyToId'] = 'synthetic-parent'
        events.append(('room', sequence, event_id, json.dumps(body, separators=(',', ':'))))
        if mode in ('mention-dense', 'mention-narrow-window'):
            who = 'viewer'
        elif mode == 'mention-sparse' and sequence % 100 == 0:
            who = 'viewer'
        elif mode == 'mention-other-member-control':
            who = 'viewer' if sequence <= 10 else 'other'
        else:
            continue
        mentions.append(('room', event_id, who, 'delivered', 0, 1000000, None))
    db.executemany('INSERT INTO events VALUES(?,?,?,?)', events)
    db.executemany('INSERT INTO mention_states VALUES(?,?,?,?,?,?,?)', mentions)
    db.commit()
    return db, len(mentions), sum(row[2] == 'viewer' for row in mentions)


def main():
    if sys.argv[1:] not in ([], ['--analyzed']):
        raise SystemExit('Use no arguments, or --analyzed for fixture planner-statistics contrast')
    analyzed = sys.argv[1:] == ['--analyzed']
    out = OUT.with_name(OUT.stem + '-analyzed.json') if analyzed else OUT
    needs = source('server/needs-me.mjs')
    lifecycle = source('server/mention-lifecycle.mjs')
    store = source('server/store.mjs')
    replies = exact_template(needs, 'SELECT id, sequence, body FROM events')
    mention = exact_template(needs, 'SELECT e.sequence, e.id AS eventId, e.body, m.state AS state, m.timeout_at AS timeoutAt,')
    event_schema = re.search(r'CREATE TABLE events \([^;]+\)', store).group(0)
    # The exact tables/indexes used by these SQL statements, plus current additive late-ack column.
    mention_schema = '\n'.join(re.findall(r'  CREATE (?:TABLE IF NOT EXISTS mention_states|TABLE IF NOT EXISTS mention_observations|INDEX IF NOT EXISTS mention_states_member|INDEX IF NOT EXISTS mention_states_message)[\s\S]*?;', lifecycle))
    late_ack = re.search(r'ALTER TABLE mention_observations ADD COLUMN late_acknowledged_at INTEGER', lifecycle).group(0)
    mention_schema += '\n' + late_ack + ';'
    indices = re.findall(r'CREATE INDEX IF NOT EXISTS events_room_(?:type|work) ON events\([^\"\n]+\)', store)
    assert len(indices) == 2
    assert 'mention_states_member' in mention_schema
    cases = []
    for n in SIZES:
        for mode in ('plain', 'reply-last', 'mention-dense', 'mention-sparse',
                     'mention-narrow-window', 'mention-other-member-control'):
            db, mention_count, viewer_count = fixture(n, mode, event_schema, mention_schema, indices)
            try:
                reply_case = mode in ('plain', 'reply-last')
                sql = replies if reply_case else mention
                after = n - 10 if mode == 'mention-narrow-window' else 0
                params = ('room', after, n, 256) if reply_case else ('room', 'viewer', after, n, 512)
                if analyzed:
                    db.execute('ANALYZE')
                result = profile(db, sql, params)
                result['plannerStatistics'] = 'fixture-ANALYZE' if analyzed else 'not-analyzed'
                result.update(mode=mode, retainedEvents=n, after=after, through=n,
                              query='repliesOf' if reply_case else 'mentionHorizon',
                              limit=256 if reply_case else 512, totalMentionRows=mention_count,
                              viewerMentionRows=viewer_count,
                              fixtureDatabaseBytes=db.execute('PRAGMA page_count').fetchone()[0] * 4096)
                assert result['fixtureDatabaseBytes'] <= 8192 * 4096
                if mode == 'plain':
                    assert result['returnedRows'] == 0
                    result['candidateScannedRowsForThisEmptyReplyBatch'] = 0
                if mode == 'mention-dense':
                    # Source loop decides at the 101st eligible delivered row, after all 512 have been fetched.
                    result['applicationRowsUntilHorizonDecisionOnThisFixture'] = 101
                cases.append(result)
            finally:
                db.close()
    comparisons = []
    for mode in ('plain', 'reply-last', 'mention-dense', 'mention-sparse', 'mention-narrow-window', 'mention-other-member-control'):
        small, large = [row for row in cases if row['mode'] == mode]
        comparisons.append({'mode': mode, 'eventsRatio': 10,
                            'progressRatio': round(large['progressCallbacksEvery1'] / small['progressCallbacksEvery1'], 4),
                            'returnedRows1k': small['returnedRows'], 'returnedRows10k': large['returnedRows'],
                            'progress1k': small['progressCallbacksEvery1'], 'progress10k': large['progressCallbacksEvery1']})
    result = {
        'sourcePin': PIN,
        'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'plannerStatistics': 'fixture-ANALYZE' if analyzed else 'not-analyzed',
        'preparedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'engine': {'pythonSQLite': sqlite3.sqlite_version, 'sqliteSourceId': sqlite3.connect(':memory:').execute('SELECT sqlite_source_id()').fetchone()[0]},
        'queries': {'repliesOf': {'sql': replies, 'sha256': digest(replies)}, 'mentionHorizon': {'sql': mention, 'sha256': digest(mention)}},
        'sourceSha256': {'server/needs-me.mjs': digest(needs), 'server/store.mjs': digest(store), 'server/mention-lifecycle.mjs': digest(lifecycle)},
        'fixtureDDL': {'events': event_schema, 'mentions': mention_schema, 'eventIndices': indices},
        'cases': cases, 'comparisons': comparisons,
        'measurementContract': [
            'Unmodified exact candidate SQL, same bindings/limits; only synthetic in-memory fixture data is written.',
            'SQLite progress-handler calls at instruction interval 1 measure engine progress, not returned rows, physical I/O, CPU or Cloudflare rowsRead.',
            'Statement was warmed before counting. Instrumented elapsed time includes Python callback overhead and is not a performance SLA.',
            'Actual Node/workerd engine and production planner statistics can differ; EXPLAIN and counts qualify only this local SQLite version/schema/fixtures.',
            'Only one batch statement is profiled, not the entire authenticated needs-me endpoint or its other metadata/proof/materialization costs.',
            'The sparse and unrelated-member controls distinguish member-index filtering from a generic assertion that every mention read scans all events.',
            'Missing application scannedRows values are not manufactured; empty-reply scannedRows=0 follows the source loop because its result set is empty.'
        ],
        'resourceCaps': {'maxEventsPerFixture':10000, 'maxDatabaseBytes':8192*4096, 'maxQuerySeconds':MAX_QUERY_SECONDS, 'maxProgressCalls':MAX_PROGRESS_CALLS},
        'noProductEdits': True, 'noLiveCalls': True, 'noCredentials': True,
    }
    out.parent.mkdir(exist_ok=True)
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        json.dump(result, handle, indent=2); handle.write('\n')
    print(json.dumps({'sourcePin':PIN, 'engine':sqlite3.sqlite_version, 'comparisons':comparisons, 'output':str(out)}, indent=2))


if __name__ == '__main__':
    main()
