import {CurrentEventsRoom} from './current-events-worker.test-fixture.mjs';
import {AgentRooms} from '../server/agent-rooms.mjs';
import {publicRoomView} from '../server/public-rooms.mjs';
import {auditRecovery} from '../server/recovery.mjs';
export class NativePublicRoom extends CurrentEventsRoom {
 async fetch(request){const path=new URL(request.url).pathname,s=this.store;try{
  if(path==='/seed'){const owner=s.identities.create('Native founder'),peer=s.identities.create('Native collaborator');new AgentRooms(s).create(owner.secret,{roomId:'native-public',title:'Native public project',purpose:'Share useful work',starter:false});await this.ctx.storage.put('saved',{owner,peer});return Response.json({ok:true});}
  const {owner,peer}=await this.ctx.storage.get('saved');s.room=()=>{throw Error('Whole room hydration forbidden');};
  if(path==='/open'){
   const original=s.db.prepare.bind(s.db);let injected=false;s.db.prepare=sql=>{const st=original(sql);if(!sql.startsWith('INSERT INTO public_rooms'))return st;return new Proxy(st,{get(target,key){const v=Reflect.get(target,key,target);if(key!=='run')return typeof v==='function'?v.bind(target):v;return(...args)=>{v.apply(target,args);injected=true;throw Error('synthetic publication save failure');};}});};
   try{s.command(owner.secret,'native-public',{id:'public-on',type:'room.public_page_set',data:{enabled:true}});throw Error('fault not reached');}catch(e){if(e.message!=='synthetic publication save failure')throw e;}finally{s.db.prepare=original;}
   if(!injected||s.db.prepare('SELECT count(*) n FROM public_rooms').get().n!==0)throw Error('publication rollback differs');
   s.command(owner.secret,'native-public',{id:'public-on',type:'room.public_page_set',data:{enabled:true}});
   if(publicRoomView(s,'native-public').document.join.mode!=='request')throw Error('showcase widened admission');
   s.command(owner.secret,'native-public',{id:'link-on',type:'room.join_link_set',data:{enabled:true}});const page=publicRoomView(s,'native-public').document;
   const token=page.join.href.split('#join/')[1];await this.ctx.storage.put('token',token);s.shareLinks.joinAgent(peer.secret,token,'Native collaborator');return Response.json({ok:true,counts:publicRoomView(s,'native-public').document.counts,coverage:page.coverage});
  }
  const token=await this.ctx.storage.get('token');if(path==='/cold'){const seq=s.headSequence('native-public'),retry=s.shareLinks.joinAgent(peer.secret,token,'Native collaborator');if(!retry.duplicate||s.headSequence('native-public')!==seq)throw Error('retry advanced');const before={...this.stats};s.command(peer.secret,'native-public',{id:'welcome',type:'message.posted',data:{messageId:'welcome',body:'Native useful welcome'}});const cost=Object.fromEntries(Object.keys(before).map(k=>[k,this.stats[k]-before[k]]));auditRecovery(s);return Response.json({ok:true,counts:publicRoomView(s,'native-public').document.counts,cost});}
  throw Error('Unknown test path');
 }catch(e){return Response.json({code:e.code,message:e.message},{status:e.status??500});}}
}
export default{fetch:(request,env)=>env.ROOM.getByName('native-public').fetch(request)};
