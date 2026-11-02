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
const script=(await build({stdin:{contents:await readFile(lab+'official_sdk_native_fixture.mjs','utf8'),resolveDir:repo+'/cloudflare',sourcefile:'official-sdk-native-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'neutral',nodePaths:[deps+'/node_modules',deps+'/cloudflare/node_modules'],external:['node:*','cloudflare:*']})).outputFiles[0].text;
const dir=await mkdtemp(join(tmpdir(),'official-sdk-native-')),origin='https://room.example',clientConfig={clientId:'native-sdk-local',name:'Native SDK local',redirectUris:['https://client.example/callback']};
const create=()=>new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:join(dir,'do'),kvPersist:join(dir,'kv'),durableObjects:{ROOM:{className:'OfficialSdkRoom',useSQLite:true}},kvNamespaces:['ROOM_BACKUPS_KV'],bindings:{ROOM_ORIGIN:origin,ROOM_MCP_OAUTH_CLIENTS:JSON.stringify([clientConfig])},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
let mf=create(),client;const requests=[];
const fixture=async path=>{const r=await mf.dispatchFetch(origin+path);assert.equal(r.status,200);return r.json();};
async function connect(token){client=new Client({name:'Official Native qualification',version:'1'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:async(url,init={})=>{assert.equal(new URL(url).origin,origin);const h=new Headers(init.headers);requests.push({method:h.get('mcp-method'),protocol:h.get('mcp-protocol-version')});const response=await mf.dispatchFetch(String(url),init);requests.at(-1).status=response.status;return response;},requestInit:{headers:{Authorization:'Bearer '+token}}}));return client;}
const args={id:'official-sdk-native-one',body:'Synthetic official SDK Native message'};
try{
 const {tokens}=await fixture('/__seed');await connect(tokens.accessToken);
 const tools=await client.listTools();for(const name of ['room_post_message','room_read_work','room_claim','room_submit_text_result'])assert.ok(tools.tools.some(t=>t.name===name),name);assert.ok(!tools.tools.some(t=>t.name==='room_create_agent_invite'));
 assert.notEqual((await client.callTool({name:'room_post_message',arguments:args})).isError,true);
 const before=await fixture('/__facts');await client.close();client=null;await mf.dispose();mf=create();await connect(tokens.accessToken);
 assert.notEqual((await client.callTool({name:'room_post_message',arguments:args})).isError,true);const after=await fixture('/__facts');assert.deepEqual(after,before);
 await fixture('/__revoke');let refused=false;try{const r=await client.callTool({name:'room_post_message',arguments:{id:'after-revoke',body:'Must not post'}});refused=r.isError===true;}catch(e){refused=e.code!==undefined||/401|unauthorized/i.test(e.message);}assert.equal(refused,true,'Revoked grant must be refused');assert.equal(requests.at(-1).status,401,'Revoked call must return actual HTTP 401');assert.deepEqual(await fixture('/__facts'),after);
 assert.ok(requests.every(r=>r.protocol==='2026-07-28'));
 const result={source:pin,client:'@modelcontextprotocol/client@2.4.0',runtime:'Actual local July workerd with persisted SQLite Durable Object',transport:'Official StreamableHTTP SDK via origin-restricted Miniflare fetch dispatch',catalogAuthorized:true,attributedSinglePost:true,coldReconnect:true,exactRetryAddsNoEvent:true,revokedGrantRefused:true,revokedHttpStatus:401,revokedCallAddsNoEvent:true,requestCount:requests.length,allProtocolHeadersCorrect:true,scope:'Local qualification only. No external callback, hosted deployment, whole-suite or other laptop execution claim.'};await writeFile(lab+'official-sdk-native-receipt.json',JSON.stringify(result,null,2)+'\n');console.log('OFFICIAL_SDK_NATIVE '+JSON.stringify(result));
}finally{if(client)await client.close();await mf.dispose();await rm(dir,{recursive:true,force:true});}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
