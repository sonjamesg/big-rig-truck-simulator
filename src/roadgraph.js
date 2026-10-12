'use strict';
// ===================== CURVY WORLD — stage 1: general spline road graph + lane graph =====================
// Units: tiles (4 m). A "line" is a designed road (polyline sampled ~1.5 tiles). Lines are planarised: every
// at-grade crossing / T-touch becomes a node, lines are split into edges between nodes. Motorways, flyovers and
// ramp mainline parts are grade-separated (level 1) and never intersect at-grade roads.
const RG_SPEC={ // lanes per direction, width (tiles), speed m/s, nav cost
  hwy:{lanes:3,w:7,v:31,c:0.5,lvl:1}, ramp:{lanes:1,w:2.6,v:18,c:0.7,lvl:1,oneway:true}, fly:{lanes:1,w:2.6,v:22,c:0.6,lvl:2,oneway:true},
  avenue:{lanes:2,w:4.6,v:15,c:0.85}, ring:{lanes:2,w:4.6,v:17,c:0.8}, street:{lanes:1,w:2.6,v:12,c:1.0}, rural:{lanes:1,w:2.4,v:18,c:0.9}, dirt:{lanes:1,w:2,v:9,c:2.4} };
function rgCR(C,step,closed){ // centripetal Catmull-Rom through C (closed loop optional)
  const P=closed?[C[C.length-1],...C,C[0],C[1]]:[[2*C[0][0]-C[1][0],2*C[0][1]-C[1][1]],...C,[2*C[C.length-1][0]-C[C.length-2][0],2*C[C.length-1][1]-C[C.length-2][1]]], out=[];
  for(let i=1;i<P.length-2;i++){ const P0=P[i-1],P1=P[i],P2=P[i+1],P3=P[i+2], tj=(a,b)=>Math.pow(Math.hypot(b[0]-a[0],b[1]-a[1])||1e-4,0.5);
    const t0=0,t1=tj(P0,P1),t2=t1+tj(P1,P2),t3=t2+tj(P2,P3), n=Math.max(1,Math.ceil(Math.hypot(P2[0]-P1[0],P2[1]-P1[1])/step));
    for(let k=0;k<n;k++){ const t=t1+(t2-t1)*k/n, L=(A,B,a,b)=>[(b-t)/(b-a)*A[0]+(t-a)/(b-a)*B[0],(b-t)/(b-a)*A[1]+(t-a)/(b-a)*B[1]];
      const A1=L(P0,P1,t0,t1),A2=L(P1,P2,t1,t2),A3=L(P2,P3,t2,t3); out.push(L(L(A1,A2,t0,t2),L(A2,A3,t1,t3),t1,t2)); } }
  out.push(closed?C[0].slice():C[C.length-1].slice()); return out; }
function rgResample(pts,step){ const out=[pts[0].slice()]; let acc=0; for(let i=1;i<pts.length;i++){ let a=pts[i-1]; const b=pts[i]; let d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    while(acc+d>=step){ const t=(step-acc)/d; a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]; out.push(a); d=Math.hypot(b[0]-a[0],b[1]-a[1]); acc=0; } acc+=d; }
  const L=pts[pts.length-1]; if(Math.hypot(L[0]-out[out.length-1][0],L[1]-out[out.length-1][1])>step*0.3) out.push(L.slice()); else out[out.length-1]=L.slice(); return out; }
function rgSegX(a,b,c,d){ const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-9) return null;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; return (t>=0&&t<=1&&u>=0&&u<=1)?[t,u]:null; }
function rgCurvature(p){ let rmin=1e9; for(let i=2;i<p.length-2;i++){ const a=p[i-2],b=p[i],c=p[i+2]; const A2=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])); if(A2<1e-6) continue;
    const r=Math.hypot(b[0]-a[0],b[1]-a[1])*Math.hypot(c[0]-b[0],c[1]-b[1])*Math.hypot(c[0]-a[0],c[1]-a[1])/(2*A2); if(r<rmin) rmin=r; } return rmin; }

function buildRoadGraph(opt){ opt=opt||{}; const t0=performance.now(); const R=mulberry(opt.seed||20261012), water=world.water;
  const wet=(x,y)=>{ x|=0; y|=0; return x<0||y<0||x>=MW||y>=MH||water[y*MW+x]===1; };
  const lines=[]; const addLine=(type,ctrl,o)=>{ o=o||{}; let pts=o.raw?ctrl:rgCR(ctrl,0.75,!!o.closed); pts=rgResample(pts,1.5);
    if(o.clipWater){ // keep the longest dry run (city streets stop at the shore)
      const runs=[[]]; for(const p of pts){ if(wet(p[0],p[1])){ if(runs[runs.length-1].length) runs.push([]); } else runs[runs.length-1].push(p); }
      pts=runs.sort((a,b)=>b.length-a.length)[0]; if(!pts||pts.length<4) return null; }
    const L={id:lines.length,type,pts,closed:!!o.closed&&!o.clipWater,name:o.name||'',lvl:o.lvl!==undefined?o.lvl:(RG_SPEC[type].lvl||0),oneway:!!(o.oneway||RG_SPEC[type].oneway),cuts:[],tag:o.tag}; lines.push(L); return L; };
  const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  const cities=[], towns=[];
  // ---------- organic city: wobbly inner + outer ring, curved radial avenues, one rotated grid district, a diagonal boulevard, parks
  function city(name,cx,cy,Rout,opts){ opts=opts||{}; const c={name,cx,cy,R:Rout,parks:[],districts:[]}; cities.push(c);
    const ring=(r,n,amp)=>{ const C=[]; const ph=R()*6.28; for(let k=0;k<n;k++){ const a=k/n*6.283+ph, rr=r*(1+amp*Math.sin(a*2+ph)+amp*0.6*Math.sin(a*3+1)); C.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]); } return C; };
    addLine('ring',ring(Rout,14,0.1),{closed:true,clipWater:true,name:name+' Ring Road'}); addLine('avenue',ring(Rout*0.48,10,0.12),{closed:true,clipWater:true,name:name+' Circus'}); addLine('avenue',ring(Rout*0.17,7,0.05),{closed:true,clipWater:true,name:name+' Plaza'});
    const nsp=opts.spokes||7, ph=R()*6.28; for(let k=0;k<nsp;k++){ const a=ph+k/nsp*6.283+(R()-0.5)*0.35, bend=(R()-0.5)*0.5; const C=[];
      for(let s=0;s<=4;s++){ const r=Rout*(0.17+s*0.24), aa=a+bend*Math.sin(s/4*3.14); C.push([cx+Math.cos(aa)*r,cy+Math.sin(aa)*r]); } addLine('avenue',C,{clipWater:true,name:name+' Avenue '+(k+1)}); }
    // diagonal boulevard straight across the centre at an odd angle (creates angled junctions with everything)
    { const a=R()*3.14; addLine('avenue',[[cx-Math.cos(a)*Rout*1.05,cy-Math.sin(a)*Rout*1.05],[cx+Math.cos(a)*Rout*1.05,cy+Math.sin(a)*Rout*1.05]],{clipWater:true,name:name+' Boulevard'}); }
    // grid district in one sector, rotated
    { const a=ph+0.5*6.283/nsp, dc=[cx+Math.cos(a)*Rout*0.72,cy+Math.sin(a)*Rout*0.72], g=opts.gridAng!==undefined?opts.gridAng:R()*1.2-0.6, hs=Rout*0.3, p=13+R()*4;
      c.districts.push({x:dc[0],y:dc[1],ang:g,hs});
      for(let u=-hs;u<=hs+0.1;u+=p){ const A=rot(u,-hs,g),B=rot(u,hs,g); addLine('street',[[dc[0]+A[0],dc[1]+A[1]],[dc[0]+B[0],dc[1]+B[1]]],{raw:true,clipWater:true,tag:'grid'}); }
      for(let u=-hs;u<=hs+0.1;u+=p){ const A=rot(-hs,u,g),B=rot(hs,u,g); addLine('street',[[dc[0]+A[0],dc[1]+A[1]],[dc[0]+B[0],dc[1]+B[1]]],{raw:true,clipWater:true,tag:'grid'}); } }
    // organic side streets: short curvy streets between spokes
    for(let k=0;k<(opts.streets||16);k++){ const a=R()*6.283, da=(R()-0.5)*0.9, inner=R()<0.5, r0=Rout*(inner?0.15:0.46), r1=Rout*(inner?0.5:1.02), C=[];
      for(let q=0;q<=4;q++){ const t=q/4, rr=r0+(r1-r0)*t, aa=a+da*t+Math.sin(t*3.14)*(R()-0.5)*0.25; C.push([cx+Math.cos(aa)*rr,cy+Math.sin(aa)*rr]); }
      addLine('street',C,{clipWater:true}); }
    for(let k=0;k<3;k++){ const a=R()*6.283, r=Rout*(0.25+R()*0.5); c.parks.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,r:8+R()*10}); }
    return c; }
  function town(name,cx,cy,r){ const t={name,cx,cy,R:r}; towns.push(t); const C=[]; const ph=R()*6; for(let k=0;k<9;k++){ const a=k/9*6.283+ph; C.push([cx+Math.cos(a)*r*(1+0.15*Math.sin(a*3)),cy+Math.sin(a)*r*(1+0.15*Math.sin(a*3))]); }
    addLine('avenue',C,{closed:true,clipWater:true,name:name+' Loop'});
    for(let k=0;k<4;k++){ const a=ph+k*1.57+(R()-0.5)*0.4; addLine('street',[[cx,cy],[cx+Math.cos(a)*r*0.6,cy+Math.sin(a)*r*0.6+(R()-0.5)*6],[cx+Math.cos(a)*r*1.35,cy+Math.sin(a)*r*1.35]],{clipWater:true}); }
    return t; }
  city('Port Albion',300,300,150,{spokes:8,streets:22}); city('Sandvale',1620,330,165,{spokes:7,streets:22}); city('Kingsbridge',1590,1600,170,{spokes:8,streets:24});
  town('Millford',300,840,46); town('Dustwater',1040,460,40); town('Coppermine',1630,640,38); town('Redhill',1030,1210,46); town('Fenwick',1540,1160,40); town('Ashby',270,1130,34);
  // ---------- motorways: fully curved
  const M1=addLine('hwy',[[150,105],[700,92],[1300,118],[1900,150],[1950,700],[1925,1300],[1900,1935],[1200,1950],[600,1925],[118,1900],[95,1300],[110,700]],{closed:true,name:'M1'});
  const M2=addLine('hwy',[[230,985],[600,1030],[900,1065],[1220,990],[1290,760],[1700,705]],{name:'M2'});
  const M3=addLine('hwy',[[920,1800],[960,1560],[1180,1400],[1380,1330]],{name:'M3'});
  // ---------- connectors (at grade) from towns/cities to the motorway, crossing it at an interchange
  const nearestOn=(L,x,y)=>{ let bi=0,bd=1e18; L.pts.forEach((p,i)=>{ const d=(p[0]-x)**2+(p[1]-y)**2; if(d<bd){ bd=d; bi=i; } }); return bi; };
  const inter=[];
  function interchange(L,i,kind,name){ const P=L.pts, n=P.length, a=P[(i-6+n)%n], b=P[(i+6)%n], p=P[i]; let tx=b[0]-a[0], ty=b[1]-a[1]; const l=Math.hypot(tx,ty); tx/=l; ty/=l; const nx=-ty, ny=tx;
    const X={kind,x:p[0],y:p[1],t:[tx,ty],n:[nx,ny],line:L.id,name}; inter.push(X);
    // crossing road (at grade, passes over/under the motorway)
    const S=36; const cross=addLine('rural',[[p[0]-nx*S*1.6,p[1]-ny*S*1.6],[p[0]+nx*S*1.6,p[1]+ny*S*1.6]],{raw:true,name:name+' Link'}); X.cross=cross.id;
    // drive on the left: travel +t has its nearside on the -n side... (left of travel (tx,ty) in screen coords is (ty,-tx)= -n)
    for(const dir of [1,-1]){ const side=-dir;  // nearside for this carriageway
      const T=[tx*dir,ty*dir], N=[nx*side,ny*side], D=dir>0?24:31, off=12;
      // off-slip: diverge from mainline D before the bridge, run parallel then bend into the cross road
      const offR=[[p[0]-T[0]*D+N[0]*4.5,p[1]-T[1]*D+N[1]*4.5],[p[0]-T[0]*D*0.55+N[0]*8,p[1]-T[1]*D*0.55+N[1]*8],[p[0]-T[0]*off*0.35+N[0]*off*1.15,p[1]-T[1]*off*0.35+N[1]*off*1.15],[p[0]+N[0]*off*1.5,p[1]+N[1]*off*1.5]];
      const onR=[[p[0]+N[0]*off*1.5,p[1]+N[1]*off*1.5],[p[0]+T[0]*off*0.35+N[0]*off*1.15,p[1]+T[1]*off*0.35+N[1]*off*1.15],[p[0]+T[0]*D*0.55+N[0]*8,p[1]+T[1]*D*0.55+N[1]*8],[p[0]+T[0]*D+N[0]*4.5,p[1]+T[1]*D+N[1]*4.5]];
      // the slip's end nearest the cross road is at-grade (level 0); the mainline end joins the motorway (merge/diverge)
      const o=addLine('ramp',offR,{lvl:0,oneway:true,name:name+' off-slip',tag:{join:'diverge',L:L.id,end:0}}), on=addLine('ramp',onR,{lvl:0,oneway:true,name:name+' on-slip',tag:{join:'merge',L:L.id,end:1}});
      if(kind==='cloverleaf'){ // loop ramp in the quadrant after the bridge: turn across without crossing traffic (left-hand traffic → loops serve right turns)
        const Q=[p[0]+T[0]*15+N[0]*-15,p[1]+T[1]*15+N[1]*-15], C=[]; for(let k=0;k<=10;k++){ const ang=Math.atan2(-N[1],-N[0])+Math.PI+k/10*Math.PI*1.5; C.push([Q[0]+Math.cos(ang)*11,Q[1]+Math.sin(ang)*11]); }
        X.loops=(X.loops||0)+1; addLine('ramp',C,{lvl:0,oneway:true,name:name+' loop',tag:'loop'}); } } }
  const cityLink=(c,L,kind)=>{ const i=nearestOn(L,c.cx,c.cy); interchange(L,i,kind,c.name); const X=inter[inter.length-1], S=36*1.6; const sd=((c.cx-X.x)*X.n[0]+(c.cy-X.y)*X.n[1])>0?1:-1; const p=[X.x+X.n[0]*S*sd,X.y+X.n[1]*S*sd];
    addLine('avenue',[[c.cx,c.cy],[(c.cx+p[0])/2+(R()-0.5)*30,(c.cy+p[1])/2+(R()-0.5)*30],p],{name:c.name+' Road'}); };
  cityLink(cities[0],M1,'cloverleaf'); cityLink(cities[1],M1,'cloverleaf'); cityLink(cities[2],M1,'cloverleaf');
  for(const t of towns){ const L=[M1,M2,M3].sort((a,b)=>{ const pa=a.pts[nearestOn(a,t.cx,t.cy)], pb=b.pts[nearestOn(b,t.cx,t.cy)]; return Math.hypot(pa[0]-t.cx,pa[1]-t.cy)-Math.hypot(pb[0]-t.cx,pb[1]-t.cy); })[0]; cityLink(t,L,'diamond'); }
  // motorway-to-motorway: directional flyovers ("stack") where M2/M3 meet M1
  for(const [L,end] of [[M2,0],[M2,1],[M3,0]]){ const e=end?L.pts[L.pts.length-1]:L.pts[0]; const i=nearestOn(M1,e[0],e[1]); const q=M1.pts[i]; const S={kind:'stack',x:q[0],y:q[1],line:M1.id,name:L.name+'/M1'}; inter.push(S);
    // join the end of the spur into M1 with two flyovers (one each way) and mark the spur end as a fork
    const a=M1.pts[(i-14+M1.pts.length)%M1.pts.length], b=M1.pts[(i+14)%M1.pts.length];
    addLine('fly',[e,[(e[0]+q[0]*2)/3+6,(e[1]+q[1]*2)/3+6],a],{name:L.name+' to M1 (A)'}); addLine('fly',[b,[(e[0]+q[0]*2)/3-6,(e[1]+q[1]*2)/3-6],e],{name:'M1 to '+L.name+' (B)'}); }
  // ---------- rural: coast road, Greyfell Pass hairpins, dam road, dirt tracks (re-expressed as lines)
  addLine('rural',[[600,462],[700,520],[695,600],[680,700],[640,790],[560,880],[520,900]],{name:'Sound Coast Road'});
  addLine('rural',[[300,1600],[350,1612],[392,1640],[346,1676],[404,1710],[352,1748],[414,1786],[362,1826],[420,1872],[430,1915]],{name:'Greyfell Pass'});
  addLine('rural',[[960,1590],[1060,1610],[1130,1589],[1210,1589],[1300,1570],[1420,1600]],{name:'Dam Road',tag:'dam'});
  addLine('dirt',[[1040,500],[1090,560],[1160,600]],{name:'Quarry Track'}); addLine('dirt',[[1580,1190],[1700,1220],[1790,1290]],{name:'Fen Forest Track'});
  // rural links between towns
  const links=[[300,840,270,1130],[1040,460,1030,1210],[1030,1210,1540,1160],[1540,1160,1630,640],[300,840,520,900]];
  for(const [a,b,c,d] of links){ addLine('rural',[[a,b],[(a+c)/2+(R()-0.5)*90,(b+d)/2+(R()-0.5)*90],[c,d]],{name:'B-road'}); }

  // ================= planarise =================
  const CELL=12, hash=new Map(), key=(x,y)=>((x/CELL)|0)*4096+((y/CELL)|0);
  for(const L of lines){ L.cuts=[]; for(let i=0;i<L.pts.length-1;i++){ const a=L.pts[i],b=L.pts[i+1]; const ks=new Set([key(a[0],a[1]),key(b[0],b[1])]); for(const k of ks){ let arr=hash.get(k); if(!arr) hash.set(k,arr=[]); arr.push([L.id,i]); } } }
  const pts=[]; const addCut=(L,i,t,P)=>{ L.cuts.push({s:i+t,P}); };
  const sameLvl=(A,B)=>A.lvl===B.lvl&&A.lvl===0;
  for(const [k,arr] of hash) for(let x=0;x<arr.length;x++) for(let y=x+1;y<arr.length;y++){ const [la,ia]=arr[x],[lb,ib]=arr[y]; if(la===lb&&Math.abs(ia-ib)<3) continue; const A=lines[la],B=lines[lb]; if(!sameLvl(A,B)) continue;
    const r=rgSegX(A.pts[ia],A.pts[ia+1],B.pts[ib],B.pts[ib+1]); if(!r) continue; const P=[A.pts[ia][0]+(A.pts[ia+1][0]-A.pts[ia][0])*r[0],A.pts[ia][1]+(A.pts[ia+1][1]-A.pts[ia][1])*r[0]];
    const kk=Math.round(P[0]*4)+','+Math.round(P[1]*4)+','+la+','+lb; if(pts.indexOf(kk)>=0) continue; pts.push(kk); addCut(A,ia,r[0],P); addCut(B,ib,r[1],P); }
  // T-touches: open line ends within 5 tiles of another at-grade line snap onto it
  for(const L of lines){ if(L.closed) continue; for(const end of [0,1]){ const e=end?L.pts[L.pts.length-1]:L.pts[0]; let best=null,bd=5;
      for(const M of lines){ if(M===L||!sameLvl(L,M)) continue; for(let i=0;i<M.pts.length-1;i++){ const a=M.pts[i],b=M.pts[i+1]; const dx=b[0]-a[0],dy=b[1]-a[1],ll=dx*dx+dy*dy||1; let t=((e[0]-a[0])*dx+(e[1]-a[1])*dy)/ll; t=Math.max(0,Math.min(1,t)); const q=[a[0]+dx*t,a[1]+dy*t], d=Math.hypot(q[0]-e[0],q[1]-e[1]); if(d<bd){ bd=d; best=[M,i,t,q]; } } }
      if(best){ const [M,i,t,q]=best; addCut(M,i,t,q); if(end) L.pts[L.pts.length-1]=q.slice(); else L.pts[0]=q.slice(); L.cuts.push({s:end?L.pts.length-1:0,P:q}); } } }
  // ramps & flyovers joining the motorway: diverge/merge nodes on the mainline
  for(const L of lines){ const tg=L.tag; let ends=[]; if(tg&&tg.join){ ends=[[tg.end, lines[tg.L]]]; } else if(L.type==='fly') ends=[[0,M1],[1,M1]];
    for(let [end,M] of ends){ const e=end?L.pts[L.pts.length-1]:L.pts[0]; let bi=0,bd=1e18; for(let i=0;i<M.pts.length-1;i++){ const d=(M.pts[i][0]-e[0])**2+(M.pts[i][1]-e[1])**2; if(d<bd){ bd=d; bi=i; } }
      if(L.type==='fly'){ for(const N of [M2,M3]){ for(let i=0;i<N.pts.length-1;i++){ const d=(N.pts[i][0]-e[0])**2+(N.pts[i][1]-e[1])**2; if(d<bd){ bd=d; bi=-1; M=N; } } } if(bi<0){ const N=M; let j=0,dj=1e18; for(let i=0;i<N.pts.length;i++){ const d=(N.pts[i][0]-e[0])**2+(N.pts[i][1]-e[1])**2; if(d<dj){ dj=d; j=i; } } bi=Math.min(j,N.pts.length-2); M=N; } }
      const q=M.pts[bi]; addCut(M,bi,0,q); L.cuts.push({s:end?L.pts.length-1:0,P:q,join:end?'merge':'diverge'}); if(end) L.pts[L.pts.length-1]=q.slice(); else L.pts[0]=q.slice(); } }
  // nodes: merge cut points within 3 tiles
  const nodes=[], ng=new Map(); const nodeAt=(P,kind)=>{ const gx=Math.round(P[0]/3), gy=Math.round(P[1]/3); for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){ const a=ng.get((gx+dx)*8192+gy+dy); if(a) for(const n of a) if(Math.hypot(n.x-P[0],n.y-P[1])<2&&(!kind||!n.kind||n.kind===kind)){ if(kind&&!n.kind) n.kind=kind; return n; } }
    const n={id:nodes.length,x:P[0],y:P[1],out:[],inn:[],kind:kind||''}; nodes.push(n); const k=gx*8192+gy; if(!ng.has(k)) ng.set(k,[]); ng.get(k).push(n); return n; };
  const edges=[];
  for(const L of lines){ const n=L.pts.length; const cuts=L.cuts.slice(); if(!L.closed){ cuts.push({s:0,P:L.pts[0]}); cuts.push({s:n-1,P:L.pts[n-1]}); } cuts.sort((a,b)=>a.s-b.s);
    const cn=cuts.map(c=>nodeAt(c.P,c.join||'')); if(L.closed&&cuts.length===0) continue;
    const seq=L.closed?[...cuts.map((c,i)=>[c,cn[i]]),[{s:cuts[0].s+n-1,P:cuts[0].P},cn[0]]]:cuts.map((c,i)=>[c,cn[i]]);
    for(let k=0;k<seq.length-1;k++){ const [ca,na]=seq[k],[cb,nb]=seq[k+1]; if(na===nb&&cb.s-ca.s<3) continue; const P=[[na.x,na.y]];
      for(let s=Math.floor(ca.s)+1;s<=Math.ceil(cb.s)-1;s++) P.push(L.pts[((s%(n-1))+(n-1))%(n-1)]); P.push([nb.x,nb.y]); let len=0; for(let i=1;i<P.length;i++) len+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
      if(len<1.2) continue; const sp=RG_SPEC[L.type]; const e={id:edges.length,a:na.id,b:nb.id,pts:P,len,type:L.type,line:L.id,name:L.name,lvl:L.lvl,oneway:L.oneway,lanes:sp.lanes,w:sp.w,rmin:rgCurvature(P),tag:L.tag};
      edges.push(e); na.out.push(e.id); nb.inn.push(e.id); if(!e.oneway){ na.inn.push(e.id); nb.out.push(e.id); } } }
  // prune short dead-end stubs (overshoots past a crossing), repeat until stable
  for(let it=0;it<4;it++){ const deg=new Map(); for(const e of edges){ if(e.dead) continue; for(const n of [e.a,e.b]) deg.set(n,(deg.get(n)||0)+1); }
    let ch=0; for(const e of edges){ if(e.dead) continue; if(e.len<9&&(deg.get(e.a)===1||deg.get(e.b)===1)&&e.type!=='ramp'&&e.type!=='fly'){ e.dead=true; ch++; } } if(!ch) break; }
  { const keep=edges.filter(e=>!e.dead); keep.forEach((e,i)=>e.id=i); edges.length=0; edges.push(...keep); for(const n of nodes){ n.out=[]; n.inn=[]; } for(const e of edges){ nodes[e.a].out.push(e.id); nodes[e.b].inn.push(e.id); if(!e.oneway){ nodes[e.a].inn.push(e.id); nodes[e.b].out.push(e.id); } } }
  // ================= lane graph: per node, every (in edge, direction) → allowed (out edge, direction) with a turn class
  const dirAt=(e,atNode,leaving)=>{ const P=e.pts, fromA=e.a===atNode; const i0=fromA?0:P.length-1, i1=fromA?Math.min(P.length-1,3):Math.max(0,P.length-4); let dx=P[i1][0]-P[i0][0], dy=P[i1][1]-P[i0][1]; if(!leaving){ dx=-dx; dy=-dy; } const l=Math.hypot(dx,dy)||1; return [dx/l,dy/l]; };
  const conns=[]; for(const N of nodes){ N.moves=[]; const ins=[], outs=[];
    for(const id of N.inn){ const e=edges[id]; if(e.b===N.id) ins.push({e,d:1}); if(!e.oneway&&e.a===N.id) ins.push({e,d:-1}); }
    for(const id of N.out){ const e=edges[id]; if(e.a===N.id) outs.push({e,d:1}); if(!e.oneway&&e.b===N.id) outs.push({e,d:-1}); }
    for(const I of ins){ const vin=dirAt(I.e,N.id,false); for(const O of outs){ if(O.e===I.e&&O.d===-I.d) continue; const vo=dirAt(O.e,N.id,true); const cr=vin[0]*vo[1]-vin[1]*vo[0], dt=vin[0]*vo[0]+vin[1]*vo[1];
        const turn= dt>0.7?'S' : cr<0?'L':'R'; // screen coords (y down): cross<0 → turning left
        const m={node:N.id,from:I.e.id,fd:I.d,to:O.e.id,td:O.d,turn,ang:Math.atan2(cr,dt)}; N.moves.push(m); conns.push(m); } }
    N.deg=new Set([...N.inn,...N.out]).size; }
  { const used=nodes.filter(n=>n.deg>0); }
  const G={nodes,edges,lines,conns,inter,cities,towns,ms:performance.now()-t0}; world.rg=G; return G; }

// ---------- map renderer straight from the graph geometry (used by the stage-1 preview; stage 2 hooks it into the world map)
const RG_COL={hwy:['#3b2b12','#f0a830'],fly:['#3b2b12','#f6c050'],ramp:['#3b2b12','#e8b048'],ring:['#222','#f4f1e6'],avenue:['#222','#ffffff'],street:['#333','#d9d6cc'],rural:['#333','#efe3c2'],dirt:['#5a4630','#b8956a']};
function rgDrawMap(g,G,X,Y,z,opt){ opt=opt||{}; const ord=['dirt','street','rural','avenue','ring','ramp','hwy','fly'];
  for(const pass of [0,1]) for(const ty of ord) for(const e of G.edges){ if(e.type!==ty) continue; const w=Math.max(pass?1:2.2,(RG_SPEC[ty].w*z)*(pass?1:1.0)+(pass?0:2.2)); g.strokeStyle=RG_COL[ty][pass]; g.lineWidth=w; g.lineCap='round'; g.lineJoin='round'; g.beginPath(); e.pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1]))); g.stroke(); }
  if(opt.nodes) for(const n of G.nodes){ if(n.deg<3&&!n.kind) continue; g.fillStyle=n.kind==='merge'?'#3ddc84':n.kind==='diverge'?'#ff5a5a':'#4fa3ff'; g.beginPath(); g.arc(X(n.x),Y(n.y),Math.max(1.5,z*1.1),0,7); g.fill(); }
  if(opt.labels){ g.font='bold 13px system-ui'; g.textAlign='center'; for(const c of [...G.cities,...G.towns]){ g.lineWidth=3; g.strokeStyle='#000'; g.strokeText(c.name,X(c.cx),Y(c.cy)); g.fillStyle='#fff'; g.fillText(c.name,X(c.cx),Y(c.cy)); }
    for(const I of G.inter){ g.fillStyle=I.kind==='stack'?'#ff3df0':I.kind==='cloverleaf'?'#ffd23f':'#7fdcff'; g.fillRect(X(I.x)-3,Y(I.y)-3,6,6); } } }
// ---------- graph checks (stage 1)
function rgStats(G){ const N=G.nodes,E=G.edges; const deg={}; for(const n of N){ deg[n.deg]=(deg[n.deg]||0)+1; }
  // directed reachability over the lane graph from a big ring-road node (allowing U-turn at dead ends)
  const adj=new Map(); const k=(e,d)=>e*2+(d>0?0:1); for(const m of G.conns){ const a=k(m.from,m.fd); if(!adj.has(a)) adj.set(a,[]); adj.get(a).push(k(m.to,m.td)); }
  for(const e of E) if(!e.oneway){ for(const d of [1,-1]){ const end=d>0?N[e.b]:N[e.a]; if(end.deg===1){ const a=k(e.id,d); if(!adj.has(a)) adj.set(a,[]); adj.get(a).push(k(e.id,-d)); } } }
  const start=E.findIndex(e=>e.type==='ring'); const seen=new Set([k(start,1)]), q=[k(start,1)]; while(q.length){ const a=q.pop(); for(const b of adj.get(a)||[]) if(!seen.has(b)){ seen.add(b); q.push(b); } }
  let total=0, reach=0; for(const e of E){ for(const d of (e.oneway?[1]:[1,-1])){ total++; if(seen.has(k(e.id,d))) reach++; } }
  const angled=N.filter(n=>{ if(n.deg<3) return false; const ang=[]; for(const id of new Set([...n.inn,...n.out])){ const e=E[id]; const P=e.pts, fromA=e.a===n.id; const p=fromA?P[Math.min(2,P.length-1)]:P[Math.max(0,P.length-3)]; ang.push(Math.atan2(p[1]-n.y,p[0]-n.x)); }
    return ang.some((a,i)=>ang.some((b,j)=>{ if(i>=j) return false; const d=Math.abs(((a-b)%Math.PI+Math.PI)%Math.PI); return Math.abs(d-Math.PI/2)>0.35&&d>0.35&&d<Math.PI-0.35; })); }).length;
  const onCurve=N.filter(n=>n.deg>=3&&[...new Set([...n.inn,...n.out])].some(id=>E[id].rmin<40&&E[id].type!=='street')).length;
  const hw=E.filter(e=>e.type==='hwy'); const hwyRmin=Math.min(...hw.map(e=>e.rmin));
  return {nodes:N.length,edges:E.length,laneConns:G.conns.length,degree:deg,reachableDirectedEdges:reach+'/'+total,angledJunctions:angled,junctionsOnCurves:onCurve,
    interchanges:G.inter.reduce((a,i)=>(a[i.kind]=(a[i.kind]||0)+1,a),{}),mergeNodes:N.filter(n=>n.kind==='merge').length,divergeNodes:N.filter(n=>n.kind==='diverge').length,motorwayMinRadius_m:Math.round(hwyRmin*M_T),km:Math.round(E.reduce((s,e)=>s+e.len,0)*M_T/1000),buildMs:Math.round(G.ms)}; }
