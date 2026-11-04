import assert from 'node:assert/strict';
import {readdirSync,readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve('.tmp/unpacked/package'),home=resolve('.tmp/absent-credential-home');
assert.equal(existsSync(home),false);
const files=readdirSync(join(root,'src')).filter(x=>x.endsWith('.mjs')).sort();
for(const name of ['cloud-notify.mjs','notification-receiver.mjs','private-state.mjs','private-files.mjs'])assert.ok(files.includes(name),name);
for(const name of files){await import(pathToFileURL(join(root,'src',name)));assert.deepEqual(readFileSync(join(root,'src',name)),readFileSync(join('room-acp/src',name)));}
console.log(JSON.stringify({phase:'import-closure',modules:files.length,allPackedSourcesMatch:true,node:process.version}));
for(const args of [['--help'],['run','--receiver-policy','disabled'],['run','--receiver-policy','notify-cloud']]){
 const r=spawnSync(process.execPath,[join(root,'src/cli.mjs'),...args],{env:{PATH:'/nonexistent',ROOM_ACP_HOME:home},encoding:'utf8',timeout:10000});
 assert.equal(r.status,args.at(-1)==='notify-cloud'?2:0);assert.equal(existsSync(home),false);console.log(JSON.stringify({phase:'cli',args,status:r.status,stdout:r.stdout,stderr:r.stderr,credentialHomeCreated:false}));
}
const {receiveCloudNotifications}=await import(pathToFileURL(join(root,'src/notification-receiver.mjs')));
let network=0,providers=0,journals=0,connectionReads=0;
const bad=resolve('.tmp/invalid-notification.json');writeFileSync(bad,'{"unexpected":true}',{mode:0o600});
for(const configFile of [undefined,resolve('.tmp/missing-config.json'),bad]){
 let message;
 await assert.rejects(receiveCloudNotifications({configFile,connection:new Proxy({},{get(){connectionReads++;throw Error('Connection must not be accessed');}}),env:{ROOM_ACP_HOME:home},fetchImpl:()=>{network++;throw Error('No network');},notifierFactory:()=>{providers++;throw Error('No provider');},openReceipt:()=>{journals++;throw Error('No journal');}}),e=>{message=e.message;return /valid private notification config/.test(message);});
 console.log(JSON.stringify({phase:'config-refusal',case:configFile===undefined?'absent':configFile===bad?'invalid':'missing-file',message}));
}
assert.deepEqual({network,providers,journals,connectionReads},{network:0,providers:0,journals:0,connectionReads:0});assert.equal(existsSync(home),false);
console.log(JSON.stringify({phase:'refusal-effects',network,providers,journals,connectionReads,credentialHomeCreated:false}));
console.log(JSON.stringify({phase:'tarball',sha256:createHash('sha256').update(readFileSync('.tmp/room-acp-0.1.0.tgz')).digest('hex'),files:JSON.parse(readFileSync('audit/evidence/package-composition-5859/pack.json'))[0].files.map(x=>x.path)}));
