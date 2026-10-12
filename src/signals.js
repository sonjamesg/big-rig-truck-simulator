'use strict';
// ===================== v12 SIGNAL PHASING (UK, drive on the left) =====================
// Each movement (approach key + L/S/R) gets a conflict-free stage. Stages are built greedily from the actual
// vehicle paths: two movements may only share a stage if their swept paths never come within SIG_CLEAR metres.
// Cycle per stage: green → amber (3 s) → all-red (2 s, the last 1.5 s shows red+amber to the next stage).
const SIG_CLEAR=2.6, SIG_AMBER=3, SIG_ALLRED=2, SIG_RA=1.5;
function sigMovePaths(J,key,mv){ const [sid,ds]=key.split(':'), sg=world.segs[+sid], d=+ds, o=jOptions(J,sg,d), ap=J.appr&&J.appr[key], nl=nLanes(sg), out=[];
  for(let l=0;l<nl;l++){ if(ap&&ap.lanes&&!(ap.lanes[l]&&ap.lanes[l].indexOf(mv)>=0)) continue; const p=lanePt(sg,d,l,o.stop), pts=[];
    if(mv==='S'){ const q=lanePt(sg,d,l,o.exitA); for(let k=0;k<=12;k++) pts.push([p[0]+(q[0]-p[0])*k/12,p[1]+(q[1]-p[1])*k/12]); }
    else { const ch=o.opts.find(c=>c[0]===mv); if(!ch) continue; const C2=ch[1], cd=ch[2], l2=mv==='L'?0:Math.min(nLanes(C2)-1,l), ex=cd>0?o.ce:o.cs, q=lanePt(C2,cd,l2,ex), c=sg.dir==='h'?[q[0],p[1]]:[p[0],q[1]];
      for(let k=0;k<=16;k++){ const t=k/16,u=1-t; pts.push([u*u*p[0]+2*u*t*c[0]+t*t*q[0],u*u*p[1]+2*u*t*c[1]+t*t*q[1]]); } }
    out.push(pts); }
  return out; }
function sigConflict(J,a,b){ if(a.key===b.key) return false; for(const P of a.paths) for(const Q of b.paths) for(const p of P) for(const q of Q) if(Math.abs(p[0]-q[0])<SIG_CLEAR&&Math.abs(p[1]-q[1])<SIG_CLEAR&&Math.hypot(p[0]-q[0],p[1]-q[1])<SIG_CLEAR) return true; return false; }
function buildSig(J){ const mvs=[]; const keys=Object.keys(J.appr||{});
  const axisOf=k=>world.segs[+k.split(':')[0]].dir; const ax0=hash2(J.x,J.y)<0.5?'v':'h';
  for(const ax of [ax0,ax0==='v'?'h':'v']) for(const pass of ['SL','R']) for(const k of keys){ if(axisOf(k)!==ax) continue; const o=jOptions(J,world.segs[+k.split(':')[0]],+k.split(':')[1]);
    for(const c of o.opts){ const m=c[0]; if((pass==='SL')!==(m!=='R')) continue; const paths=sigMovePaths(J,k,m); if(paths.length) mvs.push({key:k,mv:m,ax,paths,id:k+'|'+m}); } }
  const stages=[]; for(const m of mvs){ let st=stages.find(s=>s.ax===m.ax&&s.mv.every(o=>!sigConflict(J,o,m))); if(!st){ st={ax:m.ax,mv:[]}; stages.push(st); } st.mv.push(m); }
  let t=0; for(const s of stages){ s.g=s.mv.some(m=>m.mv==='S')?9:s.mv.some(m=>m.mv==='L')?7:4; s.t0=t; t+=s.g+SIG_AMBER+SIG_ALLRED; s.set=new Set(s.mv.map(m=>m.id)); }
  const of=new Map(); stages.forEach((s,i)=>s.mv.forEach(m=>of.set(m.id,i)));
  return {stages,T:t,of,mvs}; }
function sigOf(J){ return J.sig||(J.sig=buildSig(J)); }
function sigState(J,key,mv){ const S=sigOf(J); const i=S.of.get(key+'|'+mv); if(i===undefined) return 'r';
  const t=((timeS+J.phase*3)%S.T+S.T)%S.T; let cur=S.stages.length-1; for(let k=0;k<S.stages.length;k++) if(t>=S.stages[k].t0) cur=k;
  const st=S.stages[cur], u=t-st.t0;
  if(i===cur){ return u<st.g?'g':u<st.g+SIG_AMBER?'a':'r'; }
  if(i===(cur+1)%S.stages.length && u>=st.g+SIG_AMBER+SIG_ALLRED-SIG_RA) return 'ra';
  return 'r'; }
// legacy (corner pole lights): any movement on that axis
function lightState(J,ns){ const S=sigOf(J); let best='r'; for(const m of S.mvs){ if((m.ax==='v')!==ns) continue; const s=sigState(J,m.key,m.mv); if(s==='g') return 'g'; if(s==='a') best='a'; else if(s==='ra'&&best==='r') best='ra'; } return best; }
// vehicles (AI or the player) already inside the junction on a crossing heading
function jBusy(v,J){ const x0=J.x*M_T-1, y0=J.y*M_T-1, x1=(J.x+J.w)*M_T+1, y1=(J.y+J.h)*M_T+1, fv=fwd(v.h||0);
  const chk=(x,y,h)=>{ if(x<x0||x>x1||y<y0||y>y1) return false; const f=fwd(h); return Math.abs(f[0]*fv[0]+f[1]*fv[1])<0.8; };
  for(const o of traffic.vs){ if(o!==v&&chk(o.x,o.y,o.h||0)) return true; }
  if(chk(truck.x,truck.y,truck.h)) return true; if(truck.trl&&chk(truck.trl.x,truck.trl.y,truck.trl.th||0)) return true; return false; }
