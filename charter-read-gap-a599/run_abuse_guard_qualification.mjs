import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const lab=fileURLToPath(new URL('.',import.meta.url)),repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',runtime='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies',git=runtime+'/bin/fallback/git';
assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
process.env={PATH:[runtime+'/node/bin',runtime+'/python/bin',runtime+'/bin/fallback',lab+'qualification-tools/bin','/usr/bin','/bin'].join(':'),TMPDIR:mkdtempSync('/tmp/member2-abuse-'),LANG:'en_US.UTF-8',HOST:'127.0.0.1'};
const {startServer,runChecker}=await import(pathToFileURL(repo+'/tests/qa2/helpers.js'));
const out=lab+'abuse-guard-qualification';mkdirSync(out,{recursive:true});
const server=await startServer();let terminal;
try{
 const start=Date.now(),r=await runChecker('abuse-guards.mjs',['--origin',server.origin],{timeout:240000});
 assert.ok(r.report?.results?.length,'Actual checker observations required');
 // Save only synthetic per-case outcome/evidence, never stdout/recovery credentials.
 const cases=r.report.results.map(({id,title,status,evidence})=>({id,title,status,evidence}));
 terminal={source:pin,node:process.version,checker:'scripts/qa2/abuse-guards.mjs',status:r.code,signal:r.signal,elapsedMs:Date.now()-start,cases,pass:cases.filter(x=>x.status==='PASS').length,fail:cases.filter(x=>x.status==='FAIL').length,scope:'Existing checker on disposable local Node HTTP only; no source edit, Native, release or peer-device execution claim.'};
 writeFileSync(out+'/receipt.json',JSON.stringify(terminal,null,2)+'\n');console.log('ABUSE_GUARD_QUALIFICATION '+JSON.stringify(terminal));process.exitCode=r.code;
}finally{server.stop();execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);}
