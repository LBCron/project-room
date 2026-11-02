// Run the checkout's actual offer HTTP suite with its room fixture switched to
// normalized storage. The checkout itself is never modified.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { repo: { type: 'string' }, source: { type: 'string' }, git: { type: 'string', default: 'git' } } });
if (!values.repo || !/^[a-f0-9]{40}$/.test(values.source ?? '')) throw Error('Usage: node run-normalized-offer-http.mjs --repo PATH --source FULL_SHA [--git PATH]');
const repo = resolve(values.repo), git = values.git;
const assertSource = () => {
  if (execFileSync(git, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== values.source) throw Error('Unexpected source revision');
  execFileSync(git, ['-C', repo, 'diff', '--exit-code', 'HEAD', '--']);
};
assertSource();
let source = readFileSync(join(repo, 'tests/project-offers-http.test.js'), 'utf8');
const replaceExactly = (oldText, newText) => {
  if (source.split(oldText).length !== 2) throw Error(`Expected exactly one source pattern: ${oldText}`);
  source = source.replace(oldText, newText);
};
replaceExactly('store.initialize(initialRoom());', "store.initialize(initialRoom(), { representation: 'normalized-current-v1' });");
for (const name of ['store.mjs', 'bootstrap.mjs', 'http.mjs']) {
  replaceExactly(`'../server/${name}'`, JSON.stringify(pathToFileURL(join(repo, 'server', name)).href));
}
const temp = mkdtempSync(join(tmpdir(), 'normalized-offer-http-'));
try {
  const file = join(temp, 'normalized-offer-http.test.mjs'); writeFileSync(file, source);
  const result = spawnSync(process.execPath, ['--test', file], { cwd: repo, stdio: 'inherit' });
  if (result.error) throw result.error;
  assertSource();
  process.exitCode = result.status ?? 1;
} finally { rmSync(temp, { recursive: true, force: true }); }
