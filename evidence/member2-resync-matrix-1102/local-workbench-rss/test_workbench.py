import importlib.util
import json
import os
from pathlib import Path
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('workbench.py').resolve()
spec = importlib.util.spec_from_file_location('local_workbench', SCRIPT)
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


class WorkbenchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='local-lab-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        (self.source / 'a.py').write_text('import json\n# restore privacy café\nTODO = 1\n')
        (self.source / 'b.md').write_text('Agents can search local source.\nrestore message agent\n')
        self.capsule = self.root / 'capsule'
        self.state = self.root / 'state'

    def plan(self):
        return lab.plan_source(self.source, self.capsule, batch_files=1)

    def invoke(self, *args, timeout=20):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)],
                              capture_output=True, text=True, timeout=timeout)

    def start(self):
        return subprocess.Popen([sys.executable, str(SCRIPT), 'run', str(self.capsule), str(self.state), '--workers', '1'],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def running_pid(self, parent):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if parent.poll() is not None:
                self.fail('Runner exited before interruption: ' + str(parent.communicate()))
            try:
                with sqlite3.connect(self.state / 'journal.sqlite') as db:
                    row = db.execute("SELECT pid FROM jobs WHERE state='running' AND pid IS NOT NULL LIMIT 1").fetchone()
                    if row:
                        return row[0]
            except sqlite3.Error:
                pass
            time.sleep(0.002)
        self.fail('No owned running worker observed')

    def test_snapshot_search_cache_and_corruption_refusal(self):
        outside = self.root / 'outside.txt'
        outside.write_text('must not enter the snapshot')
        (self.source / 'link.txt').symlink_to(outside)
        hidden = self.source / '.credentials'
        hidden.mkdir()
        (hidden / 'secret.txt').write_text('not selected')
        result = self.plan()
        self.assertEqual(result['files'], 2)
        # Source edits after selection cannot silently alter admitted jobs.
        (self.source / 'a.py').write_text('different original source')
        first = lab.run(self.capsule, self.state, workers=2)
        self.assertEqual(first['states'], {'succeeded': 6})
        hits = lab.search(self.state, 'restore')['hits']
        self.assertEqual([hit['path'] for hit in hits], ['a.py', 'b.md'])
        again = lab.run(self.capsule, self.state, workers=1)
        self.assertEqual(again['executed_this_run'], 0)
        self.assertEqual(again['cached'], 6)
        self.assertEqual(first['logical_sha256'], again['logical_sha256'])
        artifact = next(self.state.rglob('gzip-1.bin'))
        artifact.write_bytes(b'corrupted cached artifact')
        with self.assertRaisesRegex(ValueError, 'Artifact digest mismatch'):
            lab.run(self.capsule, self.state)

    def test_changed_object_refused(self):
        self.plan()
        obj = next((self.capsule / 'objects').iterdir())
        obj.write_bytes(b'tampered snapshot')
        report = lab.run(self.capsule, self.state)
        self.assertGreater(report['states'].get('failed', 0), 0)
        logs = '\n'.join(path.read_text() for path in self.state.rglob('worker.log'))
        self.assertIn('Snapshot object changed', logs)

    def test_timeout_then_resume(self):
        self.plan()
        timed = lab.run(self.capsule, self.state, timeout=0.01)
        self.assertEqual(timed['states'], {'failed': 6})
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            lab.verify_run(self.state)
        self.assertFalse(lab.search(self.state, 'restore')['complete'])
        resumed = lab.run(self.capsule, self.state, timeout=30)
        self.assertEqual(resumed['states'], {'succeeded': 6})
        with sqlite3.connect(self.state / 'journal.sqlite') as db:
            self.assertEqual(db.execute('SELECT min(attempts) FROM jobs').fetchone()[0], 2)
        self.assertTrue(lab.verify_run(self.state)['complete'])

    def test_verification_never_creates_an_empty_passing_journal(self):
        self.state.mkdir()
        with self.assertRaises(sqlite3.OperationalError):
            lab.verify_run(self.state)
        self.assertFalse((self.state / 'journal.sqlite').exists())

    def test_failed_launch_reserves_attempt_and_can_resume(self):
        self.plan()
        with patch.object(lab.subprocess, 'Popen', side_effect=OSError('synthetic failed spawn')):
            with self.assertRaisesRegex(OSError, 'failed spawn'):
                lab.run(self.capsule, self.state)
        with sqlite3.connect(self.state / 'journal.sqlite') as db:
            self.assertEqual(db.execute("SELECT attempts FROM jobs WHERE state='failed'").fetchone()[0], 1)
        self.assertEqual(lab.run(self.capsule, self.state)['states'], {'succeeded': 6})

    def test_worker_exit_during_rss_observation_keeps_verified_success(self):
        self.plan()
        processes = {}
        real_popen = subprocess.Popen

        def launch(*args, **kwargs):
            child = real_popen(*args, **kwargs)
            processes[child.pid] = child
            return child

        def observe_after_exit(pid):
            # A real short worker finishes between poll() and the RSS lookup.
            self.assertEqual(processes[pid].wait(timeout=5), 0)
            return None

        with patch.object(lab.subprocess, 'Popen', side_effect=launch), \
                patch.object(lab, 'sampled_rss', side_effect=observe_after_exit):
            report = lab.run(self.capsule, self.state)
        self.assertEqual(report['states'], {'succeeded': 6})
        self.assertTrue(lab.verify_run(self.state)['complete'])

    def test_missing_rss_for_live_owned_worker_still_refuses(self):
        self.plan()
        real_popen = subprocess.Popen

        def launch_stopped(*args, **kwargs):
            child = real_popen(*args, **kwargs)
            os.kill(child.pid, signal.SIGSTOP)
            return child

        with patch.object(lab.subprocess, 'Popen', side_effect=launch_stopped), \
                patch.object(lab, 'sampled_rss', return_value=None):
            report = lab.run(self.capsule, self.state)
        self.assertEqual(report['states'], {'failed': 6})
        with sqlite3.connect(self.state / 'journal.sqlite') as db:
            self.assertEqual(db.execute('SELECT DISTINCT error FROM jobs').fetchall(),
                             [('rss_observation_failed',)])

    def test_orphan_attempt_directory_is_preserved_on_retry(self):
        self.plan()
        lab.run(self.capsule, self.state)
        with sqlite3.connect(self.state / 'journal.sqlite') as db:
            row = db.execute('SELECT id,result_path FROM jobs ORDER BY id LIMIT 1').fetchone()
            saved = (self.state / row[1]).read_bytes()
            # Model an old crash after directory creation but before its claim.
            db.execute("UPDATE jobs SET state='interrupted',attempts=0,pid=NULL WHERE id=?", (row[0],))
        report = lab.run(self.capsule, self.state)
        self.assertEqual(report['states'], {'succeeded': 6})
        self.assertEqual(report['executed_this_run'], 1)
        self.assertEqual((self.state / row[1]).read_bytes(), saved)
        with sqlite3.connect(self.state / 'journal.sqlite') as db:
            self.assertEqual(db.execute('SELECT attempts FROM jobs WHERE id=?', (row[0],)).fetchone()[0], 2)

    def test_sigterm_stops_owned_workers_and_resumes(self):
        self.plan()
        parent = self.start()
        try:
            child = self.running_pid(parent)
            parent.send_signal(signal.SIGTERM)
            stdout, stderr = parent.communicate(timeout=5)
            self.assertEqual(parent.returncode, 2, stderr)
            self.assertTrue(json.loads(stdout)['cancelled'])
            with self.assertRaises(ProcessLookupError):
                os.kill(child, 0)
            resumed = lab.run(self.capsule, self.state)
            self.assertEqual(resumed['states'], {'succeeded': 6})
        finally:
            if parent.poll() is None:
                parent.kill()
                parent.communicate()

    def test_supervisor_death_retains_worker_lock_and_recovers(self):
        self.plan()
        parent = self.start()
        child = None
        try:
            child = self.running_pid(parent)
            # Freeze only this test's recorded child to make the crash window exact.
            os.kill(child, signal.SIGSTOP)
            parent.kill()
            parent.communicate(timeout=5)
            refused = self.invoke('run', self.capsule, self.state)
            self.assertEqual(refused.returncode, 1)
            self.assertIn('inherited live worker', refused.stderr)
            os.killpg(child, signal.SIGKILL)
            child = None
            deadline = time.monotonic() + 3
            while True:
                resumed = self.invoke('run', self.capsule, self.state)
                if resumed.returncode == 0 or time.monotonic() >= deadline:
                    break
                time.sleep(0.05)
            self.assertEqual(resumed.returncode, 0, resumed.stderr)
            self.assertEqual(json.loads(resumed.stdout)['states'], {'succeeded': 6})
        finally:
            if child is not None:
                try:
                    os.killpg(child, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            if parent.poll() is None:
                parent.kill()
                parent.communicate()


if __name__ == '__main__':
    unittest.main(verbosity=2)
