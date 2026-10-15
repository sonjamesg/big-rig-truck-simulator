'use strict';
// ===================== v28 POLICE AI: patrols from police stations, line-of-sight detection, chase, fines + arrest =====================
// Patrol cars are ordinary traffic vehicles (v.role='police') so they keep UK lane discipline + signals; a chasing car leaves the traffic
// sim and is driven kinematically behind the player. Local per client (MP fine). Uses SVC (services.js) and OFF (roadlaw.js).
const POL_FINES={speeding:100,redlight:100,pedestrian:500};
const POL={cars:[],chase:null,spawnT:6+Math.random()*14,want:2,stopT:0,pend:[],arrest:false,lostT:0,inJ:null,prev:null,seen:new Set(),fade:0,log:[]};
// ---------- shared emergency-vehicle art / audio / helpers (also used by ambulance.js)
const EMV={arts:{}};
function emArt(type){ if(EMV.arts[type]) return EMV.arts[type];
  const kind=type==='police'?'estate':'van', t=VTYPES[kind], base=type==='police'?makeCarArt('estate','#f4f4f4'):makeVanArt('#f7f7f2',''), c=mkCanvas(base.width,base.height), g=c.getContext('2d'); g.drawImage(base,0,0);
  const cx=c.width/2, y0=0.15*VS, X=m=>cx+m*VS, Y=m=>y0+m*VS, W=t.W, L=t.L, A=type==='police'?['#1d4fbf','#f2e600']:['#2e9e3e','#f2e600'];
  // battenburg checks along both flanks
  const n=Math.round(L/0.55); for(let k=1;k<n-1;k++) for(const s of [-1,1]){ g.fillStyle=A[(k+(s>0?1:0))%2]; g.fillRect(s<0?X(-W/2+0.05):X(W/2-0.33),Y(k*L/n),0.28*VS,L/n*VS+0.5); }
  if(type==='ambulance'){ g.fillStyle='#2e9e3e'; g.fillRect(X(-W/2+0.4),Y(L*0.62),(W-0.8)*VS,0.22*VS); g.save(); g.translate(X(0),Y(L*0.75)); g.rotate(Math.PI); g.fillStyle='#2e9e3e'; g.font='bold '+Math.round(0.42*VS)+'px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('AMBULANCE',0,0); g.restore(); }
  else { g.fillStyle='#1d4fbf'; g.font='bold '+Math.round(0.45*VS)+'px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.save(); g.translate(X(0),Y(L*0.72)); g.rotate(Math.PI); g.fillText('POLICE',0,0); g.restore(); }
  // light bar (unlit)
  const by=type==='police'?L*0.42:0.95; g.fillStyle='#222'; g.fillRect(X(-W/2+0.3),Y(by),(W-0.6)*VS,0.3*VS); g.fillStyle='#3a58a8'; g.fillRect(X(-W/2+0.35),Y(by)+2,(W/2-0.4)*VS,0.3*VS-4); g.fillRect(X(0.05),Y(by)+2,(W/2-0.4)*VS,0.3*VS-4);
  const a={body:{c,sh:shadowOf(c)},L,W,kind,bar:L/2-by-0.15}; return EMV.arts[type]=a; }
function emDrawBar(v,on,type){ const a=emArt(type), f=fwd(v.h), r=rgt(v.h), off=a.bar, cx=v.x+f[0]*off, cy=v.y+f[1]*off; if(!on) return;
  const ph=(timeS*4)%1<0.5; for(const s of [-1,1]){ const lit=(s<0)===ph; if(!lit) continue; const x=cx+r[0]*s*a.W*0.25, y=cy+r[1]*s*a.W*0.25;
    ctx.fillStyle='rgba(120,170,255,0.95)'; ctx.beginPath(); ctx.arc(x*PPM,y*PPM,4.5,0,7); ctx.fill(); ctx.fillStyle='rgba(80,140,255,0.25)'; ctx.beginPath(); ctx.arc(x*PPM,y*PPM,16,0,7); ctx.fill();
    if(typeof dnLight==='function') dnLight(x*PPM,y*PPM,90,'rgba(60,120,255,1)',0.9); } }
function emBlit(v,type){ const a=emArt(type); blitV(a.body.sh,v.x,v.y,v.h,a.L,a.W,4,4); blitV(a.body.c,v.x,v.y,v.h,a.L,a.W,0,0); }
function emSiren(){ try{ const c=audio.ctx; if(!c||!audio.master) return null; const o=c.createOscillator(), l=c.createOscillator(), lg=c.createGain(), g=c.createGain(), f=c.createBiquadFilter();
    o.type='sawtooth'; o.frequency.value=810; l.type='square'; l.frequency.value=0.85; lg.gain.value=120; l.connect(lg); lg.connect(o.frequency); f.type='lowpass'; f.frequency.value=2200; o.connect(f); f.connect(g); g.gain.value=0; g.connect(audio.master); o.start(); l.start();
    return {g,stop(){ try{ g.gain.setTargetAtTime(0,c.currentTime,0.05); setTimeout(()=>{ try{ o.stop(); l.stop(); g.disconnect(); }catch(e){} },400); }catch(e){} }, set(v){ try{ g.gain.setTargetAtTime(v,c.currentTime,0.08); }catch(e){} }}; }catch(e){ return null; } }
function emSirenVol(x,y){ const d=Math.hypot(x-truck.x,y-truck.y); return 0.16*Math.max(0,1-d/260); }
// road point just outside a services site's driveway
function emRoadPt(s){ return {x:s.entrance.x,y:s.entrance.y-M_T*0.8}; }
// move a kinematic vehicle along a polyline (metres); returns true when done
function emFollow(v,dt,sp){ const P=v.path; if(!P||!P.length) return true; const q=P[0], dx=q[0]-v.x, dy=q[1]-v.y, d=Math.hypot(dx,dy); if(d<0.4){ P.shift(); return !P.length; }
  const st=Math.min(d,(sp||5)*dt); v.x+=dx/d*st; v.y+=dy/d*st; if(d>0.6){ const th=Math.atan2(dx,-dy); v.h+=wrapA((v.rev?th+Math.PI:th)-v.h)*Math.min(1,dt*5); } return false; }
// put a kinematic vehicle back into traffic as a normal AI car (keeps its role/art); null if no room
function emToTraffic(x,y,role){ const s=navSnap(x/M_T,y/M_T,10); if(!s) return null; for(const [ox,oy] of [[0,0],[2,0],[-2,0],[0,2],[0,-2],[4,0],[-4,0],[0,4],[0,-4]]){
    const v=spawnVehicle((s[0]+ox+0.5)*M_T,(s[1]+oy+0.5)*M_T,true,{kind:role==='police'?'estate':'van'}); if(v){ v.role=role; v.art=emArt(role).body; v.art={body:emArt(role).body}; return v; } } return null; }
const onView=(x,y)=>typeof onScreen==='function'&&onScreen(x,y,-2);
// ---------- patrols
function polStations(){ return typeof SVC!=='undefined'?SVC.byType.police:[]; }
function polMake(v,st){ v.role='police'; v.art={body:emArt('police').body}; v.pol={st,end:timeS+90+Math.random()*480,home:false}; POL.cars.push(v); return v; }
// GTA2-style: patrols appear on roads just out of view (1-1.5 screens), biased ahead of the truck
function polViewR(){ const v=viewRectM(); return Math.max(v[2]-v[0],v[3]-v[1])/2; }
function polSpawn(){ const P=truck, R=polViewR(), f=fwd(P.h), mv=Math.abs(P.v)>3;
  for(let t=0;t<40;t++){ let a=Math.random()*6.283; if(mv&&Math.random()<0.7) a=Math.atan2(f[1],f[0])+(Math.random()-0.5)*1.8;
    const d=R*(1+Math.random()*0.5)+15, x=P.x+Math.cos(a)*d, y=P.y+Math.sin(a)*d; const tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(!inb(tx,ty)) continue; const i=idx(tx,ty);
    if(world.roadH[i]<0&&world.roadV[i]<0||onScreen(x,y,12)) continue; if(POL.cars.length>=6) return null; const v=spawnVehicle(x,y,true,{kind:'estate'}); if(v&&onScreen(v.x,v.y,10)){ const k=traffic.vs.indexOf(v); if(k>=0) traffic.vs.splice(k,1); continue; } if(v){ let st=null,bd=1e18; for(const s of polStations()){ const q=(s.x-x)**2+(s.y-y)**2; if(q<bd){ bd=q; st=s; } } POL.spawns=(POL.spawns||0)+1; return polMake(v,st); } }
  return null; }
function polUpdatePatrols(dt){ POL.cars=POL.cars.filter(v=>traffic.vs.includes(v)||v===(POL.chase&&POL.chase.v));
  const R=polViewR(); for(const v of POL.cars.slice()){ if(v===(POL.chase&&POL.chase.v)) continue; if(Math.hypot(v.x-truck.x,v.y-truck.y)>R*2.6+60&&!onScreen(v.x,v.y,20)){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } POL.cars.splice(POL.cars.indexOf(v),1); } }
  POL.spawnT-=dt*(Math.abs(truck.v)>2?1:0.3); if(POL.spawnT<=0){ POL.spawnT=Math.random()<0.25?6+Math.random()*10:15+Math.random()*Math.random()*70; POL.want=1+((Math.random()*3)|0); const n=POL.cars.filter(v=>Math.hypot(v.x-truck.x,v.y-truck.y)<R*2.6+60).length; if(n<POL.want) polSpawn(); }
  for(const v of POL.cars){ const p=v.pol; if(!p||v===(POL.chase&&POL.chase.v)) continue;
    if(!p.home&&timeS>p.end&&p.st&&typeof aiGoal==='function'){ p.home=true; const e=emRoadPt(p.st); aiGoal(v,{entrance:e,name:p.st.name}); v.pinT=0; }
    if(p.home&&p.st){ const e=emRoadPt(p.st); if(Math.hypot(v.x-e.x,v.y-e.y)<14){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); }
        const s=p.st; POL.parkIn=POL.parkIn||[]; POL.parkIn.push({x:v.x,y:v.y,h:v.h,path:[[e.x,s.entrance.y+2],[s.entrance.x,s.rect.y0+M_T*1.5]],t:0}); } } }
  if(POL.parkIn) POL.parkIn=POL.parkIn.filter(k=>!emFollow(k,dt,4)); }
// ---------- detection
function polSees(v){ return onView(v.x,v.y)&&onView(truck.x,truck.y); }
function polCanSee(){ return POL.cars.filter(v=>v.pol&&polSees(v)); }
function polOffence(type,v,reason){ const c=POL.chase; if(c&&c.offs.some(o=>o.type===type)) return; if(!c){ polStartChase(v); } const ch=POL.chase; if(!ch) return;
  const amt=(typeof OFF!=='undefined'&&OFF.FINES&&OFF.FINES[type])||POL_FINES[type]; ch.offs.push({type,amount:amt,reason}); if(type==='pedestrian') ch.arrest=true; POL.log.push({type,t:timeS});
  if(typeof toast==='function') toast('\u{1F6A8} Police: '+reason); }
function polStartChase(v){ if(!v) return; const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); }
  POL.chase={v,offs:[],arrest:false,t:0,siren:emSiren(),sp:Math.abs(v.v||8)}; POL.stopT=0; POL.lostT=0; }
function polEndChase(back){ const c=POL.chase; if(!c) return; if(c.siren) c.siren.stop(); POL.chase=null; POL.stopT=0;
  if(back){ const nv=emToTraffic(c.v.x,c.v.y,'police'); if(nv){ polMake(nv,c.v.pol&&c.v.pol.st); nv.pol.end=timeS+60+Math.random()*300; } } }
function polDetect(dt){ if(POL.chase&&POL.chase.paying) return; const P=truck, mph=Math.abs(P.v)*(typeof MPH!=='undefined'?MPH:2.237), lim=(typeof SPL!=='undefined'&&SPL.cur)||30;
  // speeding past a police car
  if(mph>lim*1.1+2) for(const v of polCanSee()){ if(Math.hypot(v.x-P.x,v.y-P.y)<40){ polOffence('speeding',v,Math.round(mph)+' mph in a '+lim+' zone'); break; } }
  // red light: player enters a signal-controlled junction box on a red
  const tx=P.x/M_T, ty=P.y/M_T; let J=null; for(const j of world.junctions||[]) if(j.lights&&tx>=j.x&&tx<j.x+j.w&&ty>=j.y&&ty<j.y+j.h){ J=j; break; }
  if(J&&J!==POL.inJ&&POL.prev&&typeof sigState==='function'){ const sg=slSegAt(POL.prev[0],POL.prev[1]); if(sg&&sg.js&&sg.js.includes(J)){ const dd=sg.dir==='h'?Math.sign(P.x-POL.prev[0]):Math.sign(P.y-POL.prev[1]);
      if(dd){ const key=sg.id+':'+dd, red=['S','L','R'].every(m=>sigState(J,key,m)==='r'); if(red&&Math.abs(P.v)>2){ POL.redRuns=(POL.redRuns||0)+1; const w=polCanSee()[0]; if(w) polOffence('redlight',w,'ran a red light'); } } } }
  POL.inJ=J; if(!J) POL.prev=[P.x,P.y]; }
function polPedHit(p){ const w=polCanSee()[0]; if(w||(POL.chase&&polSees(POL.chase.v))) polOffence('pedestrian',w||POL.chase.v,'hit a pedestrian'); else if(!POL.chase){ WANT.lvl=1; WANT.t=60; WANT.sp=1; } }
// ---------- v29 wanted level: unseen ped hit -> 1 star, 60 s; searchers roam near (not on) the player; spotted -> chase -> fine/arrest
const WANT={lvl:0,t:0,sp:0,chased:false};
function wantSearchGoal(v){ const a=Math.random()*6.283, d=30+Math.random()*120; if(typeof aiGoal==='function') aiGoal(v,{entrance:{x:truck.x+Math.cos(a)*d,y:truck.y+Math.sin(a)*d},name:'search'}); v.pol.sg=timeS+12+Math.random()*10; }
function wantUpdate(dt){ if(!WANT.lvl) return;
  if(POL.chase){ WANT.chased=true; WANT.t=60; return; }
  if(WANT.chased){ wantClear(); return; }               // chase over (fined/arrested or lost): wanted level ends
  const w=polCanSee()[0]; if(w){ polOffence('pedestrian',w,'hit a pedestrian'); return; }
  WANT.t-=dt; if(WANT.t<=0){ wantClear(); return; }
  WANT.sp-=dt; const n=POL.cars.filter(v=>v.pol&&v.pol.search).length; if(WANT.sp<=0){ WANT.sp=5+Math.random()*7; if(n<4){ const v=polSpawn(); if(v){ v.pol.search=true; v.pinT=timeS+1e6; wantSearchGoal(v); } } }
  for(const v of POL.cars) if(v.pol&&v.pol.search&&timeS>v.pol.sg&&traffic.vs.includes(v)) wantSearchGoal(v); }
function wantClear(){ WANT.lvl=0; WANT.chased=false; for(const v of POL.cars) if(v.pol&&v.pol.search){ v.pol.search=false; v.pinT=0; v.pol.end=timeS; v.pol.home=false; } }
function drawWantedHUD(){ if(!WANT.lvl) return; const x=VW-34, y=VH*0.13+70, fl=POL.chase||WANT.t>10||(timeS*4)%1<0.6;
  ctx.save(); ctx.translate(x,y); ctx.beginPath(); for(let i=0;i<10;i++){ const r=i%2?7:17, a=i*Math.PI/5-Math.PI/2; ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); } ctx.closePath();
  ctx.fillStyle=fl?'#ffd21e':'rgba(255,210,30,0.35)'; ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.stroke(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.font='bold 13px system-ui,sans-serif'; ctx.textAlign='center'; const tx=POL.chase?'CHASE':'WANTED '+Math.ceil(WANT.t)+'s'; ctx.strokeText(tx,0,32); ctx.fillText(tx,0,32); ctx.restore(); }
function polMapDots(px,py){ const ph=(timeS*4)%1<0.5, L=POL.cars.filter(v=>v.pol&&(v.pol.search||WANT.lvl)&&traffic.vs.includes(v)).map(v=>v); if(POL.chase) L.push(POL.chase.v);
  for(const v of L){ const X=px(v.x),Y=py(v.y); ctx.fillStyle=ph?'#ff2030':'#2a5bff'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(X,Y,4.5,0,7); ctx.fill(); ctx.stroke(); } }
// ---------- chase
function polUpdateChase(dt){ const c=POL.chase; if(!c) return; const v=c.v, P=truck; c.t+=dt;
  const back=P.trl?20:9, f=fwd(P.trl?P.th:P.h), tx=(P.trl?P.trl.x:P.x)-f[0]*back, ty=(P.trl?P.trl.y:P.y)-f[1]*back, dx=tx-v.x, dy=ty-v.y, d=Math.hypot(dx,dy), dP=Math.hypot(P.x-v.x,P.y-v.y);
  const want=d>25?Math.max(Math.abs(P.v)+7,16):d>6?Math.abs(P.v)+d*0.25:Math.abs(P.v)*0.6; c.sp+=Math.max(-9*dt,Math.min(5*dt,Math.min(48,want)-c.sp)); if(dP<7) c.sp=Math.min(c.sp,1);
  if(d>1.5){ const th=Math.atan2(dx,-dy); v.h+=Math.max(-2.6*dt,Math.min(2.6*dt,wrapA(th-v.h))); } const fv=fwd(v.h); v.x+=fv[0]*c.sp*dt; v.y+=fv[1]*c.sp*dt; v.v=c.sp;
  if(c.siren) c.siren.set(emSirenVol(v.x,v.y));
  if(dP>500||!onView(v.x,v.y)&&dP>200){ POL.lostT+=dt; if(POL.lostT>25){ toast('\u{1F694} You lost the police'); polEndChase(true); return; } } else POL.lostT=0;
  if(Math.abs(P.v)<0.3&&dP<32&&!c.paying){ POL.stopT+=dt; if(POL.stopT>5) polFinePopup(); } else if(!c.paying) POL.stopT=0; }
function polFinePopup(){ const c=POL.chase; if(!c||c.paying) return; c.paying=true; P_input_clear(); const tot0=c.offs.reduce((a,o)=>a+o.amount,0), tot=Math.min(tot0,Math.max(0,Math.floor(truck.money||0)));
  const rows=c.offs.map(o=>`<div style="display:flex;justify-content:space-between;gap:18px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.12)"><span>${esc(o.reason)}${o.type==='pedestrian'?' <b style="color:#ff6b6b">\u2022 ARREST</b>':''}</span><b>${money(o.amount)}</b></div>`).join('');
  const b=openModal('police',`<h2 style="margin:0 0 6px">\u{1F694} Police \u2014 Fixed Penalty</h2><p style="opacity:.8;margin:0 0 10px">You were pulled over. Offences:</p>${rows}
    <div style="display:flex;justify-content:space-between;margin:10px 0 14px;font-size:1.15em"><span>Total</span><b>${money(tot0)}</b></div>${tot<tot0?`<p style="color:#ffd27a;margin:0 0 10px">You only have ${money(tot)} — the officer takes what you have (no debt).</p>`:''}${c.arrest?'<p style="color:#ff8a8a;margin:0 0 10px">Hitting a pedestrian is a serious offence: you will be <b>arrested</b> and taken to the nearest police station.</p>':''}
    <button class="btn go" id="polPay" style="width:100%;font-size:1.1em;padding:12px">PAY ${money(tot)}${c.arrest?' & GO WITH OFFICER':''} <kbd>${typeof pad!=='undefined'&&pad.active?'\u24B6':'Enter'}</kbd></button>`,'polfine');
  if(!document.getElementById('polCss')){ const st=document.createElement('style'); st.id='polCss'; st.textContent='body #ui .mback .modal.polfine{width:min(420px,92vw)!important;height:auto!important;max-height:88dvh!important;border-radius:16px!important;border:1px solid rgba(255,255,255,.12)!important;padding:16px 18px!important;margin:auto!important;overflow:auto;box-sizing:border-box;font-size:15px} body #ui .mback .modal.polfine h2{font-size:20px} @media (orientation:landscape) and (max-height:500px){ body #ui .mback .modal.polfine{max-height:92dvh!important;padding:10px 14px!important;font-size:13px} body #ui .mback .modal.polfine h2{font-size:17px} }'; document.head.appendChild(st); }
  b.addEventListener('pointerdown',e=>e.stopPropagation(),true); const btn=b.querySelector('#polPay'); btn.addEventListener('click',()=>polPay()); }
function P_input_clear(){ if(typeof input!=='undefined') for(const k in input) input[k]=false; }
function polPay(){ const c=POL.chase; if(!c) return; let left=Math.max(0,Math.floor(truck.money||0)); for(const o of c.offs){ const amt=Math.min(o.amount,left); left-=amt; if(typeof OFF!=='undefined') OFF.add({type:o.type,amount:amt,reason:o.reason,police:true}); else truck.money-=amt; }
  closeUI(); const arrest=c.arrest; if(arrest){ polArrest(); polEndChase(false); } else { toast('\u2714 Fine paid \u2014 drive safely'); polEndChase(true); } }
function polArrest(){ let st=null,bd=1e18; for(const s of polStations()){ const q=(s.x-truck.x)**2+(s.y-truck.y)**2; if(q<bd){ bd=q; st=s; } }
  const ov=document.createElement('div'); ov.id='polArrest'; ov.style.cssText='position:fixed;inset:0;z-index:90;background:#000;opacity:0;transition:opacity .9s;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 18px system-ui;text-align:center;pointer-events:none';
  ov.innerHTML=`<div style="font-size:44px;color:#ff4d4d;letter-spacing:3px">ARRESTED</div><div style="margin-top:10px;opacity:.85">Taken to ${esc(st?st.name:'the police station')}</div><div style="margin-top:6px;opacity:.6;font-weight:500">Your truck${truck.trl?' and trailer':''} will be in the station car park.</div>`;
  document.body.appendChild(ov); POL.arrested=(POL.arrested||0)+1; requestAnimationFrame(()=>ov.style.opacity='1');
  setTimeout(()=>{ if(st) polPark(st); },1100); setTimeout(()=>{ ov.style.opacity='0'; setTimeout(()=>ov.remove(),1000); },3400); }
function polPark(st){ const pk=st.parts.park, x=(pk.x+pk.w/2)*M_T, y=(pk.y+2.2)*M_T; truck.h=0; truck.th=0; truck.x=x; truck.y=y; truck.v=0; if(truck.vx!==undefined){ truck.vx=0; truck.vy=0; }
  if(truck.trl){ const tr=truck.trl; tr.th=0; const k=kingpin(truck); tr.x=k[0]; tr.y=k[1]; tr.v=0; } if(typeof cam!=='undefined'){ cam.x=truck.x*PPM; cam.y=truck.y*PPM; }
  if(typeof NAV!=='undefined'&&NAV.route&&NAV.route.target&&typeof setRoute==='function'){ const t=NAV.route.target; try{ setRoute(t.ref||{x:t.x,y:t.y,name:t.name}); }catch(e){} } }
addEventListener('keydown',e=>{ if(typeof career!=='undefined'&&career.uiOpen==='police'&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); const b=document.getElementById('polPay'); if(b) b.click(); } });
// ---------- parked cars in station bays (static decoration, cheap)
function polDrawParked(vx0,vy0,vx1,vy1){ for(const s of polStations()){ if(s.rect.x1*PPM<vx0||s.rect.x0*PPM>vx1||s.rect.y1*PPM<vy0||s.rect.y0*PPM>vy1) continue;
    s.bays.forEach((b,i)=>{ if((i*7+s.tx)%3) return; emBlit({x:b.x,y:b.y,h:b.h},'police'); }); } }

// ---------- v29 blue-light yield: traffic ahead (both directions) slows, pulls to its kerb and stops; the emergency vehicle takes the centre
const EMY={src:[],n:0};
function emSources(){ const out=[]; const c=POL.chase; if(c&&!c.paying) out.push(c.v); if(typeof AMBU!=='undefined') for(const j of AMBU.jobs){ if(j.st==='go'&&j.v) out.push(j.v); else if(j.st==='pull'&&j.k) out.push(j.k); } return out; }
function emInJ(v){ const tx=v.x/M_T, ty=v.y/M_T; for(const J of world.junctions||[]) if(tx>J.x-1&&tx<J.x+J.w+1&&ty>J.y-1&&ty<J.y+J.h+1) return true; return false; }
function emYield(v,acc,dt){ if(v.role==='police'||v.role==='ambulance'){ v.emResp=!!(v.amb&&v.amb.st==='go'); if(v.emResp){ v.ghostT=Math.max(v.ghostT||0,0.3); emShift(v,1.3,dt); } return acc; }
  let y=false; for(const E of EMY.src){ const f=fwd(E.h), dx=v.x-E.x, dy=v.y-E.y, al=dx*f[0]+dy*f[1], lat=Math.abs(dx*f[1]-dy*f[0]), par=Math.abs(Math.cos((v.h||0)-(E.h||0))); if(par>0.7&&al>-4&&al<110&&lat<14){ y=true; break; } }
  if(y&&(emInJ(v)||v.ring!=null||v.jHeld)) y=false;   // never stop inside a junction box (no deadlocks): clear it first
  if(y){ v.emY=timeS; EMY.n++; emShift(v,-1.4,dt); return Math.min(acc,-Math.max(1.5,v.v*1.2)); }
  if(v.emO) emShift(v,0,dt); return acc; }
// lateral shift relative to heading (+ = right / centre line, - = left / kerb), eased; tracked separately from crash offsets
function emShift(v,to,dt){ const cur=v.emO||0, nw=cur+(to-cur)*Math.min(1,dt*1.6), d=nw-cur, r=rgt(v.h||0); v.offX+=r[0]*d; v.offY+=r[1]*d; v.emO=Math.abs(nw)<0.02&&to===0?0:nw; if(v.emO===0){ v.offX-=r[0]*nw; v.offY-=r[1]*nw; } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ EMY.src=emSources(); return ub.apply(this,arguments); }; },0);
// ---------- per-frame + drawing
function updatePolice(dt){ if(!world.ready||typeof started!=='undefined'&&!started||(typeof uiBlocking==='function'&&uiBlocking())) return; polUpdatePatrols(dt); polUpdateChase(dt); polDetect(dt); wantUpdate(dt); }
function drawPolice(vx0,vy0,vx1,vy1){ polDrawParked(vx0,vy0,vx1,vy1); for(const v of POL.cars) if(v.pol&&traffic.vs.includes(v)) emDrawBar(v,false,'police');
  if(POL.parkIn) for(const k of POL.parkIn) emBlit(k,'police'); const c=POL.chase; if(c){ emBlit(c.v,'police'); emDrawBar(c.v,true,'police'); } }
function drawPoliceHUD(){ const c=POL.chase; if(!c||c.paying) return; const w=Math.min(VW-30,360), x=VW/2-w/2, y=VH*0.13, ph=(timeS*3)%1<0.5;
  ctx.save(); ctx.fillStyle=ph?'rgba(200,20,30,0.88)':'rgba(25,60,200,0.88)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,52,12):ctx.rect(x,y,w,52); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='900 19px system-ui,sans-serif'; ctx.fillText('\u{1F6A8} POLICE \u2014 PULL OVER',VW/2,y+23);
  ctx.font='12px system-ui,sans-serif'; ctx.fillText(POL.stopT>0?'Stay stopped\u2026 '+Math.max(0,5-POL.stopT).toFixed(1)+' s':'Stop the truck and wait for the officer',VW/2,y+42); ctx.restore(); }
setTimeout(()=>{
  const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ updatePolice(dt); }catch(e){ console.warn('[police]',e); } };
  const dt0=drawTraffic; drawTraffic=function(vx0,vy0,vx1,vy1){ const r=dt0.apply(this,arguments); try{ drawPolice(vx0,vy0,vx1,vy1); if(typeof drawAmbulance==='function') drawAmbulance(vx0,vy0,vx1,vy1); }catch(e){ console.warn('[police draw]',e); } return r; };
  const dh=drawHUD; drawHUD=function(){ dh.apply(this,arguments); if(!(typeof bigmap!=='undefined'&&bigmap.open)) { drawPoliceHUD(); drawWantedHUD(); } };
  if(typeof svcMapIcons==='function'){ const sm=svcMapIcons; svcMapIcons=function(icon,px,py){ sm.apply(this,arguments); try{ polMapDots(px,py); }catch(e){} }; }
  if(typeof BigRig!=='undefined'){ BigRig.police=()=>({cars:POL.cars.length,chase:!!POL.chase,offences:POL.chase?POL.chase.offs.map(o=>o.type):[]}); }
},0);
