// Disposable local producer fixture shared by Native and browser measurements.
export function seedAccessStore(store,count,{initialRoom,AccessRequests}){
 if(![25,1000].includes(count))throw Error('Unsupported finite request count');
 const room='access-scale';
 store.initialize(initialRoom(room),{representation:'normalized-current-v1'});
 const owner=store.issueAccessKey(room,'owner');
 store.command(owner,room,{id:'add-admin',type:'member.added',data:{memberId:'admin',displayName:'Scale Admin',kind:'human',permissions:['manage_members','accept_work']}});
 const admin=store.issueAccessKey(room,'admin'),access=new AccessRequests(store);
 const now=store.now,stamp=store.now();store.now=()=>stamp;
 try{
  for(let i=0;i<count;i++){
   const index=String(i).padStart(4,'0'),identity=store.identities.create('Requester '+index);
   access.request(room,{identityId:identity.identityId,displayName:'Requester '+index,requestedPermissions:['accept_work','complete_work'],requestId:'pending-'+index,note:'Please grant work participation after review.'},identity.secret);
  }
 }finally{store.now=now;}
 return{room,owner,admin,count};
}
