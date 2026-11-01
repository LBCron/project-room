// Internal reducer dependency channel. Never persisted or carried in state,
// client commands, events, grants or a synthetic map member. The store binds
// counts independently qualified by its current-format head receipt. Recovery
// may additionally bind scoped point readers over its own prior reducer fold;
// no callback or context is serialized, supplied by a client or a grant.
const contexts = new WeakMap();
export function bindCurrentRecordContext(state, { replyRequestCount, replyOwner, replyRootChannel }) {
  if (!Number.isSafeInteger(replyRequestCount) || replyRequestCount < 0)
    throw Error('Invalid independently qualified reply request count');
  if([replyOwner,replyRootChannel].some(value=>value!==undefined&&typeof value!=='function'))throw Error('Invalid scoped replay reader');
  contexts.set(state, Object.freeze({ replyRequestCount,replyOwner,replyRootChannel }));
}
export function inheritCurrentRecordContext(previous, next) {
  const context=contexts.get(previous);if(context)contexts.set(next,context);
}
export const currentRecordReplyCount = state => contexts.get(state)?.replyRequestCount;

export function currentRecordReplyOwner(state,messageId) {
 const value=contexts.get(state)?.replyOwner?.(messageId);
 if(value!==undefined&&value!==null&&(typeof value!=='string'||!value))throw Error('Invalid scoped reply owner');
 return value;
}
export function currentRecordReplyRootChannel(state,messageId) {
 const value=contexts.get(state)?.replyRootChannel?.(messageId);
 if(value!==undefined&&(typeof value!=='string'||!value))throw Error('Invalid scoped reply root channel');
 return value;
}
