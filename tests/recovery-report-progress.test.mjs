import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {reportProgressGuard} from './helpers/recovery-report-progress.mjs';
function fixture(t){const source=new RoomStore(':memory:');t.after(()=>source.close());const guard=reportProgressGuard(source,assert);const state=(frontier,revision=0)=>({revision,progress:{audit:{stage:'full_audit_pending',units:revision,report:frontier===null?null:{stage:'source',tableIndex:0,rowAfter:frontier}}}});const mark=guard.before(state(null));guard.after(mark,state('initial'));return{guard,state};}
test('opaque Native report identity refuses revision and counter churn without work',t=>{
 const{guard,state}=fixture(t),mark=guard.before(state('held',1));
 assert.throws(()=>guard.after(mark,state('held',2)),/actual source\/merge\/hash frontier/);
});
test('source-derived report budget still refuses an endless sequence of new identities',t=>{
 const{guard,state}=fixture(t),budget=guard.summary().reportCallBudget;
 assert.ok(Number.isSafeInteger(budget)&&budget>0);
 for(let i=guard.summary().reportCalls;i<budget;i++)guard.after(guard.before(state('before-'+i)),state('after-'+i));
 assert.throws(()=>guard.after(guard.before(state('overflow-before')),state('overflow-after')),/exceed exact T0 source\/chunk\/merge work bound/);
});
