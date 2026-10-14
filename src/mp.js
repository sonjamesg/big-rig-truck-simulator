'use strict';
// ===================== v10 MULTIPLAYER — PeerJS (WebRTC, free public broker, no backend). Star topology: host relays. =====================
const MP={drops:{},pconns:{},poseConn:null,on:false,host:false,peer:null,conns:{},hostConn:null,code:'',myId:'',name:'',players:{},chat:[],listOpen:false,sendT:0,rate:1/20,ended:false,max:8};
const MP_PREFIX='bigrig-tsim-';
function mpName(){ return (document.getElementById('lbName')||{}).value||localStorage.getItem('bigrig.name')||'Driver'; }
// ---- compact pose packet (array, ~110 bytes JSON) sent ~20 Hz on an unreliable/unordered channel, sender-timestamped
// [ 'p', id, t_ms, x, y, h, v, model, colour, flags, gid|0, trlType, trlCol, trlLogo, trlTh, kx, ky ]
const R2=v=>Math.round(v*100)/100, R3=v=>Math.round(v*1000)/1000;
function mpGid(tr){ if((!tr.gid||tr.gid.startsWith('me:'))) tr.gid=(MP.myId||'me')+':'+tr.id; return tr.gid; }
function mpSelfPose(){ const s=truck, tr=s.trl; const ind=IND.side;
  const fl=((s.brake||0)>0.1?1:0)|(s.mode==='R'?2:0)|(ind<<2)|(input.hand?16:0)|(IND.haz?32:0)|(typeof HB!=='undefined'&&HB.on?64:0); const P=['p',MP.myId,Math.round(performance.now()),R2(s.x),R2(s.y),R3(s.h),R2(s.v),career.cur,career.colors[career.cur]||'',fl];
  if(tr){ const k=kingpin(s); P.push(mpGid(tr),tr.type,tr.col||'',tr.logo||'',R3(tr.th),R2(k[0]),R2(k[1])); } else P.push(0); return P; }
// ---------- network
function mpSendAll(msg,except,pose){ const d=JSON.stringify(msg); for(const id in MP.conns){ if(id===except) continue; const c=(pose&&MP.pconns[id]&&MP.pconns[id].open)?MP.pconns[id]:MP.conns[id]; if(c&&c.open) try{ c.send(d); }catch(e){} } }
function mpSend(msg,pose){ if(MP.host) mpSendAll(msg,null,pose); else { const c=(pose&&MP.poseConn&&MP.poseConn.open)?MP.poseConn:MP.hostConn; if(c&&c.open) try{ c.send(JSON.stringify(msg)); }catch(e){} } }
function mpRoster(){ return Object.values(MP.players).map(p=>({id:p.id,n:p.n})).concat([{id:MP.myId,n:MP.name}]); }
function mpOnMsg(raw,from){ let m; try{ m=typeof raw==='string'?JSON.parse(raw):raw; }catch(e){ return; }
  if(Array.isArray(m)){ if(m[0]==='p'){ if(MP.host&&from) m[1]=from; mpPose(m); if(MP.host) mpSendAll(m,from,true); } return; }
  if(m.t==='hello'&&MP.host){ const n=String(m.n||'Driver').slice(0,16); MP.players[from]=MP.players[from]||mpNewPlayer(from,n); MP.players[from].n=n;
    const cc=MP.conns[from]; if(cc) cc.send(JSON.stringify({t:'welcome',id:from,host:MP.myId,roster:mpRoster(),drops:Object.values(MP.drops)})); mpSendAll({t:'join',id:from,n},from); mpToast('\u{1F69A} '+n+' joined'); mpRender(); return; }
  if(m.t==='welcome'){ MP.myId=m.id; for(const p of m.roster) if(p.id!==MP.myId){ MP.players[p.id]=MP.players[p.id]||mpNewPlayer(p.id,p.n); MP.players[p.id].n=p.n; } for(const d of m.drops||[]) mpApplyDrop(d); mpToast('Connected to '+MP.code+' \u2022 '+m.roster.length+' players'); mpRender(); BigRig.emit('mpJoined',{id:m.id}); return; }
  if(m.t==='join'){ if(m.id!==MP.myId){ MP.players[m.id]=MP.players[m.id]||mpNewPlayer(m.id,m.n); MP.players[m.id].n=m.n; mpToast('\u{1F69A} '+m.n+' joined'); mpRender(); } return; }
  if(m.t==='clock'){ if(!MP.host&&typeof m.g==='number'){ gameT=m.g; if(typeof m.d==='number') gameDay=m.d; if(m.w) WX.st=m.w; } return; }
  if(m.t==='ft'){ if(MP.host&&from){ m.id=from; mpSendAll(m,from); } const p=MP.players[m.id]; if(p){ p.buf=p.buf.filter(q=>q[2]>=m.ts); p.has=false; } return; }
  if(m.t==='leave'){ mpPlayerGone(m.id); return; }
  if(m.t==='drop'){ if(MP.host&&from){ m.id=from; mpSendAll(m,from); } const p=MP.players[m.id]; if(p){ p.dropT=m.ts; if(p.held===m.gid) p.held=0; } mpApplyDrop(m); return; }
  if(m.t==='chat'){ if(MP.host&&from){ m.id=from; m.n=(MP.players[from]||{}).n||'?'; mpSendAll(m,from); } mpChatLine(m.n,String(m.x).slice(0,140)); return; }
  if(m.t==='end'){ mpEnded('The host ended the session'); return; } }
function mpNewPlayer(id,n){ return {id,n:n||'Driver',buf:[],off:null,cur:{x:0,y:0,h:0,v:0,tr:null,kx:0,ky:0,th:0},has:false,held:0,last:0}; }
function mpPlayerGone(id){ const p=MP.players[id]; if(!p) return; if(p.held&&p.has){ const c=p.cur; mpApplyDrop({gid:p.held,x:c.kx,y:c.ky,th:c.th,ty:p.lastTr[0],c:p.lastTr[1],l:p.lastTr[2]}); } delete MP.players[id]; mpToast('\u{1F44B} '+p.n+' left'); mpRender(); }
// sender-timestamped snapshot buffer: arrival jitter/reordering doesn't matter, clock offset tracked as a running minimum
function mpPose(m){ let p=MP.players[m[1]]; if(!p){ p=MP.players[m[1]]=mpNewPlayer(m[1],'Driver'); mpRender(); }
  const now=performance.now(), off=now-m[2]; p.off=p.off===null?off:Math.min(off,p.off+0.02*16); p.last=now;
  const b=p.buf; if(b.length&&m[2]<=b[b.length-1][2]){ if(b.some(q=>q[2]===m[2])) return; b.push(m); b.sort((a,c)=>a[2]-c[2]); } else b.push(m); if(b.length>24) b.shift();
  p.m=m[7]; p.c=m[8]; p.fl=m[9];
  if(m[2]>(p.newest||0)){ p.newest=m[2]; if(m[2]>(p.dropT||0)){ const gid=m[10]||0; if(gid!==p.held){ if(gid) mpHoldTrailer(gid,m[1]); p.held=gid; } if(gid) p.lastTr=[m[11],m[12],m[13]]; } } }
function mpHoldTrailer(gid,peer){ for(const t of world.trailers) if(t.gid===gid&&t!==truck.trl){ t.coupled=true; t.heldBy=peer; if(t.bay){ t.bay.trailer=null; t.bay=null; } } }
// shared dropped trailers: everyone gets the same object at the same pose (late joiners via welcome.drops)
function mpApplyDrop(d){ MP.drops[d.gid]={t:'drop',gid:d.gid,x:d.x,y:d.y,th:d.th,ty:d.ty,c:d.c,l:d.l,cargo:d.cargo}; let t=world.trailers.find(t=>t.gid===d.gid); if(t&&t===truck.trl) return;
  if(!t){ const ty=TRAILER_TYPES[d.ty]?d.ty:'box'; t=makeTrailer(ty,mulberry(7),{col:d.c||undefined,logo:d.l||undefined}); if(d.ty==='player'){ t.type='player'; t.typeName='Box van (Big Rig)'; } if(d.cargo) t.cargo=d.cargo; t.gid=d.gid; world.trailers.push(t); }
  t.x=d.x; t.y=d.y; t.th=d.th; t.coupled=false; t.heldBy=null; if(t.bay){ t.bay.trailer=null; t.bay=null; } }
BigRig.on('uncouple',e=>{ if(!MP.on) return; const t=e.trailer; const d={t:'drop',id:MP.myId,ts:Math.round(performance.now()),gid:mpGid(t),x:R2(t.x),y:R2(t.y),th:R3(t.th),ty:t.type,c:t.col||'',l:t.logo||'',cargo:t.cargo}; MP.drops[d.gid]=d; mpSend(d); mpSend(mpSelfPose(),true); });
BigRig.on('couple',e=>{ if(!MP.on) return; delete MP.drops[mpGid(e.trailer)]; mpSend(mpSelfPose(),true); });
function mpNewPeer(id){ return new Peer(id,{debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}}); }
function mpTagWorld(){ for(const t of world.trailers) if(!t.gid&&!t.coupled) t.gid=t.id; }
function mpHost(){ mpReset(); MP.name=mpName(); mpTagWorld(); const code=String(1000+((Math.random()*9000)|0)); MP.code='TRUCK-'+code; mpStatus('Opening room '+MP.code+'\u2026');
  const pr=MP.peer=mpNewPeer(MP_PREFIX+code.toLowerCase()); MP.host=true;
  pr.on('open',id=>{ MP.myId=id; MP.on=true; mpStatus(''); mpLobbyHosted(); BigRig.emit('mpHosting',{code:MP.code}); });
  pr.on('connection',c=>{ if(c.label==='pose'||(c.metadata&&c.metadata.kind==='pose')){ MP.pconns[c.peer]=c; c.on('data',d=>mpOnMsg(d,c.peer)); c.on('close',()=>{ if(MP.pconns[c.peer]===c) delete MP.pconns[c.peer]; }); return; }
    if(Object.keys(MP.conns).length>=MP.max-1){ c.on('open',()=>{ c.send(JSON.stringify({t:'end',why:'full'})); setTimeout(()=>c.close(),300); }); return; } MP.conns[c.peer]=c;
    c.on('data',d=>mpOnMsg(d,c.peer)); const gone=()=>{ if(!MP.conns[c.peer]) return; delete MP.conns[c.peer]; delete MP.pconns[c.peer]; if(MP.players[c.peer]){ mpPlayerGone(c.peer); mpSendAll({t:'leave',id:c.peer}); } mpRender(); }; c.on('close',gone); c.on('error',gone); });
  pr.on('error',e=>{ if(e.type==='unavailable-id'){ mpStatus('Code taken, retrying\u2026'); setTimeout(mpHost,300); } else mpStatus('Network error: '+e.type); }); }
function mpJoin(code){ mpReset(); MP.name=mpName(); mpTagWorld(); code=String(code||'').toUpperCase().replace(/[^0-9]/g,''); if(code.length<4){ mpStatus('Enter a room code like TRUCK-4821'); return; }
  MP.code='TRUCK-'+code; mpStatus('Connecting to '+MP.code+'\u2026'); const pr=MP.peer=mpNewPeer();
  pr.on('open',()=>{ const c=MP.hostConn=pr.connect(MP_PREFIX+code,{reliable:true,label:'main'}); const to=setTimeout(()=>{ if(!MP.on) mpStatus('No game found with code '+MP.code); },9000);
    c.on('open',()=>{ clearTimeout(to); MP.on=true; MP.host=false; c.send(JSON.stringify({t:'hello',n:MP.name})); mpStatus(''); mpLobbyClose(); startGame();
      const pc=MP.poseConn=pr.connect(MP_PREFIX+code,{reliable:false,label:'pose',metadata:{kind:'pose'}}); pc.on('data',d=>mpOnMsg(d,null)); });
    c.on('data',d=>mpOnMsg(d,null)); c.on('close',()=>mpEnded('Disconnected from the host')); c.on('error',()=>mpEnded('Connection error')); });
  pr.on('error',e=>{ mpStatus(e.type==='peer-unavailable'?'No game found with code '+MP.code:'Network error: '+e.type); }); }
function mpReset(){ try{ if(MP.peer) MP.peer.destroy(); }catch(e){} MP.on=false; MP.host=false; MP.peer=null; MP.conns={}; MP.pconns={}; MP.hostConn=null; MP.poseConn=null; MP.players={}; MP.ended=false;
  for(const t of world.trailers||[]) if(t.heldBy){ t.heldBy=null; t.coupled=false; } mpRender(); }
function mpLeave(){ if(MP.host) mpSendAll({t:'end'}); MP.ended=true; setTimeout(mpReset,150); }
function mpEnded(why){ if(MP.ended||!MP.on) return; MP.ended=true; mpReset(); mpToast(why); started=false; const ov=document.getElementById('overlay'); ov.classList.remove('hidden'); mpLobbyOpen(); mpStatus(why+' \u2014 back in the lobby'); BigRig.emit('mpEnded',{why}); }
addEventListener('beforeunload',()=>{ if(MP.on&&MP.host) mpSendAll({t:'end'}); });
// ---------- per-frame (allocation-free interpolation into p.cur)
const MP_DELAY=130;   // ms interpolation buffer (covers ~100 ms jitter at 20 Hz)
function updateMP(dt){ if(!MP.on) return; MP.sendT-=dt; if(MP.sendT<=0&&started){ MP.sendT=MP.rate; mpSend(mpSelfPose(),true); }
  const now=performance.now(); for(const id in MP.players){ const p=MP.players[id]; if(!p.buf.length) continue; mpInterp(p,now-p.off-MP_DELAY); const r=p.cur; if(!p.has) continue;
    const dx=truck.x-r.x, dy=truck.y-r.y, d=Math.hypot(dx,dy); if(d<4.2&&d>0.01){ const k=(4.2-d)*0.35; truck.x+=dx/d*k; truck.y+=dy/d*k; truck.v*=0.96; } } }
function mpInterp(p,t){ const b=p.buf, o=p.cur; let A=null,B=null;
  for(let i=b.length-1;i>=0;i--){ if(b[i][2]<=t){ A=b[i]; B=b[i+1]||null; break; } }
  if(!A){ A=b[0]; B=null; t=A[2]; }
  let x,y,h,v,kx=0,ky=0,th=0; const trl=A[10]?A:null;
  if(B){ const u=(t-A[2])/Math.max(1,B[2]-A[2]); x=A[3]+(B[3]-A[3])*u; y=A[4]+(B[4]-A[4])*u; h=A[5]+wrapA(B[5]-A[5])*u; v=A[6]+(B[6]-A[6])*u;
    if(A[10]&&B[10]===A[10]){ kx=A[15]+(B[15]-A[15])*u; ky=A[16]+(B[16]-A[16])*u; th=A[14]+wrapA(B[14]-A[14])*u; } else if(A[10]){ kx=A[15]; ky=A[16]; th=A[14]; } }
  else { // extrapolate (max 300 ms) along heading with speed; trailer follows the kingpin
    const ex=Math.min(0.3,Math.max(0,(t-A[2])/1000)); const fx=Math.sin(A[5]), fy=-Math.cos(A[5]); x=A[3]+fx*A[6]*ex; y=A[4]+fy*A[6]*ex; h=A[5]; v=A[6];
    if(A[10]){ kx=A[15]+fx*A[6]*ex; ky=A[16]+fy*A[6]*ex; th=A[14]; } }
  // light smoothing on top (kills residual jitter from packet loss without adding much lag)
  const k=p.has?0.5:1; o.x+=(x-o.x)*k; o.y+=(y-o.y)*k; o.h+=wrapA(h-o.h)*k; o.v=v;
  if(trl){ if(!o.tr||o.tr[0]!==A[10]){ o.kx=kx; o.ky=ky; o.th=th; } else { o.kx+=(kx-o.kx)*k; o.ky+=(ky-o.ky)*k; o.th+=wrapA(th-o.th)*k; } o.tr=o.tr&&o.tr[0]===A[10]?o.tr:[A[10],A[11],A[12],A[13]]; } else o.tr=null;
  o.m=A[7]; o.c=A[8]; o.fl=A[9]; p.has=true;
  // drop snapshots older than the one we're interpolating from
  while(b.length>2&&b[1][2]<t-50) b.shift(); }
const mpArt={};
function mpCab(m,c){ const k=m+'|'+c; if(!mpArt[k]){ const a=modelArt(modelById(m),c||modelById(m).cols[0]); mpArt[k]={a,sh:silhouette(a)}; } return mpArt[k]; }
function mpTrl(tr){ const k=tr[1]+'|'+tr[2]+'|'+tr[3]; if(!mpArt[k]) mpArt[k]=tr[1]==='player'?{type:'player'}:{type:tr[1],art:trailerArt(TRAILER_TYPES[tr[1]]?tr[1]:'box',tr[2],tr[3])}; return mpArt[k]; }
function drawRemotePlayers(vx0,vy0,vx1,vy1){ if(!MP.on) return; for(const id in MP.players){ const p=MP.players[id], r=p.cur; if(!p.has) continue; const X=r.x*PPM, Y=r.y*PPM; if(X<vx0-300||X>vx1+300||Y<vy0-300||Y>vy1+300) continue;
    const cab=mpCab(r.m,r.c); drawRig(cab.a,cab.sh,r.x,r.y,r.h,r.tr?mpTrl(r.tr):null,r.kx,r.ky,r.th,6);
    const f=fwd(r.h), rt=rgt(r.h), fl=r.fl|0, br=fl&1, rv=fl&2, ind=(fl>>2)&3, hz=fl&32;
    if(br||rv){ ctx.fillStyle=rv?'rgba(255,255,255,0.95)':'rgba(255,40,30,0.95)'; let bx=r.x-f[0]*1.3, by=r.y-f[1]*1.3, br_=rt; if(r.tr){ const tf=fwd(r.th); bx=r.kx-tf[0]*TRL.rear; by=r.ky-tf[1]*TRL.rear; br_=rgt(r.th); } for(const sd of [-1,1]) ctx.fillRect((bx+br_[0]*sd*1.1)*PPM-2,(by+br_[1]*sd*1.1)*PPM-2,4,4); }
    if(ind||hz) indLampsAt(r.x,r.y,r.h,!!r.tr,r.kx,r.ky,r.th,ind,hz);
    ctx.font='bold 13px system-ui,sans-serif'; ctx.textAlign='center'; const w=ctx.measureText(p.n).width+14; ctx.fillStyle='rgba(8,12,20,0.75)'; ctx.beginPath(); ctx.roundRect(X-w/2,Y-62,w,20,10); ctx.fill(); ctx.fillStyle='#7fd8ff'; ctx.fillText(p.n,X,Y-48); } }
function mpDrawMap(X,Y,labels){ if(!MP.on) return; ctx.save(); ctx.font='bold 10px system-ui,sans-serif'; ctx.textAlign='left';
  for(const id in MP.players){ const p=MP.players[id]; if(!p.has) continue; const r=p.cur; const x=X(r.x), y=Y(r.y); ctx.fillStyle='#29b6ff'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,4.5,0,7); ctx.fill(); ctx.stroke();
    if(labels){ ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.strokeText(p.n,x+7,y+3); ctx.fillStyle='#bfe9ff'; ctx.fillText(p.n,x+7,y+3); } } ctx.restore(); }
// ---------- DOM: lobby, player list, chat, toasts
const MPCSS=`#lobby{margin-top:6px;display:flex;flex-direction:column;gap:10px;align-items:center;cursor:default;pointer-events:auto}
#lobby .row{display:flex;gap:8px;align-items:center} #lobby input{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);border-radius:10px;color:#fff;font-size:16px;padding:9px 12px;font-weight:700;outline:none;width:200px;text-align:center}
#lobby input:focus{border-color:#f5b82e} #lobby .lb{border:none;border-radius:24px;padding:11px 22px;font-weight:900;font-size:15px;letter-spacing:1px;cursor:pointer;background:#2b3444;color:#fff} #lobby .lb:hover{filter:brightness(1.2)}
#lobby .lb.solo{background:#e8a317;color:#1d1406;animation:pulse 1.4s infinite} #lobby .lb.host{background:#1f9d55} #lobby .lb.join{background:#2f81f7}
#lobby .code{font-size:34px;font-weight:900;letter-spacing:4px;color:#7dff9a} #lobby .st{font-size:13px;color:#ffd866;min-height:16px} #lobby .hostbox{display:none;flex-direction:column;gap:8px;align-items:center;background:rgba(0,0,0,.35);border:1px solid rgba(125,255,154,.4);padding:12px 18px;border-radius:14px}
#lobby .link{font-size:12px;opacity:.85;max-width:520px;word-break:break-all}
#mplist{position:absolute;right:14px;top:170px;width:220px;background:rgba(8,12,20,.85);border:1px solid rgba(41,182,255,.5);border-radius:12px;padding:10px 12px;color:#e6edf3;font:12px system-ui,sans-serif;pointer-events:auto;display:none}
#mplist h4{margin:0 0 6px;font-size:12px;letter-spacing:1px;color:#7fd8ff} #mplist .p{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed rgba(255,255,255,.08)} #mplist .me{color:#ffd866}
#mpchat{position:absolute;left:230px;bottom:16px;width:380px;color:#fff;font:12.5px system-ui,sans-serif;pointer-events:none} #mpchat .l{background:rgba(8,12,20,.7);border-radius:8px;padding:3px 8px;margin-top:3px;width:fit-content;max-width:380px;animation:cin .3s both} #mpchat .l b{color:#7fd8ff}
#mpchat input{pointer-events:auto;width:100%;margin-top:4px;background:rgba(8,12,20,.92);border:1px solid #29b6ff;border-radius:8px;color:#fff;padding:7px 9px;font-size:13px;outline:none;display:none}
#mpbadge{position:absolute;right:14px;top:132px;background:rgba(8,12,20,.85);border:1px solid rgba(41,182,255,.6);border-radius:10px;padding:6px 10px;color:#bfe9ff;font:bold 12px system-ui,sans-serif;pointer-events:auto;cursor:pointer;display:none}`;
function mpInit(){ const st=document.createElement('style'); st.textContent=MPCSS; document.head.appendChild(st);
  const ov=document.getElementById('overlay'), go=ov.querySelector('.go'); if(go) go.style.display='none';
  const lb=document.createElement('div'); lb.id='lobby'; const nm=(localStorage.getItem('bigrig.name')||'').replace(/[<>"&]/g,''); const jq=(new URLSearchParams(location.search).get('join')||'').toUpperCase();
  lb.innerHTML=`<div class="row"><span style="opacity:.7;font-weight:700">Your name</span><input id="lbName" maxlength="16" placeholder="Driver name" value="${nm}"></div>
   <div class="row"><button class="lb solo" id="lbSolo">\u25B6 PLAY SOLO</button><button class="lb host" id="lbHost">\u{1F310} HOST GAME</button></div>
   <div class="row"><input id="lbCode" placeholder="TRUCK-0000" value="${jq?(jq.startsWith('TRUCK-')?jq:'TRUCK-'+jq.replace(/\D/g,'')):''}" style="width:160px"><button class="lb join" id="lbJoin">JOIN</button></div>
   <div class="hostbox" id="lbHostBox"><div style="font-size:12px;opacity:.7;letter-spacing:2px">ROOM CODE</div><div class="code" id="lbCodeOut"></div><div class="link" id="lbLink"></div><div class="row"><button class="lb" id="lbCopy">\u{1F4CB} Copy invite link</button><button class="lb solo" id="lbDrive">\u25B6 START DRIVING</button></div><div style="font-size:11px;opacity:.6">Friends can join any time. Up to 8 players.</div></div>
   <div class="st" id="lbStatus"></div>`;
  ov.insertBefore(lb,document.getElementById('loading'));
  const stop=e=>e.stopPropagation(); lb.addEventListener('pointerdown',stop);
  const nameIn=lb.querySelector('#lbName'); nameIn.addEventListener('input',()=>localStorage.setItem('bigrig.name',nameIn.value.trim()));
  const need=()=>{ const n=nameIn.value.trim(); if(!n){ mpStatus('Choose a username first'); nameIn.focus(); return false; } localStorage.setItem('bigrig.name',n); return true; };
  lb.querySelector('#lbSolo').onclick=()=>{ if(MP.on) mpLeave(); startGame(); };
  lb.querySelector('#lbHost').onclick=()=>{ if(!need()) return; if(typeof Peer==='undefined'){ mpStatus('Multiplayer library unavailable'); return; } mpHost(); };
  lb.querySelector('#lbJoin').onclick=()=>{ if(!need()) return; if(typeof Peer==='undefined'){ mpStatus('Multiplayer library unavailable'); return; } mpJoin(lb.querySelector('#lbCode').value); };
  lb.querySelector('#lbCode').addEventListener('keydown',e=>{ if(e.key==='Enter') lb.querySelector('#lbJoin').click(); });
  lb.querySelector('#lbCopy').onclick=()=>{ const t=lb.querySelector('#lbLink').textContent; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>mpStatus('Invite link copied'),()=>{ const r=document.createRange(); r.selectNodeContents(lb.querySelector('#lbLink')); getSelection().removeAllRanges(); getSelection().addRange(r); mpStatus('Press Ctrl+C to copy'); }); };
  lb.querySelector('#lbDrive').onclick=()=>startGame();
  if(jq) mpStatus('Invite found \u2014 enter your name and press JOIN');
  // typing in inputs must not drive the truck
  addEventListener('keydown',e=>{ if(!MP.on||!started||career.uiOpen) return; if(e.code==='Tab'){ e.preventDefault(); mpToggleList(); } else if(e.code==='Enter'&&!bigmap.open){ e.preventDefault(); const ci=document.getElementById('mpChatIn'); ci.style.display='block'; for(const k in input) input[k]=false; setTimeout(()=>ci.focus(),0); } });
  const ui=document.getElementById('ui')||document.getElementById('frame'); const host=document.getElementById('frame');
  const pl=document.createElement('div'); pl.id='mplist'; host.appendChild(pl); const ch=document.createElement('div'); ch.id='mpchat'; ch.innerHTML='<div id="mpLines"></div><input id="mpChatIn" maxlength="140" placeholder="Say something\u2026 (Enter to send, Esc to cancel)">'; host.appendChild(ch);
  { const tg=ch.querySelector('#mpChatIn'); tg.addEventListener('keydown',e=>{ if(e.key==='Enter'){ mpChatSend(tg.value); tg.value=''; tg.style.display='none'; tg.blur(); } else if(e.key==='Escape'){ tg.value=''; tg.style.display='none'; tg.blur(); } }); }
  const bd=document.createElement('div'); bd.id='mpbadge'; bd.onclick=mpToggleList; host.appendChild(bd); }
function mpLobbyHosted(){ const b=document.getElementById('lbHostBox'); b.style.display='flex'; document.getElementById('lbCodeOut').textContent=MP.code; const base=location.href.split('?')[0].split('#')[0]; document.getElementById('lbLink').textContent=base+'?join='+MP.code; mpRender(); }
function mpLobbyClose(){ const b=document.getElementById('lbHostBox'); if(b) b.style.display='none'; }
function mpLobbyOpen(){ mpLobbyClose(); }
function mpStatus(t){ const s=document.getElementById('lbStatus'); if(s) s.textContent=t; }
function mpToast(t){ if(typeof toast==='function') toast(t); else flash(t); }
function mpToggleList(){ MP.listOpen=!MP.listOpen; mpRender(); }
function mpRender(){ const pl=document.getElementById('mplist'), bd=document.getElementById('mpbadge'); if(!pl) return; const n=Object.keys(MP.players).length+1;
  bd.style.display=MP.on?'block':'none'; bd.textContent='\u{1F310} '+MP.code+' \u2022 '+n+' player'+(n>1?'s':'')+' (Tab)';
  pl.style.display=MP.on&&MP.listOpen?'block':'none';
  pl.innerHTML=`<h4>PLAYERS \u2022 ${MP.code} ${MP.host?'(you host)':''}</h4><div class="p me"><span>\u2B50 ${esc(MP.name)} (you)</span><span>${MP.host?'host':''}</span></div>`+Object.values(MP.players).map(p=>{ const r=p.has?p.cur:null; const d=r?Math.hypot(r.x-truck.x,r.y-truck.y):0; return `<div class="p"><span>\u{1F69A} ${esc(p.n)}</span><span style="opacity:.7">${r?(d>=1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'):'\u2026'}</span></div>`; }).join('')+
   `<div style="margin-top:8px;opacity:.6;font-size:11px">Enter = chat \u2022 Tab = close</div><button class="chip" id="mpLeaveBtn" style="margin-top:6px">${MP.host?'End session':'Leave'}</button>`;
  const lv=pl.querySelector('#mpLeaveBtn'); if(lv) lv.onclick=()=>{ if(MP.host){ mpLeave(); mpToast('Session ended'); } else { MP.ended=true; mpReset(); mpToast('Left the game'); } mpRender(); }; }
setInterval(()=>{ if(MP.on&&MP.listOpen) mpRender(); },1000);
function mpChatSend(t){ t=String(t||'').trim().slice(0,140); if(!t||!MP.on) return; mpSend({t:'chat',id:MP.myId,n:MP.name,x:t}); mpChatLine(MP.name,t); }
function mpChatLine(n,t){ const L=document.getElementById('mpLines'); if(!L) return; const d=document.createElement('div'); d.className='l'; d.innerHTML='<b>'+esc(n)+':</b> '+esc(t); L.appendChild(d); MP.chat.push([n,t]); while(L.children.length>5) L.firstChild.remove(); setTimeout(()=>{ d.style.transition='opacity .6s'; d.style.opacity='0'; setTimeout(()=>d.remove(),700); },12000); }

// fast travel: tell peers to snap (not glide) the truck to its new spot
BigRig.on('fastTravel',()=>{ if(!MP.on) return; mpSend({t:'ft',id:MP.myId,ts:Math.round(performance.now())}); mpSend(mpSelfPose(),true); });
