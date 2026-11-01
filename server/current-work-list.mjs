import {createHmac,timingSafeEqual} from 'node:crypto';
import {isCurrentRoom,readCurrentHead,readCurrentWorkItem,readCurrentOverviewWindow,readCurrentReplyRequestWindow,currentVisibleHorizon,withCurrentReadContext} from './current-room-repository.mjs';
import {validWorkPage} from './work-list-page.mjs';
import {nextWorkStep} from '../src/workflow.js';
import {currentResult} from '../src/work-selectors.js';
import {charterContext} from '../src/room-charter.js';
import {messageInHistory} from './history-visibility.mjs';
import {ServiceError} from './service-error.mjs';

const fail=(code,message,status=422)=>{throw new ServiceError(status,code,message);};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const keys='v roomId viewerId head focus limit at workAfter requestAfter workDone requestsDone'.split(' ');
const signature=(secret,payload)=>createHmac('sha256',secret).update('current-work-source-v1:'+payload).digest();
function decode(cursor,secret) {
  try {
    const [payload,sig,...extra]=cursor.split('.');if(extra.length||!payload||!sig)throw Error();
    const actual=Buffer.from(sig,'base64url'),expected=signature(secret,payload);
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected)||actual.toString('base64url')!==sig)throw Error();
    const value=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(encode(value)!==payload||Object.keys(value).join(' ')!==keys.join(' '))throw Error();
    return value;
  } catch {fail('invalid_work_cursor','Invalid work cursor. Restart room_list_work without cursor.');}
}

// The cursor walks source keys, including excluded records. A filtered empty
// page is not completion. No complete filtered count or global ranking is claimed.
export function readCurrentWorkListing(store,secret,roomId,args={}) {
  return store.readTransaction(()=>{
    const auth=store.authenticate(secret,roomId,args.expectedSessionBinding??null);
    if(!isCurrentRoom(store.db,roomId))return null;
    if(!validWorkPage(args))fail('invalid_work_page','Use limit 1–100 and a returned cursor.');
    const focus=args.focus??'all';
    if(!['all','needs_me','results','help_wanted'].includes(focus))fail('invalid_focus','Choose a supported work focus.');
    if(args.query!==undefined||args.sort!==undefined||focus==='help_wanted')
      fail('current_work_selection_unavailable','This bounded listing supports all, needs_me, and results. Global search, ranking, and help eligibility require a qualified reader.',409);
    return withCurrentReadContext(store.db,roomId,()=>{
      const head=readCurrentHead(store.db,roomId),limit=Math.min(args.limit??4,4);
      const initial={v:1,roomId,viewerId:auth.member.id,head:head.head_sha256,focus,limit,at:store.now(),workAfter:'',requestAfter:'',workDone:false,requestsDone:focus!=='needs_me'};
      const saved=args.cursor===undefined?initial:decode(args.cursor,secret);
      if(saved.v!==1||saved.roomId!==roomId||saved.viewerId!==auth.member.id||saved.head!==initial.head||saved.focus!==focus||saved.limit!==limit)
        fail('stale_work_cursor','Work, access, or selection changed. Restart room_list_work without cursor.',409);
      if(!Number.isSafeInteger(saved.at)||saved.at<0||typeof saved.workAfter!=='string'||typeof saved.requestAfter!=='string'
        ||typeof saved.workDone!=='boolean'||typeof saved.requestsDone!=='boolean'||saved.workDone&&saved.requestsDone)
        fail('invalid_work_cursor','Invalid source continuation. Restart without cursor.');
      const overview=readCurrentOverviewWindow(store,roomId,{viewerId:auth.member.id,workAfter:saved.workAfter,limit:saved.workDone?1:limit});
      const member=overview.state.members[auth.member.id],now=saved.at;
      const items=saved.workDone?[]:Object.values(overview.state.workItems);
      const work=items.filter(item=>focus==='all'||focus==='results'&&currentResult(item)
        ||focus==='needs_me'&&member.active!==false&&nextWorkStep(item,now,overview.state.room.ownerId).memberId===member.id
          &&nextWorkStep(item,now,overview.state.room.ownerId).needsAttention).map(item=>({
        id:item.id,title:item.title,state:item.state,revision:item.revision,mode:item.mode,
        next:nextWorkStep(item,now,overview.state.room.ownerId),
        nextRead:{tool:'room_read_work',arguments:{workItemId:item.id}},
        ...(focus==='results'?(()=>{const current=readCurrentWorkItem(store.db,roomId,item.id);return {
          result:currentResult(current),nextResultRead:current.receipt.nativeText
            ?{tool:'room_read_result',arguments:{workItemId:item.id,completionEventId:current.receipt.eventId}}:null};})():{})
      }));
      const requests=saved.requestsDone?null:readCurrentReplyRequestWindow(store,roomId,{after:saved.requestAfter,limit});
      const floor=requests?store.historyFloor(roomId,member.id,head.sequence):null;
      const replyRequests=requests?.requests.filter(request=>request.recipientId===member.id&&request.status==='open'
        &&messageInHistory({id:request.id,createdAt:request.createdAt},floor)).map(request=>({
        id:request.id,requesterId:request.requesterId,workItemId:request.workItemId,revision:request.revision,
        nextRead:{tool:'room_read_request',arguments:{requestMessageId:request.id}}
      }))??[];
      const workDone=saved.workDone||overview.workWindow.nextAfter===null,requestsDone=saved.requestsDone||!requests.hasMore;
      const next={...saved,workAfter:saved.workDone?saved.workAfter:overview.workWindow.nextAfter??items.at(-1)?.id??saved.workAfter,
        requestAfter:requests?.examinedAfter??saved.requestAfter,workDone,requestsDone};
      const hasMore=!workDone||!requestsDone,payload=encode(next),nextCursor=hasMore?`${payload}.${signature(secret,payload).toString('base64url')}`:null;
      const evaluatedThrough=currentVisibleHorizon(store,roomId,member.id,head.sequence);
      return {contractVersion:1,roomId,viewerId:member.id,viewerAccountId:auth.account?.id??null,viewerAuthEpoch:auth.account?.authEpoch??null,
        viewerSessionBinding:auth.sessionBinding??null,viewerSessionRevision:auth.sessionRevision??null,
        evaluatedThrough,evaluatedAt:new Date(now).toISOString(),clockSource:'service',focus,
        member:{id:member.id,kind:member.kind,permissions:[...member.permissions]},charter:charterContext(overview.state.room),
        work,...(focus==='needs_me'?{replyRequests,replyRequestsEvaluatedThrough:evaluatedThrough}:{}),
        workScope:'bounded_source_window',selection:{order:'id',examinedWork:items.length,examinedRequests:requests?.requests.length??0,
          matches:null,guidance:'Follow every page, including empty filtered pages. Counts describe examined sources, not all matches. Read selected work or request before acting.'},
        page:{limit,totalWork:null,totalReplyRequests:null,hasMore,nextCursor,consistency:'restart_on_change',
          nextRead:hasMore?{tool:'room_list_work',arguments:{roomId,focus,...(args.limit===undefined?{}:{limit:args.limit}),cursor:nextCursor}}:null}};
    });
  });
}
