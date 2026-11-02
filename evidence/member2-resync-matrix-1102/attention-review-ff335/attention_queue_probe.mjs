// Read-only contract review probe using disposable synthetic Node state.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const [root]=process.argv.slice(2);assert.equal(process.argv.length,3);
const git=process.env.LOCAL_LAB_GIT??'git';
const pin=execFileSync(git,['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(pin,'ff3350cb8d2be1d1c7278677211eeea3282b7c75');
execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
const imp=p=>import(pathToFileURL(root+'/'+p));
const [{RoomStore},{AgentRooms},{createRoomServer},{resumeAgent},{RoomAgentClient}]=await Promise.all(['server/store.mjs','server/agent-rooms.mjs','server/http.mjs','client/agent-resume.mjs','client/room-agent.mjs'].map(imp));
const s=new RoomStore(':memory:');let server;
try{
 const owner=s.identities.create('Olive'),peer=s.identities.create('Parker'),room='attention-queue';
 new AgentRooms(s).create(owner.secret,{roomId:room,title:'Review fixture',purpose:'Useful coordination',starter:false});
 s.invites.redeem(s.invites.create(owner.secret,room,{profile:'member'}).code,{identitySecret:peer.secret,displayName:'Parker'});
 s.dmConsents.request(room,peer.identityId,owner.identityId,'Reply coordination');s.dmConsents.decide(room,owner.identityId,peer.identityId,'approve');
 for(let i=0;i<5;i++)s.command(peer.secret,room,{id:'request-'+i,type:'message.posted',data:{messageId:'request-'+i,toMemberId:owner.identityId,requestKind:'reply',body:'Please review item '+i}});
 const states=()=>s.replyRequests.list(owner.secret,room,{direction:'incoming',status:'open',limit:4});
 const canonicalHash=()=>createHash('sha256').update(JSON.stringify(['current_room_records','current_room_record_proofs','current_room_head','events','commands'].map(table=>[table,s.db.prepare('SELECT * FROM '+table+' WHERE room_id=? ORDER BY rowid').all(room)]))).digest('hex');
 const before=canonicalHash();
 server=createRoomServer({store:s});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const connection={origin,roomId:room,memberId:owner.identityId,token:owner.secret};
 const direct=await fetch(origin+'/api/rooms/'+room+'/agent-work',{headers:{Authorization:'Bearer '+owner.secret}});
 const refusal=await direct.json();assert.equal(direct.status,422);assert.match(JSON.stringify(refusal),/reply_list_too_large/);
 const resumed=await resumeAgent({connection,maxPages:5});
 assert.equal(resumed.pendingReconciliations.status,'unavailable');
 assert.ok(resumed.incompleteSources.some(x=>x.source==='openRequests'));
 assert.equal(resumed.observedThroughBySource.openRequests,undefined);
 assert.deepEqual(resumed.openRequests,[]);
 const client=new RoomAgentClient(connection);
 const seen=[];let options={direction:'incoming',status:'open',limit:4};let pages=0;
 for(;pages<20;pages++){
  const page=await client.replyRequests(options);seen.push(...page.requests.map(x=>x.id));
  if(!page.nextRead){assert.notEqual(page.sourceWindow?.complete,false);pages++;break;}
  const next=page.nextRead;
  assert.equal(next.tool,'room_list_requests');options=next.arguments;
 }
 assert.equal(seen.length,5);assert.equal(new Set(seen).size,5);
 assert.ok(states().requests.every(r=>r.status==='open'));
 assert.equal(canonicalHash(),before);
 execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
 console.log(JSON.stringify({schema:'member2-attention-queue-contract-probe-v1',pass:true,pin,node:process.version,openRequestCount:5,agentWork:{httpStatus:direct.status,code:'reply_list_too_large'},compactResume:{pendingReconciliations:resumed.pendingReconciliations.status,openRequestsAvailabilityRecorded:false,incompleteSources:resumed.incompleteSources.map(x=>({source:x.source,code:x.code}))},separateRequestTraversal:{pages,count:seen.length,unique:new Set(seen).size},canonicalFiveTableHashUnchanged:true,scope:'Synthetic local Node HTTP/SDK only; no runtime edits, generic acknowledgment, production or Native proof.'},null,2));
}finally{if(server){server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}s.close();}
