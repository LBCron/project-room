// Board claim tools over MCP (flag ROOM_BOARD_CLAIM_TOOLS, off by default).
//
// A Board task posted from the web or REST (/work-claims) could be retired
// over MCP (room_close_work_claim) but never taken or delivered: room_claim and
// room_record_completion act on proposed work items, so they answered
// work_not_found. The 2026-11-03 workflow harness measured 0/10 scripted
// agents finishing a Board task on main (core and full profiles).
//
// Both tools call the same handleWorkClaims routes as REST (claim, update), so
// caps, leases, review policy, autonomy tiers, events and wakes are unchanged.
export const BOARD_TAKE_TOOL = "room_take_work_claim";
export const BOARD_FINISH_TOOL = "room_finish_work_claim";
export const BOARD_CLAIM_TOOLS = Object.freeze([BOARD_TAKE_TOOL, BOARD_FINISH_TOOL]);
const CLAIM_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function boardClaimToolsEnabled(env = globalThis.process?.env ?? {}) {
  return /^(1|true|on)$/i.test(String(env?.ROOM_BOARD_CLAIM_TOOLS ?? "").trim());
}

const text = (max) => ({ type: "string", minLength: 1, maxLength: max });
export const boardClaimToolDefinitions = () => [
  { name: BOARD_TAKE_TOOL,
    description: "Take an unclaimed Board task by claimId, with a lease. Same rules as POST .../work-claims/{claimId}/claim. Finish with room_finish_work_claim.",
    inputSchema: { type: "object", additionalProperties: false, required: ["roomId", "claimId"], properties: {
      roomId: { type: "string", maxLength: 128 },
      claimId: { type: "string", pattern: CLAIM_ID.source },
      note: { ...text(2000) },
      files: { type: "array", maxItems: 64, items: text(512) } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } },
  { name: BOARD_FINISH_TOOL,
    description: "Finish a Board task you hold: note, then delivered (or done if review policy allows). Same rules as POST .../work-claims/{claimId}/update.",
    inputSchema: { type: "object", additionalProperties: false, required: ["roomId", "claimId", "note"], properties: {
      roomId: { type: "string", maxLength: 128 },
      claimId: { type: "string", pattern: CLAIM_ID.source },
      note: { ...text(4000) },
      state: { type: "string", enum: ["delivered", "done"] } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } }
];

export function validBoardClaimArgs(name, args) {
  if (!args || typeof args !== "object" || !CLAIM_ID.test(String(args.claimId ?? ""))) return false;
  const str = (v, max) => v === undefined || typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (name === BOARD_TAKE_TOOL) {
    const allowed = new Set(["claimId", "note", "files"]);
    return Object.keys(args).every(k => allowed.has(k)) && str(args.note, 2000)
      && (args.files === undefined || Array.isArray(args.files) && args.files.length <= 64 && args.files.every(f => str(f, 512)));
  }
  if (name === BOARD_FINISH_TOOL) {
    const allowed = new Set(["claimId", "note", "state"]);
    return Object.keys(args).every(k => allowed.has(k)) && typeof args.note === "string" && str(args.note, 4000)
      && (args.state === undefined || args.state === "delivered" || args.state === "done");
  }
  return false;
}

// Plan of REST route calls for one tool call. `current` is the claim's state.
export function boardClaimSteps(name, args, current) {
  if (name === BOARD_TAKE_TOOL) {
    return [["claim", { ...(args.leaseHours ? { leaseHours: args.leaseHours } : {}),
      ...(args.note ? { note: args.note } : {}), ...(args.files ? { files: args.files } : {}) }]];
  }
  const steps = [];
  if (current === "claimed") steps.push(["update", { state: "in_progress" }]);
  steps.push(["update", { state: args.state ?? "delivered", note: args.note }]);
  return steps;
}

// Run the steps in-process through handleWorkClaims (the REST handler). Stops
// at the first refusal and returns it with the step that refused.
export async function runBoardClaimTool({ handleWorkClaims, store, roomId, auth, reauthorize, name, args }) {
  const registry = store.workClaims;
  const item = registry.get(roomId, args.claimId);
  if (!item) return { isError: true, value: { status: 404, code: "work_claim_not_found",
    message: `No Board work claim "${args.claimId}" in this room`, next: [{ tool: "room_read_board", arguments: { roomId } }] } };
  let last = null;
  for (const [route, data] of boardClaimSteps(name, args, item.state)) {
    let out = null;
    const reject = (status, code, message) => { const e = new Error(message); e.status = status; e.code = code; e.body = { code, message }; throw e; };
    try {
      await handleWorkClaims({ req: { method: "POST", headers: {} }, res: {},
        url: new URL(`http://room.invalid/api/rooms/${encodeURIComponent(roomId)}/work-claims/${encodeURIComponent(args.claimId)}/${route}`),
        store, roomId, auth, workClaimRoute: route, workClaimId: args.claimId, registry, reauthorize,
        helpers: { json: (_res, status, value) => { out = { status, value }; }, reject, body: async () => data } });
    } catch (error) {
      if (!Number.isInteger(error?.status)) throw error;
      out = { status: error.status, value: error.body ?? { code: error.code, message: error.message } };
    }
    if (!out || out.status >= 400) {
      return { isError: true, value: { status: out?.status ?? 500, ...(out?.value ?? {}), step: route,
        ...(route === "update" && /review/.test(String(out?.value?.message)) ? { hint: "This room reviews work: finish with state delivered; a reviewer verifies it to done." } : {}) } };
    }
    last = out.value;
  }
  return { isError: false, value: last };
}
