// Test-only passive SQL meter. Never drains a cursor to observe its counters.
export function measureSql(sql) {
  const cursors = [];
  let failedStatements=0;
  const count = {returnedRows:0,returnedTextBytes:0,returnedBlobBytes:0,numericCells:0};
  const encoder = new TextEncoder();
  function row(value) {
    count.returnedRows++;
    for (const cell of Object.values(value)) {
      if (typeof cell === 'string') count.returnedTextBytes += encoder.encode(cell).length;
      else if (cell instanceof ArrayBuffer || ArrayBuffer.isView(cell)) count.returnedBlobBytes += cell.byteLength;
      else if (typeof cell === 'number') count.numericCells++;
    }
  }
  function iterator(target) {
    return {
      [Symbol.iterator]() { return this; },
      next(...args) { const result=target.next(...args); if (!result.done) row(result.value); return result; },
      ...(typeof target.return === 'function' ? {return(...args) { return target.return(...args); }} : {}),
      ...(typeof target.throw === 'function' ? {throw(...args) { return target.throw(...args); }} : {}),
      ...(typeof target.toArray === 'function' ? {toArray() { const rows=target.toArray(); rows.forEach(row); return rows; }} : {}),
    };
  }
  function exec(...args) {
      let cursor;
      try {cursor=sql.exec(...args);}
      catch(error) {failedStatements++;throw error;}
      cursors.push(cursor);
      return new Proxy(cursor,{get(target,key) {
        if (key===Symbol.iterator) return ()=>iterator(target[Symbol.iterator]());
        if (key==='next') return (...args)=>{const result=target.next(...args); if (!result.done) row(result.value); return result;};
        if (key==='toArray') return ()=>{const rows=target.toArray(); rows.forEach(row); return rows;};
        if (key==='one') return ()=>{const value=target.one(); row(value); return value;};
        if (key==='raw') return ()=>iterator(target.raw());
        const value=Reflect.get(target,key,target);
        return typeof value==='function'?value.bind(target):value;
      }});
  }
  return {
    sql: new Proxy(sql,{get(target,key) {
      if(key==='exec') return exec;
      const value=Reflect.get(target,key,target);
      return typeof value==='function'?value.bind(target):value;
    }}),
    snapshot() {
      let rowsRead=0,rowsWritten=0,unknownCounters=failedStatements*2;
      for (const cursor of cursors) {
        for (const key of ['rowsRead','rowsWritten']) {
          let value;
          try {value=cursor[key];} catch {unknownCounters++;continue;}
          if (!Number.isSafeInteger(value)||value<0) unknownCounters++;
          else if (key==='rowsRead') rowsRead+=value;
          else rowsWritten+=value;
        }
      }
      return {statements:cursors.length+failedStatements,failedStatements,rowsRead,rowsWritten,unknownCounters,...count,
        returnedPayloadBytes:count.returnedTextBytes+count.returnedBlobBytes};
    },
  };
}
