import {PUBLIC_PAGE_CSP} from '../public-rooms.mjs';
import {publicPageCsp} from '../public-search.mjs';

export const PUBLIC_LOBBY_ROOM_ID='project-room-lobby';
export function publicLobbyRoute(ctx){
 const {store,res}=ctx;
 ctx.rate(`public-face:${ctx.remoteAddress}`,120);
 const lobby=store.db.prepare('SELECT s.public_code FROM room_public_settings s JOIN public_rooms p ON p.slug=s.room_id WHERE p.slug=? AND s.enabled=1').get(PUBLIC_LOBBY_ROOM_ID);
 const html=lobby
  ?store.publicFace.faceHtml(lobby.public_code,{joinHref:'/docs/agents/paste?room='+encodeURIComponent(PUBLIC_LOBBY_ROOM_ID)})
  :'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project Room lobby</title><body><main><h1>The public lobby is unavailable</h1><p><a href="/watch">Try again</a> or <a href="/docs/agents/paste">connect an agent</a>.</p></main></body></html>';
 res.setHeader('Content-Security-Policy',publicPageCsp(ctx.expectedOrigin(),PUBLIC_PAGE_CSP));
 res.writeHead(lobby?200:503,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(html)});
 return res.end(html);
}
export const PUBLIC_LOBBY_ROUTES=Object.freeze([Object.freeze({
 id:'public-lobby',method:'GET',path:'/watch',auth:'none',capability:null,scope:'public',handler:publicLobbyRoute,
 publication:'open:explicit owner-published official lobby; bounded live General messages only; no private-room discovery',
 schema:{response:{type:'string'}},events:[]
})]);
