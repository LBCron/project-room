#!/usr/bin/env python3
"""Build one incremental handoff and prove import into a base-only local repository."""
import argparse,hashlib,json,subprocess,tempfile
from pathlib import Path
from candidate_evidence_audit import BASE,CANDIDATE
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('checkout',type=Path);parser.add_argument('--git',default='git');parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent/'project-room-member2-4986.bundle');args=parser.parse_args()
GIT=args.git;REPO=args.checkout.resolve();OUT=args.output.resolve()
REF='refs/codex-handoff/member2-4986'
def run(args,*,data=None,cwd=REPO,stdout=subprocess.PIPE):
 p=subprocess.run([GIT,*args],cwd=cwd,input=data,stdout=stdout,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError('Git operation failed: '+str(args[:2])+' '+p.stderr.decode(errors='replace')[:1000])
 return p.stdout
run(['update-ref',REF,CANDIDATE,'0'*40])
try:run(['bundle','create',str(OUT),REF,'^'+BASE])
finally:run(['update-ref','-d',REF,CANDIDATE])
heads=run(['bundle','list-heads',str(OUT)]).decode().strip();assert heads==CANDIDATE+' '+REF
with tempfile.TemporaryDirectory(prefix='member2-base-only-import-')as name:
 root=Path(name);bare=root/'review.git';run(['init','--bare',str(bare)],cwd=root);prefix=['--git-dir='+str(bare)]
 # Import only the prerequisite's exact tree, not the existing candidate objects.
 pack=root/'base-tree.pack'
 with pack.open('wb')as f:run(['pack-objects','--stdout','--revs','--threads=2'],data=(BASE+'^{tree}\n').encode(),stdout=f)
 with pack.open('rb')as f:
  p=subprocess.run([GIT,*prefix,'index-pack','--stdin'],cwd=root,stdin=f,capture_output=True);assert p.returncode==0,p.stderr.decode()
 commit=run(['cat-file','commit',BASE]);assert run([*prefix,'hash-object','-w','-t','commit','--stdin'],data=commit,cwd=root).decode().strip()==BASE
 (bare/'shallow').write_text(BASE+'\n');run([*prefix,'update-ref','refs/heads/base',BASE],cwd=root);run([*prefix,'symbolic-ref','HEAD','refs/heads/base'],cwd=root)
 missing=subprocess.run([GIT,*prefix,'cat-file','-e',CANDIDATE],cwd=root,capture_output=True);assert missing.returncode!=0
 run([*prefix,'bundle','verify',str(OUT)],cwd=root)
 run([*prefix,'-c','maintenance.auto=false','-c','gc.auto=0','fetch','--no-tags',str(OUT),REF+':refs/heads/review/member2-4986'],cwd=root)
 imported=run([*prefix,'rev-parse','refs/heads/review/member2-4986','refs/heads/review/member2-4986^{tree}'],cwd=root).decode().splitlines();assert imported[0]==CANDIDATE
 expected=run(['rev-parse',CANDIDATE+'^{tree}']).decode().strip();assert imported[1]==expected
 run([*prefix,'fsck','--full','--no-reflogs'],cwd=root)
 receipt={'schema':'member2-offline-bundle-import-v1','base':BASE,'candidate':CANDIDATE,'tree':expected,'bundleRef':REF,'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'baseTreePackBytes':pack.stat().st_size,'candidateAbsentBeforeImport':True,'importedIntoBaseOnlyRepository':True,'fullFsckPassed':True,'networkUsed':False,'temporaryImportRepositoryRemoved':True,'scope':'Actual local same-device source import; not peer transfer, peer execution or deploy evidence.'}
(OUT.parent/'candidate-bundle-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
