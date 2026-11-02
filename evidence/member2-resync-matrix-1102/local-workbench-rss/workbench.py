#!/usr/bin/env python3
"""Finite local source workloads. Python stdlib; no network, daemon or shell jobs."""
import argparse
from collections import Counter, defaultdict
import fcntl
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import resource
import selectors
import signal
import sqlite3
import stat
import subprocess
import sys
import time

SELF = Path(__file__).resolve()
MIB = 1024 * 1024
KINDS = ('inventory', 'compress', 'search-index')
EXTENSIONS = {'.md', '.txt', '.py', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.sql', '.yaml', '.yml'}
EXCLUDE = {'node_modules', 'vendor', 'dist', 'build', 'target', '__pycache__', 'coverage', 'outputs', 'evidence', 'audit', 'archive'}


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.partial')
    with temp.open('wb') as stream:
        stream.write(canonical(value) + b'\n')
        stream.flush()
        os.fsync(stream.fileno())
    temp.replace(path)


def read_regular(path, limit):
    """No final-component symlinks; callers also check resolved containment."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Not an admitted regular file: ' + str(path))
        data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Input grew beyond bound')
        return data


def load_plan(capsule):
    capsule = Path(capsule).resolve()
    plan = json.loads(read_regular(capsule / 'plan.json', 8 * MIB))
    saved = plan.pop('plan_sha256')
    if digest(canonical(plan)) != saved or plan['tool_sha256'] != digest(SELF.read_bytes()):
        raise ValueError('Plan or tool changed; create a new capsule')
    plan['plan_sha256'] = saved
    return capsule, plan


def plan_source(root, output, max_files=320, max_mib=16, batch_files=16):
    root, output = Path(root).resolve(strict=True), Path(output).resolve()
    if not root.is_dir() or output == root or root.is_relative_to(output):
        raise ValueError('Use a distinct output directory, not an ancestor of the source')
    if output.exists():
        raise ValueError('Capsule output already exists; never overwrite a snapshot')
    if not (1 <= max_files <= 5000 and 1 <= max_mib <= 128 and 1 <= batch_files <= 32):
        raise ValueError('Plan limits out of range')
    output.mkdir(parents=True, mode=0o700)
    (output / 'objects').mkdir(mode=0o700)
    files, skipped, total, visited = [], Counter(), 0, 0
    stop = False
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.') and d not in EXCLUDE
                         and not (Path(directory) / d).is_symlink()
                         and (Path(directory) / d).resolve() != output)
        for name in sorted(names):
            visited += 1
            if visited > 50000:
                skipped['discovery_limit'] += 1
                stop = True
                break
            path = Path(directory) / name
            if name.startswith('.') or path.suffix.lower() not in EXTENSIONS:
                skipped['extension_or_hidden'] += 1
                continue
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                skipped['symlink_or_escape'] += 1
                continue
            try:
                data = read_regular(path, 256 * 1024)
                text = data.decode('utf-8')
                if '\x00' in text:
                    raise ValueError('Binary text')
            except (OSError, UnicodeError, ValueError):
                skipped['nontext_large_or_unreadable'] += 1
                continue
            if total + len(data) > max_mib * MIB or len(files) >= max_files:
                skipped['selection_limit'] += 1
                stop = True
                break
            sha = digest(data)
            obj = output / 'objects' / sha
            if not obj.exists():
                obj.write_bytes(data)
            files.append({'path': path.relative_to(root).as_posix(), 'sha256': sha, 'bytes': len(data)})
            total += len(data)
        if stop:
            break
    if not files:
        raise ValueError('No admitted text files')
    jobs = []
    for start in range(0, len(files), batch_files):
        batch = files[start:start + batch_files]
        for kind in KINDS:
            spec = {'kind': kind, 'files': batch}
            jobs.append({'id': digest(canonical(spec)), **spec})
    plan = {'version': 1, 'tool_sha256': digest(SELF.read_bytes()), 'source_root': str(root),
            'files': files, 'jobs': jobs, 'selected_bytes': total, 'skipped': dict(skipped),
            'limits': {'max_files': max_files, 'max_input_mib': max_mib, 'max_file_bytes': 256 * 1024,
                       'batch_files': batch_files, 'max_discovered_files': 50000}}
    plan['plan_sha256'] = digest(canonical(plan))
    atomic_json(output / 'plan.json', plan)
    # Keep the exact runner beside its inputs so later tool edits do not make
    # an old experiment impossible to reproduce. load_plan checks this hash.
    (output / 'tool.py').write_bytes(SELF.read_bytes())
    return {'capsule': str(output), 'files': len(files), 'jobs': len(jobs), 'bytes': total,
            'plan_sha256': plan['plan_sha256'], 'skipped': dict(skipped)}


def inputs(capsule, job):
    for entry in job['files']:
        sha = entry['sha256']
        if not re.fullmatch('[a-f0-9]{64}', sha):
            raise ValueError('Invalid object hash')
        data = read_regular(capsule / 'objects' / sha, 256 * 1024)
        if digest(data) != sha or len(data) != entry['bytes']:
            raise ValueError('Snapshot object changed: ' + entry['path'])
        yield entry, data.decode('utf-8')


def worker(capsule, job_id, destination, timeout):
    # The inherited coordinator lock remains held if the supervisor is killed.
    resource.setrlimit(resource.RLIMIT_CPU, (max(1, math.ceil(timeout)), max(2, math.ceil(timeout) + 1)))
    resource.setrlimit(resource.RLIMIT_FSIZE, (128 * MIB, 128 * MIB))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    capsule, plan = load_plan(capsule)
    job = next(j for j in plan['jobs'] if j['id'] == job_id)
    if digest(canonical({k: job[k] for k in ('kind', 'files')})) != job_id:
        raise ValueError('Job identity mismatch')
    destination = Path(destination)
    started, cpu = time.perf_counter(), time.process_time()
    records = list(inputs(capsule, job))
    artifacts, measurements = [], {}
    if job['kind'] == 'inventory':
        rows = []
        for entry, text in records:
            # Deliberately a lexical inventory, not a JS dependency parser.
            imports = sorted(set(re.findall(r'''(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"\n]+)['"]''', text)))
            rows.append({**entry, 'lines': len(text.splitlines()), 'extension': Path(entry['path']).suffix,
                         'markers': {word: len(re.findall(r'\b' + word + r'\b', text)) for word in ('TODO', 'FIXME')},
                         'lexical_imports': imports[:200]})
        logical = {'kind': job['kind'], 'files': rows}
    elif job['kind'] == 'compress':
        import lzma
        payload = canonical([{'path': entry['path'], 'sha256': entry['sha256'], 'text': text} for entry, text in records])
        codecs = []
        for codec in ('gzip-1', 'gzip-9', 'lzma-1'):
            at = time.perf_counter()
            if codec.startswith('gzip'):
                packed = gzip.compress(payload, compresslevel=int(codec[-1]), mtime=0)
                restored = gzip.decompress(packed)
            else:
                packed = lzma.compress(payload, preset=1)
                restored = lzma.decompress(packed, memlimit=64 * MIB)
            if restored != payload:
                raise ValueError('Compression round-trip failed')
            filename = codec + '.bin'
            (destination / filename).write_bytes(packed)
            artifacts.append(filename)
            codecs.append({'codec': codec, 'input_bytes': len(payload), 'output_bytes': len(packed),
                           'sha256': digest(packed)})
            measurements[codec + '_ms'] = (time.perf_counter() - at) * 1000
        logical = {'kind': job['kind'], 'codecs': codecs, 'input_sha256': digest(payload)}
    elif job['kind'] == 'search-index':
        filename = 'index.sqlite'
        db = sqlite3.connect(destination / filename)
        try:
            db.execute('CREATE TABLE documents(id INTEGER PRIMARY KEY,path TEXT UNIQUE,sha256 TEXT)')
            db.execute('CREATE VIRTUAL TABLE search USING fts5(path,body,probe)')
            for i, (entry, text) in enumerate(records, 1):
                db.execute('INSERT INTO documents VALUES(?,?,?)', (i, entry['path'], entry['sha256']))
                db.execute('INSERT INTO search(rowid,path,body,probe) VALUES(?,?,?,?)', (i, entry['path'], text, 'localworkbenchprobe'))
            db.execute("INSERT INTO search(search) VALUES('integrity-check')")
            assert db.execute("SELECT count(*) FROM search WHERE search MATCH 'localworkbenchprobe'").fetchone()[0] == len(records)
            assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            db.commit()
            logical = {'kind': job['kind'], 'documents': [entry for entry, _ in records],
                       'queries': {q: [row[0] for row in db.execute('SELECT path FROM search WHERE search MATCH ? ORDER BY path', (q,))]
                                   for q in ('restore', 'message', 'privacy', 'agent')}}
        finally:
            db.close()
        artifacts.append(filename)
    else:
        raise ValueError('Unknown fixed workload')
    hashes = {name: digest((destination / name).read_bytes()) for name in artifacts}
    usage = resource.getrusage(resource.RUSAGE_SELF)
    result = {'job_id': job_id, 'plan_sha256': plan['plan_sha256'], 'logical': logical,
              'logical_sha256': digest(canonical(logical)), 'artifacts': hashes,
              'measurements': measurements,
              'wall_ms': (time.perf_counter() - started) * 1000,
              'cpu_ms': (time.process_time() - cpu) * 1000,
              'peak_rss_bytes': usage.ru_maxrss * (1 if sys.platform == 'darwin' else 1024)}
    atomic_json(destination / 'result.json', result)


def open_journal(state):
    db = sqlite3.connect(state / 'journal.sqlite')
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    db.execute('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT)')
    db.execute('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT,state TEXT,attempts INTEGER DEFAULT 0,pid INTEGER,result_path TEXT,result_sha256 TEXT,error TEXT)')
    return db


def verify_result(state, row, plan_sha=None):
    path = (state / row['result_path']).resolve()
    if not path.is_relative_to(state.resolve()):
        raise ValueError('Result path escaped run directory')
    data = read_regular(path, 16 * MIB)
    if digest(data) != row['result_sha256']:
        raise ValueError('Result receipt digest mismatch')
    result = json.loads(data)
    if result['job_id'] != row['id'] or (plan_sha and result['plan_sha256'] != plan_sha):
        raise ValueError('Result source identity mismatch')
    if result['logical_sha256'] != digest(canonical(result['logical'])):
        raise ValueError('Logical result digest mismatch')
    for name, sha in result['artifacts'].items():
        artifact = (path.parent / name).resolve()
        if not artifact.is_relative_to(path.parent) or digest(read_regular(artifact, 128 * MIB)) != sha:
            raise ValueError('Artifact digest mismatch')
    return result, path


def kill_job(process):
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.wait()


def sampled_rss(pid):
    try:
        result = subprocess.run(['/bin/ps', '-o', 'rss=', '-p', str(pid)], capture_output=True, text=True, timeout=1)
        return int(result.stdout.strip() or '0') * 1024
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def run(capsule, state, workers=2, timeout=30, rss_mib=512):
    if not (1 <= workers <= 8 and 0.01 <= timeout <= 600 and 32 <= rss_mib <= 4096):
        raise ValueError('Run limits out of range')
    capsule, plan = load_plan(capsule)
    state = Path(state).resolve()
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = (state / 'supervisor.lock').open('a+b')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        raise ValueError('Run is still owned by a supervisor or inherited live worker')
    db, active, stop = None, {}, [False]
    selector = selectors.DefaultSelector()
    handlers = {}
    started = time.perf_counter()
    parent_cpu = time.process_time()
    child_usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    try:
        db = open_journal(state)
        saved = db.execute("SELECT value FROM meta WHERE key='plan'").fetchone()
        if saved and saved[0] != plan['plan_sha256']:
            raise ValueError('Run belongs to a different immutable plan')
        db.execute("INSERT OR IGNORE INTO meta VALUES('plan',?)", (plan['plan_sha256'],))
        for job in plan['jobs']:
            db.execute('INSERT OR IGNORE INTO jobs(id,kind,state) VALUES(?,?,?)', (job['id'], job['kind'], 'pending'))
        db.execute("UPDATE jobs SET state='interrupted',pid=NULL WHERE state='running'")
        db.commit()
        db.row_factory = sqlite3.Row
        todo, cached = [], 0
        for row in db.execute('SELECT * FROM jobs ORDER BY id').fetchall():
            if row['state'] == 'succeeded':
                verify_result(state, row, plan['plan_sha256'])
                cached += 1
            else:
                todo.append(dict(row))
        for sig in (signal.SIGINT, signal.SIGTERM):
            handlers[sig] = signal.signal(sig, lambda *_: stop.__setitem__(0, True))
        executed = 0
        while todo or active:
            while todo and len(active) < workers and not stop[0]:
                row = todo.pop(0)
                parent_folder = state / 'attempts' / row['id']
                existing = [int(p.name) for p in parent_folder.iterdir() if p.name.isdecimal() and len(p.name) < 10] if parent_folder.exists() else []
                attempt = max([row['attempts'], *existing], default=0) + 1
                # Reserve before filesystem/process side effects. A crash in
                # any later window retries into a new attempt directory.
                db.execute("UPDATE jobs SET state='running',attempts=?,pid=NULL,error=NULL WHERE id=?", (attempt, row['id']))
                db.commit()
                folder = parent_folder / str(attempt)
                folder.mkdir(parents=True)
                log = (folder / 'worker.log').open('wb')
                try:
                    process = subprocess.Popen([sys.executable, '-I', '-S', str(SELF), '_worker', str(capsule), row['id'], str(folder), str(timeout)],
                                               stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                               start_new_session=True, pass_fds=(lock.fileno(),))
                except BaseException:
                    log.close()
                    db.execute("UPDATE jobs SET state='failed',error='process_launch_failed' WHERE id=?", (row['id'],))
                    db.commit()
                    raise
                active[row['id']] = {'p': process, 'at': time.monotonic(), 'folder': folder, 'log': log,
                                     'peak': 0, 'next_sample': time.monotonic(), 'log_bytes': 0}
                selector.register(process.stdout, selectors.EVENT_READ, row['id'])
                db.execute('UPDATE jobs SET pid=? WHERE id=?', (process.pid, row['id']))
                db.commit()
                executed += 1
            for job_id, entry in list(active.items()):
                process, reason = entry['p'], None
                if stop[0]:
                    reason = 'cancelled'
                elif time.monotonic() - entry['at'] > timeout:
                    reason = 'wall_timeout'
                if process.poll() is None and not reason and time.monotonic() >= entry['next_sample']:
                    rss = sampled_rss(process.pid)
                    entry['next_sample'] = time.monotonic() + 0.2
                    entry['peak'] = max(entry['peak'], rss or 0)
                    # The child may exit between the initial poll and ps.
                    # Reap that outcome normally; missing RSS is a refusal
                    # only while the owned worker is still running.
                    if rss is None and process.poll() is None:
                        reason = 'rss_observation_failed'
                    elif rss is not None and rss > rss_mib * MIB:
                        reason = 'sampled_rss_limit'
                if reason:
                    kill_job(process)
                if process.poll() is None:
                    continue
                # Reap after EOF, so final error output is retained as well.
                try:
                    selector.unregister(process.stdout)
                except KeyError:
                    pass
                tail = process.stdout.read(MIB - entry['log_bytes'])
                entry['log'].write(tail)
                process.stdout.close()
                entry['log'].close()
                status, error, relative, sha = 'failed', reason or f'exit_{process.returncode}', None, None
                if process.returncode == 0 and not reason:
                    path = entry['folder'] / 'result.json'
                    try:
                        relative, sha = path.relative_to(state).as_posix(), digest(read_regular(path, 16 * MIB))
                        verify_result(state, {'id': job_id, 'result_path': relative, 'result_sha256': sha}, plan['plan_sha256'])
                        status, error = 'succeeded', None
                    except (OSError, ValueError, KeyError) as failure:
                        error = str(failure)
                db.execute('UPDATE jobs SET state=?,pid=NULL,result_path=?,result_sha256=?,error=? WHERE id=?',
                           (status, relative, sha, error, job_id))
                db.commit()
                del active[job_id]
            if stop[0] and not active:
                break
            if todo and len(active) < workers and not stop[0]:
                continue  # Refill freed slots before waiting on existing workers.
            if active:
                remaining = min(max(0, timeout - (time.monotonic() - e['at'])) for e in active.values())
                interval = 0.2 if selector.get_map() else 0.001
                for key, _ in selector.select(min(interval, remaining)):
                    entry = active[key.data]
                    data = os.read(key.fileobj.fileno(), 65536)
                    if data:
                        keep = data[:max(0, MIB - entry['log_bytes'])]
                        entry['log'].write(keep)
                        entry['log_bytes'] += len(keep)
                    else:
                        selector.unregister(key.fileobj)
        results = [verify_result(state, row, plan['plan_sha256'])[0]
                   for row in db.execute("SELECT * FROM jobs WHERE state='succeeded' ORDER BY id")]
        states = dict(db.execute('SELECT state,count(*) FROM jobs GROUP BY state').fetchall())
        report = {'version': 1, 'plan_sha256': plan['plan_sha256'], 'host': platform.node(),
                  'python': platform.python_version(), 'sqlite': sqlite3.sqlite_version,
                  'workers': workers, 'wall_ms': (time.perf_counter() - started) * 1000,
                  'parent_cpu_ms': (time.process_time() - parent_cpu) * 1000,
                  'child_cpu_ms_including_startup_and_monitor': 1000 * (
                      resource.getrusage(resource.RUSAGE_CHILDREN).ru_utime - child_usage.ru_utime
                      + resource.getrusage(resource.RUSAGE_CHILDREN).ru_stime - child_usage.ru_stime),
                  'executed_this_run': executed, 'cached': cached, 'states': states,
                  'worker_cpu_ms_saved_results': sum(r['cpu_ms'] for r in results),
                  'max_worker_peak_rss_bytes': max((r['peak_rss_bytes'] for r in results), default=0),
                  'logical_sha256': digest(canonical([(r['job_id'], r['logical_sha256']) for r in results])),
                  'cancelled': stop[0], 'limits': {'wall_seconds_per_job': timeout, 'sampled_rss_mib': rss_mib,
                                                'cpu_seconds_per_worker': math.ceil(timeout), 'file_size_mib': 128}}
        atomic_json(state / 'report.json', report)
        return report
    finally:
        for entry in active.values():
            kill_job(entry['p'])
            entry['p'].stdout.close()
            entry['log'].close()
        selector.close()
        for sig, previous in handlers.items():
            signal.signal(sig, previous)
        if db is not None:
            db.close()
        # Do not unlock while any inherited worker might still be running.
        lock.close()


def search(state, query, limit=10):
    state = Path(state).resolve()
    db = sqlite3.connect((state / 'journal.sqlite').as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    hits = []
    try:
        rows = db.execute("SELECT * FROM jobs WHERE kind='search-index' AND state='succeeded' ORDER BY id").fetchall()
        expected = db.execute("SELECT count(*) FROM jobs WHERE kind='search-index'").fetchone()[0]
        for row in rows:
            _, path = verify_result(state, row)
            index = sqlite3.connect((path.parent / 'index.sqlite').as_uri() + '?mode=ro', uri=True)
            try:
                # Scores from independent shards are not globally comparable.
                for path, snippet in index.execute("SELECT path,snippet(search,1,'[',']',' … ',24) FROM search WHERE search MATCH ? ORDER BY path LIMIT ?", (query, limit)):
                    hits.append({'path': path, 'snippet': snippet})
            finally:
                index.close()
        return {'query': query, 'shards': len(rows), 'hits': sorted(hits, key=lambda r: r['path'])[:limit],
                'expected_shards': expected, 'complete': expected > 0 and len(rows) == expected,
                'order': 'path; no cross-shard relevance ranking'}
    finally:
        db.close()


def verify_run(state):
    state = Path(state).resolve()
    db = sqlite3.connect((state / 'journal.sqlite').as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    try:
        plan = db.execute("SELECT value FROM meta WHERE key='plan'").fetchone()
        rows = db.execute('SELECT * FROM jobs ORDER BY id').fetchall()
        if not plan or not rows or any(row['state'] != 'succeeded' for row in rows):
            raise ValueError('Run is absent or incomplete; verification cannot pass')
        for row in rows:
            verify_result(state, row, plan[0])
        return {'verified_jobs': len(rows), 'states': {'succeeded': len(rows)}, 'complete': True}
    finally:
        db.close()


def benchmark(capsule, output, counts, trials):
    output = Path(output).resolve()
    if output.exists():
        raise ValueError('Use a fresh benchmark output directory')
    output.mkdir(parents=True)
    samples = []
    # Alternating order reduces, but does not remove, warm-cache/order effects.
    for trial in range(trials):
        for count in counts if trial % 2 == 0 else list(reversed(counts)):
            report = run(capsule, output / f'trial-{trial + 1}-workers-{count}', count)
            report['trial'] = trial + 1
            samples.append(report)
            print(json.dumps({'event': 'sample', **report}), flush=True)
            if report['states'] != {'succeeded': sum(report['states'].values())}:
                raise ValueError('Benchmark workload failed; inspect saved journal/logs')
    if len({r['logical_sha256'] for r in samples}) != 1:
        raise ValueError('Logical results differ across concurrency levels')
    report = {'samples': samples, 'logical_results_match': True,
              'limitations': ['Single-host bounded source corpus, not two-laptop speedup.',
                              'Warm-cache and background-load effects remain; short samples are exploratory.',
                              'RSS limit is sampled, not a hard memory sandbox. Fixed workers retain ordinary user file permissions.',
                              'Worker CPU excludes parent/startup; elapsed time includes process startup and RSS observation.']}
    atomic_json(output / 'benchmark.json', report)
    return report


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '_worker':
        worker(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]))
        return
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('plan'); p.add_argument('source'); p.add_argument('output')
    p.add_argument('--max-files', type=int, default=320); p.add_argument('--max-mib', type=int, default=16)
    p.add_argument('--batch-files', type=int, default=16)
    p = sub.add_parser('run'); p.add_argument('capsule'); p.add_argument('state')
    p.add_argument('--workers', type=int, default=2); p.add_argument('--timeout', type=float, default=30)
    p.add_argument('--rss-mib', type=int, default=512)
    p = sub.add_parser('search'); p.add_argument('state'); p.add_argument('query'); p.add_argument('--limit', type=int, default=10)
    p = sub.add_parser('bench'); p.add_argument('capsule'); p.add_argument('output')
    p.add_argument('--workers', default='1,2,4'); p.add_argument('--trials', type=int, default=2)
    p = sub.add_parser('verify'); p.add_argument('state')
    args = parser.parse_args()
    if args.command == 'plan':
        result = plan_source(args.source, args.output, args.max_files, args.max_mib, args.batch_files)
    elif args.command == 'run':
        result = run(args.capsule, args.state, args.workers, args.timeout, args.rss_mib)
    elif args.command == 'search':
        if not 1 <= args.limit <= 100:
            raise ValueError('Search limit must be 1..100')
        result = search(args.state, args.query, args.limit)
    elif args.command == 'verify':
        result = verify_run(args.state)
    else:
        counts = [int(value) for value in args.workers.split(',')]
        if not counts or len(set(counts)) != len(counts) or not all(1 <= n <= 8 for n in counts) or not 1 <= args.trials <= 5:
            raise ValueError('Invalid benchmark matrix')
        result = benchmark(args.capsule, args.output, counts, args.trials)
    print(json.dumps(result, ensure_ascii=False))
    if args.command == 'run' and (result['cancelled'] or any(k != 'succeeded' for k in result['states'])):
        sys.exit(2)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as error:
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        sys.exit(1)
