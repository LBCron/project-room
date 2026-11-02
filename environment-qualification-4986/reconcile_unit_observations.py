"""Reconcile only observed cases. Never turn partial reruns into full-suite green."""
from pathlib import Path
import json,xml.etree.ElementTree as E,hashlib
from collections import Counter
root=Path(__file__).resolve().parent

def read_cases(relative):
 path=root/relative;raw=path.read_bytes();result={}
 for c in E.fromstring(raw).iter('testcase'):
  key=(c.attrib['file'],c.attrib['name'])
  result.setdefault(key,[]).append(c.find('failure') is not None)
 return result,hashlib.sha256(raw).hexdigest()
full,full_sha=read_cases('full-unit-4986/junit.xml')
python,python_sha=read_cases('failed-unit-4986/junit.xml')
env,env_sha=read_cases('environment-unit-4986/junit.xml')
initial=Counter({k:sum(v) for k,v in full.items() if any(v)})
middle=Counter({k:sum(v) for k,v in python.items() if any(v)})
assert not (middle-initial),'New failures appeared in corrected-Python run'
assert not any(any(v) for v in env.values()),'Environment rerun has failures'
env_counts=Counter({k:len(v) for k,v in env.items()})
cleared=middle&env_counts;remaining=middle-env_counts
assert initial.total()==116 and middle.total()==110 and cleared.total()==102 and remaining.total()==8
receipt=json.loads((root/'environment-unit-4986/receipt.json').read_text());assert receipt['status']==0 and receipt['trackedDiff']==[]
report={'source':receipt['source'],'initialFailedCases':initial.total(),'pythonRerunFailedCases':middle.total(),'environmentRerun':{'files':len(receipt['files']),'tests':sum(map(len,env.values())),'pass':sum(map(len,env.values())),'fail':0,'elapsedMs':receipt['elapsedMs'],'trackedDiff':receipt['trackedDiff']},'clearedMissingToolFailures':cleared.total(),'remainingOnOriginalCandidate':[{'file':str(Path(k[0]).relative_to('/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-body-driver-composed-1102')),'name':k[1],'count':remaining[k]} for k in sorted(remaining)],'junitSha256':{'full':full_sha,'pythonRerun':python_sha,'environmentRerun':env_sha},'limitation':'Historical full run failed. This is case-level reconciliation of targeted observations on unchanged4986; not a fresh full-suite run or green release qualification. Generated-record repair56c1 was qualified separately.'}
(root/'unit-observation-reconciliation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
