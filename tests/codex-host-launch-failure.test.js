import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,realpathSync,rmSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {saveAgentConnection} from '../client/agent-connection.mjs';
import {readCodexHostStatus} from '../client/codex-host-status.mjs';
const cli=realpathSync('scripts/run-codex-room.mjs');
function setup(t){const root=realpathSync(mkdtempSync(join(tmpdir(),'room-launch-failure-'))),home=join(root,'profile'),cwd=join(root,'workspace'),command=join(root,'fake-codex'),marker=join(root,'runtime-started'),config=join(root,'runtime.json'),journal=join(root,'journal.sqlite'),connection=join(root,'connection');mkdirSync(home,{mode:0o700});mkdirSync(cwd);writeFileSync(command,`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected runtime start');\n`,{mode:0o700});writeFileSync(config,JSON.stringify({command,cwd,codexHome:home,policy:{approvalPolicy:'never',sandbox:'read-only'},requestTimeoutMs:1000}));saveAgentConnection(connection,{version:1,origin:'https://fixture.invalid',roomId:'room',memberId:'agent',token:'t'.repeat(43)});t.after(()=>rmSync(root,{recursive:true,force:true}));return{root,home,cwd,command,marker,config,journal,connection};}
function launch(f){return spawnSync(process.execPath,[cli,'--watch-requests',f.journal,f.config,'owner'],{stdio:['ignore','ignore','ignore'],timeout:5000,env:{PATH:'/unavailable',ROOM_AGENT_CONFIG:f.connection}});}
test('private profile lock failure remains actionable after the native-style child exits with output discarded',t=>{
 const f=setup(t),lock=join(f.home,'.room-runtime.lock');mkdirSync(lock,{mode:0o700});writeFileSync(join(lock,'identity'),'PRIVATE-LOCK-DETAIL',{mode:0o600});const before=statSync(lock).ino;
 const child=launch(f);assert.equal(child.error,undefined);const status=readCodexHostStatus(f.journal);
 assert.equal(status.phase,'stopped');assert.equal(status.protocol,'unverified');assert.equal(status.credentials,'unknown');assert.equal(status.failureCode,'profile_lock_requires_reconciliation');assert.equal(child.status,70);
 assert.equal(existsSync(f.marker),false);assert.equal(statSync(lock).ino,before);assert.equal(readFileSync(join(lock,'identity'),'utf8'),'PRIVATE-LOCK-DETAIL');assert.doesNotMatch(JSON.stringify(status),/PRIVATE-LOCK-DETAIL|runtime\.json|fake-codex/);
});
