'use strict';
// ===================== v18 living container ports (Albion + Kingsbridge) =====================
// Each port works in a local frame: u = metres-in-tiles from the quay edge towards the water, v = along the quay.
// Ships berth, ship-to-shore gantry cranes lift boxes onto the yard stock, a loader puts boxes on skeletal trailers in the
// terminal bays, AI cabs come in, couple and haul them out on the road network; the player can take one as a side job.
const PORTSIM={t:0,ai:[]};
function portList(){ const L=[]; if(world.port) L.push(world.port); if(world.kbPort) L.push(world.kbPort); return L; }
function portInit(P){ if(P.ready) return; P.ready=1; P.landed=0;
  if(!P.O){ P.O=[P.edge,0]; P.U=[1,0]; P.V=[0,1]; P.vIn=150; P.vOut=470; P.dep='APT'; P.legL=P.quayX-P.edge-1; P.asg=[0,1,1,2]; P.off=[0,-9,9,0]; }
  for(const b of P.berths) b.wait=2+b.i*9;
  // yard stock slots under/behind the cranes
  P.slots=[]; for(let v=P.berths[0].y0+3; v<P.berths[P.berths.length-1].y1-3; v+=3.6) for(const u of [P.legL+2,P.legL+3.4,P.legL+4.8]) P.slots.push([u,v]);
  P.stock=Math.floor(P.slots.length*0.35); P.cap=P.slots.length; P.loadT=4; P.aiT=8+Math.random()*8;
  P.depot=world.depots.find(d=>d.code===P.dep); }
const PL=(P,u,v)=>[(P.O[0]+P.U[0]*u+P.V[0]*v),(P.O[1]+P.U[1]*u+P.V[1]*v)];   // local (tiles) -> world tiles
function portSegNear(P){ const dp=P.depot; if(!dp) return null; const s=navSnap(dp.entrance.x/M_T,dp.entrance.y/M_T,12); if(!s) return null; const i=idx(s[0],s[1]); const sid=world.roadH[i]>=0?world.roadH[i]:world.roadV[i]; if(sid<0) return null; const sg=world.segs[sid]; return {sg,along:(sg.dir==='h'?s[0]:s[1])+0.5}; }
function portSpawn(P,kind,toward){ const q=portSegNear(P); if(!q) return null; const {sg,along}=q;
  for(const off of [-12,12,-9,9,-15,15]){ const a=toward?along+off:along+Math.sign(off)*6; if(a<sg.b0+3||a>sg.b1-3) continue; const dir=toward?(off<0?1:-1):(off<0?-1:1);
    const p=lanePt(sg,dir,0,a); const v=spawnVehicle(p[0],p[1],true,{kind,dir,along:a,seg:sg.id}); if(v){ v.port=P; v.pinT=timeS+90; return v; } }
  return null; }
function updatePort(dt){ for(const P of portList()) updateOnePort(P,dt); }
function updateOnePort(P,dt){ if(!P.berths) return; portInit(P); const laneU=16, dockU=5;
  for(const b of P.berths){ const yc=(b.y0+b.y1)/2; let s=b.ship;
    if(!s){ b.wait-=dt; if(b.wait<=0){ const n=18+((Math.random()*12)|0); b.ship=s={x:laneU,y:P.vIn,st:'in',n,n0:n,hue:(Math.random()*360)|0,cols:Array.from({length:n},()=>['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'][(Math.random()*8)|0])}; } continue; }
    if(s.st==='in'){ const d=yc-s.y; s.y+=Math.sign(d)*Math.min(Math.abs(d),dt*Math.max(0.8,Math.min(6,Math.abs(d)*0.12))); if(Math.abs(d)<0.2) s.st='berth'; }
    else if(s.st==='berth'){ s.x-=dt*Math.max(0.4,(s.x-dockU)*0.25); if(s.x<=dockU){ s.x=dockU; s.st='dock'; } }
    else if(s.st==='dock'){ if(s.n<=0||P.stock>=P.cap){ if(s.n<=0){ s.st='unberth'; s.hold=2; } } }
    else if(s.st==='unberth'){ s.hold-=dt; if(s.hold<0){ s.x+=dt*1.2; if(s.x>=laneU){ s.x=laneU; s.st='out'; s.v=0; } } }
    else if(s.st==='out'){ s.v=Math.min(6,s.v+dt*0.5); s.y+=s.v*dt*Math.sign(P.vOut-P.vIn); if((s.y-P.vOut)*Math.sign(P.vOut-P.vIn)>0){ b.ship=null; b.wait=8+Math.random()*14; } } }
  // ship-to-shore cranes: trolley out over the ship, hoist down/up, back over the yard, set the box on the stock
  const uYard=P.legL+3.4, uShip=dockU;
  for(const c of P.cranes){ const b=P.berths[P.asg[c.i]], s=b.ship, yc=(b.y0+b.y1)/2+P.off[c.i]; c.ty=yc; c.y+=Math.sign(c.ty-c.y)*Math.min(Math.abs(c.ty-c.y),dt*1.5); if(c.hz===undefined) c.hz=1;
    const work=s&&s.st==='dock'&&s.n>0&&Math.abs(c.y-c.ty)<0.5&&P.stock<P.cap;
    if(c.ph===0){ const tgt=work?1:0.15; c.tr+=Math.sign(tgt-c.tr)*Math.min(Math.abs(tgt-c.tr),dt*0.45); if(work&&c.tr>=1){ c.ph=1; c.w=0; } }
    else if(c.ph===1){ c.w+=dt; c.hz=Math.abs(1-c.w/0.9); if(c.w>=0.9&&!c.car&&s&&s.n>0){ s.n--; c.car=s.cols[s.n]; } if(c.w>=1.8){ c.hz=1; c.ph=2; } }
    else if(c.ph===2){ c.tr=Math.max(0,c.tr-dt*0.4); if(c.tr<=0){ c.ph=3; c.w=0; } }
    else { c.w+=dt; c.hz=Math.abs(1-c.w/0.8); if(c.w>=0.8&&c.car){ c.car=null; P.landed++; P.stock=Math.min(P.cap,P.stock+1); } if(c.w>=1.6){ c.hz=1; c.ph=0; } }
    c.u=uYard+(uShip-uYard)*c.tr; }
  // loader: yard box -> skeletal trailer in a free terminal bay
  const dp=P.depot; if(!dp) return;
  P.loadT-=dt; if(P.loadT<=0){ P.loadT=5+Math.random()*4; const bay=dp.bays.find(b=>!b.trailer&&!b.target&&!b.assigned);
    if(bay&&P.stock>0){ P.stock--; const tr=makeTrailer('cont',Math.random); tr.x=bay.kx; tr.y=bay.ky; tr.th=bay.th; tr.bay=bay; tr.depot=dp; tr.portLoad=P; bay.trailer=tr; world.trailers.push(tr); } }
  // AI hauliers: a cab drives in, couples a loaded box and leaves on the network (max 2 per port in play)
  for(let k=PORTSIM.ai.length-1;k>=0;k--){ const a=PORTSIM.ai[k]; if(a.P!==P) continue; a.t+=dt; const v=a.v, e=dp.entrance;
    if(!traffic.vs.includes(v)){ PORTSIM.ai.splice(k,1); continue; }
    if(a.st==='in'&&(Math.hypot(v.x-e.x,v.y-e.y)<14||a.t>45)){ const tr=dp.bays.map(b=>b.trailer).find(t=>t&&t.portLoad&&!t.target&&!t.coupled);
      const i=traffic.vs.indexOf(v); if(i>=0) traffic.vs.splice(i,1); PORTSIM.ai.splice(k,1);
      if(tr){ const j=world.trailers.indexOf(tr); if(j>=0) world.trailers.splice(j,1); if(tr.bay) tr.bay.trailer=null; tr.bay=null; const out=portSpawn(P,'lorry',false); if(out){ out.portOut=1; P.hauled=(P.hauled||0)+1; } } } }
  P.aiT-=dt; const nAI=PORTSIM.ai.filter(a=>a.P===P).length;
  if(P.aiT<=0){ P.aiT=10+Math.random()*6; const near=Math.hypot(truck.x-dp.entrance.x,truck.y-dp.entrance.y)<280;
    if(near&&nAI<2&&dp.bays.some(b=>b.trailer&&b.trailer.portLoad&&!b.trailer.target)){ const v=portSpawn(P,'cab',true); if(v) PORTSIM.ai.push({P,v,st:'in',t:0}); } }
  // player side job prompt
  if(!career.active&&!truck.trl&&Math.abs(truck.v)<3&&Math.hypot(truck.x-dp.entrance.x,truck.y-dp.entrance.y)<90&&timeS>(P.hintT||0)){ const has=dp.bays.some(b=>b.trailer&&b.trailer.portLoad);
    if(has){ P.hintT=timeS+12; flash('Port container ready \u2022 reverse onto a loaded skeletal trailer and couple (T / pad A) for a bonus delivery job'); } } }
// player couples a port box with no job running -> instant 'Port container' delivery (bonus pay)
BigRig.on('couple',e=>{ const tr=e.trailer; if(!tr||!tr.portLoad||career.active) return; const P=tr.portLoad, from=P.depot; let j=null;
  for(let i=0;i<80&&!j;i++){ const x=makeJob(Math.max(1,Math.min(career.tier,TIERS.length))); if(x&&x.to!==from&&x.to.bays&&x.to.bays.length) j=x; } if(!j) return;
  const c=CARGOS.find(q=>q.dock)||j.cargo; j.cargo=c; j.from=from; j.path=undefined; jobRoute(j); j.pay=Math.round(j.pay*1.25/10)*10; j.xp=Math.round(j.xp*1.2); j.kg=tr.cargoKg; j.weight=tr.weight; j.taken=true; j.portSide=true;
  const free=j.to.bays.filter(b=>!b.assigned&&!b.trailer), mb=(free.length?free:j.to.bays)[(Math.random()*(free.length||j.to.bays.length))|0]; mb.assigned=true;
  tr.portLoad=null; tr.job=j.id; tr.cargo=c.name; career.jobs.push(j);
  career.active={job:j,trailer:tr,pickBay:null,bay:mb,phase:'deliver',t0:timeS,tc:timeS,dmg0:truck.damage}; setRoute(j.to);
  flash('Port container job: deliver to '+j.to.name+' \u2022 \u00a3'+j.pay+' (+25% port bonus)'); BigRig.emit('jobAccepted',{job:j}); saveGame(); });
// ---------- drawing ----------
function portFrame(P){ ctx.transform(P.U[0],P.U[1],P.V[0],P.V[1],P.O[0]*TILE,P.O[1]*TILE); }
function portVisible(P,vx0,vy0,vx1,vy1){ const a=PL(P,-20,P.berths[0].y0-40), b=PL(P,24,P.berths[P.berths.length-1].y1+40); const x0=Math.min(a[0],b[0])*TILE,x1=Math.max(a[0],b[0])*TILE,y0=Math.min(a[1],b[1])*TILE,y1=Math.max(a[1],b[1])*TILE; return !(x1<vx0||x0>vx1||y1<vy0||y0>vy1); }
function drawBox(x,y,lu,lv,col){ ctx.fillStyle=col; ctx.fillRect(x-lu/2,y-lv/2,lu,lv); ctx.fillStyle='rgba(0,0,0,0.22)'; for(let k=-lv/2+3;k<lv/2-1;k+=4) ctx.fillRect(x-lu/2,y+k,lu,1); ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=1; ctx.strokeRect(x-lu/2,y-lv/2,lu,lv); }
const YARD_COLS=['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'];
function drawPortLow(vx0,vy0,vx1,vy1){ for(const P of portList()){ if(!P.berths||!P.ready||!portVisible(P,vx0,vy0,vx1,vy1)) continue; const T_=TILE; ctx.save(); portFrame(P);
  // crane rails
  ctx.fillStyle='rgba(60,60,60,0.6)'; const v0=(P.qy0||P.berths[0].y0)*T_, v1=(P.qy1||P.berths[P.berths.length-1].y1)*T_; for(const ru of [P.legL,-1]) ctx.fillRect(ru*T_-2,v0,4,v1-v0);
  // yard stock (two tiers)
  for(let i=0;i<P.stock;i++){ const n=P.slots.length, s=P.slots[i%n], tier=(i/n)|0; drawBox(s[0]*T_-tier*3,s[1]*T_-tier*3,0.62*T_,3*T_-2,YARD_COLS[(i*7+(s[1]|0))%8]); }
  for(const b of P.berths){ const s=b.ship; if(!s) continue; const L=36*T_, W=7*T_, x=s.x*T_, y=s.y*T_;
    ctx.save(); ctx.translate(x,y); ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(-W/2+14,-L/2+14,W,L); ctx.rotate(Math.PI);
    ctx.fillStyle='hsl('+s.hue+',45%,32%)'; ctx.beginPath(); ctx.moveTo(-W/2,-L/2+W*0.2); ctx.lineTo(0,-L/2-W*0.6); ctx.lineTo(W/2,-L/2+W*0.2); ctx.lineTo(W/2,L/2); ctx.lineTo(-W/2,L/2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#8f2a1d'; ctx.fillRect(-W/2+4,-L/2+W*0.2,W-8,L-W*0.2-4);
    ctx.fillStyle='#ecf0f1'; ctx.fillRect(-W/2+6,L/2-4*T_,W-12,3.2*T_); ctx.fillStyle='#2c3e50'; ctx.fillRect(-W/2+12,L/2-3.6*T_,W-24,0.8*T_);
    const cw=(W-16)/3, ch=2.9*T_/2; for(let k=0;k<s.n0;k++){ if(k>=s.n) break; const col=k%3, row=(k/3)|0; ctx.fillStyle=s.cols[k]; ctx.fillRect(-W/2+8+col*cw,-L/2+W*0.5+row*ch*1.05,cw-2,ch-2); }
    ctx.restore(); }
  ctx.restore(); } }
// ship-to-shore gantry crane, top-down: portal legs on two rails, A-frame apex, boom out over the ship with backreach + machinery house, moving trolley, hoisted spreader
function drawSTS(P,c,sh){ const T_=TILE, y=c.y*T_, uL=P.legL*T_, uW=-1*T_, uB0=(P.legL-6)*T_, uB1=17*T_, gap=2.4*T_, bw=1.5*T_;
  const st=sh?'rgba(0,0,0,0.22)':null, red='#c0392b', wht='#ecf0f1', dk='#7b241c', blue='#2c3e50';
  ctx.save(); if(sh) ctx.translate(2.2*T_,2.2*T_);
  // portal: sill beams along the rails + bogies
  ctx.fillStyle=st||dk; for(const u of [uL,uW]) ctx.fillRect(u-5,y-gap-6,10,2*gap+12);
  if(!sh){ ctx.fillStyle='#222'; for(const u of [uL,uW]) for(const dv of [-gap-6,gap+2]) ctx.fillRect(u-7,y+dv,14,4); }
  // portal cross beams + X bracing
  ctx.strokeStyle=st||red; ctx.lineWidth=7; ctx.beginPath(); for(const dv of [-gap,gap]){ ctx.moveTo(uL,y+dv); ctx.lineTo(uW,y+dv); } ctx.stroke();
  ctx.lineWidth=3; ctx.strokeStyle=st||wht; ctx.beginPath(); for(const dv of [-gap,gap]){ ctx.moveTo(uL,y+dv-4); ctx.lineTo(uW,y+dv+4); ctx.moveTo(uL,y+dv+4); ctx.lineTo(uW,y+dv-4); } ctx.stroke();
  // boom (two chords + lattice) from backreach to outreach
  ctx.fillStyle=st||red; ctx.fillRect(uB0,y-bw/2,uB1-uB0,bw);
  if(!sh){ ctx.fillStyle=wht; ctx.fillRect(uB0,y-bw/2,uB1-uB0,4); ctx.fillRect(uB0,y+bw/2-4,uB1-uB0,4); ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1.5; ctx.beginPath(); for(let u=uB0;u<uB1-12;u+=14){ ctx.moveTo(u,y-bw/2+4); ctx.lineTo(u+14,y+bw/2-4); } ctx.stroke(); }
  // A-frame apex + forestays
  const ua=(P.legL+3)*T_; ctx.fillStyle=st||dk; ctx.beginPath(); ctx.moveTo(ua-14,y-gap); ctx.lineTo(ua+14,y-gap); ctx.lineTo(ua+5,y); ctx.lineTo(ua+14,y+gap); ctx.lineTo(ua-14,y+gap); ctx.lineTo(ua-5,y); ctx.closePath(); ctx.fill();
  if(!sh){ ctx.strokeStyle='rgba(30,30,30,0.7)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ua,y-3); ctx.lineTo(uB1-6,y-3); ctx.moveTo(ua,y+3); ctx.lineTo(uB1-6,y+3); ctx.moveTo(ua,y); ctx.lineTo(uB0+4,y); ctx.stroke(); }
  // machinery house on the backreach
  ctx.fillStyle=st||'#d0d3d6'; ctx.fillRect(uB0-4,y-bw/2-8,3.4*T_,bw+16); if(!sh){ ctx.fillStyle=blue; ctx.fillRect(uB0+6,y-bw/2-4,2.2*T_,6); ctx.fillStyle='#95a5a6'; for(let k=0;k<3;k++) ctx.fillRect(uB0+8+k*24,y+2,14,8); }
  // operator cab under the trolley + trolley + spreader/box hanging below (hoist height scales offset)
  const ut=c.u*T_; ctx.fillStyle=st||blue; ctx.fillRect(ut-12,y-bw/2-6,24,bw+12);
  if(!sh){ ctx.fillStyle='#f1c40f'; ctx.fillRect(ut-12,y-bw/2-6,24,4); }
  const hz=c.hz===undefined?1:c.hz, dz=hz*10; // higher = bigger offset from its shadow & slightly bigger
  ctx.strokeStyle=st||'#333'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(ut-8,y-6); ctx.lineTo(ut-8-dz*0.2,y-1.4*T_); ctx.moveTo(ut+8,y-6); ctx.lineTo(ut+8-dz*0.2,y+1.4*T_); ctx.stroke();
  const sc=0.9+0.12*hz, lu=0.62*T_*sc, lv=3*T_*sc; if(sh){ ctx.translate(dz*0.6,dz*0.6); ctx.fillStyle=st; ctx.fillRect(ut-lu/2,y-lv/2,lu,lv); }
  else { if(c.car) drawBox(ut,y,lu,lv,c.car); ctx.fillStyle='#f39c12'; ctx.fillRect(ut-lu/2-2,y-lv/2-2,lu+4,5); ctx.fillRect(ut-lu/2-2,y+lv/2-3,lu+4,5); }
  ctx.restore(); }
function drawPortHigh(vx0,vy0,vx1,vy1){ for(const P of portList()){ if(!P.cranes||!P.ready||!portVisible(P,vx0,vy0,vx1,vy1)) continue; ctx.save(); portFrame(P);
  for(const c of P.cranes) drawSTS(P,c,true); for(const c of P.cranes) drawSTS(P,c,false); ctx.restore(); } ctx.lineWidth=1; }
