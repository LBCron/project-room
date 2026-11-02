#!/usr/bin/env python3
"""Finite read-only audit of this specific Project Room handoff; never reruns tests."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import shlex
from audit_evidence import read_inside, strict_json, check_hash, require

BASE='00888c52110d36250d3e07629036701b72926d09'
CANDIDATE='4986df689a1773e4162f7c686667a02f15f18c4c'
CHAIN=['aec29ee1275db508070f4bfbfd902f207469fcd8','255816cbd7de046e4352b95e05a5a9a606f9f62c','1785f8e970c8b0be0e5afc233e4a98ac91e5a424','308a5a910ac6c9febe8ffb708932075b3cf2a1f1',CANDIDATE]
PACKETS=[
 ('access-request-pages-aec29-evidence','access-request-pages-aec29-verified.json','access-request-pages-aec29'),
 ('access-request-native-upgrade-evidence','access-request-native-upgrade-verified.json','access-request-native-upgrade'),
 ('oauth-route-name-evidence','oauth-route-name-verified.json','oauth-route-name'),
 ('native-restore-kv-evidence','native-restore-kv-verified.json','native-restore-kv'),
 ('native-body-driver-evidence','native-body-driver-verified.json','native-body-driver'),
]
TEST_ONLY={'cloudflare/package.json','cloudflare/restore-body-native.check.mjs','cloudflare/restore-body-native.test-fixture.mjs','tests/helpers/recovery-report-progress.mjs','tests/recovery-report-progress.test.mjs'}

def git(repo,binary,*args):
 p=subprocess.run([binary,'-C',str(repo),*args],capture_output=True)
 require(p.returncode==0,'Git object read failed: '+str(args[:2]))
 return p.stdout

def js(root,path):
 return strict_json(read_inside(root,root/path).decode())

def verify_packet(root,repo,binary,folder,verification,suffix):
 v=js(root,verification);commit=v.get('commit');require(re.fullmatch('[a-f0-9]{40}',commit or ''),'Evidence commit required')
 tree=git(repo,binary,'rev-parse',commit+'^{tree}').decode().strip();require(tree==v.get('tree'),'Evidence tree differs')
 files=v.get('files');require(isinstance(files,list)and files,'Verified evidence file list required');seen=set();total=0
 for item in files:
  name=item.get('path');require(isinstance(name,str)and re.fullmatch(r'[A-Za-z0-9_.-]+',name)and name not in seen,'Unsafe or duplicate evidence path');seen.add(name)
  raw=read_inside(root,root/folder/name);check_hash(raw,item.get('sha256'),name)
  remote=git(repo,binary,'show',commit+':evidence/member2-resync-matrix-1102/'+suffix+'/'+name)
  require(remote==raw,'Local artifact differs from published Git blob: '+name);total+=len(raw)
 actual={p.name for p in(root/folder).iterdir()if p.is_file()};require(actual==seen,'Packet inventory differs from published verification')
 return{'folder':folder,'evidenceCommit':commit,'evidenceTree':tree,'files':len(files),'bytes':total,'allLocalHashesAndGitBlobsMatch':True}

def spec(root,folder,name,passed):
 text=read_inside(root,root/folder/name).decode();p=re.findall(r'^ℹ pass (\d+)$',text,re.M);f=re.findall(r'^ℹ fail (\d+)$',text,re.M)
 require(p and int(p[-1])==passed and f and int(f[-1])==0,'Spec test summary differs: '+name)
 return{'log':folder+'/'+name,'passed':passed,'failed':0}

def diagnostic(root,folder,name,prefix):
 rows=[strict_json(x[len(prefix):])for x in read_inside(root,root/folder/name).decode().splitlines()if x.startswith(prefix)]
 require(len(rows)==1,'Need exactly one terminal diagnostic: '+name);return rows[0]

def audit(root,repo,binary):
 root=root.resolve();git(repo,binary,'diff','--exit-code','HEAD','--');head=git(repo,binary,'rev-parse','HEAD').decode().strip();require(head==CANDIDATE or git(repo,binary,'rev-parse','HEAD^{tree}').decode().strip()==git(repo,binary,'rev-parse',CANDIDATE+'^{tree}').decode().strip(),'Checkout differs from expected candidate tree')
 observed=git(repo,binary,'rev-list','--reverse',BASE+'..'+CANDIDATE).decode().splitlines();require(observed==CHAIN,'Candidate commit chain differs')
 parent=BASE
 for commit in CHAIN:
  parents=git(repo,binary,'show','-s','--format=%P',commit).decode().strip().split();require(parents==[parent],'Candidate has unexpected parent');parent=commit
 main=git(repo,binary,'rev-parse','origin/main').decode().strip();merged=subprocess.run([binary,'-C',str(repo),'merge-base','--is-ancestor',CANDIDATE,main],capture_output=True).returncode;require(merged in(0,1),'Cannot compare main ancestry')
 packets=[verify_packet(root,repo,binary,*args)for args in PACKETS]
 source_bindings=[]
 for folder,pairs,manifest_commit in [
  ('access-request-pages-aec29-evidence',[('source','tree')],CHAIN[0]),
  ('oauth-route-name-evidence',[('standaloneCommit','standaloneTree'),('composedCommit','composedTree')],None),
  ('native-restore-kv-evidence',[('standaloneCommit','standaloneTree'),('publishedComposition','publishedCompositionTree'),('sourceAfter','treeAfter')],'dff5d160e39eeef737d4d73edc5c395ee54b66b8'),
  ('native-body-driver-evidence',[('standaloneCommit','standaloneTree'),('composedCommit','composedTree')],'bdee803d4fa2ee3db225f5b6b07b04ab411737a9'),
 ]:
  record=js(root,folder+'/receipt.json')
  for commit_key,tree_key in pairs:
   commit,tree=record[commit_key],record[tree_key];require(git(repo,binary,'rev-parse',commit+'^{tree}').decode().strip()==tree,'Recorded code tree differs: '+folder)
   source_bindings.append({'packet':folder,'commit':commit,'tree':tree,'gitTreeMatches':True})
  manifest=root/folder/'source-manifest.json'
  if manifest_commit and manifest.exists():
   for item in strict_json(read_inside(root,manifest).decode()):check_hash(git(repo,binary,'show',manifest_commit+':'+item['path']),item['sha256'],'Source '+item['path'])
 delta=git(repo,binary,'diff','--name-only',CHAIN[-2],CANDIDATE).decode().splitlines();require(set(delta)==TEST_ONLY,'Latest step is not the expected test-only change')
 aec_delta=git(repo,binary,'diff','--name-only',CHAIN[0],CANDIDATE,'--','server','src','client','strings').decode().splitlines();require(set(aec_delta)=={'server/http.mjs','server/recovery-engine-continuation.mjs'},'Unexpected production change since queue qualification')
 for source,path in [('936f86fd5a0c65287d4f41a1c1bc20aa1b77f46a','server/http.mjs'),('dff5d160e39eeef737d4d73edc5c395ee54b66b8','server/recovery-engine-continuation.mjs')]:
  require(git(repo,binary,'rev-parse',source+':'+path)==git(repo,binary,'rev-parse',CANDIDATE+':'+path),'Independently qualified production fix differs')
 package=lambda sha:strict_json(git(repo,binary,'show',sha+':cloudflare/package.json').decode())
 before,after=package(BASE),package(CANDIDATE);old=shlex.split(before['scripts'].pop('test'));new=shlex.split(after['scripts'].pop('test'));require(old[:2]==new[:2]==['node','--test'],'Unexpected Native runner shape');require(before==after,'Native package changed outside test registration');require(len(new[2:])==len(set(new[2:])),'Duplicate Native registrations');require(set(old[2:])<=set(new[2:]),'Existing Native test registration lost');require(set(new[2:])-set(old[2:])=={'access-request-pages.check.mjs','recovery-native-kv.check.mjs','restore-body-native.check.mjs'},'Unexpected Native test addition')
 checks=[]
 for folder,name,count in [('access-request-pages-aec29-evidence','contract.log',210),('access-request-pages-aec29-evidence','browser.log',4),('access-request-pages-aec29-evidence','native.log',1),('oauth-route-name-evidence','route-tests.log',25),('oauth-route-name-evidence','consent-tests.log',28),('native-restore-kv-evidence','native-engine-after.log',1),('native-restore-kv-evidence','neighbors.log',15),('native-restore-kv-evidence','composed-check.log',15),('native-body-driver-evidence','standalone-native.log',1),('native-body-driver-evidence','composed-native.log',1),('native-body-driver-evidence','guard-finalization.log',5),('native-body-driver-evidence','composed-guards.log',2)]:checks.append(spec(root,folder,name,count))
 upgrade=diagnostic(root,'access-request-native-upgrade-evidence','native.log','ACCESS_REQUEST_NATIVE_UPGRADE ');require(upgrade['sourceAfter']==CHAIN[0]and len(upgrade['coldOpens'])==2 and all(x['unique']==1000 and x['pages']==40 and x['originalCredentialsAccepted']and x['requestsUnchanged']for x in upgrade['coldOpens']),'Upgrade coverage differs')
 restore=diagnostic(root,'native-restore-kv-evidence','strict-restore-after.log','ACCESS_REQUEST_NATIVE_RESTORE ');require(restore['treeAfter']==git(repo,binary,'rev-parse',CHAIN[-2]+'^{tree}').decode().strip(),'Restore tested tree differs');require(restore['restore']['verified']and restore['restore']['auditOk']and restore['restore']['cleanupComplete']and restore['admissionClear']and restore['restoreSourceKvClean']and restore['originalCredentialsPreserved']and restore['restoredRowsUnchanged']and restore['queue']['unique']==1000 and restore['queue']['zeroWrites'],'Full restore evidence incomplete')
 body=diagnostic(root,'native-body-driver-evidence','composed-native.log','RESTORE_BODY_NATIVE ');require(body['steps']==732 and body['largeBlobBytes']==1048576 and body['reportProgress']['preReportCalls']==330 and body['reportProgress']['reportCalls']==401 and body['reportProgress']['publicationCalls']==1 and body['verified']and body['coldReady']and body['exactRetry'],'Body driver evidence differs')
 return{'schema':'member2-candidate-evidence-audit-v1','candidate':CANDIDATE,'candidateTree':git(repo,binary,'rev-parse',CANDIDATE+'^{tree}').decode().strip(),'base':BASE,'observedMain':main,'mergedIntoObservedMain':merged==0,'linearChain':CHAIN,'changedFiles':git(repo,binary,'diff','--name-only',BASE,CANDIDATE).decode().splitlines(),'packets':packets,'verifiedArtifactFiles':sum(p['files']for p in packets),'testSummaries':checks,'sourceBindings':source_bindings,'productionChangesSinceQueueEvidence':aec_delta,'latestChangeTestOnly':delta,'nativeRegistration':{'base':len(old)-2,'candidate':len(new)-2,'priorEntriesPreserved':True,'duplicates':0},'coverage':{'queueApiUi':'Original aec29 qualification retained; target API/UI files identical. Two later production fixes are separately identified, not silently retargeted.','latestRuntimeCi':'Full local CI mode check passed on308a5a9; all five later changes are test-only. Latest full-repository CI was not rerun.','fullRestore':'Exact production tree308a5a9 and same runtime content in latest candidate;1000requests,coldresume,fullaudit,cleanup and credentials.','latestNativeBody':'Directly tested latest candidate tree;650messages,1MiB,732steps and negative guard controls.'},'limits':['Read-only consistency audit, not new runtime execution or artifact authenticity proof.','Saved passing counts overlap; do not sum them as unique test coverage.','No hosted CI, PR review, peer execution, device utilization or deployment verified here.']}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('evidence_root',type=Path);p.add_argument('checkout',type=Path);p.add_argument('--git',required=True);a=p.parse_args()
 try:print(json.dumps(audit(a.evidence_root,a.checkout,a.git),indent=2))
 except(ValueError,KeyError,TypeError)as e:raise SystemExit('Candidate evidence audit refused: '+str(e))
