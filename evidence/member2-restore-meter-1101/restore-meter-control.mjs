import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
if(!process.argv[2]) throw Error('Usage: node restore-meter-control.mjs PATH_TO_CHECKOUT/cloudflare/package.json');
const require=createRequire(resolve(process.argv[2]));
const {build}=require('esbuild'),{Miniflare}=require('miniflare');
const built=await build({entryPoints:[fileURLToPath(new URL('./restore-meter-control.fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']});
const mf=new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'RestoreMeterControl',useSQLite:true}}});
try {
  const response=await mf.dispatchFetch('https://synthetic.invalid/'); assert.equal(response.status,200);
  const r=await response.json();
  assert.equal(r.passiveSnapshot.rowsRead,r.baselineOneRead.rowsRead);
  assert.ok(r.nativeProperties.originalDatabaseSize>0);
  assert.equal(r.nativeProperties.meterDatabaseSize,r.nativeProperties.originalDatabaseSize);
  assert.equal(r.passiveSnapshot.returnedRows,1);assert.equal(r.passiveSnapshot.returnedPayloadBytes,13);
  assert.deepEqual(r.passiveSnapshotAgain,r.passiveSnapshot,'observing must not consume more rows');
  assert.equal(r.remainingArray.returnedRows,32);assert.equal(r.remainingArray.returnedPayloadBytes,32*13);
  assert.equal(r.scanToOne.returnedRows,1);assert.ok(r.scanToOne.rowsRead>=32);
  assert.equal(r.scanToOne.returnedPayloadBytes,13);
  assert.equal(r.breakAfterOne.rowsRead,r.baselineOneRead.rowsRead);assert.equal(r.breakAfterOne.returnedRows,1);
  assert.equal(r.rawArray.returnedRows,32);assert.equal(r.rawArray.returnedPayloadBytes,32*13);
  assert.equal(r.oneLargeCell.returnedRows,1);assert.equal(r.oneLargeCell.returnedPayloadBytes,40963);
  for(const [name,value] of Object.entries(r)) if(name!=='failedStatement'&&Object.hasOwn(value,'unknownCounters')) assert.equal(value.unknownCounters,0);
  assert.equal(r.failedStatement.statements,1);assert.equal(r.failedStatement.failedStatements,1);
  assert.equal(r.failedStatement.unknownCounters,2,'a refused SQL statement must not imply known zero row costs');
  const report={at:new Date().toISOString(),scope:'Test-meter calibration only; no Room source/candidate executed',node:process.version,
    runtime:'actual local workerd via Miniflare SQLite Durable Object',results:r,
    limits:['Returned payload bytes count UTF-8 string values and BLOB bytes only; exclude column names, numeric encodings and SQL wire/storage overhead.',
      'Physical rowsRead is the native cursor counter, distinct from yielded rows.',
      'Local workerd timing is not production CPU qualification.',
      'No normalization/restore candidate, deployment, private data or network pairing tested.']};
  await writeFile(new URL('./restore-meter-control-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await mf.dispose();}
