// ---------- day / night cycle (game clock) ----------
const DAY_LEN=1200;             // real seconds per 24h game day (20 min => 1 game hour = 50 s)
let gameT=8, gameDay=0;   // gameDay: whole days elapsed (railway timetable clock)
//                    // game hour 0..24, starts 08:00
// phases (game hours): dawn 4.8-6.6 (1.5 min) | day 6.6-18.6 (10 min) | dusk 18.6-20.4 (1.5 min) | night 20.4-4.8 (7 min)
const DN={dark:0,dusk:0,mm:0,lit:null,grid:null,cell:2048,lc:null,lg:null,spr:null,cone:null,glow:{},sendT:0};
function dnSmooth(a,b,x){ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); }
function updateDayNight(dt,run){ if(run){ gameT+=dt*24/DAY_LEN; if(gameT>=24){ gameT-=24; gameDay++; } } const h=gameT;
  DN.dark= h<12 ? 1-dnSmooth(4.8,6.6,h) : dnSmooth(18.6,20.4,h);
  DN.dusk= h<12 ? Math.max(0,1-Math.abs(h-5.7)/1.3) : Math.max(0,1-Math.abs(h-19.3)/1.3);
  if(typeof MP!=='undefined'&&MP.on&&MP.host){ DN.sendT-=dt; if(DN.sendT<=0){ DN.sendT=5; try{ mpSendAll({t:'clock',g:gameT,d:gameDay,w:WX.st,wt:WX.timer}); }catch(e){} } } }
function dnClock(){ const m=Math.floor(gameT*60)%1440; return String((m/60)|0).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function dnSprite(r,stops){ const c=document.createElement('canvas'); c.width=c.height=r*2; const g=c.getContext('2d'), gr=g.createRadialGradient(r,r,0,r,r,r); for(const [o,col] of stops) gr.addColorStop(o,col); g.fillStyle=gr; g.fillRect(0,0,r*2,r*2); return c; }
function dnGlow(col){ return DN.glow[col]||(DN.glow[col]=dnSprite(32,[[0,col],[0.35,col.replace(/[\d.]+\)$/,'0.35)')],[1,col.replace(/[\d.]+\)$/,'0)')]])); }
function dnBuild(){ if(DN.grid) return; const G=new Map(), C=DN.cell; const add=(x,y,r,k,o)=>{ const key=((x/C)|0)+','+((y/C)|0); let a=G.get(key); if(!a) G.set(key,a=[]); a.push(Object.assign({x,y,r,k},o||{})); };
  for(const l of slBuild()) add(l.x,l.y,l.r,'st',{l});
  let s=7; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(const o of world.objects) if(o.kind==='bldg'){ const win=[];
    if(typeof ROOF2!=='undefined'&&ROOF2[o.style]&&o.style!=='house'&&o.style!=='warehouse'){ const f=Math.min(o.h*0.32,Math.max(6,(o.height||30)*0.16)), fy=o.y+o.h-f; for(let j=3;j<f-4;j+=7) for(let k=4;k<o.w-6;k+=9) if(win.length<60) win.push([o.x+k,fy+j,rnd()<0.55]); for(let k=8;k<o.w-8;k+=12) if(win.length<80) win.push([o.x+k,o.y+5,rnd()<0.4]); }
    else { const nw=Math.min(14,Math.max(3,((o.w*o.h)/(32*32*2))|0)); for(let i=0;i<nw;i++) win.push([o.x+4+rnd()*(o.w-12),o.y+4+rnd()*(o.h-10),rnd()<0.5]); } add(o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*0.55,'b',{o,win}); }
  for(const o of world.overhead) if(o.kind==='canopy') add(o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*1.1,'fl');
  for(const d of world.depots||[]){ add(d.entrance.x*PPM,d.entrance.y*PPM,160,'fl'); for(const b of d.bays||[]) add(b.kx*PPM,b.ky*PPM,90,'fl'); }
  for(const P of (typeof portList==='function'?portList():[])) if(P.slots) for(let i=0;i<P.slots.length;i+=6){ const q=PL(P,P.slots[i][0],P.slots[i][1]); add(q[0]*TILE,q[1]*TILE,190,'fl'); }
  DN.grid=G; }
const DN_COL={st:'rgba(255,214,140,0.55)',fl:'rgba(235,240,255,0.5)',b:'rgba(255,200,110,0.35)'};
const DN_NEON=['rgba(255,40,200,0.9)','rgba(40,230,255,0.9)','rgba(170,90,255,0.9)','rgba(255,90,60,0.9)'];
function drawNight(vx0,vy0,vx1,vy1,z){ const K=DN.dark, D=DN.dusk; if(K<0.01&&D<0.01) return;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  if(D>0.01){ ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(255,150,80,'+(0.32*D)+')'; ctx.fillRect(0,0,VW,VH); }
  if(K<0.01){ ctx.restore(); return; }
  ctx.globalCompositeOperation='multiply'; ctx.fillStyle='rgba(70,95,170,'+(0.55*K)+')'; ctx.fillRect(0,0,VW,VH); ctx.globalCompositeOperation='source-over';
  dnBuild(); const q=0.5, W=Math.ceil(VW*q), H=Math.ceil(VH*q);
  if(!DN.lc||DN.lc.width!==W||DN.lc.height!==H){ DN.lc=document.createElement('canvas'); DN.lc.width=W; DN.lc.height=H; DN.lg=DN.lc.getContext('2d'); }
  if(!DN.spr){ DN.spr=dnSprite(64,[[0,'rgba(0,0,0,1)'],[0.45,'rgba(0,0,0,0.75)'],[1,'rgba(0,0,0,0)']]); DN.cone=dnCone(); }
  const L=DN.lg; L.setTransform(1,0,0,1,0,0); L.globalCompositeOperation='source-over'; L.clearRect(0,0,W,H); L.fillStyle='rgba(4,8,22,'+(0.72*K)+')'; L.fillRect(0,0,W,H);
  L.globalCompositeOperation='destination-out'; const sx=x=>(x-vx0)*z*q, sy=y=>(y-vy0)*z*q, pad=300;
  const lights=[]; const C=DN.cell; for(let cy=Math.floor((vy0-pad)/C);cy<=Math.floor((vy1+pad)/C);cy++) for(let cx=Math.floor((vx0-pad)/C);cx<=Math.floor((vx1+pad)/C);cx++){ const a=DN.grid.get(cx+','+cy); if(a) for(const l of a) if(l.x>vx0-pad&&l.x<vx1+pad&&l.y>vy0-pad&&l.y<vy1+pad) lights.push(l); }
  for(const P of (typeof portList==='function'?portList():[])) if(P.cranes) for(const c of P.cranes){ for(const u of [P.legL,-1,c.u,16]){ const p=PL(P,u,c.y); const x=p[0]*TILE,y=p[1]*TILE; if(x>vx0-300&&x<vx1+300&&y>vy0-300&&y<vy1+300) dnLight(x,y,u===c.u?150:70,u===c.u?'rgba(235,240,255,0.7)':'rgba(255,60,40,0.9)',0.8); } }
  const dyn=DN.dyn||[]; for(const l of lights.concat(dyn)){ if(l.k==='b') continue; const r=l.r*z*q; L.globalAlpha=l.k==='st'?0.85:0.95; L.drawImage(DN.spr,sx(l.x)-r,sy(l.y)-r,r*2,r*2); }
  const veh=dnVehs();
  L.globalAlpha=1; for(const V of veh){ const x=V.fx*PPM,y=V.fy*PPM; if(x<vx0-500||x>vx1+500||y<vy0-500||y>vy1+500) continue; const ang=Math.atan2(V.f[1],V.f[0]); L.save(); L.translate(sx(x),sy(y)); L.rotate(ang); const s=z*q*(V.big?1.55:1.1); L.scale(s,s); L.globalAlpha=1; L.drawImage(DN.cone,0,-64); L.drawImage(DN.spr,-26,-26,52,52); L.restore(); }
  L.globalCompositeOperation='source-over'; L.globalAlpha=1;
  ctx.globalCompositeOperation='source-over'; ctx.drawImage(DN.lc,0,0,VW,VH);
  // additive colour: lamp glows, windows/neon, tail + nav lights
  ctx.globalCompositeOperation='lighter'; const gz=(col,x,y,r,a)=>{ const R=r*z; ctx.globalAlpha=a*K; ctx.drawImage(dnGlow(col),(x-vx0)*z-R,(y-vy0)*z-R,R*2,R*2); };
  let nb=0; for(const l of lights){ if(l.k==='st'){ gz(DN_COL.st,l.x,l.y,l.r*0.6,0.8); const h=l.l; gz('rgba(255,236,190,1)',h.hx,h.hy,9,0.9); } else if(l.k==='fl') gz(DN_COL.fl,l.x,l.y,l.r*0.5,0.45);
    else if(l.k==='b'&&nb++<500){ const o=l.o; ctx.globalAlpha=0.75*K; const cy=o.cyber; ctx.fillStyle=cy?'#9ff':'#ffd27a'; for(const w of l.win){ if(!w[2]&&!cy) continue; ctx.fillRect((w[0]-vx0)*z,(w[1]-vy0)*z,Math.max(1.5,5*z),Math.max(1.5,4*z)); }
      if(cy){ const col=DN_NEON[(o.seed>>>3)%4]; ctx.globalAlpha=0.8*K; ctx.strokeStyle=col; ctx.lineWidth=Math.max(1.5,3*z); ctx.strokeRect((o.x-vx0)*z+2,(o.y-vy0)*z+2,o.w*z-4,o.h*z-4); gz(col,o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*0.6,0.25); } } }
  for(const l of dyn) gz(l.c||DN_COL.fl,l.x,l.y,l.r*0.5,l.a||0.6);
  const blink=typeof indBlink==='function'&&indBlink();
  for(const V of veh){ const X=V.fx*PPM,Y=V.fy*PPM; if(X<vx0-600||X>vx1+600||Y<vy0-600||Y>vy1+600) continue; const r=[-V.f[1],V.f[0]], hw=V.W/2-0.15;
    for(const sd of [-1,1]){ const lx=V.fx+r[0]*sd*hw*0.85, ly=V.fy+r[1]*sd*hw*0.85; gz('rgba(255,250,225,1)',lx*PPM,ly*PPM,V.big?7:5,1); gz('rgba(255,245,210,0.8)',(lx+V.f[0]*2)*PPM,(ly+V.f[1]*2)*PPM,V.big?16:11,0.5); }
    const rf=V.rf, rr=[-rf[1],rf[0]], rw=V.rW/2-0.12;
    for(const sd of [-1,1]){ const lx=V.rx+rr[0]*sd*rw, ly=V.ry+rr[1]*sd*rw; gz('rgba(255,30,20,0.95)',lx*PPM,ly*PPM,V.br?8:5,V.br?1:0.7); if(V.rv) gz('rgba(255,255,245,1)',(lx-rr[0]*sd*0.45)*PPM,(ly-rr[1]*sd*0.45)*PPM,6,1);
      const ind=V.haz||(V.side===1&&sd<0)||(V.side===2&&sd>0); if(ind&&blink){ gz('rgba(255,170,20,1)',(lx+rf[0]*0.1)*PPM,(ly+rf[1]*0.1)*PPM,9,1); const fl=V.fx+r[0]*sd*(hw+0.05), fy=V.fy+r[1]*sd*(hw+0.05); gz('rgba(255,170,20,1)',fl*PPM,fy*PPM,9,1); } }
    if(V.br) gz('rgba(255,30,20,0.55)',(V.rx-rf[0]*2.2)*PPM,(V.ry-rf[1]*2.2)*PPM,28,0.55);
    if(V.rv) gz('rgba(255,255,240,0.5)',(V.rx-rf[0]*3)*PPM,(V.ry-rf[1]*3)*PPM,30,0.45); }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; ctx.restore(); DN.dyn=[]; }
// lamp geometry (metres) for every lit vehicle: front lamp line + rear lamp line following trailer articulation
function dnVehs(){ const out=[];
  { const t=truck, f=fwd(t.h); let rx,ry,rf,rW; if(t.trl){ const k=kingpin(t); rf=fwd(t.th); rx=k[0]-rf[0]*TRL.rear; ry=k[1]-rf[1]*TRL.rear; rW=TRL.w; } else { rf=f; rx=t.x-f[0]*1.15; ry=t.y-f[1]*1.15; rW=2.4; }
    out.push({fx:t.x+f[0]*5.0,fy:t.y+f[1]*5.0,f,W:2.45,big:1,rx,ry,rf,rW,br:t.brake>0.02&&t.mode!=='R'||(t.brake>0.02&&Math.abs(t.v)>0.3),rv:t.mode==='R',side:typeof IND!=='undefined'?IND.side:0,haz:typeof IND!=='undefined'&&IND.haz}); }
  for(const v of (traffic.vs||[])){ if(v.x===undefined) continue; const f=fwd(v.h||0), L=v.L||4.4, W=v.W||1.8; let rx,ry,rf,rW; if(v.trl){ rf=fwd(v.trl.h); rx=v.trl.x-rf[0]*6.8; ry=v.trl.y-rf[1]*6.8; rW=2.55; } else { rf=f; rx=v.x-f[0]*L/2; ry=v.y-f[1]*L/2; rW=W; }
    out.push({fx:v.x+f[0]*L/2,fy:v.y+f[1]*L/2,f,W,big:v.kind==='lorry'||v.kind==='cab',rx,ry,rf,rW,br:!!v.brake,rv:false,side:0,haz:false}); }
  if(typeof MP!=='undefined'&&MP.on) for(const id in MP.players){ const p=MP.players[id], r=p.cur; if(!p.has||!r) continue; const f=fwd(r.h), fl=r.fl|0; let rx,ry,rf,rW; if(r.tr){ rf=fwd(r.th); rx=r.kx-rf[0]*TRL.rear; ry=r.ky-rf[1]*TRL.rear; rW=TRL.w; } else { rf=f; rx=r.x-f[0]*1.15; ry=r.y-f[1]*1.15; rW=2.4; }
    out.push({fx:r.x+f[0]*5.0,fy:r.y+f[1]*5.0,f,W:2.45,big:1,rx,ry,rf,rW,br:!!(fl&1),rv:!!(fl&2),side:(fl>>2)&3,haz:!!(fl&32)}); }
  return out; }
// twin cone beams (destination-out mask): hotspot near lamps, soft lateral + distance falloff
function dnCone(){ const Lc=230, Hc=128, c=document.createElement('canvas'); c.width=Lc; c.height=Hc; const g=c.getContext('2d');
  for(const oy of [-11,11]){ const cy=Hc/2+oy; g.save(); g.beginPath(); g.moveTo(0,cy-3); g.lineTo(Lc,cy-Hc*0.36); g.lineTo(Lc,cy+Hc*0.36); g.lineTo(0,cy+3); g.closePath(); g.clip(); g.filter='blur(5px)';
    const gr=g.createRadialGradient(0,cy,0,0,cy,Lc); gr.addColorStop(0,'rgba(0,0,0,0.95)'); gr.addColorStop(0.18,'rgba(0,0,0,0.8)'); gr.addColorStop(0.55,'rgba(0,0,0,0.45)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.globalAlpha=0.75; g.fillRect(0,0,Lc,Hc); g.restore(); }
  const hs=g.createRadialGradient(28,Hc/2,0,28,Hc/2,40); hs.addColorStop(0,'rgba(0,0,0,0.9)'); hs.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=hs; g.fillRect(0,0,80,Hc); return c; }
function dnLight(x,y,r,c,a){ if(DN.dark<0.05) return; (DN.dyn||(DN.dyn=[])).push({x,y,r,c,a,k:'d'}); }
function drawClockHUD(){ const x=VW-126, y=62, w=112, h=30, day=DN.dark<0.5; ctx.save(); ctx.fillStyle='rgba(13,15,20,0.72)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,h,8):ctx.rect(x,y,w,h); ctx.fill(); if(DN.dark>0.3){ ctx.strokeStyle='rgba(207,227,255,0.4)'; ctx.lineWidth=1.5; ctx.stroke(); }
  if(day){ ctx.fillStyle='#ffcf3f'; ctx.beginPath(); ctx.arc(x+17,y+15,6,0,7); ctx.fill(); ctx.strokeStyle='#ffcf3f'; ctx.lineWidth=2; for(let i=0;i<8;i++){ const a=i*Math.PI/4; ctx.beginPath(); ctx.moveTo(x+17+Math.cos(a)*8,y+15+Math.sin(a)*8); ctx.lineTo(x+17+Math.cos(a)*11,y+15+Math.sin(a)*11); ctx.stroke(); } }
  else { ctx.fillStyle='#dfe6ff'; ctx.beginPath(); ctx.arc(x+17,y+15,8,0,7); ctx.fill(); ctx.fillStyle='rgba(13,15,20,1)'; ctx.beginPath(); ctx.arc(x+21,y+12,7,0,7); ctx.fill(); }
  ctx.fillStyle='#fff'; ctx.font='800 18px system-ui,sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(dnClock(),x+36,y+16); ctx.restore(); }
function dnMapShade(x,y,w,h,k){ const a=DN.dark*(k||0.45); if(a<0.02) return; ctx.save(); ctx.fillStyle='rgba(6,12,32,'+a+')'; ctx.fillRect(x,y,w,h); ctx.restore(); }

// ---------- street lamps (v27): posts on the pavement/verge at both road edges, arm over the lane edge, pool just inside the kerb ----------
// density by area: city core ~28 m both sides, suburbs ~48 m staggered, rural roads only at junctions/roundabouts, open country/desert none.
const SL={list:null,grid:null,cell:1024};
function slZone(tx,ty){ let best=2; for(const k in (world.cities||{})){ const c=world.cities[k]; if(!c||!c.xs) continue; const x0=c.xs[0],y0=c.ys[0],x1=c.X1,y1=c.Y1, mx=(x1-x0)*0.2, my=(y1-y0)*0.2;
    if(tx>=x0+mx&&tx<=x1-mx&&ty>=y0+my&&ty<=y1-my) return 0; const dx=Math.max(x0-tx,0,tx-x1), dy=Math.max(y0-ty,0,ty-y1); if(Math.hypot(dx,dy)<40) best=1; } return best; }
function slBuild(){ if(SL.list) return SL.list; const out=[], taken=new Set();
  const railT=new Set(); if(typeof RAIL!=='undefined'&&RAIL.X) for(let i=0;i<RAIL.L;i+=2){ const cx=RAIL.X[i]/M_TILE, cy=RAIL.Y[i]/M_TILE; for(let oy=-2;oy<=2;oy++) for(let ox=-2;ox<=2;ox++) railT.add(Math.floor(cx+ox*0.5)+','+Math.floor(cy+oy*0.5)); }
  const BAD=new Set([T.ROAD,T.BRIDGE,T.WATER,T.BLDG,T.TANK,T.PUMP,T.CONT,T.QUAY]);
  const okPost=(px,py)=>{ const tx=Math.floor(px),ty=Math.floor(py); if(!inb(tx,ty)) return false; const i=idx(tx,ty); if(BAD.has(G[i])||(world.reserved&&world.reserved[i])||railT.has(tx+','+ty)) return false;
    for(const d of world.depots||[]) if(tx>=d.x-1&&tx<=d.x+d.w&&ty>=d.y-1&&ty<=d.y+d.h) return false;
    const key=Math.round(px/2)+','+Math.round(py/2); if(taken.has(key)) return false; taken.add(key); return true; };
  // post at p (tiles), arm toward the road along unit n (pointing into the road); pool 2 m inside the kerb
  const put=(kx,ky,nx,ny,dbl)=>{ const px=kx-nx*0.18, py=ky-ny*0.18; if(!dbl&&!okPost(px,py)) return; const ax=kx+nx*0.45, ay=ky+ny*0.45, lx=kx+nx*0.55, ly=ky+ny*0.55;
    out.push({px:px*TILE,py:py*TILE,hx:ax*TILE,hy:ay*TILE,x:lx*TILE,y:ly*TILE,r:110,dbl:!!dbl}); };
  const inJ=(tx,ty)=>{ for(const J of world.junctions) if(tx>J.x-1.5&&tx<J.x+J.w+1.5&&ty>J.y-1.5&&ty<J.y+J.h+1.5) return true; return false; };
  for(const sg of world.segs||[]){ if(!sg||sg.b1===undefined||sg.type==='dirt'||sg.type==='lane') continue; const hwy=sg.type==='hwy';
    for(let a=sg.b0+1, n=0;a<sg.b1;a++){ const cx=sg.dir==='h'?a+0.5:sg.a+sg.w/2, cy=sg.dir==='h'?sg.a+sg.w/2:a+0.5, z=slZone(cx,cy); if(z===2) continue;
      const sp=z===0?7:12; if(((a-sg.b0)%sp)!==0||inJ(Math.floor(cx),Math.floor(cy))) continue; n++;
      if(hwy&&sg.w>=6&&z===1){ // central reservation double lamp: arms either way over the fast lanes
        const ox=sg.dir==='h'?0:1, oy=sg.dir==='h'?1:0; out.push({px:cx*TILE,py:cy*TILE,hx:(cx-ox*0.45)*TILE,hy:(cy-oy*0.45)*TILE,x:(cx-ox*0.9)*TILE,y:(cy-oy*0.9)*TILE,r:110,dbl:1});
        out.push({px:cx*TILE,py:cy*TILE,hx:(cx+ox*0.45)*TILE,hy:(cy+oy*0.45)*TILE,x:(cx+ox*0.9)*TILE,y:(cy+oy*0.9)*TILE,r:110,dbl:1,twin:1}); continue; }
      const sides=z===0?[-1,1]:[(n&1)?1:-1];
      for(const sd of sides){ const e=sg.a+(sd<0?0:sg.w); if(sg.dir==='h') put(a+0.5,e,0,-sd); else put(e,a+0.5,-sd,0); } } }
  for(const cv of world.curves||[]){ if(cv.type==='dirt'||cv.type==='lane'||!cv.pts||cv.pts.length<2) continue; let acc=0, n=0;
    for(let i=1;i<cv.pts.length;i++){ const A=cv.pts[i-1],B=cv.pts[i], l=Math.hypot(B[0]-A[0],B[1]-A[1]); acc+=l; const z=slZone(B[0],B[1]); if(z===2){ acc=0; continue; } const sp=z===0?7:12; if(acc<sp) continue; acc=0; n++;
      const ux=(B[0]-A[0])/(l||1), uy=(B[1]-A[1])/(l||1), nx=-uy, ny=ux, hw=cv.w/2; if(inJ(Math.floor(B[0]),Math.floor(B[1]))) continue;
      for(const sd of (z===0?[-1,1]:[(n&1)?1:-1])) put(B[0]+nx*sd*hw,B[1]+ny*sd*hw,-nx*sd,-ny*sd); } }
  // rural junctions + roundabouts: a lamp on each corner / around the ring
  for(const J of world.junctions){ const z=slZone(J.x+J.w/2,J.y+J.h/2); if(z===0) continue; const hs=world.segs[J.hs], vs=world.segs[J.vs]; if(z===2&&(!hs||!vs||hs.type==='dirt'||vs.type==='dirt')) continue;
    for(const [cx,cy,dx,dy] of [[J.x,J.y,-1,-1],[J.x+J.w,J.y,1,-1],[J.x,J.y+J.h,-1,1],[J.x+J.w,J.y+J.h,1,1]]){ const k=Math.SQRT1_2; put(cx+dx*0.35,cy+dy*0.35,-dx*k,-dy*k); } }
  for(const rb of world.rbs||[]){ for(let q=0;q<6;q++){ const a=q*Math.PI/3+0.3, c=Math.cos(a), s=Math.sin(a); put(rb.cx+c*(rb.rout+0.15),rb.cy+s*(rb.rout+0.15),-c,-s); } }
  const g=new Map(); for(const l of out){ const k=((l.px/SL.cell)|0)+','+((l.py/SL.cell)|0); let a=g.get(k); if(!a) g.set(k,a=[]); a.push(l); } SL.grid=g; SL.list=out; return out; }
// posts drawn in world space (day and night); cheap: only the cells in view
function drawStreetLamps(vx0,vy0,vx1,vy1){ slBuild(); const C=SL.cell; ctx.save(); ctx.lineCap='round';
  for(let cy=Math.floor((vy0-60)/C);cy<=Math.floor((vy1+60)/C);cy++) for(let cx=Math.floor((vx0-60)/C);cx<=Math.floor((vx1+60)/C);cx++){ const a=SL.grid.get(cx+','+cy); if(!a) continue;
    for(const l of a){ if(l.px<vx0-60||l.px>vx1+60||l.py<vy0-60||l.py>vy1+60) continue;
      ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(l.px+5,l.py+6); ctx.lineTo(l.hx+5,l.hy+6); ctx.stroke();
      ctx.strokeStyle='#5d6268'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(l.px,l.py); ctx.lineTo(l.hx,l.hy); ctx.stroke();
      if(!l.twin){ ctx.fillStyle='#3c4046'; ctx.beginPath(); ctx.arc(l.px,l.py,2.8,0,7); ctx.fill(); ctx.fillStyle='#8b9097'; ctx.beginPath(); ctx.arc(l.px-0.6,l.py-0.6,1.3,0,7); ctx.fill(); }
      const ang=Math.atan2(l.hy-l.py,l.hx-l.px); ctx.save(); ctx.translate(l.hx,l.hy); ctx.rotate(ang); ctx.fillStyle='#2f3338'; ctx.fillRect(-3,-2.2,6.5,4.4); ctx.fillStyle=DN.dark>0.3?'#fff2c8':'#cfd4da'; ctx.fillRect(-2,-1.3,4.5,2.6); ctx.restore(); } }
  ctx.restore(); }
