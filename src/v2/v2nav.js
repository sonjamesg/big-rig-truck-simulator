// ===================== v2 sat nav: Dijkstra over the planar road graph, smooth route polyline =====================
function v2Comp(){ const g=world.v2; if(g.mainComp!==undefined) return; const comp=new Int32Array(g.N.length).fill(-1), sizes=[]; let c=0; for(let s=0;s<g.N.length;s++){ if(comp[s]>=0) continue; const st=[s]; let n=0; comp[s]=c; while(st.length){ const x=st.pop(); n++; for(const e of g.N[x].edges){ const p=g.P[e]; for(const m of [p.a,p.b]) if(comp[m]<0){ comp[m]=c; st.push(m); } } } sizes.push(n); c++; }
  g.comp=comp; g.mainComp=sizes.indexOf(Math.max(...sizes)); }
function v2NearestPiece(x,y,noHwy){ v2Comp(); const P=world.v2.P, g=world.v2; let best=null; for(const p of P){ if(p.dead||g.comp[p.a]!==g.mainComp) continue; if(noHwy&&(p.type==='hwy'||p.type==='ramp')) continue; const S=p.pts; for(let i=0;i<S.length;i++){ const d=(S[i][0]-x)**2+(S[i][1]-y)**2; if(!best||d<best.d) best={d,p,i}; } } return best; }
function v2Route(sx,sy,gx,gy,hd){ const g=world.v2, P=g.P, N=g.N; const A=v2NearestPiece(sx,sy), B=v2NearestPiece(gx,gy,true)||v2NearestPiece(gx,gy); if(!A||!B) return null;
  const len=p=>{ if(p._len) return p._len; let L=0; for(let i=1;i<p.pts.length;i++) L+=Math.hypot(p.pts[i][0]-p.pts[i-1][0],p.pts[i][1]-p.pts[i-1][1]); return p._len=L; };
  const cost=p=>len(p)*((NAV_COST[p.type]||1))*(p.type==='ramp'?0.7:1);
  const part=(p,i0,i1)=>{ let L=0; for(let i=Math.min(i0,i1);i<Math.max(i0,i1);i++) L+=Math.hypot(p.pts[i+1][0]-p.pts[i][0],p.pts[i+1][1]-p.pts[i][1]); return L*(NAV_COST[p.type]||1); };
  // prefer leaving the start piece in the direction the truck faces
  const S=A.p.pts, i=A.i, t2=[S[Math.min(S.length-1,i+1)][0]-S[Math.max(0,i-1)][0],S[Math.min(S.length-1,i+1)][1]-S[Math.max(0,i-1)][1]], fwdB=(hd?(t2[0]*Math.sin(hd)-t2[1]*Math.cos(hd)):1)>=0;
  const dist=new Float64Array(N.length).fill(1e18), from=new Int32Array(N.length).fill(-1), via=new Int32Array(N.length).fill(-1);
  const heap=[]; const push=(n,d)=>{ heap.push([d,n]); let k=heap.length-1; while(k>0){ const q=(k-1)>>1; if(heap[q][0]<=heap[k][0]) break; [heap[q],heap[k]]=[heap[k],heap[q]]; k=q; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let k=0; for(;;){ const l=2*k+1,r=l+1; let m=k; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===k) break; [heap[m],heap[k]]=[heap[k],heap[m]]; k=m; } } return top; };
  const sb=part(A.p,i,S.length-1)*(fwdB?1:3), sa=part(A.p,0,i)*(fwdB?3:1);
  dist[A.p.b]=sb; push(A.p.b,sb); if(sa<dist[A.p.a]){ dist[A.p.a]=sa; push(A.p.a,sa); }
  while(heap.length){ const [d,n]=pop(); if(d>dist[n]) continue; for(const ei of N[n].edges){ const p=P[ei]; if(p.dead) continue; const m=p.a===n?p.b:p.a, nd=d+cost(p); if(nd<dist[m]){ dist[m]=nd; from[m]=n; via[m]=ei; push(m,nd); } } }
  const ea=dist[B.p.a]+part(B.p,0,B.i), eb=dist[B.p.b]+part(B.p,B.i,B.p.pts.length-1); if(Math.min(ea,eb)>=1e17) return null;
  const endNode=ea<=eb?B.p.a:B.p.b; const chain=[]; for(let n=endNode;n!==A.p.a&&n!==A.p.b&&via[n]>=0;n=from[n]) chain.push([via[n],n]); chain.reverse();
  const startNode=chain.length?(P[chain[0][0]].a===chain[0][1]?P[chain[0][0]].b:P[chain[0][0]].a):endNode;
  const out=[]; const add=(pts)=>{ for(const q of pts){ const l=out[out.length-1]; if(!l||Math.hypot(l[0]-q[0],l[1]-q[1])>0.05) out.push(q); } };
  add(startNode===A.p.b?S.slice(i):S.slice(0,i+1).reverse());
  for(const [ei,n] of chain){ const p=P[ei]; add(p.b===n?p.pts:p.pts.slice().reverse()); }
  const BP=B.p.pts; add(endNode===B.p.a?BP.slice(0,B.i+1):BP.slice(B.i).reverse());
  return out; }
const _setRouteLegacy=setRoute;
setRoute=function(target){ if(!world.v2) return _setRouteLegacy(target);
  let tx,ty,name; if(typeof target==='string'){ const d=world.depots.find(o=>o.id===target||o.code===target), f=world.fuel.find(o=>o.id===target), g=world.garages.find(o=>o.id===target); target=d||f||g; if(!target) return null; }
  if(target.entrance){ tx=target.entrance.x/M_T; ty=target.entrance.y/M_T; name=target.name; } else { tx=target.x/M_T; ty=target.y/M_T; name=target.name||target.label||'Map point'; }
  const tgt={x:tx*M_T,y:ty*M_T,name,ref:target}, f=fwd(truck.h), t0=performance.now();
  const pts=v2Route((truck.x+f[0]*2)/M_T,(truck.y+f[1]*2)/M_T,tx,ty,truck.h); if(!pts||pts.length<2){ NAV.fail='graph'; flash('Sat nav: no road route found'); NAV.route=null; return null; }
  // resample every 2 m (metres)
  const Pm=[[pts[0][0]*M_T,pts[0][1]*M_T]]; for(let k=1;k<pts.length;k++){ const a=Pm[Pm.length-1], b=[pts[k][0]*M_T,pts[k][1]*M_T], d=Math.hypot(b[0]-a[0],b[1]-a[1]); if(d<2&&k<pts.length-1) continue; const n=Math.max(1,Math.floor(d/2)); for(let q=1;q<=n;q++) Pm.push([a[0]+(b[0]-a[0])*q/n,a[1]+(b[1]-a[1])*q/n]); }
  const n=Pm.length, cum=new Float32Array(n), eta=new Float32Array(n), path=Pm.map(p=>idx(Math.max(0,Math.min(MW-1,Math.floor(p[0]/M_T))),Math.max(0,Math.min(MH-1,Math.floor(p[1]/M_T)))));
  for(let k=1;k<n;k++) cum[k]=cum[k-1]+Math.hypot(Pm[k][0]-Pm[k-1][0],Pm[k][1]-Pm[k-1][1]); for(let k=n-2;k>=0;k--) eta[k]=eta[k+1]+(cum[k+1]-cum[k])/12;
  const turns=[]; const W=8; let lastK=-99; const hdg=(a,b)=>Math.atan2(Pm[b][0]-Pm[a][0],-(Pm[b][1]-Pm[a][1]));
  for(let k=W;k<n-W;k++){ const d=wrapA(hdg(k,k+W)-hdg(k-W,k)); if(Math.abs(d)<0.7) continue; let mx=true; for(let q=k-4;q<=k+4;q++) if(q!==k&&q>=W&&q<n-W&&Math.abs(wrapA(hdg(q,q+W)-hdg(q-W,q)))>Math.abs(d)) mx=false; if(!mx||k-lastK<12) continue;
    turns.push({k,kind:Math.abs(d)>2.4?'u':d>0?'R':'L',ang:d}); lastK=k; }
  turns.push({k:n-1,kind:'arrive'});
  NAV.route={target:tgt,path,P:Pm,cum,eta,turns,idx:0,len:cum[n-1],ms:performance.now()-t0,v2:true}; NAV.offT=0; NAV.lastCalc=timeS;
  BigRig.emit('route',{target:tgt,length:NAV.route.len,ms:NAV.route.ms}); return NAV.route; };
