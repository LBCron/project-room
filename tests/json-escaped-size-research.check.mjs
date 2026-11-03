import test from 'node:test';import assert from 'node:assert/strict';import {escapedJsonBytesResearch} from '../server/full-stream-accounting-research.mjs';
test('escaped JSON byte count matches serializer across boundary code units',()=>{
 const cases=['','x','"\\\b\t\n\f\r\u0000\u000b','é界😀','\ud800x\udc00','\u2028\u2029'];
 let state=0x12345678;for(let i=0;i<2000;i++){let s='';for(let j=0;j<32;j++){state=(Math.imul(state,1664525)+1013904223)>>>0;s+=String.fromCharCode(state>>>16)}cases.push(s)}
 for(const s of cases)assert.equal(escapedJsonBytesResearch(s),Buffer.byteLength(JSON.stringify(s))-2);
});
