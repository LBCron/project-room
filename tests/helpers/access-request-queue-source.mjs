import {initialRoom} from '../../server/bootstrap.mjs';
import {AccessRequests} from '../../server/access-requests.mjs';
export function seedAccessQueue(store,count,{representation='normalized-current-v1'}={}){
 if(!Number.isSafeInteger(count)||count<1||count>1000)throw Error('Finite request fixture required');
 const room='access-scale';store.initialize(initialRoom(room),{representation});
 const owner=store.issueAccessKey(room,'owner');
 store.command(owner,room,{id:'add-admin',type:'member.added',data:{memberId:'admin',displayName:'Scale Admin',kind:'human',permissions:['manage_members','accept_work']}});
 const admin=store.issueAccessKey(room,'admin'),access=new AccessRequests(store),now=store.now,stamp=store.now();store.now=()=>stamp;
 try{for(let i=0;i<count;i++)addAccessRequest(store,access,room,i);}finally{store.now=now;}
 return{room,owner,admin,access};
}
export function addAccessRequest(store,access,room,index){
 const id=String(index).padStart(4,'0'),identity=store.identities.create('Requester '+id);
 return access.request(room,{identityId:identity.identityId,displayName:'Requester '+id,requestedPermissions:['accept_work','complete_work'],requestId:'pending-'+id,note:'Please grant work participation after review.'},identity.secret);
}
