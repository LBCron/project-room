"""Finite actual artifact and semantic negative controls for the read-only indexer."""
import copy,json,shutil,tempfile
from pathlib import Path
from audit_current_support import audit,outcome
ROOT=Path(__file__).resolve().parent
REPO=Path('/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102')
GIT='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git'
CATALOG=ROOT/'current_support_packets.json'
controls=[]
result=audit(ROOT,REPO,GIT,CATALOG);assert result['verifiedArtifacts']==42 and result['counts']=={'scoped-pass':5,'reproduced-gap':2,'observed-gap':2};assert result['releaseReadyEstablished'] is False
controls.append({'name':'real nine-packet42-artifact audit','passed':True})
with tempfile.TemporaryDirectory(prefix='member2-support-negative-') as d:
 target=Path(d)
 for spec in json.loads(CATALOG.read_text()):
  if 'folder' in spec:shutil.copytree(ROOT/spec['folder'],target/spec['folder'])
  else:
   for name in spec['files']:shutil.copyfile(ROOT/name,target/name)
 path=target/'canonical-roles-evidence/canonical-work-roles-http-receipt.json';original=path.read_bytes();r=json.loads(original);r['pass']=0;path.write_text(json.dumps(r))
 try:audit(target,REPO,GIT,CATALOG)
 except ValueError as e:assert 'Artifact bytes differ' in str(e)
 else:raise AssertionError('Modified receipt was accepted')
 controls.append({'name':'modified local receipt refused against Git bytes','passed':True});path.write_bytes(original)
 (target/'fresh-room-browser-evidence/phone-settings.png').unlink()
 try:audit(target,REPO,GIT,CATALOG)
 except FileNotFoundError:pass
 else:raise AssertionError('Missing screenshot was accepted')
 controls.append({'name':'missing published screenshot refused','passed':True})
r=json.loads((ROOT/'fresh-room-browser-evidence/receipt.json').read_text());changed=copy.deepcopy(r);changed['observations'][0]['assistantSetupVisible']=True
try:outcome('browser',changed)
except ValueError as e:assert 'Browser observation changed' in str(e)
else:raise AssertionError('Changed browser capability silently retained gap classification')
controls.append({'name':'changed capability observation requires explicit reclassification','passed':True})
report={'controls':controls,'passed':len(controls),'failed':0,'scope':'Indexer artifact/receipt truthfulness checks, not additional runtime/MVP qualification.'}
(ROOT/'current-support-audit-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
