"""Roundabout soak: geometry audit + AI traffic run at several roundabouts.
Checks: entry/exit paths stay on the visible tarmac and no splitter islands (v63), no stuck AI, no AI-AI collisions, no console errors.
Usage: python3 tests/roundabout_test.py [BigRig.html] [seconds_per_roundabout]   (needs playwright + /usr/bin/google-chrome)"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
SECS=int(sys.argv[2]) if len(sys.argv)>2 else 120  # must exceed one signal cycle (~81 s) so a real stall can be told from a red-light queue
GEO=r"""(()=>{ const W=__bigrig.world, out=[]; for(const rb of W.rbs){ const r={id:rb.id,arms:rb.arms.length,splitters:0,offTarmac:0,inSplitter:0};
  for(const arm of rb.arms){ const nl=Math.max(1,Math.floor(W.segs[arm.seg].w/2)); if(rbSplitter(rb,arm)) r.splitters++;
    for(let i=0;i<nl;i++) for(const P of [rbEntry(rb,arm,i).pts,rbExit(rb,arm,i).pts]) for(const p of P){ const s=rbSurf(rb,p[0],p[1]); if(s===2) r.inSplitter++; else if(!onTarmacT(p[0],p[1])) r.offTarmac++; } }
  // no grass gaps: every point of the ring annulus and each arm mouth up to the stub is drivable
  let gaps=0; for(let a=0;a<6.283;a+=0.02) for(let d=rb.rin+0.05;d<rb.rout;d+=0.25){ if(!onTarmacT(rb.cx+Math.cos(a)*d,rb.cy+Math.sin(a)*d)) gaps++; }
  for(const arm of rb.arms){ const g=rbArmGeom(rb,arm); for(let u=rb.rout-0.5;u<g.uE+1;u+=0.2) for(let v=-g.hw+0.05;v<g.hw;v+=0.2){ const p=rbW(g,rb,u,g.c+v); if(rbSurf(rb,p[0],p[1])===2) continue; if(!onTarmacT(p[0],p[1])) gaps++; } }
  r.gaps=gaps; out.push(r);} return out; })()"""
START=r"""((id)=>{ const B=__bigrig, rb=B.world.rbs[id], tk=B.truck; tk.x=rb.cx*M_T; tk.y=rb.cy*M_T; tk.v=0; B.cam.zLock=0.4; B.cam.z=0.4;
  const R={id,coll:new Set(),maxN:0,seen:new Set(),stuck:new Set(),last:new Map(),t0:timeS,rec0:B.traffic.recovers||0};
  R.stuckT=(RBSIG.G+RBSIG.A+RBSIG.R)*rb.arms.length+15; // a car queued at red legitimately waits up to one full signal cycle
  const zone=v=>Math.hypot(v.x/M_T-rb.cx,v.y/M_T-rb.cy)<rb.rout+9;
  const box=(x,y,h,L,W)=>{ const f=fwd(h), r=rgt(h); return [[L,W],[L,-W],[-L,-W],[-L,W]].map(([a,b])=>[x+f[0]*a+r[0]*b,y+f[1]*a+r[1]*b]); };
  const corners=v=>{ const B=[box(v.x,v.y,v.h||0,v.L*0.45,v.W*0.42)]; if(v.trl) B.push(box(v.trl.x,v.trl.y,v.trl.h,13.6*0.45,2.5*0.42)); return B; };
  const hit=(A,B)=>A.some(a=>B.some(b=>!sep(a,b)));
  const sep=(A,B)=>{ for(const P of [A,B]) for(let i=0;i<4;i++){ const p=P[i],q=P[(i+1)%4], nx=q[1]-p[1], ny=p[0]-q[0]; let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9; for(const z of A){ const d=z[0]*nx+z[1]*ny; a0=Math.min(a0,d); a1=Math.max(a1,d); } for(const z of B){ const d=z[0]*nx+z[1]*ny; b0=Math.min(b0,d); b1=Math.max(b1,d); } if(a1<b0||b1<a0) return true; } return false; };
  const inner=v=>Math.hypot(v.x/M_T-rb.cx,v.y/M_T-rb.cy)<rb.rout+4;   // collisions: the ring, its flares and splitter mouths
  window.__rbT=R; clearInterval(window.__rbI);
  window.__rbI=setInterval(()=>{ const vs=B.traffic.vs.filter(zone); R.maxN=Math.max(R.maxN,vs.length);
    for(const v of vs){ R.seen.add(v.id); const L=R.last.get(v.id); if(!L||Math.hypot(v.x-L.x,v.y-L.y)>1){ R.last.set(v.id,{x:v.x,y:v.y,t:timeS}); } else if(timeS-L.t>R.stuckT) R.stuck.add(v.id); }
    for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const a=vs[i],b=vs[j]; if(a.ghostT>0||b.ghostT>0||!inner(a)&&!inner(b)||Math.hypot(a.x-b.x,a.y-b.y)>30) continue; if(hit(corners(a),corners(b))){ const key=Math.min(a.id,b.id)+'-'+Math.max(a.id,b.id); if(!R.coll.has(key)){ const inf=v=>({id:v.id,k:v.kind,v:+v.v.toFixed(1),r:+(Math.hypot(v.x/M_T-rb.cx,v.y/M_T-rb.cy)).toFixed(2),a:+Math.atan2(v.y/M_T-rb.cy,v.x/M_T-rb.cx).toFixed(2),h:+(v.h||0).toFixed(2),ring:!!v.ring,mk:v.mk.map(m=>m.kind+(m.go?'*':'')).join(' ')}); (R.det=R.det||[]).push([inf(a),inf(b)]); } R.coll.add(key); } }
    if(vs.length<10 && Math.random()<0.5){ const arm=rb.arms[(Math.random()*rb.arms.length)|0], sg=B.world.segs[arm.seg], E=arm.side>0?sg.b1+1:sg.b0, al=E-arm.side*(18+Math.random()*20);
      const x=sg.dir==='h'?al:sg.a+sg.w/2, y=sg.dir==='h'?sg.a+sg.w/2:al; try{ B.spawnVehicle(x*M_T,y*M_T,true,{seg:sg.id,along:al,dir:arm.side}); }catch(e){} } },250); return rb.arms.length; })"""
STOP="""(()=>{ clearInterval(window.__rbI); const R=window.__rbT; return {rb:R.id,seconds:+(timeS-R.t0).toFixed(1),vehicles:R.seen.size,peakOnRb:R.maxN,stuck:R.stuck.size,collisions:[...R.coll].length,det:R.det||[],recoveries:(__bigrig.traffic.recovers||0)-R.rec0}; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1000,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=120000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
    geo=await pg.evaluate(GEO); ok=all(r['offTarmac']==0 and r['inSplitter']==0 and r['gaps']==0 and r['splitters']==0 for r in geo)  # v63: splitter islands removed
    runs=[]
    for rid in [0,1,3,4,6]:
      await pg.evaluate(START+f"({rid})"); await pg.wait_for_timeout(SECS*1000); r=await pg.evaluate(STOP); runs.append(r); print(json.dumps(r),flush=True)
      if r['stuck'] or r['collisions'] or r['vehicles']<5: ok=False
    if errs: ok=False
    await b.close(); print(json.dumps({'geometry':geo,'errors':errs},indent=1)); print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
asyncio.run(main())
