#!/usr/bin/env python3
"""Project Room a599 support-packet consistency audit. Reads only; runs no tests/network."""
import argparse,hashlib,json,subprocess
from pathlib import Path
PIN='a599faa29ff65567e5c080609cb2d000acd33666'
BASE='00888c52110d36250d3e07629036701b72926d09'
def require(value,message):
 if not value:raise ValueError(message)
def git(repo,binary,*args):
 p=subprocess.run([binary,'-C',str(repo),*args],capture_output=True)
 require(p.returncode==0,'Git object read failed: '+str(args[:2]));return p.stdout

def outcome(kind,r):
 if kind=='sdk':require(r['coldReconnect'] and r['exactRetryAddsNoEvent'] and r['revokedHttpStatus']==401,'SDK receipt differs');return 'scoped-pass','Official SDK on local Native: cold reconnect, no duplicate, revocation401.'
 if kind=='isolation':require(r['agents']==2 and r['rooms']==2 and r['mixedHttpStatuses']==[200,401] and r['crossedCallsAddNoEvents'],'Isolation receipt differs');return 'scoped-pass','Two actual SDK agents on local Native; simultaneous submission, no forced internal interleaving.'
 if kind=='capacity':require(len(r['cases'])==11 and r['finalRecoveryAudit'] and r['noLegacyMirrorRows'],'Capacity receipt differs');return 'scoped-pass','Local HTTP small configured cap boundaries; no default1000/20 scale claim.'
 if kind=='roles':require(r['total']==r['pass']==54 and r['allowed']==10 and r['refused']==44 and r['actualShareLinkGuest'],'Roles receipt differs');return 'scoped-pass','Local HTTP54role/action cells; no delegation/autonomy/Native claim.'
 if kind=='crash':require(r['actualSigkillCount']==3 and r['serverProcessStarts']==4 and len(r['cells'])==3 and all(c['exactRetryAddsNoWrite'] for c in r['cells']),'Crash receipt differs');return 'scoped-pass','Local fileSQLite/Node actual SIGKILL after commit; no power-loss/Native claim.'
 if kind=='charter':
  rows=r['observations'];require(rows[0]['currentReadStatus']==200 and rows[1]['currentReadStatus']==409 and rows[1]['activationPackHasInstructions'],'Charter gap changed');return 'reproduced-gap','Normalized standalone charter read409; legacy200 and activation pack retains instructions.'
 if kind=='pin':
  rows=r['observations'];require(len(rows)==4 and rows[1]['pinStatus']==409 and rows[3]['initialPinEventPresent'] and not rows[3]['pinnedResourcePresent'],'Pin gap changed');return 'reproduced-gap','Normalized pin409 and preexisting pin omitted from activation context; no trust bypass/event-erasure claim.'
 if kind=='sections':require(all(all(x['sections'][k]['available'] is False for k in ['assistant','updates','returnBrief','notifications','requestRuns']) for x in r['observations'][1:]),'Section declarations changed');return 'observed-gap','Fresh human/agent HTTP room windows declare five unavailable sections; source-only UI guard.'
 if kind=='browser':require(len(r['observations'])==2 and all(not x['assistantSetupVisible'] and x['updatesUnavailableNoticeVisible'] and x['pageErrors']==[] for x in r['observations']),'Browser observation changed');return 'observed-gap','Actual local desktop/phone fresh signup; hidden setup/unavailable Updates, not assistant-readiness pass.'
 raise ValueError('Unknown packet kind')

def audit(root,repo,binary,catalog):
 root=root.resolve();require(git(repo,binary,'rev-parse','HEAD').decode().strip()==PIN,'Checkout pin differs');git(repo,binary,'diff','--exit-code','HEAD','--')
 specs=json.loads(catalog.read_text());require(len(specs)==9 and len({s['id'] for s in specs})==9,'Expected nine unique current packets');packets=[];artifacts=0
 for spec in specs:
  commit,prefix=spec['commit'],spec['prefix'];require(git(repo,binary,'show','-s','--format=%P',commit).decode().strip()==PIN,'Evidence parent differs: '+spec['id'])
  paths=git(repo,binary,'ls-tree','-r','--name-only',commit,'--',prefix+'/').decode().splitlines();require(paths,'Empty packet')
  changes=git(repo,binary,'diff','--name-only',PIN,commit).decode().splitlines();require(set(paths)==set(changes),'Evidence contains unexpected app/runtime changes')
  observed=[];receipt=None
  for path in paths:
   name=path[len(prefix)+1:];require(name and '/' not in name,'Unexpected nested artifact')
   if 'files' in spec:require(name in spec['files'],'Unexpected local artifact');local=root/name
   else:local=root/spec['folder']/name
   require(local.resolve().is_relative_to(root),'Artifact escapes root');content=local.read_bytes();require(content==git(repo,binary,'show',commit+':'+path),'Artifact bytes differ: '+spec['id']+'/'+name)
   observed.append({'name':name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
   if name==spec['receipt']:receipt=json.loads(content)
  require(receipt is not None and receipt['source']==PIN,'Missing/mismatched primary receipt source');status,scope=outcome(spec['kind'],receipt);artifacts+=len(observed)
  packets.append({'id':spec['id'],'evidenceCommit':commit,'evidenceTree':git(repo,binary,'rev-parse',commit+'^{tree}').decode().strip(),'status':status,'scope':scope,'url':'https://github.com/Uuriko/project-room/tree/'+commit+'/'+prefix,'artifacts':observed})
 main=git(repo,binary,'rev-parse','FETCH_HEAD').decode().strip();merged=subprocess.run([binary,'-C',str(repo),'merge-base','--is-ancestor',PIN,main],capture_output=True).returncode
 require(merged in [0,1],'Cannot determine ancestry')
 return {'schema':'member2-current-support-index-v1','testedSource':PIN,'sourceTree':git(repo,binary,'rev-parse',PIN+'^{tree}').decode().strip(),'base':BASE,'observedFetchHead':main,'candidateAncestorOfObservedFetchHead':merged==0,'packets':packets,'verifiedArtifacts':artifacts,'counts':{k:sum(p['status']==k for p in packets) for k in ['scoped-pass','reproduced-gap','observed-gap']},'releaseReadyEstablished':False,'peerExecutionEstablished':False,'limits':['Byte/commit/receipt consistency only; no new runtime execution or independent authenticity proof.','Passing evidence scopes overlap; counts must not be added as unique tests.','Full suite, review, merge, deployment and physical device utilization remain separate and unproven.']}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('evidence_root',type=Path);p.add_argument('checkout',type=Path);p.add_argument('--git',required=True);p.add_argument('--catalog',type=Path,default=Path(__file__).with_name('current_support_packets.json'));a=p.parse_args()
 try:print(json.dumps(audit(a.evidence_root,a.checkout,a.git,a.catalog),indent=2))
 except (ValueError,KeyError,TypeError,OSError) as e:raise SystemExit('Support audit refused: '+str(e))
