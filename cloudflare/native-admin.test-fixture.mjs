import { HttpTestRoom } from './http-worker.test-fixture.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createHash } from 'node:crypto';
import { createMcpInviteOAuth } from '../server/mcp-invite-oauth.mjs';
import { createHostedRoomMcp } from '../server/mcp-room-profile.mjs';

export class NativeAdminTestRoom extends HttpTestRoom {
  async fetch() {
    const store = this.store;
    store.initialize(initialRoom());
    const owner = store.issueAccessKey('commons', 'owner');
    const invite = store.invites.create(owner, 'commons', { ownerEquivalent: true });
    const resource = 'https://room.example/mcp';
    const client = { clientId: 'worker-admin', name: 'Worker admin', redirectUris: ['https://client.example/callback'] };
    const oauth = createMcpInviteOAuth({ store, clients: [client], resource });
    const verifier = 'v'.repeat(43);
    const { nonce } = oauth.begin(new URLSearchParams({ client_id: client.clientId, redirect_uri: client.redirectUris[0],
      scope: 'rooms:read members:admin', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256', resource }));
    const preview = oauth.preview(nonce, invite.code);
    const code = new URL(oauth.approve(nonce, invite.code, 'Worker admin agent')).searchParams.get('code');
    const tokens = oauth.provider.exchangeCode({ code, clientId: client.clientId, redirectUri: client.redirectUris[0], codeVerifier: verifier, resource });
    const mcp = createHostedRoomMcp(store, { inviteOAuthProvider: oauth.provider, oauthResource: resource });
    const rpc = (method, params = {}) => mcp({ jsonrpc: '2.0', id: 1, method, params }, { authorization: 'Bearer ' + tokens.accessToken, mcpUrl: resource, searchParams: new URLSearchParams() });
    const names = (await rpc('tools/list')).result.tools.map(tool => tool.name);
    const listed = await rpc('tools/call', { name: 'room_list_access_requests', arguments: {} });
    const foreign = await rpc('tools/call', { name: 'room_list_access_requests', arguments: { roomId: 'wrong-room' } });
    const grant = store.db.prepare('SELECT * FROM oauth_invite_grants').get();
    const member = store.room('commons').state.members[grant.member_id];
    store.command(owner, 'commons', { id: 'remove-admin', type: 'member.access_changed', data: { memberId: member.id, expectedMemberRevision: member.revision, active: false, permissions: member.permissions } });
    const removed = await rpc('tools/call', { name: 'room_list_access_requests', arguments: {} });
    return Response.json({ previewAdmin: preview.invitation.ownerEquivalent, advertised: names.includes('room_list_access_requests'),
      listSucceeded: Boolean(listed.result && !listed.result.isError), wrongRoomRefused: Boolean(foreign.error || foreign.result?.isError),
      removalRefused: Boolean(removed.error || removed.result?.isError) });
  }
}
export default { fetch(request, env) { return env.ROOM.getByName('native-admin').fetch(request); } };
