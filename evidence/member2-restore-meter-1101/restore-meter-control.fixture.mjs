import {DurableObject} from 'cloudflare:workers';
import {measureSql} from './restore-finalization-meter.mjs';
export class RestoreMeterControl extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env); this.ctx=ctx;
    const sql=ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS controls(n INTEGER, body TEXT, payload BLOB)');
    ctx.storage.transactionSync(()=>{
      sql.exec('DELETE FROM controls');
      for(let n=0;n<32;n++) sql.exec('INSERT INTO controls VALUES(?,?,?)',n,'🧪漢字',new Uint8Array([0,255,2]));
    });
  }
  async fetch() {
    const sql=this.ctx.storage.sql,results={};
    const baseline=sql.exec('SELECT body,payload FROM controls'); baseline.next();
    results.baselineOneRead={rowsRead:baseline.rowsRead};
    let meter=measureSql(sql),cursor=meter.sql.exec('SELECT body,payload FROM controls');
    cursor.next(); results.passiveSnapshot=meter.snapshot();
    results.nativeProperties={originalDatabaseSize:sql.databaseSize,meterDatabaseSize:meter.sql.databaseSize};
    results.passiveSnapshotAgain=meter.snapshot();
    cursor.toArray(); results.remainingArray=meter.snapshot();
    meter=measureSql(sql); meter.sql.exec('SELECT body,payload FROM controls WHERE n=31').one();
    results.scanToOne=meter.snapshot();
    meter=measureSql(sql); for(const row of meter.sql.exec('SELECT body,payload FROM controls')) {void row;break;}
    results.breakAfterOne=meter.snapshot();
    meter=measureSql(sql); meter.sql.exec('SELECT body,payload FROM controls').raw().toArray();
    results.rawArray=meter.snapshot();
    sql.exec('CREATE TABLE IF NOT EXISTS large_cell(body TEXT,payload BLOB)');
    sql.exec('DELETE FROM large_cell'); sql.exec('INSERT INTO large_cell VALUES(?,?)','🧪漢字'.repeat(4096),new Uint8Array([0,255,2]));
    meter=measureSql(sql);meter.sql.exec('SELECT body,payload FROM large_cell').toArray();results.oneLargeCell=meter.snapshot();
    meter=measureSql(sql);
    try {meter.sql.exec('SELECT * FROM synthetic_missing_table');} catch { /* preserve native refusal */ }
    results.failedStatement=meter.snapshot();
    return Response.json(results);
  }
}
export default {fetch(request,env){return env.ROOM.getByName('synthetic-meter-control').fetch(request);}};
