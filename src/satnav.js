'use strict';
// ===================== SAT NAV: A* over the road tiles, route guidance =====================
const NAV={route:null,reroutes:0,offT:0,lastCalc:-9,hover:null};
const NAV_COST={hwy:0.55,dual:0.7,rural:0.9,city:1.0,town:1.0,res:1.7,lane:3.2,dirt:2.6};      // lorry-legal: narrow lanes / estates heavily penalised
const NAV_SPEED={hwy:25,dual:20,rural:15,city:11,town:11,res:8,lane:7,dirt:7};
let navUp=null, navClosed=null, navG=null, navStamp=null, navFrom=null, navGen=1;
function navTileInfo(i){ const h=world.roadH[i], v=world.roadV[i]; if(h===-1&&v===-1) return null;
  if(h===-2) return ['rb',0.8,8]; if(h===-3) return ['curve',0.7,20]; const s=world.segs[h>=0?h:v]; return [s.type,NAV_COST[s.type]||1,NAV_SPEED[s.type]||11]; }
const isRoadT=i=>{ const t=G[i]; return (t===T.ROAD||t===T.BRIDGE) && !(world.roadH[i]===-1&&world.roadV[i]===-1); };
function navSnap(tx,ty,rmax){ tx=Math.round(tx); ty=Math.round(ty); for(let r=0;r<=(rmax||60);r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue; const x=tx+dx,y=ty+dy; if(inb(x,y)&&isRoadT(idx(x,y))) return [x,y]; } return null; }
// v14: snap the route start to the road the truck is actually on (never a nearby motorway / overpass it isn't using)
function navSnapTruck(){ const t=truck, f=fwd(t.h); for(const d of [0,2,-2,4]){ const x=Math.floor((t.x+f[0]*d)/M_T), y=Math.floor((t.y+f[1]*d)/M_T); if(inb(x,y)&&isRoadT(idx(x,y))) return [x,y]; }
  // v15: breadth-first over drivable ground (no water/buildings/containers) to the nearest road tile the truck can actually reach
  const sx=Math.floor(t.x/M_T), sy=Math.floor(t.y/M_T); if(!inb(sx,sy)) return null; const seen=new Map(), q=[[sx,sy,0]]; seen.set(sx*65536+sy,1); let best=null,bs=1e9;
  for(let h=0;h<q.length&&h<20000;h++){ const [x,y,d]=q[h]; if(best&&d>bs+3) break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy, k=nx*65536+ny; if(!inb(nx,ny)||seen.has(k)) continue; seen.set(k,1); const i=idx(nx,ny);
      if(isRoadT(i)){ const ti=navTileInfo(i), hw=ti&&(ti[0]==='hwy'||ti[0]==='ramp'), fw=(dx*f[0]+dy*f[1]); const sc=d+1+(hw?30:0)+(G[i]===T.BRIDGE?8:0)-fw*0.5; if(sc<bs){ bs=sc; best=[nx,ny]; } continue; }
      if(SOLID[G[i]]||d>40) continue; q.push([nx,ny,d+1]); } }
  return best; }
function navAStar(sx,sy,gx,gy){
  const N=MW*MH; if(!navG){ navG=new Float32Array(N); navStamp=new Int32Array(N); navFrom=new Int32Array(N); navClosed=new Int32Array(N); } if(!navUp) navUp=new Uint8Array(N); const FF=world.foF;
  const gen=++navGen, S=idx(sx,sy), Gl=idx(gx,gy); const hx=i=>(Math.abs((i%MW)-gx)+Math.abs(((i/MW)|0)-gy))*0.9;
  let hp=[], hf=[]; const push=(i,f)=>{ hp.push(i); hf.push(f); let k=hp.length-1; while(k>0){ const p=(k-1)>>1; if(hf[p]<=hf[k]) break; {const a=hp[p];hp[p]=hp[k];hp[k]=a;const b=hf[p];hf[p]=hf[k];hf[k]=b;} k=p; } };
  const pop=()=>{ const top=hp[0], li=hp.pop(), lf=hf.pop(); if(hp.length){ hp[0]=li; hf[0]=lf; let k=0; for(;;){ const l=2*k+1, r=l+1; let m=k; if(l<hp.length&&hf[l]<hf[m]) m=l; if(r<hp.length&&hf[r]<hf[m]) m=r; if(m===k) break; {const a=hp[m];hp[m]=hp[k];hp[k]=a;const b=hf[m];hf[m]=hf[k];hf[k]=b;} k=m; } } return top; };
  navStamp[S]=gen; navG[S]=0; navFrom[S]=-1; navUp[S]=0; push(S,hx(S)); let it=0;
  while(hp.length){ const i=pop(); if(navClosed[i]===gen) continue; navClosed[i]=gen; if(i===Gl) break; if(++it>4000000){ NAV.lastIt=it; return null; } const gi=navG[i], ci=navTileInfo(i)[1];
    for(const d of [1,-1,MW,-MW]){ let j=i+d, k=1; if(j<0||j>=N) continue;
      // small gaps (roundabout aprons, junction mouths drawn as kerb/grass): hop up to 5 tiles straight across
      if(!isRoadT(j)){ if(world.roadH[i]===-1&&world.roadV[i]===-1) continue; for(k=2;k<=6;k++){ j=i+d*k; if(j<0||j>=N||Math.abs((j%MW)-(i%MW))>6) { j=-1; break; } if(isRoadT(j)) break; } if(j<0||k>6||!isRoadT(j)) continue; const Gj=G[i+d]; if(Gj===T.WATER||Gj===T.BLDG) continue; }
      let up=0; if(FF&&(FF[i]||FF[j])){ const r=foNavStep(i,j,d,k,FF); if(r<0) continue; up=r; }
      const nc=gi+(ci+navTileInfo(j)[1])*0.5*k+(k>1?k*0.6:0);
      if(navClosed[j]!==gen&&(navStamp[j]!==gen||nc<navG[j])){ navStamp[j]=gen; navG[j]=nc; navFrom[j]=i; navUp[j]=up; push(j,nc+hx(j)); } } }
  NAV.lastIt=it; if(navStamp[Gl]!==gen) return null; const rp=[]; for(let i=Gl;i!==-1;i=navFrom[i]) rp.push(i); rp.reverse(); const path=[rp[0]]; for(let k=1;k<rp.length;k++){ const a=rp[k-1], b=rp[k], d=b-a, st=Math.abs(d)<MW?Math.sign(d):Math.sign(d)*MW; if(Math.abs(d)!==1&&Math.abs(d)!==MW) for(let j=a+st;j!==b;j+=st) path.push(j); path.push(b); } return path; }
function navBuild(path,target){
  const P=path.map(i=>[((i%MW)+0.5)*M_T,(((i/MW)|0)+0.5)*M_T]), n=P.length, cum=new Float32Array(n), eta=new Float32Array(n);
  for(let k=1;k<n;k++){ cum[k]=cum[k-1]+Math.hypot(P[k][0]-P[k-1][0],P[k][1]-P[k-1][1]); }
  for(let k=n-2;k>=0;k--) eta[k]=eta[k+1]+(cum[k+1]-cum[k])/((navTileInfo(path[k])||[0,0,11])[2]);
  // turn instructions: heading change over a +/-4 tile window, local maxima only
  const turns=[]; const W=4; let lastK=-99;
  const hd=(a,b)=>Math.atan2(P[b][0]-P[a][0],-(P[b][1]-P[a][1]));
  for(let k=W;k<n-W;k++){ const d=wrapA(hd(k,k+W)-hd(k-W,k)); if(Math.abs(d)<0.7) continue;
    let mx=true; for(let q=k-3;q<=k+3;q++) if(q!==k&&q>=W&&q<n-W&&Math.abs(wrapA(hd(q,q+W)-hd(q-W,q)))>Math.abs(d)) mx=false; if(!mx||k-lastK<8) continue;
    let rb=false; for(let q=k-6;q<=k+6;q++) if(q>=0&&q<n&&world.roadH[path[q]]===-2) rb=true;
    if(rb&&turns.length&&turns[turns.length-1].kind==='rb'&&k-turns[turns.length-1].k<40) continue;
    turns.push({k,kind:rb?'rb':Math.abs(d)>2.4?'u':d>0?'R':'L',ang:d}); lastK=k; }
  turns.push({k:n-1,kind:'arrive'});
  return {target,path,P,cum,eta,turns,idx:0,len:cum[n-1]};
}
function setRoute(target){
  let tx,ty,name;
  if(typeof target==='string'){ const d=world.depots.find(o=>o.id===target||o.code===target), f=world.fuel.find(o=>o.id===target), g=world.garages.find(o=>o.id===target); target=d||f||g; if(!target) return null; }
  if(target.entrance){ tx=target.entrance.x/M_T; ty=target.entrance.y/M_T; name=target.name; } else { tx=target.x/M_T; ty=target.y/M_T; name=target.name||target.label||'Map point'; }
  const tgt={x:tx*M_T,y:ty*M_T,name,ref:target};
  const st=navSnapTruck(), en=navSnap(tx,ty,70);
  if(!st||!en){ NAV.fail=!st?'snapStart':'snapEnd'; flash('Sat nav: no road route found'); return null; }
  const t0=performance.now(); const p=navAStar(st[0],st[1],en[0],en[1]); if(!p){ NAV.fail='astar'; flash('Sat nav: no road route found'); return null; }
  NAV.route=navBuild(p,tgt); NAV.route.ms=performance.now()-t0; NAV.offT=0; NAV.lastCalc=timeS;
  BigRig.emit('route',{target:tgt,length:NAV.route.len,ms:NAV.route.ms}); return NAV.route; }
function clearRoute(){ NAV.route=null; }
function chime(){ const c=audio.ctx; if(!c) return; const t=c.currentTime; [[880,0],[1175,0.16],[1568,0.32]].forEach(([f,dt])=>{ const o=c.createOscillator(), g=c.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t+dt); g.gain.exponentialRampToValueAtTime(0.25,t+dt+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dt+0.5); o.connect(g); g.connect(audio.master); o.start(t+dt); o.stop(t+dt+0.55); }); }
function updateNav(dt){ const R=NAV.route; if(!R) return; const f=fwd(truck.h), cx=truck.x+f[0]*2, cy=truck.y+f[1]*2;
  let best=R.idx, bd=1e9; const a=Math.max(0,R.idx-20), b=Math.min(R.P.length-1,R.idx+120); for(let k=a;k<=b;k++){ const d=Math.hypot(R.P[k][0]-cx,R.P[k][1]-cy); if(d<bd){ bd=d; best=k; } }
  if(bd>40){ for(let k=0;k<R.P.length;k+=3){ const d=Math.hypot(R.P[k][0]-cx,R.P[k][1]-cy); if(d<bd){ bd=d; best=k; } } }
  R.idx=Math.max(R.idx,best); R.off=bd;
  if(Math.hypot(R.target.x-cx,R.target.y-cy)<30 || (R.len-R.cum[R.idx]<25&&bd<25)){ chime(); flash('You have arrived: '+R.target.name); BigRig.emit('routeArrived',{target:R.target}); NAV.route=null; return; }
  if(bd>18){ NAV.offT+=dt; if(NAV.offT>1.0&&timeS-NAV.lastCalc>1.5){ NAV.reroutes++; const tg=R.target; const nr=setRoute(tg.ref&&tg.ref.name?tg.ref:{x:tg.x,y:tg.y,name:tg.name}); if(nr){ flash('Rerouting\u2026'); BigRig.emit('reroute',{n:NAV.reroutes}); } } } else NAV.offT=0; }
// UK keep-left: route drawn on the left-hand carriageway, lane picked for the next turn; one-way/slip roads stay centred on the lane
function navRaw(R,k){ const n=R.P.length, a=R.P[Math.max(0,k-2)], b=R.P[Math.min(n-1,k+2)], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, tx=(b[0]-a[0])/l, ty=(b[1]-a[1])/l, lx=ty, ly=-tx, p=R.P[k];
  if(R.oneway&&R.oneway[k]) return 0; let dl=0, dr=0; while(dl<16&&onRoadM(p[0]+lx*(dl+0.5),p[1]+ly*(dl+0.5))) dl+=0.5; while(dr<16&&onRoadM(p[0]-lx*(dr+0.5),p[1]-ly*(dr+0.5))) dr+=0.5;
  const W=dl+dr; if(W<4.5) return (dl-dr)/2; const wl=W/2, nL=Math.max(1,Math.round(wl/3.5)); let lane=0; const nt=R.turns.find(t=>t.k>=k&&t.k-k<45/ ((R.cum[1]-R.cum[0])||2)); if(nt&&nt.kind==='R') lane=nL-1; return dl-(lane+0.5)*wl/nL; }
function navOff(R,k){ if(!R.offC){ R.offC=new Float32Array(R.P.length).fill(NaN); } if(isNaN(R.offC[k])){ let s=0,c=0; for(let q=k-4;q<=k+4;q++){ if(q<0||q>=R.P.length) continue; if(!R.raw) R.raw=new Float32Array(R.P.length).fill(NaN); if(isNaN(R.raw[q])) R.raw[q]=navRaw(R,q); s+=R.raw[q]; c++; } R.offC[k]=s/c; }
  const n=R.P.length, a=R.P[Math.max(0,k-2)], b=R.P[Math.min(n-1,k+2)], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, o=R.offC[k]||0; return [R.P[k][0]+(b[1]-a[1])/l*o, R.P[k][1]-(b[0]-a[0])/l*o]; }
function navLine(px,py,w,col){ const R=NAV.route; if(!R) return; ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=w+3; ctx.beginPath();
  { const S=R.P[Math.min(R.idx,R.P.length-1)]; if(Math.hypot(S[0]-truck.x,S[1]-truck.y)<=15) ctx.moveTo(px(truck.x),py(truck.y)); else ctx.moveTo(px(S[0]),py(S[1])); } let lq=null; for(let k=R.idx;k<R.P.length;k+=2){ const Q=(k-R.idx<400)?navOff(R,k):R.P[k]; if(!isFinite(Q[0])||!isFinite(Q[1])) continue; if(lq&&Math.hypot(Q[0]-lq[0],Q[1]-lq[1])>20) ctx.moveTo(px(Q[0]),py(Q[1])); else ctx.lineTo(px(Q[0]),py(Q[1])); lq=Q; } const e=R.P[R.P.length-1]; ctx.lineTo(px(e[0]),py(e[1])); ctx.stroke(); ctx.strokeStyle=col; ctx.lineWidth=w; ctx.stroke();
  ctx.fillStyle='#ff3df0'; ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px(R.target.x),py(R.target.y),6,0,7); ctx.fill(); ctx.stroke(); ctx.restore(); }
function drawNavWorld(){ const R=NAV.route; if(!R) return; const end=Math.min(R.P.length-5,R.idx+100);
  for(let k=R.idx+3;k<end;k+=5){ const p=navOff(R,k), q=navOff(R,k+3); const h=Math.atan2(q[0]-p[0],-(q[1]-p[1])); const a=0.55*Math.min(1,(k-R.idx)/10);
    ctx.save(); ctx.translate(p[0]*PPM,p[1]*PPM); ctx.rotate(h); ctx.fillStyle='rgba(90,220,255,'+a.toFixed(2)+')'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(13,4); ctx.lineTo(6,4); ctx.lineTo(0,-4); ctx.lineTo(-6,4); ctx.lineTo(-13,4); ctx.closePath(); ctx.fill(); ctx.restore(); } }
const NAVP={x:960-252,y:56,w:236,h:96};
function fmtD(m){ return m>=1000?(m/1000).toFixed(m>=10000?0:1)+' km':(Math.round(m/10)*10)+' m'; }
function drawTurnIcon(kind,ang,x,y){ ctx.save(); ctx.translate(x,y); ctx.strokeStyle='#fff'; ctx.fillStyle='#fff'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.lineJoin='round';
  if(kind==='arrive'){ ctx.beginPath(); ctx.arc(0,-6,10,0,7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6,6); ctx.lineTo(0,18); ctx.lineTo(6,6); ctx.fill(); }
  else if(kind==='rb'){ ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,4,10,0,7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,22); ctx.lineTo(0,14); ctx.stroke(); const a=Math.PI/2+(ang||0)-Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a)*10,4+Math.sin(a)*10); ctx.lineTo(Math.cos(a)*20,4+Math.sin(a)*20); ctx.stroke(); }
  else { const s=kind==='L'?-1:1; ctx.beginPath(); ctx.moveTo(-s*4,20); ctx.lineTo(-s*4,0); if(kind==='u'){ ctx.arc(s*4,0,8,Math.PI,0,s>0); ctx.lineTo(s*12,12); } else { ctx.quadraticCurveTo(-s*4,-8,s*12,-8); } ctx.stroke();
    ctx.beginPath(); if(kind==='u'){ ctx.moveTo(s*12,20); ctx.lineTo(s*5,10); ctx.lineTo(s*19,10); } else { ctx.moveTo(s*18,-8); ctx.lineTo(s*9,-16); ctx.lineTo(s*9,0); } ctx.closePath(); ctx.fill(); }
  ctx.restore(); }
function drawNavHUD(){ const R=NAV.route; if(!R) return; const {x,y,w,h}=NAVP; const nt=R.turns.find(t=>t.k>R.idx+1)||R.turns[R.turns.length-1];
  const dTurn=Math.max(0,R.cum[nt.k]-R.cum[R.idx]), dTot=Math.max(0,R.len-R.cum[R.idx]), eta=R.eta[R.idx];
  ctx.save(); ctx.fillStyle='rgba(10,14,22,0.85)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x,y,w,h,12):ctx.rect(x,y,w,h); ctx.fill();
  ctx.fillStyle='#1e88e5'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(x+8,y+8,64,64,10):ctx.rect(x+8,y+8,64,64); ctx.fill(); drawTurnIcon(nt.kind,nt.ang,x+40,y+38);
  ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='bold 26px system-ui,sans-serif'; ctx.fillText(fmtD(dTurn),x+82,y+36);
  ctx.font='12px system-ui,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillText({L:'Turn left',R:'Turn right',u:'U-turn',rb:'At the roundabout',arrive:'Arrive'}[nt.kind],x+82,y+56);
  ctx.fillStyle='#7fdcff'; ctx.font='bold 12px system-ui,sans-serif'; const m=Math.max(1,Math.round(eta/60)); ctx.fillText(fmtD(dTot)+' \u2022 ETA '+m+' min',x+10,y+88);
  ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font='11px system-ui,sans-serif'; const nm=R.target.name.length>20?R.target.name.slice(0,19)+'\u2026':R.target.name; ctx.textAlign='right'; ctx.fillText('\u2192 '+nm,x+w-10,y+88);
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+w-30,y+8,22,22); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 13px system-ui'; ctx.fillText('\u2715',x+w-19,y+23);
  if(R.off>22){ ctx.fillStyle='#ffb020'; ctx.textAlign='left'; ctx.fillText('Off route',x+82,y+14); }
  ctx.restore(); }
function navPanelClick(x,y){ if(NAV.route&&x>=NAVP.x+NAVP.w-30&&x<=NAVP.x+NAVP.w-8&&y>=NAVP.y+8&&y<=NAVP.y+30){ clearRoute(); flash('Route cancelled'); return true; } return false; }
// big-map icon hit test
// icon radius on the big map grows with zoom (canvas px), clamped
function mapIconR(z){ return Math.max(7,Math.min(18,5+2.2*z)); }
// hit radius: icon + margin, and at least ~44 CSS px across on touch screens
function mapHitR(){ const r=mapIconR(bigmap.z)+5; if(!document.body.classList.contains('touch')) return Math.max(11,r); const cw=cv.getBoundingClientRect().width||VW; return Math.max(r,22*VW/cw); }
let RAIL_POI=null; function railPOIs(){ if(typeof RAIL==='undefined'||!RAIL.ready) return []; if(!RAIL_POI||RAIL_POI.length!==RAIL.stations.length) RAIL_POI=RAIL.stations.map(st=>({name:st.name+(st.kind==='hub'?'':' station'),st,x:RAIL.X[st.s],y:RAIL.Y[st.s],entrance:{x:RAIL.X[st.s],y:RAIL.Y[st.s]}})); return RAIL_POI; }
function navPOIAt(x,y,BX,BY){ let best=null,bd=mapHitR(); const test=(o,mx,my,kind)=>{ const d=Math.hypot(BX(mx/M_T)-x,BY(my/M_T)-y); if(d<bd){ bd=d; best={o,kind,name:o.name}; } }; for(const s of railPOIs()) test(s,s.x,s.y,'Station');
  for(const d of world.depots) test(d,d.entrance.x,d.entrance.y,/Port/.test(d.name)?'Port':'Depot'); for(const f of world.fuel) test(f,f.x,f.y,'Fuel'); for(const g of world.garages) test(g,g.x,g.y,'Garage'); for(const m of world.malls||[]) test(m,m.entrance.x,m.entrance.y,m.kind==='mall'?'Mall':'Supermarket'); for(const d of world.dealers||[]) test(d,d.entrance.x,d.entrance.y,'Truck dealer'); return best; }
BigRig.setRoute=setRoute; BigRig.clearRoute=clearRoute; BigRig.route=()=>NAV.route&&{target:NAV.route.target,length:NAV.route.len,remaining:NAV.route.len-NAV.route.cum[NAV.route.idx],turns:NAV.route.turns.length,reroutes:NAV.reroutes};
BigRig._navDiag=function(target){ const N=MW*MH; const r=setRoute(target); if(r) return 'ok'; const gen=navGen; const A=i=>navStamp[i]===gen;
  const e=target.entrance||target, E=navSnap(e.x/M_T,e.y/M_T,70); const seen=new Uint8Array(N), s0=idx(E[0],E[1]); const q=[s0]; seen[s0]=1; let n=0;
  while(q.length){ const i=q.pop(); n++; for(const d of [1,-1,MW,-MW]){ const j=i+d; if(j>=0&&j<N&&!seen[j]&&isRoadT(j)){ seen[j]=1; q.push(j); } } }
  let best=[99]; for(let i=0;i<N;i++) if(seen[i]&&i%2===0){ const x=i%MW,y=(i/MW)|0; for(let dy=-25;dy<=25;dy++)for(let dx=-25;dx<=25;dx++){ const j=i+dx+dy*MW; if(j>=0&&j<N&&A(j)){ const dd=Math.hypot(dx,dy); if(dd<best[0]) best=[dd,x,y,x+dx,y+dy]; } } }
  if(best.length>1){ const L=[]; const m=Math.ceil(best[0]); for(let k=0;k<=m;k++){ const x=Math.round(best[1]+(best[3]-best[1])*k/m), y=Math.round(best[2]+(best[4]-best[2])*k/m); L.push(G[idx(x,y)]+'/'+world.roadH[idx(x,y)]+'/'+world.roadV[idx(x,y)]); } best.push(L); }
  return {endN:n,gap:best}; };
// ===================== FAST TRAVEL (free): big-map depot tooltip -> spawn in that depot's yard facing the exit =====================
function ftClear(x,y,h,trl){ const f=fwd(h), r=rgt(h), s0=trl?-12.3:-1.4; for(let s=s0;s<=5.2;s+=0.8) for(const w of [-1.4,0,1.4]){ const px=x+f[0]*s+r[0]*w, py=y+f[1]*s+r[1]*w; if(solidAtM(px,py)) return false;
    for(const t of world.trailers){ if(t===trl) continue; const tf=fwd(t.th); for(let q=-1.2;q<=12.4;q+=1.5){ if(Math.hypot(t.x-tf[0]*q-px,t.y-tf[1]*q-py)<2.2) return false; } } } return true; }
function ftSpot(dp){ const trl=truck.trl, ex=dp.entrance.x, ey=dp.entrance.y, cands=[];
  for(let j=dp.y+1;j<dp.y+dp.h-5;j+=0.5) for(let i=dp.x+1;i<dp.x+dp.w-1;i+=0.5){ const x=i*M_T, y=j*M_T, h=Math.atan2(ex-x,-(ey-y)), hs=Math.round(h/(Math.PI/2))*(Math.PI/2); cands.push([Math.hypot(ex-x,ey-y)-3*Math.abs(i-(dp.x+dp.w/2))*M_T,x,y,hs]); }
  cands.sort((a,b)=>b[0]-a[0]); // furthest from the gate first, so the whole rig sits inside the yard
  for(const [,x,y,h] of cands){ if(ftClear(x,y,h,trl)){ const f=fwd(h); if(trl){ const rx=x-f[0]*12.3, ry=y-f[1]*12.3; if(rx<dp.x*M_T||rx>(dp.x+dp.w)*M_T||ry<dp.y*M_T||ry>(dp.y+dp.h-5)*M_T) continue; } return {x,y,h}; } }
  // no room in the yard: line the trailer up in a free bay, cab facing out
  for(const b of dp.bays){ if(b.trailer) continue; const h=b.th||0, f=fwd(h); return {x:b.kx-f[0]*0.3,y:b.ky-f[1]*0.3,h,bay:true}; } return null; }
// generic: nearest clear straight road tile to a place, parked along the road
function ftRoadSpot(mx,my){ const trl=truck.trl, tx=Math.floor(mx/M_T), ty=Math.floor(my/M_T), C=[];
  const R=(x,y)=>inb(x,y)&&isRoadT(idx(x,y)); for(let dy=-130;dy<=130;dy++) for(let dx=-130;dx<=130;dx++){ const x=tx+dx,y=ty+dy; if(!R(x,y)) continue; const i=idx(x,y); let H=world.roadH[i]>=0, V=world.roadV[i]>=0; if(H===V){ H=R(x-1,y)&&R(x+1,y)&&R(x-2,y)&&R(x+2,y); V=R(x,y-1)&&R(x,y+1)&&R(x,y-2)&&R(x,y+2); if(H===V) continue; } C.push([dx*dx+dy*dy,x,y,H]); }
  C.sort((a,b)=>a[0]-b[0]);
  for(const [,x,y,H] of C){ const cx=(x+0.5)*M_T, cy=(y+0.5)*M_T; for(const h of H?[Math.PI/2,-Math.PI/2]:[0,Math.PI]){ if(ftClear(cx,cy,h,trl)) return {x:cx,y:cy,h}; } } return null; }
function ftFee(o){ const e=o.entrance||o, km=Math.hypot(e.x-truck.x,e.y-truck.y)/1000; return Math.round(25+8*km); }
// rules: stopped, not broken down, not carrying a job's cargo (deliver/unloading/recouple), can afford the fee
function ftBlock(o){ const s=truck; if(Math.abs(s.v)>0.3) return 'Fast travel: stop the truck first'; if(typeof BREAKDOWN!=='undefined'&&BREAKDOWN.active) return 'Fast travel unavailable while broken down';
  const a=typeof career!=='undefined'&&career.active; if(a&&(a.phase==='deliver'||a.phase==='unloading'||a.phase==='recouple')) return 'No fast travel while delivering a load \u2014 drive it there or cancel the job';
  const f=ftFee(o); if(s.money<f) return 'Fast travel costs \u00a3'+f+' \u2014 not enough money'; return null; }
function fastTravel(dp){ const s=truck; const why=ftBlock(dp); if(why){ flash(why); return false; }
  const e=dp.entrance||dp, p=(dp.bays&&dp.x!==undefined)?ftSpot(dp):ftRoadSpot(e.x,e.y); if(!p){ flash('Fast travel: no clear spot at '+dp.name); return false; }
  const fee=ftFee(dp);
  const fr=document.getElementById('frame')||document.body; let ov=document.getElementById('ftfade'); if(!ov){ ov=document.createElement('div'); ov.id='ftfade'; ov.style.cssText='position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .28s;z-index:50'; fr.appendChild(ov); }
  ov.style.opacity='1'; if(typeof closeMap==='function') closeMap();
  setTimeout(()=>{ s.x=p.x; s.y=p.y; s.h=p.h; cam.x=p.x*PPM; cam.y=p.y*PPM; s.th=p.h; s.v=0; s.steer=0; if(s.vx!==undefined){ s.vx=0; s.vy=0; } if(s.av!==undefined) s.av=0; s.money-=fee;
    if(NAV.route&&NAV.route.target){ const t=NAV.route.target; setRoute(t.ref||{x:t.x,y:t.y,name:t.name}); }
    flash('Fast travelled to '+dp.name+' (\u00a3'+fee+')'+(p.bay?' \u2014 parked at a bay':'')); BigRig.emit('fastTravel',{depot:dp.id,name:dp.name,x:p.x,y:p.y,fee}); setTimeout(()=>ov.style.opacity='0',60); },300); return true; }
BigRig.fastTravel=fastTravel;
// tooltip button hit-boxes (set when drawn)
let FT_BTN=null, NAV_BTN=null;

// v20 flyovers: tiles of the lower road under a deck (FF) carry two roads that don't connect. Returns -1 (move not allowed), 0 (lower) or 1 (on the deck).
function foNavStep(i,j,d,k,FF){ if(k>1) return -1; const along=t=>{ const h=world.roadH[t], v=world.roadV[t]; return (h>=0&&Math.abs(d)===1)||(v>=0&&Math.abs(d)===MW); };
  const cv=t=>world.roadH[t]===-3;
  if(!FF[i]){ if(cv(i)) return 1; return along(j)?0:-1; }                  // entering: from the curve onto the deck, or straight along the lower road
  if(navUp[i]){ return FF[j]?1:(cv(j)?0:-1); }                             // on the deck: stay on it until it lands back on the curve
  if(cv(j)) return -1; return along(j)&&along(i)?0:-1; }                  // under it: straight along the lower road only
