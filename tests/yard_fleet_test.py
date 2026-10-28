"""v74 yard fleet: buy every for-sale yard -> its fleet trucks spawn in the yard, drive out (private road included), join
AI traffic on real jobs and are drawn highlighted on the map. Usage: python3 build.py && python3 tests/yard_fleet_test.py [secs]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 120
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(800)
        await pg.evaluate("""(()=>{ const tk=__bigrig.truck; tk.money=1e9; window.__yf={};
          for(const Y of world.forSale){ ownBuy(Y); __yf[Y.id]={left:0,maxD:0,ids:new Set(),priv:0}; }
          const Y=world.forSale.find(y=>y.ppath)||world.forSale[0]; tk.x=Y.navE?Y.navE.x-60:Y.x; tk.y=Y.navE?Y.navE.y+12:Y.y+60; tk.v=0;
          window.__yi=setInterval(()=>{ for(const T of PTRUCK.list){ if(!T.home) continue; const r=__yf[T.home.id]; r.ids.add(T.id);
            if(T.st==='road') r.left=1; const x=T.v?T.v.x:T.x, y=T.v?T.v.y:T.y; if(x!=null){ const e=T.home.entrance; r.maxD=Math.max(r.maxD,Math.hypot(x-e.x,y-e.y));
            if(T.home.ppath&&ownPrivAt(Math.floor(x/M_T),Math.floor(y/M_T))) r.priv=1; } } },250);})()""")
        await pg.wait_for_timeout(SECS * 1000)
        r = await pg.evaluate("""(()=>{clearInterval(__yi); const out={}; for(const k in __yf){ const r=__yf[k]; out[k]={left:r.left,maxD:Math.round(r.maxD),trucks:r.ids.size,priv:r.priv}; }
          window.__dbg=PTRUCK.list.filter(T=>T.home).map(T=>({id:T.id,st:T.st,ph:T.ph,s:T.s&&Math.round(T.s),L:T.dp&&Math.round(T.dp.outP.len),tgt:T.tgt,wl:T.wl,outW:T.outW&&Math.round(T.outW),nxt:T.nxt,P:!!T.P,dest:T.dest&&T.dest.name})); const poses=ptPoses().filter(q=>q.T.home).length; return {dbg:__dbg,yards:out, fleetPoses:poses, parked:PTRUCK.list.filter(T=>T.parked).length};})()""")
        F = []
        for k, y in r["yards"].items():
            if not y["trucks"]: F.append(k + " no fleet trucks")
            elif not y["left"] or y["maxD"] < 150: F.append(k + " fleet never left the yard")
        if r["parked"]: F.append("parked fallback fleet still used")
        if not r["fleetPoses"]: F.append("no fleet trucks on the map")
        if errs: F.append("page errors %s" % errs[:3])
        r["fail"] = F; print(json.dumps(r)); await b.close(); print("PASS" if not F else "FAIL"); sys.exit(1 if F else 0)
asyncio.run(main())
