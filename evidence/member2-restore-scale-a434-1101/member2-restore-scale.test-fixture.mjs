// Disposable local scale qualification. Existing production restore routes unchanged.
import {DurableCoverageRoom as SeedRoom} from './durable-coverage-seed.test-fixture.mjs';
import {DurableCoverageRoom as NativeRoom} from './durable-coverage-native.test-fixture.mjs';
import {measureSql} from './member2-restore-scale-meter.test-helper.mjs';
const measured = Base => class extends Base {
  constructor(ctx,env) {
    super(ctx,env);
    const db=this.store.db,storage=db.storage,native=storage.sql,owner=this;
    this.activeMeter=null;this.nativeSql=native;
    db.storage=new Proxy(storage,{get(target,key) {
      if(key==='sql') return owner.activeMeter?.sql??native;
      const value=Reflect.get(target,key,target);
      return typeof value==='function'?value.bind(target):value;
    }});
  }
  async fetch(request) {
    if(new URL(request.url).pathname==='/__scale-census') {
      const db=this.store.db;
      return Response.json({events:db.prepare('SELECT count(*) n FROM events').get().n,
        records:db.prepare('SELECT count(*) n FROM current_room_records').get().n,
        admission:this.store.restoreStatus()});
    }
    const meter=measureSql(this.nativeSql);this.activeMeter=meter;
    try {
      const response=await super.fetch(request),headers=new Headers(response.headers);
      headers.set('x-member2-sql-meter',JSON.stringify(meter.snapshot()));
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    } catch(error) {
      return Response.json({error:{name:error.name,code:error.code??null,message:String(error.message).slice(0,500)}},
        {status:500,headers:{'x-member2-sql-meter':JSON.stringify(meter.snapshot())}});
    } finally {this.activeMeter=null;}
  }
};
export class ScaleSeedRoom extends measured(SeedRoom) {}
export class ScaleNativeRoom extends measured(NativeRoom) {}
export default {fetch(request,env) {
  const u=new URL(request.url),surface=u.searchParams.get('surface')??'target';u.searchParams.delete('surface');
  const headers=new Headers(request.headers);headers.set('Host','room.example.test');headers.set('x-room-visitor-ip','192.0.2.1');
  const init={method:request.method,headers};if(!['GET','HEAD'].includes(request.method))init.body=request.body;
  return env.ROOM.getByName(surface).fetch(new Request(u,init));
}};
