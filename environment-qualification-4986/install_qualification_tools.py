"""Install two pinned real tools locally; no lifecycle scripts or global configuration."""
from pathlib import Path
import urllib.request,hashlib,base64,zipfile,tarfile,io,json,os,platform,sys
assert sys.platform=='darwin' and platform.machine()=='arm64','Pinned gh build requires macOS arm64'
root=Path(__file__).resolve().parent/'qualification-tools';root.mkdir(exist_ok=True)
manifest=[{'name':'gh','version':'2.103.3','url':'https://github.com/cli/cli/releases/download/v2.103.3/gh_2.103.3_macOS_arm64.zip','sha256':'d700207eae9ae98fe2b89535c2c087c07823d4628c56364695a5a07ef311c062'}, {'name':'npm','version':'11.6.2','url':'https://registry.npmjs.org/npm/-/npm-11.6.2.tgz','sha512Base64':'7iKzNfy8lWYs3zq4oFPa8EXZz5xt9gQNKJZau3B1ErLBb6bF7sBJ00x09485DOvRT2l5Gerbl3VlZNT57MxJVA=='}]
receipts=[]
for tool in manifest:
 req=urllib.request.Request(tool['url'],headers={'User-Agent':'Project-Room-local-qualification'})
 with urllib.request.urlopen(req,timeout=30) as f:data=f.read(40000001)
 assert len(data)<=40000000,'download too large'
 if 'sha256' in tool:assert hashlib.sha256(data).hexdigest()==tool['sha256']
 else:assert base64.b64encode(hashlib.sha512(data).digest()).decode()==tool['sha512Base64']
 dest=root/(tool['name']+'-'+tool['version']);dest.mkdir(exist_ok=False)
 if tool['name']=='gh':
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   names=[n for n in z.namelist() if n.endswith('/bin/gh')];assert len(names)==1
   target=dest/'gh';target.write_bytes(z.read(names[0]));target.chmod(0o755)
 else:
  with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:t.extractall(dest,filter='data')
  assert json.loads((dest/'package/package.json').read_text())['version']==tool['version']
  target=dest/'package/bin/npm-cli.js';target.chmod(0o755)
 bindir=root/'bin';bindir.mkdir(exist_ok=True);link=bindir/tool['name'];assert not link.exists() and not link.is_symlink();link.symlink_to(os.path.relpath(target,bindir))
 receipts.append({**tool,'downloadBytes':len(data),'verified':True,'executable':str(target),'executableSha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(root/'install-receipt.json').write_text(json.dumps({'tools':receipts,'scope':'Local workbench only; no auth, global install or lifecycle scripts'},indent=2)+'\n')
print(json.dumps({'installed':[r['name'] for r in receipts],'bin':str(bindir)}))
