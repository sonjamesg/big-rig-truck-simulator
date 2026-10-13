'use strict';
// ===================== UK HIGHWAY CODE ROAD MARKINGS + approach lane rules =====================
const RANK={hwy:5,dual:4.5,city:4,town:3,rural:2,res:1,lane:0.5};
function jOptions(J,sg,d){
  const [js,je]=jRange(sg,J), stop=d>0?js:je, exitA=d>0?je:js;
  const C=world.segs[sg.dir==='h'?J.vs:J.hs], opts=[];
  if(d>0? sg.b1+1>je+0.5 : sg.b0<js-0.5) opts.push(['S',null,0,5]);
  const [cs,ce]=jRange(C,J), hv=dirVec(sg,d);
  for(const cd of [-1,1]){ const ok= cd>0 ? C.b1+1>ce+0.5 : C.b0<cs-0.5; if(!ok) continue;
    const cv=dirVec(C,cd), z=hv[0]*cv[1]-hv[1]*cv[0]; opts.push([z<0?'L':'R',C,cd,z<0?2.6:2.2]); }
  return {stop,exitA,C,opts,cs,ce};
}
function assignLanes(letters,nl){
  const has=c=>letters.indexOf(c)>=0, L=new Array(nl).fill('');
  if(nl===1) return [ ['L','S','R'].filter(has).join('') ];
  if(nl===2){ L[0]=has('L')?(has('S')?'LS':'L'):(has('S')?'S':'R'); L[1]=has('R')?(has('S')?'SR':'R'):(has('S')?'S':'L'); return L; }
  L[0]=has('L')?'L':(has('S')?'S':'R'); L[nl-1]=has('R')?'R':(has('S')?'S':'L');
  for(let i=1;i<nl-1;i++) L[i]=has('S')?'S':(has('R')?'R':'L'); return L;
}
function rbLanes(nl){ return nl===1?['LSR']:nl===2?['LS','SR']:['L','S','R'].concat(new Array(Math.max(0,nl-3)).fill('R')).slice(0,nl); }
function apprBox(o){ const sg=o.sg, A=Math.min(o.lineA,o.lineA-o.d*o.Lapp)-0.5, B=Math.max(o.lineA,o.lineA-o.d*o.Lapp)+0.5;
  if(sg.dir==='h'){ o.x=A*TILE; o.y=sg.a*TILE; o.w=(B-A)*TILE; o.h=sg.w*TILE; } else { o.x=sg.a*TILE; o.y=A*TILE; o.w=sg.w*TILE; o.h=(B-A)*TILE; } }
function prevEdge(sg,d,before,skipJ){ let prev=d>0?sg.b0:sg.b1+1;
  for(const j of sg.js){ if(j===skipJ) continue; const [a,b]=jRange(sg,j); if(d>0&&b<=before+0.01&&b>prev) prev=b; if(d<0&&a>=before-0.01&&a<prev) prev=a; }
  const rb=d>0?sg.rb0:sg.rb1; return prev; }
function buildMarkings(objs){
  world.marks=[];
  for(const J of world.junctions){
    J.appr={}; const hs=world.segs[J.hs], vs=world.segs[J.vs];
    J.box= J.lights && (hs.type==='city'||hs.type==='town') && (vs.type==='city'||vs.type==='town') && hash2(J.x*3+1,J.y*7+2)<0.55;
    const through=(sg)=>{ const [a,b]=jRange(sg,J); return sg.b0<a-0.5 && sg.b1+1>b+0.5; };
    for(const sg of [hs,vs]) for(const d of [1,-1]){
      const [js,je]=jRange(sg,J); if(!(d>0? sg.b0<js-0.5 : sg.b1+1>je+0.5)) continue;
      const o=jOptions(J,sg,d); if(!o.opts.length) continue;
      const cw=(sg.type==='city'||sg.type==='town'||sg.type==='res'), lineA=o.stop-d*(cw?1:0);
      const prev=prevEdge(sg,d,d>0?js:je,J); let Lapp=Math.min(10,Math.abs(lineA-prev)-1.5); if(Lapp<1) Lapp=0;
      const letters=o.opts.map(x=>x[0]).join(''), lanes=assignLanes(letters,nLanes(sg));
      const other=sg===hs?vs:hs, myT=!through(sg), otT=!through(other);
      let minor; if(myT!==otT) minor=myT; else { const a=RANK[sg.type]*10+sg.w, b=RANK[other.type]*10+other.w; minor= a<b || (a===b && sg.dir==='v'); }
      const gw=!J.lights && minor;
      const ap={lanes,lineA,gw,lights:J.lights,Lapp,stop:o.stop,minor}; J.appr[sg.id+':'+d]=ap;
      const m={kind:'appr',sg,d,lineA,Lapp,lanes,mode:J.lights?'lights':gw?'gw':'major',slow:gw&&sg.type==='rural'&&Lapp>=9}; apprBox(m); objs.push(m); world.marks.push(m);
    }
    if(J.box) objs.push({kind:'boxj',J,x:J.x*TILE,y:J.y*TILE,w:J.w*TILE,h:J.h*TILE});
  }
  for(const W of world.segs) for(const s of [1,-1]){ const lk=s>0?W.link1:W.link0; if(lk===undefined) continue; const N=world.segs[lk]; if(N.w>=W.w) continue;
    const E=s>0?W.b1+1:W.b0, d=s; const dropped=[]; for(let i=0;i<nLanes(W);i++){ const r=laneLat(W,d,i); if(r<N.a||r>N.a+N.w-1) dropped.push(i); }
    if(!dropped.length) continue; const prev=prevEdge(W,d,E,null); const L=Math.min(14,Math.abs(E-prev)-1.5); if(L<4) continue;
    const m={kind:'ldrop',sg:W,d,lineA:E,Lapp:L,dropped,N}; apprBox(m); objs.push(m); world.marks.push(m); }
  for(const rb of world.rbs){ rb.appr={};
    for(const arm of rb.arms){ const sg=world.segs[arm.seg], d=arm.side, E=d>0?sg.b1+1:sg.b0;
      const prev=prevEdge(sg,d,E,null); let Lapp=Math.min(10,Math.abs(E-prev)-1.5); if(Lapp<1) Lapp=0;
      const lanes=rbLanes(nLanes(sg)); rb.appr[sg.id+':'+d]={lanes,lineA:E,Lapp};
      const m={kind:'appr',sg,d,lineA:E,Lapp,lanes,mode:'rb',slow:false}; apprBox(m); objs.push(m); world.marks.push(m); } }
}
// ---- drawing
function arrowHead(g,x,y,dx,dy){ const n=Math.hypot(dx,dy); dx/=n; dy/=n; g.beginPath(); g.moveTo(x+dx*15,y+dy*15); g.lineTo(x-dy*8,y+dx*8); g.lineTo(x+dy*8,y-dx*8); g.closePath(); g.fill(); }
function drawLaneArrow(g,kinds){ // local frame, forward = -y, ~7.5 m long
  g.strokeStyle=g.fillStyle='#ececec'; g.lineWidth=4; g.lineCap='butt';
  g.beginPath(); g.moveTo(0,30); g.lineTo(0, kinds.indexOf('S')>=0?-14:0); g.stroke();
  if(kinds.indexOf('S')>=0) arrowHead(g,0,-14,0,-1);
  for(const [k,s] of [['L',-1],['R',1]]) if(kinds.indexOf(k)>=0){ g.beginPath(); g.moveTo(0,4); g.quadraticCurveTo(0,-10,s*10,-13); g.stroke(); arrowHead(g,s*10,-13,s,-0.25); }
}
function drawApproach(g,o){
  const sg=o.sg, d=o.d, P=(al,cr)=> sg.dir==='h'?[al*TILE,cr*TILE]:[cr*TILE,al*TILE];
  const rect=(a0,a1,c0,c1)=>{ const p=P(a0,c0), q=P(a1,c1); g.fillRect(Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1])); };
  const nl=nLanes(sg), rows=[]; for(let i=0;i<nl;i++) rows.push(laneLat(sg,d,i)); const rmin=Math.min(...rows), rmax=Math.max(...rows)+1;
  const Cb=sg.a+sg.w/2, a1=o.lineA, L=o.Lapp, a0=a1-d*L, hw=sg.type==='hwy';
  const ang= sg.dir==='h'?(d>0?Math.PI/2:-Math.PI/2):(d>0?Math.PI:0);
  const at=(al,cr,fn)=>{ const p=P(al,cr); g.save(); g.translate(p[0],p[1]); g.rotate(ang); fn(); g.restore(); };
  if(L>0){
    g.fillStyle=g.createPattern(TEX.asph[1],'repeat');
    for(let b=rmin+1;b<rmax;b++) rect(a0,a1,b-0.07,b+0.12);
    if(!hw) rect(a0,a1,Cb-0.12,Cb+0.07);
    g.fillStyle='#ececec';
    for(let b=rmin+1;b<rmax;b++){ const sl=Math.min(5,L); rect(a1-d*sl,a1,b-0.035,b+0.035); for(let t=sl+0.25;t<L;t+=1.6) rect(a1-d*t,a1-d*Math.min(L,t+1.1),b-0.035,b+0.035); }
    if(!hw) for(let t=0.2;t<L;t+=2) rect(a1-d*t,a1-d*Math.min(L,t+1.5),Cb-0.05,Cb+0.05);   // hazard warning centre line
  }
  g.fillStyle='#ececec';
  if(o.mode==='lights') rect(a1,a1-d*0.16,rmin+0.08,rmax-0.02);                  // stop line
  if(o.mode==='gw'){ for(let c=rmin+0.08;c<rmax-0.1;c+=0.5){ const c2=Math.min(rmax-0.04,c+0.3); rect(a1-d*0.04,a1-d*0.14,c,c2); rect(a1-d*0.24,a1-d*0.34,c,c2); } }
  if(L<2) return;
  for(let i=0;i<nl;i++){ const cr=laneLat(sg,d,i)+0.5;
    if(o.mode==='gw' && L>=3) at(a1-d*2.0,cr,()=>{ g.strokeStyle='#ececec'; g.lineWidth=3; g.beginPath(); g.moveTo(-10,-22); g.lineTo(10,-22); g.lineTo(0,26); g.closePath(); g.stroke(); });
    const p1= o.mode==='gw'||o.mode==='rb' ? 4.4 : 2.5;
    if(L>=p1+1 && (nl>1||o.lanes[0].length<3||o.mode==='rb')) at(a1-d*p1,cr,()=>drawLaneArrow(g,o.lanes[i]));
    if(L>=p1+22 && !o.slow && nl>1) at(a1-d*(p1+5.5),cr,()=>drawLaneArrow(g,o.lanes[i]));
  }
  if(o.slow){ at(a1-d*7.5,(rmin+rmax)/2,()=>{ g.fillStyle='#ececec'; g.save(); g.scale(1,2.2); g.font='bold 15px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('SLOW',0,0); g.restore(); }); }
}
function drawBoxJunction(g,o){ g.save(); g.beginPath(); g.rect(o.x,o.y,o.w,o.h); g.clip(); g.strokeStyle='#f2c230'; g.lineWidth=3;
  g.strokeRect(o.x+3,o.y+3,o.w-6,o.h-6); const n=o.w+o.h;
  for(let k=-o.h;k<o.w+o.h;k+=26){ g.beginPath(); g.moveTo(o.x+k,o.y); g.lineTo(o.x+k+o.h,o.y+o.h); g.moveTo(o.x+k+o.h,o.y); g.lineTo(o.x+k,o.y+o.h); g.stroke(); }
  g.restore(); }

function drawLaneDrop(g,o){ // UK lane-drop: bold broken line, merge arrows, hatched taper where the lane ends
  const sg=o.sg, d=o.d, P=(al,cr)=> sg.dir==='h'?[al*TILE,cr*TILE]:[cr*TILE,al*TILE], E=o.lineA, L=o.Lapp;
  const rect=(a0,a1,c0,c1)=>{ const p=P(a0,c0), q=P(a1,c1); g.fillRect(Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1])); };
  for(const i of o.dropped){ const row=laneLat(sg,d,i); const contRow=laneLat(o.N,d,0); const sgn=Math.sign(contRow-row)||1; const B= sgn>0?row+1:row; // boundary with continuing lane
    g.fillStyle=g.createPattern(TEX.asph[1],'repeat'); rect(E-d*L,E,B-0.08,B+0.12);
    g.fillStyle='#ececec'; for(let t=0.3;t<L;t+=1.5) rect(E-d*t,E-d*Math.min(L,t+1),B-0.06,B+0.06);
    // taper hatching in the last 2.5 tiles of the dropped lane
    g.save(); g.strokeStyle='#ececec'; g.lineWidth=3; const c0=row+(sgn>0?0.08:0.92);
    const t0=P(E-d*2.6,c0), t1=P(E,B); g.beginPath(); g.moveTo(t0[0],t0[1]); g.lineTo(t1[0],t1[1]); g.stroke();
    for(let k=0.4;k<2.5;k+=0.55){ const a=P(E-d*k,c0), b=P(E-d*(k+0.4),B); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
    // merge arrows
    g.fillStyle='#ececec'; g.lineWidth=4;
    for(const k of [4.5,9.5]){ if(k+1>L) continue; const cR=row+0.5; const p0=P(E-d*k,cR), p1=P(E-d*(k-1.0),cR), p2=P(E-d*(k-2.0),cR+sgn*0.45);
      g.beginPath(); g.moveTo(p0[0],p0[1]); g.lineTo(p1[0],p1[1]); g.lineTo(p2[0],p2[1]); g.stroke(); arrowHead(g,p2[0],p2[1],p2[0]-p1[0],p2[1]-p1[1]); }
    g.restore(); } }
