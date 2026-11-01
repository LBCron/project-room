// `room-acp <invite link>`: redeem once, save the credential privately.
import { hostname } from "node:os";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { parseInvite } from "./link.mjs";
import { RoomClient } from "./room.mjs";
import { configDir, loadConnection, saveConnection } from "./credentials.mjs";
import { openJoinJournal } from "./private-state.mjs";
import { registerSecret } from "./redact.mjs";

export function defaultHostId() {
  const host = hostname().replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 40) || "host";
  return `room-acp-${host}-${randomBytes(3).toString("hex")}`;
}

export async function join({ link, displayName, agent = null, permissionApproverId = null, origin, env = process.env, fetchImpl = fetch }) {
  const { apiBase, code, linkToken } = parseInvite(link, origin ? { origin } : {});
  registerSecret(code); registerSecret(linkToken);
  const room = new RoomClient({ apiBase, fetchImpl });
  let joined;
  if (linkToken) {
    await room.request("/api/share-links/preview", { body: { linkToken }, auth: false });
    const bucket = Math.floor(Date.now() / 600000);
    let proof;
    for (let i = 0; i < 1000000; i++) {
      const nonce = i.toString(36);
      if (createHash("sha256").update(`${bucket}:${displayName.trim()}:${nonce}`).digest("hex").startsWith("000")) { proof = nonce; break; }
    }
    if (!proof) throw new Error("identity proof search exhausted");
    const identity = await room.request("/api/agent-identities", { body: { displayName, proof }, auth: false });
    registerSecret(identity.secret);
    const member = new RoomClient({ apiBase, credential: identity.secret, fetchImpl });
    const admitted = await member.request("/api/share-links/join-agent", { body: { linkToken, displayName } });
    joined = { ...admitted, displayName, credential: identity.secret, identitySecret: identity.secret };
  } else {
    const key=createHash('sha256').update(JSON.stringify([apiBase,code])).digest('hex');
    const journal=openJoinJournal(configDir(env),key);
    try {
      let pending=journal.read();
      if(!pending){pending={version:1,apiBase,displayName,requestId:randomUUID(),hostId:defaultHostId(),agent,permissionApproverId};journal.save(pending);}
      if(pending.version!==1 || pending.apiBase!==apiBase || pending.displayName!==displayName
        || pending.agent!==agent || pending.permissionApproverId!==permissionApproverId || typeof pending.requestId!=='string' || typeof pending.hostId!=='string')
        throw Error('Saved invitation setup differs; no identity or connection was changed');
      if(pending.completed) {
        const existing=loadConnection({roomId:pending.completed.roomId},env);
        if(!existing || existing.memberId!==pending.completed.memberId || existing.identityId!==pending.completed.identityId || existing.apiBase!==apiBase)
          throw Error('This invitation was already saved or forgotten; use the saved connection or request a new invitation');
        const check=new RoomClient({...existing,fetchImpl});
        await check.checkConnection();
        return existing;
      }
      if(pending.recovery)registerSecret(pending.recovery.identitySecret);
      joined=pending.joined ?? (pending.recovery ? await room.recoverRedemption(pending.recovery)
        : await room.redeem({code,displayName,requestId:pending.requestId,saveRecovery:recovery=>{
          registerSecret(recovery.identitySecret);pending.recovery=recovery;journal.save(pending);
        }}));
      registerSecret(joined.credential);registerSecret(joined.identitySecret);
      await new RoomClient({apiBase,...joined,fetchImpl}).checkConnection();
      pending.joined=joined;delete pending.recovery;journal.save(pending);
      const connection={version:1,apiBase,...joined,hostId:pending.hostId,agent,permissionApproverId,joinedAt:new Date().toISOString()};
      saveConnection(connection,env);
      pending.completed={roomId:joined.roomId,memberId:joined.memberId,identityId:joined.identityId};delete pending.joined;journal.save(pending);
      return connection;
    }finally{journal.close();}
  }
  registerSecret(joined.credential); registerSecret(joined.identitySecret);
  const connection = { version: 1, apiBase, ...joined, hostId: defaultHostId(), agent, permissionApproverId, joinedAt: new Date().toISOString() };
  saveConnection(connection, env);
  return connection;
}
