// room_handoff_packet (flag ROOM_HANDOFF_PACKET, off by default).
// One read that gives an agent what it needs after joining or after its
// context was compacted: the room's rules (charter + pinned), recent recorded
// decisions, open claims (who holds which files until when), and the caller's
// own work. Pure composition over existing reads: no writes, no new storage.
// Research basis: "decision log / handoff packet" on the 50-agent-needs Page.

export const HANDOFF_PACKET_TOOL = "room_handoff_packet";
export const DECISION_TYPES = Object.freeze(["decision.recorded", "owner.decision_recorded"]);
const MAX_DECISIONS = 20;
const MAX_CLAIMS = 50;
const DECISION_WINDOW_MS = 30 * 24 * 3600 * 1000;
const MAX_PAGES = 10;

export function handoffPacketEnabled(env = globalThis.process?.env ?? {}) {
  const value = String(env?.ROOM_HANDOFF_PACKET ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

const text = (value, max = 500) => (typeof value === "string" ? value.slice(0, max) : null);

export function decisionOf(event) {
  const data = event?.data ?? {};
  return Object.freeze({
    sequence: event?.sequence ?? null,
    at: event?.at ?? null,
    actorId: event?.actorId ?? null,
    type: event?.type ?? null,
    statement: text(data.statement) ?? text(data.decision) ?? text(data.outcome),
    note: text(data.note),
    workItemId: text(data.workItemId, 128),
    sourceMessageId: text(data.sourceMessageId, 128)
  });
}

function claimOf(item) {
  if (!item || typeof item !== "object") return null;
  return Object.freeze({
    id: item.id ?? item.workItemId ?? null,
    title: text(item.title, 200),
    state: item.state ?? null,
    holder: item.owner ?? item.holderId ?? item.claim?.holderId ?? null,
    repository: item.repository ?? item.claim?.repository ?? null,
    paths: Array.isArray(item.paths) ? item.paths.slice(0, 64) : Array.isArray(item.claim?.paths) ? item.claim.paths.slice(0, 64) : [],
    leaseExpiresAt: item.leaseExpiresAt ?? item.claim?.expiresAt ?? null
  });
}

// Collect decision events newest-last from a bounded window. `readPage(after)`
// returns { events, next, hasMore } (store.eventsAfter with a type filter).
export function collectDecisions(readPage, { max = MAX_DECISIONS, maxPages = MAX_PAGES } = {}) {
  const found = [];
  let after = 0, pages = 0, truncated = false;
  for (;;) {
    const page = readPage(after);
    pages += 1;
    for (const row of page?.events ?? []) {
      // store.eventsAfter rows are { sequence, event }; accept bare events too.
      const event = row?.event ? { ...row.event, sequence: row.sequence ?? row.event.sequence } : row;
      if (DECISION_TYPES.includes(event?.type)) found.push(decisionOf(event));
    }
    if (!page?.hasMore || typeof page.next !== "number" || page.next <= after) break;
    if (pages >= maxPages) { truncated = true; break; }
    after = page.next;
  }
  return { decisions: found.slice(-max), total: found.length, truncated };
}

export function buildHandoffPacket({ context: raw, decisions, now = Date.now() }) {
  // get_room_context nests the orientation under `orient`; accept both shapes.
  const context = { ...(raw?.orient ?? {}), viewerId: raw?.viewerId ?? raw?.orient?.member?.id, roomId: raw?.roomId, cursors: raw?.cursors ?? raw?.orient?.cursors };
  const viewerId = context?.viewerId ?? context?.member?.id ?? null;
  const claims = (context?.claims ?? []).map(claimOf).filter(Boolean);
  const yours = claims.filter(claim => claim.holder && claim.holder === viewerId);
  const openWork = Array.isArray(context?.workItems) ? context.workItems : [];
  const roomId = context?.roomId ?? context?.room?.slug ?? null;
  return {
    contract: { name: "project-room/handoff-packet", version: 1 },
    roomId,
    viewerId,
    rules: {
      charter: context?.instructions?.charter ?? null,
      pinned: context?.instructions?.pinned ?? []
    },
    decisions: decisions?.decisions ?? [],
    decisionsTotal: decisions?.total ?? 0,
    decisionsWindowDays: DECISION_WINDOW_MS / (24 * 3600 * 1000),
    decisionsTruncated: decisions?.truncated === true,
    claims: { open: claims.slice(0, MAX_CLAIMS), openTotal: claims.length, yours },
    yourWork: openWork.slice(0, MAX_CLAIMS),
    cursors: context?.cursors ?? null,
    next: [
      { tool: "room_needs_me", why: "Pick up mentions and requests addressed to you since this packet." },
      { tool: "room_claim", why: "Claim work with paths; overlap returns file_lease_conflict naming the holder." }
    ],
    generatedAt: new Date(now).toISOString()
  };
}

export function decisionWindowStart(now = Date.now()) {
  return new Date(now - DECISION_WINDOW_MS).toISOString();
}
