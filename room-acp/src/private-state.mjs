// Same atomic-file and SQLite ownership pattern as client/setup-journal.mjs.
// The private ACP package must carry its own runtime files.
import { DatabaseSync } from 'node:sqlite';
import { constants, mkdirSync, chmodSync, lstatSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

function privateFile(path) {
  const s=lstatSync(path);
  if(!s.isFile() || s.nlink!==1 || (s.mode & 0o077) || process.getuid && s.uid!==process.getuid())throw Error('Connection state must be private and without links');
}
function syncDirectory(path) { const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);} }
export function atomicPrivateJson(path,value) {
  try{privateFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  const temp=path+'.'+randomUUID();let fd;
  try {
    fd=openSync(temp,'wx',0o600);writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;
    renameSync(temp,path);syncDirectory(dirname(path));
  }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch(error){if(error.code!=='ENOENT')throw error;}}
}
export function openJoinJournal(root,key) {
  mkdirSync(root,{recursive:true,mode:0o700});
  const parent=lstatSync(root);if(!parent.isDirectory() || process.getuid && parent.uid!==process.getuid())throw Error('Connection directory must be owned by this user');
  chmodSync(root,0o700);
  const directory=join(root,'.join-'+key);
  try{mkdirSync(directory,{mode:0o700});syncDirectory(root);}catch(error){if(error.code!=='EEXIST')throw error;}
  const info=lstatSync(directory);
  if(!info.isDirectory() || (info.mode & 0o077) || process.getuid && info.uid!==process.getuid())throw Error('Join state requires a private directory without links');
  const lock=join(directory,'owner.sqlite');
  try{closeSync(openSync(lock,'wx',0o600));}catch(error){if(error.code!=='EEXIST')throw error;}
  privateFile(lock);
  for(const suffix of ['-wal','-shm','-journal']){try{privateFile(lock+suffix);}catch(error){if(error.code!=='ENOENT')throw error;}}
  const db=new DatabaseSync(lock,{timeout:0});
  try{db.exec('CREATE TABLE IF NOT EXISTS join_owner (id INTEGER PRIMARY KEY); BEGIN IMMEDIATE');}catch{db.close();throw Error('Another join owns this invitation; wait for it to finish');}
  const path=join(directory,'receipt.json');
  return {
    read(){let fd;try{privateFile(path);if(lstatSync(path).size>131072)throw Error('Join receipt exceeds its limit');fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);return JSON.parse(readFileSync(fd,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}finally{if(fd!==undefined)closeSync(fd);}},
    save(value){if(Buffer.byteLength(JSON.stringify(value))>131072)throw Error('Join receipt exceeds its limit');atomicPrivateJson(path,value);},
    close(){db.close();}
  };
}
