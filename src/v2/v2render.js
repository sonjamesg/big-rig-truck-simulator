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
  if(cv.fly){ g.lineCap='butt'; g.save(); g.translate(14,14); v2path(g,P,i0,i1,0); g.strokeStyle='rgba(10,15,25,0.28)'; g.lineWidth=W+10; g.stroke(); g.restore(); v2path(g,P,i0,i1,0); g.strokeStyle='#a9acb0'; g.lineWidth=W+10; g.stroke(); g.lineCap=cv.trim||cv.type==='res'||cv.type==='ramp'?'round':'butt'; }
  if(cv.bridge){ g.lineCap='butt'; let a=-1; for(let i=i0;i<=i1+1;i++){ const w=i<=i1&&wet(i); if(w&&a<0) a=i; if(!w&&a>=0){ const b=Math.min(i1,i+2), s=Math.max(i0,a-2);
        g.save(); g.translate(18,18); v2path(g,P,s,b,0); g.strokeStyle='rgba(5,25,45,0.35)'; g.lineWidth=W+18; g.stroke(); g.restore();
        v2path(g,P,s,b,0); g.strokeStyle='#a4a8ad'; g.lineWidth=W+16; g.stroke();
        for(const sd of [-1,1]){ v2path(g,P,s,b,sd*(W/2+5)); g.strokeStyle='#dfe2e6'; g.lineWidth=4; g.stroke(); v2path(g,P,s,b,sd*(W/2+5)); g.strokeStyle='#6d7178'; g.lineWidth=4; g.setLineDash([2,10]); g.stroke(); g.setLineDash([]); }
        a=-1; } } }
  const capSave=g.lineCap; g.lineCap='butt';
  for(const [dp,dw] of (cv.decks||[])){ const k=Math.ceil((dw/2+3.5)*2), s0=Math.max(i0,Math.floor(dp*1)-k), s1=Math.min(i1,Math.ceil(dp)+k); if(s1<=s0) continue;
    g.save(); g.translate(16,16); v2path(g,P,s0,s1,0); g.strokeStyle='rgba(10,15,25,0.38)'; g.lineWidth=W+16; g.stroke(); g.restore();
    v2path(g,P,s0,s1,0); g.strokeStyle='#9ea2a7'; g.lineWidth=W+14; g.stroke(); for(const sd of [-1,1]){ v2path(g,P,s0,s1,sd*(W/2+5)); g.strokeStyle='#e3e5e8'; g.lineWidth=4; g.stroke(); } }
  g.lineCap=capSave;
  if(cv.type==='hwy'||cv.type==='dual'||cv.type==='rural'){ v2path(g,P,i0,i1,0); g.strokeStyle=cv.type==='rural'?'#8f8a76':'#8a8c86'; g.lineWidth=W+(cv.type==='rural'?4:6); g.stroke(); }
  v2path(g,P,i0,i1,0); g.strokeStyle=g.createPattern(TEX.asph[1],'repeat'); g.lineWidth=W; g.stroke();
  if(cv.bulb){ const e=P[n-1]; if(!CUR_CHUNK||1){ g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); g.beginPath(); g.arc(e[0],e[1],2.1*TILE,0,7); g.fill(); g.strokeStyle='#cfcac0'; g.lineWidth=5; g.stroke(); g.strokeStyle='rgba(60,55,50,0.6)'; g.lineWidth=1.5; g.stroke(); } }
  // markings: trimmed back from junctions so nothing paints across another road
  const kk=Math.ceil((cv.w/2+1.6)/0.5), a0=Math.max(i0,cv.trimA?kk:0), a1=Math.min(i1,n-1-(cv.trimB?kk:0));
  const line=(off,col,w,dash,from,to)=>{ if((to??a1)<=(from??a0)) return; v2path(g,P,from??a0,to??a1,off); g.strokeStyle=col; g.lineWidth=w; g.lineCap='butt'; g.setLineDash(dash||[]); g.stroke(); g.setLineDash([]); };
  if(cv.type==='res'){ g.restore(); return; }
  // give-way markings: roundabout entries and minor arms of junctions
  { const ORD={dirt:0,res:1,rural:2,town:3,city:4,dual:5,ramp:6,hwy:7}; for(const end of [0,1]){ const nid=end?cv.b:cv.a, N=world.v2&&world.v2.N[nid]; if(!N||N.deg<3&&!N.rb) continue; if(cv.type==='ramp'||cv.type==='hwy') continue;
      let minor=!!N.rb; if(!minor){ let mx=0; for(const ei of N.edges){ const q=world.v2.P[ei]; if(q.cv!==cv&&q.cv) mx=Math.max(mx,ORD[q.type]||0); } minor=(ORD[cv.type]||0)<mx; } if(!minor) continue;
      const k=end?a1:a0; if(k<i0||k>i1) continue; const a=P[Math.max(0,k-1)], b=P[Math.min(n-1,k+1)], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, nx=-(b[1]-a[1])/l, ny=(b[0]-a[0])/l, tx=(b[0]-a[0])/l, ty=(b[1]-a[1])/l, s2=end?-1:1;
      g.save(); g.strokeStyle='#f2f2f2'; g.lineWidth=3; g.setLineDash([10,8]); g.lineCap='butt'; for(const d of [0,9]){ const cx=P[k][0]+tx*s2*d, cy=P[k][1]+ty*s2*d; g.beginPath(); g.moveTo(cx-nx*(W/2-4),cy-ny*(W/2-4)); g.lineTo(cx+nx*(W/2-4),cy+ny*(W/2-4)); g.stroke(); } g.restore(); } }
  if(cv.type==='ramp'){ for(const sd of [-1,1]) line(sd*(W/2-4),'#ececec',2,null); g.restore(); return; }
  if(cv.type==='hwy'){ for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',3,null,i0,i1); line(0,'#9a9ca0',8,null,i0,i1); line(0,'#5c5f64',2,null,i0,i1); for(const sd of [-1,1]) line(sd*6,'#f2c230',2,null,i0,i1);
    for(let L=1;L<cv.w/2;L++) for(const sd of [-1,1]) line(sd*L*TILE,'#ececec',2,[36,28],i0,i1); g.restore(); return; }
  if(cv.type==='dual'){ line(0,'#8f9188',16,null,i0,i1); line(0,'#5f8a3e',11,null,i0,i1); for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',2); for(const sd of [-1,1]) for(let L=1;L<cv.w/2-0.5;L++) line(sd*(L*TILE+4),'#ececec',2,[24,24]); g.restore(); return; }
  if(cv.type==='rural'){ for(const sd of [-1,1]) line(sd*(W/2-5),'#ececec',2,null,i0,i1); line(0,'#ececec',2,[30,22],i0,i1); g.restore(); return; }
  line(0,'#ececec',2,[24,24]); g.restore(); };
// v2 buildings: district character, roof types, height-scaled shadows
const V2PAL={down:['#7d8fa3','#9aa7b4','#5f6f82','#b8c2cc','#8c9aa8','#a5b4c4','#6d7f94'],mid:['#c9b79c','#b59f86','#d7c9b0','#a89276','#cdbfa8','#bfa688'],shop:['#d9c4a0','#c7a982','#e0d3bb'],ind:['#9aa0a6','#8a9096','#b0b4b8','#7f878e','#a6a29a'],house:['#b0624e','#c98d5f','#8f5446','#7d6a5c','#a35a3f','#6e6a66','#b98a5a']};
function v2poly(g,F){ g.beginPath(); F.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); }
OBJX.v2b=function(g,o){ const F=o.fp, h=o.height, r=mulberry((o.seed||0)*7+13), dk=o.house?'house':o.ind?'ind':(o.dk==='down'?'down':(h<17?'shop':'mid'));
  const col=o.pcol||(o.pcol=V2PAL[dk][(r()*V2PAL[dk].length)|0]); const sh=Math.min(70,h*0.55); g.save();
  const c=[(F[0][0]+F[1][0]+F[2][0]+F[3][0])/4,(F[0][1]+F[1][1]+F[2][1]+F[3][1])/4], ins=(k)=>F.map(p=>[c[0]+(p[0]-c[0])*k,c[1]+(p[1]-c[1])*k]);
  const ex=[F[1][0]-F[0][0],F[1][1]-F[0][1]], ey=[F[3][0]-F[0][0],F[3][1]-F[0][1]], Lx=Math.hypot(...ex), Ly=Math.hypot(...ey), at=(u,v)=>[F[0][0]+ex[0]*u+ey[0]*v,F[0][1]+ex[1]*u+ey[1]*v];
  // house plot: garden + driveway (drawn under the shadow)
  if(dk==='house'&&o.face){ const f=o.face; g.fillStyle='#6f9f4a'; v2poly(g,F.map(p=>[c[0]+(p[0]-c[0])*1.45-f[0]*14,c[1]+(p[1]-c[1])*1.45-f[1]*14])); g.fill(); g.strokeStyle='rgba(40,70,30,0.55)'; g.lineWidth=3; g.stroke();
    g.strokeStyle='#b9b4a8'; g.lineWidth=12; g.lineCap='butt'; const d0=[c[0]+ex[0]*0.32,c[1]+ex[1]*0.32]; g.beginPath(); g.moveTo(d0[0]+f[0]*28,d0[1]+f[1]*28); g.lineTo(d0[0]+f[0]*62,d0[1]+f[1]*62); g.stroke(); }
  // shadow: extruded by height
  g.fillStyle='rgba(10,15,25,0.26)'; g.beginPath(); for(const p of F){ g.moveTo(p[0],p[1]); } v2poly(g,F.map(p=>[p[0]+sh*0.6,p[1]+sh*0.6])); g.fill();
  for(let k=0;k<4;k++){ const a=F[k], b=F[(k+1)%4]; g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.lineTo(b[0]+sh*0.6,b[1]+sh*0.6); g.lineTo(a[0]+sh*0.6,a[1]+sh*0.6); g.closePath(); g.fill(); }
  if(dk==='house'){ // pitched tiled roof: two shaded halves along the long axis
    const long=Lx>=Ly, m0=long?[at(0,0.5),at(1,0.5)]:[at(0.5,0),at(0.5,1)];
    g.fillStyle=shade(col,1.12); v2poly(g,long?[F[0],F[1],m0[1],m0[0]]:[F[0],m0[0],m0[1],F[3]]); g.fill(); g.fillStyle=shade(col,0.78); v2poly(g,long?[m0[0],m0[1],F[2],F[3]]:[m0[0],F[1],F[2],m0[1]]); g.fill();
    g.strokeStyle='rgba(0,0,0,0.12)'; g.lineWidth=1; for(let t=0.15;t<1;t+=0.17){ const A=long?at(t,0):at(0,t), B=long?at(t,1):at(1,t); g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); g.stroke(); }
    g.strokeStyle=shade(col,0.6); g.lineWidth=2.5; g.beginPath(); g.moveTo(m0[0][0],m0[0][1]); g.lineTo(m0[1][0],m0[1][1]); g.stroke(); v2poly(g,F); g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=1.5; g.stroke(); g.restore(); return; }
  v2poly(g,F); g.fillStyle=col; g.fill(); g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=2; g.stroke();
  if(dk==='ind'){ // corrugated shed + skylight strips + roller doors
    const long=Lx>=Ly; g.strokeStyle='rgba(255,255,255,0.13)'; g.lineWidth=1; for(let t=0.03;t<1;t+=long?6/Lx:6/Ly){ const A=long?at(t,0):at(0,t), B=long?at(t,1):at(1,t); g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); g.stroke(); }
    g.fillStyle='rgba(190,225,240,0.75)'; for(const v of [0.3,0.7]){ const q=long?[at(0.06,v-0.035),at(0.94,v-0.035),at(0.94,v+0.035),at(0.06,v+0.035)]:[at(v-0.035,0.06),at(v+0.035,0.06),at(v+0.035,0.94),at(v-0.035,0.94)]; v2poly(g,q); g.fill(); }
    g.fillStyle='#5c6168'; for(let k=0;k<3;k++){ const u=0.2+k*0.3, q=long?[at(u-0.06,0.97),at(u+0.06,0.97),at(u+0.06,1),at(u-0.06,1)]:[at(0.97,u-0.06),at(1,u-0.06),at(1,u+0.06),at(0.97,u+0.06)]; v2poly(g,q); g.fill(); }
    g.restore(); return; }
  const roof=dk==='down'?(h>75&&r()<0.5?'heli':r()<0.35?'glass':r()<0.25?'garden':'flat'):dk==='shop'?'shop':(r()<0.2?'garden':'flat');
  if(dk==='down'&&h>45){ g.fillStyle=shade(col,1.12); v2poly(g,ins(0.74)); g.fill(); g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1.5; g.stroke(); } // setback tier
  else { v2poly(g,ins(0.86)); g.strokeStyle='rgba(255,255,255,0.22)'; g.lineWidth=2; g.stroke(); } // parapet
  if(roof==='glass'){ const I=ins(0.66); const gr=g.createLinearGradient(I[0][0],I[0][1],I[2][0],I[2][1]); gr.addColorStop(0,'#cfe7f5'); gr.addColorStop(0.5,'#6f9cbc'); gr.addColorStop(1,'#a9cde2'); g.fillStyle=gr; v2poly(g,I); g.fill();
    g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1; for(let t=0.2;t<0.81;t+=0.1){ const A=at(t,0.17), B=at(t,0.83); g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); g.stroke(); } }
  else if(roof==='garden'){ g.fillStyle='#6f9a45'; v2poly(g,ins(0.7)); g.fill(); for(let k=0;k<5;k++){ const p=at(0.25+r()*0.5,0.25+r()*0.5); g.fillStyle=k%2?'#4f7f33':'#5f8f3a'; g.beginPath(); g.arc(p[0],p[1],4+r()*5,0,7); g.fill(); } g.fillStyle='#c9b98f'; const p=at(0.5,0.5); g.fillRect(p[0]-3,p[1]-10,6,20); }
  else if(roof==='heli'){ const p=at(0.5,0.5), R=Math.min(Lx,Ly)*0.28; g.fillStyle='#4b5058'; g.beginPath(); g.arc(p[0],p[1],R,0,7); g.fill(); g.strokeStyle='#f2c230'; g.lineWidth=3; g.stroke(); g.fillStyle='#f4f4f4'; g.font=`bold ${Math.round(R*1.1)}px system-ui`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('H',p[0],p[1]+1); }
  else if(roof==='shop'){ // awning strip along the front edge + rooftop units
    const aw=['#c0392b','#2e86de','#27ae60','#e67e22','#8e44ad'][(r()*5)|0]; const q=[at(0,0.9),at(1,0.9),at(1,1.04),at(0,1.04)]; for(let k=0;k<10;k++){ const u0=k/10,u1=(k+1)/10; g.fillStyle=k%2?'#f4f1ea':aw; v2poly(g,[at(u0,0.9),at(u1,0.9),at(u1,1.04),at(u0,1.04)]); g.fill(); }
    g.strokeStyle='rgba(0,0,0,0.3)'; g.lineWidth=1; v2poly(g,q); g.stroke(); }
  if(roof==='flat'||roof==='shop'||roof==='garden'){ const n=roof==='garden'?1:2+((r()*3)|0); for(let k=0;k<n;k++){ const p=at(0.2+r()*0.6,0.2+r()*0.55); g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(p[0]-4,p[1]-4,12,12); g.fillStyle='#c9ccd0'; g.fillRect(p[0]-6,p[1]-6,12,12); g.strokeStyle='#8a8e94'; g.beginPath(); g.arc(p[0],p[1],3.5,0,7); g.stroke(); }
    if(roof==='flat'&&r()<0.7){ const p=at(0.3+r()*0.4,0.3+r()*0.3); g.fillStyle='rgba(180,215,235,0.8)'; g.fillRect(p[0]-9,p[1]-4,18,8); g.fillRect(p[0]-9,p[1]+8,18,8); } }
  g.restore(); };
OBJX.v2park=function(g,o){ const q=o.q.map(p=>[p[0]*TILE,p[1]*TILE]); g.save(); g.beginPath(); q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fillStyle=g.createPattern(TEX.pgrass[0],'repeat'); g.fill();
  g.strokeStyle='#d8cfb4'; g.lineWidth=6; g.beginPath(); g.moveTo((q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2); g.lineTo((q[2][0]+q[3][0])/2,(q[2][1]+q[3][1])/2); g.stroke(); g.restore(); };
OBJX.v2rb=function(g,o){ const rb=o.rb, X=rb.cx*TILE, Y=rb.cy*TILE; g.save(); g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); g.beginPath(); g.arc(X,Y,rb.rout*TILE,0,7); g.fill();
  g.strokeStyle='#ececec'; g.lineWidth=2; g.setLineDash([20,16]); g.beginPath(); g.arc(X,Y,(rb.rin+rb.rout)/2*TILE,0,7); g.stroke(); g.setLineDash([]);
  // clockwise flow arrows (UK)
  const Rm=(rb.rin+rb.rout)/2*TILE, na=Math.max(4,Math.round(Rm/45)); g.fillStyle='rgba(240,240,240,0.9)'; for(let k=0;k<na;k++){ const a=(k+0.5)/na*Math.PI*2; for(const rr of [Rm-0.55*TILE,Rm+0.55*TILE]){ const x=X+Math.cos(a)*rr, y=Y+Math.sin(a)*rr, tx=-Math.sin(a), ty=Math.cos(a); g.beginPath(); g.moveTo(x+tx*12,y+ty*12); g.lineTo(x-tx*6+Math.cos(a)*6,y-ty*6+Math.sin(a)*6); g.lineTo(x-tx*6-Math.cos(a)*6,y-ty*6-Math.sin(a)*6); g.closePath(); g.fill(); g.fillRect(x-tx*16-1.5,y-ty*16-1.5,3,3); } }
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

OBJX.v2dist=function(g,o){ g.save(); g.beginPath(); o.poly.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fillStyle=g.createPattern(o.ind?TEX.conc[0]:TEX.plaza[0],'repeat'); g.fill(); g.strokeStyle='rgba(90,85,75,0.5)'; g.lineWidth=3; g.stroke(); g.restore(); };
OBJX.v2park=function(g,o){ const q=o.q.map(p=>[p[0]*TILE,p[1]*TILE]); g.save(); g.beginPath(); q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fillStyle=g.createPattern(TEX.pgrass[0],'repeat'); g.fill(); g.strokeStyle='#8f8a7e'; g.lineWidth=3; g.stroke();
  if(q.length===4){ g.strokeStyle='#d8cfb4'; g.lineWidth=6; g.beginPath(); g.moveTo((q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2); g.lineTo((q[2][0]+q[3][0])/2,(q[2][1]+q[3][1])/2); g.stroke(); } g.restore(); };

// smooth terrain: marching squares over a blurred class field -> anti-aliased coast / beach / desert / rock edges (no tile stairs)
function v2Cls(tx,ty){ if(!inb(tx,ty)) return T.WATER; const i=idx(tx,ty); let t=G[i]; if(t===T.BRIDGE) return T.WATER; if(t===T.ROAD||t===T.BLDG) t=world.under[i]; return t; }
function v2Terrain(g,cx,cy,N){ const ox=cx*N, oy=cy*N, M=N+4; const cls=new Uint8Array((M+2)*(M+2));
  for(let j=0;j<M+2;j++) for(let i=0;i<M+2;i++) cls[j*(M+2)+i]=v2Cls(ox+i-3,oy+j-3);
  const layers=[[T.SAND,TEX.sand,null],[T.ROCK,TEX.rock,null],[T.WATER,TEX.water,'rgba(225,242,255,0.55)']];
  for(const [C,tex,foam] of layers){ // field at tile centres, 3x3 box blur of the indicator
    const F=new Float32Array(M*M); let any=false;
    for(let j=0;j<M;j++) for(let i=0;i<M;i++){ let s2=0; for(let b=0;b<3;b++) for(let a=0;a<3;a++){ const c2=cls[(j+b)*(M+2)+i+a]; s2+=(c2===C||(C===T.SAND&&c2===T.WATER)||(C===T.ROCK&&false))?1:0; } F[j*M+i]=s2/9; if(s2) any=true; }
    if(!any) continue; const pat=g.createPattern(tex[0],'repeat'); g.save(); g.fillStyle=pat; g.strokeStyle=pat; g.lineWidth=1.2; g.lineJoin='round';
    const pathAll=new Path2D(), edge=new Path2D();
    for(let j=0;j<M-1;j++) for(let i=0;i<M-1;i++){ const v0=F[j*M+i],v1=F[j*M+i+1],v2=F[(j+1)*M+i+1],v3=F[(j+1)*M+i]; if(v0<0.5&&v1<0.5&&v2<0.5&&v3<0.5) continue;
      const X=k=>(i-2+0.5+k)*TILE, Y=k=>(j-2+0.5+k)*TILE, cs=[[X(0),Y(0),v0],[X(1),Y(0),v1],[X(1),Y(1),v2],[X(0),Y(1),v3]]; const poly=[], ed=[];
      for(let k=0;k<4;k++){ const A=cs[k],B=cs[(k+1)%4]; if(A[2]>=0.5) poly.push([A[0],A[1]]); if((A[2]>=0.5)!==(B[2]>=0.5)){ const t=(0.5-A[2])/(B[2]-A[2]); const p=[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]; poly.push(p); ed.push(p); } }
      if(poly.length<3) continue; pathAll.moveTo(poly[0][0],poly[0][1]); for(let k=1;k<poly.length;k++) pathAll.lineTo(poly[k][0],poly[k][1]); pathAll.closePath();
      if(ed.length===2){ edge.moveTo(ed[0][0],ed[0][1]); edge.lineTo(ed[1][0],ed[1][1]); } }
    // pattern anchored to world coordinates so chunks tile seamlessly
    g.fill(pathAll); g.stroke(pathAll);
    if(foam){ g.strokeStyle=foam; g.lineWidth=4; g.lineCap='round'; g.stroke(edge); g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=9; g.stroke(edge); }
    else { g.strokeStyle='rgba(60,50,35,0.18)'; g.lineWidth=2; g.stroke(edge); }
    g.restore(); } }

// vector roads on the minimap / world map: same polylines as the world, so the maps match the roads exactly and stay smooth at any zoom
const V2MAPCOL={hwy:['#2a2a2e','#f0b43c'],ramp:['#2a2a2e','#e9c46a'],dual:['#2a2a2e','#f4f4f4'],city:['#3a3a3e','#fbfbfb'],town:['#3a3a3e','#fbfbfb'],rural:['#3a3a3e','#f3efe6'],res:['#55555a','#ffffff'],dirt:['#7a6a52','#c9b38c']};
function v2MapPaths(){ if(world.v2map) return world.v2map; const byT={}; for(const cv of world.curves){ if(!cv.v2) continue; const t=cv.type; (byT[t]=byT[t]||{p:new Path2D(),w:cv.w,cv:[]}); const P=byT[t].p; cv.pts.forEach((q,i)=>i?P.lineTo(q[0],q[1]):P.moveTo(q[0],q[1])); byT[t].w=Math.max(byT[t].w,cv.w); }
  const rb=new Path2D(); for(const r of world.rbs){ const R=(r.rin+r.rout)/2; rb.moveTo(r.cx+R,r.cy); rb.arc(r.cx,r.cy,R,0,Math.PI*2); }
  return world.v2map={byT,rb}; }
function v2MapVectors(ox,oy,sc){ if(!world.v2) return; const M=v2MapPaths(); ctx.save(); ctx.translate(ox,oy); ctx.scale(sc,sc); ctx.lineJoin='round'; ctx.lineCap='round';
  const order=['dirt','res','rural','town','city','dual','ramp','hwy'], minW=1.4/sc;
  for(const pass of [0,1]) for(const t of order){ const L=M.byT[t]; if(!L) continue; const w=Math.max(L.w,minW*(t==='hwy'?2.2:t==='res'?1:1.5)); ctx.strokeStyle=V2MAPCOL[t][pass]; ctx.lineWidth=pass?w:w+Math.max(0.6,1.2/sc); ctx.stroke(L.p);
    if(t==='town'&&pass===1){ ctx.lineWidth=4.4; ctx.strokeStyle=V2MAPCOL.res[0]; ctx.stroke(M.rb); ctx.lineWidth=4.4-Math.max(0.6,1.2/sc); ctx.strokeStyle='#fbfbfb'; ctx.stroke(M.rb); } }
  ctx.restore(); }
// garages / forecourt props
OBJX.workshop=(g,o)=>{ const sh=o.height*0.55; g.fillStyle='rgba(10,15,25,0.28)'; g.fillRect(o.x+sh*0.6,o.y+sh*0.6,o.w,o.h); g.fillStyle='#8d949b'; g.fillRect(o.x,o.y,o.w,o.h);
  g.strokeStyle='rgba(255,255,255,0.12)'; g.lineWidth=1; for(let x=o.x+4;x<o.x+o.w;x+=6){ g.beginPath(); g.moveTo(x,o.y); g.lineTo(x,o.y+o.h); g.stroke(); }
  g.fillStyle='rgba(200,230,245,0.7)'; g.fillRect(o.x+8,o.y+o.h*0.45,o.w-16,7); g.strokeStyle='rgba(0,0,0,0.45)'; g.lineWidth=2; g.strokeRect(o.x,o.y,o.w,o.h);
  const dw=4.6*TILE; for(let k=0;k<o.doors;k++){ const x=o.x+TILE+k*6.6*TILE; g.fillStyle='#d5d8dc'; g.fillRect(x,o.y-5,dw,8); g.fillStyle='#6b7178'; for(let s=0;s<dw;s+=6) g.fillRect(x+s,o.y-5,1.5,8); g.fillStyle='#e67e22'; g.fillRect(x,o.y-7,dw,2.5); }
  g.fillStyle='#1d2733'; g.fillRect(o.x+o.w/2-70,o.y+o.h-34,140,24); g.fillStyle='#f2c230'; g.font='bold 15px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TRUCK REPAIRS',o.x+o.w/2,o.y+o.h-22); };
OBJX.rbay=(g,o)=>{ g.fillStyle='rgba(230,126,34,0.1)'; g.fillRect(o.x,o.y,o.w,o.h); g.fillStyle='#ececec'; g.fillRect(o.x,o.y,3,o.h); g.fillRect(o.x+o.w-3,o.y,3,o.h); g.save(); g.translate(o.x+o.w/2,o.y+o.h*0.25); g.fillStyle='#e67e22'; g.font='bold 22px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('BAY '+o.n,0,0); g.font='bold 13px system-ui'; g.fillStyle='#ececec'; g.fillText('R = REPAIR',0,24); g.restore(); };
OBJX.tyres=(g,o)=>{ for(let k=0;k<o.n;k++){ const x=o.x+16+(k%2)*6-3, y=o.y+16-k*2.5; g.fillStyle='rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x+4,y+4,12,0,7); g.fill(); g.fillStyle='#22252a'; g.beginPath(); g.arc(x,y,12,0,7); g.fill(); g.fillStyle='#4b4f55'; g.beginPath(); g.arc(x,y,5,0,7); g.fill(); } };
