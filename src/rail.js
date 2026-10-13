'use strict';
// ===================== RAILWAY (decorative, v28) =====================
// One double-track main line loops the whole map. Up line (w>0, travels +s) = passenger, stops at stations.
// Down line (w<0, travels -s) = freight, runs through. Every train position is a PURE function of game time:
// tS = gameT*DAY_LEN/24 in [0,1200) and every timetable has an integer 1200 s cycle, so save/load and multiplayer
// (host already sends gameT) reproduce identical trains with no extra state. Blocks/interlocking are checked by
// railSelfTest(); the timetable builder drops trains until the block test passes (so a conflicting train is never run).
const RAIL={ready:false,L:0,X:null,Y:null,NX:null,NY:null,stations:[],cross:[],trains:[],tracks:[],chunkRuns:new Map(),spr:{},cyc:1800,cycF:1200,test:null};
const RAIL_WP=[[180,456],[300,456],[430,456],[560,440],[640,330],[680,215],[800,190],[920,240],[990,360],[1100,400],[1250,430],[1360,560],[1480,630],[1610,680],[1720,730],[1725,840],[1705,960],
  [1600,1060],[1520,1095],[1430,1180],[1360,1300],[1200,1320],[1080,1305],[960,1300],[880,1300],[800,1300],[700,1340],[620,1380],[560,1450],[530,1580],[560,1720],[560,1850],[450,1890],[260,1880],
  [160,1720],[150,1420],[180,1250],[200,1130],[230,1010],[320,930],[470,930],[400,840],[300,730],[150,640],[140,530]];
const RAIL_ST=[['Albion Central',300,456,'city'],['Sound Coast',650,300,'coast'],['Dustwater',990,360,'desert'],['Sandvale Parkway',1470,628,'city'],['Coppermine',1715,735,'rural'],
  ['Fenwick Forest',1530,1092,'forest'],['Kingsbridge North',1340,1308,'city'],['Redhill Central',880,1300,'hub'],['Greyfell Pass',532,1600,'hills'],['Greyfell Sands',380,1888,'coast'],
  ['Ashby',196,1150,'rural'],['Wendwood',420,930,'rural'],['Millford',300,730,'town']];
const RW_P=2.1, RW_F=-2.1, HUB_W=9, HUB_HALF=150, HUB_RAMP=80;
function rlHash(n){ n=(n^61)^(n>>>16); n=n+(n<<3)|0; n^=n>>>4; n=Math.imul(n,0x27d4eb2d); n^=n>>>15; return (n>>>0)/4294967296; }
function rlMod(a,L){ return ((a%L)+L)%L; }
function rlSm(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); }
// ---------- geometry
function railBuild(objs){
  const W=RAIL_WP.map(p=>[p[0]*M_T,p[1]*M_T]), n=W.length, raw=[];
  for(let i=0;i<n;i++){ const p0=W[(i-1+n)%n],p1=W[i],p2=W[(i+1)%n],p3=W[(i+2)%n], seg=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]), k=Math.ceil(seg/2);
    for(let j=0;j<k;j++){ const t=j/k,t2=t*t,t3=t2*t; raw.push([0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
      0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]); } }
  // resample at exactly 1 m
  const cum=[0]; for(let i=1;i<=raw.length;i++){ const a=raw[i-1],b=raw[i%raw.length]; cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1])); }
  const L=Math.floor(cum[raw.length]); RAIL.L=L; const X=new Float32Array(L),Y=new Float32Array(L),NX=new Float32Array(L),NY=new Float32Array(L);
  let j=0; for(let s=0;s<L;s++){ const S=s*cum[raw.length]/L; while(cum[j+1]<S) j++; const a=raw[j],b=raw[(j+1)%raw.length],f=(S-cum[j])/((cum[j+1]-cum[j])||1); X[s]=a[0]+(b[0]-a[0])*f; Y[s]=a[1]+(b[1]-a[1])*f; }
  for(let s=0;s<L;s++){ const a=(s-2+L)%L,b=(s+2)%L, tx=X[b]-X[a], ty=Y[b]-Y[a], l=Math.hypot(tx,ty)||1; NX[s]=ty/l; NY[s]=-tx/l; }   // left normal of +s travel
  Object.assign(RAIL,{X,Y,NX,NY});
  // stations
  for(const [name,tx,ty,kind] of RAIL_ST){ let best=0,bd=1e18; for(let s=0;s<L;s++){ const d=(X[s]-tx*M_T)**2+(Y[s]-ty*M_T)**2; if(d<bd){ bd=d; best=s; } }
    const len=kind==='hub'?HUB_HALF*2:kind==='city'?200:kind==='town'?160:120; RAIL.stations.push({name,kind,s:best,len,dwell:kind==='hub'?40:kind==='city'?30:20+Math.round(rlHash(best)*8)}); }
  RAIL.stations.sort((a,b)=>a.s-b.s); RAIL.hub=RAIL.stations.find(s=>s.kind==='hub');
  // tracks (lateral offset functions)
  const H=RAIL.hub.s, hb=(s,half,ramp)=>{ const d=Math.abs(rlMod(s-H+L/2,L)-L/2); return d<half?1:d<half+ramp?rlSm(1-(d-half)/ramp):0; };
  RAIL.hubB=s=>hb(s,HUB_HALF,HUB_RAMP);
  RAIL.tracks=[{id:'up',w:()=>RW_P,s0:0,s1:L,main:1},{id:'down',w:()=>RW_F,s0:0,s1:L,main:1},
    {id:'loop',w:s=>RW_P+HUB_W*RAIL.hubB(s),s0:H-HUB_HALF-HUB_RAMP,s1:H+HUB_HALF+HUB_RAMP},
    {id:'sid1',w:s=>RW_F-4.6*hb(s,110,60),s0:H-170,s1:H+170},{id:'sid2',w:s=>RW_F-9.2*hb(s,90,70),s0:H-160,s1:H+160}];
  // sample tracks, classify ground under each sample
  const band=new Set();
  for(const tr of RAIL.tracks){ const P=[]; for(let s=Math.floor(tr.s0);s<=Math.ceil(tr.s1);s++){ const i=rlMod(s,L), w=tr.w(s), x=X[i]+NX[i]*w, y=Y[i]+NY[i]*w; const tx=Math.floor(x/M_T), ty=Math.floor(y/M_T);
      let g=get(tx,ty), k=0; if(g===T.WATER||g===T.BRIDGE&&!roadSegAt(tx,ty)) k=2; else if(g===T.ROAD||g===T.BRIDGE){ const sg=roadSegAt(tx,ty); k=sg&&sg.type==='hwy'?3:1; }
      P.push({s,x,y,nx:NX[i],ny:NY[i],k}); for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) band.add((ty+dy)*MW+tx+dx); }
    tr.P=P; }
  // stations' platforms keep their land clear too
  for(const st of RAIL.stations) for(let s=st.s-st.len/2-10;s<=st.s+st.len/2+10;s+=2){ const i=rlMod(Math.round(s),L); for(let w=0;w<=(st.kind==='hub'?20:10);w+=2){ const tx=Math.floor((X[i]+NX[i]*w)/M_T), ty=Math.floor((Y[i]+NY[i]*w)/M_T); band.add(ty*MW+tx); } }
  // clear buildings/trees from the band (never roads, water or functional sites)
  const KILL={bldg:1,tree:1,hedge:1,bush:1,rock:1,scrub:1,cactus:1,bale:1,fountain:1,pond:1,silo:1,tank:1,field:1};
  for(const o of objs){ if(!KILL[o.kind]||o._dead) continue; const x0=Math.floor(o.x/TILE),y0=Math.floor(o.y/TILE),x1=Math.floor((o.x+(o.w||0))/TILE),y1=Math.floor((o.y+(o.h||0))/TILE);
    let hit=false; for(let ty=y0;ty<=y1&&!hit;ty++) for(let tx=x0;tx<=x1;tx++) if(band.has(ty*MW+tx)){ hit=true; break; } if(hit) o._dead=1; }
  for(const k of band){ const t=G[k]; if(t===T.BLDG||t===T.TREE||t===T.HEDGE||t===T.PGRASS||t===T.PARK||t===T.TANK||t===T.PUMP||t===T.CONT) G[k]=T.GRAVEL; }
  // crossings (from the centreline + both main tracks)
  const up=RAIL.tracks[0].P, dn=RAIL.tracks[1].P; let run=null;
  for(let s=0;s<=L;s++){ const i=s%L, k=Math.max(up[i].k===1||up[i].k===3?up[i].k:0, dn[i].k===1||dn[i].k===3?dn[i].k:0);
    if(k&&s<L){ if(!run) run={sa:s,sb:s,over:k===3}; else { run.sb=s; if(k===3) run.over=true; } }
    else if(run){ if(run.sb-run.sa<60) RAIL.cross.push(run); run=null; } }
  for(const c of RAIL.cross){ const m=Math.round((c.sa+c.sb)/2)%L; c.m=m; c.mx=X[m]; c.my=Y[m]; c.tx=-NY[m]; c.ty=NX[m]; c.nx=NX[m]; c.ny=NY[m]; c.half=(c.sb-c.sa)/2+1.5; c.f=0; c.lit=0; c.za=c.sa-3; c.zb=c.sb+3;
    if(!c.over) for(let s=c.sa-1;s<=c.sb+1;s++) for(const tr of [up,dn]){ const p=tr[rlMod(s,L)]; if(p.k===1) p.k=4; } }  // 4 = level-crossing panel
  // per-chunk index of sample runs
  for(let ti=0;ti<RAIL.tracks.length;ti++){ const P=RAIL.tracks[ti].P; for(let i=0;i<P.length;i++){ const p=P[i], px=p.x*PPM, py=p.y*PPM, m=8*PPM;
      for(let cy=Math.floor((py-m)/CHUNK);cy<=Math.floor((py+m)/CHUNK);cy++) for(let cx=Math.floor((px-m)/CHUNK);cx<=Math.floor((px+m)/CHUNK);cx++){ const key=cx+','+cy; let a=RAIL.chunkRuns.get(key); if(!a) RAIL.chunkRuns.set(key,a=[]);
        const last=a[a.length-1]; if(last&&last[0]===ti&&last[2]===i-1) last[2]=i; else a.push([ti,i,i]); } } }
  for(const st of RAIL.stations){ const i=st.s; const key=Math.floor(X[i]*PPM/CHUNK)+','+Math.floor(Y[i]*PPM/CHUNK); }
  railBridges(); railTimetable(); RAIL.ready=true;
}
function roadSegAt(tx,ty){ if(!inb(tx,ty)) return null; const i=idx(tx,ty), a=world.roadH[i], b=world.roadV[i]; const k=a>=0?a:b>=0?b:-1; return k>=0?world.segs[k]:null; }
// ---------- timetable (pure functions of t in [0,cyc))
const RAIL_PAX=[{n:'Albion Express',c:'hst',cars:7,liv:0},{n:'Kingsbridge Metro',c:'emu',cars:4,liv:3},{n:'Sandreach InterCity',c:'hst',cars:9,liv:1},{n:'Highmoor Sprinter',c:'dmu',cars:3,liv:2}];
const RAIL_FRT=[{n:'Coal',c:'hop',cars:14,liv:0},{n:'Intermodal',c:'flat',cars:11,liv:1},{n:'Fuel tanks',c:'tank',cars:12,liv:2,dbl:1},{n:'Mixed',c:'mix',cars:10,liv:3}];
const CAR_L={hst:20,coach:23,emu:20,dmu:20,loco:21,hop:14,flat:19,tank:16};
function railConsist(sp,frt){ const out=[]; const add=(k,o)=>out.push(Object.assign({k,L:CAR_L[k],liv:sp.liv},o||{}));
  if(!frt){ if(sp.c==='hst'){ add('hst'); for(let i=0;i<sp.cars;i++) add('coach',{i}); add('hst',{flip:1}); } else for(let i=0;i<sp.cars;i++) add(sp.c,{flip:i===sp.cars-1?1:0,mid:i>0&&i<sp.cars-1,first:i===0}); }
  else { add('loco'); if(sp.dbl) add('loco'); for(let i=0;i<sp.cars;i++){ const k=sp.c==='mix'?['hop','flat','tank'][(i*7+3)%3]:sp.c; add(k,{seed:i*31+sp.liv*7}); } }
  let off=0; for(const c of out){ c.off=off+c.L/2; off+=c.L+1.2; } return {cars:out,len:off}; }
function railTimetable(){ const L=RAIL.L, C=RAIL.cyc, st=RAIL.stations, n=st.length, A=0.8;
  const dwell=st.reduce((a,b)=>a+b.dwell,0); const legs=st.map((s,i)=>rlMod(st[(i+1)%n].s-s.s,L)||L);
  const legT=(d,v)=>{ const da=v*v/A; return d>=da? d/v+v/A : 2*Math.sqrt(d/A); };
  let lo=5,hi=90; for(let it=0;it<60;it++){ const v=(lo+hi)/2, T_=dwell+legs.reduce((a,d)=>a+legT(d,v),0); if(T_>C) lo=v; else hi=v; }
  const V=(lo+hi)/2; RAIL.vP=V;
  // table at 0.25 s: arc position of a passenger train with phase 0 (starts departing station 0 after dwell)
  const N=C*4, tab=new Float32Array(N+1); let t=0, k=0; const ev=[];
  for(let i=0;i<n;i++){ ev.push({t0:t,t1:t+st[i].dwell,s0:st[i].s,d:0}); t+=st[i].dwell; const tt=legT(legs[i],V); ev.push({t0:t,t1:t+tt,s0:st[i].s,d:legs[i]}); t+=tt; }
  const scale=C/t; for(const e of ev){ e.t0*=scale; e.t1*=scale; }
  for(let q=0;q<=N;q++){ const tq=q/4; while(k<ev.length-1&&ev[k].t1<tq) k++; const e=ev[k]; let s=e.s0;
    if(e.d){ const T_=e.t1-e.t0, u=Math.max(0,Math.min(T_,tq-e.t0)), d=e.d, ta=T_*0.25, vm=d/(T_-ta), a=vm/ta;
      s+= u<ta? 0.5*a*u*u : u<T_-ta? 0.5*a*ta*ta+vm*(u-ta) : d-0.5*a*(T_-u)**2; }
    tab[q]=rlMod(s,RAIL.L); }
  // make the cruise piece exact (distance-preserving)
  RAIL.tabP=tab; RAIL.ev=ev; RAIL.vF=L/RAIL.cycF;   // freight: one lap per 1200 s
  // choose train counts: largest that passes the block self-test
  for(let np=4;np>=1;np--){ for(let nf=4;nf>=1;nf--){ railMakeTrains(np,nf); const r=railSelfTest(2,1); if(r.ok){ RAIL.test=r; return; } } }
}
function railMakeTrains(np,nf){ const C=RAIL.cyc; RAIL.trains=[];
  for(let k=0;k<np;k++){ const sp=RAIL_PAX[k%RAIL_PAX.length], cs=railConsist(sp,false); RAIL.trains.push({id:'P'+k,pax:1,sp,cars:cs.cars,len:cs.len,ph:k*C/np,plat:k%2}); }
  for(let k=0;k<nf;k++){ const sp=RAIL_FRT[k%RAIL_FRT.length], cs=railConsist(sp,true); RAIL.trains.push({id:'F'+k,pax:0,sp,cars:cs.cars,len:cs.len,ph:k*RAIL.cycF/nf}); } }
function railTime(){ return gameDay*DAY_LEN+gameT*DAY_LEN/24; }   // absolute game seconds; every timetable is periodic in it
// head arc position (centreline s) at time t; passenger heads travel +s, freight heads travel -s
function railHead(tr,t){ const C=RAIL.cyc, L=RAIL.L; if(tr.pax){ const u=rlMod(t+tr.ph,C)*4, q=Math.floor(u), f=u-q, a=RAIL.tabP[q], b=RAIL.tabP[Math.min(q+1,C*4)]; let d=rlMod(b-a,L); if(d>L/2) d-=L; return rlMod(a+d*f,L); }
  return rlMod(-(rlMod(t+tr.ph,RAIL.cycF)*RAIL.vF),L); }
function railSpan(tr,t,m){ const h=railHead(tr,t); m=m||0; return tr.pax?[h-tr.len-m,h+m]:[h-m,h+tr.len+m]; }   // occupied centreline arc, front to back
function rlOvl(a0,a1,b0,b1){ const L=RAIL.L, d=rlMod(a0-b0,L); return d<(b1-b0)||d+(a1-a0)>L; }
function railDwelling(tr,t){ const C=RAIL.cyc, u=rlMod(t+tr.ph,C); for(const e of RAIL.ev) if(!e.d&&u>=e.t0&&u<e.t1) return {st:RAIL.stations.find(s=>s.s===e.s0),ph:(u-e.t0)/(e.t1-e.t0),T:e.t1-e.t0}; return null; }
// block signalling self-test: fixed step over several cycles; one train per block, one train in the hub points
function railSelfTest(days,step){ const L=RAIL.L, NB=Math.max(8,Math.floor(L/600)), blk=L/NB, H=RAIL.hub.s; let minGap=1e9, viol=0, samples=0;
  for(let t=0;t<days*3600;t+=step){ samples++;
    for(const grp of [RAIL.trains.filter(x=>x.pax),RAIL.trains.filter(x=>!x.pax)]){ const occ=new Map(); let hubN=0;
      for(const tr of grp){ const [a,b]=railSpan(tr,t,0); const b0=Math.floor(rlMod(a,L)/blk), b1=Math.floor(rlMod(b,L)/blk); for(let q=b0;;q=(q+1)%NB){ if(occ.has(q)&&occ.get(q)!==tr) viol++; occ.set(q,tr); if(q===b1) break; }
        if(rlOvl(a,b,H-HUB_HALF-HUB_RAMP,H+HUB_HALF+HUB_RAMP)) hubN++; }
      if(hubN>1) viol++;
      for(let i=0;i<grp.length;i++) for(let j=0;j<grp.length;j++){ if(i===j) continue; const A=railSpan(grp[i],t,0), B=railSpan(grp[j],t,0); const g=rlMod(B[0]-A[1],L); if(g<minGap) minGap=g; if(rlOvl(A[0],A[1],B[0],B[1])) viol++; } } }
  return {ok:viol===0,viol,minGap:Math.round(minGap),samples,days,blocks:NB,trains:RAIL.trains.length}; }
// ---------- crossings: barrier state from whole-train occupancy (front to back + margin)
function railOcc(c,t){ for(const tr of RAIL.trains){ const [a,b]=railSpan(tr,t,4); if(rlOvl(a,b,c.za,c.zb)) return true; } return false; }
function railCrossState(c,t){ if(railOcc(c,t)){ // failsafe: never closed for more than 150 s
    let closed=true; for(let k=10;k<=150;k+=10) if(!railOcc(c,t-k)){ closed=false; break; } return closed?{f:0,lit:0}:{f:1,lit:1}; }
  let ahead=99; for(let k=0.5;k<=9;k+=0.5) if(railOcc(c,t+k)){ ahead=k; break; }
  let since=99; for(let k=0.5;k<=2;k+=0.5) if(railOcc(c,t-k)){ since=k; break; }
  const down=ahead<=6.5?rlSm((6.5-ahead)/3):0, up=since<=2?1-since/2:0;
  return {f:Math.max(down,up),lit:ahead<=9||since<=1.5?1:0}; }
function railFrame(){ if(!RAIL.ready) return; const t=railTime(); if(RAIL._t===t) return; RAIL._t=t; const cx=cam.x/PPM, cy=cam.y/PPM, tx=truck.x, ty=truck.y;
  for(const c of RAIL.cross){ if(c.over) continue; if(Math.min(Math.hypot(c.mx-cx,c.my-cy),Math.hypot(c.mx-tx,c.my-ty))>900){ c.f=0; c.lit=0; continue; } const r=railCrossState(c,t); c.f=r.f; c.lit=r.lit; } }
// AI traffic: treat a lit crossing like a red light at the barrier line
function railStopAcc(v,v0){ if(!RAIL.ready||v.h===undefined) return 1e9; let acc=1e9; const d=fwd(v.h);
  for(const c of RAIL.cross){ if(!c.lit&&c.f<0.05) continue; const rx=v.x-c.mx, ry=v.y-c.my; if(rx*rx+ry*ry>70*70) continue;
    const u=rx*c.tx+ry*c.ty, w=rx*c.nx+ry*c.ny, dn=d[0]*c.nx+d[1]*c.ny; if(Math.abs(u)>c.half+4||Math.abs(dn)<0.35) continue;
    if(Math.sign(w)===Math.sign(dn)) continue;   // moving away from the tracks
    const gap=(Math.abs(w)-8.5)/Math.abs(dn)-v.L/2; if(gap<-0.5) continue; acc=Math.min(acc,idmAcc(v,v0,Math.max(0.1,gap),0)); }
  return acc; }
// player truck: barrier arms block movement INTO the crossing only, never out of it
function railBodyPts(s){ const pts=[], f=fwd(s.h), r=rgt(s.h); for(const ly of [CAB.front,0,CAB.rear]) for(const lx of [-CAB.w/2,CAB.w/2]) pts.push([s.x-f[0]*ly+r[0]*lx,s.y-f[1]*ly+r[1]*lx]);
  if(s.trl){ const k=kingpin(s), ft=fwd(s.th), rt=rgt(s.th); for(const ly of [TRL.front,(TRL.front+TRL.rear)/2,TRL.rear]) for(const lx of [-TRL.w/2,TRL.w/2]) pts.push([k[0]-ft[0]*ly+rt[0]*lx,k[1]-ft[1]*ly+rt[1]*lx]); } return pts; }
function railBarrierHit(s,prev){ if(!RAIL.ready) return false; let near=null; for(const c of RAIL.cross){ if(c.over||c.f<0.6) continue; if(Math.hypot(c.mx-s.x,c.my-s.y)<45){ near=c; break; } } if(!near) return false;
  const c=near, A=railBodyPts(s), B=railBodyPts(Object.assign({},s,prev)), AW=6.6;
  for(const q of B){ const ub=(q[0]-c.mx)*c.tx+(q[1]-c.my)*c.ty, wb=(q[0]-c.mx)*c.nx+(q[1]-c.my)*c.ny; if(Math.abs(ub)<c.half+0.5&&Math.abs(wb)<AW) return false; }   // already on the crossing: always free to leave
  for(let i=0;i<A.length;i++){ const ua=(A[i][0]-c.mx)*c.tx+(A[i][1]-c.my)*c.ty, wa=(A[i][0]-c.mx)*c.nx+(A[i][1]-c.my)*c.ny, wb=(B[i][0]-c.mx)*c.nx+(B[i][1]-c.my)*c.ny;
    if(Math.abs(ua)<c.half+0.5&&Math.abs(wb)>=AW&&Math.abs(wa)<AW) return true; }
  return false; }
// ---------- baked track (chunk cache)
function railChunk(g,ox,oy,top){ if(!RAIL.ready) return; const runs=RAIL.chunkRuns.get(Math.floor(ox/CHUNK)+','+Math.floor(oy/CHUNK)); if(!runs) return; const S=PPM;
  g.save(); g.translate(-ox,-oy); g.lineCap='butt'; g.lineJoin='round';
  const path=(P,i0,i1,w)=>{ g.beginPath(); for(let i=i0;i<=i1;i++){ const p=P[i]; const x=(p.x+p.nx*w)*S, y=(p.y+p.ny*w)*S; i===i0?g.moveTo(x,y):g.lineTo(x,y); } };
  const sub=(P,i0,i1,test,fn)=>{ let a=-1; for(let i=i0;i<=i1+1;i++){ const ok=i<=i1&&test(P[i].k); if(ok&&a<0) a=Math.max(i0,i-1); if(!ok&&a>=0){ fn(a,Math.min(i1,i)); a=-1; } } };
  const rails=(P,a,b)=>{ for(const w of [-0.75,0.75]){ path(P,a,b,w); g.strokeStyle='rgba(0,0,0,0.6)'; g.lineWidth=0.46*S; g.stroke(); g.strokeStyle='#8e959e'; g.lineWidth=0.3*S; g.stroke(); g.strokeStyle='#f6f9fc'; g.lineWidth=0.11*S; g.stroke(); } };
  const outer=ti=>ti===1||ti===3||ti===4?-1:1;
  if(top){ // level-crossing panels + rails redrawn above road markings / junction paint
    for(const [ti,i0,i1] of runs){ const P=RAIL.tracks[ti].P;
      sub(P,i0,i1,k=>k===4,(a,b)=>{ path(P,a,b,0); g.strokeStyle='#3b3d41'; g.lineWidth=3.8*S; g.stroke(); g.strokeStyle='#55585e'; g.lineWidth=3.3*S; g.stroke();
        g.strokeStyle='#d9d4c6'; g.lineWidth=0.16*S; for(const w of [-1.85,1.85]){ path(P,a,b,w); g.stroke(); }
        for(let i=a;i<b;i++){ const p=P[i]; g.fillStyle='rgba(0,0,0,0.28)'; for(const w of [-1.25,0,1.25]) g.fillRect((p.x+p.nx*w)*S-1,(p.y+p.ny*w)*S-1,2,2); }
        rails(P,a,b); }); }
    g.restore(); return; }
  for(const [ti,i0,i1] of runs){ const P=RAIL.tracks[ti].P;
    sub(P,i0,i1,k=>k===0,(a,b)=>{ path(P,a,b,0); g.strokeStyle='#463f38'; g.lineWidth=5.0*S; g.stroke(); g.strokeStyle='#5f564d'; g.lineWidth=4.2*S; g.stroke(); g.strokeStyle='#6a6056'; g.lineWidth=3.0*S; g.stroke(); });
    sub(P,i0,i1,k=>k===2,(a,b)=>{ path(P,a,b,0); g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=5.6*S; g.save(); g.translate(22,30); g.stroke(); g.restore(); g.strokeStyle='#4a5058'; g.lineWidth=5.6*S; g.stroke(); g.strokeStyle='#6b7179'; g.lineWidth=4.4*S; g.stroke();
      const o=outer(ti); path(P,a,b,o*2.55); g.strokeStyle='#2c3036'; g.lineWidth=0.5*S; g.stroke(); g.strokeStyle='#cfd4da'; g.lineWidth=0.22*S; g.stroke();
      for(let i=a;i<=b;i+=3){ const p=P[i]; g.fillStyle='#2c3036'; g.fillRect((p.x+p.nx*o*2.55)*S-1.5,(p.y+p.ny*o*2.55)*S-1.5,3,3); } });
    sub(P,i0,i1,k=>k===4,(a,b)=>{ path(P,a,b,0); g.strokeStyle='#3b3d41'; g.lineWidth=3.8*S; g.stroke(); }); }
  for(const [ti,i0,i1] of runs){ const P=RAIL.tracks[ti].P;
    // ballast stones + sleepers
    for(let i=i0;i<=i1;i++){ const p=P[i]; if(p.k!==0&&p.k!==2) continue; const tx=-p.ny, ty=p.nx;
      if(p.k===0) for(let q=0;q<14;q++){ const h=rlHash((p.s*13+q)*7919+ti*97), h2=rlHash(h*1e9|0), w=(h-0.5)*4.4, u=h2-0.5; const x=(p.x+p.nx*w+tx*u)*S, y=(p.y+p.ny*w+ty*u)*S; g.fillStyle=['#7d7266','#4b433b','#8e8478','#5a5148','#9c9286','#3f3832'][q%6]; g.fillRect(x,y,1.5+(q&1)*1.2,1.5+(q%3===0?1:0)); }
      for(let k2=0;k2<2;k2++){ const u=k2*0.5; if(i===P.length-1) break; const q=P[i+1]; const cx=(p.x+(q.x-p.x)*u)*S, cy=(p.y+(q.y-p.y)*u)*S, hx=p.nx*1.35*S, hy=p.ny*1.35*S, ax=tx*0.15*S, ay=ty*0.15*S;
        g.fillStyle='rgba(0,0,0,0.35)'; g.beginPath(); g.moveTo(cx-hx-ax+1,cy-hy-ay+1.5); g.lineTo(cx+hx-ax+1,cy+hy-ay+1.5); g.lineTo(cx+hx+ax+1,cy+hy+ay+1.5); g.lineTo(cx-hx+ax+1,cy-hy+ay+1.5); g.fill();
        g.fillStyle=p.k===2?'#26282b':'#2f2721'; g.beginPath(); g.moveTo(cx-hx-ax,cy-hy-ay); g.lineTo(cx+hx-ax,cy+hy-ay); g.lineTo(cx+hx+ax,cy+hy+ay); g.lineTo(cx-hx+ax,cy-hy+ay); g.fill();
        g.fillStyle='#55473b'; g.fillRect(cx-hx*0.9-0.5,cy-hy*0.9-0.5,1,1); g.fillStyle='#5a5048'; g.fillRect(cx+hx*0.55-1,cy+hy*0.55-1,2,2); g.fillRect(cx-hx*0.55-1,cy-hy*0.55-1,2,2); } }
    sub(P,i0,i1,k=>k!==3,(a,b)=>rails(P,a,b)); }
  // suspension-bridge tower + cable shadows on the water (static, baked once per chunk)
  for(const br of RAIL.bridges||[]){ if(br.cx*S<ox-1500||br.cx*S>ox+CHUNK+1500||br.cy*S<oy-1500||br.cy*S>oy+CHUNK+1500) continue; const sh=(x,y,h)=>[x*S+h*S*0.55,y*S+h*S*0.75];
    g.strokeStyle='rgba(0,20,40,0.28)'; g.lineCap='round';
    for(const sd of [-1,1]){ g.lineWidth=0.8*S; g.beginPath(); br.cab.forEach(([s,h],k)=>{ const d=railPt(s,sd*BR_LAT), q=sh(d[0],d[1],h); k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); }); g.stroke(); }
    g.fillStyle='rgba(0,20,40,0.32)'; for(const sT of br.tw){ for(const sd of [-1,1]){ const b=railPt(sT,sd*BR_TW); g.lineWidth=2.4*S; g.beginPath(); g.moveTo(b[0]*S,b[1]*S); const q=sh(b[0],b[1],BR_H); g.lineTo(q[0],q[1]); g.stroke(); }
      for(const f of [0.5,0.78,0.98]){ const l=railPt(sT,-BR_TW), r=railPt(sT,BR_TW), a1=sh(l[0],l[1],BR_H*f), a2=sh(r[0],r[1],BR_H*f); g.lineWidth=1.4*S; g.beginPath(); g.moveTo(a1[0],a1[1]); g.lineTo(a2[0],a2[1]); g.stroke(); } }
    g.lineCap='butt'; }
  // stations (platforms, shelters, canopies, signs)
  for(const st of RAIL.stations){ const px=RAIL.X[st.s]*S, py=RAIL.Y[st.s]*S; if(px<ox-2600||px>ox+CHUNK+2600||py<oy-2600||py>oy+CHUNK+2600) continue; railBakeStation(g,st); }
  g.restore(); }
// ---------- Golden-Gate-style suspension bridges (grey steel). Geometry precomputed once in railBridges(); towers/cables lean with height (parallax)
const BR_H=58, BR_TW=7.2, BR_LAT=6.6, BR_PAR=0.008;
function railBridges(){ const P=RAIL.tracks[0].P, out=[]; let a=-1;
  for(let i=0;i<=P.length;i++){ const w=i<P.length&&P[i].k===2; if(w&&a<0) a=i; if(!w&&a>=0){ if(i-a>=40) out.push([a-6,i+6]); a=-1; } }
  RAIL.bridges=out.map(([sA,sB])=>{ const Lb=sB-sA, c=railPt((sA+sB)/2,0), t1=sA+Lb*(Lb>160?0.2:0.12), t2=sB-Lb*(Lb>160?0.2:0.12), cab=[], hang=[];
    const hAt=s=>{ if(s<t1){ const u=(s-sA)/(t1-sA); return 2+(BR_H-3-2)*u*u; } if(s>t2){ const u=(sB-s)/(sB-t2); return 2+(BR_H-3-2)*u*u; } const u=(s-(t1+t2)/2)/((t2-t1)/2); return 3.5+(BR_H-3-3.5)*u*u; };
    for(let s=sA;s<=sB;s+=4){ cab.push([s,hAt(s)]); if(Math.abs(s-t1)>3&&Math.abs(s-t2)>3&&s>sA+2&&s<sB-2) hang.push([s,hAt(s)]); } cab.push([sB,hAt(sB)]);
    return {sA,sB,cx:c[0],cy:c[1],tw:[t1,t2],cab,hang}; }); }
function railLift(x,y,h){ const px=x*PPM, py=y*PPM, k=h*BR_PAR; return [px+(px-cam.x)*k, py+(py-cam.y)*k]; }
function drawRailBridges(vx0,vy0,vx1,vy1){ const S=PPM;
  for(const br of RAIL.bridges||[]){ const a=railPt(br.sA,0), b=railPt(br.sB,0); if(Math.max(a[0],b[0])*S<vx0-900||Math.min(a[0],b[0])*S>vx1+900||Math.max(a[1],b[1])*S<vy0-900||Math.min(a[1],b[1])*S>vy1+900) continue;
    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    // hangers then main cables
    for(const sd of [-1,1]){ ctx.strokeStyle='rgba(205,210,216,0.85)'; ctx.lineWidth=Math.max(1,0.16*S); ctx.beginPath();
      for(const [s,h] of br.hang){ const d=railPt(s,sd*BR_LAT), p0=railLift(d[0],d[1],1.2), p1=railLift(d[0],d[1],h); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); } ctx.stroke();
      const cab=()=>{ ctx.beginPath(); br.cab.forEach(([s,h],k)=>{ const d=railPt(s,sd*BR_LAT), q=railLift(d[0],d[1],h); k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); };
      cab(); ctx.strokeStyle='#3e444b'; ctx.lineWidth=0.95*S; ctx.stroke(); ctx.strokeStyle='#a9b0b8'; ctx.lineWidth=0.6*S; ctx.stroke(); ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=0.18*S; ctx.stroke(); }
    // towers: twin legs, portal beams with arches, caps
    for(const sT of br.tw){ const L0=railPt(sT,-BR_TW), R0=railPt(sT,BR_TW);
      const leg=(B)=>{ const p0=railLift(B[0],B[1],0), p1=railLift(B[0],B[1],BR_H); ctx.lineCap='butt'; ctx.strokeStyle='#353a41'; ctx.lineWidth=3.6*S; ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke();
        ctx.strokeStyle="#7d858e"; ctx.lineWidth=2.9*S; ctx.stroke(); ctx.strokeStyle='#a7aeb6'; ctx.lineWidth=0.7*S; ctx.stroke(); return p1; };
      ctx.fillStyle='#4d535b'; for(const B of [L0,R0]){ const q=railLift(B[0],B[1],0); ctx.fillRect(q[0]-2*S,q[1]-2*S,4*S,4*S); }
      leg(L0); leg(R0);
      for(const f of [0.42,0.68,0.9]){ const l=railLift(L0[0],L0[1],BR_H*f), r=railLift(R0[0],R0[1],BR_H*f), lu=railLift(L0[0],L0[1],BR_H*(f-0.09)), ru=railLift(R0[0],R0[1],BR_H*(f-0.09)), m=[(lu[0]+ru[0])/2,(lu[1]+ru[1])/2], mt=[(l[0]+r[0])/2,(l[1]+r[1])/2];
        ctx.beginPath(); ctx.moveTo(l[0],l[1]); ctx.lineTo(r[0],r[1]); ctx.lineTo(ru[0],ru[1]); ctx.quadraticCurveTo(mt[0]+(m[0]-mt[0])*0.2,mt[1]+(m[1]-mt[1])*0.2,lu[0],lu[1]); ctx.closePath(); ctx.fillStyle='#6f777f'; ctx.fill(); ctx.strokeStyle='#353a41'; ctx.lineWidth=0.35*S; ctx.stroke(); }
      for(const B of [L0,R0]){ const q=railLift(B[0],B[1],BR_H+1); ctx.fillStyle='#353a41'; ctx.fillRect(q[0]-1.7*S,q[1]-1.7*S,3.4*S,3.4*S); ctx.fillStyle='#b9c0c7'; ctx.fillRect(q[0]-1.3*S,q[1]-1.3*S,2.6*S,2.6*S);
        if(DN.dark>0.2){ ctx.fillStyle='#ff3b2a'; ctx.beginPath(); ctx.arc(q[0],q[1],0.5*S,0,7); ctx.fill(); dnLight(q[0],q[1],24,'rgba(255,50,30,0.9)',0.8); } } }
    ctx.restore(); } }
function railQuad(g,s0,s1,w0,w1,wf){ const L=RAIL.L; g.beginPath(); for(let s=s0;s<=s1;s+=2){ const i=rlMod(Math.round(s),L), w=wf?wf(s,w0):w0; const x=(RAIL.X[i]+RAIL.NX[i]*w)*PPM, y=(RAIL.Y[i]+RAIL.NY[i]*w)*PPM; s===s0?g.moveTo(x,y):g.lineTo(x,y); }
  for(let s=s1;s>=s0;s-=2){ const i=rlMod(Math.round(s),L), w=wf?wf(s,w1):w1; g.lineTo((RAIL.X[i]+RAIL.NX[i]*w)*PPM,(RAIL.Y[i]+RAIL.NY[i]*w)*PPM); } g.closePath(); }
function railPt(s,w){ const L=RAIL.L, sf=rlMod(s,L), i=Math.floor(sf), j=(i+1)%L, f=sf-i; const x=RAIL.X[i]+(RAIL.X[j]-RAIL.X[i])*f, y=RAIL.Y[i]+(RAIL.Y[j]-RAIL.Y[i])*f; return [x+RAIL.NX[i]*w,y+RAIL.NY[i]*w]; }
function railPlats(st){ const hub=st.kind==='hub'; return hub?[[3.6,7.5],[12.7,16.6]]:[[3.6,7.4]]; }
function railBakeStation(g,st){ const a=st.s-st.len/2, b=st.s+st.len/2, S=PPM, hub=st.kind==='hub';
  for(const [w0,w1] of railPlats(st)){ const ww=(s,w)=>w; railQuad(g,a,b,w0,w1,ww); g.fillStyle='rgba(0,0,0,0.3)'; g.save(); g.translate(5,6); g.fill(); g.restore(); g.fillStyle='#cfc9bd'; g.fill(); g.strokeStyle='#8f897d'; g.lineWidth=2; g.stroke();
    // paving joints
    g.strokeStyle='rgba(120,112,100,0.35)'; g.lineWidth=1; for(let s=a;s<=b;s+=3){ const p=railPt(s,w0), q=railPt(s,w1); g.beginPath(); g.moveTo(p[0]*S,p[1]*S); g.lineTo(q[0]*S,q[1]*S); g.stroke(); }
    for(const [we,col,lw] of [[w0+0.15,'#f6f3ea',2.5],[w0+0.65,'#f2c230',2],[w1-0.15,'#f6f3ea',2.5],[w1-0.65,'#f2c230',2]]){ if(!hub&&we>w1-1) continue; g.strokeStyle=col; g.lineWidth=lw; g.beginPath(); for(let s=a;s<=b;s+=4){ const p=railPt(s,we); s===a?g.moveTo(p[0]*S,p[1]*S):g.lineTo(p[0]*S,p[1]*S); } g.stroke(); } }
  if(hub){ // overall roof: glazed canopy with steel ribs + concourse
    railQuad(g,st.s-90,st.s+90,2.4,18,null); g.fillStyle='rgba(30,40,55,0.25)'; g.save(); g.translate(10,12); g.fill(); g.restore(); g.fillStyle='rgba(170,205,230,0.55)'; g.fill(); g.strokeStyle='#e7edf2'; g.lineWidth=3; g.stroke();
    g.strokeStyle='rgba(255,255,255,0.7)'; g.lineWidth=2; for(let s=st.s-90;s<=st.s+90;s+=6){ const p=railPt(s,2.4), q=railPt(s,18); g.beginPath(); g.moveTo(p[0]*S,p[1]*S); g.lineTo(q[0]*S,q[1]*S); g.stroke(); }
    g.strokeStyle='#5f6b78'; g.lineWidth=4; for(const w of [6.5,10.2,14]){ g.beginPath(); for(let s=st.s-90;s<=st.s+90;s+=6){ const p=railPt(s,w); s===st.s-90?g.moveTo(p[0]*S,p[1]*S):g.lineTo(p[0]*S,p[1]*S); } g.stroke(); }
    railQuad(g,st.s-40,st.s+40,18,30,null); g.fillStyle='#8c3b2e'; g.fill(); g.fillStyle='#b5523f'; railQuad(g,st.s-38,st.s+38,19,29,null); g.fill(); }
  else for(let s=a+15;s<=b-15;s+=38){ const [w0,w1]=railPlats(st)[0], wc=(w0+w1)/2+0.6; railQuad(g,s-5,s+5,wc-1.4,wc+1.4,null); g.fillStyle='rgba(0,0,0,0.3)'; g.save(); g.translate(6,7); g.fill(); g.restore(); g.fillStyle=st.kind==='city'||st.kind==='town'?'#2f5d8a':'#4f7a3a'; g.fill(); g.fillStyle='rgba(255,255,255,0.25)'; railQuad(g,s-5,s+5,wc-1.4,wc-0.6,null); g.fill(); }
  // name boards
  const [w0,w1]=railPlats(st)[0]; for(const s of [a+8,b-8]){ const p=railPt(s,w1-0.9), q=railPt(s+1,w1-0.9), ang=Math.atan2(q[1]-p[1],q[0]-p[0]); g.save(); g.translate(p[0]*S,p[1]*S); g.rotate(ang); g.font='bold 15px system-ui,sans-serif'; const tw=g.measureText(st.name).width+14;
    g.fillStyle='#16335c'; g.fillRect(-tw/2,-10,tw,20); g.strokeStyle='#fff'; g.lineWidth=1.5; g.strokeRect(-tw/2+2,-8,tw-4,16); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(st.name,0,1); g.restore(); } }
// ---------- sprites
const RL_LIV=[{b:'#13284d',s:'#f5b82e',s2:'#ffffff',n:'#f7d417'},{b:'#f1f1ee',s:'#d7232e',s2:'#1b1b1b',n:'#ffd000'},{b:'#0f5a3c',s:'#a6e22e',s2:'#ecf7e6',n:'#ffd400'},{b:'#4b2380',s:'#ff4fa3',s2:'#ffffff',n:'#ffd400'}];
const RL_FLIV=[{b:'#ff6a13',s:'#1b1b1b'},{b:'#1d8a4e',s:'#ffd200'},{b:'#ffcf1f',s:'#1d3e8a'},{b:'#c1121f',s:'#f1f1f1'}];
const RL_CONT=['#c0392b','#2e86de','#27ae60','#f39c12','#8e44ad','#d35400','#16a085','#7f8c8d','#e8e8e8'];
function rlRR(g,x,y,w,h,r){ g.beginPath(); if(g.roundRect) g.roundRect(x,y,w,h,r); else g.rect(x,y,w,h); }
function railSprite(c,lit){ const key=c.k+'|'+c.liv+'|'+(c.flip?1:0)+'|'+(c.seed||0)%9+'|'+(lit?1:0)+'|'+(c.first?1:0); let sp=RAIL.spr[key]; if(sp) return sp;
  const S=12, Wm=2.9, L=c.L, cv=mkCanvas(Math.ceil(L*S)+4,Math.ceil(Wm*S)+4), g=cv.getContext('2d'), W=Wm*S, Lp=L*S; g.translate(2,2);
  const pax=c.k==='hst'||c.k==='coach'||c.k==='emu'||c.k==='dmu', lv=pax?RL_LIV[c.liv%4]:RL_FLIV[c.liv%4];
  const across=(c0,c1,c2)=>{ const gr=g.createLinearGradient(0,0,0,W); gr.addColorStop(0,c0); gr.addColorStop(0.5,c1); gr.addColorStop(1,c2); return gr; };
  if(c.flip){ g.translate(Lp,W); g.rotate(Math.PI); }
  if(pax){ const nose=c.k==='hst'?5.5*S:(c.k==='emu'||c.k==='dmu')&&(c.first||c.flip)?2.6*S:0;
    // body sides (livery) + roof
    g.beginPath(); g.moveTo(0,2); g.lineTo(Lp-nose,0); if(nose){ g.quadraticCurveTo(Lp,0,Lp,W/2); g.quadraticCurveTo(Lp,W,Lp-nose,W); } else { g.lineTo(Lp,0); g.lineTo(Lp,W); } g.lineTo(0,W-2); g.closePath();
    g.fillStyle=lv.b; g.fill(); g.save(); g.clip();
    g.fillStyle=lv.s; g.fillRect(0,W*0.05,Lp,W*0.13); g.fillRect(0,W*0.82,Lp,W*0.13); g.fillStyle=lv.s2; g.fillRect(0,W*0.18,Lp,W*0.035); g.fillRect(0,W*0.785,Lp,W*0.035);
    // windows band (lit at night)
    const wc=lit?'#ffe7a0':'#1c2633'; g.fillStyle=wc; const wx0=c.k==='hst'?2.5*S:1.2*S, wx1=Lp-nose-(c.k==='hst'?3*S:1.2*S);
    if(c.k!=='hst'||1) for(let x=wx0;x<wx1;x+=1.9*S){ g.fillRect(x,W*0.005,1.5*S,W*0.045); g.fillRect(x,W*0.95,1.5*S,W*0.045); }
    // roof
    g.fillStyle=across('#6d727a','#b9bec6','#6d727a'); g.fillRect(0,W*0.22,Lp-nose*0.6,W*0.56);
    if(nose){ // raked cab: livery nose + warning yellow + windscreen
      g.fillStyle=lv.n; g.beginPath(); g.moveTo(Lp-nose*0.75,W*0.12); g.quadraticCurveTo(Lp,W*0.1,Lp,W/2); g.quadraticCurveTo(Lp,W*0.9,Lp-nose*0.75,W*0.88); g.closePath(); g.fill();
      g.fillStyle='#0d1219'; g.beginPath(); g.moveTo(Lp-nose*0.95,W*0.2); g.quadraticCurveTo(Lp-nose*0.35,W*0.18,Lp-nose*0.4,W/2); g.quadraticCurveTo(Lp-nose*0.35,W*0.82,Lp-nose*0.95,W*0.8); g.closePath(); g.fill();
      g.fillStyle='rgba(255,255,255,0.35)'; g.fillRect(Lp-nose*0.85,W*0.26,nose*0.12,W*0.48); }
    // roof equipment
    g.fillStyle='#41464d'; if(c.k==='hst'){ for(let k=0;k<3;k++){ g.fillRect(3*S+k*3.2*S,W*0.3,2.6*S,W*0.4); g.fillStyle='#2a2e33'; for(let q=0;q<6;q++) g.fillRect(3*S+k*3.2*S+q*0.45*S,W*0.32,1.5,W*0.36); g.fillStyle='#41464d'; }
      g.beginPath(); g.arc(13.5*S,W/2,W*0.22,0,7); g.fill(); g.strokeStyle='#888'; g.lineWidth=1.5; g.beginPath(); g.arc(13.5*S,W/2,W*0.16,0,7); g.stroke(); g.beginPath(); g.moveTo(13.5*S-W*0.16,W/2); g.lineTo(13.5*S+W*0.16,W/2); g.stroke(); }
    else { for(let x=3*S;x<Lp-4*S;x+=5*S){ g.fillStyle='#8d939b'; g.fillRect(x,W*0.4,1.6*S,W*0.2); g.fillStyle='#5b6067'; g.fillRect(x+0.2*S,W*0.44,1.2*S,W*0.12); }
      if(c.k==='emu'&&c.mid){ g.strokeStyle='#2b2f35'; g.lineWidth=2; const px=Lp*0.35; g.beginPath(); g.moveTo(px-1.2*S,W*0.3); g.lineTo(px+1.6*S,W/2); g.lineTo(px-1.2*S,W*0.7); g.moveTo(px+1.6*S,W*0.28); g.lineTo(px+1.6*S,W*0.72); g.stroke(); g.fillStyle='#c9302c'; g.fillRect(px-1.6*S,W*0.36,0.5*S,W*0.28); }
      if(c.k==='dmu'){ g.fillStyle='#222'; g.beginPath(); g.arc(Lp*0.5,W*0.5,W*0.09,0,7); g.fill(); } }
    g.restore(); g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=1.5; g.stroke(); }
  else { const fl=RL_FLIV[c.liv%4];
    if(c.k==='loco'){ // freight diesel: long hood, cab at front, fans, exhaust, chevrons
      rlRR(g,0,0,Lp,W,4); g.fillStyle=fl.b; g.fill(); g.fillStyle=across('rgba(0,0,0,0.25)','rgba(255,255,255,0.18)','rgba(0,0,0,0.3)'); g.fill();
      g.fillStyle=fl.s; g.fillRect(0,W*0.06,Lp,W*0.1); g.fillRect(0,W*0.84,Lp,W*0.1);
      g.fillStyle=across(shade(fl.b,0.7),shade(fl.b,1.15),shade(fl.b,0.7)); g.fillRect(1.5*S,W*0.2,Lp-6*S,W*0.6);
      for(let k=0;k<3;k++){ const x=3.5*S+k*3.4*S; g.fillStyle='#24272b'; g.beginPath(); g.arc(x,W/2,W*0.24,0,7); g.fill(); g.strokeStyle='#666b72'; g.lineWidth=1.2; for(let q=0;q<4;q++){ g.beginPath(); g.arc(x,W/2,W*(0.06+q*0.05),0,7); g.stroke(); } g.beginPath(); g.moveTo(x-W*0.24,W/2); g.lineTo(x+W*0.24,W/2); g.moveTo(x,W*0.26); g.lineTo(x,W*0.74); g.stroke(); }
      g.fillStyle='#1a1a1a'; g.fillRect(13.5*S,W*0.4,1.4*S,W*0.2); g.fillStyle='#3b3b3b'; g.fillRect(13.7*S,W*0.44,1*S,W*0.12);
      g.fillStyle='#34383e'; for(let x=15.5*S;x<Lp-5.5*S;x+=0.5*S) g.fillRect(x,W*0.24,1.5,W*0.52);
      g.fillStyle=shade(fl.b,0.85); g.fillRect(Lp-5*S,W*0.12,3.6*S,W*0.76); g.fillStyle=lit?'#ffe7a0':'#121820'; g.fillRect(Lp-2.1*S,W*0.18,0.8*S,W*0.64); g.fillRect(Lp-4.6*S,W*0.13,2.2*S,W*0.07); g.fillRect(Lp-4.6*S,W*0.8,2.2*S,W*0.07);
      g.save(); g.beginPath(); g.rect(Lp-1.2*S,0,1.2*S,W); g.clip(); g.fillStyle='#ffd400'; g.fillRect(Lp-1.2*S,0,1.2*S,W); g.fillStyle='#111'; for(let y=-W;y<W*2;y+=0.6*S){ g.beginPath(); g.moveTo(Lp-1.2*S,y); g.lineTo(Lp,y+0.6*S); g.lineTo(Lp,y+0.9*S); g.lineTo(Lp-1.2*S,y+0.3*S); g.fill(); } g.restore();
      g.fillStyle='#ffd400'; g.fillRect(0,0,0.5*S,W); g.strokeStyle='#d8d8d8'; g.lineWidth=1; g.strokeRect(0.6*S,W*0.03,Lp-1.8*S,W*0.94);
      rlRR(g,0,0,Lp,W,4); g.strokeStyle='rgba(0,0,0,0.6)'; g.lineWidth=1.5; g.stroke(); }
    else if(c.k==='hop'){ g.fillStyle='#2b2d31'; rlRR(g,0,0,Lp,W,2); g.fill(); g.fillStyle=across('#3f4247','#5a5e64','#3f4247'); g.fillRect(0.4*S,W*0.06,Lp-0.8*S,W*0.88);
      g.fillStyle='#15161a'; rlRR(g,1*S,W*0.14,Lp-2*S,W*0.72,6); g.fill(); for(let q=0;q<160;q++){ const h=rlHash(q*13+(c.seed||0)*977), h2=rlHash(q*71+3+(c.seed||0)); g.fillStyle=q%4?'#26272b':'#3c3d42'; g.beginPath(); g.arc(1.4*S+h*(Lp-2.8*S),W*0.2+h2*W*0.6,1.4+h*2,0,7); g.fill(); }
      g.fillStyle='rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(Lp/2,W/2,Lp*0.3,W*0.14,0,0,7); g.fill();
      g.fillStyle='#4a4e54'; for(let x=2.4*S;x<Lp-1*S;x+=2.8*S) g.fillRect(x,0,0.25*S,W); g.fillStyle=RL_FLIV[(c.seed||0)%4].b; g.fillRect(0,W*0.44,0.4*S,W*0.12); }
    else if(c.k==='flat'){ g.fillStyle='#3a3d42'; g.fillRect(0,W*0.15,Lp,W*0.7); g.fillStyle='#24262a'; g.fillRect(0,W*0.42,Lp,W*0.16);
      const n=(c.seed||0)%5===0?1:2; for(let k=0;k<n;k++){ const cl=RL_CONT[((c.seed||0)*3+k*5)%RL_CONT.length], cl2=n===1?Lp-1*S:(Lp-1.4*S)/2, x=0.5*S+k*(cl2+0.4*S); g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(x+3,W*0.04+3,cl2,W*0.92);
        g.fillStyle=cl; g.fillRect(x,W*0.04,cl2,W*0.92); g.fillStyle=shade(cl,0.72); for(let q=x+4;q<x+cl2-2;q+=5) g.fillRect(q,W*0.04,1.5,W*0.92); g.fillStyle=shade(cl,1.3); g.fillRect(x,W*0.04,cl2,W*0.1); g.strokeStyle='rgba(0,0,0,0.5)'; g.lineWidth=1; g.strokeRect(x,W*0.04,cl2,W*0.92);
        if(k===0&&n===2){ g.fillStyle='rgba(255,255,255,0.85)'; g.font='bold 11px Arial'; g.fillText(['MAERA','COSCA','EVERLINE','HAPAG'][(c.seed||0)%4],x+8,W*0.6); } } }
    else if(c.k==='tank'){ g.fillStyle='#2a2c30'; g.fillRect(0,W*0.1,Lp,W*0.8); const tc=(c.seed||0)%3===0?['#2c2f33','#6e737a','#2c2f33']:['#a9aeb4','#f2f4f6','#8d9298'];
      rlRR(g,0.6*S,W*0.06,Lp-1.2*S,W*0.88,W*0.44); g.fillStyle=across(...tc); g.fill(); g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=1.2; g.stroke();
      g.fillStyle='#e8a317'; g.fillRect(Lp*0.2,W*0.46,Lp*0.6,W*0.08); g.fillStyle='#555'; g.fillRect(0.8*S,W*0.46,Lp-1.6*S,1.5);
      g.fillStyle='#5c6168'; g.beginPath(); g.arc(Lp/2,W/2,W*0.15,0,7); g.fill(); g.fillStyle='#8a9098'; g.beginPath(); g.arc(Lp/2,W/2,W*0.09,0,7); g.fill();
      g.fillStyle='#ff6a00'; g.fillRect(Lp*0.12,W*0.2,1.6*S,W*0.18); g.fillStyle='#fff'; g.font='bold 9px Arial'; g.fillText('3',Lp*0.12+5,W*0.34); } }
  // couplers / buffers
  g.fillStyle='#1d1f22'; g.fillRect(-2,W*0.42,4,W*0.16); g.fillRect(Lp-2,W*0.42,4,W*0.16); if(!pax){ g.fillRect(-1.5,W*0.12,3,W*0.12); g.fillRect(-1.5,W*0.76,3,W*0.12); }
  sp={c:cv,S,W,L}; RAIL.spr[key]=sp; return sp; }
// ---------- dynamic drawing
function railCarPose(tr,c,head,trk){ const dir=tr.pax?1:-1, sc=head-dir*c.off, w=s=>tr.pax?(tr.plat?RW_P+HUB_W*RAIL.hubB(s):RW_P):RW_F;
  const a=railPt(sc+dir*c.L/2,w(sc+dir*c.L/2)), b=railPt(sc-dir*c.L/2,w(sc-dir*c.L/2)); return {x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,ang:Math.atan2(a[1]-b[1],a[0]-b[0]),fx:a[0],fy:a[1]}; }
function drawRail(vx0,vy0,vx1,vy1){ if(!RAIL.ready) return; railFrame(); const t=railTime(), S=PPM, m=300, lit=DN.dark>0.3;
  const inV=(x,y,r)=>x*S>vx0-r&&x*S<vx1+r&&y*S>vy0-r&&y*S<vy1+r;
  // motorway overbridges (rails cross above the motorway)
  for(const c of RAIL.cross){ if(!c.over||!inV(c.mx,c.my,600)) continue; railQuad(ctx,c.sa-5,c.sb+5,-4.8,4.8,null); ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.save(); ctx.translate(14,18); ctx.fill(); ctx.restore(); ctx.fillStyle='#8a8e94'; ctx.fill(); ctx.strokeStyle='#d6d9dd'; ctx.lineWidth=5; ctx.stroke();
    railQuad(ctx,c.sa-5,c.sb+5,-4,4,null); ctx.fillStyle='#958f84'; ctx.fill();
    for(let s=c.sa-5;s<=c.sb+5;s+=0.66){ for(const w of [RW_P,RW_F]){ const p=railPt(s,w-1.3), q=railPt(s,w+1.3); ctx.strokeStyle='#b9b3a7'; ctx.lineWidth=0.26*S; ctx.beginPath(); ctx.moveTo(p[0]*S,p[1]*S); ctx.lineTo(q[0]*S,q[1]*S); ctx.stroke(); } }
    for(const w of [RW_P-0.72,RW_P+0.72,RW_F-0.72,RW_F+0.72]){ ctx.beginPath(); for(let s=c.sa-5;s<=c.sb+5;s+=2){ const p=railPt(s,w); s===c.sa-5?ctx.moveTo(p[0]*S,p[1]*S):ctx.lineTo(p[0]*S,p[1]*S); } ctx.strokeStyle='#7d8189'; ctx.lineWidth=0.2*S; ctx.stroke(); ctx.strokeStyle='#eef3f8'; ctx.lineWidth=0.07*S; ctx.stroke(); } }
  // parked stock in the hub's holding sidings
  if(RAIL.hub&&inV(RAIL.X[RAIL.hub.s],RAIL.Y[RAIL.hub.s],2400)){ const H=RAIL.hub.s; [[-6.7,RAIL_FRT[0],60],[-11.3,RAIL_FRT[1],70]].forEach(([w,sp,s0],q)=>{ const cs=railConsist(Object.assign({},sp,{cars:5+q*2}),true); for(const c of cs.cars){ const sc=H+s0-c.off, a=railPt(sc+c.L/2,w), b=railPt(sc-c.L/2,w); railBlit(c,(a[0]+b[0])/2,(a[1]+b[1])/2,Math.atan2(a[1]-b[1],a[0]-b[0]),lit); } }); }
  // trains
  for(const tr of RAIL.trains){ const head=railHead(tr,t); const hp=railPt(head,0); const nearAny=inV(hp[0],hp[1],tr.len*S+m)||inV(...railPt(head-(tr.pax?1:-1)*tr.len,0),m); if(!nearAny) continue;
    for(let i=0;i<tr.cars.length;i++){ const c=tr.cars[i], P=railCarPose(tr,c,head); if(!inV(P.x,P.y,m)) continue; railBlit(c,P.x,P.y,P.ang,lit);
      if(i===0&&DN.dark>0.05){ dnLight(P.fx*S+Math.cos(P.ang)*14,P.fy*S+Math.sin(P.ang)*14,70,'rgba(255,250,225,0.95)',0.9); }
      if(i===tr.cars.length-1&&DN.dark>0.05){ const bx=(P.x-Math.cos(P.ang)*c.L/2)*S, by=(P.y-Math.sin(P.ang)*c.L/2)*S; dnLight(bx,by,24,'rgba(255,40,30,0.9)',0.8); }
      if(lit&&c.k!=='hop'&&c.k!=='flat'&&c.k!=='tank'&&c.k!=='loco') dnLight(P.x*S,P.y*S,c.L*S*0.55,'rgba(255,220,150,0.5)',0.5); }
    if(tr.pax){ const p=railCarPose(tr,tr.cars[0],head); if(DN.dark<0.05){ } } }
  // stations: waiting/boarding passengers
  for(const st of RAIL.stations){ const p0=railPt(st.s,5); if(!inV(p0[0],p0[1],st.len*S)) continue; railDrawPeds(st,t);
    if(DN.dark>0.05) for(let s=st.s-st.len/2+10;s<st.s+st.len/2;s+=25){ const p=railPt(s,6.8); dnLight(p[0]*S,p[1]*S,60,'rgba(255,230,170,0.6)',0.6); } }
  // level crossings: posts, red flashers, barrier arms
  for(const c of RAIL.cross){ if(c.over||!inV(c.mx,c.my,500)) continue; railDrawCrossing(c,t); }
  drawRailBridges(vx0,vy0,vx1,vy1); }
function railBlit(c,x,y,ang,lit){ const sp=railSprite(c,lit), S=PPM; ctx.save(); ctx.translate(x*S,y*S); ctx.rotate(ang);
  ctx.fillStyle='rgba(10,15,25,0.3)'; ctx.fillRect(-c.L*S/2+5,-sp.W/12*S/2*1+6,c.L*S,2.9*S); ctx.drawImage(sp.c,-c.L*S/2-2*S/sp.S,-2.9*S/2-2*S/sp.S,sp.c.width*S/sp.S,sp.c.height*S/sp.S); ctx.restore(); }
function railDrawPeds(st,t){ const S=PPM; let dw=null, trn=null; for(const tr of RAIL.trains){ if(!tr.pax) continue; const d=railDwelling(tr,t); if(d&&d.st===st){ dw=d; trn=tr; break; } }
  const N=st.kind==='hub'?18:st.kind==='city'?12:6, plat=railPlats(st)[0], wTrack=dw&&trn&&trn.plat&&st.kind==='hub'?RW_P+HUB_W:RW_P, platW=wTrack>RW_P?plat[1]-0.6:plat[0]+0.5;
  for(let i=0;i<N;i++){ const h=rlHash(st.s*31+i*7), h2=rlHash(st.s*17+i*13+5), sh=st.s+(h-0.5)*st.len*0.8, wHome=plat[0]+1.5+h2*(plat[1]-plat[0]-2);
    let s=sh, w=wHome; const boarding=i%2===0;
    if(dw){ const head=railHead(trn,t), doorS=head-trn.len*(0.1+0.8*h), ph=Math.max(0,Math.min(1,(dw.ph-0.1-h*0.25)*2.2));
      if(boarding){ s=sh+(doorS-sh)*ph; w=wHome+(platW-wHome)*ph; if(ph>=1) continue; }       // walks to a door then boards
      else { const pa=Math.max(0,Math.min(1,(dw.ph-0.05-h*0.2)*2.2)); if(pa<=0) continue; s=doorS+(sh-doorS)*pa; w=platW+(wHome-platW)*pa; } }   // alights and walks off
    else if(!boarding&&i%4) continue;
    const p=railPt(s,w); const col=['#d63b2f','#2e86de','#f5b82e','#27ae60','#8e44ad','#333','#e67e22'][i%7]; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(p[0]*S+2,p[1]*S+2,4.2,0,7); ctx.fill();
    ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(p[0]*S,p[1]*S,4.6,3.4,0,0,7); ctx.fill(); ctx.fillStyle=['#f1c27d','#8d5524','#e0ac69','#c68642'][i%4]; ctx.beginPath(); ctx.arc(p[0]*S,p[1]*S,2.4,0,7); ctx.fill(); } }
function railDrawCrossing(c,t){ const S=PPM, flash=c.lit?((t*1.6)%1<0.5?0:1):-1;
  for(const sd of [-1,1]){ const w=sd*6.6; const base=railPt(c.m+(sd>0?-1:1)*(c.half+0.6),w), tip=railPt(c.m+(sd>0?1:-1)*(c.half+0.6),w);
    // post + lamp housing (styled like the traffic lights)
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(base[0]*S-5+4,base[1]*S-5+5,10,10); ctx.fillStyle='#22252a'; ctx.fillRect(base[0]*S-5,base[1]*S-5,10,10); ctx.strokeStyle='#f2f2f2'; ctx.lineWidth=1; ctx.strokeRect(base[0]*S-5,base[1]*S-5,10,10);
    for(const k of [0,1]){ const on=flash===k; const lx=base[0]*S+(k?4:-4)*1, ly=base[1]*S+sd*7; ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(lx,ly,3.6,0,7); ctx.fill(); ctx.fillStyle=on?'#ff2a1a':'#4a1410'; ctx.beginPath(); ctx.arc(lx,ly,2.6,0,7); ctx.fill();
      if(on){ ctx.fillStyle='rgba(255,40,20,0.35)'; ctx.beginPath(); ctx.arc(lx,ly,9,0,7); ctx.fill(); dnLight(lx,ly,30,'rgba(255,40,20,0.95)',0.9); } }
    // arm: foreshortened when raised, full length when lowered; red/white bands
    const f=0.12+0.88*c.f, ex=base[0]+(tip[0]-base[0])*f, ey=base[1]+(tip[1]-base[1])*f, ang=Math.atan2(ey-base[1],ex-base[0]), len=Math.hypot(ex-base[0],ey-base[1])*S;
    ctx.save(); ctx.translate(base[0]*S,base[1]*S); ctx.rotate(ang); ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(4,-2+5,len,5); ctx.fillStyle='#fff'; ctx.fillRect(0,-2.5,len,5);
    ctx.fillStyle='#e0261b'; for(let x=0;x<len;x+=16) ctx.fillRect(x,-2.5,8,5); if(c.f>0.5){ ctx.fillStyle=flash>=0&&flash===1?'#ff3a2a':'#5a1a14'; for(let x=20;x<len;x+=40){ ctx.beginPath(); ctx.arc(x,0,1.8,0,7); ctx.fill(); } } ctx.restore(); } }
// ---------- maps
function railMinimap(){ if(!RAIL.ready||!MINIMAP) return; const g=MINIMAP.getContext('2d'); g.fillStyle='#4a3f38'; for(let s=0;s<RAIL.L;s+=2){ g.fillRect(Math.floor(RAIL.X[s]/M_T),Math.floor(RAIL.Y[s]/M_T),1,1); }
  g.fillStyle='#ffffff'; for(const st of RAIL.stations){ g.fillRect(Math.floor(RAIL.X[st.s]/M_T)-1,Math.floor(RAIL.Y[st.s]/M_T)-1,3,3); } }
function railBigMap(BX,BY,z,R){ R=R||5; if(!RAIL.ready) return; ctx.save(); ctx.lineWidth=Math.max(2,z*1.2); ctx.strokeStyle='rgba(40,30,25,0.9)'; ctx.setLineDash([]); ctx.beginPath(); for(let s=0;s<=RAIL.L;s+=8){ const i=s%RAIL.L, x=BX(RAIL.X[i]/M_T), y=BY(RAIL.Y[i]/M_T); s?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=Math.max(1,z*0.5); ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
  const t=railTime(); for(const tr of RAIL.trains){ const h=railHead(tr,t); ctx.fillStyle=tr.pax?'#4fd1ff':'#ff9f1a'; ctx.beginPath(); ctx.arc(BX(RAIL.X[Math.floor(h)]/M_T),BY(RAIL.Y[Math.floor(h)]/M_T),4,0,7); ctx.fill(); }
  for(const st of RAIL.stations){ const x=BX(RAIL.X[st.s]/M_T), y=BY(RAIL.Y[st.s]/M_T); ctx.fillStyle='#fff'; ctx.strokeStyle='#16335c'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,st.kind==='hub'?R:R*0.75,0,7); ctx.fill(); ctx.stroke(); if(R>=9){ ctx.fillStyle='#16335c'; ctx.font='bold '+Math.round(R*0.95)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(st.kind==='hub'?'H':'R',x,y+0.5); ctx.textBaseline='alphabetic'; }
    if(z>0.9) mapLabel('\u{1F686} '+st.name,x+R*0.75+4,y,'#d9ecff'); }
  ctx.restore(); }
