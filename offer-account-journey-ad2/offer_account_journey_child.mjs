import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [repo,filename,seed]=process.argv.slice(2),load=p=>import(pathToFileURL(repo+'/'+p));
const [{RoomStore},{createRoomServer},{auditRecovery}]=await Promise.all(['server/store.mjs','server/http.mjs','server/recovery.mjs'].map(load));
const store=new RoomStore(filename);let fixture;
if(seed==='seed'){
 store.createAccount('synthetic-owner');const slot=store.createAccountSessionSlot(),session=store.loginAccountSession(slot.token,store.issueAccountAccessKey('synthetic-owner'),0),agent=store.identities.create('Existing synthetic agent');
 const resumer=store.identities.create('Independent synthetic resumer');fixture={resumerSecret:resumer.secret,resumerId:resumer.identityId,cookie:'account_session='+slot.token,binding:session.sessionBinding,csrf:session.csrf,agentSecret:agent.secret,agentId:agent.identityId};
}
const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
process.on('message',({id})=>{try{auditRecovery(store);const tables=['rooms','events','commands','work_entities','work_claims','current_room_records','current_room_record_proofs','current_room_head','operator_actions','work_claim_config','project_offers','project_offer_requests','bounty_journal'];const fingerprints=Object.fromEntries(tables.map(t=>{const rows=store.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all();return[t,{rows:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}];}));process.send({id,result:{fingerprints,identities:store.db.prepare('SELECT count(*) n FROM agent_identities').get().n,accounts:store.db.prepare('SELECT count(*) n FROM accounts').get().n,recoveryAudit:true,cost:{cpuUserMicros:process.resourceUsage().userCPUTime,cpuSystemMicros:process.resourceUsage().systemCPUTime,rssBytes:process.memoryUsage().rss}}});}catch(e){process.send({id,error:e.message});}});
process.on('disconnect',()=>process.exit(0));process.send({ready:true,origin:'http://127.0.0.1:'+server.address().port,...(fixture?{fixture}:{})});
