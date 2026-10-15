'use strict';
// ===================== v29 FIRES: buildings near the player catch fire; the nearest fire station's engine responds =====================
// Flow: fire starts (flames + smoke + night glow + map marker) -> engine leaves its station (roller door opens) or, if the station is
// far, appears on a road just out of view -> blue lights + siren, traffic yields (EMY) -> parks near the fire -> roof cannon sprays
// until the fire goes out -> returns to its station without siren and reverses into its bay (despawns if far off screen and unwatched).
// Hook for later (vehicle fires etc.): fireStart({x,y,r,kind:'vehicle',o:null}) returns the fire record.
const FIRE={list:[],t:120+Math.random()*180,eng:[],out:new Set(),started:0,doneN:0};
function fireArt(){ if(EMV.arts.fire) return EMV.arts.fire; const L=7.4,W=2.45,c=vCanvas(L,W),g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS;
  g.fillStyle='#121212'; for(const fy of [0.9,L-2.2,L-1.1]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.2:0.04)),Y(fy),0.24*VS,0.75*VS);
  g.fillStyle=grad(g,X(-W/2),X(W/2),'#c8102e'); rr(g,X(-W/2),Y(0),W*VS,L*VS,0.3*VS); g.fill(); g.strokeStyle='rgba(0,0,0,0.5)'; g.lineWidth=1.5; g.stroke();
  g.fillStyle='#1b2836'; rr(g,X(-W/2+0.2),Y(0.25),(W-0.4)*VS,0.7*VS,0.15*VS); g.fill(); g.fillStyle='rgba(160,200,230,0.35)'; g.fillRect(X(-W/2+0.3),Y(0.3),(W-0.6)*VS,0.22*VS);
  g.fillStyle='#e8e8e8'; g.fillRect(X(-W/2+0.1),Y(1.2),(W-0.2)*VS,0.12*VS);                                    // cab/body split
  g.fillStyle='#9aa0a6'; g.fillRect(X(-0.75),Y(1.6),0.18*VS,(L-2.0)*VS); g.fillRect(X(0.57),Y(1.6),0.18*VS,(L-2.0)*VS); for(let k=1.8;k<L-0.5;k+=0.45) g.fillRect(X(-0.75),Y(k),1.5*VS,0.08*VS);   // ladder
  g.fillStyle='#f2e600'; for(const s of [-1,1]) g.fillRect(s<0?X(-W/2+0.02):X(W/2-0.16),Y(1.3),0.14*VS,(L-1.5)*VS);  // reflective flank stripes
  g.fillStyle='#d9d9d9'; g.beginPath(); g.arc(X(0),Y(1.45),0.28*VS,0,7); g.fill(); g.fillStyle='#555'; g.fillRect(X(-0.07),Y(0.9),0.14*VS,0.55*VS);   // roof monitor (water cannon)
  const by=0.05; g.fillStyle='#222'; g.fillRect(X(-W/2+0.3),Y(by),(W-0.6)*VS,0.22*VS);
  const a={body:{c,sh:shadowOf(c)},L,W,kind:'van',bar:L/2-by-0.1}; return EMV.arts.fire=a; }
function fireStations(){ return typeof SVC!=='undefined'?SVC.byType.fire:[]; }
function fireStart(o){ const f=Object.assign({int:1,t:0,st:'burn',r:12,ph:Math.random()*9,id:++FIRE.started},o); FIRE.list.push(f); fireDispatch(f); return f; }
function firePickBuilding(){ const P=truck, c=[]; for(const o of world.objects){ if(o.kind!=='bldg'||o._dead||o.w<40||o.h<40) continue; const x=(o.x+o.w/2)/PPM, y=(o.y+o.h/2)/PPM, d=Math.hypot(x-P.x,y-P.y); if(d<50||d>260||FIRE.list.some(f=>f.o===o)) continue; c.push({o,x,y,r:Math.min(22,Math.max(o.w,o.h)/PPM*0.45)}); } return c.length?c[(Math.random()*c.length)|0]:null; }
function fireEngNear(x,y){ let st=null,bd=1e18; for(const s of fireStations()){ const d=(s.x-x)**2+(s.y-y)**2; if(d<bd){ bd=d; st=s; } } return [st,Math.sqrt(bd)]; }
function fireDispatch(f){ const [st,d]=fireEngNear(f.x,f.y); const e={f,st,stt:'out',t:0,v:null,k:null,siren:null,far:!st||d>900,bay:null};
  if(st){ const free=st.bays.filter(b=>b.kind==='appliance'&&!FIRE.out.has(b)); e.bay=free[0]||null; }
  if(!e.far&&e.bay){ FIRE.out.add(e.bay); const hs=st.parts.house, dy=(hs.y)*M_T+1.5; e.k={x:e.bay.x,y:dy,h:0,path:[[e.bay.x,e.bay.y],[e.bay.x,st.entrance.y+1.5]],t:0}; e.door=1; e.siren=emSiren(); }
  else e.stt='spawn'; FIRE.eng.push(e); return e; }
function fireTraffic(e,x,y){ const v=emToTraffic(x,y,'fire'); if(!v) return null; v.role='fire'; v.art={body:fireArt().body}; v.fireE=e; v.pinT=timeS+1e6; return v; }
function fireSpawnFar(e){ const R=typeof ambViewR==='function'?ambViewR():120, f=e.f; for(let t=0;t<40;t++){ const a=Math.random()*6.283, d=R*(e.tt>3?0.8:1.5)+30+Math.random()*R*0.4, x=f.x+Math.cos(a)*d, y=f.y+Math.sin(a)*d, tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(!inb(tx,ty)) continue;
    const i=idx(tx,ty); if(world.roadH[i]<0&&world.roadV[i]<0||onScreen(x,y,12)) continue; const v=spawnVehicle(x,y,true,{kind:'van'}); if(!v) continue; if(onScreen(v.x,v.y,8)||!aiGoal(v,{entrance:{x:f.x,y:f.y},name:'fire'})){ const k=traffic.vs.indexOf(v); if(k>=0) traffic.vs.splice(k,1); continue; }
    v.role='fire'; v.art={body:fireArt().body}; v.fireE=e; v.pinT=timeS+1e6; return v; } return null; }
function fireDrop(v){ const i=traffic.vs.indexOf(v); if(i>=0){ releaseJ(v); traffic.vs.splice(i,1); } }
function fireUpdate(dt){ if(!world.ready||typeof started!=='undefined'&&!started||(typeof uiBlocking==='function'&&uiBlocking())) return;
  FIRE.t-=dt*(Math.abs(truck.v)>2?1:0.5); if(FIRE.t<=0){ FIRE.t=150+Math.random()*300; if(FIRE.list.length<1){ const b=firePickBuilding(); if(b) fireStart(b); } }
  for(const f of FIRE.list){ f.t+=dt; if(f.st==='burn') f.int=Math.min(1.25,f.int+dt*0.004); }
  for(const e of FIRE.eng){ e.t+=dt; e.tt=(e.tt||0)+dt; const f=e.f; if(e.siren) e.siren.set(emSirenVol((e.v||e.k||f).x,(e.v||e.k||f).y));
    if(e.stt==='out'){ if(e.door<2) e.door=Math.min(2,e.door+dt*0.6); if(e.door<1.6) continue; if(emFollow(e.k,dt,4)){ const v=fireTraffic(e,e.k.x,e.k.y-2); if(v&&aiGoal(v,{entrance:{x:f.x,y:f.y},name:'fire'})){ e.v=v; e.k=null; e.stt='go'; e.t=0; e.best=1e9; } else if(v){ fireDrop(v); } } continue; }
    if(e.stt==='spawn'){ if(e.t<0.5) continue; e.t=0; const v=fireSpawnFar(e); if(v){ e.v=v; e.stt='go'; e.best=1e9; e.siren=emSiren(); } continue; }
    if(e.stt==='go'){ const v=e.v; if(!traffic.vs.includes(v)){ e.stt=e.far?'spawn':'spawn'; e.far=true; continue; } const d=Math.hypot(v.x-f.x,v.y-f.y); if(d<e.best-1){ e.best=d; e.prog=e.t; }
      if(d<f.r+22||(d<f.r+60&&e.t-(e.prog||0)>6)){ fireDrop(v); e.k={x:v.x,y:v.y,h:v.h,path:[]}; e.v=null; e.stt='spray'; e.t=0; } else if(e.t-(e.prog||0)>16&&!onScreen(v.x,v.y,10)){ fireDrop(v); e.v=null; e.stt='spawn'; e.t=0; e.tt=99; e.far=true; FIRE.respawn=(FIRE.respawn||0)+1; } continue; }
    if(e.stt==='spray'){ f.st='fight'; f.int-=dt/18; if(e.siren&&e.t>4){ e.siren.stop(); e.siren=null; } if(f.int<=0){ f.int=0; f.st='out'; e.stt='back'; e.t=0; FIRE.doneN++; } continue; }
    if(e.stt==='back'){ if(!e.v){ if(e.t<3) continue; e.t=0; const v=fireTraffic(e,e.k.x,e.k.y); if(!v){ if(!onScreen(e.k.x,e.k.y,10)) e.done=true; continue; } e.v=v; e.k=null; if(!(e.st&&aiGoal(v,{entrance:emRoadPt(e.st),name:e.st.name}))) e.noRoute=true; continue; }
      const v=e.v; if(!traffic.vs.includes(v)){ e.done=true; continue; } const R=typeof ambViewR==='function'?ambViewR():120, far=!onScreen(v.x,v.y,20)&&Math.hypot(v.x-truck.x,v.y-truck.y)>R*1.6+60;
      if(e.st&&!e.noRoute){ const p=emRoadPt(e.st); if(Math.hypot(v.x-p.x,v.y-p.y)<14){ const b=e.bay||e.st.bays.find(b=>b.kind==='appliance'&&!FIRE.out.has(b)); fireDrop(v); e.v=null; if(b){ FIRE.out.add(b); e.bay=b; } e.k={x:v.x,y:v.y,h:v.h,path:b?[[b.x,e.st.entrance.y+1.5],[b.x,b.y]]:[]}; e.stt='park'; e.door=2; continue; } }
      if(far||e.noRoute&&!onScreen(v.x,v.y,20)){ fireDrop(v); e.done=true; } continue; }
    if(e.stt==='park'){ if(emFollow(e.k,dt,3)){ e.door=Math.max(0,e.door-dt*0.6); if(e.door<=0) e.done=true; } } }
  for(const e of FIRE.eng) if(e.done&&e.bay) FIRE.out.delete(e.bay);
  FIRE.eng=FIRE.eng.filter(e=>!e.done); FIRE.list=FIRE.list.filter(f=>f.st!=='out'||FIRE.eng.some(e=>e.f===f&&e.stt==='spray'));
  for(const f of FIRE.list) if(Math.hypot(f.x-truck.x,f.y-truck.y)>2000){ f.st='out'; } }
// ---- drawing
function fireDraw(vx0,vy0,vx1,vy1){ fireArt(); const inV=(x,y,m)=>x*PPM>vx0-m&&x*PPM<vx1+m&&y*PPM>vy0-m&&y*PPM<vy1+m, T=timeS;
  // parked engines (bays) except those out on a call; doors drawn open while an engine is passing
  for(const s of fireStations()){ if(!inV(s.x,s.y,300)) continue; for(const b of s.bays) if(b.kind==='appliance'&&!FIRE.out.has(b)) emBlitF({x:b.x,y:b.y,h:0}); }
  for(const e of FIRE.eng){ if(e.st&&e.door>0&&e.bay){ const hs=e.st.parts.house, X=e.bay.x*PPM, Y=hs.y*TILE, w=(hs.w*TILE-16)/3, op=Math.min(1,e.door/1.5); ctx.save(); ctx.fillStyle='rgba(15,15,18,'+(0.85*op)+')'; ctx.fillRect(X-w/2,Y-2,w,16*op); ctx.restore(); }
    const v=e.v||e.k; if(!v||!inV(v.x,v.y,80)) continue; if(e.k) emBlitF(e.k); emDrawBar(v,e.stt==='go'||e.stt==='out'||e.stt==='spray','fire');
    if(e.stt==='spray'&&e.k){ const f=e.f, a=fwd(e.k.h), sx=(e.k.x+a[0]*(fireArt().L/2-1.45))*PPM, sy=(e.k.y+a[1]*(fireArt().L/2-1.45))*PPM, tx=f.x*PPM, ty=f.y*PPM; ctx.save(); ctx.lineCap='round';
      for(let k=0;k<3;k++){ const w=Math.sin(T*6+k)*6; ctx.strokeStyle='rgba(190,225,255,'+(0.55-k*0.14)+')'; ctx.lineWidth=5-k*1.3; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo((sx+tx)/2+w,(sy+ty)/2-30,tx+w,ty+w*0.5); ctx.stroke(); }
      ctx.fillStyle='rgba(220,240,255,0.5)'; for(let k=0;k<10;k++){ const u=((T*1.7+k*0.1)%1), px=tx+Math.sin(k*7.1+T*3)*14*u, py=ty+Math.cos(k*3.3+T*2)*10*u; ctx.beginPath(); ctx.arc(px,py,2+3*u,0,7); ctx.fill(); } ctx.restore(); } }
  for(const f of FIRE.list){ if(f.int<=0||!inV(f.x,f.y,200)) continue; const R=f.r*PPM, n=Math.round(10+f.int*16); ctx.save();
    for(let k=0;k<n;k++){ const a=k*2.399, rr=Math.sqrt((k+0.5)/n)*R*0.8, x=f.x*PPM+Math.cos(a)*rr, y=f.y*PPM+Math.sin(a)*rr, fl=0.6+0.4*Math.sin(T*9+k*1.7), s=(6+f.int*9)*fl;
      ctx.fillStyle='rgba(255,'+(90+((k*37)%90))+',20,'+(0.55*f.int)+')'; ctx.beginPath(); ctx.arc(x,y,s,0,7); ctx.fill(); ctx.fillStyle='rgba(255,230,120,'+(0.5*f.int)+')'; ctx.beginPath(); ctx.arc(x,y-s*0.2,s*0.45,0,7); ctx.fill(); }
    for(let k=0;k<14;k++){ const u=((T*0.18+k/14)%1), x=f.x*PPM+Math.sin(k*5.3)*R*0.5+u*90, y=f.y*PPM-u*140+Math.cos(k*2.1)*10, s=R*0.25+u*R*0.9; ctx.fillStyle='rgba(60,60,64,'+((1-u)*0.35*Math.min(1,f.int+0.3))+')'; ctx.beginPath(); ctx.arc(x,y,s,0,7); ctx.fill(); }
    ctx.restore(); if(typeof dnLight==='function') dnLight(f.x*PPM,f.y*PPM,R*3+80,'rgba(255,140,40,0.95)',0.9*Math.min(1,f.int)); } }
function emBlitF(v){ const a=fireArt(); blitV(a.body.sh,v.x,v.y,v.h,a.L,a.W,4,4); blitV(a.body.c,v.x,v.y,v.h,a.L,a.W,0,0); }
function fireMapDots(px,py){ const ph=(timeS*3)%1<0.5; for(const f of FIRE.list){ if(f.int<=0) continue; const X=px(f.x),Y=py(f.y); ctx.save(); ctx.fillStyle=ph?'#ff6a00':'#ffd000'; ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(X,Y,6,0,7); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('\u{1F525}',X,Y+0.5); ctx.restore(); }
  for(const e of FIRE.eng){ const v=e.v||e.k; if(!v) continue; ctx.fillStyle=ph?'#ff2030':'#2a5bff'; ctx.beginPath(); ctx.arc(px(v.x),py(v.y),4,0,7); ctx.fill(); } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ fireUpdate(dt); }catch(e){ console.warn('[fire]',e); } };
  const dt0=drawTraffic; drawTraffic=function(a,b,c,d){ const r=dt0.apply(this,arguments); try{ fireDraw(a,b,c,d); }catch(e){ console.warn('[fire draw]',e); } return r; };
  if(typeof svcMapIcons==='function'){ const sm=svcMapIcons; svcMapIcons=function(icon,px,py){ sm.apply(this,arguments); try{ fireMapDots(px,py); }catch(e){} }; }
  if(typeof emSources==='function'){ const es=emSources; emSources=function(){ const o=es(); for(const e of FIRE.eng){ if(e.stt==='go'&&e.v) o.push(e.v); else if(e.stt==='out'&&e.k) o.push(e.k); } return o; }; }
  if(typeof BigRig!=='undefined'){ BigRig.fireStart=fireStart; BigRig.fires=()=>({fires:FIRE.list.map(f=>f.st+':'+f.int.toFixed(2)),eng:FIRE.eng.map(e=>e.stt),done:FIRE.doneN}); } },0);
