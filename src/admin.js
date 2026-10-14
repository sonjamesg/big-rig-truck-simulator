'use strict';
// ===================== ad: local admin mode (name "sonjames" + PIN). Only the SHA-256 of the PIN is stored. Never sent in multiplayer. =====================
const AD={H:'41214f55c1e8d6170239eb93d7cc105abbee1dc0fbe8f7a258962da285dfe9cd',asked:false,tp:false,pin:''};
function adSha(str){ const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b=Array.from(new TextEncoder().encode(str)), l=b.length*8; b.push(0x80); while(b.length%64!==56) b.push(0); for(let i=7;i>=0;i--) b.push(Math.floor(l/Math.pow(2,i*8))&255);
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const r=(x,n)=>(x>>>n)|(x<<(32-n)), w=new Array(64);
  for(let o=0;o<b.length;o+=64){ for(let i=0;i<16;i++) w[i]=(b[o+i*4]<<24)|(b[o+i*4+1]<<16)|(b[o+i*4+2]<<8)|b[o+i*4+3];
    for(let i=16;i<64;i++){ const s0=r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3), s1=r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10); w[i]=(w[i-16]+s0+w[i-7]+s1)|0; }
    let [a,bb,c,d,e,f,g,hh]=h; for(let i=0;i<64;i++){ const S1=r(e,6)^r(e,11)^r(e,25), ch=(e&f)^(~e&g), t1=(hh+S1+ch+K[i]+w[i])|0, S0=r(a,2)^r(a,13)^r(a,22), mj=(a&bb)^(a&c)^(bb&c), t2=(S0+mj)|0; hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=bb; bb=a; a=(t1+t2)|0; }
    h=h.map((v,i)=>(v+[a,bb,c,d,e,f,g,hh][i])|0); }
  return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join(''); }
function adNameOK(){ return ((localStorage.getItem('bigrig.name')||'').trim().toLowerCase())==='sonjames'; }
function adOn(){ return !!career.admin&&adNameOK(); }
// ---- PIN popup: keypad (tap / Xbox d-pad + A) + a real input for the keyboard
function adAsk(){ if(AD.asked||career.admin||!adNameOK()||career.uiOpen) return; AD.asked=true; AD.pin='';
  const b=openModal('admpin',`<div class="adp"><h2>\u{1F512} Admin PIN</h2><div class="sub">Enter the 4-digit PIN, or skip to play normally</div>
   <input id="adIn" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="\u2022\u2022\u2022\u2022">
   <div class="adk">${[1,2,3,4,5,6,7,8,9,'\u232B',0,'OK'].map(k=>`<button class="btn adb${k==='OK'?' g sel':''}" data-k="${k}">${k}</button>`).join('')}</div>
   <button class="btn adskip" id="adSkip">Skip \u2022 play normally</button><div class="admsg" id="adMsg"></div></div>`,'adpin');
  if(!document.getElementById('adcss')){ const s=document.createElement('style'); s.id='adcss'; s.textContent=`#ui .modal.adpin{width:min(360px,94vw)!important;padding:18px!important;text-align:center}.adp h2{margin:0 0 4px}.adp .sub{font-size:12px;opacity:.7;margin-bottom:12px}
   .adp input{width:100%;box-sizing:border-box;font-size:30px;letter-spacing:14px;text-align:center;padding:10px;border-radius:12px;border:2px solid rgba(255,255,255,.15);background:#0d1320;color:#fff;margin-bottom:12px}
   .adp .adk{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.adp .adb{min-height:58px;font-size:24px;font-weight:900;border-radius:14px}.adp .adskip{width:100%;margin-top:10px;min-height:44px}.adp .admsg{min-height:18px;margin-top:8px;font-weight:800;color:#ff7b72}
   #adBadge{position:absolute;left:50%;top:6px;transform:translateX(-50%);z-index:30;display:flex;gap:6px;align-items:center;background:linear-gradient(90deg,#b30000,#ff3b3b);color:#fff;font:900 12px Arial;letter-spacing:2px;padding:5px 6px 5px 12px;border-radius:99px;box-shadow:0 2px 10px rgba(0,0,0,.4)}
   #adBadge button{background:rgba(0,0,0,.35);color:#fff;border:0;border-radius:99px;font:900 12px Arial;padding:5px 10px;cursor:pointer}
   #ui .modal.adpan{width:min(420px,96vw)!important;padding:16px!important}.adpan .row{display:flex;gap:8px;margin:8px 0}.adpan .row input{flex:1;min-width:0;font-size:18px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#0d1320;color:#fff}.adpan .btn{min-height:48px}.adpan .full{width:100%;margin:5px 0}`; document.head.appendChild(s); }
  const inp=b.querySelector('#adIn'), msg=b.querySelector('#adMsg'); const sync=()=>{ inp.value=AD.pin; };
  b.querySelectorAll('.adb').forEach(el=>el.addEventListener('click',()=>{ const k=el.dataset.k; if(k==='OK') adTry(); else if(k==='\u232B'){ AD.pin=AD.pin.slice(0,-1); sync(); } else if(AD.pin.length<4){ AD.pin+=k; sync(); if(AD.pin.length===4) setTimeout(adTry,120); } }));
  inp.addEventListener('input',()=>{ AD.pin=inp.value.replace(/\D/g,'').slice(0,4); sync(); }); inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') adTry(); });
  b.querySelector('#adSkip').addEventListener('click',()=>{ closeUI(); });
  if(!document.body.classList.contains('touch')) setTimeout(()=>inp.focus(),60); }
function adTry(){ const msg=document.getElementById('adMsg'); if(career.uiOpen!=='admpin') return; if(adSha(AD.pin)===AD.H){ AD.pin=''; career.admin=true; closeUI(); adApply(true); toast('\u{1F6E0}\uFE0F Admin mode on'); if(typeof saveGame==='function') saveGame(); }
  else { AD.pin=''; const i=document.getElementById('adIn'); if(i) i.value=''; if(msg) msg.textContent='Wrong PIN \u2022 playing normally'; setTimeout(()=>{ if(career.uiOpen==='admpin') closeUI(); },900); } }
// ---- effects
function adMaxTier(){ if(typeof ownYards!=='function') return; for(const yd of ownYards()){ const o=ownedYard(yd); if(o&&o.tier<OWN_MAX){ o.tier=OWN_MAX; ownApplyTier(yd); } } }
function adApply(first){ if(!adOn()) return; if(first||truck.money<999000000) truck.money=999000000; const need=levelNeed(60); if(career.xp<need){ career.xp=need; career.tier=tierOf(career.xp); } adMaxTier(); adBadge(); }
function adBadge(){ let e=document.getElementById('adBadge'); if(!adOn()){ if(e) e.remove(); return; } if(e) return; if(typeof uiInit==='function') uiInit(); e=document.createElement('div'); e.id='adBadge'; e.innerHTML='ADMIN <button id="adPanBtn">\u2699 PANEL</button>'; (document.getElementById('frame')||document.body).appendChild(e);
  e.querySelector('#adPanBtn').addEventListener('click',ev=>{ ev.stopPropagation(); adPanel(); }); e.addEventListener('pointerdown',ev=>ev.stopPropagation()); }
function adPanel(){ if(!adOn()||career.uiOpen) return; const b=openModal('adpanel',`<div class="mh"><div class="mht"><h2>\u{1F6E0}\uFE0F Admin panel</h2><div class="sub">Local to this save only</div></div><div class="sp"></div><button class="x" aria-label="Close">\u2715</button></div>
   <div class="row"><input id="adMoney" type="number" inputmode="numeric" value="${Math.round(truck.money)}"><button class="btn g" id="adSetM">Set money</button></div>
   <button class="btn full" id="adTrucks">\u{1F69B} Unlock all trucks (free)</button><button class="btn full" id="adTier">\u{1F3ED} Max tier on my yards (T3)</button>
   <button class="btn full" id="adTp">\u{1F5FA}\uFE0F Teleport: tap a spot on the map</button><button class="btn full" id="adTime">\u{1F317} Toggle day / night</button><div class="admsg" id="adPm" style="color:#7dff9a"></div>`,'adpan');
  const say=t=>{ b.querySelector('#adPm').textContent=t; };
  b.querySelector('#adMoney').addEventListener('keydown',e=>e.stopPropagation());
  b.querySelector('#adSetM').addEventListener('click',()=>{ const v=Math.max(0,Math.min(2e9,+b.querySelector('#adMoney').value||0)); truck.money=v; AD.noTop=v<999000000; say('Money set to '+money(v)); saveGame(); });
  b.querySelector('#adTrucks').addEventListener('click',()=>{ career.owned=TRUCK_MODELS.map(m=>m.id); say('All '+TRUCK_MODELS.length+' trucks unlocked'); saveGame(); });
  b.querySelector('#adTier').addEventListener('click',()=>{ adMaxTier(); const n=ownYards().filter(y=>ownedYard(y)).length; say(n?n+' yard(s) at T3':'You don\u2019t own a yard yet'); saveGame(); });
  b.querySelector('#adTp').addEventListener('click',()=>{ AD.tp=true; closeUI(); openMap(); toast('Tap anywhere on the map to teleport'); });
  b.querySelector('#adTime').addEventListener('click',()=>{ gameT=(gameT>=7&&gameT<19)?22:12; say('Time set to '+(gameT===12?'midday':'night')); }); }
// teleport: next tap on the open map
function adTeleport(tx,ty){ let mx=tx*M_T, my=ty*M_T; if(!posOK(mx,my)){ let best=null; for(let r=4;r<=80&&!best;r+=4) for(let k=0;k<16;k++){ const a=k/16*Math.PI*2, x=mx+Math.cos(a)*r, y=my+Math.sin(a)*r; if(posOK(x,y)){ best=[x,y]; break; } } if(!best){ toast('Can\u2019t park there \u2022 pick a road or open ground'); return false; } [mx,my]=best; } const dx=mx-truck.x, dy=my-truck.y; truck.x=mx; truck.y=my; truck.v=0; if(truck.trl){ truck.trl.x+=dx; truck.trl.y+=dy; } cam.x=mx*PPM; cam.y=my*PPM; AD.tp=false; closeMap(); toast('\u{1F4CD} Teleported'); return true; }
setTimeout(()=>{
cv.addEventListener('pointerdown',e=>{ if(!AD.tp||!bigmap.open||!adOn()) return; const [x,y]=canvasPos(e); if(y<40||x>VW-70) return; e.stopImmediatePropagation(); adTeleport(bigmap.cx+(x-VW/2)/bigmap.z,bigmap.cy+(y-VH/2-10)/bigmap.z); },true);
// hooks: ask on start, keep money topped up, badge
{ const sg0=startGame; startGame=function(){ const was=started; sg0(); if(!was&&started) setTimeout(()=>{ if(adOn()) adApply(false); else adAsk(); },700); }; }
setInterval(()=>{ if(!started) return; if(adOn()){ if(!AD.noTop&&truck.money<999000000) truck.money=999000000; adBadge(); } else adBadge(); },1500);
},0);
