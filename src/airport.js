'use strict';
// ===================== v35 ALBION AIRPORT (Honington-style): 08/26 runway (081 deg), perimeter taxiway loop, HAS dispersals,
// 4 Type C hangars + military apron, civil terminal over the main line (Airport station), landside forecourt + car parks.
// All aircraft are pure functions of timeS (no state) and follow the same splines the taxiways are drawn from.
const APX={A:null};
function apA(){ if(APX.A!==null) return APX.A; const ap=(world.airports||[]).find(a=>a.albion); APX.A=ap?ap.albion:false; if(APX.A) apBuild(APX.A); return APX.A; }
// runway frame: u along 08->26, v to the right (south side positive)
function apT(A,u,v){ const c=Math.cos(A.rwA), s=Math.sin(A.rwA); return [A.rwC[0]+u*c-v*s, A.rwC[1]+u*s+v*c]; }
function apCR(P,closed,step){ const n=P.length, out=[]; const g=i=>closed?P[(i+n)%n]:P[Math.max(0,Math.min(n-1,i))];
  for(let i=0;i<(closed?n:n-1);i++){ const p0=g(i-1),p1=g(i),p2=g(i+1),p3=g(i+2), L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]), m=Math.max(1,Math.ceil(L/step));
    for(let k=0;k<m;k++){ const t=k/m,t2=t*t,t3=t2*t; out.push([0,1].map(j=>0.5*(2*p1[j]+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3))); } }
  if(!closed) out.push(P[n-1].slice()); return out; }
function apPath(pts){ const L=[0]; for(let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); return {pts,L,len:L[L.length-1]}; }
function apAt(P,d){ d=Math.max(0,Math.min(P.len,d)); let lo=1,hi=P.L.length-1; while(lo<hi){ const m=(lo+hi)>>1; if(P.L[m]<d) lo=m+1; else hi=m; } const i=lo, a=P.pts[i-1], b=P.pts[i], u=(d-P.L[i-1])/Math.max(1e-6,P.L[i]-P.L[i-1]); return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,Math.atan2(b[1]-a[1],b[0]-a[0])]; }
function apSm(A,uv,extra){ const P=uv.map(p=>p.length===3?[p[0],p[1]]:apT(A,p[0],p[1])); return apPath(apCR(P,false,1)); }
const AP_LOOP=[[-200,0],[-194,-24],[-140,-30],[0,-30],[140,-30],[194,-24],[200,0],[194,28],[140,34],[0,34],[-140,34],[-194,28]];
function apBuild(A){
  A.loop=apCR(AP_LOOP.map(p=>apT(A,p[0],p[1])),true,1);
  A.links=[-120,0,120].map(u=>[apT(A,u,-30),apT(A,u,34)]);
  // dispersals: north-west, south-west, east (HAS pads), each with a spur to the loop
  A.has=[]; for(const u of [-182,-162,-142]) A.has.push({u,v:-48,side:-1}); for(const u of [-178,-156]) A.has.push({u,v:52,side:1}); for(const u of [150,172]) A.has.push({u,v:52,side:1});
  for(const h of A.has){ h.p=apT(A,h.u,h.v); h.q=apT(A,h.u,h.side*(h.side<0?31:35)); h.a=Math.atan2(h.q[1]-h.p[1],h.q[0]-h.p[0]); }
  // civil apron + stands (nose-in to the terminal, south), military apron + Type C hangars
  A.civ={x0:360,y0:582,x1:452,y1:640,lane:589}; A.civLink=[apT(A,0,34),[405,A.civ.lane,0]];
  A.stands=[0,1,2].map(k=>({k,x:376+k*28,big:true,sc:k===1?8.6:7.6,ph:k*87,col:['#c0392b','#1f4e9c','#117a65'][k],tail:['#e74c3c','#f1c40f','#16a085'][k]}));
  A.mil={x0:468,y0:552,x1:604,y1:596}; A.milLink=[apT(A,120,34)];
  A.hang=[0,1,2,3].map(k=>({x0:472+k*33,y0:600,x1:500+k*33,y1:618,k}));
  A.fire={x0:296,y0:586,x1:322,y1:600}; A.tower=[338,596]; A.fuel={x0:612,y0:552,x1:632,y1:576};
  A.fighters=A.has.map((h,i)=>({h,i,ph:i*53,col:'#8e9aa4'}));
  // fence gaps where roads cross the perimeter
  const T_=TILE, gates=[]; const scan=(fx,fy,len,dx,dy)=>{ let run=null; for(let i=0;i<=len;i++){ const x=fx+dx*i, y=fy+dy*i, rd=inb(x,y)&&G[idx(x,y)]===T.ROAD;
      if(rd&&!run) run={i0:i}; if((!rd||i===len)&&run){ gates.push({x:fx+dx*(run.i0+i)/2,y:fy+dy*(run.i0+i)/2,w:i-run.i0,dx,dy}); run=null; } } };
  scan(A.x0,A.y0,A.x1-A.x0,1,0); scan(A.x0,A.y0,A.y1-A.y0,0,1); scan(A.x1,A.y0,A.y1-A.y0,0,1); scan(A.x0,A.y1,A.term.x0-A.x0,1,0); scan(A.term.x1,A.y1,A.x1-A.term.x1,1,0);
  A.gates=gates.filter(g=>g.w>=2);
  A.posts=[]; const edge=(x0,y0,x1,y1)=>{ const L=Math.hypot(x1-x0,y1-y0); for(let s=0;s<=L;s+=16){ const x=x0+(x1-x0)*s/L, y=y0+(y1-y0)*s/L; if(A.gates.some(g=>Math.hypot(g.x-x,g.y-y)<g.w/2+3)) continue; A.posts.push([x,y]); } };
  A.segs=[[A.x0,A.y0,A.x1,A.y0],[A.x0,A.y0,A.x0,A.y1],[A.x1,A.y0,A.x1,A.y1],[A.x0,A.y1,A.term.x0,A.y1],[A.term.x1,A.y1,A.x1,A.y1]]; for(const s of A.segs) edge(...s);
  const tb=A.term; for(const o of world.objects){ if(!/^(tree|bush|scrub|rock|hedge|cactus)$/.test(o.kind)) continue; const x=o.x/T_, y=o.y/T_;
    if(x>A.x0&&x<A.x1&&y>A.y0&&y<A.y1+2) o._dead=1; if(x>tb.x0-12&&x<tb.x1+2&&y>tb.y0-2&&y<tb.y1+32) o._dead=1; }
  // aircraft paths (tiles)
  const S0=[A.civ.lane];
  A.pIn=A.stands.map(st=>{ const sy=A.civ.y1-1.5-30*st.sc/32; st.sy=sy; return apSm(A,[[-150,0],[100,0],[124,10],[130,30],[140,34],[60,34],[0,34],[405,566,0],[405,A.civ.lane,0],[st.x+4,A.civ.lane,0],[st.x,A.civ.lane+5,0],[st.x,sy,0]]); });
  A.pOut=A.stands.map(st=>apSm(A,[[st.x,A.civ.lane,0],[st.x-4,A.civ.lane,0],[409,A.civ.lane,0],[405,A.civ.lane-6,0],[405,566,0],[0,34],[-140,34],[-194,28],[-200,6],[-196,0],[-190,0]]));
  for(const f of A.fighters){ const h=f.h, out=[[h.p[0],h.p[1],0],[h.q[0],h.q[1],0]], inn=[]; 
    if(h.v<0){ out.push([-194,-24],[-200,-6],[-196,0],[-190,0]); inn.push([100,0],[150,0],[176,-10],[194,-24],[140,-30],[h.u+8,-30]); }
    else if(h.u<0){ out.push([-194,28],[-200,6],[-196,0],[-190,0]); inn.push([100,0],[124,10],[140,34],[0,34],[-140,34],[h.u+8,34]); }
    else { out.push([140,34],[0,34],[-140,34],[-194,28],[-200,6],[-196,0],[-190,0]); inn.push([100,0],[124,10],[h.u-8,34]); }
    inn.push([h.q[0],h.q[1],0],[h.p[0],h.p[1],0]); f.pOut=apSm(A,out); f.pIn=apSm(A,[[-150,0]].concat(inn)); }
}
// ---------- timelines ----------
function apRunway(A,u0,u1,t,dur,acc){ const u=acc?u0+(u1-u0)*Math.min(1,(t/dur)**2):u0+(u1-u0)*(1-(1-Math.min(1,t/dur))**2); const p=apT(A,u,0); return [p[0],p[1],A.rwA]; }
function apCivil(A,st,t){ const C=300, tt=((t+st.ph)%C+C)%C, pin=A.pIn[st.k], pout=A.pOut[st.k];
  if(tt<14){ const u=-150-(14-tt)*22, p=apT(A,u,0); return {x:p[0],y:p[1],h:A.rwA,alt:(14-tt)/14*2.4,ph:'app'}; }
  let o=tt-14, rl=apAt(pin,0); const vR=7; // landing roll is the first ~250 tiles of the taxi-in path, decelerating
  const rollLen=250; if(o<20){ const d=rollLen*(1-(1-o/20)**2); const p=apAt(pin,d); return {x:p[0],y:p[1],h:p[2],alt:0,ph:'roll'}; } o-=20;
  const tIn=(pin.len-rollLen)/vR; if(o<tIn){ const p=apAt(pin,rollLen+o*vR); return {x:p[0],y:p[1],h:p[2],alt:0,ph:'taxi'}; } o-=tIn;
  if(o<120) return {x:st.x,y:st.sy,h:Math.PI/2,alt:0,ph:'park',tp:o}; o-=120;
  if(o<12){ const u=o/12; return {x:st.x,y:st.sy+(A.civ.lane-st.sy)*u*u*(3-2*u),h:Math.PI/2,alt:0,ph:'push'}; } o-=12;
  const tOut=4+pout.len/vR; if(o<tOut){ const p=apAt(pout,Math.max(0,o-4)*vR); return {x:p[0],y:p[1],h:o<4?Math.PI/2:p[2],alt:0,ph:'taxo'}; } o-=tOut;
  const u=-190+0.5*3.2*o*o; if(u>420) return null; const p=apT(A,u,0), alt=Math.max(0,(u-60)/110); if(alt>2.6) return null; return {x:p[0],y:p[1],h:A.rwA,alt,ph:'tko'}; }
function apFighter(A,f,t){ const C=240, tt=((t+f.ph)%C+C)%C, h=f.h, v=9;
  if(tt<70) return {x:h.p[0],y:h.p[1],h:h.a,alt:0,ph:'has'};
  let o=tt-70; const tO=f.pOut.len/v; if(o<tO){ const p=apAt(f.pOut,o*v); return {x:p[0],y:p[1],h:p[2],alt:0,ph:'taxo'}; } o-=tO;
  if(o<14){ const u=-190+0.5*4.5*o*o*3; const p=apT(A,Math.min(u,400),0); return {x:p[0],y:p[1],h:A.rwA,alt:Math.max(0,(u-(-40))/90),ph:'tko'}; } o-=14;
  if(o<60) return null; o-=60;   // sortie
  if(o<10){ const u=-150-(10-o)*30, p=apT(A,u,0); return {x:p[0],y:p[1],h:A.rwA,alt:(10-o)/10*2.2,ph:'app'}; } o-=10;
  const rollLen=250; if(o<14){ const p=apAt(f.pIn,rollLen*(1-(1-o/14)**2)); return {x:p[0],y:p[1],h:p[2],alt:0,ph:'roll'}; } o-=14;
  const p=apAt(f.pIn,Math.min(f.pIn.len,rollLen+o*v)); const done=rollLen+o*v>=f.pIn.len; return {x:p[0],y:p[1],h:done?h.a:p[2],alt:0,ph:done?'has':'taxi'}; }
// ---------- drawing helpers ----------
function apJet(g,s,col,tail){ g.fillStyle='#f3f5f7'; g.save(); g.rotate(Math.PI/2); planeShape(s); g.restore();
  g.fillStyle=tail; g.fillRect(-27*s,-1.8*s,8*s,3.6*s); g.fillStyle=col; g.fillRect(-18*s,-0.7*s,40*s,1.4*s);
  g.fillStyle='#7f8c8d'; for(const ey of [9,17,-9,-17]){ g.beginPath(); g.ellipse(1*s,ey*s,3.6*s,1.4*s,0,0,7); g.fill(); } g.fillStyle='#2c3e50'; g.fillRect(24*s,-2.2*s,2.6*s,4.4*s); }
function apFtr(g,s,shadow){ g.beginPath(); const P=[[30,0],[14,-3],[-10,-18],[-14,-18],[-12,-4],[-24,-9],[-27,-9],[-24,0],[-27,9],[-24,9],[-12,4],[-14,18],[-10,18],[14,3]]; P.forEach(([x,y],i)=>i?g.lineTo(x*s,y*s):g.moveTo(x*s,y*s)); g.closePath(); g.fill();
  if(!shadow){ g.fillStyle='#2c3e50'; g.beginPath(); g.ellipse(14*s,0,5*s,1.6*s,0,0,7); g.fill(); g.fillStyle='#6c7a86'; g.fillRect(-26*s,-1*s,10*s,2*s); } }
function apNav(X,Y,h,w,beacon){ if(typeof dnLight!=='function') return; const c=Math.cos(h), sn=Math.sin(h); dnLight(X-sn*w,Y+c*w,28,'rgba(40,255,90,0.9)',0.9); dnLight(X+sn*w,Y-c*w,28,'rgba(255,40,40,0.9)',0.9); if(beacon&&(timeS*1.1)%1<0.12) dnLight(X,Y,70,'rgba(255,255,255,0.9)',1); }
function apDrawCivil(st,p){ const g=ctx, T_=TILE, X=p.x*T_, Y=p.y*T_, s=st.sc, a=p.alt||0, sc=s*(1+a*0.35);
  g.save(); g.translate(X+a*70,Y+a*70); g.rotate(p.h); g.fillStyle='rgba(10,15,25,'+(0.32-a*0.1)+')'; g.save(); g.rotate(Math.PI/2); planeShape(s); g.restore(); g.restore();
  g.save(); g.translate(X,Y); g.rotate(p.h); apJet(g,sc,st.col,st.tail); g.restore(); apNav(X,Y,p.h,26*sc,true);
  if(p.ph!=='park'&&typeof dnLight==='function') dnLight(X+Math.cos(p.h)*34*sc,Y+Math.sin(p.h)*34*sc,90,'rgba(255,245,210,0.55)',0.8); }
function apDrawFighter(f,p){ const g=ctx, T_=TILE, X=p.x*T_, Y=p.y*T_, a=p.alt||0, s=1.55*(1+a*0.3);
  g.save(); g.translate(X+a*60,Y+a*60); g.rotate(p.h); g.fillStyle='rgba(10,15,25,'+(0.32-a*0.1)+')'; apFtr(g,1.55,true); g.restore();
  g.save(); g.translate(X,Y); g.rotate(p.h); g.fillStyle=f.col; apFtr(g,s,false); if(p.ph==='tko'||p.ph==='taxo'&&false){ g.fillStyle='rgba(255,150,40,0.85)'; g.beginPath(); g.ellipse(-30*s,0,6*s,2*s,0,0,7); g.fill(); } g.restore(); apNav(X,Y,p.h,18*s,p.ph!=='has'); }
function apVeh(g,x,y,h,kind){ g.save(); g.translate(x,y); g.rotate(h); const R=(c,a,b,w,l)=>{ g.fillStyle=c; g.beginPath(); g.roundRect(a,b,w,l,3); g.fill(); };
  if(kind==='tug'){ R('#f1c40f',-14,-9,28,18); R('#2c3e50',4,-7,8,14); }
  else if(kind==='cart'){ R('#7f8c8d',-12,-9,24,18); R('#d35400',-9,-6,8,6); R('#2980b9',1,-6,8,6); }
  else if(kind==='fuel'){ R('#ecf0f1',-34,-11,52,22); R('#c0392b',-34,-11,52,4); R('#2c3e50',20,-10,14,20); }
  else if(kind==='cater'){ R('#bdc3c7',-30,-11,22,22); R('#fdfefe',-8,-12,34,24); R('#2471a3',-8,-12,34,4); }
  else if(kind==='push'){ R('#f39c12',-20,-12,40,24); R('#2c3e50',-6,-8,12,16); }
  else if(kind==='mil'){ R('#556b2f',-22,-10,44,20); R('#3d4f22',6,-8,12,16); }
  g.restore(); }
function apService(st,p,X,Y){ const T_=TILE, tp=p.tp, k=Math.min(1,tp/8)*(1-Math.max(0,Math.min(1,(tp-104)/10))); if(k<=0.01) return; const s=st.sc, off=(1-k)*14*T_, g=ctx;
  apVeh(g,X+20*s+off,Y+4*s,Math.PI,'fuel'); apVeh(g,X-10*s-off,Y-12*s,0,'cater'); apVeh(g,X+8*s+off,Y-14*s,Math.PI,'cater');
  for(let c=0;c<3;c++) apVeh(g,X-12*s-off-c*28,Y+10*s,0,'cart'); apVeh(g,X-12*s-off-84,Y+10*s,0,'tug'); }
function apRR(g,x0,y0,x1,y1,r){ g.beginPath(); g.roundRect(x0,y0,x1-x0,y1-y0,r); }
function apStroke(g,pts,w,col,T_){ g.strokeStyle=col; g.lineWidth=w; g.lineJoin='round'; g.lineCap='round'; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0]*T_,p[1]*T_):g.moveTo(p[0]*T_,p[1]*T_)); g.stroke(); }
// ---------- main ground layer ----------
function apDrawLow(vx0,vy0,vx1,vy1){ const A=apA(); if(!A) return; const T_=TILE, g=ctx; if(vx1<A.x0*T_-1500||vx0>A.x1*T_+1500||vy1<A.y0*T_-900||vy0>(A.term.y1+40)*T_) return;
  const night=typeof DN!=='undefined'?DN.dark:0, vis=(x,y,m)=>x*T_>vx0-m&&x*T_<vx1+m&&y*T_>vy0-m&&y*T_<vy1+m;
  // grass infield over the concrete (airfield is grass apart from paved surfaces), rounded edges
  g.fillStyle='#6a9e45'; apRR(g,(A.x0+3)*T_,(A.y0+3)*T_,(A.x1-3)*T_,(A.y1-2)*T_,40*T_/8); g.fill();
  g.fillStyle='rgba(255,255,230,0.05)'; for(let x=A.x0+4;x<A.x1-4;x+=8) g.fillRect(x*T_,(A.y0+3)*T_,4*T_,(A.y1-A.y0-5)*T_);
  // perimeter road just inside the fence
  g.strokeStyle='#6d7074'; g.lineWidth=2.6*T_; g.lineJoin='round'; apRR(g,(A.x0+2)*T_,(A.y0+2)*T_,(A.x1-2)*T_,(A.y1-1)*T_,10*T_); g.stroke();
  // paved: aprons (rounded), runway, loop, links, spurs
  const PAVE='#4a4d52', CON='#b5b4ae';
  g.fillStyle=CON; for(const r of [A.civ,A.mil]){ apRR(g,r.x0*T_,r.y0*T_,r.x1*T_,r.y1*T_,4*T_); g.fill(); }
  g.fillStyle=CON; apRR(g,(A.mil.x0)*T_,(A.mil.y1-2)*T_,(A.mil.x1)*T_,(A.hang[0].y0+2)*T_,2*T_); g.fill();
  for(const h of A.has){ g.save(); g.translate(h.p[0]*T_,h.p[1]*T_); g.rotate(h.a); g.fillStyle=CON; apRR(g,-8*T_,-7*T_,8*T_,7*T_,3*T_); g.fill(); g.restore(); apStroke(g,[h.p,h.q],3.2*T_,PAVE,T_); }
  apStroke(g,A.loop.concat([A.loop[0]]),4*T_,PAVE,T_); for(const [a,b] of A.links) apStroke(g,[a,b],3.6*T_,PAVE,T_);
  apStroke(g,[A.civLink[0],[405,566],[405,A.civ.lane]],3.6*T_,PAVE,T_); apStroke(g,[A.milLink[0],[A.milLink[0][0],A.mil.y0+2]],3.6*T_,PAVE,T_);
  apStroke(g,[apT(A,-120,0),apT(A,-20,0)],0,PAVE,T_);
  // true kerb fillets at every join: square-minus-quarter-circle pieces in both inside corners
  g.fillStyle=PAVE; const n=v=>{ const l=Math.hypot(v[0],v[1])||1; return [v[0]/l,v[1]/l]; };
  const fil=(J,t,bd,wm,wb,r)=>{ t=n(t); bd=n(bd); for(const sg of [1,-1]){ const C=[J[0]+bd[0]*wm+sg*t[0]*wb, J[1]+bd[1]*wm+sg*t[1]*wb], u1=[sg*t[0],sg*t[1]], O=[C[0]+(u1[0]+bd[0])*r,C[1]+(u1[1]+bd[1])*r], P1=[C[0]+u1[0]*r,C[1]+u1[1]*r], P2=[C[0]+bd[0]*r,C[1]+bd[1]*r];
      const a1=Math.atan2(P1[1]-O[1],P1[0]-O[0]), a2=Math.atan2(P2[1]-O[1],P2[0]-O[0]); let da=a2-a1; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
      g.beginPath(); g.moveTo(C[0]*T_,C[1]*T_); g.lineTo(P1[0]*T_,P1[1]*T_); g.arc(O[0]*T_,O[1]*T_,r*T_,a1,a1+da,da<0); g.closePath(); g.fill(); } };
  const loopT=p=>{ let bi=0,bd=1e18; for(let i=0;i<A.loop.length;i++){ const q=A.loop[i], d=(q[0]-p[0])**2+(q[1]-p[1])**2; if(d<bd){ bd=d; bi=i; } } const L=A.loop.length, q0=A.loop[(bi+L-2)%L], q1=A.loop[(bi+2)%L]; return [q1[0]-q0[0],q1[1]-q0[1]]; };
  const rd=[Math.cos(A.rwA),Math.sin(A.rwA)], rn=[-rd[1],rd[0]];
  for(const [a,b] of A.links){ const dir=[b[0]-a[0],b[1]-a[1]]; fil(a,loopT(a),dir,2,1.8,3.5); fil(b,loopT(b),[-dir[0],-dir[1]],2,1.8,3.5);
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2], c=[m[0],m[1]]; const uC=((m[0]-A.rwC[0])*rd[0]+(m[1]-A.rwC[1])*rd[1]); const J=apT(A,uC,0); fil(J,rd,rn,A.rwW/2,1.8,4); fil(J,rd,[-rn[0],-rn[1]],A.rwW/2,1.8,4); }
  for(const h of A.has) fil(h.q,loopT(h.q),[h.p[0]-h.q[0],h.p[1]-h.q[1]],2,1.6,3);
  fil(A.civLink[0],loopT(A.civLink[0]),[0,1],2,1.8,3.5); fil([405,A.civ.y0],[1,0],[0,-1],0,1.8,3.5);
  fil(A.milLink[0],loopT(A.milLink[0]),[0,1],2,1.8,3.5); fil([A.milLink[0][0],A.mil.y0],[1,0],[0,-1],0,1.8,3.5);
  // runway (rounded ends) + markings
  g.save(); const c0=apT(A,0,0); g.translate(c0[0]*T_,c0[1]*T_); g.rotate(A.rwA); const L=A.rwL*T_/2, Wd=A.rwW*T_/2;
  g.fillStyle='#3a3d42'; apRR(g,-L-T_,-Wd,L+T_,Wd,Wd*0.6); g.fill(); g.fillStyle='#f0f0f0';
  for(const sg of [1,-1]){ const e=-sg*L; for(let k=0;k<8;k++){ const v=-Wd+T_*0.6+k*(Wd*2-T_*1.2)/8; g.fillRect(sg>0?e+T_:e-T_*9,v,T_*8,T_*0.45); }
    for(let k=0;k<3;k++){ const u=e+sg*(T_*30+k*T_*12); g.fillRect(sg>0?u:u-T_*6,-Wd+T_*1.2,T_*6,T_*0.7); g.fillRect(sg>0?u:u-T_*6,Wd-T_*1.9,T_*6,T_*0.7); }
    const u=e+sg*T_*64; g.fillRect(sg>0?u:u-T_*11,-Wd+T_*1,T_*11,T_*1.4); g.fillRect(sg>0?u:u-T_*11,Wd-T_*2.4,T_*11,T_*1.4);
    g.save(); g.translate(e+sg*T_*16,0); g.rotate(sg>0?Math.PI/2:-Math.PI/2); g.scale(1,1); g.font='bold '+(4*T_)+'px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(sg>0?'08':'26',0,0); g.restore(); }
  for(let u=-L+T_*90;u<L-T_*90;u+=T_*8) g.fillRect(u,-T_*0.2,T_*4.5,T_*0.4);
  g.fillStyle='rgba(240,240,240,0.9)'; g.fillRect(-L,-Wd+T_*0.25,2*L,T_*0.25); g.fillRect(-L,Wd-T_*0.5,2*L,T_*0.25);
  // approach light bars beyond both ends
  for(const sg of [1,-1]){ for(let k=1;k<=10;k++){ const u=-sg*(L+T_*2+k*T_*3.2); g.fillStyle='#d7d2b0'; g.fillRect(u-3,-3,6,6); if(k%3===0) for(const dv of [-3,-1.5,1.5,3]) g.fillRect(u-3,dv*T_-3,6,6);
      if(night>0.05&&typeof dnLight==='function'){ const q=apT(A,(u/T_),0); const blink=((timeS*2-k*0.1)%1)<0.15; dnLight(q[0]*T_,q[1]*T_,blink?60:30,'rgba(255,250,220,0.95)',blink?1:0.6); } } }
  g.restore();
  // taxiway centrelines (yellow) + blue edge dots at night
  const yel=(pts)=>apStroke(g,pts,0.22*T_,'#e8b923',T_); yel(A.loop.concat([A.loop[0]])); for(const [a,b] of A.links) yel([a,b]); yel([A.civLink[0],[405,566],[405,A.civ.lane]]); for(const h of A.has) yel([h.p,h.q]);
  yel([[A.civ.x0+3,A.civ.lane],[A.civ.x1-3,A.civ.lane]]); for(const st of A.stands){ yel([[st.x,A.civ.lane],[st.x,A.civ.y1-2]]); const ny=st.sy+30*st.sc/32; g.fillStyle='#e8b923'; g.fillRect((st.x-2.2)*T_,(ny+0.2)*T_,4.4*T_,0.45*T_); g.fillStyle='#f0f0f0'; g.fillRect((st.x-1.4)*T_,(ny-1.6)*T_,2.8*T_,0.3*T_); g.font='bold 22px sans-serif'; g.fillStyle='#e8b923'; g.fillText('STOP',(st.x+2.6)*T_,(ny+0.8)*T_); }
  // holding points
  g.fillStyle='#e8b923'; for(const [a,b] of A.links) for(const p of [a,b]){ const q=[p[0]+(apT(A,0,0)[0]-p[0])*0.0,p[1]]; }
  if(night>0.05&&typeof dnLight==='function'){ for(let i=0;i<A.loop.length;i+=10){ const p=A.loop[i]; if(vis(p[0],p[1],300)) dnLight(p[0]*T_,p[1]*T_,16,'rgba(70,140,255,0.9)',0.8); }
    for(let u=-A.rwL/2;u<=A.rwL/2;u+=8) for(const v of [-A.rwW/2-0.6,A.rwW/2+0.6]){ const p=apT(A,u,v); if(vis(p[0],p[1],200)) dnLight(p[0]*T_,p[1]*T_,18,'rgba(255,240,190,0.95)',0.85); }
    for(const sg of [1,-1]) for(let v=-A.rwW/2;v<=A.rwW/2;v+=1.5){ const p=apT(A,sg*A.rwL/2,v); dnLight(p[0]*T_,p[1]*T_,16,sg<0?'rgba(60,255,110,0.95)':'rgba(255,60,60,0.95)',0.9); } }
  // stand boxes + numbers
  g.strokeStyle='rgba(240,240,240,0.7)'; g.lineWidth=3; for(const st of A.stands){ const w=56*st.sc/32, l=62*st.sc/32; apRR(g,(st.x-w/2)*T_,(A.civ.y1-1-l)*T_,w*T_,0,0); g.beginPath(); g.roundRect((st.x-w/2)*T_,(A.civ.y1-1-l)*T_,w*T_,l*T_,T_); g.stroke(); g.fillStyle='#fff'; g.font='bold 40px sans-serif'; g.fillText(String(st.k+1),(st.x+w/2-2)*T_,(A.civ.y1-1.6)*T_); }
  // buildings: HAS shelters, Type C hangars, fire station, tower, fuel farm
  for(const h of A.has){ g.save(); g.translate(h.p[0]*T_,h.p[1]*T_); g.rotate(h.a); g.fillStyle='rgba(0,0,0,0.25)'; apRR(g,-6*T_+10,-5*T_+10,4*T_+10,5*T_+10,2.4*T_); g.fill();
    g.fillStyle='#6f7a63'; apRR(g,-6*T_,-5*T_,4*T_,5*T_,2.4*T_); g.fill(); g.strokeStyle='#5c6652'; g.lineWidth=3; for(let k=-4.5;k<3.6;k+=1.4){ g.beginPath(); g.moveTo(k*T_,-4.6*T_); g.lineTo(k*T_,4.6*T_); g.stroke(); } g.fillStyle='#3e4636'; g.fillRect(3.6*T_,-4*T_,0.6*T_,8*T_); g.restore(); }
  for(const hg of A.hang){ g.fillStyle='rgba(0,0,0,0.25)'; apRR(g,hg.x0*T_+14,hg.y0*T_+14,hg.x1*T_+14,hg.y1*T_+14,T_); g.fill(); g.fillStyle='#9aa3ab'; apRR(g,hg.x0*T_,hg.y0*T_,hg.x1*T_,hg.y1*T_,T_); g.fill();
    g.strokeStyle='#87909a'; g.lineWidth=4; for(let y=hg.y0+2;y<hg.y1-1;y+=2){ g.beginPath(); g.moveTo((hg.x0+1)*T_,y*T_); g.lineTo((hg.x1-1)*T_,y*T_); g.stroke(); } g.fillStyle='#2c3e50'; g.font='bold 60px sans-serif'; g.fillText('C'+(hg.k+1),(hg.x0+11)*T_,(hg.y0+11)*T_); g.fillStyle='#4b5560'; g.fillRect((hg.x0+2)*T_,(hg.y0-0.4)*T_,(hg.x1-hg.x0-4)*T_,0.6*T_); }
  { const r=A.fire; g.fillStyle='#c0392b'; apRR(g,r.x0*T_,r.y0*T_,r.x1*T_,r.y1*T_,T_*0.8); g.fill(); g.fillStyle='#e74c3c'; for(let k=0;k<4;k++){ g.beginPath(); g.roundRect((r.x0+1.5+k*6)*T_,(r.y1)*T_,4*T_,3*T_,8); g.fill(); } g.fillStyle='#fff'; g.font='bold 44px sans-serif'; g.fillText('FIRE',(r.x0+8)*T_,(r.y0+8.5)*T_); }
  { const [x,y]=A.tower; g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x*T_+16,y*T_+16,4.4*T_,0,7); g.fill(); g.fillStyle='#4b5560'; g.beginPath(); g.arc(x*T_,y*T_,4.4*T_,0,7); g.fill(); g.fillStyle='#7fb3d5'; g.beginPath(); g.arc(x*T_,y*T_,3.6*T_,0,7); g.fill(); g.fillStyle='#d9dde2'; g.beginPath(); g.arc(x*T_,y*T_,2*T_,0,7); g.fill(); if(night>0.05&&typeof dnLight==='function'){ dnLight(x*T_,y*T_,120,'rgba(150,220,255,0.7)',0.8); if((timeS%2)<0.3) dnLight(x*T_,y*T_,60,'rgba(255,40,40,0.9)',1); } }
  { const r=A.fuel; g.fillStyle='#9c9a8f'; apRR(g,r.x0*T_,r.y0*T_,r.x1*T_,r.y1*T_,T_); g.fill(); g.fillStyle='#e8e8e2'; g.strokeStyle='#888'; g.lineWidth=3; for(let i=0;i<2;i++) for(let j=0;j<3;j++){ g.beginPath(); g.arc((r.x0+5+i*10)*T_,(r.y0+4.5+j*7.5)*T_,3.2*T_,0,7); g.fill(); g.stroke(); } }
  // fence: wire + barbed coil + posts, gates with guard huts
  g.strokeStyle='#8a9096'; g.lineWidth=2; for(const [a,b,c,d] of A.segs){ g.beginPath(); g.moveTo(a*T_,b*T_); g.lineTo(c*T_,d*T_); g.stroke(); }
  g.strokeStyle='rgba(60,64,70,0.9)'; g.lineWidth=1.2; for(const [a,b,c,d] of A.segs){ if(Math.max(a,c)*T_<vx0-50||Math.min(a,c)*T_>vx1+50||Math.max(b,d)*T_<vy0-50||Math.min(b,d)*T_>vy1+50) continue; const Ln=Math.hypot(c-a,d-b)*T_, ux=(c-a)*T_/Ln, uy=(d-b)*T_/Ln;
    g.beginPath(); for(let s=0;s<Ln;s+=6){ const x=a*T_+ux*s, y=b*T_+uy*s, o=(s/6&1)?4:-4; if(A.gates.some(q=>Math.hypot(q.x*T_-x,q.y*T_-y)<(q.w/2+0.5)*T_)){ g.moveTo(x,y); continue; } g.lineTo(x-uy*o,y+ux*o); } g.stroke(); }
  g.fillStyle='#5d6166'; for(const [x,y] of A.posts) g.fillRect(x*T_-3,y*T_-3,6,6);
  for(const q of A.gates){ const x=q.x*T_, y=q.y*T_, hw=q.w/2*T_; g.fillStyle='#ecf0f1'; apRR(g,x-(q.dx?hw+60:30),y-(q.dy?hw+60:30),x-(q.dx?hw:-30),y-(q.dy?hw:-30),8); g.fill(); g.fillStyle='#2c3e50'; g.fillRect(x-(q.dx?hw+56:26),y-(q.dy?hw+56:26),52,8); g.fillStyle='#5dade2'; g.fillRect(x-(q.dx?hw+52:22),y-(q.dy?hw+40:10),44,12);
    g.strokeStyle='#e74c3c'; g.lineWidth=5; g.beginPath(); if(q.dx){ g.moveTo(x-hw,y); g.lineTo(x-hw+12,y-60); } else { g.moveTo(x,y-hw); g.lineTo(x-60,y-hw+12); } g.stroke(); }
  // landside forecourt: drop-off loop, multi-storey + surface car parks
  apLandside(A,night);
  // parked/static military: fighters on the apron + one in hangar C2's doorway, a fuel bowser, tugs
  for(let k=0;k<4;k++){ const x=(A.mil.x0+16+k*32)*T_, y=(A.mil.y0+14)*T_; apDrawFighter({col:'#8e9aa4'},{x:x/T_,y:y/T_,h:Math.PI/2,alt:0,ph:'has'}); apVeh(g,x+70,y+40,0,'mil'); }
  apDrawFighter({col:'#7d8a95'},{x:A.hang[1].x0+14,y:A.hang[1].y0+3,h:-Math.PI/2,alt:0,ph:'has'});
  // aircraft on the ground
  for(const st of A.stands){ const p=apCivil(A,st,timeS); if(p&&p.alt<=0.05&&vis(p.x,p.y,900)){ apDrawCivil(st,p); if(p.ph==='park') apService(st,p,p.x*T_,p.y*T_); if(p.ph==='push') apVeh(g,p.x*T_,(p.y+33*st.sc/32)*T_,Math.PI/2,'push'); }
    apBridge(A,st,p); }
  for(const f of A.fighters){ const p=apFighter(A,f,timeS); if(p&&p.alt<=0.05&&vis(p.x,p.y,600)) apDrawFighter(f,p); }
  apTerminal(A,vx0,vy0,vx1,vy1,night); }
function apBridge(A,st,p){ const g=ctx, T_=TILE, ty=A.civ.y1*T_, X=st.x*T_, ny=(st.sy+24*st.sc/32)*T_, ext=p&&p.ph==='park'&&p.tp>3&&p.tp<116, y1=ext?ny:ty-3*T_, dx=X-6*st.sc;
  g.fillStyle='#4f5b66'; g.beginPath(); g.roundRect(dx-12,y1,24,ty-y1,6); g.fill(); g.fillStyle='#aab7c4'; g.fillRect(dx-9,y1+2,18,ty-y1-4); g.fillStyle='#34495e'; g.beginPath(); g.roundRect(dx-16,y1-6,32,10,4); g.fill(); }
function apLandside(A,night){ const g=ctx, T_=TILE;
  // drop-off loop round the end of the access road (x 410-414), kerbside lane along the terminal front
  g.fillStyle='#55585d'; g.beginPath(); g.roundRect(392*T_,689*T_,40*T_,13*T_,6.5*T_); g.fill(); g.fillStyle='#8fb26a'; g.beginPath(); g.roundRect(398*T_,693.5*T_,28*T_,4*T_,2*T_); g.fill();
  g.fillStyle='#55585d'; g.beginPath(); g.roundRect(352*T_,688.4*T_,92*T_,2.6*T_,1.3*T_); g.fill(); g.fillStyle='#f0f0f0'; for(let x=354;x<442;x+=3) g.fillRect(x*T_,689.6*T_,1.6*T_,0.18*T_);
  // rounded outer kerb on the access road's east bend (410..414,716..720): pave-colour corner piece outside a 4-tile arc + kerb line
  { const cx=410*T_, cy=720*T_, r=4*T_; g.fillStyle='#bdbcb6'; g.beginPath(); g.moveTo(cx+r,cy-r); g.lineTo(cx+r,cy); g.arc(cx,cy,r,0,-Math.PI/2,true); g.closePath(); g.fill();
    g.strokeStyle='#d7d4cb'; g.lineWidth=5; g.beginPath(); g.arc(cx,cy,r-2,0,-Math.PI/2,true); g.stroke(); }
  // multi-storey
  g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.roundRect(354*T_+14,692*T_+14,34*T_,22*T_,T_*1.5); g.fill(); g.fillStyle='#8d939a'; g.beginPath(); g.roundRect(354*T_,692*T_,34*T_,22*T_,T_*1.5); g.fill();
  const rnd=mulberry(77); for(let r=0;r<5;r++){ g.fillStyle='#9aa1a8'; g.fillRect(356*T_,(693.5+r*4)*T_,30*T_,2.6*T_); for(let x=356.3;x<385.5;x+=1.2){ if(rnd()<0.65){ g.fillStyle=['#c0392b','#2980b9','#ecf0f1','#2c3e50','#7f8c8d','#f1c40f'][(rnd()*6)|0]; g.fillRect(x*T_,(693.7+r*4)*T_,0.8*T_,2.2*T_); } } }
  g.fillStyle='#f4d03f'; g.font='bold 70px sans-serif'; g.fillText('P',(380)*T_,(691.6)*T_);
  // surface car park
  g.fillStyle='#5a5d62'; g.beginPath(); g.roundRect(418*T_,703*T_,27*T_,14*T_,2*T_); g.fill(); for(let r=0;r<3;r++) for(let x=419;x<444;x+=1.3){ g.fillStyle='#d8d8d8'; g.fillRect(x*T_,(704+r*4.4)*T_,0.1*T_,3.4*T_); if(rnd()<0.6){ g.fillStyle=['#c0392b','#2980b9','#ecf0f1','#2c3e50','#f1c40f'][(rnd()*5)|0]; g.fillRect((x+0.25)*T_,(704.3+r*4.4)*T_,0.8*T_,2.8*T_); } }
  if(night>0.05&&typeof dnLight==='function'){ for(let x=360;x<442;x+=10) dnLight(x*T_,690*T_,90,'rgba(255,225,170,0.7)',0.7); dnLight(431*T_,710*T_,160,'rgba(255,225,170,0.6)',0.6); } }
function apTerminal(A,vx0,vy0,vx1,vy1,night){ const T_=TILE, g=ctx, t=A.term, x0=t.x0*T_, x1=t.x1*T_, y0=t.y0*T_, y1=t.y1*T_, ry0=649*T_, ry1=677*T_;
  if(x1<vx0||x0>vx1||y1<vy0||y0>vy1) return; const R=3*T_;
  g.fillStyle='rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(x0+18,y0+18,x1-x0,y1-y0,R); g.fill();
  g.fillStyle='#d5dbe1'; g.beginPath(); g.roundRect(x0,y0,x1-x0,ry0-y0,[R,R,0,0]); g.fill(); g.beginPath(); g.roundRect(x0,ry1,x1-x0,y1-ry1,[0,0,R,R]); g.fill();
  g.fillStyle='#bfc7cf'; for(let x=x0+40;x<x1-60;x+=96){ g.beginPath(); g.roundRect(x,y0+30,60,ry0-y0-60,10); g.fill(); g.beginPath(); g.roundRect(x,ry1+30,60,y1-ry1-60,10); g.fill(); }
  g.fillStyle='rgba(150,205,235,0.22)'; g.fillRect(x0,ry0,x1-x0,ry1-ry0); g.strokeStyle='rgba(230,240,250,0.55)'; g.lineWidth=2; for(let x=x0+64;x<x1;x+=64){ g.beginPath(); g.moveTo(x,ry0); g.lineTo(x,ry1); g.stroke(); }
  g.strokeStyle='#7b8794'; g.lineWidth=6; g.beginPath(); g.roundRect(x0,y0,x1-x0,y1-y0,R); g.stroke(); g.beginPath(); g.moveTo(x0,ry0); g.lineTo(x1,ry0); g.moveTo(x0,ry1); g.lineTo(x1,ry1); g.stroke();
  g.fillStyle='#1f4e9c'; g.font='bold 120px sans-serif'; g.fillText('ALBION AIRPORT',x0+120,y1-110); g.font='bold 56px sans-serif'; g.fillStyle='#2c3e50'; g.fillText('\u2708 Departures  \u2022  \u{1F686} Airport Station',x0+130,y1-40);
  if(night>0.3&&typeof dnLight==='function') for(let x=x0+80;x<x1;x+=160){ dnLight(x,y0+40,90,'rgba(255,235,180,0.7)',0.7); dnLight(x,(ry0+ry1)/2,110,'rgba(220,240,255,0.7)',0.7); } }
function apDrawHigh(){ const A=apA(); if(!A) return; for(const st of A.stands){ const p=apCivil(A,st,timeS); if(p&&p.alt>0.05) apDrawCivil(st,p); } for(const f of A.fighters){ const p=apFighter(A,f,timeS); if(p&&p.alt>0.05) apDrawFighter(f,p); } }
setTimeout(()=>{
  if(typeof drawPortTrucksLow==='function'){ const d=drawPortTrucksLow; drawPortTrucksLow=function(a,b,c,e){ const r=d.apply(this,arguments); try{ apDrawLow(a,b,c,e); }catch(err){ if(!APX.err){ APX.err=String(err&&err.stack||err); console.error(err); } } return r; }; }
  if(typeof drawPlanes==='function'){ const d=drawPlanes; drawPlanes=function(v){ const r=d.apply(this,arguments); try{ apDrawHigh(); }catch(err){ APX.err2=String(err); } return r; }; }
  if(typeof siteLights==='function'){ const sl=siteLights; siteLights=function(add){ sl.apply(this,arguments); const A=apA(); if(!A) return; const T_=TILE;
    A.posts.forEach(([x,y],i)=>{ if(i%2===0) add(x*T_,y*T_,170,'fl'); }); for(const q of A.gates) add(q.x*T_,q.y*T_,240,'fl');
    for(const st of A.stands) add(st.x*T_,(A.civ.y1-12)*T_,320,'fl'); for(let k=0;k<4;k++) add((A.mil.x0+16+k*32)*T_,(A.mil.y0+10)*T_,300,'fl'); }; }
},0);
