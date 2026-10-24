"""Ships + tugs soak test: several game days at both ports, every 0.5 s:
0 ship-ship hull overlaps (oriented rectangles), ships on water, tugs attach to every departure, let go and return to their berth,
tugs stay on water and never overlap a ship other than the one they are towing (allowed tolerance reported).
Usage: python3 tests/ships_test.py [BigRig.html] [days]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
DAYS=float(sys.argv[2]) if len(sys.argv)>2 else 3
JS=r"""(days)=>{ const dt=0.1, steps=Math.round(days*DAY_LEN/dt); const Ps=portList(); Ps.forEach(P=>portInit(P));
  const st=Ps.map(P=>({name:P.dep,shipOverlap:0,shipOffWater:0,tugOffWater:0,tugShipHit:0,tugTugHit:0,maxHold:0,firstBad:null}));
  const corners=(p,a,b)=>{const c=Math.cos(p.h),s=Math.sin(p.h),r=[];for(const x of [-a,0,a])for(const y of [-b,b])r.push([p.u+c*x-s*y,p.v+s*x+c*y]);return r;};
  for(let i=0;i<steps;i++){ updateDayNight(dt,true); for(const P of Ps) updateOnePort(P,dt);
    if(i%5) continue; Ps.forEach((P,pi)=>{ const S=st[pi], sh=P.cur.ships;
      for(let a=0;a<sh.length;a++){ S.maxHold=Math.max(S.maxHold,(sh[a].s&&sh[a].s.delay)||0);
        for(let b=a+1;b<sh.length;b++) if(obbHit(shipOBB(sh[a].pose,0.3,0.3),shipOBB(sh[b].pose,0.3,0.3))){S.shipOverlap++; if(!S.firstBad) S.firstBad={t:i*dt,a:sh[a].pose,b:sh[b].pose};}
        for(const q of corners(sh[a].pose,SHIP.L/2-1,SHIP.W/2)) if(!tugWater(P,q[0],q[1])) S.shipOffWater++; }
      for(const t of P.tugs||[]){ for(const q of corners({u:t.u,v:t.v,h:t.h},TUG.L/2,TUG.W/2)) if(!tugWater(P,q[0],q[1])){S.tugOffWater++; if(!S.firstTug) S.firstTug={u:t.u,v:t.v,st:t.st};}
        for(const q of P.tugs) if(q!==t&&q.i>t.i&&Math.hypot(q.u-t.u,q.v-t.v)<TUG.W*1.1&&!(q.st==='idle'&&t.st==='idle')) S.tugTugHit++;
        for(const o of sh){ if(o.k===t.ship) continue; if(obbHit(shipOBB(o.pose,0,0),{u:t.u,v:t.v,c:Math.cos(t.h),s:Math.sin(t.h),a:TUG.L/2,b:TUG.W/2})){S.tugShipHit++; if(!S.firstHit) S.firstHit={t:i*dt,tug:[t.u,t.v,t.st],ship:o.pose};} } } }); }
  Ps.forEach((P,pi)=>Object.assign(st[pi],{departures:P.shipsDone,tugJobs:P.tugJobs||0,attached:(P.tugs||[]).map(t=>t.att||0),released:(P.tugs||[]).map(t=>t.rel||0),returned:(P.tugs||[]).map(t=>t.home||0),tugState:(P.tugs||[]).map(t=>t.st),maxHold:Math.round(st[pi].maxHold)}));
  return st; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.truck',timeout=90000); await pg.wait_for_timeout(1500)
    res=await pg.evaluate(JS,DAYS); ok=True
    for r in res:
      bad=r['shipOverlap']>0 or r['shipOffWater']>0 or r['tugOffWater']>0 or r['tugShipHit']>0 or r['tugTugHit']>0 or r['departures']<3 or r['tugJobs']<3 or min(r['attached'])<3 or min(r['returned'])<2 or r['tugJobs']<r['departures']-1
      ok&=not bad; print('FAIL' if bad else 'ok  ',json.dumps(r))
    if errs: ok=False; print('errors:',errs[:5])
    await b.close(); print('PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
asyncio.run(main())
