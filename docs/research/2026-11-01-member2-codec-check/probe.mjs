// Independent finite differential check; candidate remains unwired/uncertified.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {initialProjectionScan,scanProjectionChunk,decodeProjectionSpan,projectionMapFrame,
 REPLAY_CODEC_TOKEN_BYTES,REPLAY_CODEC_CONTROL_BYTES,REPLAY_CODEC_INPUT_BYTES} from '../../../server/replay-projection-codec.mjs';
const counts={validCases:0,splitExecutions:0,steps:0,records:0,invalidCases:0,controls:0,maxControlBytes:0,maxSpanBytes:0,maxInputBytes:0};
function scan(text,width=16384,maxRecords=32){
 const source=typeof text==='string'?Buffer.from(text):text;let state=initialProjectionScan();const records=[];
 while(state.offset<source.length){
  const size=Array.isArray(width)?width[counts.steps%width.length]:width;
  const chunk=source.subarray(state.offset,state.offset+size);
  const step=scanProjectionChunk(JSON.parse(JSON.stringify(state)),chunk,{maximumRecords:maxRecords});
  assert.ok(step.consumed>0||step.records.length>0,'nonprogress');assert.ok(step.consumed<=chunk.length);
  assert.equal(step.state.offset,state.offset+step.consumed);assert.ok(step.records.length<=maxRecords);
  counts.maxInputBytes=Math.max(counts.maxInputBytes,chunk.length);
  for(const r of step.records){
   assert.ok(r.offset>=0&&r.offset+r.length<=source.length);
   if(r.kind==='metadata-map'){records.push({...r,value:projectionMapFrame(r)});continue;}
   assert.ok(r.length<=REPLAY_CODEC_TOKEN_BYTES);counts.maxSpanBytes=Math.max(counts.maxSpanBytes,r.length);
   const value=decodeProjectionSpan(source.subarray(r.offset,r.offset+r.length),r);
   records.push({...r,value});
  }
  state=step.state;counts.steps++;counts.records+=step.records.length;
  const sizeControl=Buffer.byteLength(JSON.stringify(state));assert.ok(sizeControl<=REPLAY_CODEC_CONTROL_BYTES);counts.maxControlBytes=Math.max(counts.maxControlBytes,sizeControl);
 }
 assert.equal(state.phase,'done','incomplete source');
 const metadata=records.filter(r=>r.kind==='metadata'),maps=records.filter(r=>r.kind==='metadata-map');
 const entries=records.filter(r=>r.kind==='metadata-entry');
 const output=Object.fromEntries(metadata.map(r=>[r.key,r.value]));
 if(state.keys.includes('messages'))output.messages=records.filter(r=>r.kind==='message').map(r=>r.value);
 for(const map of maps){const children=entries.filter(r=>r.key===map.key);assert.equal(children.length,map.value.entries);
  for(const r of children){assert.ok(r.keyOffset>=map.offset&&r.keyOffset+r.keyLength<=map.offset+map.length);assert.equal(JSON.parse(source.subarray(r.keyOffset,r.keyOffset+r.keyLength).toString()),r.entryKey);}
  output[map.key]=Object.fromEntries(children.map(r=>[r.entryKey,r.value]));
 }
 return {output,state,records};
}
let seed=0x519ea271;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const strings=['','é中🦉','\\"\n\r\t\b\f','\u0000','\u2028\u2029','\ufeff','\ud800','\udfff','brackets ] } [ {','é'.repeat(13),'\\\\\\"'];
function value(depth=0){
 const kind=Math.floor(rand()*(depth<3?7:4));
 if(kind===0)return null;if(kind===1)return rand()<.5;if(kind===2)return (rand()-.5)*1e20;
 if(kind===3)return strings[Math.floor(rand()*strings.length)];
 if(kind===4)return Array.from({length:Math.floor(rand()*4)},()=>value(depth+1));
 return Object.fromEntries(Array.from({length:Math.floor(rand()*4)},(_,i)=>['key'+i+strings[Math.floor(rand()*4)],value(depth+1)]));
}
const corpus=[];
for(let i=0;i<400;i++)corpus.push(JSON.stringify({room:{id:'synthetic',name:strings[i%strings.length]},messages:Array.from({length:i%5},(_,j)=>({id:`m${j}`,body:strings[(i+j)%strings.length],data:value()})),replyRequests:Object.fromEntries(Array.from({length:i%4},(_,j)=>['entry'+j+strings[(i+j)%6],value()])),metadata:value()}));
corpus.push('{"messages":[],"replyRequests":{},"__proto__":{"polluted":true},"constructor":"own"}');
corpus.push(' \r\n {"messages":[{"id":"a","n":-0,"big":1e400,"small":1e-400}],"replyRequests":{"a\\u0062":null,"\\ud800":true},"none":null}\t ');
corpus.push('{"\\u006des\\u0073ages":[{"id":"escape","body":"\\uD83E\\uDD89"}],"replyRequests":{"\\u0078":{}}}');
for(const text of corpus){
 const reference=JSON.parse(text);counts.validCases++;
 for(const width of [1,2,3,7,31,16384,[1,2,7,3,64]])for(const cap of [1,32]){
  assert.deepEqual(scan(text,width,cap).output,reference);counts.splitExecutions++;
 }
}
// Force delimiters, UTF-8 and odd/even escapes across real 16KiB boundaries.
for(const near of [16374,16375,16376,16377,16378,16379,16380,32760,32761]){
 const text=JSON.stringify({messages:[{id:'edge',body:'x'.repeat(near)+'🦉é\\"\\\\'}],replyRequests:{edge:{body:'中'}}});
 for(const width of [16383,16384,[16384,1]]){assert.deepEqual(scan(text,width,1).output,JSON.parse(text));counts.splitExecutions++;}counts.validCases++;
}
// Exact value byte budget and +1, with the same valid JSON shape.
const base=Buffer.byteLength(JSON.stringify({id:'max',body:''}));
for(const excess of [0,1]){
 const text=JSON.stringify({messages:[{id:'max',body:'x'.repeat(REPLAY_CODEC_TOKEN_BYTES-base+excess)}]});
 if(excess)assert.throws(()=>scan(text,16384,1));else assert.deepEqual(scan(text,16384,1).output,JSON.parse(text));counts.controls++;
}
for(const depth of [64,65]){const text='{"messages":[],"n":'+'['.repeat(depth)+'0'+']'.repeat(depth)+'}';if(depth===64)assert.deepEqual(scan(text,1).output,JSON.parse(text));else assert.throws(()=>scan(text,1));counts.controls++;}
for(const n of [64,65]){const text=JSON.stringify(Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,0])));if(n===64)assert.deepEqual(scan(text).output,JSON.parse(text));else assert.throws(()=>scan(text));counts.controls++;}
for(const n of [200,201]){const text=JSON.stringify({[String('x').repeat(n)]:true});if(n===200)assert.deepEqual(scan(text,1).output,JSON.parse(text));else assert.throws(()=>scan(text,1));counts.controls++;}
for(const excess of [0,1]){const key='中'.repeat(66)+'x'.repeat(2+excess),text=JSON.stringify({[key]:true});if(excess)assert.throws(()=>scan(text,1));else assert.deepEqual(scan(text,1).output,JSON.parse(text));counts.controls++;}
for(const n of [85,86]){const text='{"'+'\\u0061'.repeat(n)+'":true}';if(n===85)assert.deepEqual(scan(text,1).output,JSON.parse(text));else assert.throws(()=>scan(text,1));counts.controls++;}
for(const excess of [0,1]){const state={...initialProjectionScan(),padding:''};state.padding='x'.repeat(REPLAY_CODEC_CONTROL_BYTES-Buffer.byteLength(JSON.stringify(state))+excess);if(excess)assert.throws(()=>scanProjectionChunk(state,new Uint8Array()));else assert.equal(Buffer.byteLength(JSON.stringify(scanProjectionChunk(state,new Uint8Array()).state)),REPLAY_CODEC_CONTROL_BYTES);counts.controls++;}
for(const length of [1,2]){const state={...initialProjectionScan(),phase:'done',offset:4*1024*1024-1};if(length===1)assert.equal(scanProjectionChunk(state,Buffer.from(' ')).state.offset,4*1024*1024);else assert.throws(()=>scanProjectionChunk(state,Buffer.from('  ')));counts.controls++;}
const invalid=['{"messages":[{"id":"a"},]}','{"x":true,}','{"x":[1,2}}','{"x":"\\u12"}','{"x":00}','{"x":NaN}','{"x":undefined}','{"x":"\n"}','{"x":true}junk','{"x":true','{"replyRequests":{"a":1,}}','{"messages":[{"id":"a"}]}\u0000'];
for(const text of invalid){assert.throws(()=>JSON.parse(text));for(const width of [1,7,16384])assert.throws(()=>scan(text,width));counts.invalidCases++;}
for(const bytes of [Buffer.from([0xff]),Buffer.from([0xc0,0xaf]),Buffer.from([0xed,0xa0,0x80]),Buffer.from([0xf4,0x90,0x80,0x80]),Buffer.from([0xe2,0x82])]){
 const text=Buffer.concat([Buffer.from('{"x":"'),bytes,Buffer.from('","messages":[]}')]);assert.throws(()=>scan(text,1));counts.invalidCases++;
}
for(const limit of [0,33,1.2]){assert.throws(()=>scanProjectionChunk(initialProjectionScan(),Buffer.from('{}'),{maximumRecords:limit}));counts.controls++;}
for(const [field,value] of [['depth',65],['offset',4194305],['keyBytes',Array(513).fill(65)],['messageIndex',1000001],['entryKeyOffset',-1],['keys',Array(65).fill('x')]]){assert.throws(()=>scanProjectionChunk({...initialProjectionScan(),[field]:value},new Uint8Array()));counts.controls++;}
assert.throws(()=>scanProjectionChunk(initialProjectionScan(),new Uint8Array(REPLAY_CODEC_INPUT_BYTES+1)));counts.controls++;
const src=await readFile(new URL('../../../server/replay-projection-codec.mjs',import.meta.url),'utf8');
const result={candidate:'f4e2e862cac2c8c048e5b9ce889554c13c787621',codecSha256:createHash('sha256').update(src).digest('hex'),node:process.version,at:new Date().toISOString(),status:'passed',counts,limitations:['Pure offline codec and framing only; not cutover admission, trust receipts or semantic replay','Duplicate-key policy intentionally differs from JSON.parse and is enforced by caller; not treated as differential success','No production mutation, runtime edits, private corpus or broad suites','Finite deterministic corpus, not exhaustive proof']};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
