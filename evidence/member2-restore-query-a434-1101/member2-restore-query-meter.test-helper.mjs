// Test-only attribution. One passive meter per native statement; no binding capture.
import {measureSql} from './member2-restore-scale-meter.test-helper.mjs';
export function measureQuerySql(native) {
  const samples=[];
  return {
    sql:new Proxy(native,{get(target,key) {
      if(key==='exec')return (query,...bindings)=>{
        const meter=measureSql(native);
        // Only code-owned SQL shape; no arguments, result values, or SQL literals.
        const shape=String(query).replace(/'(?:''|[^'])*'/g,"'?'").replace(/\s+/g,' ').trim();
        samples.push({meter,shape});
        return meter.sql.exec(query,...bindings);
      };
      const value=Reflect.get(target,key,target);
      return typeof value==='function'?value.bind(target):value;
    }}),
    snapshot() {
      const groups=new Map(),total={};
      for(const {meter,shape} of samples) {
        const value=meter.snapshot(),group=groups.get(shape)??{sql:shape};
        for(const [key,n] of Object.entries(value)) {
          total[key]=(total[key]??0)+n;group[key]=(group[key]??0)+n;
        }
        groups.set(shape,group);
      }
      const all=[...groups.values()],categories=new Map();
      for(const group of all) {
        const category=/^PRAGMA\s+(\w+)/i.exec(group.sql)?.[0].toLowerCase()
          ??(/sqlite_(master|schema)/i.test(group.sql)?'catalog':/^SELECT/i.test(group.sql)?'select-data':/^DROP TRIGGER/i.test(group.sql)?'drop-trigger':/^CREATE TRIGGER/i.test(group.sql)?'create-trigger':/^UPDATE/i.test(group.sql)?'update':'other');
        const aggregate=categories.get(category)??{category};
        for(const [key,value] of Object.entries(group))if(key!=='sql')aggregate[key]=(aggregate[key]??0)+value;
        categories.set(category,aggregate);
      }
      return {...total,distinctSql:all.length,attributedRowsRead:all.reduce((n,g)=>n+g.rowsRead,0),
        attributedReturnedPayloadBytes:all.reduce((n,g)=>n+g.returnedPayloadBytes,0),
        categories:[...categories.values()].sort((a,b)=>b.rowsRead-a.rowsRead),
        topRowsRead:all.sort((a,b)=>b.rowsRead-a.rowsRead).slice(0,8).map(g=>({...g,sql:g.sql.slice(0,350)}))};
    }
  };
}
