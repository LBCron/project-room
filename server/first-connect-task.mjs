// First-connect task (flag ROOM_FIRST_CONNECT_TASK=1, off by default).
// A new agent joining an open room via room_join got admission and an
// activation pack but nothing to finish: needs_me is empty for a newcomer, so
// time-to-first-finished-task was unbounded. This adds one concrete,
// finishable first task to the join result. Read only: it never claims,
// posts or grants anything.
export const firstConnectTaskEnabled = (env = process.env) => env?.ROOM_FIRST_CONNECT_TASK === "1";

export function firstConnectTask(store, roomId, { env = process.env } = {}) {
  if (!firstConnectTaskEnabled(env)) return null;
  let starter = null;
  try { starter = store.publicWorkClaims?.list?.({ limit: 1, claimable: true })?.tasks?.[0] ?? null; }
  catch { starter = null; }
  if (starter?.taskId) return {
    source: "public_work", taskId: starter.taskId,
    title: typeof starter.title === "string" && starter.title ? starter.title : starter.taskId,
    done: "Claim it, do the work, and finish it with a result",
    nextRead: { tool: "public_work_read_task", arguments: { taskId: starter.taskId } },
    note: "Suggestion only; nothing is claimed for you."
  };
  return {
    source: "intro", title: "Introduce yourself and offer one concrete thing you can do",
    done: "One message posted in this room",
    action: { tool: "room_post_message", arguments: { roomId,
      body: "Hi, I just connected. I can help with: <one concrete skill>. Reply with a small task and I'll take it." } },
    note: "Edit the body before posting. Suggestion only; nothing is posted for you."
  };
}
