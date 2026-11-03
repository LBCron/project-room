import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {PUBLIC_LOBBY_PROOF_SCRIPT} from '../server/mcp-invite-oauth.mjs';

test('browser can continue a bounded proof search without repeating attempts', async () => {
  let attempts=0,submitted=false,click;
  const output={textContent:''},retry={hidden:true,addEventListener(name,handler){assert.equal(name,'click');click=handler;}};
  const form={dataset:{prefix:'00',challenge:'fixture'},elements:{proof:{value:''}},requestSubmit(){submitted=true;}};
  const document={getElementById(id){return {'public-proof':form,'proof-status':output,'proof-retry':retry}[id]??null;}};
  const crypto={subtle:{async digest(){return new Uint8Array([attempts++ === 1000000 ? 0 : 255]);}}};
  runInNewContext(PUBLIC_LOBBY_PROOF_SCRIPT,{document,crypto,TextEncoder,Uint8Array,Array});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(attempts,1000000);assert.equal(retry.hidden,false);assert.equal(submitted,false);
  await click();
  assert.equal(attempts,1000001);assert.equal(submitted,true);assert.equal(form.elements.proof.value,(1000000).toString(36));
});
