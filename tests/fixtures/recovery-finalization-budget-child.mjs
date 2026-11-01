// Test-only external termination at a logical verification work boundary.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RoomStore} from '../../server/store.mjs';
import {createBackupReplaySession} from '../../server/restore-ndjson.mjs';
const [action,filename,source]=process.argv.slice(2),store=new RoomStore(filename),text=readFileSync(source,'utf8');
if(action==='partial'){const session=createBackupReplaySession(store);session.writeText(text);console.log(JSON.stringify({phase:'partial',pending:store.restoreStatus().pending,events:store.db.prepare('SELECT count(*) n FROM events').get().n}));process.exit(77);}
const session=createBackupReplaySession(store,{resume:true});session.writeText(text);const prepare=store.db.prepare.bind(store.db);let verification=false,verifiedRows=0;const prefix=[];
store.db.prepare=sql=>{
 if(sql==='SELECT count(*) AS n FROM "accounts"')verification=true;
 const statement=prepare(sql);
 if(!verification||!/^SELECT \* FROM "[a-z_]+" (?:WHERE|ORDER BY)/.test(sql))return statement;
 return new Proxy(statement,{get(target,key){const value=Reflect.get(target,key,target);if(key!=='get')return typeof value==='function'?value.bind(target):value;return(...args)=>{const row=value.apply(target,args);if(row){verifiedRows++;if(prefix.length<5)prefix.push({table:/FROM "([a-z_]+)"/.exec(sql)[1],rowSha256:createHash('sha256').update(JSON.stringify(row)).digest('hex')});if(verifiedRows===128){const admission=prepare('SELECT state,restore_id FROM current_restore_admission WHERE singleton=1').get();console.log(JSON.stringify({phase:'verification-budget-exit',verifiedRows,prefix,admission,events:prepare('SELECT count(*) n FROM events').get().n,operatorActions:prepare('SELECT count(*) n FROM operator_actions').get().n}));process.exit(77);}}return row;};}});
};
session.finish();throw Error('verification budget seam not reached');
