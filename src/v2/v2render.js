// ===================== curvy-world v2 rendering: graph roads (kerbs, pavements, markings, bridges), rotated buildings, parks, roundabouts =====================
function v2path(g,P,i0,i1,off){ curvePath(g,P,i0,i1,off); }
function v2range(cv){ if(!cv.px) cv.px=cv.pts.map(p=>[p[0]*TILE,p[1]*TILE]); const P=cv.px,n=P.length,W=cv.w*TILE; let i0=0,i1=n-1;
  if(CUR_CHUNK){ const [x0,y0,x1,y1]=CUR_CHUNK, m=W+80; i0=n; i1=-1; for(let i=0;i<n;i++){ const p=P[i]; if(p[0]>x0-m&&p[0]<x1+m&&p[1]>y0-m&&p[1]<y1+m){ if(i<i0) i0=i; i1=i; } } if(i1<0) return null; i0=Math.max(0,i0-1); i1=Math.min(n-1,i1+1); } return [P,i0,i1,W]; }
OBJX.v2pave=function(g,o){ const r=v2range(o.cv); if(!r) return; const [P,i0,i1,W]=r; g.save(); g.lineCap='round'; g.lineJoin='round';
  v2path(g,P,i0,i1,0); g.strokeStyle='#b8b4ab'; g.lineWidth=W+40; g.stroke(); v2path(g,P,i0,i1,0); g.strokeStyle='#77746d'; g.lineWidth=W+7; g.stroke(); g.restore(); };
const _drawCurveLegacy=drawCurve;
drawCurve=function(g,cv){ if(!cv.v2||cv.type==='dirt') return _drawCurveLegacy(g,cv); const r=v2range(cv); if(!r) return; const [P,i0,i1,W]=r; const n=P.length;
  g.save(); g.lineJoin='round'; g.lineCap=cv.trim||cv.type==='res'||cv.type==='ramp'?'round':'butt';
  const wet=i=>{ const tx=Math.floor(cv.pts[i][0]),ty=Math.floor(cv.pts[i][1]); return get(tx,ty)===T.BRIDGE; };
  if(cv.fly){ g.save(); g.translate(14,14); v2path(g,P,i0,i1,0); g.strokeStyle='rgba(10,15,25,0.28)'; g.lineWidth=W+10; g.stroke(); g.restore(); v2path(g,P,i0,i1,0); g.strokeStyle='#a9acb0'; g.lineWidth=W+10; g.stroke(); }
  if(cv.bridge){ let a=-1; for(let i=i0;i<=i1+1;i++){ const w=i<=i1&&wet(i); if(w&&a<0) a=i; if(!w&&a>=0){ const b=Math.min(i1,i+2), s=Math.max(i0,a-2);
        g.save(); g.translate(18,18); v2path(g,P,s,b,0); g.strokeStyle='rgba(5,25,45,0.35)'; g.lineWidth=W+18; g.stroke(); g.restore();
        v2path(g,P,s,b,0); g.strokeStyle='#a4a8ad'; g.lineWidth=W+16; g.stroke();
        for(const sd of [-1,1]){ v2path(g,P,s,b,sd*(W/2+5)); g.strokeStyle='#dfe2e6'; g.lineWidth=4; g.stroke(); v2path(g,P,s,b,sd*(W/2+5)); g.strokeStyle='#6d7178'; g.lineWidth=4; g.setLineDash([2,10]); g.stroke(); g.setLineDash([]); }
        a=-1; } } }
  if(cv.type==='hwy'||cv.type==='dual'||cv.type==='rural'){ v2path(g,P,i0,i1,0); g.strokeStyle=cv.type==='rural'?'#8f8a76':'#8a8c86'; g.lineWidth=W+(cv.type==='rural'?4:6); g.stroke(); }
  v2path(g,P,i0,i1,0); g.strokeStyle=g.createPattern(TEX.asph[1],'repeat'); g.lineWidth=W; g.stroke();
  if(cv.bulb){ const e=P[n-1]; if(!CUR_CHUNK||1){ g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); g.beginPath(); g.arc(e[0],e[1],2.1*TILE,0,7); g.fill(); g.strokeStyle='#77746d'; g.lineWidth=3; g.stroke(); } }
  // markings: trimmed back from junctions so nothing paints across another road
  const k=cv.trim?Math.ceil((cv.w/2+1.2)/0.5):0, a0=Math.max(i0,k), a1=Math.min(i1,n-1-k);
  const line=(off,col,w,dash,from,to)=>{ if((to??a1)<=(from??a0)) return; v2path(g,P,from??a0,to??a1,off); g.strokeStyle=col; g.lineWidth=w; g.lineCap='butt'; g.setLineDash(dash||[]); g.stroke(); g.setLineDash([]); };
  if(cv.type==='res'){ g.restore(); return; }
  if(cv.type==='ramp'){ for(const sd of [-1,1]) line(sd*(W/2-4),'#ececec',2,null,i0,i1); g.restore(); return; }
  if(cv.type==='hwy'){ for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',3,null,i0,i1); line(0,'#9a9ca0',8,null,i0,i1); line(0,'#5c5f64',2,null,i0,i1); for(const sd of [-1,1]) line(sd*6,'#f2c230',2,null,i0,i1);
    for(let L=1;L<cv.w/2;L++) for(const sd of [-1,1]) line(sd*L*TILE,'#ececec',2,[36,28],i0,i1); g.restore(); return; }
  if(cv.type==='dual'){ line(0,'#8f9188',16,null,i0,i1); line(0,'#5f8a3e',11,null,i0,i1); for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',2); for(const sd of [-1,1]) for(let L=1;L<cv.w/2-0.5;L++) line(sd*(L*TILE+4),'#ececec',2,[24,24]); g.restore(); return; }
  if(cv.type==='rural'){ for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',2,null,i0,i1); line(0,'#ececec',2,[30,22],i0,i1); g.restore(); return; }
  line(0,'#ececec',2,[24,24]); g.restore(); };
OBJX.v2b=function(g,o){ const F=o.fp, h=o.height, sh=h*0.55; g.save();
  g.fillStyle='rgba(10,15,25,0.28)'; g.beginPath(); F.forEach((p,i)=>i?g.lineTo(p[0]+sh*0.6,p[1]+sh*0.6):g.moveTo(p[0]+sh*0.6,p[1]+sh*0.6)); g.closePath(); g.fill();
  g.beginPath(); F.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fillStyle=o.col; g.fill(); g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=2; g.stroke();
  // roof detail: inset parapet + plant / ridge
  const c=[(F[0][0]+F[2][0])/2,(F[0][1]+F[2][1])/2], ins=F.map(p=>[c[0]+(p[0]-c[0])*0.82,c[1]+(p[1]-c[1])*0.82]);
  if(o.house){ g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=2; g.beginPath(); g.moveTo((F[0][0]+F[3][0])/2,(F[0][1]+F[3][1])/2); g.lineTo((F[1][0]+F[2][0])/2,(F[1][1]+F[2][1])/2); g.stroke(); }
  else { g.beginPath(); ins.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.strokeStyle='rgba(255,255,255,0.18)'; g.lineWidth=2; g.stroke();
    const r=mulberry(o.seed+7); for(let k=0;k<(o.ind?6:3);k++){ const u=0.25+r()*0.5, v=0.25+r()*0.5; const x=F[0][0]+(F[1][0]-F[0][0])*u+(F[3][0]-F[0][0])*v, y=F[0][1]+(F[1][1]-F[0][1])*u+(F[3][1]-F[0][1])*v; g.fillStyle=o.ind?'rgba(220,225,230,0.5)':'#5d6168'; g.fillRect(x-5,y-5,10,10); } }
  g.restore(); };
OBJX.v2park=function(g,o){ const q=o.q.map(p=>[p[0]*TILE,p[1]*TILE]); g.save(); g.beginPath(); q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fillStyle=g.createPattern(TEX.pgrass[0],'repeat'); g.fill();
  g.strokeStyle='#d8cfb4'; g.lineWidth=6; g.beginPath(); g.moveTo((q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2); g.lineTo((q[2][0]+q[3][0])/2,(q[2][1]+q[3][1])/2); g.stroke(); g.restore(); };
OBJX.v2rb=function(g,o){ const rb=o.rb, X=rb.cx*TILE, Y=rb.cy*TILE; g.save(); g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); g.beginPath(); g.arc(X,Y,rb.rout*TILE,0,7); g.fill();
  g.strokeStyle='#ececec'; g.lineWidth=2; g.setLineDash([20,16]); g.beginPath(); g.arc(X,Y,(rb.rin+rb.rout)/2*TILE,0,7); g.stroke(); g.setLineDash([]);
  g.fillStyle='#6f9a45'; g.beginPath(); g.arc(X,Y,rb.rin*TILE,0,7); g.fill(); g.strokeStyle='#d8d8d0'; g.lineWidth=5; g.stroke(); g.restore(); };

// curved suspension bridge: towers + catenary main cables with height (shadow offset) along the curved deck
function v2SuspH(S,j){ const P=S.cv.pts, a=S.t0, b=S.t1, Hm=1; if(j<=a) return Math.max(0,(j-S.i0)/(a-S.i0))*Hm; if(j>=b) return Math.max(0,(S.i1-j)/(S.i1-b))*Hm; const u=(j-a)/(b-a); return Hm*(0.25+3*(u-0.5)*(u-0.5)); }
function v2SuspP(S,j,side){ const P=S.cv.pts, a=P[Math.max(0,j-1)], b=P[Math.min(P.length-1,j+1)], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, off=(S.cv.w/2+0.4)*side; return [(P[j][0]-(b[1]-a[1])/l*off)*TILE,(P[j][1]+(b[0]-a[0])/l*off)*TILE]; }
function drawV2Susp(o){ const S=o.S, K=150; ctx.save(); ctx.lineCap='round';
  for(const sd of [-1,1]){ ctx.strokeStyle='rgba(0,10,20,0.25)'; ctx.lineWidth=3; ctx.beginPath(); for(let j=o.j0;j<=o.j1;j++){ const h=v2SuspH(S,j)*K, p=v2SuspP(S,j,sd); j===o.j0?ctx.moveTo(p[0]+h*0.5,p[1]+h*0.5):ctx.lineTo(p[0]+h*0.5,p[1]+h*0.5); } ctx.stroke(); }
  for(const sd of [-1,1]){ ctx.strokeStyle='rgba(196,64,43,0.8)'; ctx.lineWidth=1.5; for(let j=o.j0;j<=o.j1;j+=2){ const p=v2SuspP(S,j,sd), h=v2SuspH(S,j)*K*0.12; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[0]-h*0.3,p[1]-h*0.3); ctx.stroke(); }
    ctx.strokeStyle='#c4402b'; ctx.lineWidth=5; ctx.beginPath(); for(let j=o.j0;j<=o.j1;j++){ const h=v2SuspH(S,j)*K*0.12, p=v2SuspP(S,j,sd); j===o.j0?ctx.moveTo(p[0]-h*0.3,p[1]-h*0.3):ctx.lineTo(p[0]-h*0.3,p[1]-h*0.3); } ctx.stroke(); }
  ctx.restore(); }
function drawV2Tower(o){ const S=o.S, a=v2SuspP(S,o.j,-1.35), b=v2SuspP(S,o.j,1.35); ctx.save();
  ctx.strokeStyle='rgba(0,10,20,0.3)'; ctx.lineWidth=22; ctx.beginPath(); ctx.moveTo(a[0]+75,a[1]+75); ctx.lineTo(b[0]+75,b[1]+75); ctx.stroke();
  for(const p of [a,b]){ ctx.fillStyle='#a8321f'; ctx.fillRect(p[0]-13,p[1]-13,26,26); ctx.fillStyle='#d24a31'; ctx.fillRect(p[0]-10,p[1]-14,20,20); }
  ctx.strokeStyle='#c4402b'; ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(a[0],a[1]-4); ctx.lineTo(b[0],b[1]-4); ctx.stroke(); ctx.restore(); }
