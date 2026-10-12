'use strict';
// ===================== v7 SITES: shopping malls / supermarkets (delivery docks), truck dealerships, forecourt art + visitor cars =====================
const OBJX={};
function buildCareerSites(K){
  const {findSpot,access,clearObjs,region,R,objs,okT}=K, M=v=>v*M_T; const t0=performance.now();
  world.malls=[]; world.dealers=[];
  const claim=(x,y,w,h,t)=>{ clearObjs(x,y,w,h); fill(x,y,w,h,t); for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) world.reserved[idx(i,j)]=1; };
  function makeMall(name,kind,x,y,w,h,gap,brand,col){
    access(x,y,w,gap); claim(x,y,w,h,T.CONC);
    const carW=kind==='mall'?13:9, bh=kind==='mall'?9:8, by=y+h-bh;                // building band along the back (south)
    fill(x+1,y+2,carW,by-y-3,T.LOT); objs.push({kind:'lot',x:(x+1)*TILE,y:(y+2)*TILE,w:carW*TILE,h:(by-y-3)*TILE,seed:(R()*1e9)|0});
    fill(x+1,by,w-2,bh-1,T.BLDG);
    const mall={id:'S'+(world.malls.length+1),name,kind,brand,col,x:M(x+w/2),y:M(y+h/2),entrance:{x:M(x+w/2),y:M(y-gap)},bays:[],region:region(x,y),tx:x,ty:y,w,h};
    objs.push({kind:'mall',x:(x+1)*TILE,y:by*TILE,w:(w-2)*TILE,h:(bh-1)*TILE,height:26,name,brand,col,mk:kind,seed:(R()*1e9)|0});
    const yx0=x+carW+2.2, nb=Math.max(3,Math.min(9,Math.floor((x+w-1-yx0)/1.55))), dock=M(by), L=17.2, bw=5.4;
    for(let k=0;k<nb;k++){ const cx=M(yx0)+k*6.2+3.1; const b={id:k+1,label:(mall.id)+'-'+(k+1),mall,cx,cy:dock-L/2,th:0,w:bw,L,dock,x0:cx-bw/2,x1:cx+bw/2,y0:dock-L,y1:dock,door:0,assigned:false};
      b.kx=cx; b.ky=dock-12.4-0.4; mall.bays.push(b); }
    objs.push({kind:'mallyard',x:M(yx0)*PPM-12,y:(dock-L-8)*PPM,w:(nb*6.2)*PPM+24,h:(L+8)*PPM,mall});
    objs.push({kind:'paint',x:(yx0+0.3)*TILE,y:(y+1.2)*TILE,text:'GOODS IN \u2022 HGV',small:true});
    objs.push({kind:'paint',x:(x+2)*TILE,y:(y+0.6)*TILE,text:'CUSTOMER PARKING',small:true});
    world.malls.push(mall); return mall; }
  const mplan=[
    ['Albion Central Mall','mall',300,470,'ALBION CENTRAL','#c0392b'],['Harbourside Retail Park','mall',140,120,'HARBOURSIDE','#2471a3'],['Albion FreshMart','super',470,180,'FRESHMART','#27ae60'],
    ['Sandvale Plaza','mall',1430,330,'SANDVALE PLAZA','#8e44ad'],['Dune Retail Park','mall',1720,560,'DUNE PARK','#d35400'],['Sandvale ValueStore','super',1880,250,'VALUESTORE','#e67e22'],
    ['Kingsbridge Galleria','mall',1560,1776,'GALLERIA','#16a085'],['Riverside Shopping Centre','mall',1830,1480,'RIVERSIDE','#2c3e50'],['Kingsbridge FreshMart','super',1420,1776,'FRESHMART','#27ae60'],
    ['Millford Co-op Superstore','super',290,906,'CO-OP','#1abc9c'],['Ashby Market Hall','super',255,1178,'MARKET HALL','#a93226'],['Dustwater Trading Post','super',1110,470,'TRADING POST','#b9770e'],
    ['Coppermine ValueStore','super',1710,640,'VALUESTORE','#e67e22'],['Redhill Retail Park','mall',1010,1266,'REDHILL PARK','#c0392b'],['Fenwick FreshMart','super',1520,1214,'FRESHMART','#27ae60'],['Wendwood Farm Store','super',500,904,'FARM STORE','#6e8b3d']];
  // anchor the search just south of the nearest horizontal non-motorway roads (sites need a road along their north edge)
  const hsegs=world.segs.filter(sg=>sg.dir==='h'&&sg.type!=='hwy'&&sg.b1-sg.b0>4);
  const find=(tx,ty,w,h)=>{ let s=findSpot(tx,ty,w,h); if(s) return s;
    const near=hsegs.map(sg=>{ const x=sg.b1-sg.b0<w+4?Math.round((sg.b0+sg.b1)/2-w/2):Math.max(sg.b0,Math.min(sg.b1-w,tx-w/2)); return {x,y:sg.a+sg.w+1,d:Math.hypot(x+w/2-tx,sg.a-ty)}; }).filter(c=>c.d<200).sort((p,q)=>p.d-q.d).slice(0,8);
    for(const c of near){ s=findSpot(Math.round(c.x),c.y,w,h); if(s) return s; } for(const c of near.slice(0,2)){ s=findSpot(Math.round(c.x),c.y+6,w,h,22); if(s) return s; } return null; };
  for(const [n,k,tx,ty,br,col] of mplan){ let kind=k, s=kind==='mall'?find(tx,ty,30,26):null; if(!s){ kind='super'; s=find(tx,ty,24,22); } if(!s){ console.warn('no mall spot',n); continue; }
    makeMall(n,kind,s[0],s[1],kind==='mall'?30:24,kind==='mall'?26:22,s[2],br,col); }
  world.tmMall=performance.now()-t0;
  // truck dealerships
  function dealer(name,x,y,gap){ const w=26,h=18; access(x,y,w,gap); claim(x,y,w,h,T.CONC);
    fill(x+15,y+7,10,10,T.BLDG); objs.push({kind:'dealer',x:(x+15)*TILE,y:(y+7)*TILE,w:10*TILE,h:10*TILE,height:16,name});
    const pad={x0:M(x+7),y0:M(y+1.5),x1:M(x+15),y1:M(y+7)}; objs.push({kind:'dpad',x:pad.x0*PPM,y:pad.y0*PPM,w:(pad.x1-pad.x0)*PPM,h:(pad.y1-pad.y0)*PPM});
    const shows=[]; for(let k=0;k<3;k++){ const o={kind:'showtruck',x:(x+2.5+k*4.2)*TILE,y:(y+12.5)*TILE,w:3*TILE,h:6*TILE,ang:-0.35+k*0.35,model:k+1}; objs.push(o); shows.push(o); }
    objs.push({kind:'bunting',x:(x+0.5)*TILE,y:(y+0.4)*TILE,w:(w-1)*TILE,h:12});
    const d={id:'T'+(world.dealers.length+1),name,x:M(x+w/2),y:M(y+h/2),entrance:{x:M(x+w/2),y:M(y-gap)},pad,region:region(x,y)}; world.dealers.push(d); return d; }
  for(const [n,tx,ty] of [['Big Rig Trucks Albion',520,560],['Sandreach Truck Centre',1500,600],['Highmoor Commercials',1480,1330]]){ const s=find(tx,ty,26,18); if(s) dealer(n,s[0],s[1],s[2]); else console.warn('no dealer spot',n); }
}
// ---------- static art for the chunk cache
const pill=(g,x,y,w,h,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
OBJX.hgvbay=(g,o)=>{ g.fillStyle='rgba(255,210,40,0.07)'; g.fillRect(o.x,o.y,o.w,o.h); g.fillStyle='#f2c230'; g.fillRect(o.x,o.y,4,o.h); g.fillRect(o.x+o.w-4,o.y,4,o.h); g.fillRect(o.x,o.y,o.w,4); g.fillRect(o.x,o.y+o.h-4,o.w,4);
  g.save(); g.translate(o.x+o.w/2,o.y+o.h*0.72); g.rotate(Math.PI/2); g.fillStyle='rgba(245,245,235,0.9)'; g.font='bold 22px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('HGV DIESEL '+o.n,0,0); g.restore();
  g.fillStyle='rgba(245,245,235,0.85)'; for(const yy of [o.y+50,o.y+o.h-60]){ g.beginPath(); g.moveTo(o.x+o.w/2-10,yy); g.lineTo(o.x+o.w/2+10,yy); g.lineTo(o.x+o.w/2,yy+14); g.closePath(); g.fill(); } };
OBJX.hgvisland=(g,o)=>{ g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(o.x+8,o.y+8,o.w,o.h); g.fillStyle='#d8d8d0'; pill(g,o.x+4,o.y,o.w-8,o.h,10); g.fill(); g.fillStyle='#f2c230'; g.fillRect(o.x+4,o.y,o.w-8,8); g.fillRect(o.x+4,o.y+o.h-8,o.w-8,8);
  for(const k of [0.32,0.68]){ const py=o.y+o.h*k; g.fillStyle='rgba(0,0,0,0.35)'; g.fillRect(o.x+10,py-10,o.w-8,30); g.fillStyle='#2b2f36'; g.fillRect(o.x+7,py-14,o.w-14,28); g.fillStyle=o.col; g.fillRect(o.x+7,py-14,o.w-14,7);
    g.fillStyle='#9fe39a'; g.fillRect(o.x+11,py-4,o.w-22,7); g.fillStyle='#111'; g.fillRect(o.x+3,py+2,4,10); g.fillRect(o.x+o.w-7,py+2,4,10); } };
OBJX.airw=(g,o)=>{ g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(o.x+4,o.y+4,18,12); g.fillStyle='#1f6fb2'; g.fillRect(o.x,o.y,18,12); g.fillStyle='#fff'; g.font='bold 7px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('AIR',o.x+9,o.y+6);
  g.strokeStyle='#222'; g.lineWidth=1.5; g.beginPath(); g.moveTo(o.x+18,o.y+6); g.quadraticCurveTo(o.x+30,o.y+2,o.x+26,o.y+16); g.stroke(); g.lineWidth=1; };
OBJX.pboard=(g,o)=>{ const x=o.x,y=o.y; g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(x+10,y+10,52,64); g.fillStyle='#22262d'; pill(g,x,y,52,64,5); g.fill(); g.fillStyle=o.col; pill(g,x+3,y+3,46,14,3); g.fill();
  g.fillStyle='#fff'; g.font='bold 9px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(o.brand,x+26,y+10);
  const rows=[['DIESEL',o.price],['HGV',o.price-0.04],['UNL',o.price-0.07]]; rows.forEach((r,i)=>{ const yy=y+26+i*13; g.fillStyle='#bbb'; g.font='bold 7px Arial'; g.textAlign='left'; g.fillText(r[0],x+5,yy); g.fillStyle='#ffb020'; g.font='bold 10px monospace'; g.textAlign='right'; g.fillText(r[1].toFixed(2),x+48,yy); }); };
OBJX.fcarrows=(g,o)=>{ const ar=(x,y,a)=>{ g.save(); g.translate(x,y); g.rotate(a); g.fillStyle='rgba(245,245,235,0.8)'; g.fillRect(-4,-14,8,18); g.beginPath(); g.moveTo(-11,4); g.lineTo(11,4); g.lineTo(0,18); g.closePath(); g.fill(); g.restore(); };
  ar(o.x+12.5*TILE,o.y+1.4*TILE,0); ar(o.x+15.5*TILE,o.y+1.6*TILE,Math.PI); ar(o.x+12.5*TILE,o.y+16.5*TILE,Math.PI/2); g.fillStyle='rgba(245,245,235,0.85)'; g.font='bold 22px sans-serif'; g.textBaseline='top'; g.fillText('IN',o.x+11.6*TILE,o.y+2.6*TILE); g.fillText('OUT',o.x+14.8*TILE,o.y+2.6*TILE); };
OBJX.mall=(g,o)=>{ drawShadowRect(g,o.x,o.y,o.w,o.h,o.height*0.55);
  const gr=g.createLinearGradient(o.x,o.y,o.x,o.y+o.h); gr.addColorStop(0,'#e9e6df'); gr.addColorStop(1,'#cfcac0'); g.fillStyle=gr; g.fillRect(o.x,o.y,o.w,o.h);
  g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=3; g.strokeRect(o.x+1.5,o.y+1.5,o.w-3,o.h-3); g.lineWidth=1;
  const r=mulberry(o.seed); g.fillStyle='rgba(150,200,230,0.75)'; for(let k=0;k<(o.mk==='mall'?5:3);k++){ const sx=o.x+o.w*0.08+k*o.w*0.17, sy=o.y+o.h*0.45; g.fillRect(sx,sy,o.w*0.1,o.h*0.22); g.strokeStyle='#fff'; g.strokeRect(sx,sy,o.w*0.1,o.h*0.22); }
  g.fillStyle='#8f969e'; for(let k=0;k<6;k++){ g.fillRect(o.x+o.w*(0.55+r()*0.4),o.y+o.h*(0.15+r()*0.6),26,18); }
  g.fillStyle=o.col; g.fillRect(o.x,o.y+o.h-16,o.w,16); g.fillStyle=o.col; pill(g,o.x+o.w*0.06,o.y+o.h*0.1,Math.min(o.w*0.5,o.brand.length*22+40),44,8); g.fill();
  g.fillStyle='#fff'; g.font='900 28px Arial Black,Arial'; g.textAlign='left'; g.textBaseline='middle'; g.fillText(o.brand,o.x+o.w*0.06+20,o.y+o.h*0.1+23); };
OBJX.mallyard=(g,o)=>{ const m=o.mall; g.fillStyle='rgba(60,60,60,0.10)'; g.fillRect(o.x,o.y,o.w,o.h);
  for(const b of m.bays){ const X0=b.x0*PPM, X1=b.x1*PPM, Y0=b.y0*PPM, Y1=b.y1*PPM;
    g.fillStyle='#f4f4ee'; g.fillRect(X0-2,Y0,4,Y1-Y0); g.fillRect(X1-2,Y0,4,Y1-Y0); g.fillStyle='#f2c230'; g.fillRect(X0,Y1-10,X1-X0,6);
    for(let yy=Y1-18;yy>Y1-34;yy-=7){ g.fillStyle='rgba(242,194,48,0.6)'; g.fillRect(X0+4,yy,X1-X0-8,3); }
    g.fillStyle='rgba(245,245,235,0.9)'; g.font='bold 22px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(b.id),(X0+X1)/2,Y0+16);
    g.fillStyle='#1a1a1a'; g.fillRect(X0+4,Y1-4,(X1-X0)-8,6); }
  g.fillStyle='rgba(245,245,235,0.8)'; g.font='bold 16px sans-serif'; g.textAlign='left'; g.fillText('LOADING DOCK \u2022 REVERSE IN \u2022 BAY NUMBERS',o.x+8,o.y+o.h-(m.bays[0].L*PPM)-14); };
OBJX.dpad=(g,o)=>{ g.fillStyle='rgba(142,68,173,0.13)'; g.fillRect(o.x,o.y,o.w,o.h); g.strokeStyle='#d6a7ea'; g.lineWidth=4; g.setLineDash([16,10]); g.strokeRect(o.x+2,o.y+2,o.w-4,o.h-4); g.setLineDash([]); g.lineWidth=1;
  g.fillStyle='rgba(255,255,255,0.88)'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('SHOWROOM \u2022 STOP HERE',o.x+o.w/2,o.y+o.h/2); };
OBJX.dealer=(g,o)=>{ drawShadowRect(g,o.x,o.y,o.w,o.h,o.height*0.55); const gr=g.createLinearGradient(o.x,o.y,o.x+o.w,o.y+o.h); gr.addColorStop(0,'#b9d7ea'); gr.addColorStop(1,'#6c93ad'); g.fillStyle=gr; g.fillRect(o.x,o.y,o.w,o.h);
  g.strokeStyle='rgba(255,255,255,0.6)'; for(let k=o.x+16;k<o.x+o.w;k+=32){ g.beginPath(); g.moveTo(k,o.y); g.lineTo(k,o.y+o.h); g.stroke(); }
  g.fillStyle='#2c1a3d'; g.fillRect(o.x,o.y,o.w,40); g.fillStyle='#f5b82e'; g.font='900 22px Arial Black,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('BIG RIG TRUCKS',o.x+o.w/2,o.y+20);
  g.fillStyle='#fff'; g.font='bold 14px Arial'; g.fillText(o.name.toUpperCase(),o.x+o.w/2,o.y+o.h-16); };
OBJX.showtruck=(g,o)=>{ const m=TRUCK_MODELS[o.model]; if(!m) return; const art=modelArt(m,m.cols[1]||m.cols[0]); g.save(); g.translate(o.x+o.w/2,o.y+o.h/2); g.rotate(o.ang);
  g.fillStyle='rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(4,4,o.w*0.55,o.h*0.55,0,0,7); g.fill(); g.fillStyle='rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(0,0,o.w*0.6,o.h*0.6,0,0,7); g.fill();
  g.drawImage(art.c,-art.ox/ART_SCALE,-art.oy/ART_SCALE+12,art.W/ART_SCALE,art.H/ART_SCALE); g.restore(); };
OBJX.bunting=(g,o)=>{ const c=['#e74c3c','#f1c40f','#3498db','#2ecc71','#9b59b6']; g.strokeStyle='#555'; g.beginPath(); g.moveTo(o.x,o.y); g.lineTo(o.x+o.w,o.y); g.stroke();
  for(let k=0,x=o.x+6;x<o.x+o.w-6;x+=14,k++){ g.fillStyle=c[k%5]; g.beginPath(); g.moveTo(x-5,o.y); g.lineTo(x+5,o.y); g.lineTo(x,o.y+10); g.closePath(); g.fill(); } };
// ---------- forecourt visitors: real traffic cars peel off, pull up at a car pump, refuel, and rejoin the road
const fcv={cars:[],cool:0,stats:{pulledIn:0,refuelled:0,left:0}};
function updateForecourts(dt){
  if(!world.fuel) return; const P=truck; fcv.cool-=dt;
  // capture passing cars
  if(fcv.cool<=0){ fcv.cool=0.25;
    for(const st of world.fuel){ if(!st.v7) continue; if(Math.abs(st.x-P.x)>260||Math.abs(st.y-P.y)>260) continue;
      if(fcv.cars.filter(c=>c.st===st).length>=3) continue; const free=st.spots.filter(s=>!s.busy); if(!free.length) continue;
      for(let k=traffic.vs.length-1;k>=0;k--){ const v=traffic.vs[k]; if(v.heavy||v.kind==='bus'||v.kind==='van'&&Math.random()<0.5) continue; if(Math.hypot(v.x-st.entIn[0],v.y-st.entIn[1])>13||v.v<1) continue;
        if((st.lastGrab||0)>timeS-3) break; if(v.fcSeen===st) continue; v.fcSeen=st; if(Math.random()>(fcv.chance||0.4)) continue;
        releaseJ(v); traffic.vs.splice(k,1); st.lastGrab=timeS; const sp=free[(Math.random()*free.length)|0]; sp.busy=v;
        const top=st.y0+6;
        const wp=[[st.aisleIn,st.entIn[1]+3],[st.aisleIn,top],[sp.x,top+2],[sp.x,sp.y]];
        fcv.cars.push({v,st,sp,wp,i:0,x:v.x,y:v.y,h:v.h,sp0:v.v,spd:Math.min(v.v,7),phase:'in',t:0,L:v.L,W:v.W,art:v.art,parked:true}); fcv.stats.pulledIn++; break; } } }
  for(let k=fcv.cars.length-1;k>=0;k--){ const c=fcv.cars[k];
    if(c.phase==='pump'){ c.t-=dt; if(c.t<=0){ c.phase='out'; fcv.stats.refuelled++; const st=c.st, y1=st.y0+M_T*11; c.wp=[[c.sp.x,y1],[st.aisleOut,y1],[st.aisleOut,st.entOut[1]+3],[st.entOut[0],st.entOut[1]]]; c.i=0; } continue; }
    const w=c.wp[c.i]; if(!w){ // reached the road again: hand back to traffic
      if(c.phase==='out'){ const nv=spawnVehicle(c.x,c.y-2)||spawnVehicle(c.x,c.y-6); if(nv){ nv.art=c.art; nv.kind=c.v.kind; nv.L=c.L; nv.W=c.W; nv.v=2; } if(nv||!onScreen(c.x,c.y,20)||(c.wait=(c.wait||0)+dt)>6){ c.sp.busy=null; fcv.cars.splice(k,1); fcv.stats.left++; } }
      else { c.phase='pump'; c.t=4+Math.random()*4; c.spd=0; } continue; }
    const dx=w[0]-c.x, dy=w[1]-c.y, d=Math.hypot(dx,dy); const last=c.i===c.wp.length-1;
    // yield to the player's lorry
    let blocked=false; for(const b of playerBoxes()){ const f=fwd(c.h); if(ptBoxDist(c.x+f[0]*(c.L/2+2),c.y+f[1]*(c.L/2+2),b)<1.4) blocked=true; }
    const vt=blocked?0:last&&c.phase==='in'?Math.min(5,Math.max(0.6,d*0.8)):5.5; c.spd+=(vt-c.spd)*Math.min(1,dt*(blocked?6:1.8));
    if(d<0.6){ c.i++; continue; }
    const th=ang(dx,dy); c.h+=wrapA(th-c.h)*Math.min(1,dt*5); const step=Math.min(d,c.spd*dt); c.x+=dx/d*step; c.y+=dy/d*step; }
}
function drawForecourtCars(vx0,vy0,vx1,vy1){
  for(const c of fcv.cars){ const X=c.x*PPM,Y=c.y*PPM; if(X<vx0-80||X>vx1+80||Y<vy0-80||Y>vy1+80) continue;
    blitV(c.art.body.sh,c.x,c.y,c.h,c.L,c.W,4,4); blitV(c.art.body.c,c.x,c.y,c.h,c.L,c.W,0,0);
    if(c.phase==='pump'){ const r=rgt(c.h), side=(c.sp.x<c.st.x0+M_T*3.5||Math.abs(c.sp.x-(c.st.x0+M_T*6.5))<1)?1:-1; ctx.strokeStyle='#111'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo((c.x+r[0]*side*1)*PPM,(c.y+r[1]*side*1)*PPM); ctx.lineTo((c.x+r[0]*side*2.1)*PPM,(c.y+r[1]*side*2.1-0.5)*PPM); ctx.stroke(); ctx.lineWidth=1;
      const p=1-c.t/8; ctx.fillStyle='rgba(8,12,20,0.6)'; ctx.fillRect(X-12,Y-c.L*PPM/2-12,24,4); ctx.fillStyle='#7dff9a'; ctx.fillRect(X-12,Y-c.L*PPM/2-12,24*Math.min(1,p),4); } }
}
