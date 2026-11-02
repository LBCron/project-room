import {initialRoom} from '../../server/bootstrap.mjs';
import {event,PERMISSIONS} from '../../src/events.js';
import {textVersion} from '../../server/text-results.mjs';
import {operatorNormalization} from '../../server/operator-normalization.mjs';
import {auditRecovery} from '../../server/recovery.mjs';
export function seedRecoveryReplayEqualitySource(store,{checkpoint=false,archive=false,extra=0,checkpointMutate,deferred=false}={}) {
 const body='An independently saved public result',make=(id,type,data,actorId='owner')=>event({id,roomId:'commons',actorId,type,at:'2026-11-01T00:00:00.000Z',data});
 const events=[...initialRoom(),make('worker-added','member.added',{memberId:'worker',displayName:'Worker',kind:'agent',permissions:[...PERMISSIONS]}),make('root-event','message.posted',{messageId:'root',body:'A public root'}),make('private-event','message.posted',{messageId:'private',body:'Private coordination',toMemberId:'worker'}),make('reply-event','message.posted',{messageId:'reply',body:'An exact reply',replyToId:'root'}),make('proposal','work.proposed',{workItemId:'task',title:'Save useful work',definitionOfDone:'A saved result',accountableMemberId:'owner'}),make('accepted','work.accepted',{workItemId:'task',expectedRevision:0}),make('result-post','message.posted',{messageId:'result',body,workItemId:'task'}),make('completed','work.completed',{workItemId:'task',expectedRevision:1,evidenceKind:'room_text',evidenceMessageId:'result',evidenceMessageEventId:'result-post',evidenceVersion:textVersion(body),previousCompletionEventId:null,producerId:'owner',summary:'Saved',nextAction:'Review'})];
 for(let n=0;n<extra;n++)events.push(make('extra-event-'+n,'message.posted',{messageId:'extra-'+n,body:'Retained history '+n}));
 // Archive uses the original supported legacy archive operation; conversion is
 // the real one-time operator path. Pure history/account identities stay exact.
 store.initialize(events,archive?{}:{representation:'normalized-current-v1'});
 const key=store.issueAccessKey('commons','owner');
 if(deferred)store.command(key,'commons',{id:'uncertified-channel-plan',type:'channel.created',data:{channelId:'new-channel',name:'New channel'}});
 if(archive){while(!store.backfillMessages({limit:200}).done){}store.checkMessagesParity({roomId:'commons'});store.command(key,'commons',{id:'pin-root',type:'message.pinned',data:{messageId:'root'}});while(!store.backfillMessages({limit:200}).done){}store.checkMessagesParity({roomId:'commons'});const r=store.archiveMessages('commons',{keepNewest:2,dryRun:false});if(!r.ok)throw Error('synthetic archive failed: '+JSON.stringify(r));}
 if(checkpoint){const state=archive?store.room('commons').state:store.rebuildProjection('commons').state;checkpointMutate?.(state);store.transaction(()=>store.db.prepare('INSERT INTO projection_checkpoints(room_id,sequence,projection) VALUES(?,?,?)').run('commons',store.headSequence('commons'),JSON.stringify(state)));}
 if(archive){const select={roomId:'commons',discardLegacyAssignments:false},plan=operatorNormalization(store,select);operatorNormalization(store,{...select,planHash:plan.planHash,requestId:'equality-source-adopt',reason:'Offline independent parity fixture'},true);}
 auditRecovery(store);return{key,body};
}
