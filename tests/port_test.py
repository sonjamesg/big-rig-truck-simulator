"""Port logistics soak test: simulates several game days at both ports and asserts
no ship overlaps, ships always on water, no stuck tractors / lorries, yard within caps, cargo actually flows.
Usage: python3 tests/port_test.py [BigRig.html] [days]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
DAYS=float(sys.argv[2]) if len(sys.argv)>2 else 4
JS=r"""(days)=>{ const dt=0.1, steps=Math.round(days*DAY_LEN/dt), out={}; const Ps=portList(); Ps.forEach(P=>portInit(P));
  const st=Ps.map(P=>({name:P.dep,minGap:1e9,overlaps:0,offWater:0,stuckT:0,stuckL:0,capViol:0,maxStock:0,maxEx:0,ships:0,firstBad:null}));
  for(let i=0;i<steps;i++){ updateDayNight(dt,true); for(const P of Ps) updateOnePort(P,dt);
    if(i%10) continue; Ps.forEach((P,pi)=>{ const S=st[pi], sh=P.cur.ships; const pts=sh.map(o=>{ const p=o.pose, f=[Math.cos(p.h),Math.sin(p.h)]; const a=[]; for(let k=-3;k<=3;k++) a.push([p.u+f[0]*k*SHIP.L/7,p.v+f[1]*k*SHIP.L/7,f]); return a; });
      for(let a=0;a<pts.length;a++) for(let b=a+1;b<pts.length;b++){ let m=1e9; for(const p of pts[a]) for(const q of pts[b]) m=Math.min(m,Math.hypot(p[0]-q[0],p[1]-q[1])); S.minGap=Math.min(S.minGap,m); if(m<SHIP.W+0.6){ S.overlaps++; if(!S.firstBad) S.firstBad={t:i*dt,a:sh[a].pose,b:sh[b].pose}; } }
      for(const A of pts) for(const p of A) for(const sd of [-1,1]){ const w=PL(P,p[0]-p[2][1]*sd*SHIP.W/2,p[1]+p[2][0]*sd*SHIP.W/2); const t=get(Math.floor(w[0]),Math.floor(w[1])); if(inb(Math.floor(w[0]),Math.floor(w[1]))&&t!==T.WATER&&t!==T.BRIDGE){ S.offWater++; if(!S.firstOff) S.firstOff={w:w.map(Math.round),t}; } }
      if(P.tracs.some(t=>t.still>150)) S.stuckT++; if(P.lors.some(l=>l.still>150)) S.stuckL++;
      if(P.stock<0||P.ex<0||P.stock+P.resImp>P.cap||P.ex+P.exRes>P.ecap||P.impClaim<0||P.resImp<0||P.exRes<0) S.capViol++;
      S.maxStock=Math.max(S.maxStock,P.stock+P.resImp); S.maxEx=Math.max(S.maxEx,P.ex+P.exRes); }); }
  Ps.forEach((P,pi)=>Object.assign(st[pi],{shipsDone:P.shipsDone,unloaded:P.unl,loaded:P.ld,lorriesOutLoaded:P.sent,exportsIn:P.recv,stock:P.stock,ex:P.ex,cap:P.cap,ecap:P.ecap,period:SHIP.PER,cycle:Math.round(P.Ltot),gap:+st[pi].minGap.toFixed(1)}));
  return st; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.truck',timeout=90000); await pg.wait_for_timeout(1500)
    res=await pg.evaluate(JS,DAYS); ok=True
    for r in res:
      bad=r['overlaps']>0 or r['offWater']>0 or r['stuckT']>0 or r['stuckL']>0 or r['capViol']>0 or r['unloaded']<r['shipsDone']*3 or r['loaded']<r['shipsDone']*2 or r['lorriesOutLoaded']<5
      ok&=not bad; print('FAIL' if bad else 'ok  ',json.dumps(r))
    errs=[e for e in errs if 'favicon' not in e and 'peer' not in e.lower()]
    if errs: ok=False; print('console errors:',errs[:5])
    await b.close(); print('PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
asyncio.run(main())
