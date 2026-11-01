// Bounded byte scanner for the immutable captured at-rest JSON. It partitions
// existing bytes; record semantics remain in projection-at-rest and applyEvent.
export const REPLAY_CODEC_TOKEN_BYTES = 128 * 1024;
export const REPLAY_CODEC_CONTROL_BYTES = 8192;
export const REPLAY_CODEC_INPUT_BYTES = 16 * 1024;
const whitespace = byte => byte===32 || byte===9 || byte===10 || byte===13;
const decode = bytes => new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const fail = () => {throw Error('unsupported or corrupt replay projection codec');};
export function initialProjectionScan(){
  return {version:1,offset:0,phase:'start',key:'',keys:[],keyBytes:[],keyEscape:false,
    tokenStart:0,depth:0,string:false,escape:false,messageIndex:0,kind:'metadata',canEnd:true};
}
function validate(state){
  if(!state || state.version!==1 || !Number.isSafeInteger(state.offset) || state.offset<0 || state.offset>4*1024*1024
    || !['start','key-or-end','key','colon','messages-start','message-or-end','value','after-value','after-message','done'].includes(state.phase)
    || !Number.isSafeInteger(state.depth) || state.depth<0 || state.depth>64
    || !Number.isSafeInteger(state.tokenStart) || state.tokenStart<0 || state.tokenStart>state.offset
    || !Number.isSafeInteger(state.messageIndex) || state.messageIndex<0 || state.messageIndex>1000000
    || !Array.isArray(state.keys) || state.keys.length>64 || state.keys.some(k=>typeof k!=='string'||new TextEncoder().encode(k).length>200)
    || new Set(state.keys).size!==state.keys.length || typeof state.key!=='string' || new TextEncoder().encode(state.key).length>200
    || !Array.isArray(state.keyBytes) || state.keyBytes.length>512 || state.keyBytes.some(x=>!Number.isInteger(x)||x<0||x>255)
    || !['metadata','message'].includes(state.kind)
    || ['keyEscape','string','escape','canEnd'].some(k=>typeof state[k]!=='boolean')
    || new TextEncoder().encode(JSON.stringify(state)).length>REPLAY_CODEC_CONTROL_BYTES)fail();
}

// The result records spans only. A complete small token is already in input;
// a spanning token is fetched once from the immutable witness by its bounded
// byte range. No growing token buffer or repeated prefix serialization exists.
export function scanProjectionChunk(current,input,{maximumRecords=32}={}){
  validate(current);
  if(!(input instanceof Uint8Array)||input.length>REPLAY_CODEC_INPUT_BYTES
    || !Number.isInteger(maximumRecords)||maximumRecords<1||maximumRecords>32)fail();
  const state=structuredClone(current),records=[];let i=0;
  const take=()=>{i++;state.offset++;};
  while(i<input.length && records.length<maximumRecords){
    const byte=input[i];
    if(state.phase==='start'){
      if(whitespace(byte)){take();continue;}if(byte!==123)fail();state.phase='key-or-end';state.canEnd=true;take();continue;
    }
    if(state.phase==='key-or-end'){
      if(whitespace(byte)){take();continue;}
      if(byte===125){if(!state.canEnd)fail();state.phase='done';take();continue;}
      if(byte!==34)fail();state.keyBytes=[byte];state.keyEscape=false;state.phase='key';take();continue;
    }
    if(state.phase==='key'){
      if(state.keyBytes.length>=512)fail();state.keyBytes.push(byte);take();
      if(state.keyEscape){state.keyEscape=false;continue;}
      if(byte===92){state.keyEscape=true;continue;}
      if(byte!==34)continue;
      const key=JSON.parse(decode(new Uint8Array(state.keyBytes)));
      if(typeof key!=='string'||new TextEncoder().encode(key).length>200||state.keys.includes(key)||state.keys.length>=64)fail();
      state.key=key;state.keys.push(key);state.keyBytes=[];state.phase='colon';continue;
    }
    if(state.phase==='colon'){
      if(whitespace(byte)){take();continue;}if(byte!==58)fail();take();
      state.phase=state.key==='messages'?'messages-start':'value';state.kind='metadata';state.tokenStart=state.offset;continue;
    }
    if(state.phase==='messages-start'){
      if(whitespace(byte)){take();continue;}if(byte!==91)fail();take();state.phase='message-or-end';state.canEnd=true;continue;
    }
    if(state.phase==='message-or-end'){
      if(whitespace(byte)){take();continue;}
      if(byte===93){if(!state.canEnd)fail();take();state.phase='after-value';continue;}
      state.phase='value';state.kind='message';state.tokenStart=state.offset;continue;
    }
    if(state.phase==='value'){
      const empty=state.offset===state.tokenStart;
      if(empty&&whitespace(byte)){take();state.tokenStart=state.offset;continue;}
      if(!state.string && state.depth===0 && !empty && (whitespace(byte)||byte===44||byte===93||byte===125)){
        const length=state.offset-state.tokenStart;if(length<1||length>REPLAY_CODEC_TOKEN_BYTES)fail();
        records.push({kind:state.kind,key:state.key,index:state.kind==='message'?state.messageIndex++:null,offset:state.tokenStart,length});
        state.phase=state.kind==='message'?'after-message':'after-value';continue;
      }
      if(!state.string){
        if(byte===34)state.string=true;
        else if(byte===123||byte===91){if(++state.depth>64)fail();}
        else if(byte===125||byte===93){if(state.depth===0)fail();state.depth--;}
      }else if(state.escape)state.escape=false;
      else if(byte===92)state.escape=true;
      else if(byte===34)state.string=false;
      take();if(state.offset-state.tokenStart>REPLAY_CODEC_TOKEN_BYTES)fail();continue;
    }
    if(state.phase==='after-message'){
      if(whitespace(byte)){take();continue;}
      if(byte===44){state.phase='message-or-end';state.canEnd=false;take();continue;}
      if(byte===93){state.phase='after-value';take();continue;}fail();
    }
    if(state.phase==='after-value'){
      if(whitespace(byte)){take();continue;}
      if(byte===44){state.phase='key-or-end';state.canEnd=false;take();continue;}
      if(byte===125){state.phase='done';take();continue;}fail();
    }
    if(state.phase==='done'){if(!whitespace(byte))fail();take();continue;}
    fail();
  }
  validate(state);return {state,records,consumed:i,complete:state.phase==='done'};
}

export function decodeProjectionSpan(bytes,record){
  if(!(bytes instanceof Uint8Array)||bytes.length!==record.length||bytes.length>REPLAY_CODEC_TOKEN_BYTES)fail();
  const value=JSON.parse(decode(bytes));
  if(record.kind==='message' && (!value||typeof value!=='object'||Array.isArray(value)
    || typeof value.id!=='string'||new TextEncoder().encode(value.id).length>200))fail();
  return value;
}
