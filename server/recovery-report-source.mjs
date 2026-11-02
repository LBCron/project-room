import {reportSnapshotCellInfo,reportSnapshotCellValue,reportSnapshotCellBytes} from './recovery-report-snapshot.mjs';
import {Buffer} from 'node:buffer';
import {REPORT_CHUNK_UNITS} from './recovery-report-continuation.mjs';
// SQL rows are flat objects; nested JSON stored in a TEXT column remains TEXT.
// Source row identity and freeze authority are provided by the report owner.
const fail=()=>{throw Error('Recovery report source requires reconciliation');};
const ident=v=>{if(typeof v!=='string'||v.length>128||!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(v))fail();return '"'+v+'"';};
export function recoveryReportRowid(value){
 if(typeof value==='number'){if(!Number.isSafeInteger(value))fail();value=String(value);}
 if(typeof value!=='string'||!/^(-?[1-9][0-9]*|0)$/.test(value)||value.length>20)fail();
 const n=BigInt(value);if(n < -9223372036854775808n || n > 9223372036854775807n)fail();return value;
}
export function initialRecoveryReportRow(db,table,rowid,maximumBytes){
 rowid=recoveryReportRowid(rowid);if(!Number.isSafeInteger(maximumBytes)||maximumBytes<0)fail();
 const columns=db.prepare('PRAGMA table_info('+ident(table)+')').all().map(r=>r.name).sort();
 if(!columns.length||columns.length>128||columns.some(c=>c.toLowerCase()==='rowid'||c==='__report_rid'))fail();columns.forEach(ident);
 return{version:1,table,rowid,maximumBytes,columns,column:0,phase:'open',output:'',offset:0,length:0,carry:'',blobIndex:0,sourceBytes:0};
}
function validate(p){
 if(!p||Object.keys(p).sort().join(',')!=='blobIndex,carry,column,columns,length,maximumBytes,offset,output,phase,rowid,sourceBytes,table,version'||p.version!==1
  ||!['open','key','cell','text','blob','done'].includes(p.phase)||typeof p.rowid!=='string'
  ||!['maximumBytes','column','offset','length','blobIndex','sourceBytes'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)
  ||!Array.isArray(p.columns)||!p.columns.length||p.columns.length>128||p.column>p.columns.length
   || p . columns . some ( ( c , i ) => typeof   c !== 'string' || i && p . columns [ i - 1 ] >= c ) || typeof   p . output !== 'string' || p . output . length > REPORT_CHUNK_UNITS + 16384
  ||typeof p.carry!=='string'||p.carry.length>6||p.offset>p.length||p.sourceBytes>p.maximumBytes+p.columns.length*32
  ||JSON.stringify(p).length>256*1024)fail();recoveryReportRowid(p.rowid);ident(p.table);p.columns.forEach(ident);
}
function textPiece(hex,carry,last){
 if(typeof hex!=='string'||!/^(?:[0-9A-F]{2})*$/.test(hex))fail();let bytes=Buffer.concat([Buffer.from(carry,'hex'),Buffer.from(hex,'hex')]),cut=bytes.length;
 if(!last){let start=bytes.length-1;while(start>=0&&(bytes[start]&0xc0)===0x80)start--;if(start>=0){const first=bytes[start],wanted=first<0x80?1:first>=0xc2&&first<0xe0?2:first<0xf0?3:4;if(bytes.length-start<wanted)cut=start;}}
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,cut));
 return{text,carry:bytes.subarray(cut).toString('hex')};
}
const nextBlob=(n,length)=>{if(n!==0&&n*10<length)return n*10;while(n%10===9||n+1>=length){n=Math.floor(n/10);if(n===0)return length;}return n+1;};
export function advanceRecoveryReportRow(db,current,{maxUnits=32,snapshot=null,scratch=null}={}){
 validate(current);if(!Number.isInteger(maxUnits)||maxUnits<1||maxUnits>32)fail();const p=structuredClone(current),snapshotCache=new Map();let units=0;
 const finishCell=()=>{p.column++;p.phase='key';p.offset=p.length=0;p.carry='';p.blobIndex=0;};
 while(units<maxUnits){
   if ( p . output . length >= REPORT_CHUNK_UNITS || p . phase === 'done' ) break ;
  if(p.phase==='open'){p.output+='{';p.phase='key';continue;}
  if(p.phase==='key'){if(p.column===p.columns.length){p.output+='}';p.phase='done';continue;}p.output+=(p.column?',':'')+JSON.stringify(p.columns[p.column])+':';p.phase='cell';continue;}
  const name=p.columns[p.column],column=ident(name),table=ident(p.table),virtual=p.table==='current_restore_admission'&&snapshot!==null;
  if(virtual&&(!scratch||p.rowid!=='1'))fail();
  if(p.phase==='cell'){
   const info=virtual?reportSnapshotCellInfo(snapshot,name):db.prepare(`SELECT typeof(${column}) kind,length(CAST(${column} AS BLOB)) bytes FROM ${table} WHERE rowid=?`).get(p.rowid);units++;
   if(!info||!['null','text','blob','integer','real'].includes(info.kind)||info.bytes!==null&&(!Number.isSafeInteger(info.bytes)||info.bytes<0))fail();
   p.length=info.bytes??0;p.sourceBytes+=p.length;if(p.sourceBytes>p.maximumBytes+p.columns.length*32)fail();
   if(info.kind==='null'){p.output+='null';finishCell();continue;}
   if(info.kind==='integer'||info.kind==='real'){
    const value=virtual?reportSnapshotCellValue(snapshot,name):db.prepare(`SELECT ${column} value FROM ${table} WHERE rowid=?`).get(p.rowid)?.value;
    if(typeof value!=='number')fail();p.output+=JSON.stringify(value);finishCell();continue;
   }
   if(info.kind==='blob'){
    if(p.length===0){p.output+='{}';finishCell();continue;}
    // Match each platform's ORIGINAL SELECT * value representation. Native
    // returns ArrayBuffer (no enumerable keys); Node SQLite Uint8Array exposes
    // bytes as numeric object keys. Never copy the whole BLOB to determine it.
    const empty=db.prepare(`SELECT substr(${column},1,0) value FROM ${table} WHERE rowid=?`).get(p.rowid)?.value;
    if(empty instanceof ArrayBuffer){p.output+='{}';finishCell();continue;}
    if(!(empty instanceof Uint8Array))fail();p.output+='{';p.phase='blob';continue;
   }
   p.output+='"';p.phase='text';continue;
  }
  if(p.phase==='text'){
   if(p.offset===p.length){if(p.carry)fail();p.output+='"';finishCell();continue;}
   const count=Math.min(2048,p.length-p.offset),row=virtual?{value:reportSnapshotCellBytes(scratch,snapshot,name,p.offset,count,snapshotCache)}:db.prepare(`SELECT hex(substr(CAST(${column} AS BLOB),?,?)) value FROM ${table} WHERE rowid=?`).get(p.offset+1,count,p.rowid);units++;
   if(typeof row?.value!=='string'||row.value.length!==2*count)fail();p.offset+=count;
   const decoded=textPiece(row.value,p.carry,p.offset===p.length);p.carry=decoded.carry;p.output+=JSON.stringify(decoded.text).slice(1,-1);continue;
  }
  if(p.phase==='blob'){
   if(p.blobIndex===p.length){p.output+='}';finishCell();continue;}
   const row=db.prepare(`SELECT hex(substr(${column},?,1)) value FROM ${table} WHERE rowid=?`).get(p.blobIndex+1,p.rowid);units++;
   if(!/^[A-F0-9]{2}$/.test(row?.value??''))fail();p.output+=(p.blobIndex?',':'')+JSON.stringify(String(p.blobIndex))+':'+parseInt(row.value,16);p.blobIndex=nextBlob(p.blobIndex,p.length);
  }
 }
 let chunk=null,last=false;
  if ( p . output . length >= REPORT_CHUNK_UNITS ) { chunk = p . output . slice ( 0 , REPORT_CHUNK_UNITS ) ; p . output = p . output . slice ( REPORT_CHUNK_UNITS ) ; last = p . phase === 'done' && p . output === '' ; }
 else if(p.phase==='done'){chunk=p.output;p.output='';last=true;}
 validate(p);return{state:p,chunk,last,units};
}
