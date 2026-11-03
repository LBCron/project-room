// Adapted from Codex 2's reviewed public proposal:
// project-room-lobby message codex2-formal-delivery-prototype-1103.
// Credentials stay in RoomClient; only its service-issued command is persisted.
import {RoomError} from './room.mjs';

const MAX_CONTEXT_BYTES = 4 * 65536;
const invalid = reason => {throw new RoomError(409, 'formal_context_invalid', reason);};

export async function readCompleteRequest(room, requestId) {
  let cursor = null, binding, last, bytes = 0;
  const items = [], seen = new Set();
  for (let page = 0; page < 20; page++) {
    last = await room.requestContext(requestId, cursor);
    if (last.roomId !== room.roomId || last.viewerId !== room.memberId || last.request?.id !== requestId
      || last.request.recipientId !== room.memberId) invalid('Request does not belong to this listener');
    const preparation = {...last.preparation}; delete preparation.evaluatedThrough;
    const identity = JSON.stringify([last.roomCreatedEventId, last.request.revision,
      last.current?.contextEventId, last.current?.contextSequence, preparation]);
    if (binding && binding !== identity) invalid('Request changed while reading; inspect again before execution');
    binding = identity;
    bytes += Buffer.byteLength(JSON.stringify(last));
    if (bytes > MAX_CONTEXT_BYTES) throw new RoomError(413, 'formal_context_too_large', 'Request exceeds the listener context budget');
    if (!Array.isArray(last.page?.items)) invalid('Missing request page');
    items.push(...last.page.items);
    if (last.page.hasMore === false) return {...last, inspectedItems:items, allPagesRead:true};
    cursor = last.page.nextCursor;
    if (typeof cursor !== 'string' || !cursor || seen.has(cursor)) invalid('Invalid request continuation');
    seen.add(cursor);
  }
  throw new RoomError(413, 'formal_context_too_large', 'Request exceeds the listener page budget');
}

export function prepareFormalDelivery(context, output, stopReason) {
  if (!context.allPagesRead || context.page?.hasMore !== false || context.request?.status !== 'open'
    || context.viewerId !== context.request.recipientId) invalid('Complete open recipient context is required');
  if (stopReason !== 'end_turn') return {kind:'pending', body:'The agent turn did not finish. This request remains open.'};
  let value;
  try {value = JSON.parse(output);} catch {return {kind:'pending', body:'The agent did not return an explicit answer or decline. This request remains open.'};}
  if (value && !Array.isArray(value) && typeof value.body === 'string' && value.body.length > 4096)
    return {kind:'pending', body:'The agent response exceeded the 4,096-character limit. This request remains open.'};
  if (!value || Array.isArray(value) || Object.keys(value).some(key => !['outcome','body'].includes(key))
    || !['answered','declined','pending'].includes(value.outcome) || typeof value.body !== 'string' || !value.body.trim())
    return {kind:'pending', body:'The agent returned an invalid response format. This request remains open.'};
  if (value.outcome === 'pending') return {kind:'pending', body:value.body};
  const recipes = (context.responseHttpActions ?? []).filter(action => action.command?.data?.responseOutcome === value.outcome);
  if (recipes.length !== 1) invalid('No unique current response recipe');
  const recipe = structuredClone(recipes[0]), data = recipe.command.data;
  if (recipe.method !== 'POST' || recipe.path !== `/api/rooms/${encodeURIComponent(context.roomId)}/commands`
    || recipe.command.type !== 'message.posted'
    || recipe.verify?.method !== 'GET'
    || recipe.verify.path !== `/api/rooms/${encodeURIComponent(context.roomId)}/reply-context?requestMessageId=${encodeURIComponent(context.request.id)}`
    || data.responseToRequestId !== context.request.id || data.replyToId !== context.request.id
    || data.expectedRequestRevision !== context.request.revision
    || data.contextEventId !== context.current?.contextEventId || data.contextSequence !== context.current?.contextSequence
    || data.toMemberId !== context.request.requesterId || !Object.hasOwn(data,'workItemId') || data.workItemId !== context.request.workItemId
    || typeof recipe.command.id !== 'string' || !recipe.command.id || typeof data.messageId !== 'string' || !data.messageId)
    invalid('Response recipe binding does not match the inspected request');
  data.body = value.body;
  if (Buffer.byteLength(JSON.stringify(recipe.command)) > 16384) invalid('Response exceeds the service command budget');
  return {kind:'formal', recipe};
}

export async function deliverFormal(room, delivery, listenerToken) {
  const requestId=delivery.recipe?.command?.data?.responseToRequestId;
  if (typeof requestId !== 'string' || delivery.recipe.path !== `/api/rooms/${encodeURIComponent(room.roomId)}/commands`
    || delivery.recipe.verify?.path !== `/api/rooms/${encodeURIComponent(room.roomId)}/reply-context?requestMessageId=${encodeURIComponent(requestId)}`)
    invalid('Saved response does not belong to this Room');
  await room.request(delivery.recipe.path, {body:delivery.recipe.command, listenerToken});
  const current = await room.request(delivery.recipe.verify.path);
  const data = delivery.recipe.command.data;
  if (current.roomId !== room.roomId || current.viewerId !== room.memberId
    || current.request?.id !== data.responseToRequestId || current.request.status !== data.responseOutcome
    || current.request.responseMessageId !== data.messageId) invalid('Exact saved response is not verified; reconcile without a new recipe');
  const selected=await room.thread(data.messageId,{selected:true}), message=selected.thread;
  if (message.authorId!==room.memberId || message.toMemberId!==data.toMemberId || message.replyToId!==requestId
    || (message.workItemId??null)!==data.workItemId || message.deletedAt || message.body!==data.body)
    throw new RoomError(409,'formal_response_changed','Saved response content or binding changed; inspect without repeating execution');
}
