import entry,{IdentityLinkRoom} from './current-identity-link.test-fixture.mjs';
import {readCurrentRecord} from '../server/current-room-repository.mjs';
export class RequestRunRoom extends IdentityLinkRoom {
 async fetch(request){const path=new URL(request.url).pathname;if(!['/run','/run-cold'].includes(path))return super.fetch(request);try{
 const s=this.store,{identity,key}=await this.ctx.storage.get('fixture');s.room=()=>{throw Error('Full request-run room hydration forbidden');};
 if(path==='/run'){
  s.command(key,'commons',{id:'native-question-event',type:'message.posted',data:{messageId:'native-question',body:'Do useful work',toMemberId:identity.identityId,requestKind:'reply'}});
  const r=readCurrentRecord(s.db,'commons','replyRequests','native-question'),input={requestMessageId:r.id,attemptId:'native-attempt',action:'claim',expectedRequestRevision:r.revision,contextEventId:r.contextEventId};
  await this.ctx.storage.put('run-input',input);
  let rolledBack=false;try{s.transaction(()=>{s.requestRuns.apply(identity.secret,'commons',input);throw Error('Native saved-run fault');});}catch(e){if(e.message!=='Native saved-run fault')throw e;rolledBack=true;}
  if(s.db.prepare('SELECT count(*) n FROM request_runs').get().n!==0)throw Error('Fault did not roll back');
  const result=s.requestRuns.apply(identity.secret,'commons',input);return Response.json({rolledBack,state:result.state});
 }
 const input=await this.ctx.storage.get('run-input');let repeated=false;try{s.requestRuns.apply(identity.secret,'commons',input);}catch(e){if(e.code!=='request_run_owned')throw e;repeated=true;}
 s.requestRuns.apply(identity.secret,'commons',{...input,action:'needs_attention'});
 return Response.json({duplicateRefused:repeated,state:s.requestRuns.list(identity.secret,'commons').runs['native-question'].state,attempts:s.db.prepare('SELECT count(*) n FROM request_runs').get().n});
 }catch(e){return Response.json({error:{code:e.code,message:e.message}},{status:500});}}
}
export default entry;
