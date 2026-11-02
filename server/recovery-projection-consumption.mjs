import {inRestoreContext,restoreProgress,RESTORE_AUDIT_VERSION} from './restore-admission.mjs';
import {verifyRestoreFreeze} from './writer-fence.mjs';
const scopes=new WeakMap();
const fail=()=>{throw Error('Recovery projection equality proof requires reconciliation');};
function authority(store,id,sealId) {
 const db=store.db;if(!db.isTransaction||!inRestoreContext(db))fail();
 const state=restoreProgress(db),a=state.progress?.audit;
 if(state.state!=='pending'||state.phase!=='audit_pending'||state.restore_id!==id||state.seal?.id!==sealId||state.seal.auditVersion!==RESTORE_AUDIT_VERSION||a?.version!==RESTORE_AUDIT_VERSION||a.stage!=='full_audit_pending')fail();
 const expected=name=>state.seal.tables.find(t=>t.name===name)?.expected.rows;
 if(!['equalityRooms','equalityDeferred','legacyRooms','rooms'].every(k=>Number.isSafeInteger(a[k])&&a[k]>=0)||a.equalityDeferred>a.equalityRooms||!/^[a-f0-9]{64}$/.test(a.equalityHash??''))fail();
 if(a.rooms!==a.equalityRooms||a.rooms+a.legacyRooms!==expected('rooms')||a.rooms!==expected('current_room_head'))fail();
 return{state,complete:a.legacyRooms===0&&a.equalityDeferred===0};
}
// Same target-owned continuation authority as other consumed components.
// The chain summarizes the complete ordered per-room closures; it is not a
// portable source certificate. All source rows remain frozen through publication.
export function withCompletedRecoveryProjectionParity(store,id,sealId,operation) {
 const {state,complete}=authority(store,id,sealId);if(!complete)return operation();
 verifyRestoreFreeze(store.db,state.seal.inventory);
 const before=scopes.get(store.db),scope={id,sealId,revision:state.revision,coverage:state.coverage,sourceSeal:state.source_seal};scopes.set(store.db,scope);
 try {const result=operation();if(result?.then)fail();completedRecoveryProjectionParity(store);return result;}
 finally{if(before)scopes.set(store.db,before);else scopes.delete(store.db);}
}
export function completedRecoveryProjectionParity(store) {
 const scope=scopes.get(store.db);if(!scope)return false;
 const {state,complete}=authority(store,scope.id,scope.sealId);
 if(!complete||state.revision!==scope.revision||state.coverage!==scope.coverage||state.source_seal!==scope.sourceSeal)fail();
 return true;
}
