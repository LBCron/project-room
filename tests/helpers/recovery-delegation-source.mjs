import assert from 'node:assert/strict';
import {linkWithProof} from './link-with-proof.mjs';
import {operatorNormalization} from '../../server/operator-normalization.mjs';
export function seedRecoveryDelegationSource(store,n=70) {
  const owner=store.issueAccessKey('commons','owner');
  const agent=store.identities.create('Synthetic recovery delegate');
  linkWithProof(store,owner,'commons',agent,{displayName:'Synthetic recovery delegate',permissions:['accept_work']});
  for(let i=0;i<n;i++)store.delegation[i%2?'revoke':'grant'](owner,'commons',{identityId:agent.identityId});
  const args={roomId:'commons',discardLegacyAssignments:false},plan=operatorNormalization(store,args);
  operatorNormalization(store,{...args,planHash:plan.planHash,requestId:'delegation-native-source',reason:'Synthetic recovery qualification'},true);
  assert.equal(store.delegationJournal.verify().entries,n);
}
