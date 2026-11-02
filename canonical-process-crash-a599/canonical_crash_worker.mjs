// Child owns only disposable SQLite and two loopback HTTP listeners.
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
const [repo,filename,seed]=process.argv.slice(2),load=p=>import(pathToFileURL(repo+'/'+p));
const [{RoomStore},{initialRoom},{event},{createRoomServer},{auditRecovery}]=await Promise.all(['server/store.mjs','server/bootstrap.mjs','src/events.js','server/http.mjs','server/recovery.mjs'].map(load));
const store=new RoomStore(filename);let keys;
if(seed==='seed'){
 const es=initialRoom('crash-room');es.push(event({roomId:'crash-room',actorId:'owner',type:'member.added',data:{memberId:'worker',displayName:'Synthetic worker',kind:'agent',permissions:['accept_work','complete_work','write_external']}}));store.initialize(es,{representation:'normalized-current-v1'});keys={owner:store.issueAccessKey('crash-room','owner'),worker:store.issueAccessKey('crash-room','worker')};store.command(keys.owner,'crash-room',{id:'propose-task',type:'work.proposed',data:{workItemId:'task',title:'Synthetic durable task',definitionOfDone:'Save one result',accountableMemberId:'worker',mode:'write'}});
}
const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const control=createServer(async(req,res)=>{try{
 if(req.url==='/facts'){
  auditRecovery(store);const tables=['rooms','operator_actions','work_claim_config','events','commands','work_entities','work_claims','current_room_records','current_room_record_proofs','current_room_head'];
  const fingerprints=Object.fromEntries(tables.map(t=>{const rows=store.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all();return [t,{rows:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}];}));
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({head:store.headSequence('crash-room'),fingerprints,auditPassed:true}));return;
 }
 if(req.url==='/revoke'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw Error('Bound');}const {token}=JSON.parse(body);store.revoke(token);res.writeHead(200,{'Content-Type':'application/json'});res.end('{"revoked":true}');return;}
 res.writeHead(404);res.end();
}catch{res.writeHead(500);res.end('{"fixtureError":true}');}});await new Promise(r=>control.listen(0,'127.0.0.1',r));
process.send({ready:true,origin:'http://127.0.0.1:'+server.address().port,controlOrigin:'http://127.0.0.1:'+control.address().port,...(keys?{keys}:{})});
process.on('SIGTERM',()=>{server.closeStreams();server.closeAllConnections();server.close(()=>{control.close(()=>{store.close();process.exit(0);});});});
