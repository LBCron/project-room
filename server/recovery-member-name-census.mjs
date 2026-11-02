import {createHash} from 'node:crypto';
import {assertMemberDisplayNameAvailable} from '../src/display-name-guard.js';
const fail=()=>{throw Error('Recovery member name census requires reconciliation');};
const binding=incoming=>createHash('sha256').update(JSON.stringify([incoming.id,incoming.type,incoming.data?.displayName,incoming.data?.displayNamePolicyVersion])).digest('hex');
export const initialRecoveryMemberNames=(incoming,memberCount)=>({version:1,source:binding(incoming),members:memberCount,index:0,complete:false});
export function validateRecoveryMemberNames(c){if(!c||Object.keys(c).sort().join(',')!=='complete,index,members,source,version'||c.version!==1||!/^[a-f0-9]{64}$/.test(c.source)||!Number.isSafeInteger(c.members)||c.members<0||!Number.isSafeInteger(c.index)||c.index<0||c.index>c.members||typeof c.complete!=='boolean'||c.complete&&c.index!==c.members)fail();}
// `read` addresses the existing independent prior replay values, including
// their original insertion-order index. It owns scalar/input admission and
// the same durable transaction as the returned census cursor.
export function advanceRecoveryMemberNames(read,incoming,memberCount,previous,{maxUnits=32}={}){
 validateRecoveryMemberNames(previous);if(typeof read!=='function'||!Number.isInteger(maxUnits)||maxUnits<1||maxUnits>128||previous.source!==binding(incoming)||previous.members!==memberCount||!['member.added','member.joined_via_invitation'].includes(incoming.type)||![1,2].includes(incoming.data?.displayNamePolicyVersion))fail();
 const c = {...previous};
 const options = { firstWordRule: incoming.data.displayNamePolicyVersion >= 2 };
 let units=0;
 // Original invalid-name behavior is intentionally retained: this assertion
 // owns admission reasons, while the caller retains empty/length validation.
 assertMemberDisplayNameAvailable(incoming.data.displayName,[],options);
 while(c.index<c.members&&units<maxUnits){
  const id=read('replayOrder',JSON.stringify(['members',c.index]));if(typeof id!=='string')fail();const member=read('members',id);if(!member||member.id!==id)fail();
  // Each collision predicate is an existential test over active prior names.
  // Applying the SAME predicate to every singleton preserves its acceptance
  // for the entire set, including confusables, v1 and inactive records.
  assertMemberDisplayNameAvailable(incoming.data.displayName,[member],options);c.index++;units++;
 }
 c.complete=c.index===c.members;return{cursor:c,units,done:c.complete};
}
export function completedRecoveryMemberNames(incoming,memberCount,cursor){
 validateRecoveryMemberNames(cursor);if(!cursor.complete||cursor.source!==binding(incoming)||cursor.members!==memberCount)fail();const name=incoming.data.displayName,version=incoming.data.displayNamePolicyVersion;
 return(proposed,policy)=>{if(proposed!==name||policy!==version)fail();return true;};
}
