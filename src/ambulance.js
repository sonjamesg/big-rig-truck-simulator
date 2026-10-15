'use strict';
// ===================== v28 AMBULANCE: casualties stay down until paramedics from the nearest hospital treat them =====================
// Flow per incident: dispatch from a hospital ambulance bay -> drive the roads (traffic AI + aiGoal, blue lights + siren) -> pull up ->
// 1-2 paramedics walk to each casualty, treat (progress ring), casualty gets up and walks off -> crew back in -> return (no siren) -> park in bay.
const AMBU={jobs:[],parked:null,treated:0,dispatched:0};
function ambHospitals(){ return typeof SVC!=='undefined'?SVC.byType.hospital:[]; }
function ambParkedInit(){ if(AMBU.parked) return; AMBU.parked=new Map(); for(const h of ambHospitals()) for(const b of h.bays) if(b.kind==='ambulance') AMBU.parked.set(b,true); }
function ambPedHit(p){ ambParkedInit(); p.cas=true; p.down=1e9;
  const j=AMBU.jobs.find(j=>j.st!=='return'&&j.st!=='park'&&Math.hypot(j.sx-p.x,j.sy-p.y)<120); if(j){ j.cas.push(p); return; }
  let h=null,bd=1e18; for(const s of ambHospitals()){ const q=(s.x-p.x)**2+(s.y-p.y)**2; if(q<bd){ bd=q; h=s; } }
  const job={cas:[p],sx:p.x,sy:p.y,h,bay:null,st:'dispatch',t:0,v:null,k:null,crew:[],siren:null}; AMBU.jobs.push(job); AMBU.dispatched++; ambDispatch(job); }
function ambDispatch(job){ const h=job.h; let v=null;
  if(h){ job.bay=h.bays.find(b=>b.kind==='ambulance'&&AMBU.parked.get(b))||h.bays.find(b=>b.kind==='ambulance'); if(job.bay) AMBU.parked.set(job.bay,false);
    const e=emRoadPt(h); if(Math.hypot(e.x-truck.x,e.y-truck.y)<2600){ v=spawnVehicle(e.x,e.y,true,{kind:'van'}); if(!v) for(const o of [6,-6,12,-12]){ v=spawnVehicle(e.x+o,e.y,true,{kind:'van'}); if(v) break; } } }
  if(!v){ // hospital too far / no room at the gate: arrive from off-screen on the road network near the scene
    for(let t=0;t<20&&!v;t++){ const a=Math.random()*6.283, d=120+Math.random()*80, x=job.sx+Math.cos(a)*d, y=job.sy+Math.sin(a)*d, tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(!inb(tx,ty)) continue; const i=idx(tx,ty); if((world.roadH[i]>=0||world.roadV[i]>=0)&&!onView(x,y)) v=spawnVehicle(x,y,true,{kind:'van'}); } }
  if(!v){ job.st='retry'; job.t=0; return; }
  v.role='ambulance'; v.art={body:emArt('ambulance').body}; v.amb=job; v.pinT=timeS+1e6; job.v=v; job.st='go'; job.t=0; if(typeof aiGoal==='function') aiGoal(v,{entrance:{x:job.sx,y:job.sy},name:'casualty'}); v.pinT=timeS+1e6; job.siren=emSiren(); }
function ambUpdate(dt){ if(!world.ready) return; ambParkedInit();
  // casualties: keep only while near enough to matter; a casualty too far from the player is quietly taken care of
  for(const j of AMBU.jobs){ j.t+=dt; const v=j.v;
    if(j.st==='retry'){ if(j.t>4) ambDispatch(j); continue; }
    if(j.st==='go'){ if(!traffic.vs.includes(v)){ j.st='retry'; j.t=0; if(j.siren){ j.siren.stop(); j.siren=null; } continue; } if(j.siren) j.siren.set(emSirenVol(v.x,v.y));
      const d=Math.hypot(v.x-j.sx,v.y-j.sy); if(d<26||(j.t>200&&d<60)){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } const r=rgt(v.h);
        j.k={x:v.x,y:v.y,h:v.h,path:[[v.x+r[0]*1.2+fwd(v.h)[0]*4,v.y+r[1]*1.2+fwd(v.h)[1]*4]]}; j.st='pull'; j.t=0; }
      else if(j.t>260){ // stuck en route: re-dispatch from near the scene
        const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } if(j.siren){ j.siren.stop(); j.siren=null; } j.h=null; ambDispatch(j); } continue; }
    if(j.st==='pull'){ if(j.siren) j.siren.set(emSirenVol(j.k.x,j.k.y)); if(emFollow(j.k,dt,3)||j.t>4){ j.st='treat'; j.t=0; if(j.siren){ j.siren.stop(); j.siren=null; } const n=j.cas.length>1?2:1+(Math.random()<0.5?1:0), b=fwd(j.k.h);
        for(let k=0;k<n;k++){ const r=rgt(j.k.h); j.crew.push({x:j.k.x-b[0]*2.6+r[0]*(k?1:-1)*0.6,y:j.k.y-b[1]*2.6+r[1]*(k?1:-1)*0.6,tgt:null,tt:0,ph:0,home:false}); } } continue; }
    if(j.st==='treat'){ const left=j.cas.filter(p=>p.cas&&!p.fix); let busy=false;
      for(const m of j.crew){ if(m.tgt&&!m.tgt.cas){ m.tgt=null; }
        if(!m.tgt&&!m.home){ const p=left.find(p=>!j.crew.some(o=>o!==m&&o.tgt===p)); if(p) m.tgt=p; }
        if(m.tgt){ busy=true; const p=m.tgt, dx=p.x+0.9-m.x, dy=p.y-m.y, d=Math.hypot(dx,dy); if(d>0.25){ const s=Math.min(d,1.9*dt); m.x+=dx/d*s; m.y+=dy/d*s; m.ph+=dt*9; m.dir=[dx/d,dy/d]; m.kneel=0; }
          else { m.kneel=1; p.prog=(p.prog||0)+dt/4.5; if(p.prog>=1){ p.cas=false; p.down=0; p.fix=1; p.treatedT=timeS; p.flee=0; AMBU.treated++; m.tgt=null; } } } }
      if(!busy&&!left.length){ let all=true; const b=fwd(j.k.h); for(const m of j.crew){ m.home=true; const hx=j.k.x-b[0]*2.6, hy=j.k.y-b[1]*2.6, dx=hx-m.x, dy=hy-m.y, d=Math.hypot(dx,dy); m.kneel=0; if(d>0.3){ all=false; const s=Math.min(d,1.9*dt); m.x+=dx/d*s; m.y+=dy/d*s; m.ph+=dt*9; m.dir=[dx/d,dy/d]; } }
        if(all){ j.crew=[]; j.st='return'; j.t=0; const nv=emToTraffic(j.k.x,j.k.y,'ambulance'); j.v=nv; if(nv){ nv.amb=j; nv.pinT=timeS+1e6; if(j.h&&typeof aiGoal==='function') aiGoal(nv,{entrance:emRoadPt(j.h),name:j.h.name}); nv.pinT=timeS+1e6; j.k=null; } } }
      continue; }
    if(j.st==='return'){ if(!j.v){ if(j.k&&j.t>3){ j.done=true; } else if(!j.k) j.done=true; if(j.done&&j.bay) AMBU.parked.set(j.bay,true); continue; }
      const v=j.v; if(!traffic.vs.includes(v)||!j.h){ j.done=true; if(j.bay) AMBU.parked.set(j.bay,true); continue; } const e=emRoadPt(j.h);
      if(Math.hypot(v.x-e.x,v.y-e.y)<14||j.t>420){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } const s=j.h, b=j.bay;
        j.k={x:v.x,y:v.y,h:v.h,path:[[s.entrance.x,e.y+1],[s.entrance.x,s.entrance.y+3*M_T],b?[b.x,b.y-4]:[s.entrance.x,s.entrance.y+4*M_T],b?[b.x,b.y]:[s.entrance.x,s.entrance.y+5*M_T]]}; j.st='park'; j.t=0; } continue; }
    if(j.st==='park'){ if(emFollow(j.k,dt,3.5)||j.t>40){ if(j.bay) AMBU.parked.set(j.bay,true); j.done=true; } } }
  AMBU.jobs=AMBU.jobs.filter(j=>!j.done);
  // casualties far from everything (player left): resolved off-screen so nothing is lost
  for(const p of traffic.peds) if(p.cas&&Math.hypot(p.x-truck.x,p.y-truck.y)>1400){ p.cas=false; p.down=0; } }
function ambDrawMedic(m){ const X=m.x*PPM, Y=m.y*PPM; ctx.save(); ctx.translate(X,Y); ctx.rotate(m.dir?ang(m.dir[0],m.dir[1]):0); ctx.scale(2.1,2.1);
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(2,2,3.6,2.6,0,0,7); ctx.fill(); if(!m.kneel){ const sw=Math.sin(m.ph)*2.2; ctx.fillStyle='#1f3b2a'; ctx.fillRect(-2.2,-1+sw,1.6,3.2); ctx.fillRect(0.6,-1-sw,1.6,3.2); }
  ctx.fillStyle='#2e7d32'; ctx.beginPath(); ctx.ellipse(0,0,3.6,2.3,0,0,7); ctx.fill(); ctx.fillStyle='#f2e600'; ctx.fillRect(-3.4,-0.5,6.8,1.1); ctx.fillStyle='#3a2a1a'; ctx.beginPath(); ctx.arc(0,0.2,1.7,0,7); ctx.fill(); ctx.restore(); }
function drawAmbulance(vx0,vy0,vx1,vy1){ ambParkedInit(); const inV=(x,y)=>x*PPM>vx0-80&&x*PPM<vx1+80&&y*PPM>vy0-80&&y*PPM<vy1+80;
  for(const [b,on] of AMBU.parked) if(on&&inV(b.x,b.y)) emBlit({x:b.x,y:b.y,h:b.h},'ambulance');
  for(const j of AMBU.jobs){ const v=j.st==='go'||j.st==='return'?j.v:j.k; if(!v) continue; if(j.k&&inV(j.k.x,j.k.y)) emBlit(j.k,'ambulance'); if(inV(v.x,v.y)) emDrawBar(v,j.st==='go'||j.st==='pull'||j.st==='treat','ambulance');
    for(const m of j.crew) if(inV(m.x,m.y)) ambDrawMedic(m);
    for(const p of j.cas) if(p.cas&&p.prog>0&&inV(p.x,p.y)){ const X=p.x*PPM, Y=p.y*PPM-40; ctx.save(); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(X,Y,13,0,7); ctx.fill(); ctx.lineWidth=4; ctx.strokeStyle='#3ddc84'; ctx.beginPath(); ctx.arc(X,Y,11,-Math.PI/2,-Math.PI/2+6.283*Math.min(1,p.prog)); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.fillRect(X-1.5,Y-6,3,12); ctx.fillRect(X-6,Y-1.5,12,3); ctx.restore(); } } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ ambUpdate(dt); }catch(e){ console.warn('[ambulance]',e); } };
  if(typeof BigRig!=='undefined') BigRig.ambulance=()=>({jobs:AMBU.jobs.map(j=>j.st),treated:AMBU.treated,dispatched:AMBU.dispatched}); },0);
