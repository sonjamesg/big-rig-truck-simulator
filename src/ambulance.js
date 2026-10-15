'use strict';
// ===================== v29 AMBULANCE: casualties stay down until paramedics treat them =====================
// Flow per incident: spawn on a road just out of view (~1 screen) with a working route -> drive in (blue lights + siren) -> pull up ->
// crew walk (off-road if needed) to each casualty in turn and treat it -> crew back in -> no siren, route to nearest hospital -> despawn once off screen AND far from the player, else park in an ambulance bay.
const AMBU={jobs:[],parked:null,treated:0,dispatched:0};
function ambHospitals(){ return typeof SVC!=='undefined'?SVC.byType.hospital:[]; }
function ambPedHit(p){ p.cas=true; p.down=1e9;
  const j=AMBU.jobs.find(j=>j.st!=='leave'&&Math.hypot(j.sx-p.x,j.sy-p.y)<120); if(j){ j.cas.push(p); return; }
  const job={cas:[p],sx:p.x,sy:p.y,st:'spawn',t:0,tt:0,v:null,k:null,crew:[],siren:null,best:1e9}; AMBU.jobs.push(job); AMBU.dispatched++; }
// v29: the ambulance always comes from just off screen (about one screen away), never popping into view; no long hospital drive
function ambViewR(){ const v=viewRectM(); return Math.max(v[2]-v[0],v[3]-v[1])/2; }
function ambTrySpawn(job,close){ const R=ambViewR(), base=close?R*0.75+25:R*1.6+40;
  for(let t=0;t<40;t++){ const a=Math.random()*6.283, d=base+Math.random()*(close?20:R*0.6), x=job.sx+Math.cos(a)*d, y=job.sy+Math.sin(a)*d, tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(!inb(tx,ty)) continue;
    const i=idx(tx,ty); if(world.roadH[i]<0&&world.roadV[i]<0) continue; if(onScreen(x,y,12)) continue; const v=spawnVehicle(x,y,true,{kind:'van'}); if(!v) continue;
    if(typeof aiGoal==='function'&&!aiGoal(v,{entrance:{x:job.sx,y:job.sy},name:'casualty'})){ const k=traffic.vs.indexOf(v); if(k>=0) traffic.vs.splice(k,1); continue; }
    if(onScreen(v.x,v.y,8)){ ambDrop(v); continue; } v.role='ambulance'; v.art={body:emArt('ambulance').body}; v.amb=job; v.pinT=timeS+1e6; return v; } return null; }
function ambRejoin(j){ const nv=emToTraffic(j.k.x,j.k.y,'ambulance'); j.v=nv; if(!nv) return false; nv.amb=j; nv.pinT=timeS+1e6; j.k=null; let h=null,bd=1e18;
  for(const q of ambHospitals()){ const d=(q.x-nv.x)**2+(q.y-nv.y)**2; if(d<bd){ bd=d; h=q; } } if(h&&typeof aiGoal==='function'&&aiGoal(nv,{entrance:emRoadPt(h),name:h.name})) j.h=h; return true; }
function ambDrop(v){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } }
// v31: guaranteed arrival - drive a kinematic ambulance in along the road network from the first road tile just off screen
function ambIsRd(tx,ty){ if(!inb(tx,ty)) return false; const i=idx(tx,ty); return world.roadH[i]>=0||world.roadV[i]>=0; }
function ambForce(j){ let st=null, bd=1e9; const cx=Math.floor(j.sx/M_T), cy=Math.floor(j.sy/M_T);
  for(let dy=-8;dy<=8;dy++) for(let dx=-8;dx<=8;dx++) if(ambIsRd(cx+dx,cy+dy)&&dx*dx+dy*dy<bd){ bd=dx*dx+dy*dy; st=[cx+dx,cy+dy]; } if(!st) return false;
  const W=world.W||world.w, prev=new Map(), q=[st]; prev.set(st[0]+st[1]*1e5,null); let goal=null;
  for(let h=0;h<q.length&&q.length<20000;h++){ const [x,y]=q[h], px=(x+0.5)*M_T, py=(y+0.5)*M_T; if(!onScreen(px,py,8)&&Math.hypot(px-j.sx,py-j.sy)>30){ goal=[x,y]; break; }
    for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+ox, ny=y+oy, k=nx+ny*1e5; if(prev.has(k)||!ambIsRd(nx,ny)) continue; prev.set(k,[x,y]); q.push([nx,ny]); } }
  if(!goal) return false; const P=[]; let c=goal; while(c){ P.push([(c[0]+0.5)*M_T,(c[1]+0.5)*M_T]); c=prev.get(c[0]+c[1]*1e5); }
  for(let i=0;i<P.length-1;i++){ const dx=P[i+1][0]-P[i][0], dy=P[i+1][1]-P[i][1], d=Math.hypot(dx,dy)||1; P[i][0]+=-dy/d*1.6; P[i][1]+=dx/d*1.6; }   // keep left-ish
  const L=P[P.length-1]; L[0]+=(j.sx-L[0])*0.5; L[1]+=(j.sy-L[1])*0.5; const f=P.shift(), n=P[0]||[j.sx,j.sy];
  if(j.v) ambDrop(j.v); j.v=null; j.k={x:f[0],y:f[1],h:Math.atan2(n[0]-f[0],-(n[1]-f[1])),path:P,t:0}; j.st='drive'; j.t=0; if(!j.siren) j.siren=emSiren('ambulance'); AMBU.forced=(AMBU.forced||0)+1; return true; }
function ambRear(j){ const b=fwd(j.k.h), L=emArt('ambulance').L||5; return [j.k.x-b[0]*(L/2+1.3),j.k.y-b[1]*(L/2+1.3)]; }
function ambMove(o,tx,ty,sp,dt){ const dx=tx-o.x, dy=ty-o.y, d=Math.hypot(dx,dy); if(d<0.15) return true; const s=Math.min(d,sp*dt); o.x+=dx/d*s; o.y+=dy/d*s; if(d>0.3) o.a=Math.atan2(dy,dx); return false; }
function ambCrewOnS(j,walk,dt){ const S=j.S, c=Math.cos(S.a), s=Math.sin(S.a); for(const m of j.crew){ const sg=m.k?-1:1; m.x=S.x+c*1.35*sg; m.y=S.y+s*1.35*sg; m.dir=[c*-sg,s*-sg]; m.kneel=walk?0:1; if(walk) m.ph+=dt*9; } }
function ambUpdate(dt){ if(!world.ready||(typeof uiBlocking==='function'&&uiBlocking())) return;
  for(const j of AMBU.jobs){ j.t+=dt; j.tt+=dt; const v=j.v;
    if(j.siren&&(j.v||j.k)) j.siren.set(emSirenVol((j.v||j.k).x,(j.v||j.k).y,j)); emSirMode(j.siren,'ambulance',j);
    if((j.st==='spawn'||j.st==='go')&&j.tt>25){ if(ambForce(j)) continue; }
    if(j.st==='spawn'){ if(j.t<0.6) continue; const nv=ambTrySpawn(j,j.tt>3); if(nv){ j.v=nv; j.st='go'; j.t=0; j.best=1e9; if(!j.siren) j.siren=emSiren('ambulance'); AMBU.spawns=(AMBU.spawns||0)+1; } else { j.t=0; if(j.tt>6) ambForce(j); } continue; }
    if(j.st==='go'){ if(!traffic.vs.includes(v)){ j.v=null; j.st='spawn'; j.t=0; continue; }
      const d=Math.hypot(v.x-j.sx,v.y-j.sy); if(d<j.best-1){ j.best=d; j.prog=j.t; }
      if(d<24||(d<55&&d>j.best+4)||(d<80&&j.t-(j.prog||0)>6)){ ambDrop(v); j.v=null; const r=rgt(v.h), f=fwd(v.h); j.k={x:v.x,y:v.y,h:v.h,path:[[v.x+r[0]*1.3+f[0]*4,v.y+r[1]*1.3+f[1]*4]]}; j.st='pull'; j.t=0; }
      else if(j.t-(j.prog||0)>7){ if(!onScreen(v.x,v.y,10)){ ambDrop(v); j.v=null; j.st='spawn'; j.t=0; j.tt=Math.max(j.tt,4); AMBU.respawns=(AMBU.respawns||0)+1; } else if(j.t-(j.prog||0)>12) ambForce(j); }   // stuck: bring it in nearer (out of view), or force
      continue; }
    if(j.st==='drive'){ const d=Math.hypot(j.k.x-j.sx,j.k.y-j.sy); if(emFollow(j.k,dt,d<30?6:11)||d<9||j.t>60){ j.st='pull'; j.t=0; j.k.path=[]; } continue; }
    if(j.st==='pull'){ if(emFollow(j.k,dt,3)||j.t>4){ j.st='doors'; j.t=0; j.door=0; AMBU.arrived=(AMBU.arrived||0)+1; } continue; }
    if(j.st==='doors'){ if(j.siren&&j.t>1.5){ j.siren.stop(); j.siren=null; } j.door=Math.min(1,j.door+dt/0.8); if(j.door>=1){ const [rx,ry]=ambRear(j); j.S={x:rx,y:ry,a:j.k.h-Math.PI/2,p:null}; j.crew=[{x:rx,y:ry,ph:0,k:0},{x:rx,y:ry,ph:0,k:1}]; j.st='fetch'; j.t=0; } continue; }
    if(j.st==='fetch'){ const p=j.cas.find(p=>p.cas&&traffic.peds.includes(p)); if(!p){ j.st='close'; j.t=0; continue; }
      j.cur=p; const ar=ambMove(j.S,p.x,p.y,1.5,dt); ambCrewOnS(j,!ar,dt); if(ar||j.t>40){ if(!ar){ j.S.x=p.x; j.S.y=p.y; } j.st='load'; j.t=0; } continue; }
    if(j.st==='load'){ ambCrewOnS(j,false,dt); const p=j.cur; p.prog=Math.min(1,j.t/2); if(j.t>2){ const i=traffic.peds.indexOf(p); if(i>=0) traffic.peds.splice(i,1); p.cas=false; p.fix=1; p.down=0; j.S.p=p; AMBU.treated++; j.st='ret'; j.t=0; } continue; }
    if(j.st==='ret'){ const [rx,ry]=ambRear(j), ar=ambMove(j.S,rx,ry,1.3,dt); ambCrewOnS(j,!ar,dt); if(ar||j.t>40){ j.st='stow'; j.t=0; } continue; }
    if(j.st==='stow'){ ambCrewOnS(j,false,dt); if(j.t>1.2){ j.S.p=null; j.loaded=(j.loaded||0)+1; j.st=j.cas.some(p=>p.cas&&traffic.peds.includes(p))?'fetch':'close'; j.t=0; } continue; }
    if(j.st==='close'){ j.S=null; j.crew=[]; j.door=Math.max(0,1-j.t/0.8); if(j.t>1.1){ j.door=0; j.st='leave'; j.t=0; ambRejoin(j); } continue; }
    if(j.st==='leave'){ const v=j.v; if(!v){ AMBU.why='norejoin'; if(j.t>1.5){ j.t=0; if(ambRejoin(j)) continue; } if(j.k&&!onScreen(j.k.x,j.k.y,10)) j.done=true; continue; }   // couldn't rejoin traffic: stays parked until out of view
      if(j.park){ if(emFollow(j.park,dt,3)) j.done=true; continue; }
      if(!traffic.vs.includes(v)){ j.done=true; AMBU.why='gone'; continue; } const R=ambViewR(), far=!onScreen(v.x,v.y,20)&&Math.hypot(v.x-truck.x,v.y-truck.y)>R*1.6+60;
      if(j.h){ const e=emRoadPt(j.h); if(Math.hypot(v.x-e.x,v.y-e.y)<14){ const b=j.h.bays.find(b=>b.kind==='ambulance')||j.h.bays[0]; ambDrop(v); j.park={x:v.x,y:v.y,h:v.h,path:[[e.x,j.h.entrance.y+2],[j.h.entrance.x,j.h.rect.y0+M_T*1.5],[b.x,b.y]],t:0}; AMBU.parkedN=(AMBU.parkedN||0)+1; continue; } if(far){ ambDrop(v); j.done=true; AMBU.why='far'; } }
      else if(!onScreen(v.x,v.y,10)&&Math.hypot(v.x-j.sx,v.y-j.sy)>40){ ambDrop(v); j.done=true; } } }
  AMBU.jobs=AMBU.jobs.filter(j=>!j.done);
  for(const p of traffic.peds) if(p.cas&&Math.hypot(p.x-truck.x,p.y-truck.y)>1400){ p.cas=false; p.down=0; } }
function ambDrawMedic(m){ const X=m.x*PPM, Y=m.y*PPM; ctx.save(); ctx.translate(X,Y); ctx.rotate(m.dir?ang(m.dir[0],m.dir[1]):0);
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(2,2,3.6,2.6,0,0,7); ctx.fill(); if(!m.kneel){ const sw=Math.sin(m.ph)*2.2; ctx.fillStyle='#1f3b2a'; ctx.fillRect(-2.2,-1+sw,1.6,3.2); ctx.fillRect(0.6,-1-sw,1.6,3.2); }
  ctx.fillStyle='#2e7d32'; ctx.beginPath(); ctx.ellipse(0,0,3.6,2.3,0,0,7); ctx.fill(); ctx.fillStyle='#f2e600'; ctx.fillRect(-3.4,-0.5,6.8,1.1); ctx.fillStyle='#3a2a1a'; ctx.beginPath(); ctx.arc(0,0.2,1.7,0,7); ctx.fill(); ctx.restore(); }
function ambDrawDoors(j){ const k=j.k, a=emArt('ambulance'), L=a.L||5, W=a.W||2, b=fwd(k.h), r=rgt(k.h), rx=k.x-b[0]*(L/2-0.05), ry=k.y-b[1]*(L/2-0.05), o=j.door*1.75;
  ctx.save(); ctx.lineCap='round'; for(const sg of [-1,1]){ const hx=rx+r[0]*sg*W/2, hy=ry+r[1]*sg*W/2, c=Math.cos(o), s=Math.sin(o), dx=-r[0]*sg*c-b[0]*s, dy=-r[1]*sg*c-b[1]*s;
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.22*PPM; ctx.beginPath(); ctx.moveTo(hx*PPM+2,hy*PPM+2); ctx.lineTo((hx+dx*W/2)*PPM+2,(hy+dy*W/2)*PPM+2); ctx.stroke();
    ctx.strokeStyle='#f4f4ee'; ctx.lineWidth=0.16*PPM; ctx.beginPath(); ctx.moveTo(hx*PPM,hy*PPM); ctx.lineTo((hx+dx*W/2)*PPM,(hy+dy*W/2)*PPM); ctx.stroke();
    ctx.strokeStyle='#2e9e3e'; ctx.lineWidth=0.06*PPM; ctx.beginPath(); ctx.moveTo((hx+dx*W/6)*PPM,(hy+dy*W/6)*PPM); ctx.lineTo((hx+dx*W/2.4)*PPM,(hy+dy*W/2.4)*PPM); ctx.stroke(); }
  if(j.door>0.6){ ctx.fillStyle='rgba(20,30,25,0.85)'; ctx.translate(rx*PPM,ry*PPM); ctx.rotate(k.h); ctx.fillRect(-W/2*0.85*PPM,-0.05*PPM,W*0.85*PPM,0.25*PPM); } ctx.restore(); }
function ambDrawStretcher(S){ ctx.save(); ctx.translate(S.x*PPM,S.y*PPM); ctx.rotate(S.a); const l=1.0*PPM, w=0.32*PPM;
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(-l+2,-w+2,2*l,2*w); ctx.fillStyle='#8a9096'; ctx.fillRect(-l,-w,2*l,2*w); ctx.fillStyle='#f6f6f2'; ctx.fillRect(-l*0.92,-w*0.8,l*1.84,w*1.6);
  ctx.fillStyle='#d64545'; ctx.fillRect(-l*0.92,-w*0.8,l*0.3,w*1.6);
  if(S.p){ ctx.fillStyle=S.p.col||'#5577aa'; ctx.fillRect(-l*0.55,-w*0.55,l*1.1,w*1.1); ctx.fillStyle='#e0b48c'; ctx.beginPath(); ctx.arc(l*0.7,0,w*0.5,0,7); ctx.fill(); ctx.fillStyle='rgba(120,180,230,0.9)'; ctx.fillRect(-l*0.75,-w*0.7,l*0.9,w*1.4); }
  ctx.restore(); }
function drawAmbulance(vx0,vy0,vx1,vy1){ const inV=(x,y)=>x*PPM>vx0-80&&x*PPM<vx1+80&&y*PPM>vy0-80&&y*PPM<vy1+80;
  for(const h of ambHospitals()) for(const b of h.bays) if(b.kind==='ambulance'&&inV(b.x,b.y)) emBlit({x:b.x,y:b.y,h:b.h},'ambulance');
  for(const j of AMBU.jobs){ const v=j.park||j.v||j.k; if(!v) continue; if(j.k&&inV(j.k.x,j.k.y)) emBlit(j.k,'ambulance'); if(j.park&&inV(j.park.x,j.park.y)) emBlit(j.park,'ambulance'); if(inV(v.x,v.y)) emDrawBar(v,['go','drive','pull','doors'].includes(j.st),'ambulance'); if(j.k&&j.door>0&&inV(j.k.x,j.k.y)) ambDrawDoors(j);
    if(j.S&&inV(j.S.x,j.S.y)) ambDrawStretcher(j.S);
    for(const m of j.crew) if(inV(m.x,m.y)) ambDrawMedic(m);
    for(const p of j.cas) if(p.cas&&p.prog>0&&inV(p.x,p.y)){ const X=p.x*PPM, Y=p.y*PPM-16; ctx.save(); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(X,Y,6,0,7); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#3ddc84'; ctx.beginPath(); ctx.arc(X,Y,5,-Math.PI/2,-Math.PI/2+6.283*Math.min(1,p.prog)); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.fillRect(X-0.75,Y-3,1.5,6); ctx.fillRect(X-3,Y-0.75,6,1.5); ctx.restore(); } } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ ambUpdate(dt); }catch(e){ console.warn('[ambulance]',e); } };
  if(typeof BigRig!=='undefined') BigRig.ambulance=()=>({jobs:AMBU.jobs.map(j=>j.st),treated:AMBU.treated,dispatched:AMBU.dispatched}); },0);
