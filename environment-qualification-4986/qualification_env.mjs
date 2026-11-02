// One-shot environment check for physical-laptop unit qualification. No installs or stubs.
import {spawnSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const runtime='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const path=[runtime+'/node/bin',runtime+'/python/bin',runtime+'/bin/fallback',fileURLToPath(new URL('./qualification-tools/bin',import.meta.url)),process.env.PATH??''].join(':');
const checks=[['node',['--version']],['python3',['--version']],['git',['--version']],['gh',['--version']],['jq',['--version']],['npm',['--version']]];
const tools=checks.map(([name,args])=>{
 const located=spawnSync('/bin/zsh',['-c','command -v "$1"','qualification-env',name],{env:{...process.env,PATH:path},encoding:'utf8',timeout:5000});
 const executable=located.status===0?located.stdout.trim():null;
 if(!executable)return {name,available:false,reason:'not on qualified PATH'};
 let resolved;try{resolved=realpathSync(executable);}catch{return {name,available:false,reason:'broken executable path'};}
 const result=spawnSync(executable,args,{env:{...process.env,PATH:path},encoding:'utf8',timeout:5000});
 return {name,executable:resolved,available:result.status===0,version:result.status===0?(result.stdout||result.stderr).trim().split('\n')[0]:null,status:result.status,signal:result.signal};
});
const missing=tools.filter(t=>!t.available).map(t=>t.name);
console.log(JSON.stringify({scope:'Full local unit qualification prerequisites, not a test result',tools,missing,ready:missing.length===0,action:missing.length?'Resolve real dependencies before another full-unit run; do not stub or skip failed cases. Existing focused evidence remains scoped.':'Environment tools respond; source and tests still require qualification.'},null,2));
process.exitCode=missing.length?2:0;
