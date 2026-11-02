// The original oracle's exact representation accommodations. These are not
// general migrations: channel data remains excluded except the general triple.
export const recoveryCanonical = value => Array.isArray(value) ? `[${value.map(recoveryCanonical).join(',')}]`
 : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${recoveryCanonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const requireState = condition => { if (!condition) throw Error('Recovery data requires operator reconciliation'); };
export function stripRecoveryWorkControls(item) {
 const copy=JSON.parse(JSON.stringify(item));
 delete copy.round_count; delete copy.tool_calls; delete copy.suspended_by; delete copy.receipt?.segments;
 if(Array.isArray(copy.receiptHistory))for(const receipt of copy.receiptHistory)delete receipt.segments;
 return copy;
}
export function verifyRecoveryWorkDefaults(actualItem,rebuiltItem) {
 for(const[field,fallback]of[['round_count',0],['tool_calls',0],['suspended_by',null]]) {
  if(actualItem&&field in actualItem)requireState(rebuiltItem[field]===actualItem[field]);else requireState(rebuiltItem[field]===fallback);
 }
 const receipts=[rebuiltItem.receipt,...(rebuiltItem.receiptHistory??[])].filter(Boolean),actualReceipts=[actualItem?.receipt,...(actualItem?.receiptHistory??[])].filter(Boolean);
 receipts.forEach((receipt,index)=>{if(actualReceipts[index]&&'segments'in actualReceipts[index])requireState(JSON.stringify(receipt.segments)===JSON.stringify(actualReceipts[index].segments));else requireState(receipt.segments===null);});
}
export function verifyRecoveryGeneralChannel(actualGeneral,rebuiltGeneral) {
 if(actualGeneral||rebuiltGeneral)requireState(actualGeneral?.id===rebuiltGeneral?.id&&actualGeneral?.name===rebuiltGeneral?.name&&actualGeneral?.archivedAt===rebuiltGeneral?.archivedAt);
}
export function stripRecoveryProjection(value) {
 const copy=JSON.parse(JSON.stringify(value));
 if(copy.state) {
  delete copy.state.channels;
  if(Array.isArray(copy.state.messages))for(const message of copy.state.messages)delete message.channelId;
  if(copy.state.workItems&&typeof copy.state.workItems==='object')for(const[id,item]of Object.entries(copy.state.workItems))copy.state.workItems[id]=stripRecoveryWorkControls(item);
 }
 return copy;
}
export function stripRecoveryMessageChannel(message) { const copy=JSON.parse(JSON.stringify(message));delete copy.channelId;return copy; }
