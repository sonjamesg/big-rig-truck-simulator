// ===================== v2 road graph: planarise at-grade crossings, T-junctions, merges, roundabouts -> nodes / pieces =====================
const AG=e=>e.type!=='hwy'&&e.type!=='ramp';
function segX(a,b,c,d){ const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-9) return null; const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; return (t>=0&&t<=1&&u>=0&&u<=1)?[t,u]:null; }
function nearSeg(p,a,b){ const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy||1; let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L; t=Math.max(0,Math.min(1,t)); const q=[a[0]+dx*t,a[1]+dy*t]; return [Math.hypot(p[0]-q[0],p[1]-q[1]),t,q]; }
function planarise(E,RBS){
  // 1. cut out roundabout interiors (pieces ending at the ring join the roundabout node)
  let E1=[]; for(const e of E){ let run=[]; const push=()=>{ if(run.length>1) E1.push(Object.assign({},e,{pts:run})); run=[]; };
    for(const p of e.pts){ const r=RBS.find(r=>Math.hypot(p[0]-r.rb[0],p[1]-r.rb[1])<r.rb[2]+2.2+0.6); if(r&&e.type!=='hwy') push(); else run.push(p); } push(); }
  E=E1;
  // connect dangling ends (suburb spines, clipped district streets, country roads stopping short) to the nearest road within 24 tiles
  { const C0=6, H0=new Map(); E.forEach((e,ei)=>{ if(!AG(e)) return; e.pts.forEach((q,k)=>{ const kk=((q[0]/C0)|0)*100000+((q[1]/C0)|0); if(!H0.has(kk)) H0.set(kk,[]); H0.get(kk).push([ei,k]); }); });
    const add=[]; E.forEach((e,ei)=>{ if(!AG(e)||e.type==='dirt') return; for(const end of [0,1]){ if(end===1&&e.bulb) continue; const p=end?e.pts[e.pts.length-1]:e.pts[0]; let near=false, best=null;
        for(let cx=((p[0]-24)/C0)|0;cx<=((p[0]+24)/C0|0);cx++) for(let cy=((p[1]-24)/C0)|0;cy<=((p[1]+24)/C0|0);cy++){ const L2=H0.get(cx*100000+cy); if(!L2) continue; for(const [eo,k] of L2){ if(eo===ei){ continue; } const q=E[eo].pts[k], d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(d<Math.max(2.5,E[eo].w/2+1)) near=true; if(!best||d<best.d) best={d,q,eo}; } }
        if(near||!best||best.d>24) continue; const n=Math.ceil(best.d/0.5), pts=[]; for(let k=0;k<=n;k++) pts.push([p[0]+(best.q[0]-p[0])*k/n,p[1]+(best.q[1]-p[1])*k/n]); add.push({type:e.type==='res'?'res':e.type==='rural'?'rural':'town',w:Math.min(e.w,4),pts,name:e.name,cls:'link',dist:e.dist}); } });
    for(const a of add) E.push(a); }
  // segment hash
  const C=8, H=new Map(), key=(x,y)=>((x/C)|0)*100000+((y/C)|0);
  E.forEach((e,ei)=>{ for(let k=0;k<e.pts.length-1;k++){ const a=e.pts[k],b=e.pts[k+1]; const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
    for(let cx=(x0/C)|0;cx<=(x1/C|0);cx++) for(let cy=(y0/C)|0;cy<=(y1/C|0);cy++){ const kk=cx*100000+cy; let L2=H.get(kk); if(!L2){ L2=[]; H.set(kk,L2); } L2.push([ei,k]); } } });
  const cuts=E.map(()=>[]), decks=E.map(()=>[]);
  // 2. crossings: at-grade pairs split, grade-separated pairs get a bridge deck on the upper road
  const seen=new Set(); const ord={dirt:0,res:1,rural:2,town:3,city:4,dual:5,hwy:6,ramp:7};
  for(const L2 of H.values()) for(let i=0;i<L2.length;i++) for(let j=i+1;j<L2.length;j++){ const [ea,ka]=L2[i],[eb,kb]=L2[j]; if(ea===eb) continue; const sk=ea<eb?ea+':'+ka+':'+eb+':'+kb:eb+':'+kb+':'+ea+':'+ka; if(seen.has(sk)) continue; seen.add(sk);
    const A=E[ea],B=E[eb], X=segX(A.pts[ka],A.pts[ka+1],B.pts[kb],B.pts[kb+1]); if(!X) continue;
    const pa=ka+X[0], pb=kb+X[1], endA=pa<0.6||pa>A.pts.length-1.6, endB=pb<0.6||pb>B.pts.length-1.6; if(endA&&endB) continue;
    if(AG(A)&&AG(B)){ cuts[ea].push(pa); cuts[eb].push(pb); continue; }
    // grade separated: ramps over everything except their own motorway ends; minor roads over motorways; later motorway over earlier
    if(endA||endB) continue; let up=(A.type==='ramp'&&A.fly)?ea:(B.type==='ramp'&&B.fly)?eb:(A.type==='hwy'&&B.type==='hwy')?Math.max(ea,eb):(A.type==='hwy'?eb:B.type==='hwy'?ea:(A.type==='ramp'?ea:eb));
    const dn=up===ea?eb:ea, pu=up===ea?pa:pb; decks[up].push([pu,E[dn].w]); }
  // 3. T-junctions & merges: an end lying on another road's interior splits that road there
  const ends=[]; E.forEach((e,ei)=>{ for(const end of [0,1]){ const p=end?e.pts[e.pts.length-1]:e.pts[0]; let best=null;
      for(let cx=((p[0]-6)/C)|0;cx<=((p[0]+6)/C|0);cx++) for(let cy=((p[1]-6)/C)|0;cy<=((p[1]+6)/C|0);cy++){ const L2=H.get(cx*100000+cy); if(!L2) continue; for(const [eo,ko] of L2){ if(eo===ei) continue; const O=E[eo];
        if(AG(e)!==AG(O)&&e.type!=='ramp') continue; if(e.type==='ramp'&&O.type==='ramp') continue;
        const [d,t,q]=nearSeg(p,O.pts[ko],O.pts[ko+1]), lim=e.type==='ramp'?O.w/2+1.6:Math.max(1.4,O.w/2+0.6); if(d>lim) continue; const po=ko+t; if(po<0.6||po>O.pts.length-1.6) continue; if(!best||d<best.d) best={d,eo,po,q}; } }
      if(best){ cuts[best.eo].push(best.po); ends.push([ei,end,best.q,best.eo]); } } });
  for(const [ei,end,q,eo] of ends){ const e=E[ei]; if(e.type==='ramp') continue; if(end) e.pts[e.pts.length-1]=q.slice(); else e.pts[0]=q.slice(); }
  // 4. split into pieces
  const P=[]; E.forEach((e,ei)=>{ const cs=[...new Set(cuts[ei].map(c=>Math.round(c*100)/100))].sort((a,b)=>a-b).filter(c=>c>0.3&&c<e.pts.length-1.3); const at=c=>{ const k=Math.floor(c),t=c-k,a=e.pts[k],b=e.pts[Math.min(e.pts.length-1,k+1)]; return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]; };
    let prev=0, prevPt=e.pts[0]; const dk=decks[ei];
    for(const c of [...cs,e.pts.length-1]){ const pts=[prevPt]; for(let k=Math.ceil(prev+1e-6);k<c;k++) pts.push(e.pts[k]); const end=c===e.pts.length-1?e.pts[e.pts.length-1]:at(c); pts.push(end);
      if(pts.length>1&&Math.hypot(end[0]-prevPt[0],end[1]-prevPt[1])>0.4){ const pc=Object.assign({},e,{pts,src:ei,decks:dk.filter(([p])=>p>=prev&&p<=c).map(([p,w])=>[(p-prev),w])}); P.push(pc); }
      prev=c; prevPt=end; } });
  // 5. nodes: cluster piece ends (and roundabouts)
  const N=[], NH=new Map(), nk=(x,y)=>((x/3)|0)*100000+((y/3)|0);
  for(const r of RBS){ N.push({id:N.length,x:r.rb[0],y:r.rb[1],rb:r,edges:[]}); }
  const nodeAt=(p,ramp)=>{ for(const n of N) if(n.rb&&Math.hypot(p[0]-n.x,p[1]-n.y)<n.rb.rb[2]+2.2+2.5) return n;
    const R=ramp?3.6:1.6; for(let cx=((p[0]-R)/3)|0;cx<=((p[0]+R)/3|0);cx++) for(let cy=((p[1]-R)/3)|0;cy<=((p[1]+R)/3|0);cy++){ const L2=NH.get(cx*100000+cy); if(L2) for(const n of L2) if(Math.hypot(n.x-p[0],n.y-p[1])<R) return n; }
    const n={id:N.length,x:p[0],y:p[1],edges:[]}; N.push(n); const kk=nk(p[0],p[1]); if(!NH.has(kk)) NH.set(kk,[]); NH.get(kk).push(n); return n; };
  // non-ramp ends first so ramp ends snap onto the motorway / road nodes created by the cuts
  const order=P.map((p,i)=>i).sort((a,b)=>(P[a].type==='ramp')-(P[b].type==='ramp'));
  for(const i of order){ const p=P[i]; p.id=i; p.a=nodeAt(p.pts[0],p.type==='ramp').id; p.b=nodeAt(p.pts[p.pts.length-1],p.type==='ramp').id; }
  for(const p of P){ if(p.a===p.b&&p.pts.length<6) { p.dead=true; continue; } N[p.a].edges.push(p.id); N[p.b].edges.push(p.id); }
  for(const n of N){ n.deg=n.edges.length; n.merge=n.edges.some(i=>P[i].type==='hwy'); }
  return {P,N}; }
