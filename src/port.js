'use strict';
// ===================== v18 living container ports (Albion + Kingsbridge) =====================
// Each port works in a local frame: u = metres-in-tiles from the quay edge towards the water, v = along the quay.
// Ships berth, ship-to-shore gantry cranes lift boxes onto the yard stock, a loader puts boxes on skeletal trailers in the
// terminal bays, AI cabs come in, couple and haul them out on the road network; the player can take one as a side job.
const PORTSIM={t:0,ai:[]};
function portList(){ const L=[]; if(world.port) L.push(world.port); if(world.kbPort) L.push(world.kbPort); return L; }
function portInit(P){ if(P.ready) return; P.ready=1; P.landed=0;
  if(!P.O){ P.O=[P.edge,0]; P.U=[1,0]; P.V=[0,1]; P.vIn=150; P.vOut=470; P.dep='APT'; P.legL=P.quayX-P.edge-1; P.asg=[0,1,1,2]; P.off=[0,-9,9,0]; }
  for(const b of P.berths) b.wait=0;
  portCfg(P); dgBuild(P);
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
function updatePort(dt){ portHookTraffic(); if(typeof updatePortTrucks==='function') updatePortTrucks(dt); for(const P of portList()){ updateOnePort(P,dt); if(P.ready&&P.strad) updatePortLife(P,dt); } }
function updateOnePort(P,dt){ if(!P.berths) return; portInit(P); updatePortLogistics(P,dt,portT());
  // v25 loop: AI skeletal truck queues at the loading bay -> loading crane lowers a yard box -> truck hauls to a depot -> despawns there (nothing left) -> returns empty
  const dp=P.depot, lb=P.lb; if(!dp||!lb) return; const e=dp.entrance, near=Math.hypot(truck.x-e.x,truck.y-e.y)<280;
  if(P.lc){ const L=P.lc; L.t+=dt; if(L.t>=6){ P.lc=null; if(P.stock>0) P.collected=(P.collected||0)+1; P.stock=Math.max(0,P.stock-1); P.loaded=(P.loaded||0)+1;
      if(L.player){ portLoadPlayer(P); } else { const out=portSpawn(P,'lorry',false); const gd=aiDepot(P)||world.depots.find(d=>d!==dp&&d.bays.length);
        if(out&&gd&&aiGoal(out,gd)) PORTSIM.ai.push({P,v:out,st:'haul',t:0,gd}); else { if(out){ const i=traffic.vs.indexOf(out); if(i>=0) traffic.vs.splice(i,1); } PORTSIM.ai.push({P,v:null,st:'haul',t:0,gd:gd||dp,virt:1,eta:60}); } } } }
  for(let k=PORTSIM.ai.length-1;k>=0;k--){ const a=PORTSIM.ai[k]; if(a.P!==P) continue; a.t+=dt; const v=a.v;
    const kill=()=>{ if(v){ const i=traffic.vs.indexOf(v); if(i>=0) traffic.vs.splice(i,1); } };
    if(v&&!a.virt&&!traffic.vs.includes(v)){ a.virt=1; a.eta=a.t+(a.st==='haul'?Math.hypot(v.x-a.gd.entrance.x,v.y-a.gd.entrance.y)/9:30); }
    if(a.st==='in'){ if(a.virt||Math.hypot(v.x-e.x,v.y-e.y)<14||a.t>45){ kill(); PORTSIM.ai.splice(k,1); if(P.stock-P.impClaim>0&&!P.lc) P.lc={t:0,col:YARD_COLS[(Math.random()*8)|0]}; } continue; }
    if(a.st==='haul'){ const g=a.gd.entrance;
      if(!a.virt&&Math.hypot(v.x-truck.x,v.y-truck.y)>220&&Math.hypot(v.x-g.x,v.y-g.y)>220){ kill(); a.virt=1; a.eta=a.t+Math.hypot(v.x-g.x,v.y-g.y)*1.3/12; }
      if((a.virt?a.t>a.eta:Math.hypot(v.x-g.x,v.y-g.y)<22)||a.t>480){ kill(); PORTSIM.ai.splice(k,1); P.dropped=(P.dropped||0)+1;   // drop-off only: box + trailer simply despawn
        PORTSIM.ai.push({P,v:null,st:'ret',t:0,virt:1,eta:Math.hypot(g.x-e.x,g.y-e.y)*1.3/12}); } continue; }
    if(a.st==='ret'&&a.t>a.eta){ PORTSIM.ai.splice(k,1); P.back=(P.back||0)+1; if(near&&P.stock-P.impClaim>0){ const c=portSpawn(P,'lorry',true); if(c) PORTSIM.ai.push({P,v:c,st:'in',t:0}); } } }
  const nAI=PORTSIM.ai.filter(a=>a.P===P).length;
  P.aiT-=dt; if(P.aiT<=0&&typeof PTRUCK==='undefined'){ P.aiT=12+Math.random()*6; if(near&&nAI<2&&P.stock-P.impClaim>0&&!P.lc&&!PORTSIM.ai.some(a=>a.P===P&&a.st==='in')){ const v=portSpawn(P,'lorry',true); if(v) PORTSIM.ai.push({P,v,st:'in',t:0}); } }
  if(false){ P.virtT-=dt; if(P.virtT<=0){ P.virtT=35+Math.random()*20; if(P.stock-P.impClaim>0){ P.stock--; P.loaded=(P.loaded||0)+1; P.dropped=(P.dropped||0)+1; } } }
  // player side job: stop an empty / job-free trailer under the loading crane
  const tr=truck.trl; if(tr&&!career.active&&!P.lc){ const dk=Math.hypot(tr.x-lb.kx,tr.y-lb.ky);
    if(dk<4&&Math.abs(truck.v)<0.5&&P.stock-P.impClaim>0){ P.lc={t:0,player:true,col:YARD_COLS[(Math.random()*8)|0]}; flash('Loading crane: hold still \u2022 lowering a container onto your trailer'); }
    else if(dk<60&&timeS>(P.hintT||0)&&P.stock-P.impClaim>0){ P.hintT=timeS+14; flash('Port loading bay \u2022 reverse your trailer under the yellow loading crane and stop for a paid container job'); } }
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
function drawShip(P,o){ const T_=TILE, p=o.pose, s=o.s, L=SHIP.L*T_, W=SHIP.W*T_; ctx.save(); ctx.translate(p.u*T_,p.v*T_); ctx.rotate(p.h);
  ctx.fillStyle='rgba(0,0,0,0.13)'; ctx.fillRect(-L/2+8,-W/2+8,L-2.5*TILE,W);
  if(p.k==='in'||p.k==='out'){ ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-L/2,-W/2+4); ctx.lineTo(-L/2-5*T_,-W*0.9); ctx.lineTo(-L/2-5*T_,W*0.9); ctx.lineTo(-L/2,W/2-4); ctx.fill(); }
  ctx.fillStyle=s.hull; ctx.beginPath(); ctx.moveTo(-L/2+6,-W/2); ctx.lineTo(L/2-4*T_,-W/2); ctx.quadraticCurveTo(L/2-0.5*T_,-W/2,L/2,0); ctx.quadraticCurveTo(L/2-0.5*T_,W/2,L/2-4*T_,W/2); ctx.lineTo(-L/2+6,W/2); ctx.quadraticCurveTo(-L/2,W/2,-L/2,W/2-8); ctx.lineTo(-L/2,-W/2+8); ctx.quadraticCurveTo(-L/2,-W/2,-L/2+6,-W/2); ctx.fill();
  ctx.fillStyle='#4b5157'; ctx.beginPath(); ctx.moveTo(-L/2+8,-W/2+6); ctx.lineTo(L/2-4.4*T_,-W/2+6); ctx.quadraticCurveTo(L/2-1.4*T_,-W/2+6,L/2-1*T_,0); ctx.quadraticCurveTo(L/2-1.4*T_,W/2-6,L/2-4.4*T_,W/2-6); ctx.lineTo(-L/2+8,W/2-6); ctx.closePath(); ctx.fill();
  // bridge house at the stern + funnel
  ctx.fillStyle='#ecf0f1'; ctx.fillRect(-L/2+0.6*T_,-W/2+8,2.8*T_,W-16); ctx.fillStyle='#22313f'; ctx.fillRect(-L/2+2.7*T_,-W/2+10,0.5*T_,W-20); ctx.fillStyle='#c0392b'; ctx.fillRect(-L/2+1.1*T_,-0.45*T_,0.9*T_,0.9*T_);
  for(let j=0;j<SHIP.N;j++){ const c=s.has[j]; const x=boxAx(j)*T_; if(c) drawBox(x,0,3*T_-3,2.4*T_,c); else { ctx.strokeStyle='rgba(255,214,0,0.35)'; ctx.lineWidth=1; ctx.strokeRect(x-1.5*T_+2,-1.2*T_,3*T_-4,2.4*T_); } }
  ctx.restore(); }
function drawTractor(P,x,y,h,box,col,th){ const T_=TILE; ctx.save(); ctx.translate(x*T_,y*T_); ctx.rotate(h);   // AGV: flat driverless carrier
  ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-1.75*T_+4,-0.42*T_+4,3.5*T_,0.84*T_);
  ctx.fillStyle='#3d4249'; ctx.fillRect(-1.75*T_,-0.42*T_,3.5*T_,0.84*T_); ctx.fillStyle='#f1c40f'; ctx.fillRect(-1.75*T_,-0.42*T_,3.5*T_,0.1*T_); ctx.fillRect(-1.75*T_,0.32*T_,3.5*T_,0.1*T_);
  ctx.fillStyle='#111'; for(const sd of [-1,1]) for(const k of [0,1,2]) ctx.fillRect(sd>0?1.45*T_:-1.75*T_,(-0.36+k*0.28)*T_,0.3*T_,0.12*T_);
  if(box) drawBox(0,0,3*T_,0.62*T_,box); else { ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(-1.4*T_,-0.25*T_,2.8*T_,0.5*T_); }
  ctx.fillStyle=col||'#2ecc71'; for(const sx of [-1.55,1.55]){ ctx.beginPath(); ctx.arc(sx*T_,0,2.2,0,7); ctx.fill(); }   // status beacons
  ctx.fillStyle='#e8f6ff'; for(const sd of [-1,1]) ctx.fillRect(1.68*T_,sd*0.28*T_-1.5,2,3); ctx.fillStyle='#ff3b30'; for(const sd of [-1,1]) ctx.fillRect(-1.72*T_,sd*0.28*T_-1.5,2,3);
  ctx.restore(); }
function drawPortLorry(P,x,y,h,l){ const T_=TILE, th=l.th??h; ctx.save(); ctx.translate(x*T_,y*T_); ctx.rotate(th);   // skeletal trailer (articulated at the fifth wheel)
  ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-3.4*T_+4,-0.34*T_+4,3.4*T_,0.68*T_);
  ctx.fillStyle='#3a3d42'; ctx.fillRect(-3.4*T_,-0.3*T_,3.4*T_,0.6*T_); ctx.fillStyle='#111'; for(const a of [-3.2,-2.9,-2.6]) for(const sd of [-1,1]) ctx.fillRect(a*T_,sd*0.33*T_-3,0.22*T_,6);
  if(l.box) drawBox(-1.7*T_,0,3*T_,0.62*T_,l.box); ctx.rotate(h-th); ctx.fillStyle='#3a3d42'; ctx.fillRect(-0.3*T_,-0.28*T_,1.2*T_,0.56*T_); ctx.fillStyle='#111'; for(const a of [-0.1,0.9]) for(const sd of [-1,1]) ctx.fillRect(a*T_,sd*0.33*T_-3,0.22*T_,6);
  ctx.fillStyle=l.col; ctx.fillRect(0.2*T_,-0.33*T_,1.3*T_,0.66*T_); ctx.fillStyle='#1d2b3a'; ctx.fillRect(1.15*T_,-0.27*T_,0.25*T_,0.54*T_);
  ctx.restore(); }
function portClipBridges(P){ ctx.beginPath(); ctx.rect(-1e5,-1e5,2e5,2e5); for(const r of P.brg) ctx.rect(r[0]*TILE,r[1]*TILE,r[2]*TILE,r[3]*TILE); ctx.clip('evenodd'); }
function portShipVis(P,o,vx0,vy0,vx1,vy1){ const w=PL(P,o.pose.u,o.pose.v), x=w[0]*TILE, y=w[1]*TILE, m=SHIP.L*TILE; return x>vx0-m&&x<vx1+m&&y>vy0-m&&y<vy1+m; }
function drawPortLow(vx0,vy0,vx1,vy1){ drawPortPickBays(vx0,vy0,vx1,vy1); if(typeof drawPortTrucksLow==='function') drawPortTrucksLow(vx0,vy0,vx1,vy1); for(const P of portList()){ if(!P.berths||!P.ready||!P.ph) continue; const T_=TILE, vis=portVisible(P,vx0,vy0,vx1,vy1); ctx.save(); portFrame(P);
  if(vis){
  // crane rails
  ctx.fillStyle='rgba(60,60,60,0.6)'; const v0=(P.qy0||P.berths[0].y0)*T_, v1=(P.qy1||P.berths[P.berths.length-1].y1)*T_; for(const ru of [P.legL,-1]) ctx.fillRect(ru*T_-2,v0,4,v1-v0);
  // lane markings: tractor loop (yellow, one-way chevrons) + lorry lane (white)
  ctx.strokeStyle='rgba(255,214,0,0.55)'; ctx.lineWidth=2; ctx.setLineDash([10,8]); ctx.beginPath(); for(let s=0;s<=P.lLen;s+=1.5){ const q=loopPos(P,s); s?ctx.lineTo(q[0]*T_,q[1]*T_):ctx.moveTo(q[0]*T_,q[1]*T_); } ctx.closePath(); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.setLineDash([]); ctx.lineWidth=1.5; for(const du of [-0.55,0.55]){ ctx.beginPath(); ctx.moveTo((P.lorU+du)*T_,P.lor[0]*T_); ctx.lineTo((P.lorU+du)*T_,P.lor[1]*T_); ctx.stroke(); }
  ctx.fillStyle='rgba(255,255,255,0.6)'; for(let v=Math.min(...P.lor)+8;v<Math.max(...P.lor)-4;v+=14){ const d=P.laneDir; ctx.beginPath(); ctx.moveTo((P.lorU-0.3)*T_,(v)*T_); ctx.lineTo(P.lorU*T_,(v+d*0.8)*T_); ctx.lineTo((P.lorU+0.3)*T_,v*T_); ctx.fill(); }
  // berth marks
  ctx.fillStyle='rgba(255,255,255,0.8)'; for(const bv of [P.vA,P.vB]) for(const e of [-14,14]) ctx.fillRect(-0.9*T_,(bv+e)*T_-2,0.8*T_,4);
  // stack blocks
  ctx.fillStyle='rgba(120,120,120,0.25)'; ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2; for(const k of P.blocks){ ctx.fillRect(k[0]*T_,k[1]*T_,k[2]*T_,k[3]*T_); ctx.strokeRect(k[0]*T_,k[1]*T_,k[2]*T_,k[3]*T_); }
  ctx.strokeStyle='rgba(255,214,0,0.5)'; ctx.lineWidth=1; for(const q of P.slots) ctx.strokeRect(q[0]*T_-0.36*T_,q[1]*T_-1.6*T_,0.72*T_,3.2*T_);
  for(let i=0;i<Math.min(P.stock,16);i++){ const q=P.slots[i]; drawBox(q[0]*T_,q[1]*T_,0.62*T_,3*T_-2,YARD_COLS[(i*5+3)%8]); }
  for(let i=0;i<Math.min(P.ex,16);i++){ const q=P.slots[16+i]; drawBox(q[0]*T_,q[1]*T_,0.62*T_,3*T_-2,YARD_COLS[(i*3+1)%8]); }
  // tractors + lorries
  for(const tr of P.tracs){ const q=loopPos(P,tr.s), h=tr.h??q[2]; drawTractor(P,q[0],q[1],h,tr.box,tr.yield?'#ff9f1a':tr.mv>0.05?'#2ecc71':'#3498db'); if(typeof DN!=='undefined'&&DN.dark>0.05){ const w=PL(P,q[0]+Math.cos(h)*2.4,q[1]+Math.sin(h)*2.4); dnLight(w[0]*TILE,w[1]*TILE,46,'rgba(230,245,255,0.9)',0.6); } }
  for(const l of P.lors){ if(l.x==null) continue; drawPortLorry(P,l.x,l.y,l.h,l); if(typeof DN!=='undefined'&&DN.dark>0.05){ const w=PL(P,l.x+Math.cos(l.h)*1.6,l.y+Math.sin(l.h)*1.6); dnLight(w[0]*TILE,w[1]*TILE,70,'rgba(255,245,215,0.9)',0.7); } }
  drawPortLife(P);
  }
  // ships (beneath the tall bridge decks) + the decks' shadow and piers
  const ships=(P.cur&&P.cur.ships)||[]; ctx.save(); if(P.brg.length) portClipBridges(P);
  for(const o of ships) if(o.s&&portShipVis(P,o,vx0,vy0,vx1,vy1)) drawShip(P,o);
  if(typeof DN!=='undefined'&&DN.dark>0.05) for(const o of ships) if(o.s&&portShipVis(P,o,vx0,vy0,vx1,vy1)){ const p=o.pose, f=[Math.cos(p.h),Math.sin(p.h)];   // deck floodlights cut the darkness over the whole ship
    for(let a=-SHIP.L/2+2;a<=SHIP.L/2-3;a+=6){ const w=PL(P,p.u+f[0]*a,p.v+f[1]*a); dnLight(w[0]*TILE,w[1]*TILE,SHIP.W*TILE*1.5,'rgba(255,228,170,0.9)',0.75); } }
  ctx.restore(); ctx.restore();
  if(P.brgW&&P.brgW.box){ const b=P.brgW.box; if(b[2]*TILE>vx0-200&&b[0]*TILE<vx1+200&&b[3]*TILE>vy0-200&&b[1]*TILE<vy1+200){ ctx.save(); ctx.beginPath(); ctx.rect(-1e5,-1e5,2e5,2e5); for(const r of P.brgW.runs) ctx.rect(r[0]*TILE,r[1]*TILE,r[2]*TILE,1*TILE); ctx.clip('evenodd');
    const off=2.4*TILE; ctx.fillStyle='rgba(0,0,0,0.33)'; for(const r of P.brgW.runs) ctx.fillRect(r[0]*TILE+off,r[1]*TILE+off,r[2]*TILE,TILE);
    for(const x of P.piers){ const ys=P.brgW.runs.filter(r=>x>=r[0]&&x<r[0]+r[2]).map(r=>r[1]); if(!ys.length) continue; const y0=Math.min(...ys), y1=Math.max(...ys)+1;
      ctx.fillStyle='#8d949b'; ctx.fillRect((x-1)*TILE,y0*TILE,2*TILE,(y1-y0)*TILE+off); ctx.fillStyle='#6b7177'; ctx.fillRect((x+0.4)*TILE,y0*TILE,0.6*TILE,(y1-y0)*TILE+off); ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect((x-1)*TILE,(y1)*TILE+off-6,2*TILE,6); }
    ctx.restore(); ctx.strokeStyle='#cfd6dc'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(b[0]*TILE,b[1]*TILE+2); ctx.lineTo(b[2]*TILE,b[1]*TILE+2); ctx.moveTo(b[0]*TILE,b[3]*TILE-2); ctx.lineTo(b[2]*TILE,b[3]*TILE-2); ctx.stroke(); } }
  if(vis){ ctx.font='bold 22px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(255,255,255,0.85)';
    for(const [V,tx] of [[P.impC,'IMPORT'],[P.expC,'EXPORT']]){ const w=PL(P,P.legL+3.1,V); ctx.save(); ctx.translate(w[0]*TILE,w[1]*TILE); if(P.U[0]===0) {} else ctx.rotate(Math.PI/2); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(-52,-13,104,26); ctx.fillStyle='#ffd600'; ctx.fillText(tx,0,1); ctx.restore(); }
    ctx.textBaseline='alphabetic'; } } }
function portBridgeWorld(P){ const ch=P.chan, runs=[]; for(let y=ch[1];y<ch[3];y++){ let x0=-1; for(let x=ch[0];x<=ch[2];x++){ const b=x<ch[2]&&get(x,y)===T.BRIDGE; if(b&&x0<0) x0=x; if(!b&&x0>=0){ runs.push([x0,y,x-x0]); x0=-1; } } }
  let box=null; if(runs.length){ box=[1e9,1e9,-1e9,-1e9]; for(const r of runs){ box[0]=Math.min(box[0],r[0]); box[1]=Math.min(box[1],r[1]); box[2]=Math.max(box[2],r[0]+r[2]); box[3]=Math.max(box[3],r[1]+1); } } P.brgW={runs,box}; }
function drawRTG(P,g,sh){ const T_=TILE, y=g.v*T_, u0=(P.legL+0.2)*T_, u1=(P.tl1+0.9)*T_, gap=2.3*T_; ctx.save(); if(sh){ ctx.translate(1.6*T_,1.6*T_); ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.strokeStyle='rgba(0,0,0,0.2)'; }
  // two portal frames along v + girders across u
  ctx.fillStyle=sh?ctx.fillStyle:'#f1c40f'; for(const dv of [-gap,gap]) ctx.fillRect(u0,y+dv-5,u1-u0,10); for(const u of [u0,u1]) ctx.fillRect(u-6,y-gap-7,12,2*gap+14);
  if(!sh){ ctx.fillStyle='#222'; for(const u of [u0,u1]) for(const dv of [-gap-9,gap+5]) ctx.fillRect(u-7,y+dv,14,5); ctx.fillStyle='#b7950b'; ctx.fillRect(u1-0.9*T_,y-gap-6,0.8*T_,0.8*T_); }
  const ut=g.su*T_, hz=g.hz==null?1:g.hz; ctx.fillStyle=sh?ctx.fillStyle:'#2c3e50'; ctx.fillRect(ut-10,y-gap-2,20,2*gap+4);
  if(!sh){ if(g.car&&g.col){ const sc=0.9+0.1*hz; drawBox(ut,y,0.62*T_*sc,3*T_*sc,g.col); } ctx.fillStyle='#f39c12'; ctx.fillRect(ut-0.36*T_,y-1.55*T_,0.72*T_,4); ctx.fillRect(ut-0.36*T_,y+1.55*T_-4,0.72*T_,4); }
  ctx.restore(); }
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
function drawPortHigh(vx0,vy0,vx1,vy1){ if(typeof drawDepotCranes==='function') drawDepotCranes(vx0,vy0,vx1,vy1); for(const P of portList()) if(P.ready&&P.lb&&Math.abs(P.lb.kx*PPM-(vx0+vx1)/2)<(vx1-vx0)&&Math.abs(P.lb.ky*PPM-(vy0+vy1)/2)<(vy1-vy0)) drawLoadCrane(P); for(const P of portList()){ if(!P.cranes||!P.ready||!P.rtg||!portVisible(P,vx0,vy0,vx1,vy1)) continue; ctx.save(); portFrame(P);
  for(const g of P.rtg) drawRTG(P,g,true); for(const g of P.rtg) drawRTG(P,g,false);
  for(const c of P.cranes) drawSTS(P,c,true); for(const c of P.cranes) drawSTS(P,c,false); ctx.restore(); }
  for(const P of portList()) if(P.ready&&P.gates&&portVisible(P,vx0,vy0,vx1,vy1)){ ctx.save(); portFrame(P); dgDrawFence(P); dgDrawMasts(P); for(const g of P.gates) dgDrawGate(P,g); ctx.restore(); for(const g of P.gates) dgLabel(P,g); } ctx.lineWidth=1; }
// night: quay floodlights, berth lights, ship navigation lights, gate lamp (drawn after the night overlay)
let PGLOW=null; function portGlow(){ if(PGLOW) return PGLOW; const c=mkCanvas(64,64), g=c.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.25,'rgba(255,255,255,0.5)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,64,64); return PGLOW=c; }
function drawPortNight(vx0,vy0,vx1,vy1){ const K=typeof DN!=='undefined'?DN.dark:0; if(K<0.05) return; const G_=portGlow(); ctx.save(); ctx.globalCompositeOperation='lighter';
  const dot=(u,v,P,col,r,a)=>{ const w=PL(P,u,v), x=w[0]*TILE, y=w[1]*TILE; if(x<vx0-r||x>vx1+r||y<vy0-r||y>vy1+r) return; ctx.globalAlpha=a*K; ctx.fillStyle=col; ctx.drawImage(G_,x-r,y-r,2*r,2*r); };
  for(const P of portList()){ if(!P.ph) continue;
    if(portVisible(P,vx0,vy0,vx1,vy1)){ const q0=P.qy0||P.berths[0].y0, q1=P.qy1||P.berths[P.berths.length-1].y1; for(let v=q0+6;v<q1;v+=16) dot(-0.6,v,P,null,150,0.55);
      for(const [bv,occ] of [[P.vA,!!(P.cur&&P.cur.shA)],[P.vB,!!(P.cur&&P.cur.shB)]]) for(const e of [-14,14]) dot(-0.4,bv+e,P,null,34,1);
      for(const m of (P.masts||[])){ dot(m.u,m.v,P,null,200,0.13); dot(m.u,m.v,P,null,22,0.75); }
      if(P.gates) for(const g of P.gates){ dot(g.pu,g.pv,P,null,80,0.7); const w=PL(P,g.lu,g.lv); dgLamp(w[0]*TILE,w[1]*TILE,g.a>0.95,K); } }
    for(const o of (P.cur?P.cur.ships:[])){ const p=o.pose, f=[Math.cos(p.h),Math.sin(p.h)], l=[-f[1],f[0]];
      dot(p.u+f[0]*12,p.v+f[1]*12,P,null,26,1); dot(p.u-f[0]*11.5,p.v-f[1]*11.5,P,null,40,0.35); } }
  ctx.globalAlpha=1; ctx.restore();
  // ship night dressing (drawn above darkness, rain and fog): hull outline + glow, lit containers, deck floods, bridge windows, nav lights
  for(const P of portList()) for(const o of (P.cur?P.cur.ships:[])) if(o.s&&portShipVis(P,o,vx0,vy0,vx1,vy1)) shipNight(P,o,K);
  ctx.globalAlpha=1; }
function shipNight(P,o,K){ const T_=TILE, p=o.pose, s=o.s, L=SHIP.L*T_, W=SHIP.W*T_, G_=portGlow(), det=Math.sign(P.U[0]*P.V[1]-P.U[1]*P.V[0])||1;
  ctx.save(); portFrame(P); if(P.brg&&P.brg.length) portClipBridges(P); ctx.translate(p.u*T_,p.v*T_); ctx.rotate(p.h);
  const hull=()=>{ ctx.beginPath(); ctx.moveTo(-L/2+6,-W/2); ctx.lineTo(L/2-4*T_,-W/2); ctx.quadraticCurveTo(L/2-0.5*T_,-W/2,L/2,0); ctx.quadraticCurveTo(L/2-0.5*T_,W/2,L/2-4*T_,W/2); ctx.lineTo(-L/2+6,W/2); ctx.quadraticCurveTo(-L/2,W/2,-L/2,W/2-8); ctx.lineTo(-L/2,-W/2+8); ctx.quadraticCurveTo(-L/2,-W/2,-L/2+6,-W/2); ctx.closePath(); };
  // soft halo + crisp light outline so the hull shape reads on dark water
  ctx.globalCompositeOperation='lighter'; hull(); ctx.lineJoin='round'; ctx.strokeStyle='rgba(120,170,255,'+(0.22*K)+')'; ctx.lineWidth=14; ctx.stroke(); ctx.lineWidth=6; ctx.strokeStyle='rgba(150,195,255,'+(0.3*K)+')'; ctx.stroke();
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=0.55*K; hull(); ctx.fillStyle=s.hull; ctx.fill(); ctx.globalAlpha=1; hull(); ctx.strokeStyle='rgba(225,236,255,'+(0.85*K)+')'; ctx.lineWidth=2.2; ctx.stroke();
  // containers re-lit by the deck floods
  ctx.globalAlpha=0.7*K; for(let j=0;j<SHIP.N;j++){ const c=s.has[j]; if(c) drawBox(boxAx(j)*T_,0,3*T_-3,2.4*T_,c); } ctx.globalAlpha=1;
  ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(255,215,150,'+(0.16*K)+')'; ctx.fillRect(boxAx(0)*T_-1.6*T_,-1.4*T_,(boxAx(SHIP.N-1)-boxAx(0)+3.2)*T_,2.8*T_);
  // bridge house: lit and windowed
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=0.45*K; ctx.fillStyle='#ecf0f1'; ctx.fillRect(-L/2+0.6*T_,-W/2+8,2.8*T_,W-16); ctx.globalAlpha=1;
  ctx.shadowColor='rgba(255,210,120,1)'; ctx.shadowBlur=8; ctx.fillStyle='rgba(255,224,140,'+K+')';
  for(let y=-W/2+11;y<W/2-12;y+=5) ctx.fillRect(-L/2+3.0*T_,y,0.35*T_,3);   // forward-facing bridge windows
  for(let x=-L/2+1.0*T_;x<-L/2+2.9*T_;x+=5) for(const y of [-W/2+9,W/2-11]) ctx.fillRect(x,y,3,2);   // side windows
  ctx.shadowBlur=0;
  // deck flood posts along both rails
  ctx.globalCompositeOperation='lighter'; const glow=(x,y,r,a)=>{ ctx.globalAlpha=a*K; ctx.drawImage(G_,x-r,y-r,2*r,2*r); };
  for(let x=boxAx(0)*T_;x<=boxAx(SHIP.N-1)*T_+1;x+=6*T_) for(const y of [-W/2+3,W/2-3]) glow(x,y,26,0.55);
  // white masthead (forward + aft mast) and stern light
  ctx.globalAlpha=1; const lamp=(x,y,col,r,h)=>{ ctx.globalCompositeOperation='lighter'; glow(x,y,h,0.9); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=K; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.globalAlpha=1; };
  lamp(L/2-3.2*T_,0,'#ffffff',3,26); lamp(-L/2+1.6*T_,0,'#ffffff',2.6,16); lamp(-L/2+1,0,'#fff6e0',2.4,12);
  // sidelights: red to port, green to starboard (on the bridge wings)
  ctx.globalCompositeOperation='source-over'; for(const [sd0,col,hc] of [[-1,'#ff3b30','rgba(255,50,40,'],[1,'#34e070','rgba(40,230,100,']]){ const y=sd0*det*(W/2+1), x=-L/2+2.2*T_;
    const g=ctx.createRadialGradient(x,y,0,x,y,22); g.addColorStop(0,hc+(0.85*K)+')'); g.addColorStop(1,hc+'0)'); ctx.fillStyle=g; ctx.fillRect(x-22,y-22,44,44);
    ctx.globalAlpha=K; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,3.6,0,7); ctx.fill(); ctx.globalAlpha=1; }
  ctx.restore(); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; }
// world map: shipping lanes + live ships
function portBigMap(BX,BY,z){ if(typeof portMapTrucks==='function') portMapTrucks(BX,BY,z); for(const P of portList()){ if(!P.ph) continue; ctx.save(); ctx.setLineDash([5,5]); ctx.lineWidth=Math.max(1.5,z*0.8);
  for(const [q,col] of [[P.ph[0],'rgba(120,220,255,0.85)'],[P.ph[P.ph.length-1],'rgba(255,200,120,0.85)']]){ ctx.strokeStyle=col; ctx.beginPath(); q.pts.forEach((p,i)=>{ const w=PL(P,p[0],p[1]); i?ctx.lineTo(BX(w[0]),BY(w[1])):ctx.moveTo(BX(w[0]),BY(w[1])); }); ctx.stroke(); }
  ctx.setLineDash([]); ctx.save(); const O=[BX(P.O[0]),BY(P.O[1])]; ctx.transform(z*P.U[0],z*P.U[1],z*P.V[0],z*P.V[1],O[0],O[1]); const px=1/z;   // draw in port-local tiles
  const v0=P.qy0||P.berths[0].y0, v1=P.qy1||P.berths[P.berths.length-1].y1;
  if(z>=0.6){ ctx.fillStyle='rgba(255,255,255,0.85)'; for(const bv of [P.vA,P.vB]) for(const e of [-14,14]) ctx.fillRect(-1.2,bv+e-2*px,1.2,4*px);   // berth marks
    ctx.fillStyle='rgba(255,214,0,0.9)'; ctx.font='bold '+(11*px)+'px system-ui'; if(z>=1.5){ ctx.save(); ctx.textAlign='center'; ctx.fillText('BERTH A',-3,P.vA); ctx.fillText('BERTH B',-3,P.vB); ctx.restore(); }
    ctx.fillStyle='rgba(70,70,70,0.9)'; for(const ru of [P.legL,-1]) ctx.fillRect(ru-0.15,v0,0.3,v1-v0);   // crane rails
    for(const g of (P.rtg||[])){ ctx.fillStyle='rgba(255,214,0,0.25)'; ctx.fillRect(P.legL+0.2,g.v-1.1,P.tl1+0.7-P.legL,2.2); ctx.strokeStyle='#ffd400'; ctx.lineWidth=Math.max(1.5*px,0.35); ctx.strokeRect(P.legL+0.2,g.v-1.1,P.tl1+0.7-P.legL,2.2); }   // yard gantries
    for(const c of (P.cranes||[])){ const a0=Math.min(P.legL,-1)-0.3, a1=Math.max(P.legL,-1)+0.3, b0=Math.min(a0,P.dockU-3.5), b1=Math.max(a1,P.dockU+3.5); ctx.fillStyle='#c0392b'; ctx.fillRect(a0,c.y-1.1,a1-a0,2.2); ctx.fillStyle='#e74c3c'; ctx.fillRect(b0,c.y-0.45,b1-b0,0.9);   // quay crane portal + boom over the berth
      ctx.fillStyle='#2c3e50'; ctx.fillRect(c.u-0.6,c.y-0.6,1.2,1.2); if(c.car){ ctx.fillStyle=c.car; ctx.fillRect(c.u-0.5,c.y-1.4,1,2.8); } }
    for(const t of (P.tracs||[])){ const q=loopPos(P,t.s); ctx.fillStyle='#ffd400'; ctx.beginPath(); ctx.arc(q[0],q[1],0.9,0,7); ctx.fill(); }
    for(const l of (P.lors||[])){ if(l.x==null) continue; ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(l.h); ctx.fillStyle='#fff'; ctx.fillRect(-3.4,-0.5,4.9,1); ctx.restore(); }
    if(P.strad){ ctx.fillStyle='#e74c3c'; ctx.fillRect(P.blkU[0]-1.2,P.strad.v-1,3.4,2); }
    if(P.fenceL){ ctx.strokeStyle='rgba(230,230,230,0.9)'; ctx.lineWidth=Math.max(1.5*px,0.25); ctx.setLineDash([4*px,3*px]); ctx.beginPath(); for(const q of P.fenceL){ ctx.moveTo(q[0],q[1]); ctx.lineTo(q[2],q[3]); } ctx.stroke(); ctx.setLineDash([]); }
    for(const g of (P.gates||[])){ ctx.fillStyle=g.a>0.95?'#2ecc71':'#e74c3c'; ctx.beginPath(); ctx.arc(g.pu,g.pv,Math.max(5*px,0.8),0,7); ctx.fill(); if(z>=1){ ctx.save(); ctx.font='bold '+(10*px)+'px system-ui'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText(g.name,g.pu-2.2,g.pv+4*px); ctx.restore(); } } }
  for(const o of (P.cur?P.cur.ships:[])){ const p=o.pose, L=SHIP.L, W=SHIP.W; ctx.save(); ctx.translate(p.u,p.v); ctx.rotate(p.h);
    ctx.beginPath(); ctx.moveTo(-L/2,-W/2); ctx.lineTo(L/2-4,-W/2); ctx.quadraticCurveTo(L/2-0.5,-W/2,L/2,0); ctx.quadraticCurveTo(L/2-0.5,W/2,L/2-4,W/2); ctx.lineTo(-L/2,W/2); ctx.closePath();
    ctx.fillStyle=(o.s&&o.s.hull)||'#1f3a5f'; ctx.fill(); ctx.lineWidth=Math.max(2*px,0.3); ctx.strokeStyle=nmK()>0.3?'#e6f0ff':'#0b1626'; ctx.stroke();
    ctx.fillStyle='#4b5157'; ctx.fillRect(boxAx(0)-1.6,-1.4,boxAx(SHIP.N-1)-boxAx(0)+3.2,2.8); ctx.fillStyle='#ecf0f1'; ctx.fillRect(-L/2+0.6,-W/2+0.5,2.8,W-1);
    if(o.s) for(let j=0;j<SHIP.N;j++){ const c=o.s.has[j]; if(c){ ctx.fillStyle=c; ctx.fillRect(boxAx(j)-1.4,-1.2,2.8,2.4); } }
    if(nmK()>0.3){ ctx.fillStyle='#ff3b30'; ctx.beginPath(); ctx.arc(-L/2+2.2,-W/2,Math.max(2.5*px,0.4),0,7); ctx.fill(); ctx.fillStyle='#34e070'; ctx.beginPath(); ctx.arc(-L/2+2.2,W/2,Math.max(2.5*px,0.4),0,7); ctx.fill(); }
    ctx.restore(); }
  ctx.restore();
  ctx.restore(); } }
// ===================== v26 port logistics: ocean lanes -> unload berth -> shift -> export berth -> ocean =====================
// Ships follow a fixed timetable that is a pure function of the game clock (railTime), so they can never overlap and reload in place.
// Quay cranes swap boxes with terminal tractors running a one-way loop under the portal; tractors feed two marked stack blocks
// (IMPORT / EXPORT). A rubber-tyred yard gantry over each block swaps boxes between the stacks, the tractors and road lorries on the
// one-way lorry lane (gate at the entry end).
const SHIP={L:28,W:5,N:6,PER:300,TA:200,TB:190,TSIDE:34,VIN:2.6,VOUT:2.4};
// dock vehicles yield to the player: true when the truck (or its trailer) is within `look` tiles ahead in a 1.7-tile-wide corridor
function portPlayerAhead(P,u,v,h,look){ const w=PL(P,u,v), c=Math.cos(h), sn=Math.sin(h), d=[P.U[0]*c+P.V[0]*sn,P.U[1]*c+P.V[1]*sn], pts=[[truck.x,truck.y]]; if(truck.trl) pts.push([truck.trl.x,truck.trl.y]);
  if(typeof truckPts==='function'){ try{ for(const q of truckPts()) pts.push(q); }catch(e){} }
  let best=1e9; for(const q of pts){ const rx=q[0]/M_T-w[0], ry=q[1]/M_T-w[1], a=rx*d[0]+ry*d[1], lat=Math.abs(rx*d[1]-ry*d[0]); if(a>-1&&a<look&&lat<2.4&&a<best) best=a; }
  if(truck.trl){ const t=truck.trl, f=fwd(t.th||0); for(let k=-4;k<=4;k++){ const rx=(t.x+f[0]*k*1.6)/M_T-w[0], ry=(t.y+f[1]*k*1.6)/M_T-w[1], a=rx*d[0]+ry*d[1], lat=Math.abs(rx*d[1]-ry*d[0]); if(a>-1&&a<look&&lat<2.2&&a<best) best=a; } }
  return best; }
function lorPose(P,s){ const a=polyAt(P.lpath,s+0.9), b=polyAt(P.lpath,s-0.4), h=polyAt(P.lpath,s); return [h[0],h[1],Math.atan2(a[1]-b[1],a[0]-b[0])]; }   // fifth wheel + cab heading from front/rear axle points
function artic(o,x,y,h,WB){ if(o.ax==null){ o.ax=x-Math.cos(h)*WB; o.ay=y-Math.sin(h)*WB; } let dx=x-o.ax, dy=y-o.ay; const l=Math.hypot(dx,dy)||1; o.ax=x-dx/l*WB; o.ay=y-dy/l*WB; o.th=Math.atan2(dy,dx); }   // trailer axle trails the hitch (tractrix)
// gate lorries on the public road: world-metre body points (cab front .. trailer rear)
function portLorryPts(P,l){ if(l.x==null) return []; const out=[]; const c=PL(P,l.x,l.y); const ch=[P.U[0]*Math.cos(l.h)+P.V[0]*Math.sin(l.h),P.U[1]*Math.cos(l.h)+P.V[1]*Math.sin(l.h)], tt=[P.U[0]*Math.cos(l.th??l.h)+P.V[0]*Math.sin(l.th??l.h),P.U[1]*Math.cos(l.th??l.h)+P.V[1]*Math.sin(l.th??l.h)];
  for(const k of [1.5,0.6]) out.push([(c[0]+ch[0]*k)*M_T,(c[1]+ch[1]*k)*M_T]); for(const k of [0,-1.1,-2.2,-3.4]) out.push([(c[0]+tt[0]*k)*M_T,(c[1]+tt[1]*k)*M_T]); return out; }
// AI traffic ahead of a gate lorry (tiles along heading), narrow corridor = own lane only
function portTrafficAhead(P,u,v,h,look){ if(typeof traffic==='undefined') return 1e9; const w=PL(P,u,v), c=Math.cos(h), sn=Math.sin(h), d=[P.U[0]*c+P.V[0]*sn,P.U[1]*c+P.V[1]*sn]; let best=1e9;
  for(const o of traffic.vs){ const rx0=o.x/M_T-w[0], ry0=o.y/M_T-w[1]; if(rx0*rx0+ry0*ry0>(look+4)*(look+4)) continue; const f=fwd(o.h||0), hl=(o.L||4.6)/2/M_T;
    for(const k of [-hl,0,hl]){ const rx=rx0+f[0]*k, ry=ry0+f[1]*k, a=rx*d[0]+ry*d[1], lat=Math.abs(rx*d[1]-ry*d[0]); if(a>-0.5&&a<look&&lat<0.75&&a<best) best=a; } }
  return best; }
// AI cars brake for gate lorries (chained onto the traffic stop-hook, so traffic.js stays untouched)
function portLorryAcc(v,v0){ if(v.h===undefined) return 1e9; let acc=1e9; const d=fwd(v.h);
  const bodies=[]; for(const P of portList()) for(const l of (P.lors||[])) if(l.x!=null) for(const q of portLorryPts(P,l)) bodies.push(q); if(typeof ptBodies==='function') for(const q of ptBodies()) bodies.push(q);
  { { for(const q of bodies){ const rx=q[0]-v.x, ry=q[1]-v.y; if(rx*rx+ry*ry>60*60) continue;
      const a=rx*d[0]+ry*d[1], lat=Math.abs(rx*d[1]-ry*d[0]); if(a<0||lat>2.3) continue; const gap=a-(v.L||4.6)/2-1.2; acc=Math.min(acc,idmAcc(v,v0,Math.max(0.1,gap),0)); } } }
  return acc; }
function portHookTraffic(){ if(portHookTraffic.done||typeof railStopAcc!=='function') return; portHookTraffic.done=1; const base=railStopAcc; railStopAcc=function(v,v0){ return Math.min(base(v,v0),portLorryAcc(v,v0)); }; }
function portT(){ return typeof railTime==='function'?railTime():timeS; }
function pHash(k){ let x=(k*2654435761)^0x9e3779b9; x=Math.imul(x^(x>>>15),2246822507); x=Math.imul(x^(x>>>13),3266489909); return ((x^(x>>>16))>>>0)/4294967296; }
function portCfg(P){
  const kb=P===world.kbPort, L=P.legL;
  const C=kb?{vA:1600,vB:1690,ex:1,inP:[[190,1770],[60,1770],[40,1768],[26,1755],[21,1738],[20,1720],[20,1600]],outT:[[33,1740],[42,1752],[60,1752],[190,1752]],
      lor:[1740,1551],appr:[[1805,1868.6],[1751,1868.6],[1748,1870.5],[1745.5,1875],[1743,1876.8]],dpth:[[1549,1877],[1545,1876],[1540,1871],[1532,1868.6],[1470,1868.6]],impV:[1615,1645],expV:[1647,1677],chan:[1730,1928,1790,2000],piers:[1740,1761,1781],off:137,tracN:7}
    :{vA:385,vB:300,ex:-1,inP:[[185,-40],[185,168],[150,200],[90,228],[40,250],[21,264],[20,280],[20,385]],outT:[[33,240],[70,206],[160,170],[160,-40]],
      lor:[293,388],appr:[[540,286.4],[578,286.4],[584,287.5],[587.3,290.4]],dpth:[[587.6,391],[584.5,394.6],[578,395.4],[540,395.4]],impV:[350,380],expV:[316,346],chan:[700,60,830,140],piers:[748,772,798],off:0,tracN:8};
  Object.assign(P,C); const hs=-C.ex; P.hs=hs; P.dockU=3.6;
  // lanes inside the crane portal (u from landside leg to waterside leg): lorry lane | 2-col stack block | tractor lane 1 | tractor lane 2
  P.lorU=L+2.7; P.blkU=[L+4.4,L+5.8]; P.tl1=L+7.6; P.tl2=kb?-1.9:L+10.8;   // dg: roomier (fence at L+1..L+2) P.cap=16; P.ecap=16;
  P.blocks=[[L+3.7,C.impV[0],2.8,C.impV[1]-C.impV[0]],[L+3.7,C.expV[0],2.8,C.expV[1]-C.expV[0]]];
  P.slots=[]; for(const V of [C.impV,C.expV]) for(let r=0;r<8;r++) for(const u of P.blkU) P.slots.push([u,V[0]+1.8+r*3.6]);
  P.impC=(C.impV[0]+C.impV[1])/2; P.expC=(C.expV[0]+C.expV[1])/2;
  P.stock=0; P.ex=10; P.resImp=0; P.exRes=0; P.impClaim=0; P.sent=0; P.recv=0; P.unl=0; P.ld=0; P.shipsDone=0; P.lorT=3;
  P.loadT=4; P.aiT=6+Math.random()*6; P.virtT=30; P.lc=null;
  // ship timeline
  const ph=[]; const poly=(pts,sp,ease)=>{ const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); const len=cum[cum.length-1]; return {pts,cum,len,dur:len/sp*1.25,ease}; };
  ph.push(Object.assign({k:'in'},poly(C.inP,SHIP.VIN,'out')));
  ph.push({k:'sideIn',a:[20,C.vA],b:[P.dockU,C.vA],dur:SHIP.TSIDE});
  ph.push({k:'dockA',a:[P.dockU,C.vA],dur:SHIP.TA});
  const shL=Math.abs(C.vB-C.vA); ph.push({k:'shift',a:[P.dockU,C.vA],b:[P.dockU,C.vB],dur:shL/1.1});
  ph.push({k:'dockB',a:[P.dockU,C.vB],dur:SHIP.TB});
  ph.push({k:'sideOut',a:[P.dockU,C.vB],b:[17,C.vB],dur:SHIP.TSIDE*0.8});
  const arc=[]; for(let i=0;i<=12;i++){ const f=i/12*Math.PI; arc.push([25-8*Math.cos(f),C.vB+hs*8*Math.sin(f)]); }
  ph.push(Object.assign({k:'out'},poly(arc.concat(C.outT),SHIP.VOUT,'in')));
  let t=0; for(const q of ph){ q.t0=t; t+=q.dur; } P.ph=ph; P.Ltot=t; P.sh=new Map();
  P.tA0=ph[2].t0; P.tA1=ph[3].t0; P.tB0=ph[4].t0; P.tB1=ph[5].t0;
  // cranes: 2 on the unload berth, the rest on the export berth; each works one half of the single row of boxes
  // v32: exactly ONE import crane (berth A) and ONE export crane (berth B)
  if(P.cranes.length>2) P.cranes=[P.cranes[0],P.cranes[P.cranes.length-1]];
  const nc=P.cranes.length; P.cranes.forEach((c,i)=>{ const A=i<1; c.role=A?'A':'B'; const gi=A?i:i-1, n=1;
    c.idx=n===1?[0,1,2,3,4,5]:(gi===0?[0,1,2]:[5,4,3]); const bv=A?C.vA:C.vB; c.home=bv+hs*(n===1?0:(gi===0?-12:12)); c.y=c.home; c.u=P.tl1; c.ph=0; c.w=0; c.car=null; c.hz=1; c.job=null; c.trac=null; });
  // tractor loop
  const vs=[C.vA,C.vB,P.impC,P.expC]; P.lv0=Math.min(...vs)-16; P.lv1=Math.max(...vs)+16; P.lLv=P.lv1-P.lv0; P.lTn=Math.PI*Math.abs(P.tl2-P.tl1)/2; P.lLen=2*P.lLv+2*P.lTn;
  P.tracs=[]; for(let i=0;i<C.tracN;i++) P.tracs.push({id:i,s:i*P.lLen/C.tracN,box:null,task:null,mv:0,still:0,col:['#f1c40f','#e67e22','#3498db','#2ecc71','#ecf0f1','#e84393'][i%6]});
  P.rtg=[{blk:0,v:P.impC,q:[],cur:null,t:0,su:P.blkU[0]},{blk:1,v:P.expC,q:[],cur:null,t:0,su:P.blkU[0]}];
  P.lors=[]; P.laneDir=Math.sign(C.lor[1]-C.lor[0]); P.laneLen=Math.abs(C.lor[1]-C.lor[0]);
  // gate lorry path in local tiles: public road -> curve -> gate lane -> curve -> public road (Chaikin-smoothed, arc-length sampled)
  { const loc=w=>portLocal(P,w[0],w[1]); let pts=[...C.appr.map(loc),[P.lorU,C.lor[0]],[P.lorU,C.lor[1]],...C.dpth.map(loc)];
    for(let it=0;it<4;it++){ const q=[pts[0]]; for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; q.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]); } q.push(pts[pts.length-1]); pts=q; }
    const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); P.lpath={pts,cum,len:cum[cum.length-1]};
    let bi=0,bd=1e9; pts.forEach((p,i)=>{ const d=Math.hypot(p[0]-P.lorU,p[1]-C.lor[0]); if(d<bd){ bd=d; bi=i; } }); P.lpre=cum[bi]; P.lpost=P.lpath.len-P.lpre-P.laneLen; P.lspawn=PL(P,...pts[0]); }
  // straddle carrier + quay workers (ambient life)
  P.strad={v:C.impV[0],dir:1,box:null,w:0}; P.wk=[];   // dg: no pedestrians inside the docks
  // bridge tiles over the channel (ships draw beneath them)
  P.brg=[]; const ch=C.chan; for(let y=ch[1];y<ch[3];y++){ let x0=-1; for(let x=ch[0];x<=ch[2];x++){ const b=x<ch[2]&&get(x,y)===T.BRIDGE; if(b&&x0<0) x0=x; if(!b&&x0>=0){ P.brg.push(portRectL(P,x0,y,x-x0,1)); x0=-1; } } }
  portBridgeWorld(P); P.brgBox=null; if(P.brg.length){ let a=[1e9,1e9,-1e9,-1e9]; for(const r of P.brg){ a[0]=Math.min(a[0],r[0]); a[1]=Math.min(a[1],r[1]); a[2]=Math.max(a[2],r[0]+r[2]); a[3]=Math.max(a[3],r[1]+r[3]); } P.brgBox=a; } }
function portRectL(P,x,y,w,h){ const a=portLocal(P,x,y), b=portLocal(P,x+w,y+h); return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])]; }
function craneFree(P,c,v){ return !P.cranes.some(o=>o!==c&&(Math.abs(o.y-v)<5.6||Math.abs(o.tv-v)<5.6)); }
function portLocal(P,x,y){ const dx=x-P.O[0], dy=y-P.O[1]; return [dx*P.U[0]+dy*P.U[1], dx*P.V[0]+dy*P.V[1]]; }
function polyAt(q,s){ const c=q.cum; s=Math.max(0,Math.min(q.len,s)); let i=1; while(i<c.length-1&&c[i]<s) i++; const f=(s-c[i-1])/((c[i]-c[i-1])||1), a=q.pts[i-1], b=q.pts[i]; return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]; }
// pose of a ship tl seconds into its cycle, in local (u,v) + heading
function shipPose(P,tl){ const ph=P.ph; let q=ph[0]; for(const p of ph) if(tl>=p.t0) q=p; const f=Math.max(0,Math.min(1,(tl-q.t0)/q.dur)); const H=Math.atan2(P.hs,0);
  if(q.cum){ const g=q.ease==='out'?1-Math.pow(1-f,1.7):Math.pow(f,1.7), s=g*q.len, p=polyAt(q,s); const a=polyAt(q,s-2), b=polyAt(q,s+2); let h=Math.atan2(b[1]-a[1],b[0]-a[0]);
    // blend heading at the joins so it never snaps
    if(q.k==='out'&&s<2) h=H; if(q.k==='in'&&s>q.len-2) h=H; return {u:p[0],v:p[1],h,k:q.k,f}; }
  const a=q.a, b=q.b||q.a, e=f*f*(3-2*f); return {u:a[0]+(b[0]-a[0])*e,v:a[1]+(b[1]-a[1])*e,h:H,k:q.k,f}; }
function portShips(P,t){ const o=[]; const k1=Math.floor((t-P.off)/SHIP.PER), k0=Math.floor((t-P.off-P.Ltot)/SHIP.PER)+1; for(let k=k0;k<=k1;k++){ const tl=t-(P.off+k*SHIP.PER); if(tl<0||tl>=P.Ltot) continue; o.push({k,tl,pose:shipPose(P,tl)}); } return o; }
const SHIP_HULL=['#1f4e79','#7b241c','#145a32','#4a235a','#2c3e50','#6e2c00'];
function shipState(P,k,tl){ let s=P.sh.get(k); if(s) return s; const r=n=>pHash(k*31+n);
  s={k,hull:SHIP_HULL[(r(1)*6)|0],name:['ALBION STAR','NORTH SEA','MERIDIAN','KESTREL','SOUND TRADER','GREYFELL','HIGHMOOR','REDLINE'][(r(2)*8)|0],has:[],horn:0};
  const full=tl<P.tA0, loaded=tl>=P.tB0; for(let j=0;j<SHIP.N;j++) s.has.push(full||loaded?YARD_COLS[(r(10+j)*8)|0]:null);
  if(!full) s.done=1; P.sh.set(k,s); return s; }
const boxAx=j=>-7.4+3.25*j;               // box centre along the ship axis (tiles from midships, + = bow)
function portHorn(P,u,v){ try{ if(!audio||!audio.ctx||!(SETTINGS.vol>0)) return; const w=PL(P,u,v); if(Math.hypot(w[0]*M_T-truck.x,w[1]*M_T-truck.y)>700) return;
  chirp(98,92,2.2,0.22,'sawtooth'); chirp(147,139,2.2,0.12,'sawtooth'); setTimeout(()=>{ try{ chirp(98,94,1.2,0.2,'sawtooth'); chirp(147,141,1.2,0.1,'sawtooth'); }catch(e){} },2600); }catch(e){} }
// ---- tractor loop geometry
function loopPos(P,s){ const L=P.lLv, Tn=P.lTn, R=Math.abs(P.tl2-P.tl1)/2, um=(P.tl1+P.tl2)/2, sg=Math.sign(P.tl2-P.tl1); s=((s%P.lLen)+P.lLen)%P.lLen;
  if(s<L) return [P.tl1,P.lv0+s,Math.PI/2]; s-=L;
  if(s<Tn){ const a=s/R; return [um-sg*R*Math.cos(a),P.lv1+R*Math.sin(a),Math.PI/2+sg*a]; } s-=Tn;
  if(s<L) return [P.tl2,P.lv1-s,-Math.PI/2]; s-=L; const a=s/R; return [um+sg*R*Math.cos(a),P.lv0-R*Math.sin(a),-Math.PI/2+sg*a]; }
function loopFwd(P,from,to){ return ((to-from)%P.lLen+P.lLen)%P.lLen; }
function loopStop(P,v,lane1Only,from){ const a=v-P.lv0, b=P.lLv+P.lTn+(P.lv1-v); if(lane1Only) return a; return loopFwd(P,from,a)<loopFwd(P,from,b)?a:b; }
function updatePortLogistics(P,dt,t){ const ships=portShips(P,t); let shA=null, shB=null;
  for(const o of ships){ const s=shipState(P,o.k,o.tl); o.s=s; const k=o.pose.k;
    if(k==='dockA'||k==='sideIn') shA={s,rem:P.tA1-o.tl,pre:k!=='dockA'}; if(k==='dockB'||k==='shift') shB={s,rem:P.tB1-o.tl,pre:k!=='dockB'};
    if(k==='sideOut'&&!s.topped){ s.topped=1; for(let j=0;j<SHIP.N;j++) if(!s.has[j]){ s.has[j]=YARD_COLS[(pHash(o.k*7+j)*8)|0]; P.ex=Math.max(0,P.ex-1); P.ld++; P.topUp=(P.topUp||0)+1; } }   // dg: export ships always sail full
    if(k==='sideIn'&&!(s.horn&1)){ s.horn|=1; portHorn(P,o.pose.u,o.pose.v); } if(k==='out'&&!(s.horn&2)){ s.horn|=2; portHorn(P,o.pose.u,o.pose.v); P.shipsDone++; } }
  for(const k of P.sh.keys()) if(!ships.some(o=>o.k===k)) P.sh.delete(k);
  P.cur={ships,shA,shB};
  if(shB&&P.ex+P.exRes<SHIP.N){ P.ex=SHIP.N-P.exRes; }
  // ---- quay cranes
  for(const c of P.cranes){ const B=c.role==='A'?shA:shB; const tv=c.trac&&c.trac.box&&c.role==='B'?c.tv:null;
    if(c.ph===0&&c.job==null){ c.trac=c.trac&&c.trac.task&&c.trac.task.crane===c?c.trac:null;
      if(B&&c.role==='A'&&B.rem>20&&P.stock+P.resImp<P.cap){ const j=c.idx.find(j=>B.s.has[j]&&craneFree(P,c,P.vA+P.hs*boxAx(j))); if(j!=null){ c.job=j; } }
      if(B&&c.role==='B'&&B.rem>26){ const j=c.idx.find(j=>!B.s.has[j]&&!P.cranes.some(o=>o!==c&&o.job===j&&o.role==='B')&&craneFree(P,c,P.vB+P.hs*boxAx(j))); if(j!=null&&(c.trac||P.ex>0)) c.job=j; }
      if(c.job==null&&c.trac){ const t=c.trac; if(c.role==='A'){ if(!t.box) t.task=null; } else if(t.task&&t.task.need) t.task.cancel=1; else t.task=t.box?{k:'retExp'}:null; c.trac=null; } }
    const sv=B?null:null; const shipV=(c.role==='A'?P.vA:P.vB);
    c.tv=c.job!=null?shipV+P.hs*boxAx(c.job):c.home;
    // gantry travel, never closer than 5.4 tiles to another crane
    const d=c.tv-c.y, st=Math.sign(d)*Math.min(Math.abs(d),dt*2.4), ny=c.y+st; if(!P.cranes.some(o=>o!==c&&Math.abs(o.y-ny)<5.4&&Math.abs(o.y-ny)<Math.abs(o.y-c.y))) c.y=ny;
    const at=Math.abs(c.y-c.tv)<0.05, tr=c.trac, trAt=tr&&tr.stop!=null&&tr.atStop&&tr.task&&tr.task.crane===c, landU=tr?loopPos(P,tr.s)[0]:P.tl1;
    const mvU=(u,sp)=>{ const e=u-c.u; c.u+=Math.sign(e)*Math.min(Math.abs(e),dt*(sp||5)); return Math.abs(e)<0.03; };
    if(c.role==='A'){
      if(c.ph===0){ if(c.job!=null&&at){ if(!B||!B.s.has[c.job]){ c.job=null; } else if(!B.pre&&mvU(P.dockU)){ c.ph=1; c.w=0; } } else mvU(P.tl1+1,3); }
      else if(c.ph===1){ c.w+=dt; c.hz=Math.abs(1-c.w/0.9); if(c.w>=0.9&&!c.car&&B&&B.s.has[c.job]){ c.car=B.s.has[c.job]; B.s.has[c.job]=null; P.resImp++; } if(c.w>=1.8){ c.hz=1; c.ph=c.car?2:0; if(!c.car) c.job=null; } }
      else if(c.ph===2){ if(mvU(landU)&&trAt&&Math.abs(c.u-landU)<0.05){ c.ph=3; c.w=0; } }
      else if(c.ph===3){ if(!trAt){ c.ph=2; } else { c.w+=dt; c.hz=Math.abs(1-c.w/0.8); if(c.w>=0.8&&c.car){ tr.box=c.car; c.car=null; P.unl++; P.landed++; tr.task={k:'toImp'}; c.trac=null; } if(c.w>=1.6){ c.hz=1; c.ph=0; c.job=null; } } } }
    else {
      if(c.ph===0){ if(c.job!=null&&at&&trAt&&tr.box&&B&&B.rem>10){ if(mvU(landU)){ c.ph=1; c.w=0; } } else if(c.job!=null&&(!B||B.rem<14)&&!c.car){ c.job=null; if(tr&&tr.task&&tr.task.crane===c){ if(tr.task.need) tr.task.cancel=1; else tr.task=tr.box?{k:'retExp'}:null; } c.trac=null; } else mvU(c.job!=null&&at?landU:P.tl1+1,3); }
      else if(c.ph===1){ if(!trAt){ c.ph=0; } else { c.w+=dt; c.hz=Math.abs(1-c.w/0.8); if(c.w>=0.8&&!c.car&&tr.box){ c.car=tr.box; tr.box=null; tr.task=null; c.trac=null; P.exRes--; } if(c.w>=1.6){ c.hz=1; c.ph=2; } } }
      else if(c.ph===2){ if(B&&!B.pre&&mvU(P.dockU)){ c.ph=3; c.w=0; } }
      else if(c.ph===3){ c.w+=dt; c.hz=Math.abs(1-c.w/0.9); if(c.w>=0.9&&c.car){ if(B&&B.s.has[c.job]==null) B.s.has[c.job]=c.car; c.car=null; P.ld++; } if(c.w>=1.8){ c.hz=1; c.ph=0; c.job=null; } } } }
  // ---- dispatch idle tractors
  for(const c of P.cranes){ if(c.job==null||c.trac) continue; if(c.role==='B'&&P.ex<=0) continue; let best=null, bd=1e9;
    for(const tr of P.tracs){ if(tr.task||tr.box) continue; const d=loopFwd(P,tr.s,loopStop(P,c.role==='A'?c.tv:P.expC,c.role==='B',tr.s)); if(d<bd){ bd=d; best=tr; } }
    if(best){ best.task={k:c.role==='A'?'imp':'exp',crane:c}; c.trac=best; if(c.role==='B'){ P.ex--; P.exRes++; best.task.need=1; } } }
  // ---- tractor movement on the one-way loop (keep 4.6 tiles behind the one ahead)
  const TR=P.tracs; for(const tr of TR){ let tgt=null, k=tr.task&&tr.task.k;
    if(k==='imp') tgt=loopStop(P,tr.task.crane.tv,false,tr.s);
    else if(k==='exp') tgt=tr.task.need?loopStop(P,P.expC,true):loopStop(P,tr.task.crane.tv,false,tr.s);
    else if(k==='toImp') tgt=loopStop(P,P.impC,true); else if(k==='retExp') tgt=loopStop(P,P.expC,true);
    tr.stop=tgt; const dist=tgt==null?1e9:loopFwd(P,tr.s,tgt); let gap=1e9; for(const o of TR) if(o!==tr){ const g=loopFwd(P,tr.s,o.s); if(g>0.01&&g<gap) gap=g; }
    const tq=loopPos(P,tr.s), pa=portPlayerAhead(P,tq[0],tq[1],tq[2],6); tr.yield=pa<6; const vmax=tgt==null?1.6:Math.min(6,0.3+dist*1.0), mv=Math.max(0,Math.min(vmax*dt,dist<0.04?0:dist,gap-4.6,tr.yield?Math.max(0,(pa-2.6)*dt):1e9)); tr.atStop=dist<0.05;
    tr.s=(tr.s+mv)%P.lLen; tr.mv=mv/dt; { const a=loopPos(P,tr.s+0.6), b=loopPos(P,tr.s-0.2), h=loopPos(P,tr.s); tr.h=Math.atan2(a[1]-b[1],a[0]-b[0]); tr.th=tr.h; } if(mv>0.001||!tr.task||tr.atStop) tr.still=0; else tr.still+=dt;
    // stack hand-offs at the transfer row by the yard gantries
    if(tr.atStop&&(k==='toImp'||k==='retExp'||(k==='exp'&&tr.task.need))&&!tr.rq){ tr.rq=1; P.rtg[k==='toImp'?0:1].q.push({veh:tr,kind:k==='toImp'?'tDrop':k==='retExp'?'tRet':'tPick',u:P.tl1}); } }
  // ---- lorry lane (gate -> export block -> import block -> exit)
  dgUpdate(P,dt); P.lorT-=dt; const pE=Math.abs(P.expC-P.lor[0]), pI=Math.abs(P.impC-P.lor[0]);
  if(P.lorT<=0&&typeof PTRUCK==='undefined'){ P.lorT=7; const sx=P.lspawn[0]*TILE-cam.x, sy=P.lspawn[1]*TILE-cam.y, seen=Math.abs(sx)<VW/2/cam.z+120&&Math.abs(sy)<VH/2/cam.z+120; const busy=typeof traffic!=='undefined'&&traffic.vs.some(o=>Math.hypot(o.x/M_T-P.lspawn[0],o.y/M_T-P.lspawn[1])<12); if(seen||busy) P.lorT=2; else if(P.lors.length<4&&!P.lors.some(l=>l.p<-P.lpre+12)){ const pend=P.lors.filter(l=>l.box&&!l.dropped).length;
      if(P.ex+P.exRes+pend<P.ecap-2&&(Math.random()<0.55||P.stock-P.impClaim<=0)) P.lors.push({p:-P.lpre,box:YARD_COLS[(Math.random()*8)|0],kind:'exp',w:0,still:0,col:['#d63b2f','#2e86c1','#f4f6f7','#27ae60','#f39c12'][(Math.random()*5)|0]});
      else if(P.stock-P.impClaim>0){ P.impClaim++; P.lors.push({p:-P.lpre,box:null,kind:'imp',claim:1,w:0,still:0,col:['#d63b2f','#2e86c1','#f4f6f7','#27ae60','#f39c12'][(Math.random()*5)|0]}); } } }
  const LS=P.lors.slice().sort((a,b)=>b.p-a.p);
  for(let i=0;i<LS.length;i++){ const l=LS[i], ahead=i?LS[i-1].p:1e9; let tgt=P.laneLen+P.lpost; if(l.truck&&!l.box&&!l.claim&&P.stock-P.impClaim>0){ l.claim=1; P.impClaim++; }   // hauliers wait in the loading slot until the ship's boxes reach the stack
    if(l.kind==='exp'&&l.box&&!l.dropped) tgt=pE; else if((l.claim||l.truck)&&!l.box&&!l.loaded) tgt=pI;
    const lp0=lorPose(P,l.p+P.lpre), dist=tgt-l.p, pa=Math.min(portPlayerAhead(P,lp0[0],lp0[1],lp0[2],8),portTrafficAhead(P,lp0[0]+Math.cos(lp0[2])*1.5,lp0[1]+Math.sin(lp0[2])*1.5,lp0[2],7)+1.5); l.yield=pa<8; const gs=dgStop(P,l); const mv=Math.max(0,Math.min(dt*Math.min(3.2,0.3+Math.max(0,dist,0)*0.8,0.3+gs*0.8),Math.max(0,dist),gs,ahead-l.p-5.6,l.yield?Math.max(0,(pa-3.4)*dt):1e9)); l.p+=mv; l.mv=mv/dt; { const q=lorPose(P,l.p+P.lpre); l.x=q[0]+(l.ox||0); l.y=q[1]+(l.oy||0); l.h=q[2]; artic(l,l.x,l.y,q[2],2.75); } l.at=Math.abs(dist)<0.05;
    if(mv>0.001||l.at) l.still=0; else l.still+=dt;
    if(l.at&&!l.rq){ if(tgt===pE){ l.rq=1; P.rtg[1].q.push({veh:l,kind:'lDrop',u:P.lorU}); } else if(tgt===pI&&l.claim){ l.rq=1; P.rtg[0].q.push({veh:l,kind:'lLoad',u:P.lorU}); } }
    if(l.at&&tgt===pI&&!l.box){ l.w+=dt; if(l.w>70&&!l.truck&&P.rtg[0].cur?.veh!==l){ P.rtg[0].q=P.rtg[0].q.filter(j=>j.veh!==l); l.claim=0; P.impClaim--; l.rq=0; } } }
  for(let i=P.lors.length-1;i>=0;i--) if(!P.lors[i].truck&&P.lors[i].p>=P.laneLen+P.lpost-0.5){ const l=P.lors[i]; P.lors.splice(i,1); if(l.box) P.sent++; }
  // ---- yard gantries (one lift at a time, FIFO)
  for(const g of P.rtg){ if(!g.cur&&g.q.length){ for(let qi=0;qi<g.q.length;qi++){ const j=g.q[qi];
      const ok=j.kind==='tDrop'?P.stock<P.cap:j.kind==='tPick'?true:j.kind==='tRet'?true:j.kind==='lDrop'?P.ex+P.exRes<P.ecap:j.kind==='lLoad'?P.stock>0:true; if(ok){ g.cur=j; g.q.splice(qi,1); g.t=0; break; } } }
    const tv=g.blk?P.expC:P.impC; g.v+= Math.sign(tv-g.v)*Math.min(Math.abs(tv-g.v),dt);
    if(!g.cur){ g.su+= (P.blkU[0]-g.su)*Math.min(1,dt*2); g.car=null; continue; }
    const j=g.cur, src=(j.kind==='tDrop'||j.kind==='tRet'||j.kind==='lDrop')?j.u:P.blkU[1], dst=src===j.u?P.blkU[1]:j.u; g.t+=dt; const T1=1.4,T2=3.4,T3=4.8,T4=6.2;
    if(g.t<T1){ g.su+=(src-g.su)*Math.min(1,dt*4); g.hz=1-g.t/T1; }
    else if(!g.car&&g.t<T2){ g.car=1;
      if(j.kind==='tDrop'||j.kind==='tRet'||j.kind==='lDrop'){ g.col=j.veh.box; j.veh.box=null; } else { g.col=YARD_COLS[(P.stock*5+3)%8]; if(j.kind==='lLoad'){ P.stock--; P.impClaim--; j.veh.claim=0; P.collected=(P.collected||0)+1; } else { /* tPick: ex already reserved at dispatch */ } } }
    if(g.t>=T1&&g.t<T3){ g.su+=(dst-g.su)*Math.min(1,dt*1.6); g.hz=Math.min(1,(g.t-T1)/1); }
    if(g.t>=T3) g.hz=Math.max(0,1-(g.t-T3)/(T4-T3));
    if(g.t>=T4){ const v=j.veh; v.rq=0;
      if(j.kind==='tDrop'){ P.stock++; P.resImp--; v.task=null; P.yIn=(P.yIn||0)+1; } else if(j.kind==='tRet'){ P.ex++; P.exRes--; v.task=null; }
      else if(j.kind==='lDrop'){ P.ex++; P.recv++; v.dropped=1; if(P.stock-P.impClaim>0&&Math.random()<0.6){ v.claim=1; P.impClaim++; } }
      else if(j.kind==='lLoad'){ v.box=g.col; } else if(j.kind==='tPick'){ v.box=g.col; if(v.task.cancel) v.task={k:'retExp'}; else v.task.need=0; }
      g.cur=null; g.car=null; g.hz=1; } } }

// ---------- docks life: a straddle carrier shuttling boxes between the stacks, hi-vis workers on the quay; both give way to the player
function updatePortLife(P,dt){ const S=P.strad; if(S){ const lo=Math.min(P.impV[0],P.expV[0])+2, hi=Math.max(P.impV[1],P.expV[1])-2; const h=S.dir>0?Math.PI/2:-Math.PI/2, pa=portPlayerAhead(P,P.blkU[0]+0.6,S.v,h,5); S.yield=pa<5;
    if(S.w>0){ S.w-=dt; if(S.w<=0) S.box=S.box?null:YARD_COLS[(Math.random()*8)|0]; } else if(!S.yield){ S.v+=S.dir*dt*1.4; if(S.v>hi||S.v<lo){ S.v=Math.max(lo,Math.min(hi,S.v)); S.dir*=-1; S.w=4; } } }
  for(const w of P.wk){ const near=Math.hypot(PL(P,w.u,w.v)[0]*M_T-truck.x,PL(P,w.u,w.v)[1]*M_T-truck.y)<9; w.still=near?1:0; if(!near) w.ph+=dt*w.sp; } }
function drawPortLife(P){ const T_=TILE, S=P.strad; if(S){ ctx.save(); ctx.translate((P.blkU[0]+0.6)*T_,S.v*T_);
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-1.6*T_+5,-1.1*T_+5,3.2*T_,2.2*T_); if(S.box) drawBox(0,0,0.62*T_*1.1,3*T_-2,S.box);
    ctx.fillStyle='#c0392b'; for(const sd of [-1,1]){ ctx.fillRect(sd*1.45*T_-0.15*T_,-1.1*T_,0.3*T_,2.2*T_); } ctx.fillRect(-1.45*T_,-1.1*T_,2.9*T_,0.3*T_); ctx.fillRect(-1.45*T_,0.8*T_,2.9*T_,0.3*T_);
    ctx.fillStyle='#f1f2f6'; ctx.fillRect(1.1*T_,-0.6*T_,0.5*T_,0.6*T_); ctx.fillStyle='#f39c12'; ctx.beginPath(); ctx.arc(0,-1.0*T_,3,0,7); ctx.fill(); ctx.restore();
    if(typeof DN!=='undefined'&&DN.dark>0.05){ const w=PL(P,P.blkU[0]+0.6,S.v); dnLight(w[0]*TILE,w[1]*TILE,70,'rgba(255,225,160,0.9)',0.6); } }
  for(const w of P.wk){ const v=w.v+Math.sin(w.ph)*6, u=w.u+Math.sin(w.ph*0.7)*0.4, step=w.still?0:Math.sin(w.ph*9)*1.2; ctx.save(); ctx.translate(u*T_,v*T_);
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(2,2,4,0,7); ctx.fill(); ctx.fillStyle='#ff7a00'; ctx.beginPath(); ctx.ellipse(0,0,4.5,3.4,0,0,7); ctx.fill(); ctx.fillStyle='#ffe14d'; ctx.fillRect(-4.5,-0.8+step*0.2,9,1.6); ctx.fillStyle='#f5f6fa'; ctx.beginPath(); ctx.arc(0,0,2.3,0,7); ctx.fill(); ctx.restore(); } }
// ---------- container pickup bays (mission board): two marked bays at each port depot; board always lists port container deliveries to depots and shops
function portPickBays(P){ if(!P.depot||!P.depot.bays||!P.depot.bays.length) return []; if(!P.pick){ const e=P.depot.entrance; P.pick=P.depot.bays.filter(b=>b!==P.lb).sort((a,b)=>Math.hypot(a.kx-e.x,a.ky-e.y)-Math.hypot(b.kx-e.x,b.ky-e.y)).slice(0,2); P.pick.forEach(b=>b.portPick=P); } return P.pick; }
function portBoardJobs(){ if(typeof world==='undefined'||!world.ready) return []; const out=[]; const c=CARGOS.find(q=>q.dock); if(!c) return out;
  for(const P of portList()){ const from=P.depot; if(!from||!portPickBays(P).length) continue; const dests=world.depots.filter(d=>d!==from&&d.bays&&d.bays.length&&d.code!=='APT').concat((world.malls||[]).filter(m=>m.bays&&m.bays.length));
    for(let n=0;n<2;n++){ for(let k=0;k<30;k++){ const to=dests[(Math.random()*dests.length)|0]; if(!to) break; const km=Math.hypot(to.entrance.x-from.entrance.x,to.entrance.y-from.entrance.y)*1.3/1000; if(km<1.5||km>14) continue;
        const kg=Math.round((c.kg[0]+Math.random()*(c.kg[1]-c.kg[0]))/100)*100, TT=TRAILER_TYPES[c.trl], tier=1;
        out.push({id:'J'+(career.boardSeq++),cargo:c,tier,from,to,km,kg,weight:kg+TT.tare,trailerType:TT.name,pay:Math.round((300+190*km)*1.25*(0.85+kg/60000)/10)*10,xp:Math.round((60+40*km)*1.2),mins:Math.round(km/42*60+3),approx:true,fresh:true,portBoard:1,pickBays:portPickBays(P)}); break; } } }
  return out; }
function drawPortPickBays(vx0,vy0,vx1,vy1){ const S=PPM; for(const P of portList()) for(const b of portPickBays(P)){ const x=b.kx*S, y=b.ky*S; if(x<vx0-300||x>vx1+300||y<vy0-300||y>vy1+300) continue; const f=fwd(b.th); ctx.save(); ctx.translate(x,y); ctx.rotate(Math.atan2(f[1],f[0]));
    ctx.strokeStyle='#ffd400'; ctx.lineWidth=0.35*S; ctx.setLineDash([1.2*S,0.8*S]); ctx.strokeRect(-15*S,-1.9*S,16.5*S,3.8*S); ctx.setLineDash([]); ctx.rotate(Math.PI/2*0); ctx.fillStyle='rgba(255,212,0,0.85)'; ctx.font='bold '+(1.5*S)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.save(); ctx.translate(-6.8*S,0); if(Math.abs(Math.atan2(f[1],f[0]))>Math.PI/2) ctx.rotate(Math.PI); ctx.fillText('CONTAINER PICKUP',0,0); ctx.restore(); ctx.restore();
    if(typeof DN!=='undefined'&&DN.dark>0.05) dnLight(x,y,90,'rgba(255,230,160,0.9)',0.6); } }

// ===================== dg: dock perimeter fence + IN / OUT barrier gates with traffic lights =====================
// Fence (solid tiles via DOCK_FENCE) runs along the landside of the crane portal and across both ends down to the quay edge;
// the gate lorry path cuts the only two gaps. Each gate: barrier arm lifts for an approaching lorry / the player, light red while down, green when up.
function dgBuild(P){ const L=P.legL, uF=L+1, R=Math.abs(P.tl2-P.tl1)/2, lo=Math.min(P.lv0-R,...P.lor)-6, hi=Math.max(P.lv1+R,...P.lor)+6;
  if(!DOCK_FENCE) DOCK_FENCE=new Uint8Array(MW*MH); P.fence=[]; P.fenceL=[[uF+0.5,lo,uF+0.5,hi],[uF+0.5,lo,0,lo],[uF+0.5,hi,0,hi]];
  const cross=[]; { let pr=polyAt(P.lpath,0); for(let s=0.25;s<=P.lpath.len;s+=0.25){ const q=polyAt(P.lpath,s); if((pr[0]<uF+0.5)!==(q[0]<uF+0.5)) cross.push(q); pr=q; } }
  const a=PL(P,uF-1,lo-1), b=PL(P,1,hi+1); for(let ty=Math.floor(Math.min(a[1],b[1]));ty<=Math.ceil(Math.max(a[1],b[1]));ty++) for(let tx=Math.floor(Math.min(a[0],b[0]));tx<=Math.ceil(Math.max(a[0],b[0]));tx++){
    const q=portLocal(P,tx+0.5,ty+0.5), u=q[0], v=q[1]; let k=null;
    if(u>=uF&&u<uF+1&&v>=lo-0.5&&v<hi+0.5) k='s'; else if(u>=uF&&u<0&&(Math.abs(v-lo)<0.5||Math.abs(v-hi)<0.5)) k='e'; if(!k) continue;
    if(cross.some(c=>Math.abs(c[0]-u)<1.6&&Math.abs(c[1]-v)<2.6)) continue; if(get(tx,ty)===T.WATER) continue; DOCK_FENCE[idx(tx,ty)]=1; P.fence.push({u,v,k}); }
  // gates where the lorry path crosses the fence line
  P.gates=[]; let prev=polyAt(P.lpath,0)[0]; for(let s=0.25;s<=P.lpath.len;s+=0.25){ const q=polyAt(P.lpath,s), c=uF+0.5;
    if((prev<c)!==(q[0]<c)){ const IN=!P.gates.length, n=polyAt(P.lpath,s+0.5), m=polyAt(P.lpath,s-0.5), h=Math.atan2(n[1]-m[1],n[0]-m[0]), rt=[-Math.sin(h),Math.cos(h)], sd=IN?1:-1;
      P.gates.push({name:IN?'IN':'OUT',s,p:s-P.lpre,pu:q[0],pv:q[1],h,a:0,want:0,lu:q[0]+rt[0]*sd*1.25-Math.cos(h)*0.6,lv:q[1]+rt[1]*sd*1.25-Math.sin(h)*0.6,sd}); }
    prev=q[0]; }
  // high-mast floodlights: yard ends, between the stacks, quay ends, beside each gate and along the outside of the fence
  const M=[[L+4.2,lo+1.4],[L+4.2,hi-1.4],[-2.2,lo+1.4],[-2.2,hi-1.4],[(P.blkU[0]+P.blkU[1])/2,(P.impV[0]>P.expV[1]?(P.impV[0]+P.expV[1]):(P.expV[0]+P.impV[1]))/2]];
  { const bu=(P.blkU[0]+P.blkU[1])/2, s0=Math.min(P.impV[0],P.expV[0]), s1=Math.max(P.impV[1],P.expV[1]); M.push([bu,s0-5],[bu,s1+5]); }
  for(const g of P.gates){ const rt=[-Math.sin(g.h),Math.cos(g.h)]; M.push([g.pu+rt[0]*g.sd*2.3+Math.cos(g.h)*1.6,g.pv+rt[1]*g.sd*2.3+Math.sin(g.h)*1.6]); }
  for(let v=lo+14;v<hi-8;v+=26){ const w=PL(P,uF-0.6,v); const t=get(Math.floor(w[0]),Math.floor(w[1])); if(t!==T.ROAD&&t!==T.BRIDGE&&!P.gates.some(g=>Math.abs(g.pv-v)<5)) M.push([uF-0.6,v]); }
  P.masts=M.map(m=>({u:m[0],v:m[1]})); for(const m of P.masts){ const w=PL(P,m.u,m.v); DOCK_FENCE[idx(Math.floor(w[0]),Math.floor(w[1]))]=1; } }
function dgDrawMasts(P){ const T_=TILE, K=typeof DN!=='undefined'?DN.dark:0; for(const m of (P.masts||[])){ const x=m.u*T_, y=m.v*T_;
    ctx.save(); ctx.strokeStyle='rgba(0,0,0,'+(0.28*(1-K*0.7))+')'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+2.6*T_,y+2.6*T_); ctx.stroke();   // long pole shadow
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+2.6*T_-9,y+2.6*T_-5,18,10);
    ctx.fillStyle='#6d757c'; ctx.beginPath(); ctx.arc(x,y,7,0,7); ctx.fill(); ctx.fillStyle='#aab3ba'; ctx.beginPath(); ctx.arc(x,y,4.5,0,7); ctx.fill();   // base + tapered pole seen from above
    ctx.fillStyle='#2f353a'; ctx.fillRect(x-12,y-5,24,10); ctx.fillStyle=K>0.05?'#fff4d6':'#dfe4e8'; for(const dx of [-8,-2.7,2.7,8]) ctx.fillRect(x+dx-2.2,y-3,4.4,6);   // lamp head (4 lanterns)
    ctx.restore(); if(K>0.05){ const w=PL(P,m.u,m.v); dnLight(w[0]*TILE,w[1]*TILE,7*TILE,'rgba(255,226,170,0.9)',0.6); } } }
function dgUpdate(P,dt){ if(!P.gates) return; const pl=[[truck.x,truck.y]]; if(truck.trl) pl.push([truck.trl.x,truck.trl.y]);
  for(const g of P.gates){ const w=PL(P,g.pu,g.pv); let want=P.lors.some(l=>l.p>g.p-11&&l.p<g.p+5);
    if(!want) for(const q of pl){ if(Math.hypot(q[0]/M_T-w[0],q[1]/M_T-w[1])<6.5) want=true; }
    g.want=want; g.a=Math.max(0,Math.min(1,g.a+(want?1:-1)*dt/1.3)); } }
// distance a gate lorry may still travel before the stop line of a closed gate ahead of it
function dgStop(P,l){ let m=1e9; for(const g of (P.gates||[])){ const d=g.p-2.3-l.p; if(d>-0.5&&d<12&&g.a<0.97) m=Math.min(m,Math.max(0,d)); } return m; }
function dgDrawFence(P){ const T_=TILE; if(!P.fence) return; const W=0.34*T_;
  const rect=(f,dx,dy,w)=>{ if(f.k==='s') ctx.fillRect(f.u*T_-w/2+dx,(f.v-0.5)*T_+dy,w,T_); else ctx.fillRect((f.u-0.5)*T_+dx,f.v*T_-w/2+dy,T_,w); };
  ctx.fillStyle='rgba(0,0,0,0.3)'; for(const f of P.fence) rect(f,5,5,W);              // shadow
  ctx.fillStyle='#5f6870'; for(const f of P.fence) rect(f,0,0,W);                    // palisade body
  ctx.fillStyle='#b8c1c8'; for(const f of P.fence) rect(f,0,0,W*0.45);               // lit top rail
  ctx.fillStyle='#e1b12c'; for(const f of P.fence){ if(f.k==='s') ctx.fillRect(f.u*T_-W/2,(f.v-0.5)*T_,W,3); else ctx.fillRect((f.u-0.5)*T_,f.v*T_-W/2,3,W); }   // hazard caps
  ctx.fillStyle='#2b3035'; for(const f of P.fence) ctx.fillRect(f.u*T_-5,f.v*T_-5,10,10); }   // posts
function dgDrawGate(P,g){ const T_=TILE, c=Math.cos(g.h), sn=Math.sin(g.h), rt=[-sn,c], sd=g.sd, pv=[g.pu+rt[0]*sd*1.15,g.pv+rt[1]*sd*1.15];
  // booth + posts
  ctx.save(); ctx.translate(g.pu*T_,g.pv*T_); ctx.rotate(g.h);
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(-0.9*T_+4,sd*1.6*T_-0.45*T_+4,1.6*T_,0.9*T_); ctx.fillStyle='#e9eef2'; ctx.fillRect(-0.9*T_,sd*1.6*T_-0.45*T_,1.6*T_,0.9*T_); ctx.fillStyle='#2d6cdf'; ctx.fillRect(-0.9*T_,sd*1.6*T_-0.45*T_,1.6*T_,0.22*T_); ctx.fillStyle='#7fd3ff'; ctx.fillRect(-0.7*T_,sd*1.6*T_-0.12*T_,1.2*T_,0.14*T_);
  ctx.fillStyle='#222'; ctx.fillRect(-0.15*T_,-sd*1.25*T_-4,0.3*T_,8);   // arm rest post
  ctx.restore();
  // barrier arm (pivot on the booth side, swings 85 deg up = foreshortened in top view)
  const len=2.5*T_, ang=g.a*Math.PI*0.47; ctx.save(); ctx.translate(pv[0]*T_,pv[1]*T_); ctx.rotate(g.h); ctx.fillStyle='#333'; ctx.fillRect(-7,-7,14,14);
  const L2=len*Math.cos(ang); ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(4+ang*8,-sd*L2+(sd>0?0:0)+4,6,sd*L2); ctx.fillStyle='#e74c3c'; ctx.fillRect(-3,0,6,-sd*L2);
  ctx.fillStyle='#fff'; for(let k=0.18;k<0.95;k+=0.28) ctx.fillRect(-3,-sd*L2*k,6,-sd*L2*0.12); ctx.restore();
  // traffic light head
  ctx.save(); ctx.translate(g.lu*T_,g.lv*T_); ctx.rotate(g.h); ctx.fillStyle='#111'; ctx.fillRect(-5,-9,10,18); const gr=g.a>0.95;
  ctx.fillStyle=gr?'#3a1010':'#ff3b30'; ctx.beginPath(); ctx.arc(0,-4.5,3.2,0,7); ctx.fill(); ctx.fillStyle=gr?'#2ecc71':'#0f2a18'; ctx.beginPath(); ctx.arc(0,4.5,3.2,0,7); ctx.fill(); ctx.restore();
  // painted stop line + label
  ctx.save(); ctx.translate((g.pu-c*2.3)*T_,(g.pv-sn*2.3)*T_); ctx.rotate(g.h); ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(-2,-0.55*T_,4,1.1*T_); ctx.restore();
}
function dgLabel(P,g){ const rt=[-Math.sin(g.h),Math.cos(g.h)], w=PL(P,g.pu+rt[0]*g.sd*3.1,g.pv+rt[1]*g.sd*3.1); ctx.save(); ctx.translate(w[0]*TILE,w[1]*TILE);
  ctx.font='bold 13px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(-32,-9,64,18); ctx.fillStyle=g.name==='IN'?'#7dffa8':'#ffd36b'; ctx.fillText('GATE '+g.name,0,1); ctx.restore(); }
function dgLamp(x,y,green,K){ const col=green?'46,230,110':'255,55,45', r=26; const gr=ctx.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba('+col+','+(0.95*K)+')'); gr.addColorStop(1,'rgba('+col+',0)'); ctx.globalAlpha=1; ctx.fillStyle=gr; ctx.fillRect(x-r,y-r,2*r,2*r); }
