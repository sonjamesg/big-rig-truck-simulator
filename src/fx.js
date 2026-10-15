'use strict';
// ===================== v14 FX: exhaust puffs, wheel-lock skid marks/smoke, crash explosions =====================
const FX_CRASH_V=19;   // m/s (~43 mph) impact speed that destroys the rig
const FX={p:[],marks:[],lastThr:0,puffT:0,skT:0,boom:null};
function fxEmit(x,y,vx,vy,r,life,col,grow,fire){ if(FX.p.length>500) FX.p.shift(); FX.p.push({x,y,vx,vy,r,life,t:0,col,grow,fire}); }
function updateFX(dt){ const s=truck, f=fwd(s.h), r=rgt(s.h); const st=(modelById(career.cur).style)||{};
  if(st.stacks&&!FX.boom&&started){ FX.puffT-=dt; const acc=s.throttle>0.45&&(s.throttle-FX.lastThr>0.01||s.shiftT>0.25||Math.abs(s.v)<5);
    if(acc&&FX.puffT<=0){ FX.puffT=0.08+Math.random()*0.1; for(const sd of [-1,1]) fxEmit(s.x+f[0]*2.9+r[0]*sd*1.0,s.y+f[1]*2.9+r[1]*sd*1.0,-f[0]*1.2+(Math.random()-.5)*0.8+s.v*f[0]*0.5,-f[1]*1.2+(Math.random()-.5)*0.8+s.v*f[1]*0.5,0.3,1.0,'55,55,58',1.2); } }
  FX.lastThr=s.throttle;
  if(s.skid){ const pts=[[s.x-f[0]*0.2,s.y-f[1]*0.2,s.h]]; if(s.trl){ const k=kingpin(s), ft=fwd(s.th); pts.push([k[0]-ft[0]*10.6,k[1]-ft[1]*10.6,s.th]); }
    for(const [x,y,h] of pts){ const rr=rgt(h); for(const sd of [-1,1]) FX.marks.push({x:x+rr[0]*sd*1.0,y:y+rr[1]*sd*1.0,t:timeS}); if(Math.random()<0.5) fxEmit(x,y,(Math.random()-.5)*2,(Math.random()-.5)*2,0.6,0.9,'235,235,235',2.2); }
    if(FX.marks.length>1600) FX.marks.splice(0,FX.marks.length-1600);
    FX.skT-=dt; if(FX.skT<=0){ FX.skT=0.22; try{ noiseBurst(0.26,2600,5,0.12); }catch(e){} } }
  for(const p of FX.p){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.97; p.vy*=0.97; p.r+=p.grow*dt; } FX.p=FX.p.filter(p=>p.t<p.life);
  const b=FX.boom; if(b){ b.t+=dt; if(b.t<1.6&&Math.random()<0.8) fxEmit(b.x+(Math.random()-.5)*3,b.y+(Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3,0.8,1.2,'40,40,40',2.4);
    if(Math.random()<0.6) fxEmit(b.x+(Math.random()-.5)*4,b.y+(Math.random()-.5)*4,(Math.random()-.5),(Math.random()-.5),0.6,0.5,'255,140,30',1.4,1);
    if(b.t>3.0){ FX.boom=null; const o=BREAKDOWN.options.find(o=>o.id==='respawn'); if(o) o.run(); flash('\u{1F4A5} Rig destroyed \u2014 towed to the nearest garage'); } } }
function fxExplode(hit){ const s=truck; if(FX.boom) return; if(career.uiOpen&&typeof closeUI==='function') closeUI(); const k=kingpin(s); FX.boom={t:0,x:s.x,y:s.y}; s.v=0; s.damage=Math.min(s.damage,99); s.skid=false;
  for(let i=0;i<70;i++){ const a=Math.random()*7, v=4+Math.random()*14; fxEmit(s.x,s.y,Math.cos(a)*v,Math.sin(a)*v,0.6+Math.random()*0.8,0.6+Math.random()*0.7,i%3?'255,'+(120+(Math.random()*100|0))+',20':'255,240,180',2.5,1); }
  for(let i=0;i<25;i++){ const a=Math.random()*7, v=2+Math.random()*5; fxEmit(s.x,s.y,Math.cos(a)*v,Math.sin(a)*v,1.2,2.2,'30,30,30',3); }
  try{ thump(1); noiseBurst(1.2,120,0.7,1.2,'lowpass'); }catch(e){} cam.shake=16; BigRig.emit('explode',{hit,x:s.x,y:s.y}); }
function drawFXLow(vx0,vy0,vx1,vy1){ if(!FX.marks.length) return; ctx.fillStyle='rgba(20,20,20,0.35)'; const now=timeS; for(const m of FX.marks){ const a=1-(now-m.t)/40; if(a<=0) continue; const x=m.x*PPM, y=m.y*PPM; if(x<vx0||x>vx1||y<vy0||y>vy1) continue; ctx.globalAlpha=a; ctx.fillRect(x-2,y-2,4,4); } ctx.globalAlpha=1; }
function drawFXHigh(){ const b=FX.boom; if(b){ const x=b.x*PPM, y=b.y*PPM, fl=Math.max(0,1-b.t/0.5); if(fl>0){ const g=ctx.createRadialGradient(x,y,4,x,y,220*(0.5+b.t)); g.addColorStop(0,'rgba(255,250,210,'+fl+')'); g.addColorStop(0.4,'rgba(255,150,40,'+fl*0.7+')'); g.addColorStop(1,'rgba(255,80,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,220*(0.5+b.t),0,7); ctx.fill(); }
    ctx.fillStyle='rgba(20,15,10,0.45)'; ctx.beginPath(); ctx.ellipse(x,y,70,40,truck.h,0,7); ctx.fill(); }
  for(const p of FX.p){ const a=Math.max(0,1-p.t/p.life); ctx.fillStyle='rgba('+p.col+','+(p.fire?a:a*0.45)+')'; ctx.beginPath(); ctx.arc(p.x*PPM,p.y*PPM,p.r*PPM,0,7); ctx.fill(); } }
