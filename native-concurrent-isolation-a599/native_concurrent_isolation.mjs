import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const lab=fileURLToPath(new URL('.',import.meta.url)),repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',deps='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-access-kv-composed-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',git=process.env.LOCAL_LAB_GIT;
assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
const require=createRequire(deps+'/cloudflare/package.json'),{build}=await import(pathToFileURL(require.resolve('esbuild'))),{Miniflare}=await import(pathToFileURL(require.resolve('miniflare')));
const {Client,StreamableHTTPClientTransport}=await import(pathToFileURL(lab+'mcp2-reference/node_modules/@modelcontextprotocol/client/dist/index.mjs'));
const script=(await build({stdin:{contents:await readFile(lab+'native_concurrent_isolation_fixture.mjs','utf8'),resolveDir:repo+'/cloudflare',sourcefile:'official-sdk-native-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'neutral',nodePaths:[deps+'/node_modules',deps+'/cloudflare/node_modules'],external:['node:*','cloudflare:*']})).outputFiles[0].text;
const dir=await mkdtemp(join(tmpdir(),'official-sdk-native-')),origin='https://room.example',clientConfig={clientId:'native-sdk-local',name:'Native SDK local',redirectUris:['https://client.example/callback']};
const create=()=>new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:join(dir,'do'),kvPersist:join(dir,'kv'),durableObjects:{ROOM:{className:'OfficialSdkRoom',useSQLite:true}},kvNamespaces:['ROOM_BACKUPS_KV'],bindings:{ROOM_ORIGIN:origin,ROOM_MCP_OAUTH_CLIENTS:JSON.stringify([clientConfig])},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
let mf=create(),client;const requests=[],clients=[];
const fixture=async path=>{const r=await mf.dispatchFetch(origin+path);assert.equal(r.status,200);return r.json();};
async function connect(token){client=new Client({name:'Official Native qualification',version:'1'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});clients.push(client);await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:async(url,init={})=>{assert.equal(new URL(url).origin,origin);const h=new Headers(init.headers);const record={method:h.get('mcp-method'),protocol:h.get('mcp-protocol-version')};requests.push(record);const response=await mf.dispatchFetch(String(url),init);record.status=response.status;return response;},requestInit:{headers:{Authorization:'Bearer '+token}}}));return client;}
async function invoke(c,name,args){try{const r=await c.callTool({name,arguments:args});const body=r.structuredContent??(r.isError?JSON.parse(r.content.find(x=>x.type==='text').text):null);return {ok:r.isError!==true,reason:body?.code??body?.error?.code,raw:JSON.stringify(r)};}catch(e){return {ok:false,reason:e.data?.reason??e.code,raw:JSON.stringify({message:e.message,data:e.data})};}}
try{
 const f=await fixture('/__seed'),agents=[];for(const x of f)agents.push(await connect(x.tokens.accessToken));
 for(const c of agents)await c.listTools();
 for(let wave=0;wave<4;wave++){
  const r=await Promise.all(f.map((x,i)=>invoke(agents[i],'room_post_message',{roomId:x.roomId,id:'isolation-'+wave,body:'sdk-isolation-'+x.roomId+'-'+wave})));
  r.forEach((x,i)=>{assert.equal(x.ok,true);assert.equal(x.raw.includes(f[1-i].canary),false);});
 }
 const before=await fixture('/__facts');assert.deepEqual(before.map(x=>x.posts),[4,4]);
 const reads=await Promise.all(f.map((x,i)=>invoke(agents[i],'room_read_messages',{roomId:x.roomId,limit:25})));
 reads.forEach((x,i)=>{assert.equal(x.ok,true);assert.ok(x.raw.includes(f[i].canary));assert.equal(x.raw.includes(f[1-i].canary),false);});
 const crossed=await Promise.all(f.flatMap((x,i)=>[
  invoke(agents[i],'room_read_messages',{roomId:f[1-i].roomId,limit:25}),
  invoke(agents[i],'room_post_message',{roomId:f[1-i].roomId,id:'crossed-'+i,body:'sdk-isolation-wrong-room'})
 ]));
 assert.ok(crossed.every(x=>!x.ok&&x.reason==='invalid_arguments'));assert.ok(crossed.every(x=>f.every(y=>!x.raw.includes(y.canary))));assert.deepEqual(await fixture('/__facts'),before);
 const rest=await Promise.all(f.map(x=>mf.dispatchFetch(origin+'/api/rooms/'+x.roomId,{headers:{Authorization:'Bearer '+x.tokens.accessToken}})));assert.ok(rest.every(r=>r.status===401));
 await fixture('/__revoke-alpha');const mixed=await Promise.all(f.map((x,i)=>invoke(agents[i],'room_post_message',{roomId:x.roomId,id:'mixed-after-revoke',body:'sdk-isolation-'+x.roomId+'-after-revoke'})));
 assert.equal(mixed[0].ok,false);assert.equal(mixed[1].ok,true);const after=await fixture('/__facts');assert.deepEqual(after[0],before[0]);assert.equal(after[1].posts,5);assert.equal(after[1].head,before[1].head+1);assert.deepEqual(requests.slice(-2).map(r=>r.status).sort(),[200,401]);
 assert.ok(requests.every(r=>r.protocol==='2026-07-28'));
 const result={source:pin,client:'@modelcontextprotocol/client@2.4.0',runtime:'Actual local July workerd/persistent SQLite',agents:2,rooms:2,simultaneousPostWaves:4,successfulPosts:9,allPostsAttributedToBoundAgent:true,ownPrivateCanaryReadable:true,foreignPrivateCanaryNeverReturned:true,crossedReadAndWriteRefused:crossed.map(x=>x.reason),crossedCallsAddNoEvents:true,oauthTokensRefusedAtRest:true,revokedAgentRefusedBesideValidAgent:true,mixedHttpStatuses:[200,401],requestCount:requests.length,protocolHeadersCorrect:true,scope:'Simultaneously submitted actual SDK requests via origin-restricted Miniflare dispatch; no forced execution interleaving, stress/throughput, hosted release or peer-device execution claim.'};await writeFile(lab+'native-concurrent-isolation-receipt.json',JSON.stringify(result,null,2)+'\n');console.log('NATIVE_CONCURRENT_ISOLATION '+JSON.stringify(result));
}finally{for(const c of clients)await c.close();await mf.dispose();await rm(dir,{recursive:true,force:true});}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
