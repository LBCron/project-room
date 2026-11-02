#!/usr/bin/env python3
"""Finite offline source/evidence handoff; verifies import into a base-only repo."""
import hashlib,json,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=Path('/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102')
GIT='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git'
BASE='00888c52110d36250d3e07629036701b72926d09'
HEADS={'source':'a599faa29ff65567e5c080609cb2d000acd33666','official-sdk-node':'561b7cbaf77a5d8514f763439e0a9fe8d1db5c57','official-sdk-native':'affbd0d9011606e61c7ad318bcc30573be21c6d9','qa2':'df275b8b4907b35e808bc5a97a03b192498a2eed','sponsor-restore':'ebc7e2b4f81f5f1b290c73078a3df523d2e71b90','pending-restore-5k':'3db283f08727b0055dccbbb9ae6c64f61dd27c06','account-recovery':'a5e64d1153b878d808c0e85b8f9b461e0d56e83b'}
OUT=ROOT/'project-room-member2-current-1102.bundle'
def run(a,*,cwd=REPO,data=None,stdout=subprocess.PIPE):
 p=subprocess.run([GIT,*a],cwd=cwd,input=data,stdout=stdout,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError('Git failed '+str(a[:2])+' '+p.stderr.decode(errors='replace')[:800])
 return p.stdout
assert run(['rev-parse','HEAD']).decode().strip()==HEADS['source']
run(['diff','--exit-code','HEAD','--'])
refs={name:'refs/codex-handoff/current-1102/'+name for name in HEADS};created=[]
try:
 for name,sha in HEADS.items():
  run(['merge-base','--is-ancestor',BASE,sha]);run(['update-ref',refs[name],sha,'0'*40]);created.append(name)
 run(['bundle','create',str(OUT),*refs.values(),'^'+BASE])
finally:
 for name in created:run(['update-ref','-d',refs[name],HEADS[name]])
listed=dict(line.split(' ',1)[::-1] for line in run(['bundle','list-heads',str(OUT)]).decode().splitlines())
assert listed=={refs[n]:sha for n,sha in HEADS.items()}
trees={n:run(['rev-parse',sha+'^{tree}']).decode().strip() for n,sha in HEADS.items()}
with tempfile.TemporaryDirectory(prefix='member2-current-base-only-') as name:
 root=Path(name);bare=root/'review.git';run(['init','--bare',str(bare)],cwd=root);prefix=['--git-dir='+str(bare)]
 pack=root/'base-tree.pack'
 with pack.open('wb') as f:run(['pack-objects','--stdout','--revs','--threads=2'],data=(BASE+'^{tree}\n').encode(),stdout=f)
 with pack.open('rb') as f:
  p=subprocess.run([GIT,*prefix,'index-pack','--stdin'],cwd=root,stdin=f,capture_output=True);assert p.returncode==0
 assert run([*prefix,'hash-object','-w','-t','commit','--stdin'],cwd=root,data=run(['cat-file','commit',BASE])).decode().strip()==BASE
 (bare/'shallow').write_text(BASE+'\n');run([*prefix,'update-ref','refs/heads/base',BASE],cwd=root);run([*prefix,'symbolic-ref','HEAD','refs/heads/base'],cwd=root)
 for sha in HEADS.values():assert subprocess.run([GIT,*prefix,'cat-file','-e',sha],cwd=root,capture_output=True).returncode!=0
 run([*prefix,'bundle','verify',str(OUT)],cwd=root)
 run([*prefix,'-c','maintenance.auto=false','-c','gc.auto=0','fetch','--no-tags',str(OUT),*[refs[n]+':refs/heads/review/'+n for n in HEADS]],cwd=root)
 for n,sha in HEADS.items():
  assert run([*prefix,'rev-parse','refs/heads/review/'+n,'refs/heads/review/'+n+'^{tree}'],cwd=root).decode().splitlines()==[sha,trees[n]]
 run([*prefix,'fsck','--full','--no-reflogs'],cwd=root)
 receipt={'schema':'member2-current-offline-handoff-v1','base':BASE,'heads':HEADS,'trees':trees,'refs':refs,'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'baseTreePackBytes':pack.stat().st_size,'allSevenHeadsAbsentBeforeImport':True,'allSevenImportedCommitsAndTreesEqual':True,'fullFsckPassed':True,'networkUsed':False,'scope':'Local same-device import only. No peer transfer, execution, merge, deployment, or all-green release claim.'}
(ROOT/'current-handoff-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
