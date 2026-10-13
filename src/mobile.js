'use strict';
// ===================== v11 MOBILE: landscape thumb layout (controls in side gutters, never over the HUD) + portrait handheld deck =====================
const MOB={on:false,mode:'',steerId:null,ctx:{},lastCtx:0};
const MOBCSS=`
body.touch{overflow:hidden;position:fixed;inset:0;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}
body.touch #titlebar,body.touch #help,body.touch #credits,body.touch #touch,body.touch #fs{display:none!important}
body.touch #wrap{margin:0;width:auto} body.touch #scaler{transform:none!important;width:auto}
body.touch #frame{position:fixed;padding:0;border:none;background:#000;box-shadow:none;border-radius:6px;width:auto;z-index:1}
body.touch canvas{border-radius:6px}
body.touch #overlay,body.touch #ui{position:fixed;inset:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);border-radius:0;z-index:20}
body.touch #ui{pointer-events:none} body.touch #hudbtns{display:none}
body.touch #overlay{overflow:auto;justify-content:safe center;align-items:center;padding:16px 14px;box-sizing:border-box}
body.touch #overlay p:not(#loading){display:none} body.touch #overlay #logo{max-width:78vw!important;max-height:26vh!important} body.touch #overlay .go{max-width:92vw;font-size:18px;box-sizing:border-box}
body.touch #overlay button,body.touch #overlay input{max-width:100%;box-sizing:border-box} body.touch #lobby,body.touch #wbCard{width:min(92vw,420px)!important;box-sizing:border-box} body.touch #lobby{align-items:stretch} body.touch #lobby .row{flex-direction:column;align-items:stretch;align-self:stretch;gap:8px} body.touch:has(#overlay:not(.hidden)) #mob,body.touch:has(#overlay:not(.hidden)) #deck{display:none!important} body.touch #lobby .row>*{width:100%!important;margin:0!important}
body.touch #overlay h1{font-size:40px;margin-top:4px} body.touch #overlay h2{font-size:15px;letter-spacing:5px;margin:4px 0 12px} body.touch #overlay p{font-size:12px;margin-top:10px}
body.touch #lobby .row{flex-wrap:wrap;justify-content:center} body.touch #lobby input{font-size:16px}
#mob{display:none;position:fixed;inset:0;z-index:5;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body.touch #mob{display:block}
#mob .b{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-weight:900;border-radius:16px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.32);box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .06s,background .06s,opacity .2s}
#mob .b small{font-size:9px;font-weight:800;letter-spacing:.8px;opacity:.85;margin-top:2px}
#mob .b.on{transform:scale(.94);background:rgba(245,184,46,.55);border-color:#f5b82e}
#mob .b.hide{opacity:0;pointer-events:none} #mob .b.dim{opacity:.35}
#mob .gas{background:linear-gradient(180deg,rgba(61,220,132,.35),rgba(31,157,85,.3));border-color:rgba(61,220,132,.7);border-radius:18px}
#mob .brk{background:linear-gradient(180deg,rgba(255,107,91,.35),rgba(192,57,43,.3));border-color:rgba(255,120,100,.7);border-radius:18px}
#mob .pedal-ribs{width:60%;height:50%;background:repeating-linear-gradient(0deg,rgba(255,255,255,.35) 0 4px,transparent 4px 11px);border-radius:6px}
#mob .steer{border-radius:60px;background:rgba(255,255,255,.08)}
#mob .knob{position:absolute;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,#ffffff33 60%);border:3px solid rgba(255,255,255,.6);left:50%;pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:20px}
#mob .ctx{background:rgba(245,184,46,.3);border-color:#f5b82e}
/* portrait handheld */
#deck{display:none;position:fixed;left:0;right:0;bottom:0;pointer-events:none;background:linear-gradient(180deg,#c9cdd6,#aeb3be 60%,#9aa0ac);border-radius:28px 28px 0 0;box-shadow:inset 0 3px 0 rgba(255,255,255,.6),inset 0 -2px 0 rgba(0,0,0,.2),0 -6px 24px rgba(0,0,0,.45)}
body.touch.portrait #deck{display:block}
#deck .brand{position:absolute;left:50%;transform:translateX(-50%);top:10px;font:italic 900 15px system-ui;letter-spacing:2px;color:#3b3f86;white-space:nowrap} #deck .brand b{color:#b0282c}
#deck .grille{position:absolute;right:16px;bottom:calc(10px + env(safe-area-inset-bottom));width:44px;height:30px;transform:rotate(-28deg);background:repeating-linear-gradient(90deg,rgba(60,60,70,.55) 0 5px,transparent 5px 12px);border-radius:4px}
body.portrait #mob .dp{background:#2a2d33;border:none;border-radius:6px;box-shadow:0 3px 0 #111,inset 0 1px 0 rgba(255,255,255,.15);color:#aab}
body.portrait #mob .dpc{background:#2a2d33;border:none;border-radius:0;box-shadow:none}
body.portrait #mob .ab{border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9446b,#9b1f45);border:none;box-shadow:0 4px 0 #5c1028,inset 0 1px 0 rgba(255,255,255,.35);font-size:22px}
body.portrait #mob .ab small{position:absolute;bottom:-20px;color:#3b3f86;font-size:11px;opacity:1}
body.portrait #mob .pill{border-radius:20px;background:#6b7080;border:none;box-shadow:0 2px 0 #3a3e48;font-size:10px;letter-spacing:1px;transform:rotate(-24deg)}
body.portrait #mob .pill small{position:absolute;bottom:-17px;color:#3b3f86;font-size:10px}
body.portrait #mob .fn{border-radius:12px;background:#3d4252;border:none;box-shadow:0 3px 0 #1d2029;font-size:17px}
body.portrait #mob .fn.on,body.portrait #mob .ab.on,body.portrait #mob .dp.on{transform:translateY(2px);filter:brightness(1.3)}
body.portrait #mob .fn.ctxon{background:#c98a10;box-shadow:0 3px 0 #6d4a06}
body.touch.portrait .modal,body.touch .modal{width:min(916px,96vw)!important;height:min(552px,94vh)!important}
@media (max-width:760px){ #ui .grid{grid-template-columns:minmax(0,1fr)!important} #ui .bar{flex-wrap:wrap} #ui .mh .sub{display:none} #ui .detail{flex-wrap:wrap} #ui .btn.start{width:100%} #ui .show{flex-direction:column;overflow:auto} #ui .tl{width:auto;flex-direction:row;overflow-x:auto;border-right:none} #ui .ti{flex:none} .result{width:94vw!important} }
@media (max-height:460px){ #ui .mh{padding:8px 12px} #ui .bar{padding:6px 12px} #ui .stage .floor{height:150px} }
`;
function mobBtn(id,html,cls,k){ const b=document.createElement('div'); b.className='b '+(cls||''); b.id=id; b.innerHTML=html; document.getElementById('mob').appendChild(b);
  const on=e=>{ e.preventDefault(); b.classList.add('on'); if(navigator.vibrate) try{ navigator.vibrate(8); }catch(_){} if(audio.ctx&&audio.ctx.state==='suspended') audio.ctx.resume();
      if(typeof k==='string'){ if(career.uiOpen&&MOB.nav[k]){ MOB.nav[k](); return; } input[k]=true; } else if(k) k(); },
    off=e=>{ e.preventDefault(); b.classList.remove('on'); if(typeof k==='string') input[k]=false; };
  b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('pointerleave',off); return b; }
MOB.nav={ left:()=>padNav('l'), right:()=>padNav('r'), up:()=>padNav('u'), down:()=>padNav('d'),
  okA:()=>{ const el=padFocusEl(); if(el){ el.click(); setTimeout(()=>padNav(null),40); } else padNav(null); }, back:()=>{ if(career.uiOpen==='result'){ const k=document.querySelector('#ui #keep'); if(k) k.click(); } else closeUI(); } };
const act=f=>()=>{ if(!started){ startGame(); return; } f(); };
function mobCSS(){ if(MOB.css) return; MOB.css=1; const st=document.createElement('style'); st.textContent=MOBCSS; document.head.appendChild(st); }
if(('ontouchstart' in window)||navigator.maxTouchPoints>0){ document.body.classList.add('touch'); mobCSS(); }
function mobInit(){ if(!document.body.classList.contains('touch')) return; MOB.on=true; mobCSS();
  const vp=document.querySelector('meta[name=viewport]'); if(vp) vp.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  const m=document.createElement('div'); m.id='mob'; document.body.appendChild(m); const dk=document.createElement('div'); dk.id='deck'; dk.innerHTML='<div class="brand">BIG RIG <b>BOY</b></div><div class="grille"></div>'; document.body.insertBefore(dk,m);
  // driving
  mobBtn('mGas','<div class="pedal-ribs"></div><small>GAS</small>','gas','up'); mobBtn('mBrk','<div class="pedal-ribs"></div><small>BRAKE / REV</small>','brk','down');
  const s=mobBtn('mSteer','<div class="knob">\u25C0\u25B6</div>','steer',null); mobSteer(s);
  mobBtn('mLeft','\u25C0','dp','left'); mobBtn('mRight','\u25B6','dp','right'); mobBtn('mUp','\u25B2','dp',()=>{ if(career.uiOpen) MOB.nav.up(); else if(MP.on) mpToggleList(); }); mobBtn('mDown','\u25BC','dp',()=>{ if(career.uiOpen) MOB.nav.down(); });
  mobBtn('mCen','','dp dpc',null);
  mobBtn('mA','A<small>GAS</small>','ab',()=>{ if(career.uiOpen) MOB.nav.okA(); else { if(!started) startGame(); input.up=true; } });
  mobBtn('mB','B<small>BRAKE</small>','ab',()=>{ if(career.uiOpen) MOB.nav.back(); else input.down=true; });
  for(const id of ['mA','mB']){ const el=document.getElementById(id); const off=()=>{ input[id==='mA'?'up':'down']=false; }; el.addEventListener('pointerup',off); el.addEventListener('pointercancel',off); el.addEventListener('pointerleave',off); }
  mobBtn('mIndL','\u2B05<small>IND</small>','fn',act(()=>indToggle(1))); mobBtn('mIndR','\u27A1<small>IND</small>','fn',act(()=>indToggle(2))); mobBtn('mHaz','\u26A0<small>HAZ</small>','fn',act(()=>hazToggle())); mobBtn('mHand','P<small>HANDBRAKE</small>','fn','hand'); mobBtn('mHorn','\u{1F4E3}<small>HORN</small>','fn','horn');
  mobBtn('mCouple','\u{1F517}<small>COUPLE</small>','fn ctx',act(()=>toggleCouple())); mobBtn('mFuel','\u26FD<small>REFUEL</small>','fn ctx',act(()=>toggleRefuel())); mobBtn('mUnload','\u{1F4E6}<small>UNLOAD</small>','fn ctx',act(()=>tryUnload()));
  mobBtn('mJobs','\u{1F4CB}<small>JOBS</small>','fn pill',act(()=>{ if(career.uiOpen) closeUI(); else openBoard(); })); mobBtn('mMap','\u{1F5FA}<small>MAP</small>','fn pill',act(()=>{ bigmap.open?closeMap():openMap(); }));
  mobBtn('mChat','\u{1F4AC}<small>CHAT</small>','fn',()=>{ if(!MP.on) return; const ci=document.getElementById('mpChatIn'); ci.style.display='block'; setTimeout(()=>ci.focus(),0); });
  document.getElementById('frame').addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  addEventListener('resize',mobLayout); addEventListener('orientationchange',()=>setTimeout(mobLayout,200)); mobLayout(); setInterval(mobContext,250); }
function mobSteer(el){ const knob=el.querySelector('.knob');
  const upd=e=>{ const r=el.getBoundingClientRect(); const u=Math.max(-1,Math.min(1,(e.clientX-(r.left+r.width/2))/(r.width/2-30))); input.padSteer=Math.abs(u)<0.06?0:u; knob.style.left=(50+u*(50-30/r.width*100))+'%'; };
  el.addEventListener('pointerdown',e=>{ if(career.uiOpen) return; MOB.steerId=e.pointerId; el.setPointerCapture(e.pointerId); upd(e); });
  el.addEventListener('pointermove',e=>{ if(e.pointerId===MOB.steerId) upd(e); });
  const end=e=>{ if(e.pointerId!==MOB.steerId) return; MOB.steerId=null; input.padSteer=0; knob.style.left='50%'; el.classList.remove('on'); };
  el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end); }
function place(id,x,y,w,h,show=true){ const b=document.getElementById(id); if(!b) return; b.style.left=x+'px'; b.style.top=y+'px'; b.style.width=w+'px'; b.style.height=h+'px'; b.style.display=show?'flex':'none'; }
function mobLayout(){ if(!MOB.on) return; const W=innerWidth, H=innerHeight, por=H>W; document.body.classList.toggle('portrait',por); MOB.mode=por?'portrait':'landscape';
  const cv=document.getElementById('game'), fr=document.getElementById('frame'); const sa=(n)=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n))||0;
  let cw,ch,cx,cy;
  if(!por){ // landscape: canvas centred, controls live in the side gutters
    const G=Math.max(150,Math.min(230,W*0.19)); cw=W-2*G; ch=cw/1.6; if(ch>H-8){ ch=H-8; cw=ch*1.6; } cx=(W-cw)/2; cy=(H-ch)/2;
    const g=(W-cw)/2, pad=10, bh=Math.min(170,H*0.42);
    place('mSteer',pad,H-bh*0.62-pad,g-2*pad,bh*0.62); place('mGas',W-g+pad+(g-2*pad)*0.48,H-bh-pad,(g-2*pad)*0.52,bh); place('mBrk',W-g+pad,H-bh*0.72-pad,(g-2*pad)*0.44,bh*0.72);
    const sb=Math.min(58,(g-3*pad)/2), row=(i,j,side)=>[side?W-g+pad+j*(sb+pad):pad+j*(sb+pad),pad+i*(sb+pad)];
    let p=row(0,0,0); place('mHand',p[0],p[1],sb,sb); p=row(0,1,0); place('mHorn',p[0],p[1],sb,sb); p=row(1,0,0); place('mJobs',p[0],p[1],sb,sb); p=row(1,1,0); place('mMap',p[0],p[1],sb,sb);
    p=row(2,0,0); place('mChat',p[0],p[1],sb,sb,MP.on);
    p=row(0,0,1); place('mCouple',p[0],p[1],sb,sb); p=row(0,1,1); place('mFuel',p[0],p[1],sb,sb); p=row(1,0,1); place('mUnload',p[0],p[1],sb*2+pad,sb); p=row(2,0,1); place('mIndL',p[0],p[1],sb,sb); p=row(2,1,1); place('mIndR',p[0],p[1],sb,sb); p=row(3,0,1); place('mHaz',p[0],p[1],sb*2+pad,sb*0.7);
    for(const id of ['mLeft','mRight','mUp','mDown','mCen','mA','mB']) place(id,0,0,0,0,false);
  } else { // portrait: handheld — screen on top, deck below
    const top=sa('--sat'); cw=Math.min(W-12,H*0.56); ch=cw; cx=(W-cw)/2; cy=6+Math.max(0,top); const deckTop=cy+ch+6; const dk=document.getElementById('deck'); dk.style.top=deckTop+'px';
    const DH=H-deckTop, u=Math.min(W/412,DH/330); const S=v=>v*u;
    const dcx=S(78), dcy=deckTop+S(98), k=S(38); place('mUp',dcx-k/2,dcy-k*1.5,k,k); place('mDown',dcx-k/2,dcy+k/2,k,k); place('mLeft',dcx-k*1.5,dcy-k/2,k,k); place('mRight',dcx+k/2,dcy-k/2,k,k); place('mCen',dcx-k/2,dcy-k/2,k,k);
    const ab=S(58); place('mB',W-S(150),dcy-ab*0.2,ab,ab); place('mA',W-S(78),dcy-ab*0.85,ab,ab);
    const fy=deckTop+S(178), fw=Math.min(S(56),(W-40)/5-8), gap=(W-5*fw)/6; ['mCouple','mFuel','mUnload','mHand','mHorn'].forEach((id,i)=>place(id,gap+i*(fw+gap),fy,fw,fw*0.78)); ['mIndL','mHaz','mIndR'].forEach((id,i)=>place(id,gap+(i*2)*(fw+gap),fy+fw*0.84,fw,fw*0.5));
    const py=fy+fw*1.48; place('mMap',W/2-S(86),py,S(66),S(24)); place('mJobs',W/2+S(14),py,S(66),S(24)); place('mChat',S(14),py-S(6),S(48),S(36),MP.on);
    for(const id of ['mSteer','mGas','mBrk']) place(id,0,0,0,0,false);
  }
  cv.style.width=cw+'px'; cv.style.height=ch+'px'; fr.style.left=cx+'px'; fr.style.top=cy+'px'; fr.style.width=cw+'px'; fr.style.height=ch+'px';
  // overlays (#ui / lobby) cover the whole screen in portrait, the canvas area in landscape is too small for modals so they also go full-screen
}
function mobContext(){ if(!MOB.on) return; const a=career.active; const s=truck;
  const fuel=!!(started&&fuelStationAt&&fuelStationAt())||refuel.active; let cpl=false; if(started){ if(s.trl) cpl=Math.abs(s.v)<1; else { const c=coupleCandidate(); cpl=!!(c&&c.d<8); } }
  let unl=false; if(a&&(a.phase==='deliver'||a.phase==='unloading')){ const al=bayAlign(a.bay); unl=!!(al&&al.dist<30); }
  const por=MOB.mode==='portrait'; const set=(id,on)=>{ const b=document.getElementById(id); if(!b) return; if(por){ b.classList.remove('hide'); b.classList.toggle('ctxon',on); b.classList.toggle('dim',!on); } else { b.classList.toggle('hide',!on); } };
  set('mCouple',cpl); set('mFuel',fuel); set('mUnload',unl); const c=document.getElementById('mChat'); if(c) c.style.display=MP.on?'flex':'none';
  const cb=document.getElementById('mCouple'); if(cb) cb.querySelector('small').textContent=s.trl?'UNCOUPLE':'COUPLE'; }
