'use strict';
// ===================== v34 ALBION AIRPORT: perimeter fence + gates, terminal with stands/jet bridges, rail station inside,
// scripted aircraft (land -> taxi -> stand -> turnaround -> pushback -> taxi -> take off) with ground handling vehicles.
// Pure function of timeS per stand (no state), drawn only when in view. Other airports untouched.
const APX={A:null};
function apA(){ if(APX.A!==null) return APX.A; const ap=(world.airports||[]).find(a=>a.albion); APX.A=ap?ap.albion:false; if(APX.A) apBuild(APX.A); return APX.A; }
function apBuild(A){ const T_=TILE;
  A.stands=[]; for(let k=0;k<6;k++){ const big=k>0&&k<5; A.stands.push({k,x:374+k*24,big,sc:big?(k%2?9.5:8):1.7,ph:k*37,col:['#c0392b','#1f4e9c','#117a65','#7d3c98','#d35400','#2c3e50'][k],tail:['#c0392b','#e74c3c','#16a085','#f1c40f','#e67e22','#3498db'][k]}); }
  // fence gaps where roads cross the perimeter
  const gates=[]; const scan=(fx,fy,len,dx,dy)=>{ let run=null; for(let i=0;i<=len;i++){ const x=fx+dx*i, y=fy+dy*i, rd=inb(x,y)&&G[idx(x,y)]===T.ROAD;
      if(rd&&!run) run={i0:i}; if((!rd||i===len)&&run){ gates.push({x:fx+dx*(run.i0+i)/2,y:fy+dy*(run.i0+i)/2,w:i-run.i0,dx,dy}); run=null; } } };
  scan(A.x0,A.y0,A.x1-A.x0,1,0); scan(A.x0,A.y0,A.y1-A.y0,0,1); scan(A.x1,A.y0,A.y1-A.y0,0,1);
  scan(A.x0,A.y1,A.term.x0-A.x0,1,0); scan(A.term.x1,A.y1,A.x1-A.term.x1,1,0);
  A.gates=gates.filter(g=>g.w>=2);
  A.posts=[]; const edge=(x0,y0,x1,y1)=>{ const L=Math.hypot(x1-x0,y1-y0); for(let s=0;s<=L;s+=16){ const x=x0+(x1-x0)*s/L, y=y0+(y1-y0)*s/L; if(A.gates.some(g=>Math.hypot(g.x-x,g.y-y)<g.w/2+3)) continue; A.posts.push([x,y]); } };
  edge(A.x0,A.y0,A.x1,A.y0); edge(A.x0,A.y0,A.x0,A.y1); edge(A.x1,A.y0,A.x1,A.y1); edge(A.x0,A.y1,A.term.x0,A.y1); edge(A.term.x1,A.y1,A.x1,A.y1);
  A.segs=[[A.x0,A.y0,A.x1,A.y0],[A.x0,A.y0,A.x0,A.y1],[A.x1,A.y0,A.x1,A.y1],[A.x0,A.y1,A.term.x0,A.y1],[A.term.x1,A.y1,A.x1,A.y1]];
  // drop decorative clutter (trees, bushes, rocks) inside the terminal block and on the fence line
  const tb=A.term; for(const o of world.objects){ if(!/^(tree|bush|scrub|rock|hedge|cactus)$/.test(o.kind)) continue; const x=o.x/T_, y=o.y/T_;
    if(x>tb.x0-2&&x<tb.x1+2&&y>tb.y0-2&&y<tb.y1+6) o._dead=1; else if(A.segs.some(([a,b,c,d])=>Math.abs(a===c?x-a:y-b)<1.5&&(a===c?(y>=Math.min(b,d)&&y<=Math.max(b,d)):(x>=Math.min(a,c)&&x<=Math.max(a,c))))) o._dead=1; }
}
// ---------- aircraft timeline (tiles) ----------
function apPath(pts){ const L=[0]; for(let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); return {pts,L,len:L[L.length-1]}; }
function apAt(P,d){ d=Math.max(0,Math.min(P.len,d)); let i=1; while(i<P.L.length-1&&P.L[i]<d) i++; const a=P.pts[i-1], b=P.pts[i], u=(d-P.L[i-1])/Math.max(1e-6,P.L[i]-P.L[i-1]); return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,Math.atan2(b[1]-a[1],b[0]-a[0])]; }
function apPlane(A,st,t){ // returns {x,y,h,alt,phase,u} in tiles; cycle length 260 s
  const C=260, tt=((t+st.ph)%C+C)%C, y=A.rwY, sy=A.term.y0-1.5-(st.big?30:14)*st.sc/32, xs=st.x;
  const tin=apPath([[548,y],[556,y+6],[560,A.twY],[xs+4,A.twY],[xs,A.twY+4],[xs,sy-14],[xs,sy]]);
  const tout=apPath([[xs,sy-14],[xs,A.twY+4],[xs-4,A.twY],[206,A.twY],[200,A.twY-6],[196,y],[200,y]]);
  // 0-14 approach (airborne, from the west), 14-30 landing roll, 30-.. taxi in at 7 tiles/s
  if(tt<14){ const x=A.rwX0+40-(14-tt)*18; return {x,y,h:0,alt:(14-tt)/14*2.2,ph:'app'}; }
  if(tt<30){ const u=(tt-14)/16, x=A.rwX0+40+(548-A.rwX0-40)*(1-(1-u)*(1-u)); return {x,y,h:0,alt:0,ph:'roll'}; }
  const t1=30+tin.len/6; if(tt<t1){ const p=apAt(tin,(tt-30)*6); return {x:p[0],y:p[1],h:p[2],alt:0,ph:'taxi'}; }
  const t2=t1+120; if(tt<t2) return {x:xs,y:sy,h:Math.PI/2,alt:0,ph:'park',u:(tt-t1)/120,tp:tt-t1};
  const t3=t2+12; if(tt<t3){ const u=(tt-t2)/12; return {x:xs,y:sy-14*u*u*(3-2*u),h:Math.PI/2,alt:0,ph:'push',u}; }
  const t4=t3+4+tout.len/6; if(tt<t4){ const p=apAt(tout,Math.max(0,tt-t3-4)*6); return {x:p[0],y:p[1],h:tt-t3<4?Math.PI/2:p[2],alt:0,ph:'taxo'}; }
  const u=tt-t4; const x=200+0.5*3.4*u*u; if(x>A.rwX1+160) return null; const alt=Math.max(0,(x-430)/120); if(alt>2.4) return null; return {x,y,h:0,alt,ph:'tko'}; }
// ---------- drawing ----------
function apJet(g,s,col,tail,big){ g.fillStyle='#f3f5f7'; g.save(); g.rotate(Math.PI/2); planeShape(s); g.restore();
  // planeShape draws on ctx; ctx===g in practice
  g.fillStyle=tail; g.fillRect(-27*s,-1.8*s,8*s,3.6*s); g.fillStyle=col; g.fillRect(-18*s,-0.7*s,40*s,1.4*s);
  g.fillStyle='#7f8c8d'; const eng=big?[[-1,9],[-1,17],[-1,-9],[-1,-17]]:[[-1,10],[-1,-10]]; for(const [ex,ey] of eng){ g.beginPath(); g.ellipse((ex+2)*s,ey*s,3.6*s,1.4*s,0,0,7); g.fill(); }
  g.fillStyle='#2c3e50'; g.fillRect(24*s,-2.2*s,2.6*s,4.4*s); }
function apSmall(g,s,col){ g.fillStyle='#f6f6f2'; g.fillRect(-14*s,-2*s,26*s,4*s); g.fillRect(-2*s,-20*s,7*s,40*s); g.fillRect(-14*s,-7*s,4*s,14*s);
  g.fillStyle=col; g.fillRect(-2*s,-20*s,2*s,40*s); g.fillStyle='#34495e'; g.fillRect(6*s,-1.5*s,3*s,3*s); g.fillStyle='rgba(40,40,40,0.6)'; g.fillRect(12*s,-6*s,1.2*s,12*s); }
function apDrawPlane(st,p,X,Y){ const g=ctx, s=st.sc, h=p.h, a=p.alt||0, sc=s*(1+a*0.35);
  g.save(); g.translate(X+a*60,Y+a*60); g.rotate(h); g.fillStyle='rgba(10,15,25,'+(0.32-a*0.1)+')'; if(st.big){ g.save(); g.rotate(Math.PI/2); planeShape(s); g.restore(); } else { g.fillRect(-14*s,-2*s,26*s,4*s); g.fillRect(-2*s,-20*s,7*s,40*s); } g.restore();
  g.save(); g.translate(X,Y); g.rotate(h); if(st.big) apJet(g,sc,st.col,st.tail,st.k!==2&&st.k!==4); else apSmall(g,sc,st.col); g.restore();
  if(typeof dnLight==='function'){ const c=Math.cos(h), sn=Math.sin(h), wx=(st.big?26:20)*sc; dnLight(X-sn*wx,Y+c*wx,30,'rgba(40,255,90,0.9)',0.9); dnLight(X+sn*wx,Y-c*wx,30,'rgba(255,40,40,0.9)',0.9);
    if((timeS*1.1+st.k*0.3)%1<0.12) dnLight(X,Y,70,'rgba(255,255,255,0.9)',1); if(p.ph!=='park') dnLight(X+c*32*sc,Y+sn*32*sc,90,'rgba(255,245,210,0.55)',0.8); } }
function apVeh(g,x,y,h,kind){ g.save(); g.translate(x,y); g.rotate(h); const R=(c,a,b,w,l)=>{ g.fillStyle=c; g.fillRect(a,b,w,l); };
  if(kind==='tug'){ R('#f1c40f',-14,-9,28,18); R('#2c3e50',4,-7,8,14); }
  else if(kind==='cart'){ R('#7f8c8d',-12,-9,24,18); R('#d35400',-9,-6,8,6); R('#2980b9',1,-6,8,6); R('#27ae60',-9,1,8,5); }
  else if(kind==='fuel'){ R('#ecf0f1',-34,-11,52,22); R('#c0392b',-34,-11,52,4); R('#2c3e50',20,-10,14,20); }
  else if(kind==='cater'){ R('#bdc3c7',-30,-11,22,22); R('#fdfefe',-8,-12,34,24); R('#2471a3',-8,-12,34,4); }
  else if(kind==='stairs'){ R('#ecf0f1',-24,-9,40,18); g.fillStyle='#95a5a6'; for(let k=-20;k<14;k+=5) g.fillRect(k,-7,2,14); R('#e67e22',16,-9,10,18); }
  else if(kind==='push'){ R('#f39c12',-20,-12,40,24); R('#2c3e50',-6,-8,12,16); }
  g.restore(); }
function apService(A,st,p,X,Y){ // ground handling around a parked aircraft (px)
  const T_=TILE, tp=p.tp, inn=Math.min(1,tp/8), out=Math.max(0,Math.min(1,(tp-104)/10)), k=inn*(1-out); if(k<=0.01) return; const s=st.sc, off=(1-k)*14*T_;
  const g=ctx; if(st.big){ const ln=s*8; // nose at +y (heading south)
    apVeh(g,X+20*s+off,Y+4*s,Math.PI,'fuel'); // under right wing
    apVeh(g,X-10*s-off,Y-12*s,0,'cater'); apVeh(g,X+8*s+off,Y-14*s,Math.PI,'cater');
    for(let c=0;c<3;c++) apVeh(g,X-12*s-off-c*28,Y+10*s,0,'cart'); apVeh(g,X-12*s-off-84,Y+10*s,0,'tug'); }
  else { apVeh(g,X-9*s*2-off,Y+2*s,0,'stairs'); apVeh(g,X+14*s*2+off,Y-3*s,Math.PI,'fuel'); apVeh(g,X-8*s*2-off,Y+14*s,0,'tug'); } }
function apBridge(A,st,p,X,Y,ext){ const g=ctx, T_=TILE, ty=A.term.y0*T_, s=st.sc, dx=X-6*s, ny=Y+(st.big?24*s:0); const y1=ext?ny:ty-2*T_;
  g.fillStyle='#4f5b66'; g.fillRect(dx-12,y1,24,ty-y1); g.fillStyle='#aab7c4'; g.fillRect(dx-9,y1+2,18,ty-y1-4); g.fillStyle='#34495e'; g.fillRect(dx-16,y1-6,32,10);
  g.fillStyle='#2c3e50'; g.fillRect(dx-18,ty-T_*1.2,36,T_*0.9); }
function apDrawLow(vx0,vy0,vx1,vy1){ const A=apA(); if(!A) return; const T_=TILE, g=ctx; if(vx1<A.x0*T_-800||vx0>A.x1*T_+800||vy1<A.y0*T_-800||vy0>(A.term.y1+8)*T_) return;
  // taxiway + lead-ins
  g.fillStyle='#45484d'; g.fillRect(196*T_,(A.twY-1.6)*T_,(564-196)*T_,3.2*T_); g.fillRect(196*T_,(A.rwY+5)*T_,8*T_,(A.twY-A.rwY-5)*T_); g.fillRect(552*T_,(A.rwY+5)*T_,10*T_,(A.twY-A.rwY-5)*T_);
  for(const st of A.stands){ g.fillRect((st.x-1.6)*T_,A.twY*T_,3.2*T_,(A.term.y0-A.twY)*T_); }
  g.fillStyle='#e8b923'; g.fillRect(198*T_,(A.twY-0.06)*T_,(562-198)*T_,0.12*T_); for(const st of A.stands) g.fillRect((st.x-0.06)*T_,A.twY*T_,0.12*T_,(A.term.y0-1-A.twY)*T_);
  // apron stand boxes
  g.strokeStyle='rgba(240,240,240,0.7)'; g.lineWidth=3; for(const st of A.stands){ const w=(st.big?56:44)*st.sc/32, L=(st.big?62:44)*st.sc/32; g.strokeRect((st.x-w/2)*T_,(A.term.y0-1-L)*T_,w*T_,L*T_); g.fillStyle='#fff'; g.font='bold 40px sans-serif'; g.fillText(String(st.k+1),(st.x+w/2-2)*T_,(A.term.y0-1.5)*T_); }
  // fence: posts + double wire + barbed coil
  g.strokeStyle='#8a9096'; g.lineWidth=2; for(const [a,b,c,d] of A.segs){ g.beginPath(); g.moveTo(a*T_,b*T_); g.lineTo(c*T_,d*T_); g.stroke(); }
  g.strokeStyle='rgba(60,64,70,0.9)'; g.lineWidth=1.2; for(const [a,b,c,d] of A.segs){ const L=Math.hypot(c-a,d-b)*T_, ux=(c-a)*T_/L, uy=(d-b)*T_/L; if(Math.max(a,c)*T_<vx0-50||Math.min(a,c)*T_>vx1+50||Math.max(b,d)*T_<vy0-50||Math.min(b,d)*T_>vy1+50) continue;
    g.beginPath(); for(let s=0;s<L;s+=6){ const x=a*T_+ux*s, y=b*T_+uy*s, o=(s/6&1)?4:-4; if(A.gates.some(q=>Math.hypot(q.x*T_-x,q.y*T_-y)<(q.w/2+0.5)*T_)) { g.moveTo(x,y); continue; } g.lineTo(x-uy*o,y+ux*o); } g.stroke(); }
  g.fillStyle='#5d6166'; for(const [x,y] of A.posts) g.fillRect(x*T_-3,y*T_-3,6,6);
  for(const q of A.gates){ const x=q.x*T_, y=q.y*T_, px=q.dy?1:0, py=q.dx?1:0, hw=q.w/2*T_; // guard hut beside the road + raised barrier
    g.fillStyle='#ecf0f1'; g.fillRect(x+px*0-(q.dx?hw+60:30),y-(q.dy?hw+60:30),60,60); g.fillStyle='#2c3e50'; g.fillRect(x-(q.dx?hw+56:26),y-(q.dy?hw+56:26),52,8); g.fillStyle='#5dade2'; g.fillRect(x-(q.dx?hw+52:22),y-(q.dy?hw+40:10),44,12);
    g.strokeStyle='#e74c3c'; g.lineWidth=5; g.beginPath(); if(q.dx){ g.moveTo(x-hw,y); g.lineTo(x-hw+12,y-60); } else { g.moveTo(x,y-hw); g.lineTo(x-60,y-hw+12); } g.stroke(); g.fillStyle='#f4d03f'; g.font='bold 22px sans-serif'; g.fillText('SECURITY',x-(q.dx?hw+58:28),y-(q.dy?hw+64:34)); }
  // aircraft on the ground + services + jet bridges
  for(const st of A.stands){ const p=apPlane(A,st,timeS); const X=p?p.x*T_:0, Y=p?p.y*T_:0;
    if(p&&p.alt<=0.05&&X>vx0-900&&X<vx1+900&&Y>vy0-900&&Y<vy1+900){ apDrawPlane(st,p,X,Y); if(p.ph==='park') apService(A,st,p,X,Y);
      if(p.ph==='push') apVeh(ctx,X,Y+(st.big?33:22)*st.sc,Math.PI/2,'push'); }
    if(st.big) apBridge(A,st,p,st.x*T_,(A.term.y0-1.5-30*st.sc/32)*T_,p&&p.ph==='park'&&p.tp>3&&p.tp<116); }
  apTerminal(A,vx0,vy0,vx1,vy1); }
function apTerminal(A,vx0,vy0,vx1,vy1){ const T_=TILE, g=ctx, t=A.term, x0=t.x0*T_, x1=t.x1*T_, y0=t.y0*T_, y1=t.y1*T_, ry0=649*T_, ry1=677*T_;
  if(x1<vx0||x0>vx1||y1<vy0||y0>vy1) return; const night=typeof DN!=='undefined'?DN.dark:0;
  g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(x0+18,y0+18,x1-x0,y1-y0);
  g.fillStyle='#d5dbe1'; g.fillRect(x0,y0,x1-x0,ry0-y0); g.fillRect(x0,ry1,x1-x0,y1-ry1);
  g.fillStyle='#bfc7cf'; for(let x=x0+40;x<x1-40;x+=96){ g.fillRect(x,y0+30,60,ry0-y0-60); g.fillRect(x,ry1+30,60,y1-ry1-60); }
  g.fillStyle='rgba(120,190,230,0.55)'; for(let x=x0+70;x<x1;x+=192) g.fillRect(x,y0+12,26,ry0-y0-24);
  // glass atrium over the platforms (train visible through it)
  g.fillStyle='rgba(150,205,235,0.22)'; g.fillRect(x0,ry0,x1-x0,ry1-ry0); g.strokeStyle='rgba(230,240,250,0.55)'; g.lineWidth=2; for(let x=x0;x<=x1;x+=64){ g.beginPath(); g.moveTo(x,ry0); g.lineTo(x,ry1); g.stroke(); }
  g.strokeStyle='#7b8794'; g.lineWidth=6; g.strokeRect(x0,y0,x1-x0,y1-y0); g.beginPath(); g.moveTo(x0,ry0); g.lineTo(x1,ry0); g.moveTo(x0,ry1); g.lineTo(x1,ry1); g.stroke();
  g.fillStyle='#1f4e9c'; g.font='bold 120px sans-serif'; g.fillText('ALBION AIRPORT',x0+120,y1-110); g.font='bold 56px sans-serif'; g.fillStyle='#2c3e50'; g.fillText('\u2708 Departures  \u2022  \u{1F686} Airport Rail Station',x0+130,y1-40);
  if(night>0.3&&typeof dnLight==='function') for(let x=x0+80;x<x1;x+=160){ dnLight(x,y0+40,90,'rgba(255,235,180,0.7)',0.7); dnLight(x,(ry0+ry1)/2,110,'rgba(220,240,255,0.7)',0.7); } }
function apDrawHigh(){ const A=apA(); if(!A) return; const T_=TILE; for(const st of A.stands){ const p=apPlane(A,st,timeS); if(!p||p.alt<=0.05) continue; apDrawPlane(st,p,p.x*T_,p.y*T_); } }
setTimeout(()=>{
  if(typeof drawPortTrucksLow==='function'){ const d=drawPortTrucksLow; drawPortTrucksLow=function(a,b,c,e){ const r=d.apply(this,arguments); try{ apDrawLow(a,b,c,e); }catch(err){ if(!APX.err){ APX.err=1; console.error(err); } } return r; }; }
  if(typeof drawPlanes==='function'){ const d=drawPlanes; drawPlanes=function(v){ const r=d.apply(this,arguments); try{ apDrawHigh(); }catch(err){} return r; }; }
  if(typeof siteLights==='function'){ const sl=siteLights; siteLights=function(add){ sl.apply(this,arguments); const A=apA(); if(!A) return; const T_=TILE;
    A.posts.forEach(([x,y],i)=>{ if(i%2===0) add(x*T_,y*T_,170,'fl'); }); for(const q of A.gates) add(q.x*T_,q.y*T_,240,'fl');
    for(const st of A.stands) add(st.x*T_,(A.term.y0-10)*T_,320,'fl'); }; }
},0);
