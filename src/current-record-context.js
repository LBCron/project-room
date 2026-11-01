// Internal reducer dependency channel. Never persisted or carried in state,
// client commands, events, grants or a synthetic map member. The store binds
// only counts independently qualified by its current-format head receipt.
const contexts = new WeakMap();
export function bindCurrentRecordContext(state, { replyRequestCount }) {
  if (!Number.isSafeInteger(replyRequestCount) || replyRequestCount < 0)
    throw Error('invalid_current_reply_request_count');
  contexts.set(state, Object.freeze({ replyRequestCount }));
}
export function inheritCurrentRecordContext(previous, next) {
  const context=contexts.get(previous);if(context)contexts.set(next,context);
}
export const currentRecordReplyCount = state => contexts.get(state)?.replyRequestCount;
