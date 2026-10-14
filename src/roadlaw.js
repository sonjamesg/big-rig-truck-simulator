'use strict';
// ===================== ROAD LAW: offences & fines (one module), UK speed limits, speed cameras =====================
// Hook points for later emergency services:
//  - OFF.add({type,amount,reason}) records an offence and fines the player; OFF.on(fn) lets police / courts listen in.
//  - AI vehicles carry v.role ('civilian' by default; 'police' | 'ambulance' | 'fire' reserved). ROLES lists them.
//  - Services (hospital, fire_station, police_station) can register with OFF.services.push({kind,x,y,name}).
const ROLES=['civilian','police','ambulance','fire'];
const OFF={list:[],subs:[],services:[],total:0,
  on(fn){ this.subs.push(fn); },
  add(o){ const r=Object.assign({t:typeof timeS!=='undefined'?timeS:0,x:truck.x,y:truck.y,amount:0},o); this.list.push(r); if(this.list.length>50) this.list.shift();
    if(r.amount>0){ truck.money-=r.amount; this.total+=r.amount; } for(const f of this.subs){ try{ f(r); }catch(e){} }
    if(typeof BigRig!=='undefined'&&BigRig.emit) BigRig.emit('offence',r); return r; } };

// ---- speed limits (UK mph). Game speeds are scaled so a 70 limit sits right at a stock truck's governor (≈90 km/h on the dial).
const SPL={SCALE:0.8, cur:30, seg:null, tol:1.1};
function slKmh(mph){ return mph*1.609*SPL.SCALE; }
function slOfSeg(sg){ if(!sg) return null; if(sg.limit) return sg.limit; const t=sg.type, w=sg.w||2, L=(sg.b1-sg.b0)||0; let m=30;
  if(t==='hwy') m=70; else if(t==='dual') m=70;
  else if(t==='rural') m=w>=6?50:60; else if(t==='lane') m=60; else if(t==='dirt') m=40;
  else if(t==='city'||t==='town'||t==='res'){ m=L>=800?50:L>=380?40:30; if(t==='res') m=30; }
  sg.limit=m; return m; }
function slSegAt(x,y){ const tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(typeof inb==='function'&&!inb(tx,ty)) return null; const i=idx(tx,ty); let id=world.roadH[i]; if(id<0) id=world.roadV[i]; return id>=0?world.segs[id]:null; }

// ---- speed cameras
const CAM={list:[],built:false,flash:0,cd:22};
function camBuild(){ if(CAM.built||!world.ready) return; CAM.built=true; let seed=91; const R=()=>{ seed=(seed*16807)%2147483647; return (seed-1)/2147483646; };
  const reg=new Map(), RG=420; const nearJ=(x,y)=>(world.junctions||[]).some(J=>x>J.x-9&&x<J.x+J.w+9&&y>J.y-9&&y<J.y+J.h+9);
  const cand=world.segs.filter(sg=>sg&&sg.b1-sg.b0>=50&&['city','town','hwy','dual','rural'].includes(sg.type)).map(sg=>({sg,w:(sg.type==='city'||sg.type==='town'?3:sg.type==='rural'?1:2)*R()})).sort((a,b)=>b.w-a.w);
  for(const {sg} of cand){ const al=Math.round(sg.b0+(sg.b1-sg.b0)*(0.3+R()*0.4)), h=sg.dir==='h'; const cx=h?al:sg.a+sg.w/2, cy=h?sg.a+sg.w/2:al; if(nearJ(cx,cy)) continue;
    const k=Math.floor(cx/RG)+','+Math.floor(cy/RG), n=reg.get(k)||0; if(n>=3) continue; if(CAM.list.some(c=>Math.hypot(c.cx-cx,c.cy-cy)<60)) continue;
    reg.set(k,n+1); const px=h?al:sg.a-0.9, py=h?sg.a-0.9:al;   // post on the verge
    if(typeof get==='function'&&(get(Math.floor(px),Math.floor(py))===T.WATER||get(Math.floor(px),Math.floor(py))===T.BLDG)) continue;
    CAM.list.push({sg,al,h,cx,cy,px,py,last:-1e9}); if(CAM.list.length>=60) break; } }
function camSound(){ try{ const c=audio.ctx; if(!c||!(SETTINGS.vol>0)) return; if(typeof noiseBurst==='function') noiseBurst(0.08,3200,0.8,0.5,'highpass'); const o=c.createOscillator(), g=c.createGain(), t=c.currentTime; o.type='square'; o.frequency.setValueAtTime(1800,t); o.frequency.exponentialRampToValueAtTime(600,t+0.12); g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15); o.connect(g); g.connect(audio.master||c.destination); o.start(t); o.stop(t+0.16); }catch(e){} }
let CAMP=null;
function updateRoadLaw(dt){ if(!world.ready||!started) return; camBuild(); CAM.flash=Math.max(0,CAM.flash-dt*3);
  for(const v of traffic.vs) if(!v.role) v.role='civilian';
  const sg=slSegAt(truck.x,truck.y); if(sg){ SPL.seg=sg; SPL.cur=slOfSeg(sg); }
  const tx=truck.x/M_T, ty=truck.y/M_T, kmh=Math.abs(truck.v)*3.6;
  if(CAMP&&!(typeof BREAKDOWN!=='undefined'&&BREAKDOWN.active)){ for(const c of CAM.list){ const sg2=c.sg, lo=sg2.a-1.2, hi=sg2.a+sg2.w+1.2;
      const crossed=c.h?((CAMP[0]-c.al)*(tx-c.al)<=0&&CAMP[0]!==tx&&ty>lo&&ty<hi):((CAMP[1]-c.al)*(ty-c.al)<=0&&CAMP[1]!==ty&&tx>lo&&tx<hi);
      if(!crossed||timeS-c.last<CAM.cd) continue; const lim=slOfSeg(sg2); if(kmh<=slKmh(lim)*SPL.tol+2) continue; c.last=timeS; CAM.flash=1; camSound();
      const mph=Math.round(kmh/1.609/SPL.SCALE); OFF.add({type:'speeding',amount:100,reason:mph+' in a '+lim,cam:c,limit:lim,kmh:Math.round(kmh)});
      toast('\u{1F4F8} Speed camera \u2022 '+mph+' in a '+lim+' \u2022 \u2212\u00a3100 fine'); } }
  CAMP=[tx,ty]; }

// ---- drawing
function slRoundel(x,y,r,mph){ ctx.save(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.strokeStyle='#d0021b'; ctx.lineWidth=r*0.2; ctx.beginPath(); ctx.arc(x,y,r*0.88,0,7); ctx.stroke();
  ctx.fillStyle='#111'; ctx.font='900 '+Math.round(r*(mph>=100?0.75:0.95))+'px Arial,system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(mph),x,y+r*0.06); ctx.restore(); }
function drawRoadLawHUD(){ if(!started) return; const gx=14, gy=VH-150, gw=186, r=VW<520?20:24, x=gx+gw+12+r, y=gy+136-r-4, over=Math.abs(truck.v)*3.6>slKmh(SPL.cur)*SPL.tol+2;
  ctx.save(); ctx.fillStyle='rgba(10,14,22,0.6)'; ctx.beginPath(); ctx.arc(x,y,r+5,0,7); ctx.fill(); if(over&&(timeS*3)%1<0.5){ ctx.strokeStyle='#ff3b30'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x,y,r+5,0,7); ctx.stroke(); } ctx.restore();
  slRoundel(x,y,r,SPL.cur); ctx.save(); ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font='bold 9px system-ui'; ctx.textAlign='center'; ctx.fillText('\u2248'+Math.round(slKmh(SPL.cur))+' km/h',x,y+r+14); ctx.restore();
  if(CAM.flash>0){ ctx.save(); ctx.fillStyle='rgba(255,255,255,'+(0.85*CAM.flash*CAM.flash)+')'; ctx.fillRect(0,0,VW,VH); ctx.restore(); } }
function drawCameras(vx0,vy0,vx1,vy1){ const S=TILE, K=typeof DN!=='undefined'?DN.dark:0; for(const c of CAM.list){ const x=c.px*S, y=c.py*S; if(x<vx0-80||x>vx1+80||y<vy0-80||y>vy1+80) continue;
    ctx.save(); // calibration marks across the carriageway
    ctx.fillStyle='rgba(255,255,255,0.7)'; for(let k=0;k<4;k++){ const q=(c.al+1.5+k*1.6)*S; for(const e of [c.sg.a+0.25,c.sg.a+c.sg.w-0.25]){ if(c.h) ctx.fillRect(q-0.25*S,e*S-2,0.5*S,4); else ctx.fillRect(e*S-2,q-0.25*S,4,0.5*S); } }
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x-7+6,y-12+6,14,24); ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(x,y,4,0,7); ctx.fill();
    ctx.translate(x,y); if(!c.h) ctx.rotate(Math.PI/2); ctx.fillStyle='#f7c600'; ctx.fillRect(-11,-7,22,14); ctx.strokeStyle='#222'; ctx.lineWidth=1.5; ctx.strokeRect(-11,-7,22,14);
    ctx.fillStyle='#222'; ctx.fillRect(-11,-1.5,22,3); ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(6,0,3.5,0,7); ctx.fill(); ctx.restore();
    if(K>0.05&&typeof dnLight==='function') dnLight(x,y,30,'rgba(255,220,120,0.7)',0.35);
    if(timeS-c.last<0.25&&typeof dnLight==='function') dnLight(x,y,220,'rgba(255,255,255,1)',1); } }
function drawCamMap(BX,BY,z){ const big=typeof bigmap!=='undefined'&&bigmap.open; const s=big?Math.max(4,Math.min(9,z*2)):3.5;
  ctx.save(); for(const c of CAM.list){ const x=BX(c.px), y=BY(c.py); if(!big&&(x<MM.x||y<MM.y||x>MM.x+MM.w||y>MM.y+MM.h)) continue; if(big&&(x<-10||y<-10||x>VW+10||y>VH+10)) continue;
    ctx.fillStyle='#f7c600'; ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.fillRect(x-s,y-s*0.7,2*s,1.4*s); ctx.strokeRect(x-s,y-s*0.7,2*s,1.4*s); ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(x+s*0.35,y,s*0.35,0,7); ctx.fill(); } ctx.restore(); }

// ---- hooks (deferred: main.js defines these after us)
setTimeout(()=>{
  const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ updateRoadLaw(dt); }catch(e){ console.warn(e); } };
  const dh=drawHUD; drawHUD=function(){ dh.apply(this,arguments); if(!(typeof bigmap!=='undefined'&&bigmap.open)) drawRoadLawHUD(); };
  const dl=drawPortLow; drawPortLow=function(vx0,vy0,vx1,vy1){ drawCameras(vx0,vy0,vx1,vy1); return dl.apply(this,arguments); };
  if(typeof portMapTrucks==='function'){ const pm=portMapTrucks; portMapTrucks=function(BX,BY,z){ const r=pm.apply(this,arguments); drawCamMap(BX,BY,z); return r; }; }
},0);
