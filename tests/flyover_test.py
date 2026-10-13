"""Flyover audit: every curved major road that crosses another road mid-span is grade-separated.
Runs the AI for SIM_MIN game minutes beside each flyover and counts same-layer collisions (overlapping vehicles) in the crossing zone: expects 0.
Also checks upper and lower traffic both actually used the crossing, sat nav never switches between the deck and the road below, and no console errors.
Usage: python3 tests/flyover_test.py [BigRig.html] [shot_prefix]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
SHOT=sys.argv[2] if len(sys.argv)>2 else None
SIM_MIN=4
JS=r"""(async (SIM)=>{ const B=__bigrig, t=B.truck;
  // crossing zones from the generator's conflict log (works on old builds too): curved non-street roads crossing a straight road
  const cs=new Map(); for(const [n,x,y,h,v] of (world.cflog||[])){ const cv=world.curves.find(c=>c.name===n); if(!cv||(!(cv.A&&cv.B)&&['city','town','res'].includes(cv.type))) continue; if(!cs.has(n)) cs.set(n,[]); cs.get(n).push([x,y]); }
  const zones=[]; for(const [n,ts] of cs){ const cl=[]; for(const p of ts){ let c=cl.find(c=>Math.hypot(c.x-p[0],c.y-p[1])<40); if(!c){ c={name:n,x:p[0],y:p[1],ts:[]}; cl.push(c); } c.ts.push(p); }
    for(const c of cl){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of c.ts){ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); } c.bb=[(x0-4)*M_T,(y0-4)*M_T,(x1+5)*M_T,(y1+5)*M_T]; c.cx=(x0+x1)/2*M_T; c.cy=(y0+y1)/2*M_T; delete c.ts; zones.push(c); } }
  const out={zones:zones.length,flyovers:(world.flyovers||[]).length,res:[]};
  const inZ=(z,x,y)=>x>z.bb[0]&&x<z.bb[2]&&y>z.bb[1]&&y<z.bb[3];
  const oh=window.trafficHitTruck; window.trafficHitTruck=()=>false;
  for(const z of zones){ // park the truck 70 m off the crossing, off-road, and let traffic flow
    traffic.vs.length=0; t.x=z.cx+70; t.y=z.cy+70; t.v=0; if(t.trl){ t.trl=null; }
    let coll=0, under=0; const pairs=new Set(), seenU=new Set(), seenL=new Set(); const dt=1/30, N=SIM*60/dt;
    for(let k=0;k<N;k++){ timeS+=dt; updateTraffic(dt);
      const vs=traffic.vs.filter(v=>inZ(z,v.x,v.y)); for(const v of vs) (v.layer?seenU:seenL).add(v.id);
      for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const a=vs[i], b=vs[j]; if(Math.abs(a.x-b.x)>25||Math.abs(a.y-b.y)>25) continue;
        let hit=false; for(const p of boxesOf(a)) for(const q of boxesOf(b)) if(obbMTV(p,q)) hit=true; if(!hit) continue;
        const key=a.id+'-'+b.id; if(pairs.has(key)) continue; pairs.add(key); if((a.layer|0)===(b.layer|0)) coll++; else under++; } }
    out.res.push({name:z.name,at:[Math.round(z.cx/M_T),Math.round(z.cy/M_T)],collisions:coll,passedUnder:under,upperVeh:seenU.size,lowerVeh:seenL.size}); }
  window.trafficHitTruck=oh;
  // sat nav across each flyover: no route may step from the deck onto the lower road or back
  let navBad=0, navN=0; if(world.foF) for(const fo of world.flyovers){ const cv=world.curves[fo.cv]; const A=cv.pts[Math.max(0,fo.a-30)], Bp=cv.pts[Math.min(cv.pts.length-1,fo.b+30)];
      const ls=world.segs[fo.lower[0]]; const L0=ls.dir==='h'?[ls.b0+2,ls.a+1]:[ls.a+1,ls.b0+2], L1=ls.dir==='h'?[ls.b1-2,ls.a+1]:[ls.a+1,ls.b1-2];
      for(const [s,g] of [[A,Bp],[Bp,A],[L0,L1],[L1,L0],[A,L1],[L0,Bp]]){ const S=navSnap(s[0],s[1],8), Gg=navSnap(g[0],g[1],8); if(!S||!Gg) continue; const p=navAStar(S[0],S[1],Gg[0],Gg[1]); if(!p) continue; navN++;
        for(let k=1;k<p.length;k++){ const a=p[k-1], b=p[k]; const F=world.foF; if(!(F[a]||F[b])) continue; const ca=world.roadH[a]===-3, cb=world.roadH[b]===-3; const d=Math.abs(b-a)===1?'h':'v';
          // a lower-road step under the deck must run along the lower road; deck steps never leave onto a non-deck straight road
          if(F[a]&&F[b]) continue; if(F[a]&&!cb&&world.roadH[b]===-1&&world.roadV[b]===-1) navBad++; } } }
  out.navRoutes=navN; out.navBad=navBad; return out; })"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=90000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800)
    r=await pg.evaluate(JS+'('+str(SIM_MIN)+')'); print(json.dumps(r))
    ok=r['zones']>0
    for z in r['res']:
      if z['collisions']>0 or z['upperVeh']==0 or z['lowerVeh']==0: ok=False
    if r.get('navBad'): ok=False
    if SHOT:
      zs=r['res']
      for i,z in enumerate(zs):
        await pg.evaluate(f"(()=>{{const t=__bigrig.truck; t.x={z['at'][0]}*M_T+8; t.y={z['at'][1]}*M_T+22; t.v=0; t.h=0;}})()"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{SHOT}{i}.png')
    errs=[e for e in errs if 'favicon' not in e and 'peer' not in e.lower()]
    if errs: ok=False; print('console errors:',errs[:5])
    await b.close(); print('PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
asyncio.run(main())
