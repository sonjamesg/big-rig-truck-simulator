'use strict';
// ===================== v10 MULTIPLAYER — PeerJS (WebRTC, free public broker, no backend). Star topology: host relays. =====================
const MP={on:false,host:false,peer:null,conns:{},hostConn:null,code:'',myId:'',name:'',players:{},chat:[],listOpen:false,sendT:0,rate:1/16,ended:false,max:8};
const MP_PREFIX='bigrig-tsim-';
function mpName(){ return (document.getElementById('lbName')||{}).value||localStorage.getItem('bigrig.name')||'Driver'; }
function mpSelfState(){ const s=truck, tr=s.trl, k=kingpin(s); return {t:'st',id:MP.myId,n:MP.name,x:+s.x.toFixed(2),y:+s.y.toFixed(2),h:+s.h.toFixed(3),v:+s.v.toFixed(2),
  m:career.cur,c:career.colors[career.cur]||null,tr:tr?{ty:tr.type,c:tr.col,l:tr.logo,th:+tr.th.toFixed(3),kx:+k[0].toFixed(2),ky:+k[1].toFixed(2)}:null,
  br:(s.brake||0)>0.1?1:0,rv:s.mode==='R'?1:0,ind:(input.left&&s.v>0.5)?-1:(input.right&&s.v>0.5)?1:(input.padSteer<-0.5?-1:input.padSteer>0.5?1:0),hz:input.hand?1:0}; }
// ---------- network
function mpSendAll(msg,except){ const d=JSON.stringify(msg); for(const id in MP.conns){ const c=MP.conns[id]; if(id!==except&&c.open) try{ c.send(d); }catch(e){} } }
function mpSend(msg){ if(MP.host) mpSendAll(msg); else if(MP.hostConn&&MP.hostConn.open) try{ MP.hostConn.send(JSON.stringify(msg)); }catch(e){} }
function mpRoster(){ return Object.values(MP.players).map(p=>({id:p.id,n:p.n})).concat([{id:MP.myId,n:MP.name}]); }
function mpOnMsg(raw,from){ let m; try{ m=typeof raw==='string'?JSON.parse(raw):raw; }catch(e){ return; }
  if(m.t==='st'){ if(MP.host&&from) m.id=from; mpState(m); if(MP.host) mpSendAll(m,from); return; }
  if(m.t==='hello'&&MP.host){ const n=String(m.n||'Driver').slice(0,16); MP.players[from]=MP.players[from]||{id:from,n,buf:[]}; MP.players[from].n=n;
    const cc=MP.conns[from]; if(cc) cc.send(JSON.stringify({t:'welcome',id:from,host:MP.myId,roster:mpRoster()})); mpSendAll({t:'join',id:from,n},from); mpToast('\u{1F69A} '+n+' joined'); mpRender(); return; }
  if(m.t==='welcome'){ MP.myId=m.id; for(const p of m.roster) if(p.id!==MP.myId) MP.players[p.id]=MP.players[p.id]||{id:p.id,n:p.n,buf:[]}; mpToast('Connected to '+MP.code+' \u2022 '+m.roster.length+' players'); mpRender(); BigRig.emit('mpJoined',{id:m.id}); return; }
  if(m.t==='join'){ if(m.id!==MP.myId){ MP.players[m.id]=MP.players[m.id]||{id:m.id,n:m.n,buf:[]}; mpToast('\u{1F69A} '+m.n+' joined'); mpRender(); } return; }
  if(m.t==='leave'){ const p=MP.players[m.id]; if(p){ delete MP.players[m.id]; mpToast('\u{1F44B} '+p.n+' left'); mpRender(); } return; }
  if(m.t==='chat'){ if(MP.host&&from){ m.id=from; m.n=(MP.players[from]||{}).n||'?'; mpSendAll(m,from); } mpChatLine(m.n,String(m.x).slice(0,140)); return; }
  if(m.t==='end'){ mpEnded('The host ended the session'); return; } }
function mpState(m){ let p=MP.players[m.id]; if(!p){ p=MP.players[m.id]={id:m.id,n:m.n||'Driver',buf:[]}; mpRender(); } p.n=m.n||p.n; m.at=performance.now(); p.buf.push(m); if(p.buf.length>12) p.buf.shift(); p.last=m.at; }
function mpNewPeer(id){ return new Peer(id,{debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}}); }
function mpHost(){ mpReset(); MP.name=mpName(); const code=String(1000+((Math.random()*9000)|0)); MP.code='TRUCK-'+code; mpStatus('Opening room '+MP.code+'\u2026');
  const pr=MP.peer=mpNewPeer(MP_PREFIX+code.toLowerCase()); MP.host=true;
  pr.on('open',id=>{ MP.myId=id; MP.on=true; mpStatus(''); mpLobbyHosted(); BigRig.emit('mpHosting',{code:MP.code}); });
  pr.on('connection',c=>{ if(Object.keys(MP.conns).length>=MP.max-1){ c.on('open',()=>{ c.send(JSON.stringify({t:'end',why:'full'})); setTimeout(()=>c.close(),300); }); return; } MP.conns[c.peer]=c;
    c.on('data',d=>mpOnMsg(d,c.peer)); const gone=()=>{ if(!MP.conns[c.peer]) return; delete MP.conns[c.peer]; const p=MP.players[c.peer]; delete MP.players[c.peer]; if(p){ mpToast('\u{1F44B} '+p.n+' left'); mpSendAll({t:'leave',id:c.peer}); } mpRender(); }; c.on('close',gone); c.on('error',gone); });
  pr.on('error',e=>{ if(e.type==='unavailable-id'){ mpStatus('Code taken, retrying\u2026'); setTimeout(mpHost,300); } else mpStatus('Network error: '+e.type); }); }
function mpJoin(code){ mpReset(); MP.name=mpName(); code=String(code||'').toUpperCase().replace(/[^0-9]/g,''); if(code.length<4){ mpStatus('Enter a room code like TRUCK-4821'); return; }
  MP.code='TRUCK-'+code; mpStatus('Connecting to '+MP.code+'\u2026'); const pr=MP.peer=mpNewPeer();
  pr.on('open',()=>{ const c=MP.hostConn=pr.connect(MP_PREFIX+code,{reliable:true}); const to=setTimeout(()=>{ if(!MP.on) mpStatus('No game found with code '+MP.code); },9000);
    c.on('open',()=>{ clearTimeout(to); MP.on=true; MP.host=false; c.send(JSON.stringify({t:'hello',n:MP.name})); mpStatus(''); mpLobbyClose(); startGame(); });
    c.on('data',d=>mpOnMsg(d,null)); c.on('close',()=>mpEnded('Disconnected from the host')); c.on('error',()=>mpEnded('Connection error')); });
  pr.on('error',e=>{ mpStatus(e.type==='peer-unavailable'?'No game found with code '+MP.code:'Network error: '+e.type); }); }
function mpReset(){ try{ if(MP.peer) MP.peer.destroy(); }catch(e){} MP.on=false; MP.host=false; MP.peer=null; MP.conns={}; MP.hostConn=null; MP.players={}; MP.ended=false; mpRender(); }
function mpLeave(){ if(MP.host) mpSendAll({t:'end'}); MP.ended=true; setTimeout(mpReset,150); }
function mpEnded(why){ if(MP.ended||!MP.on) return; MP.ended=true; mpReset(); mpToast(why); started=false; const ov=document.getElementById('overlay'); ov.classList.remove('hidden'); mpLobbyOpen(); mpStatus(why+' \u2014 back in the lobby'); BigRig.emit('mpEnded',{why}); }
addEventListener('beforeunload',()=>{ if(MP.on&&MP.host) mpSendAll({t:'end'}); });
// ---------- per-frame
function updateMP(dt){ if(!MP.on) return; MP.sendT-=dt; if(MP.sendT<=0&&started){ MP.sendT=MP.rate; mpSend(mpSelfState()); }
  const now=performance.now(); for(const id in MP.players){ const p=MP.players[id]; const r=mpInterp(p,now-110); p.cur=r; if(!r) continue;
    // soft collision: gentle push apart + speed scrub (never a hard stop)
    const dx=truck.x-r.x, dy=truck.y-r.y, d=Math.hypot(dx,dy); if(d<4.2&&d>0.01){ const k=(4.2-d)*0.35; truck.x+=dx/d*k; truck.y+=dy/d*k; truck.v*=0.96; } } }
function mpInterp(p,t){ const b=p.buf; if(!b.length) return null; if(b.length===1||t<=b[0].at) return b[0]; let i=b.length-1; while(i>0&&b[i-1].at>t) i--; if(t>=b[b.length-1].at){ const L=b[b.length-1]; const ex=Math.min(0.25,(t-L.at)/1000); const f=fwd(L.h); return Object.assign({},L,{x:L.x+f[0]*L.v*ex,y:L.y+f[1]*L.v*ex}); }
  const A=b[i-1],B=b[i], u=(t-A.at)/Math.max(1,B.at-A.at), la=(a,c)=>a+(c-a)*u, lh=(a,c)=>{ let d=c-a; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return a+d*u; };
  const o=Object.assign({},B,{x:la(A.x,B.x),y:la(A.y,B.y),h:lh(A.h,B.h),v:la(A.v,B.v)}); if(A.tr&&B.tr) o.tr=Object.assign({},B.tr,{kx:la(A.tr.kx,B.tr.kx),ky:la(A.tr.ky,B.tr.ky),th:lh(A.tr.th,B.tr.th)}); return o; }
const mpArt={};
function mpCab(m,c){ const k=m+'|'+c; if(!mpArt[k]){ const a=modelArt(modelById(m),c||modelById(m).cols[0]); mpArt[k]={a,sh:silhouette(a)}; } return mpArt[k]; }
function mpTrl(t){ const k=t.ty+'|'+t.c+'|'+t.l; if(!mpArt[k]) mpArt[k]=t.ty==='player'?{type:'player'}:{type:t.ty,art:trailerArt(t.ty,t.c,t.l)}; return mpArt[k]; }
function drawRemotePlayers(vx0,vy0,vx1,vy1){ if(!MP.on) return; for(const id in MP.players){ const p=MP.players[id], r=p.cur; if(!r) continue; const X=r.x*PPM, Y=r.y*PPM; if(X<vx0-300||X>vx1+300||Y<vy0-300||Y>vy1+300) continue;
    const cab=mpCab(r.m,r.c); if(r.tr&&TRAILER_TYPES[r.tr.ty]||r.tr&&r.tr.ty==='player'){ const t=mpTrl(r.tr); drawTrailerAt(t,r.tr.kx,r.tr.ky,r.tr.th,true); drawTrailerAt(t,r.tr.kx,r.tr.ky,r.tr.th,false); }
    blit(cab.sh,r.x,r.y,r.h,6,6); blit(cab.a,r.x,r.y,r.h);
    const f=fwd(r.h), rt=rgt(r.h); if(r.br||r.rv){ ctx.fillStyle=r.rv?'rgba(255,255,255,0.95)':'rgba(255,40,30,0.95)'; for(const sd of [-1,1]) ctx.fillRect((r.x-f[0]*1.3+rt[0]*sd*1.1)*PPM-2,(r.y-f[1]*1.3+rt[1]*sd*1.1)*PPM-2,4,4); }
    if((r.ind||r.hz)&&(timeS*2.5)%1<0.5){ ctx.fillStyle='#ffb020'; for(const sd of (r.hz?[-1,1]:[r.ind])) for(const fb of [5.0,-1.3]) ctx.fillRect((r.x+f[0]*fb+rt[0]*sd*1.2)*PPM-2.5,(r.y+f[1]*fb+rt[1]*sd*1.2)*PPM-2.5,5,5); }
    ctx.font='bold 13px system-ui,sans-serif'; ctx.textAlign='center'; const w=ctx.measureText(p.n).width+14; ctx.fillStyle='rgba(8,12,20,0.75)'; ctx.beginPath(); ctx.roundRect(X-w/2,Y-62,w,20,10); ctx.fill(); ctx.fillStyle='#7fd8ff'; ctx.fillText(p.n,X,Y-48); } }
function mpDrawMap(X,Y,labels){ if(!MP.on) return; ctx.save(); ctx.font='bold 10px system-ui,sans-serif'; ctx.textAlign='left';
  for(const id in MP.players){ const r=MP.players[id].cur; if(!r) continue; const x=X(r.x), y=Y(r.y); ctx.fillStyle='#29b6ff'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,4.5,0,7); ctx.fill(); ctx.stroke();
    if(labels){ ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.strokeText(MP.players[id].n,x+7,y+3); ctx.fillStyle='#bfe9ff'; ctx.fillText(MP.players[id].n,x+7,y+3); } } ctx.restore(); }
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
  pl.innerHTML=`<h4>PLAYERS \u2022 ${MP.code} ${MP.host?'(you host)':''}</h4><div class="p me"><span>\u2B50 ${esc(MP.name)} (you)</span><span>${MP.host?'host':''}</span></div>`+Object.values(MP.players).map(p=>{ const r=p.cur; const d=r?Math.hypot(r.x-truck.x,r.y-truck.y):0; return `<div class="p"><span>\u{1F69A} ${esc(p.n)}</span><span style="opacity:.7">${r?(d>=1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'):'\u2026'}</span></div>`; }).join('')+
   `<div style="margin-top:8px;opacity:.6;font-size:11px">Enter = chat \u2022 Tab = close</div><button class="chip" id="mpLeaveBtn" style="margin-top:6px">${MP.host?'End session':'Leave'}</button>`;
  const lv=pl.querySelector('#mpLeaveBtn'); if(lv) lv.onclick=()=>{ if(MP.host){ mpLeave(); mpToast('Session ended'); } else { MP.ended=true; mpReset(); mpToast('Left the game'); } mpRender(); }; }
setInterval(()=>{ if(MP.on&&MP.listOpen) mpRender(); },1000);
function mpChatSend(t){ t=String(t||'').trim().slice(0,140); if(!t||!MP.on) return; mpSend({t:'chat',id:MP.myId,n:MP.name,x:t}); mpChatLine(MP.name,t); }
function mpChatLine(n,t){ const L=document.getElementById('mpLines'); if(!L) return; const d=document.createElement('div'); d.className='l'; d.innerHTML='<b>'+esc(n)+':</b> '+esc(t); L.appendChild(d); MP.chat.push([n,t]); while(L.children.length>5) L.firstChild.remove(); setTimeout(()=>{ d.style.transition='opacity .6s'; d.style.opacity='0'; setTimeout(()=>d.remove(),700); },12000); }
