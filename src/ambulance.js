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
function ambUpdate(dt){ if(!world.ready||(typeof uiBlocking==='function'&&uiBlocking())) return;
  for(const j of AMBU.jobs){ j.t+=dt; j.tt+=dt; const v=j.v;
    if(j.st==='spawn'){ if(j.t<0.6) continue; const nv=ambTrySpawn(j,j.tt>3); if(nv){ j.v=nv; j.st='go'; j.t=0; j.best=1e9; j.siren=emSiren(); AMBU.spawns=(AMBU.spawns||0)+1; } else j.t=0; continue; }
    if(j.st==='go'){ if(!traffic.vs.includes(v)){ if(j.siren){ j.siren.stop(); j.siren=null; } j.st='spawn'; j.t=0; continue; } if(j.siren) j.siren.set(emSirenVol(v.x,v.y));
      const d=Math.hypot(v.x-j.sx,v.y-j.sy); if(d<j.best-1){ j.best=d; j.prog=j.t; }
      if(d<24||(d<55&&d>j.best+4)||(d<80&&j.t-(j.prog||0)>6)){ ambDrop(v); const r=rgt(v.h), f=fwd(v.h); j.k={x:v.x,y:v.y,h:v.h,path:[[v.x+r[0]*1.3+f[0]*4,v.y+r[1]*1.3+f[1]*4]]}; j.st='pull'; j.t=0; }
      else if(j.t-(j.prog||0)>14&&!onScreen(v.x,v.y,10)){ ambDrop(v); if(j.siren){ j.siren.stop(); j.siren=null; } j.st='spawn'; j.t=0; j.tt=99; AMBU.respawns=(AMBU.respawns||0)+1; }   // not getting closer: bring it in nearer (still out of view)
      continue; }
    if(j.st==='pull'){ if(j.siren) j.siren.set(emSirenVol(j.k.x,j.k.y)); if(emFollow(j.k,dt,3)||j.t>4){ j.st='treat'; j.t=0; if(j.siren){ j.siren.stop(); j.siren=null; } const n=j.cas.length>1?2:1+(Math.random()<0.5?1:0), b=fwd(j.k.h), r=rgt(j.k.h);
        for(let k=0;k<n;k++) j.crew.push({x:j.k.x-b[0]*2.6+r[0]*(k?1:-1)*0.6,y:j.k.y-b[1]*2.6+r[1]*(k?1:-1)*0.6,ph:0,k}); } continue; }
    if(j.st==='treat'){ const p=j.cas.find(p=>p.cas&&!p.fix&&traffic.peds.includes(p));   // one casualty at a time, whole crew together
      if(p){ let at=0; for(const m of j.crew){ const ox=m.k?-0.9:0.9, dx=p.x+ox-m.x, dy=p.y+0.3-m.y, d=Math.hypot(dx,dy); if(d>0.25){ const st=Math.min(d,1.9*dt); m.x+=dx/d*st; m.y+=dy/d*st; m.ph+=dt*9; m.dir=[dx/d,dy/d]; m.kneel=0; } else { m.kneel=1; m.dir=[-ox,0]; at++; } }
        if(at){ p.prog=(p.prog||0)+dt/5; if(p.prog>=1){ p.cas=false; p.down=0; p.fix=1; p.treatedT=timeS; p.flee=0; AMBU.treated++; } } }
      else { let all=true; const b=fwd(j.k.h); for(const m of j.crew){ const hx=j.k.x-b[0]*2.6, hy=j.k.y-b[1]*2.6, dx=hx-m.x, dy=hy-m.y, d=Math.hypot(dx,dy); m.kneel=0; if(d>0.3){ all=false; const st=Math.min(d,1.9*dt); m.x+=dx/d*st; m.y+=dy/d*st; m.ph+=dt*9; m.dir=[dx/d,dy/d]; } }
        if(all){ j.crew=[]; j.st='leave'; j.t=0; ambRejoin(j); } }
      continue; }
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
function drawAmbulance(vx0,vy0,vx1,vy1){ const inV=(x,y)=>x*PPM>vx0-80&&x*PPM<vx1+80&&y*PPM>vy0-80&&y*PPM<vy1+80;
  for(const h of ambHospitals()) for(const b of h.bays) if(b.kind==='ambulance'&&inV(b.x,b.y)) emBlit({x:b.x,y:b.y,h:b.h},'ambulance');
  for(const j of AMBU.jobs){ const v=j.park||(j.st==='go'||j.st==='leave'?j.v:j.k); if(!v) continue; if(j.k&&inV(j.k.x,j.k.y)) emBlit(j.k,'ambulance'); if(j.park&&inV(j.park.x,j.park.y)) emBlit(j.park,'ambulance'); if(inV(v.x,v.y)) emDrawBar(v,j.st==='go'||j.st==='pull'||j.st==='treat','ambulance');
    for(const m of j.crew) if(inV(m.x,m.y)) ambDrawMedic(m);
    for(const p of j.cas) if(p.cas&&p.prog>0&&inV(p.x,p.y)){ const X=p.x*PPM, Y=p.y*PPM-16; ctx.save(); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(X,Y,6,0,7); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#3ddc84'; ctx.beginPath(); ctx.arc(X,Y,5,-Math.PI/2,-Math.PI/2+6.283*Math.min(1,p.prog)); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.fillRect(X-0.75,Y-3,1.5,6); ctx.fillRect(X-3,Y-0.75,6,1.5); ctx.restore(); } } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ ambUpdate(dt); }catch(e){ console.warn('[ambulance]',e); } };
  if(typeof BigRig!=='undefined') BigRig.ambulance=()=>({jobs:AMBU.jobs.map(j=>j.st),treated:AMBU.treated,dispatched:AMBU.dispatched}); },0);
