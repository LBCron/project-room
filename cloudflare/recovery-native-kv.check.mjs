import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
test('Native recovery audits application foreign keys while preserving private KV',{timeout:30000},async t=>{
 const script=(await build({entryPoints:[fileURLToPath(new URL('./recovery-native-kv.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'RecoveryKvProbe',useSQLite:true}}});t.after(()=>mf.dispose());
 const response=await mf.dispatchFetch('https://room.example/engine');assert.equal(response.status,200,await response.clone().text());const result=await response.json();
 assert.equal(result.privateTablePresent,true);assert.equal(result.privateKv,'original-private-kv');assert.equal(result.privateForeignChecks,0);
 assert.equal(result.engine.stage,'complete');assert.equal(result.engine.quickTables,result.expectedQuickTables);assert.equal(result.engine.foreignKeyTables,result.expectedForeignTables);
 assert.equal(result.parentChecked,true);assert.equal(result.childChecked,true);assert.equal(result.admissionStillPending,true,'engine completion alone must not publish the target');
 console.log('RECOVERY_NATIVE_KV '+JSON.stringify(result));
});
