// ===================== curvy-world v2: approved map design -> game world (road graph, rasterised tiles, buildings) =====================
// Runs inside an IIFE together with layout.js + cities2.js (their L / G / R / P names stay private).
v2patch(L);
function CRv(C,step,closed){ const P=closed?[C[C.length-2],...C,C[1]]:[[2*C[0][0]-C[1][0],2*C[0][1]-C[1][1]],...C,[2*C[C.length-1][0]-C[C.length-2][0],2*C[C.length-1][1]-C[C.length-2][1]]], out=[];
  for(let i=1;i<P.length-2;i++){ const P0=P[i-1],P1=P[i],P2=P[i+1],P3=P[i+2], tj=(a,b)=>Math.pow(Math.hypot(b[0]-a[0],b[1]-a[1])||1e-4,0.5);
    const t0=0,t1=tj(P0,P1),t2=t1+tj(P1,P2),t3=t2+tj(P2,P3), n=Math.max(1,Math.ceil(Math.hypot(P2[0]-P1[0],P2[1]-P1[1])/step));
    for(let k=0;k<n;k++){ const t=t1+(t2-t1)*k/n, Lp=(A,B,a,b)=>[(b-t)/(b-a)*A[0]+(t-a)/(b-a)*B[0],(b-t)/(b-a)*A[1]+(t-a)/(b-a)*B[1]];
      const A1=Lp(P0,P1,t0,t1),A2=Lp(P1,P2,t1,t2),A3=Lp(P2,P3,t2,t3); out.push(Lp(Lp(A1,A2,t0,t2),Lp(A2,A3,t1,t3),t1,t2)); } }
  out.push(C[C.length-1].slice()); return out; }
function vrnd(a,b,c){ let h=(a*374761393+b*668265263+(c||0)*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
function clipHalf(P,a,b,c){ const out=[], f=p=>a*p[0]+b*p[1]-c; for(let i=0;i<P.length;i++){ const A=P[i],B=P[(i+1)%P.length],fa=f(A),fb=f(B); if(fa<=0) out.push(A); if((fa<=0)!==(fb<=0)){ const t=fa/(fa-fb); out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]); } } return out; }
function wobble(P,amp){ const out=[]; for(let i=0;i<P.length;i++){ const A=P[i],B=P[(i+1)%P.length],n=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/5));
    for(let k=0;k<n;k++){ const x=A[0]+(B[0]-A[0])*k/n, y=A[1]+(B[1]-A[1])*k/n; out.push([x+amp*Math.sin(x/23+y/37)+amp*0.5*Math.sin(y/11-x/17), y+amp*Math.cos(x/31-y/19)+amp*0.5*Math.cos(x/13+y/9)]); } } return out; }
function blobP(c,R,st,ph){ const P=[]; for(let k=0;k<96;k++){ const a=k/96*Math.PI*2, r=R*(1+0.17*Math.sin(2*a+ph[0])+0.11*Math.sin(3*a+ph[1])+0.07*Math.sin(5*a+ph[2])); P.push([c[0]+Math.cos(a)*r*st[0],c[1]+Math.sin(a)*r*st[1]]); } return P; }
function inPoly(P,x,y){ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const a=P[i],b=P[j]; if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }
const R2=(p,o,a)=>{ const c=Math.cos(a),sn=Math.sin(a); return [o[0]+p[0]*c-p[1]*sn,o[1]+p[0]*sn+p[1]*c]; };
function seqv(lo,hi,step,sa,sb){ const a=[]; let x=lo,k=0; while(x<hi){ a.push(x); x+=step*(0.72+0.6*vrnd(sa,k++,sb)); } a.push(x); return a; }
function buildCities(){ const out=[];
  const towns=L.grids.map(g=>{ const W=g.xs[g.xs.length-1],H=g.ys[g.ys.length-1], c=[g.ox+(W/2)*Math.cos(g.ang)-(H/2)*Math.sin(g.ang), g.oy+(W/2)*Math.sin(g.ang)+(H/2)*Math.cos(g.ang)], R=Math.max(W,H)*0.62+18;
    return {name:g.name, town:true, c, R, st:[1,1], ph:[g.ox%6,g.oy%5,1], d:[[g.name,c[0],c[1],g.ang,10+(g.ox%4),11+(g.oy%3),'mid'],[g.name+' S',c[0]+R*0.6,c[1]+R*0.5,g.ang+0.5,0,0,'sub'],[g.name+' W',c[0]-R*0.7,c[1]-R*0.3,g.ang-0.4,0,0,'sub']], art:[], parks:[] }; });
  for(const C of [...CITIES,...towns]){ const B=blobP(C.c,C.R,C.st,C.ph), ds=[];
    C.d.forEach((d,i)=>{ let P=B; C.d.forEach((e,j)=>{ if(i===j) return; const ax=e[1]-d[1], ay=e[2]-d[2], mx=(e[1]+d[1])/2, my=(e[2]+d[2])/2; P=clipHalf(P,ax,ay,ax*mx+ay*my); });
      if(P.length>2) ds.push({name:d[0],seed:[d[1],d[2]],ang:d[3],bw:d[4],bh:d[5],kind:d[6],poly:wobble(P,C.town?1.5:4),i}); });
    out.push({C,blob:wobble(B,4),ds}); } return out; }
// interchange geometry (same curvilinear frame as the approved design renderer)
function frame(S,i0,dir){ const cum=[0]; for(let i=1;i<S.length;i++) cum.push(cum[i-1]+Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]));
  return (u)=>{ const target=cum[i0]+dir*u; if(target<=0||target>=cum[cum.length-1]){ const end=target<=0, a=end?S[0]:S[S.length-2], b=end?S[1]:S[S.length-1], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, t=[(b[0]-a[0])/l,(b[1]-a[1])/l], e=end?target:target-cum[cum.length-1], o=end?a:b; return {p:[o[0]+t[0]*e,o[1]+t[1]*e],t:[t[0]*dir,t[1]*dir]}; }
    let lo=0,hi=cum.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(cum[m]<target) lo=m; else hi=m; } const a=S[lo],b=S[hi],f=(target-cum[lo])/((cum[hi]-cum[lo])||1), l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    return {p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],t:[(b[0]-a[0])/l*dir,(b[1]-a[1])/l*dir]}; }; }
function nearestOn(S,x,y){ let bi=0,bd=1e18; S.forEach((p,i)=>{ const d=(p[0]-x)**2+(p[1]-y)**2; if(d<bd){ bd=d; bi=i; } }); return [bi,Math.sqrt(bd)]; }
const c=3.2;
const RAMPS={ stack:{left:[[-110,-c],[-66,-c-3],[-46,-22],[-22,-46],[-c-3,-66],[-c,-110]], fly:[[-125,-c],[-72,-c+1.5],[-36,7],[-15,19],[-4,38],[c,66],[c,125]]},
 cloverleaf:{left:[[-100,-c],[-60,-c-2],[-48,-24],[-24,-48],[-c-2,-60],[-c,-100]], loop:[[10,-c],[22,-6],[30,-16],[25,-28],[13,-31],[5,-22],[c,-10],[c,4]]},
 tee:{ramps:[[[100,c],[58,c+1.5],[32,12],[12,32],[c+1.5,58],[c,100]],[[-c,100],[-c-1.5,58],[-12,32],[-32,12],[-58,c+1.5],[-100,c]]], fly:[[[-120,-c],[-80,-c+1],[-46,5],[-22,20],[-4,44],[c,76],[c,120]],[[-c,120],[-c,78],[-1,46],[16,22],[42,4],[80,-c+1],[120,-c]]]},
 diamond:{slip:[[-100,-c],[-66,-c-5],[-36,-14],[-12,-22],[-5,-24]], rb:24} };
function interchange(J,FW,out){ const [id,kind,jx,jy,nm]=J;
  if(kind==='terminal'){ let bp=null,bd=1e18; for(const r of L.roads){ if(r.cls==='D') continue; for(const q of CRv(r.pts,2)){ const d=(q[0]-jx)**2+(q[1]-jy)**2; if(d<bd){ bd=d; bp=q; } } } if(bp) out.push({type:'town',w:4,pts:[[jx,jy],bp],name:'M3 link'}); out.push({rb:[jx,jy,8],name:nm}); return; }
  let best=null; for(const [f,S] of FW){ const [i,d]=nearestOn(S,jx,jy); const endish=!f.closed&&(i<25||i>S.length-25); const sc=d+(kind==='tee'&&endish?1000:0); if(!best||sc<best.sc) best={f,S,i,d,sc}; }
  const others=FW.filter(([f])=>f!==best.f).map(([f,S])=>{ const [i,d]=nearestOn(S,best.S[best.i][0],best.S[best.i][1]); return {f,S,i,d}; }).filter(o=>o.d<14).sort((a,b)=>a.d-b.d);
  const p0=best.S[best.i]; let main=frame(best.S,best.i,1); let t=main(0).t, n=[-t[1],t[0]], cross=null;
  if(kind==='stack'||kind==='tee'){ const o=others[0]; if(o){ const S2=o.S, ahead=S2[Math.min(S2.length-1,o.i+30)]; let dir=((ahead[0]-p0[0])*n[0]+(ahead[1]-p0[1])*n[1])>0?1:-1;
      if(kind==='tee'){ const away=(o.i<S2.length/2)?1:-1, far=S2[Math.max(0,Math.min(S2.length-1,o.i+away*40))]; if(((far[0]-p0[0])*n[0]+(far[1]-p0[1])*n[1])<0){ main=frame(best.S,best.i,-1); t=main(0).t; n=[-t[1],t[0]]; } dir=away; }
      cross=frame(S2,o.i,dir); } }
  if(!cross) cross=(v)=>({p:[p0[0]+n[0]*v,p0[1]+n[1]*v],t:n});
  const M=(u,v)=>{ const a=main(u), m=[-a.t[1],a.t[0]], pa=[a.p[0]+m[0]*v,a.p[1]+m[1]*v]; const b=cross(v), mb=[b.t[1],-b.t[0]]; const sg=(mb[0]*t[0]+mb[1]*t[1])>0?1:-1, pb=[b.p[0]+mb[0]*u*sg,b.p[1]+mb[1]*u*sg];
    const au=Math.abs(u),av=Math.abs(v), w=au*au/((au*au+av*av)||1); return [pa[0]*w+pb[0]*(1-w),pa[1]*w+pb[1]*(1-w)]; };
  const rotq=(P,k)=>P.map(([u,v])=>{ for(let r=0;r<k;r++) [u,v]=[-v,u]; return [u,v]; });
  const ramp=(P,fly)=>out.push({type:'ramp',w:2,pts:CRv(P.map(q=>M(q[0],q[1])),0.5),fly:!!fly,name:id+' slip'});
  const xroad=()=>{ const C=[]; for(let v=-120;v<=120;v+=2) C.push(M(0,v)); out.push({type:'town',w:4,pts:C,name:nm,over:true}); };
  const R=RAMPS[kind];
  if(kind==='stack'){ for(let k=0;k<4;k++) ramp(rotq(R.left,k)); for(let k=0;k<4;k++) ramp(rotq(R.fly,k),true); }
  if(kind==='cloverleaf'){ for(let k=0;k<4;k++) ramp(rotq(R.left,k)); xroad(); for(let k=0;k<4;k++) ramp(rotq(R.loop,k),true); }
  if(kind==='tee'){ for(const r of R.ramps) ramp(r); for(const r of R.fly) ramp(r,true); }
  if(kind==='diamond'){ for(const su of [-1,1]) for(const sv of [-1,1]) ramp(R.slip.map(([u,v])=>[u*su,v*sv])); xroad(); for(const sv of [-1,1]){ const q=M(0,sv*R.rb); out.push({rb:[q[0],q[1],5],name:nm}); } }
  out.push({jn:[id,kind,p0[0],p0[1],nm]}); }
// ---------------- graph extraction: every road as a polyline with class / width ----------------
function v2Graph(){ const E=[], CS=buildCities(), BLK=[], PARKS=[], STAD=[], JN=[], RBS=[];
  const FW=L.fwy.map(f=>[f,CRv(f.pts,0.5,!!f.closed)]);
  for(const [f,S] of FW) E.push({type:'hwy',w:6,pts:S,name:f.name,cls:'M'});
  const tmp=[]; for(const J of L.inter) interchange(J,FW,tmp); for(const o of tmp){ if(o.jn) JN.push(o.jn); else if(o.rb) RBS.push(o); else E.push(o); }
  for(const r of L.roads){ const S=CRv(r.pts,0.5); E.push({type:r.cls==='A'?'rural':r.cls==='B'?'rural':'dirt',w:r.cls==='D'?3:4,pts:S,name:r.name,cls:r.cls,dam:r.dam}); }
  CS.forEach((cc,ci)=>{ const big=cc.blob.map(p=>[cc.C.c[0]+(p[0]-cc.C.c[0])*1.05,cc.C.c[1]+(p[1]-cc.C.c[1])*1.05]);
    for(const [n,P,sty] of (cc.C.art||[])){ const S=CRv(P,0.5); let run=[]; const flush=()=>{ if(run.length>6) E.push({type:sty==='blvd'?'dual':'city',w:sty==='blvd'?6:4,pts:run,name:n,cls:'art'}); run=[]; }; for(const p of S){ if(inPoly(big,p[0],p[1])) run.push(p); else flush(); } flush(); }
    for(const p of (cc.C.parks||[])) PARKS.push(p); if(cc.C.stadium) STAD.push(cc.C.stadium);
    cc.ds.forEach(D=>district(D,ci,E,BLK)); });
  return {E,CS,BLK,PARKS,STAD,JN,RBS}; }
function runsIn(P,pts){ const out=[]; let run=[]; for(const p of pts){ if(inPoly(P,p[0],p[1])) run.push(p); else { if(run.length>1) out.push(run); run=[]; } } if(run.length>1) out.push(run); return out; }
function district(D,ci,E,BLK){ const P=D.poly,o=D.seed,a=D.ang; let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9; for(const p of P){ const q=R2([p[0]-o[0],p[1]-o[1]],[0,0],-a); mnx=Math.min(mnx,q[0]); mxx=Math.max(mxx,q[0]); mny=Math.min(mny,q[1]); mxy=Math.max(mxy,q[1]); }
  const T2=(u,v)=>R2([u,v],o,a);
  if(D.kind==='sub'){ for(let v0=mny-10,si=0; v0<mxy+10; v0+=30,si++){ const ph=vrnd(ci,si,7)*6, sp=[]; for(let u=mnx-10;u<mxx+10;u+=1) sp.push(T2(u,v0+7*Math.sin(u/38+ph)));
      for(const r of runsIn(P,sp)) if(r.length>8) E.push({type:'res',w:2,pts:r,name:D.name+' Drive',cls:'sub',dist:D.name});
      let side=1; for(let u=mnx-6,k=0; u<mxx+6; u+=10+vrnd(ci,si,k)*5,k++){ side=-side; const vv=v0+7*Math.sin(u/38+ph), Ln=9+vrnd(si,k,ci)*5, bend=(vrnd(k,si,3)-0.5)*8;
        if(!inPoly(P,...T2(u,vv))) continue; const cp=CRv([[u,vv],[u+bend*0.4,vv+side*Ln*0.5],[u+bend,vv+side*Ln]].map(q=>T2(q[0],q[1])),0.5); const rr=runsIn(P,cp); if(rr.length&&rr[0].length>6) E.push({type:'res',w:2,pts:rr[0],name:D.name+' Close',cls:'cul',bulb:true,dist:D.name}); } }
    return; }
  const SC=D.kind==='down'?1.65:D.kind==='ind'?1.3:1.5, bw=D.bw*SC, bh=D.bh*SC, xs=seqv(mnx-bw,mxx+bw,bw,ci*31+D.i,1), ys=seqv(mny-bh,mxy+bh,bh,ci*17+D.i,2), w=D.kind==='mid'?2:4;
  // streets as per-cell segments (markings stop at junctions); runs clipped to the district polygon
  const seg=(A,B)=>{ const n=Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/0.5), pts=[]; for(let k=0;k<=n;k++) pts.push([A[0]+(B[0]-A[0])*k/n,A[1]+(B[1]-A[1])*k/n]); for(const r of runsIn(P,pts)) if(r.length>3) E.push({type:D.kind==='ind'?'town':w===2?'town':'city',w,pts:r,name:D.name,cls:'grid',trim:true,dist:D.name}); };
  for(let i=0;i<xs.length;i++) for(let j=0;j<ys.length-1;j++) seg(T2(xs[i],ys[j]),T2(xs[i],ys[j+1]));
  for(let j=0;j<ys.length;j++) for(let i=0;i<xs.length-1;i++) seg(T2(xs[i],ys[j]),T2(xs[i+1],ys[j]));
  for(let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++){ const r=vrnd(ci*100+D.i,i,j), r2=vrnd(j,i,ci*7+D.i), m=w/2+1.1; const x0=xs[i]+m,x1=xs[i+1]-m,y0=ys[j]+m,y1=ys[j+1]-m; if(x1-x0<2||y1-y0<2) continue;
    const ctr=T2((x0+x1)/2,(y0+y1)/2); if(!inPoly(P,ctr[0],ctr[1])) continue;
    BLK.push({kind:D.kind,park:r2<0.06,lot:r2>0.95,q:[T2(x0,y0),T2(x1,y0),T2(x1,y1),T2(x0,y1)],ang:a,r,poly:P,ci,dist:D.name}); } }
// ---------------- apply to the game world ----------------
function v2Apply(objs,Rnd){ const t0=performance.now(); const water=world.water;
  // 1. strip the legacy road network / cities, keep the terrain
  const CW=new Float32Array(MH); for(let y=0;y<MH;y++) CW[y]=cW(y);
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){ const i=idx(x,y); world.roadH[i]=-1; world.roadV[i]=-1; world.under[i]=0; if(world.cornerAt) world.cornerAt[i]=-1; if(world.reserved) world.reserved[i]=0;
    if(water[i]){ G[i]=T.WATER; continue; } let t=(x>CW[y]+20&&y<cE(x)+40&&isDesert(x,y))?T.SAND:T.GRASS;
    for(const h of HILLS){ const dx=x-h.x, dy=y-h.y; if(Math.abs(dx)>h.r*1.2||Math.abs(dy)>h.r*1.2) continue; if(Math.hypot(dx,dy)<h.r*(0.82+0.3*vnoise(x,y,40))) t=T.ROCK; } G[i]=t; }
  for(let y=1;y<MH-1;y++) for(let x=1;x<MW-1;x++){ const i=idx(x,y); if(water[i]||G[i]===T.ROCK) continue; if(water[i-1]||water[i+1]||water[i-MW]||water[i+MW]) G[i]=T.SAND; }
  world.segs=[]; world.curves=[]; world.rbs=[]; world.junctions=[]; world.corners=[]; world.overhead=[]; world.susp=[]; world.districts=[]; world.airports=[]; world.cities=[];
  const keep=objs.filter(o=>o.kind==='tree'&&!o.inCity||o.kind==='rock'||o.kind==='cactus'||o.kind==='scrub'); objs.length=0; for(const o of keep) objs.push(o);
  // 2. graph
  const g=v2Graph(); world.v2=g;
  { const E2=[]; for(const e of g.E){ if(e.type!=='res'){ E2.push(e); continue; } let run=[]; const flush=()=>{ if(run.length>=3) E2.push(Object.assign({},e,{pts:run,bulb:e.bulb&&run[run.length-1]===e.pts[e.pts.length-1]})); run=[]; };
      for(const q of e.pts){ const tx=Math.floor(q[0]),ty=Math.floor(q[1]); let wet=!inb(tx,ty); for(let dy=-2;dy<=2&&!wet;dy++) for(let dx=-2;dx<=2;dx++) if(inb(tx+dx,ty+dy)&&(water[idx(tx+dx,ty+dy)]||G[idx(tx+dx,ty+dy)]===T.WATER)){ wet=true; break; } if(wet) flush(); else run.push(q); } flush(); } g.E=E2; } const edges=[]; const PL=planarise(g.E,g.RBS); g.P=PL.P; g.N=PL.N; g.E=PL.P.filter(p=>!p.dead);
  const order={dirt:0,res:1,rural:2,town:3,city:4,dual:5,ramp:6,hwy:7};
  g.E.sort((a,b)=>(order[a.type]||0)-(order[b.type]||0));
  const RMW=MW*M_T; const RM=world.rm=new Uint8Array((RMW*MH*M_T)>>3); const rmSet=(x,y)=>{ const i=y*RMW+x; RM[i>>3]|=1<<(i&7); };
  const rmSeg=(ax,ay,bx,by,r)=>{ ax*=M_T; ay*=M_T; bx*=M_T; by*=M_T; const x0=Math.max(0,Math.floor(Math.min(ax,bx)-r)), x1=Math.min(RMW-1,Math.ceil(Math.max(ax,bx)+r)), y0=Math.max(0,Math.floor(Math.min(ay,by)-r)), y1=Math.min(MH*M_T-1,Math.ceil(Math.max(ay,by)+r)); const dx=bx-ax, dy=by-ay, L2=dx*dx+dy*dy||1e-9, r2=r*r;
    for(let y=y0;y<=y1;y++){ const py=y+0.5; for(let x=x0;x<=x1;x++){ const px=x+0.5; let t=((px-ax)*dx+(py-ay)*dy)/L2; t=t<0?0:t>1?1:t; const ex=ax+dx*t-px, ey=ay+dy*t-py; if(ex*ex+ey*ey<=r2) rmSet(x,y); } } };
  world.rmSeg=rmSeg;
  for(const e of g.E){ if(e.pts.length<2) continue; const hw=e.w/2; let wet=0, x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const [px,py] of e.pts){ x0=Math.min(x0,px); y0=Math.min(y0,py); x1=Math.max(x1,px); y1=Math.max(y1,py);
      for(let ty=Math.floor(py-hw-1);ty<=py+hw+1;ty++) for(let tx=Math.floor(px-hw-1);tx<=px+hw+1;tx++){ if(!inb(tx,ty)) continue; if(Math.hypot(tx+0.5-px,ty+0.5-py)>hw+0.05) continue; const i=idx(tx,ty);
        if(G[i]!==T.ROAD&&G[i]!==T.BRIDGE) world.under[i]=G[i]; const wt=water[i]; if(wt) wet++; G[i]=wt?T.BRIDGE:T.ROAD; world.roadH[i]=-3; world.roadV[i]=-3; } }
    for(let k=1;k<e.pts.length;k++) rmSeg(e.pts[k-1][0],e.pts[k-1][1],e.pts[k][0],e.pts[k][1],hw*M_T);
    if(e.bulb){ const [bx,by]=e.pts[e.pts.length-1]; rmSeg(bx,by,bx,by,2.2*M_T); for(let ty=Math.floor(by-3);ty<=by+3;ty++) for(let tx=Math.floor(bx-3);tx<=bx+3;tx++) if(inb(tx,ty)&&Math.hypot(tx+0.5-bx,ty+0.5-by)<2.2&&!water[idx(tx,ty)]){ const i=idx(tx,ty); if(G[i]!==T.ROAD) world.under[i]=G[i]; G[i]=T.ROAD; world.roadH[i]=-3; world.roadV[i]=-3; } }
    const NA=g.N[e.a],NB=g.N[e.b]; const cv={id:world.curves.length,type:e.type,w:e.w,pts:e.pts,name:e.name,bridge:wet>0,v2:e,trimA:NA&&NA.deg>=3&&!NA.rb,trimB:NB&&NB.deg>=3&&!NB.rb,bulb:e.bulb&&NB&&NB.deg===1,fly:e.fly,cls:e.cls,decks:e.decks||[],a:e.a,b:e.b}; e.cv=cv;
    let rmin=1e9; for(let i=4;i<e.pts.length-4;i+=2){ const a=e.pts[i-4],b=e.pts[i],c2=e.pts[i+4]; const A2=Math.abs((b[0]-a[0])*(c2[1]-a[1])-(b[1]-a[1])*(c2[0]-a[0])); const la=Math.hypot(b[0]-a[0],b[1]-a[1]),lb=Math.hypot(c2[0]-b[0],c2[1]-b[1]),lc=Math.hypot(c2[0]-a[0],c2[1]-a[1]); if(A2>1e-6) rmin=Math.min(rmin,la*lb*lc/(2*A2)); }
    cv.rmin=rmin*M_T; cv.vmax=Math.min(40,Math.sqrt(Math.max(9,cv.rmin)*2.4)); world.curves.push(cv); edges.push(cv);
    const pad=hw+3; objs.push({kind:'curve',z2:cv.decks.length||cv.fly?1:0,cv,x:(x0-pad)*TILE,y:(y0-pad)*TILE,w:(x1-x0+pad*2)*TILE,h:(y1-y0+pad*2)*TILE});
    if(e.type==='city'||e.type==='town'||e.type==='dual'||e.type==='res') objs.push({kind:'v2pave',cv,x:(x0-pad)*TILE,y:(y0-pad)*TILE,w:(x1-x0+pad*2)*TILE,h:(y1-y0+pad*2)*TILE}); }
  // roundabouts (diamond interchanges, M3 terminal)
  for(const r of g.RBS){ const [cx,cy,rr]=r.rb; const rb={cx,cy,rin:rr-2.2,rout:rr+2.2,arms:[],id:world.rbs.length,name:r.name}; world.rbs.push(rb);
    for(let y=Math.floor((cy-rb.rout)*M_T);y<=(cy+rb.rout)*M_T;y++) for(let x=Math.floor((cx-rb.rout)*M_T);x<=(cx+rb.rout)*M_T;x++){ const d=Math.hypot(x+0.5-cx*M_T,y+0.5-cy*M_T); if(d<=rb.rout*M_T&&d>=rb.rin*M_T&&x>=0&&y>=0&&x<RMW&&y<MH*M_T) rmSet(x,y); }
    for(let y=Math.floor(cy-rb.rout-1);y<=cy+rb.rout+1;y++) for(let x=Math.floor(cx-rb.rout-1);x<=cx+rb.rout+1;x++){ if(!inb(x,y)) continue; const d=Math.hypot(x+0.5-cx,y+0.5-cy), i=idx(x,y);
      if(d<=rb.rout+0.3&&d>=rb.rin-0.3){ if(G[i]!==T.ROAD&&G[i]!==T.BRIDGE) world.under[i]=G[i]; G[i]=water[i]?T.BRIDGE:T.ROAD; world.roadH[i]=-3; world.roadV[i]=-3; } else if(d<rb.rin-0.3) G[i]=T.ISLAND; }
    objs.push({kind:'v2rb',rb,x:(cx-rb.rout-2)*TILE,y:(cy-rb.rout-2)*TILE,w:(2*rb.rout+4)*TILE,h:(2*rb.rout+4)*TILE}); }
  for(const cc of g.CS) for(const D of cc.ds){ if(D.kind==='sub') continue; const P=D.poly; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of P){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }
    for(let ty=Math.floor(y0);ty<=y1;ty++) for(let tx=Math.floor(x0);tx<=x1;tx++){ if(!inb(tx,ty)) continue; const i=idx(tx,ty); if(water[i]||G[i]===T.ROAD||G[i]===T.BRIDGE) continue; } objs.push({kind:'v2dist',poly:P.map(q=>[q[0]*TILE,q[1]*TILE]),ind:D.kind==='ind',x:x0*TILE,y:y0*TILE,w:(x1-x0)*TILE,h:(y1-y0)*TILE}); }
  // 3. city blocks -> buildings (rotated footprints; tiles under them are solid)
  const solidQuad=(q,tile)=>{ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of q){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }
    let n=0; for(let ty=Math.floor(y0);ty<=y1;ty++) for(let tx=Math.floor(x0);tx<=x1;tx++){ if(!inb(tx,ty)) continue; const i=idx(tx,ty); if(G[i]===T.ROAD||G[i]===T.BRIDGE||water[i]) continue; if(inPoly(q,tx+0.5,ty+0.5)){ if(tile===T.BLDG) world.under[i]=G[i]; G[i]=tile; n++; } } return [x0,y0,x1,y1,n]; };
  const ROOF={down:['#8d939b','#a7adb5','#6f7781','#b9a58c','#9aa3a8'],mid:['#b0624e','#9b5a48','#c27b5c','#8e8f93','#a96f55'],ind:['#9fa6ab','#b6bbbe','#7f8a92','#c2c7c9']};
  let nb=0;
  for(const b of g.BLK){ if(water[idx(Math.floor(b.q[0][0]),Math.floor(b.q[0][1]))]) continue;
    if(b.park){ const bb=solidQuad(b.q,T.PGRASS); objs.push({kind:'v2park',q:b.q,x:bb[0]*TILE,y:bb[1]*TILE,w:(bb[2]-bb[0])*TILE,h:(bb[3]-bb[1])*TILE}); continue; }
    if(b.lot){ const bb=solidQuad(b.q,T.LOT); continue; }
    // split a block into 1-4 buildings with service gaps
    const nx=b.kind==='ind'?1:(b.r<0.45?1:2), ny=b.kind==='ind'?1:(b.r>0.6?2:1), [A,B,C,D]=b.q;
    for(let p=0;p<nx;p++) for(let q2=0;q2<ny;q2++){ const L2=(u,v)=>{ const top=[A[0]+(B[0]-A[0])*u,A[1]+(B[1]-A[1])*u], bot=[D[0]+(C[0]-D[0])*u,D[1]+(C[1]-D[1])*u]; return [top[0]+(bot[0]-top[0])*v,top[1]+(bot[1]-top[1])*v]; };
      const gu=nx>1?0.06:0, gv=ny>1?0.06:0, u0=p/nx+(p?gu:0), u1=(p+1)/nx-(p<nx-1?gu:0), v0=q2/ny+(q2?gv:0), v1=(q2+1)/ny-(q2<ny-1?gv:0);
      const fp=[L2(u0,v0),L2(u1,v0),L2(u1,v1),L2(u0,v1)]; const bb=solidQuad(fp,T.BLDG); if(!bb[4]) continue;
      const pal=ROOF[b.kind]||ROOF.mid, h=b.kind==='down'?30+vrnd(nb,3,1)*70:b.kind==='ind'?18:12+vrnd(nb,5,2)*10;
      objs.push({kind:'v2b',fp:fp.map(p2=>[p2[0]*TILE,p2[1]*TILE]),col:pal[Math.floor(vrnd(nb,1,b.ci)*pal.length)],height:h,ind:b.kind==='ind',x:bb[0]*TILE,y:bb[1]*TILE,w:(bb[2]-bb[0])*TILE,h:(bb[3]-bb[1])*TILE,seed:nb}); nb++; } }
  let nh=0; for(const cv of edges){ if(cv.cls!=='cul'&&cv.cls!=='sub') continue; const P=cv.pts; for(let i=4;i<P.length-4;i+=7){ const a=P[i-1],b=P[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,tx=(b[0]-a[0])/l,ty=(b[1]-a[1])/l;
      for(const sd of [-1,1]){ const cx=P[i][0]-ty*sd*3.4, cy=P[i][1]+tx*sd*3.4, q=[[-1.3,-1.1],[1.3,-1.1],[1.3,1.1],[-1.3,1.1]].map(([u,v])=>[cx+tx*u-ty*v*sd,cy+ty*u+tx*v*sd]);
        let ok=true; for(const p of q){ const t2=get(Math.floor(p[0]),Math.floor(p[1])); if(t2===T.ROAD||t2===T.BRIDGE||t2===T.WATER||t2===T.BLDG) ok=false; } if(!ok) continue;
        const bb=solidQuad(q,T.BLDG); if(!bb[4]) continue; objs.push({kind:'v2b',fp:q.map(p2=>[p2[0]*TILE,p2[1]*TILE]),col:['#b0624e','#c98d5f','#8f5446','#a3a39b','#d6b37c'][nh%5],height:9,house:true,x:bb[0]*TILE,y:bb[1]*TILE,w:(bb[2]-bb[0])*TILE,h:(bb[3]-bb[1])*TILE,seed:nh}); nh++; } } }
  for(const p of g.PARKS){ const [n,x,y,rx,ry,a]=p; const P=[]; for(let k=0;k<32;k++){ const t=k/32*Math.PI*2; P.push(R2([Math.cos(t)*rx,Math.sin(t)*ry],[x,y],a)); } objs.push({kind:'v2park',q:P,x:(x-rx-ry)*TILE,y:(y-rx-ry)*TILE,w:2*(rx+ry)*TILE,h:2*(rx+ry)*TILE});
    for(let ty=Math.floor(y-Math.max(rx,ry));ty<=y+Math.max(rx,ry);ty++) for(let tx=Math.floor(x-Math.max(rx,ry));tx<=x+Math.max(rx,ry);tx++){ if(!inb(tx,ty)) continue; const i=idx(tx,ty); if(G[i]===T.ROAD||G[i]===T.BRIDGE) continue; if(inPoly(P,tx+0.5,ty+0.5)){ if(objs.length&&G[i]===T.BLDG) continue; G[i]=T.PGRASS; if(vrnd(tx,ty,9)<0.05) objs.push({kind:'tree',x:tx*TILE,y:ty*TILE,r:10+vrnd(ty,tx,4)*7,seed:(tx*7919+ty)|0}); } } }
  // 4. landmarks: airports + docks surfaces
  for(const lm of L.landmarks){ const P=lm.poly; for(let y=P[0][1];y<P[2][1];y++) for(let x=P[0][0];x<P[1][0];x++){ if(!inb(x,y)) continue; const i=idx(x,y); if(water[i]||G[i]===T.ROAD||G[i]===T.BRIDGE) continue; G[i]=lm.kind==='docks'?T.QUAY:T.CONC; }
    if(lm.kind==='airport') for(const r of lm.rw) objs.push({kind:'runway',x:r[0]*TILE,y:r[1]*TILE,w:(r[2]-r[0])*TILE,h:(r[3]-r[1])*TILE,v2:true}); }
  // scenery cleanup: no legacy trees on roads / in the cities (parks re-plant their own)
  { const inCity=new Uint8Array(MW*MH); for(const cc of g.CS){ const B=cc.blob; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of B){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }
      for(let ty=Math.max(0,Math.floor(y0));ty<=Math.min(MH-1,y1);ty+=2) for(let tx=Math.max(0,Math.floor(x0));tx<=Math.min(MW-1,x1);tx+=2) if(inPoly(B,tx,ty)){ inCity[idx(tx,ty)]=1; if(tx+1<MW) inCity[idx(tx+1,ty)]=1; if(ty+1<MH){ inCity[idx(tx,ty+1)]=1; if(tx+1<MW) inCity[idx(tx+1,ty+1)]=1; } } }
    const keep2=[]; for(const o of objs){ if(o.kind!=='tree'&&o.kind!=='rock'&&o.kind!=='scrub'&&o.kind!=='cactus'){ keep2.push(o); continue; } const tx=Math.floor(o.x/TILE),ty=Math.floor(o.y/TILE); if(!inb(tx,ty)) continue; const t=get(tx,ty);
      if(t===T.PGRASS){ keep2.push(o); continue; } if(t!==T.GRASS&&t!==T.SAND&&t!==T.ROCK) continue; if(inCity[idx(tx,ty)]) continue; let near=false; for(let dy=-2;dy<=2&&!near;dy++) for(let dx=-2;dx<=2;dx++){ const t2=get(tx+dx,ty+dy); if(t2===T.ROAD||t2===T.BRIDGE||t2===T.BLDG){ near=true; break; } } if(!near) keep2.push(o); }
    objs.length=0; for(const o of keep2) objs.push(o); }
  if(world.dam){ const d=world.dam; objs.push({kind:'dam',x:d.x0*TILE,y:(d.y-1)*TILE,w:(d.x1-d.x0)*TILE,h:5*TILE,d}); }
  // suspension bridges on long motorway sea crossings (curved deck)
  world.v2susp=[]; for(const cv of edges){ if(cv.type!=='hwy') continue; const P=cv.pts; let a=-1; for(let i=0;i<=P.length;i++){ const wet=i<P.length&&world.water[idx(Math.floor(P[i][0]),Math.floor(P[i][1]))]; if(wet&&a<0) a=i; if(!wet&&a>=0){ const len=(i-a)*0.5; if(len>=45){ const S={cv,i0:Math.max(0,a-10),i1:Math.min(P.length-1,i+10)}; S.t0=Math.round(S.i0+(S.i1-S.i0)*0.2); S.t1=Math.round(S.i0+(S.i1-S.i0)*0.8); world.v2susp.push(S);
        for(let j=S.i0;j<S.i1;j+=16){ const q=P[Math.min(S.i1,j+8)]; world.overhead.push({kind:'v2susp',S,j0:j,j1:Math.min(S.i1,j+16),x:q[0]*TILE,y:q[1]*TILE}); }
        for(const tj of [S.t0,S.t1]){ const q=P[tj]; world.overhead.unshift({kind:'v2tower',S,j:tj,x:q[0]*TILE,y:q[1]*TILE}); } } a=-1; } } }
  // 5. truck start: on the downtown street nearest Big Rig Haulage HQ, heading along it
  const hq=L.poi.find(p=>p.name==='Big Rig Haulage HQ')||{x:265,y:255}; let best=null;
  for(const cv of edges){ if(cv.type!=='city') continue; for(let i=2;i<cv.pts.length-2;i++){ const p=cv.pts[i], d=Math.hypot(p[0]-hq.x,p[1]-hq.y); if(!best||d<best.d) best={d,cv,i}; } }
  if(best){ const P=best.cv.pts, a=P[best.i-1], b=P[best.i+1], h=Math.atan2(b[1]-a[1],b[0]-a[0]), nx=Math.sin(h), ny=-Math.cos(h); const p=P[best.i]; world.start={x:(p[0]+nx*1)*TILE,y:(p[1]+ny*1)*TILE,h:h+Math.PI/2}; }
  // start depot (HQ yard): nearest 24x20 clearing (buildings allowed, cleared) with a city street along its top edge
  world.v2hw=new Uint8Array(MW*MH); for(const cv of edges) if(cv.type==='hwy'||cv.type==='ramp') for(const [px,py] of cv.pts) for(let ty=Math.floor(py-cv.w/2);ty<=py+cv.w/2;ty++) for(let tx=Math.floor(px-cv.w/2);tx<=px+cv.w/2;tx++) if(inb(tx,ty)&&G[idx(tx,ty)]!==T.GRASS) world.v2hw[idx(tx,ty)]=1;
  const W0=18,H0=15, okD=t=>t!==T.ROAD&&t!==T.BRIDGE&&t!==T.WATER&&t!==T.ROCK; let sd=null;
  outer: for(let rad=0;rad<320;rad+=2) for(let dy=-rad;dy<=rad;dy+=2) for(let dx=-rad;dx<=rad;dx+=2){ if(Math.max(Math.abs(dx),Math.abs(dy))!==rad) continue; const x=Math.round(hq.x+dx-W0/2), y=Math.round(hq.y+dy-H0/2);
    let bad=false; for(let j=y;j<y+H0&&!bad;j++) for(let i=x;i<x+W0;i++) if(!inb(i,j)||!okD(G[idx(i,j)])){ bad=true; break; } if(bad) continue;
    let road=0; for(let i=x+W0/2-3;i<x+W0/2+3;i++) for(let j=y-3;j<y;j++) if(get(i,j)===T.ROAD&&!world.v2hw[idx(i,j)]) { road++; break; } if(road<6) continue; sd={x0:x,y0:y,w:W0,h:H0}; break outer; }
  if(sd){ for(let j=sd.y0;j<sd.y0+sd.h;j++) for(let i=sd.x0;i<sd.x0+sd.w;i++) G[idx(i,j)]=T.CONC; for(let j=sd.y0-3;j<sd.y0;j++) for(let i=sd.x0+sd.w/2-3;i<sd.x0+sd.w/2+3;i++) if(G[idx(i,j)]!==T.ROAD) G[idx(i,j)]=T.CONC;
    const X0=sd.x0*TILE,Y0=(sd.y0-3)*TILE,X1=(sd.x0+sd.w)*TILE,Y1=(sd.y0+sd.h)*TILE; for(let k=objs.length-1;k>=0;k--){ const o=objs[k]; if((o.kind==='v2b'||o.kind==='tree')&&o.x<X1&&o.x+(o.w||0)>X0&&o.y<Y1&&o.y+(o.h||0)>Y0) objs.splice(k,1); }
    for(let j=sd.y0+1;j<sd.y0+6;j++) for(let i=sd.x0+1;i<sd.x0+8;i++) G[idx(i,j)]=T.BLDG; objs.push({kind:'bldg',x:(sd.x0+1)*TILE,y:(sd.y0+1)*TILE,w:7*TILE,h:5*TILE,style:'warehouse',height:24,seed:4242,logo:'HQ'});
    world.start={x:(sd.x0+sd.w/2)*TILE,y:(sd.y0+sd.h-8)*TILE,h:0}; }
  world.startDepot=sd||{x0:Math.round(hq.x),y0:Math.round(hq.y),w:W0,h:H0};
  // no building may sit on a road / roundabout / slip: drop any footprint that touches the 1 m road mask
  { const W=MW*M_T, onR=(x,y)=>{ x=Math.floor(x); y=Math.floor(y); if(x<0||y<0||x>=W||y>=MH*M_T) return false; const i=y*W+x; return (RM[i>>3]>>(i&7)&1)===1; }; let dropped=0, shrunk=0;
    const hits=F=>{ for(let u=0.04;u<=0.961;u+=0.0919) for(let v=0.04;v<=0.961;v+=0.0919){ const x=F[0][0]+(F[1][0]-F[0][0])*u+(F[3][0]-F[0][0])*v, y=F[0][1]+(F[1][1]-F[0][1])*u+(F[3][1]-F[0][1])*v; if(onR(x,y)) return true; } return false; };
    for(let k=objs.length-1;k>=0;k--){ const o=objs[k]; if(o.kind==='bldg'&&!o.logo&&!o.fp) o.fp=[[o.x,o.y],[o.x+o.w,o.y],[o.x+o.w,o.y+o.h],[o.x,o.y+o.h]]; if(o.kind!=='v2b'&&!(o.kind==='bldg'&&!o.logo)) continue;
      const toM=fp=>fp.map(p=>[p[0]/TILE*M_T,p[1]/TILE*M_T]); if(!hits(toM(o.fp))) continue; const old=o.fp; let nf=null;
      const c=[(old[0][0]+old[2][0])/2,(old[0][1]+old[2][1])/2];
      // try shrinking toward the centre, then sliding the shrunk footprint toward each side away from the road
      outer: for(const sc of [0.85,0.7,0.55]) for(const sh of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){ const ex=[(old[1][0]-old[0][0])*(1-sc)/2*sh[0]+(old[3][0]-old[0][0])*(1-sc)/2*sh[1],(old[1][1]-old[0][1])*(1-sc)/2*sh[0]+(old[3][1]-old[0][1])*(1-sc)/2*sh[1]];
        const f=old.map(p=>[c[0]+(p[0]-c[0])*sc+ex[0],c[1]+(p[1]-c[1])*sc+ex[1]]); const d=Math.min(Math.hypot(f[1][0]-f[0][0],f[1][1]-f[0][1]),Math.hypot(f[3][0]-f[0][0],f[3][1]-f[0][1])); if(d<2.2*TILE) break outer; if(!hits(toM(f))){ nf=f; break outer; } }
      const oldT=old.map(p=>[p[0]/TILE,p[1]/TILE]), xs=oldT.map(p=>p[0]), ys=oldT.map(p=>p[1]), nT=nf&&nf.map(p=>[p[0]/TILE,p[1]/TILE]);
      for(let ty=Math.floor(Math.min(...ys));ty<=Math.max(...ys);ty++) for(let tx=Math.floor(Math.min(...xs));tx<=Math.max(...xs);tx++) if(inb(tx,ty)&&G[idx(tx,ty)]===T.BLDG&&inPoly(oldT,tx+0.5,ty+0.5)&&!(nT&&inPoly(nT,tx+0.5,ty+0.5))){ const i=idx(tx,ty); G[i]=world.under[i]||T.CONC; }
      if(!nf){ objs.splice(k,1); dropped++; continue; }
      shrunk++; if(o.kind==='bldg'&&!o.wasV2){ o.kind='v2b'; o.col=o.col||'#a7a49c'; o.height=o.height||20; o.seed=o.seed||k; o.ind=true; } o.fp=nf; const fx=nf.map(p=>p[0]), fy=nf.map(p=>p[1]); o.x=Math.min(...fx); o.y=Math.min(...fy); o.w=Math.max(...fx)-o.x; o.h=Math.max(...fy)-o.y; }
    world.v2shrunk=shrunk;
    world.v2dropped=dropped; }
  world.labels=[...L.labels.map(l=>[l[0],l[1],l[2],l[3]==='region'?1:(l[3]==='water'||l[3]==='waters')?2:undefined]), ...CITIES.map(c2=>[c2.name,c2.c[0],c2.c[1]])];
  world.v2stats={edges:edges.length,buildings:nb,blocks:g.BLK.length,junctionsInterchange:g.JN.length,rbs:world.rbs.length,ms:Math.round(performance.now()-t0)};
  return g; }
window.v2Apply=v2Apply; window.V2DATA={L,CITIES};
