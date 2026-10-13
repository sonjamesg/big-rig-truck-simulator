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
  // v25: two tidy marked stack blocks (2 cols x 4 rows) on the landside half of the crane portal; seaward half stays a clear lane
  P.slots=[]; P.blocks=[]; const bs=[P.berths[0],P.berths[P.berths.length-1]];
  for(const br of bs){ const vc=(br.y0+br.y1)/2, v0=vc-7.2; P.blocks.push([P.legL+1.3,v0-0.3,2.8,14.7]); for(let r=0;r<4;r++) for(const u of [P.legL+2,P.legL+3.4]) P.slots.push([u,v0+1.8+r*3.6]); }
  P.cap=P.slots.length; P.stock=6; P.loadT=4; P.aiT=6+Math.random()*6; P.virtT=30; P.lc=null;
  P.depot=world.depots.find(d=>d.code===P.dep); if(P.depot&&P.depot.bays.length){ const e=P.depot.entrance; P.lb=P.depot.bays.slice().sort((x,y)=>Math.hypot(x.kx-e.x,x.ky-e.y)-Math.hypot(y.kx-e.x,y.ky-e.y))[0]; P.lb.assigned=true; if(P.lb.trailer){ const t=P.lb.trailer, j=world.trailers.indexOf(t); if(j>=0&&!t.coupled) world.trailers.splice(j,1); P.lb.trailer=null; } } }
const PL=(P,u,v)=>[(P.O[0]+P.U[0]*u+P.V[0]*v),(P.O[1]+P.U[1]*u+P.V[1]*v)];   // local (tiles) -> world tiles
function portSegNear(P,dp){ dp=dp||P.depot; if(!dp) return null; const s=navSnap(dp.entrance.x/M_T,dp.entrance.y/M_T,12); if(!s) return null; const i=idx(s[0],s[1]); const sid=world.roadH[i]>=0?world.roadH[i]:world.roadV[i]; if(sid<0) return null; const sg=world.segs[sid]; return {sg,along:(sg.dir==='h'?s[0]:s[1])+0.5}; }
function portSpawn(P,kind,toward,dp){ const q=portSegNear(P,dp); if(!q) return null; const {sg,along}=q;
  for(const off of [-12,12,-9,9,-15,15]){ const a=toward?along+off:along+Math.sign(off)*6; if(a<sg.b0+3||a>sg.b1-3) continue; const dir=toward?(off<0?1:-1):(off<0?-1:1);
    const p=lanePt(sg,dir,0,a); const v=spawnVehicle(p[0],p[1],true,{kind,dir,along:a,seg:sg.id}); if(v){ v.port=P; v.pinT=timeS+90; return v; } }
  return null; }
// goal-directed AI: A* tile path -> idx->progress map that traffic.planPiece uses to pick turns
function aiGoal(v,dp){ const s=navSnap(v.x/M_T,v.y/M_T,12), g=navSnap(dp.entrance.x/M_T,dp.entrance.y/M_T,14); if(!s||!g) return false; const path=navAStar(s[0],s[1],g[0],g[1]); if(!path) return false;
  const m=new Map(); path.forEach((i,k)=>{ for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ const j=i+dx+dy*MW; if(!(m.get(j)>=k)) m.set(j,k); } }); v.gk=m; v.goal=dp; v.pinT=timeS+900; return true; }
function aiDepot(P){ const e=P.depot.entrance, L=world.depots.filter(d=>d!==P.depot&&d.bays&&d.bays.some(b=>!b.trailer&&!b.assigned)).sort((a,b)=>Math.hypot(a.entrance.x-e.x,a.entrance.y-e.y)-Math.hypot(b.entrance.x-e.x,b.entrance.y-e.y)).slice(0,4); return L.length?L[(Math.random()*L.length)|0]:null; }
function updatePort(dt){ for(const P of portList()) updateOnePort(P,dt); }
function updateOnePort(P,dt){ if(!P.berths) return; portInit(P); const laneU=16, dockU=5;
  for(const b of P.berths){ const yc=(b.y0+b.y1)/2; let s=b.ship;
    if(!s){ b.wait-=dt; if(b.wait<=0&&P.stock<=4&&!P.berths.some(o=>o.ship)){ const n=Math.min(P.cap-P.stock,10+((Math.random()*4)|0)); b.ship=s={x:laneU,y:P.vIn,st:'in',n,n0:n,hue:(Math.random()*360)|0,cols:Array.from({length:n},()=>['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'][(Math.random()*8)|0])}; } continue; }
    if(s.st==='in'){ const d=yc-s.y; s.y+=Math.sign(d)*Math.min(Math.abs(d),dt*Math.max(0.8,Math.min(6,Math.abs(d)*0.12))); if(Math.abs(d)<0.2) s.st='berth'; }
    else if(s.st==='berth'){ s.x-=dt*Math.max(0.4,(s.x-dockU)*0.25); if(s.x<=dockU){ s.x=dockU; s.st='dock'; } }
    else if(s.st==='dock'){ if(s.n<=0||(P.stock>=P.cap&&!P.cranes.some(c=>c.car))){ s.n=0; s.st='unberth'; s.hold=2; } }
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
  // v25 loop: AI skeletal truck queues at the loading bay -> loading crane lowers a yard box -> truck hauls to a depot -> despawns there (nothing left) -> returns empty
  const dp=P.depot, lb=P.lb; if(!dp||!lb) return; const e=dp.entrance, near=Math.hypot(truck.x-e.x,truck.y-e.y)<280;
  if(P.lc){ const L=P.lc; L.t+=dt; if(L.t>=6){ P.lc=null; P.stock=Math.max(0,P.stock-1); P.loaded=(P.loaded||0)+1;
      if(L.player){ portLoadPlayer(P); } else { const out=portSpawn(P,'lorry',false); const gd=aiDepot(P)||world.depots.find(d=>d!==dp&&d.bays.length);
        if(out&&gd&&aiGoal(out,gd)) PORTSIM.ai.push({P,v:out,st:'haul',t:0,gd}); else { if(out){ const i=traffic.vs.indexOf(out); if(i>=0) traffic.vs.splice(i,1); } PORTSIM.ai.push({P,v:null,st:'haul',t:0,gd:gd||dp,virt:1,eta:60}); } } } }
  for(let k=PORTSIM.ai.length-1;k>=0;k--){ const a=PORTSIM.ai[k]; if(a.P!==P) continue; a.t+=dt; const v=a.v;
    const kill=()=>{ if(v){ const i=traffic.vs.indexOf(v); if(i>=0) traffic.vs.splice(i,1); } };
    if(v&&!a.virt&&!traffic.vs.includes(v)){ a.virt=1; a.eta=a.t+(a.st==='haul'?Math.hypot(v.x-a.gd.entrance.x,v.y-a.gd.entrance.y)/9:30); }
    if(a.st==='in'){ if(a.virt||Math.hypot(v.x-e.x,v.y-e.y)<14||a.t>45){ kill(); PORTSIM.ai.splice(k,1); if(P.stock>0&&!P.lc) P.lc={t:0,col:YARD_COLS[(Math.random()*8)|0]}; } continue; }
    if(a.st==='haul'){ const g=a.gd.entrance;
      if(!a.virt&&Math.hypot(v.x-truck.x,v.y-truck.y)>220&&Math.hypot(v.x-g.x,v.y-g.y)>220){ kill(); a.virt=1; a.eta=a.t+Math.hypot(v.x-g.x,v.y-g.y)*1.3/12; }
      if((a.virt?a.t>a.eta:Math.hypot(v.x-g.x,v.y-g.y)<22)||a.t>480){ kill(); PORTSIM.ai.splice(k,1); P.dropped=(P.dropped||0)+1;   // drop-off only: box + trailer simply despawn
        PORTSIM.ai.push({P,v:null,st:'ret',t:0,virt:1,eta:Math.hypot(g.x-e.x,g.y-e.y)*1.3/12}); } continue; }
    if(a.st==='ret'&&a.t>a.eta){ PORTSIM.ai.splice(k,1); P.back=(P.back||0)+1; if(near&&P.stock>0){ const c=portSpawn(P,'lorry',true); if(c) PORTSIM.ai.push({P,v:c,st:'in',t:0}); } } }
  const nAI=PORTSIM.ai.filter(a=>a.P===P).length;
  P.aiT-=dt; if(P.aiT<=0){ P.aiT=12+Math.random()*6; if(near&&nAI<2&&P.stock>0&&!P.lc&&!PORTSIM.ai.some(a=>a.P===P&&a.st==='in')){ const v=portSpawn(P,'lorry',true); if(v) PORTSIM.ai.push({P,v,st:'in',t:0}); } }
  if(!near){ P.virtT-=dt; if(P.virtT<=0){ P.virtT=35+Math.random()*20; if(P.stock>0){ P.stock--; P.loaded=(P.loaded||0)+1; P.dropped=(P.dropped||0)+1; } } }
  // player side job: stop an empty / job-free trailer under the loading crane
  const tr=truck.trl; if(tr&&!career.active&&!P.lc){ const dk=Math.hypot(tr.x-lb.kx,tr.y-lb.ky);
    if(dk<4&&Math.abs(truck.v)<0.5&&P.stock>0){ P.lc={t:0,player:true,col:YARD_COLS[(Math.random()*8)|0]}; flash('Loading crane: hold still \u2022 lowering a container onto your trailer'); }
    else if(dk<60&&timeS>(P.hintT||0)&&P.stock>0){ P.hintT=timeS+14; flash('Port loading bay \u2022 reverse your trailer under the yellow loading crane and stop for a paid container job'); } }
  if(P.lc&&P.lc.player&&(!truck.trl||Math.hypot(truck.trl.x-lb.kx,truck.trl.y-lb.ky)>4)){ P.lc=null; flash('Loading cancelled \u2022 you moved off the bay'); } }
function portLoadPlayer(P){ const o=truck.trl; if(!o) return; const tr=makeTrailer('cont',Math.random,{coupled:true}); tr.art=trailerArt(tr.type,tr.col,tr.logo); tr.x=o.x; tr.y=o.y; tr.th=o.th; tr.coupled=true; truck.trl=tr; const i=world.trailers.indexOf(o); if(i>=0) world.trailers[i]=tr; else world.trailers.push(tr); tr.portLoad=P; portJob(tr); }
// player couples a port box with no job running -> instant 'Port container' delivery (bonus pay)
function portJob(tr){ if(!tr||!tr.portLoad||career.active) return; const P=tr.portLoad, from=P.depot; let j=null;
  for(let i=0;i<80&&!j;i++){ const x=makeJob(Math.max(1,Math.min(career.tier,TIERS.length))); if(x&&x.to!==from&&x.to.bays&&x.to.bays.length) j=x; } if(!j) return;
  const c=CARGOS.find(q=>q.dock)||j.cargo; j.cargo=c; j.from=from; j.path=undefined; jobRoute(j); j.pay=Math.round(j.pay*1.25/10)*10; j.xp=Math.round(j.xp*1.2); j.kg=tr.cargoKg; j.weight=tr.weight; j.taken=true; j.portSide=true;
  const free=j.to.bays.filter(b=>!b.assigned&&!b.trailer), mb=(free.length?free:j.to.bays)[(Math.random()*(free.length||j.to.bays.length))|0]; mb.assigned=true;
  tr.portLoad=null; tr.job=j.id; tr.cargo=c.name; career.jobs.push(j);
  career.active={job:j,trailer:tr,pickBay:null,bay:mb,phase:'deliver',t0:timeS,tc:timeS,dmg0:truck.damage}; setRoute(j.to);
  flash('Port container job: deliver to '+j.to.name+' \u2022 \u00a3'+j.pay+' (+25% port bonus)'); BigRig.emit('jobAccepted',{job:j}); saveGame(); }
// ---------- drawing ----------
function portFrame(P){ ctx.transform(P.U[0],P.U[1],P.V[0],P.V[1],P.O[0]*TILE,P.O[1]*TILE); }
function portVisible(P,vx0,vy0,vx1,vy1){ const a=PL(P,-20,P.berths[0].y0-40), b=PL(P,24,P.berths[P.berths.length-1].y1+40); const x0=Math.min(a[0],b[0])*TILE,x1=Math.max(a[0],b[0])*TILE,y0=Math.min(a[1],b[1])*TILE,y1=Math.max(a[1],b[1])*TILE; return !(x1<vx0||x0>vx1||y1<vy0||y0>vy1); }
function drawBox(x,y,lu,lv,col){ ctx.fillStyle=col; ctx.fillRect(x-lu/2,y-lv/2,lu,lv); ctx.fillStyle='rgba(0,0,0,0.22)'; for(let k=-lv/2+3;k<lv/2-1;k+=4) ctx.fillRect(x-lu/2,y+k,lu,1); ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=1; ctx.strokeRect(x-lu/2,y-lv/2,lu,lv); }
const YARD_COLS=['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'];
function drawPortLow(vx0,vy0,vx1,vy1){ for(const P of portList()){ if(!P.berths||!P.ready||!portVisible(P,vx0,vy0,vx1,vy1)) continue; const T_=TILE; ctx.save(); portFrame(P);
  // crane rails
  ctx.fillStyle='rgba(60,60,60,0.6)'; const v0=(P.qy0||P.berths[0].y0)*T_, v1=(P.qy1||P.berths[P.berths.length-1].y1)*T_; for(const ru of [P.legL,-1]) ctx.fillRect(ru*T_-2,v0,4,v1-v0);
  // yard stock (two tiers)
  ctx.fillStyle='rgba(120,120,120,0.25)'; ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=2; for(const k of P.blocks){ ctx.fillRect(k[0]*T_,k[1]*T_,k[2]*T_,k[3]*T_); ctx.strokeRect(k[0]*T_,k[1]*T_,k[2]*T_,k[3]*T_); }
  ctx.strokeStyle='rgba(255,214,0,0.5)'; ctx.lineWidth=1; for(const q of P.slots) ctx.strokeRect(q[0]*T_-0.36*T_,q[1]*T_-1.6*T_,0.72*T_,3.2*T_);
  for(let i=0;i<Math.min(P.stock,P.slots.length);i++){ const q=P.slots[(i%2)*8+((i>>1)%8)]; drawBox(q[0]*T_,q[1]*T_,0.62*T_,3*T_-2,YARD_COLS[(i*7+(q[1]|0))%8]); }
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
  ctx.fillStyle=st||dk; for(const u of [uL,uW]) ctx.fillRect(u-9,y-gap-8,18,2*gap+16); ctx.fillStyle=st||red; for(const u of [uL,uW]) for(const dv of [-gap,gap]) ctx.fillRect(u-12,y+dv-12,24,24); if(!sh){ ctx.fillStyle='rgba(255,255,255,0.35)'; for(const u of [uL,uW]) for(const dv of [-gap,gap]) ctx.fillRect(u-12,y+dv-12,24,5); }
  if(!sh){ ctx.fillStyle='#222'; for(const u of [uL,uW]) for(const dv of [-gap-6,gap+2]) ctx.fillRect(u-7,y+dv,14,4); }
  // portal cross beams + X bracing
  ctx.strokeStyle=st||red; ctx.lineWidth=12; ctx.beginPath(); for(const dv of [-gap,gap]){ ctx.moveTo(uL,y+dv); ctx.lineTo(uW,y+dv); } ctx.stroke();
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
function drawLoadCrane(P){ const b=P.lb; if(!b) return; const ft=fwd(b.th), rt=rgt(b.th), cx=b.kx-ft[0]*TRL_KP_TO_CENTRE, cy=b.ky-ft[1]*TRL_KP_TO_CENTRE, S=PPM;
  ctx.save(); ctx.translate(cx*S,cy*S); ctx.rotate(b.th); const L=P.lc;
  if(L&&!L.player){ ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-1.2*S+5,-6.8*S+5,2.4*S,15*S); ctx.fillStyle='#2b2f36'; ctx.fillRect(-0.9*S,-6.8*S,1.8*S,13.6*S); ctx.fillStyle='#d9dde3'; ctx.fillRect(-1.25*S,-9.6*S,2.5*S,2.6*S); ctx.fillStyle='#1d3c5e'; ctx.fillRect(-1.1*S,-9.4*S,2.2*S,0.7*S); }
  if(L){ const k=Math.min(1,L.t/4), h=1-k, sc=1+0.25*h; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(-1.25*S+8*h,-6.6*S+8*h,2.5*S,12.2*S); ctx.save(); ctx.scale(sc,sc); drawBox(0,0,2.45*S,12.2*S,L.col); ctx.restore(); }
  ctx.fillStyle='#e0a800'; ctx.strokeStyle='#5a4500'; ctx.lineWidth=1.5; for(const sd of [-1,1]){ ctx.fillRect(sd*2.6*S-0.5*S,-8*S,1*S,16*S); ctx.strokeRect(sd*2.6*S-0.5*S,-8*S,1*S,16*S); }
  const ty=L?-0.5*S:-7*S; ctx.fillRect(-3.1*S,ty-0.6*S,6.2*S,1.2*S); ctx.strokeRect(-3.1*S,ty-0.6*S,6.2*S,1.2*S); ctx.fillStyle='#333'; ctx.fillRect(-0.8*S,ty-0.8*S,1.6*S,1.6*S);
  ctx.restore(); }
function drawPortHigh(vx0,vy0,vx1,vy1){ for(const P of portList()) if(P.ready&&P.lb&&Math.abs(P.lb.kx*PPM-(vx0+vx1)/2)<(vx1-vx0)&&Math.abs(P.lb.ky*PPM-(vy0+vy1)/2)<(vy1-vy0)) drawLoadCrane(P); for(const P of portList()){ if(!P.cranes||!P.ready||!portVisible(P,vx0,vy0,vx1,vy1)) continue; ctx.save(); portFrame(P);
  for(const c of P.cranes) drawSTS(P,c,true); for(const c of P.cranes) drawSTS(P,c,false); ctx.restore(); } ctx.lineWidth=1; }
