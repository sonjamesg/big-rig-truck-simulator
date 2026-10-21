"""v66 map discovery (fog.js): fresh save fogged, discovery toast + fast-travel unlock, estate agent filtering, home-visit rule,
old save (no d.fog) fully revealed, "sonjames" always revealed. Screenshots -> /workspace/fog/ (or argv[2]).
Usage: python3 tests/fog_test.py [BigRig.html] [shot dir]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "..", "BigRig.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/fog"
os.makedirs(OUT, exist_ok=True)
R = []
def chk(n, ok, info=""):
    R.append(ok); print("ok  " if ok else "FAIL", n, info)
async def boot(b, pre=None):
    ctx = await b.new_context(viewport={"width": 1280, "height": 720})
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    if pre: await ctx.add_init_script(pre)
    await pg.goto("file://" + os.path.abspath(HTML))
    await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
    await pg.keyboard.press("Enter"); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
TP = "(p)=>{truck.x=p[0];truck.y=p[1];truck.v=0;if(truck.trl){truck.trl.x=p[0];truck.trl.y=p[1]+12;} fogTick();}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        # ---- fresh save
        ctx, pg, errs = await boot(b, "try{localStorage.clear()}catch(e){}")
        s = await pg.evaluate("({on:FOG.on,act:fogActive(),n:FOG.bits.reduce((a,b)=>a+b,0),tot:FOG.bits.length,disc:FOG.disc.size})")
        chk("fresh save fogged", s["act"] and s["n"] < s["tot"] * 0.02, json.dumps(s))
        await pg.evaluate("openMap();mapZoomTo(bigmap.zt/5)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + "/fog_fresh_map.png"); await pg.evaluate("closeMap()")
        # pick an undiscovered fuel station
        q = await pg.evaluate("""(()=>{const f=world.fuel.map(f=>({f,d:Math.hypot(f.x-truck.x,f.y-truck.y)})).filter(o=>o.d>600).sort((a,b)=>a.d-b.d)[0].f;
          fogScan(true); return {name:f.name,x:f.x,y:f.y,blk:ftBlock(f,true),known:fogKnownObj(f),inList:(()=>{let n=0;mapPOIList(o=>{if(o===f)n++});return n})()}})()""")
        chk("undiscovered place blocked + hidden", not q["known"] and "Undiscovered" in (q["blk"] or "") and q["inList"] == 0, json.dumps(q))
        await pg.evaluate(TP, [q["x"] + 20, q["y"] + 20]); await pg.wait_for_timeout(400)
        t = await pg.evaluate("[...document.querySelectorAll('.toast.fogd')].map(e=>e.textContent)")
        await pg.screenshot(path=OUT + "/fog_discovery_toast.png")
        chk("discovery toast", any(q["name"] in x for x in t), json.dumps(t))
        u = await pg.evaluate("""(n)=>{const f=world.fuel.find(f=>f.name===n);let c=0;mapPOIList(o=>{if(o===f)c++});return {known:fogKnownObj(f),inList:c,blk:ftBlock(f,true)}}""", q["name"])
        chk("fast travel unlocked", u["known"] and u["inList"] == 1 and "Undiscovered" not in (u["blk"] or ""), json.dumps(u))
        # explore a little more for the partial-map shot: drive-like path along a few depots
        await pg.evaluate("""async()=>{const ds=world.depots.slice(0,3);for(const d of ds){const a=[truck.x,truck.y],b=[d.entrance.x,d.entrance.y];
          for(let k=1;k<=40;k++){truck.x=a[0]+(b[0]-a[0])*k/40;truck.y=a[1]+(b[1]-a[1])*k/40;fogTick();}}}""")
        await pg.evaluate("openMap();mapZoomTo(bigmap.zt/5)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + "/fog_partial_map.png"); await pg.evaluate("closeMap()")
        # estate agent filter + home-visit rule
        h = await pg.evaluate("""(()=>{const h=HOMES.list[0];const e=h.entrance;fogReveal(e.x+300,e.y,330); fogScan(true);
          estatePanel(HOMES.agents[0]); const n=document.querySelectorAll('.eam .pc').length;
          const seen=HOMES.list.filter(x=>fogSeen(x.entrance.x,x.entrance.y)).length+(world.forSale||[]).filter(y=>fogSeen(y.entrance.x,y.entrance.y)).length;
          const btn=document.querySelector('.eam .ftb[data-h="'+h.id+'"]');
          return {n,seen,total:HOMES.list.length+(world.forSale||[]).length,btn:btn&&btn.textContent,known:fogKnownObj(h.ft),id:h.id,ex:e.x,ey:e.y}})()""")
        await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + "/fog_estate_filtered.png")
        chk("estate agent filtered to discovered areas", h["n"] == h["seen"] and h["n"] < h["total"], json.dumps(h))
        ft = await pg.evaluate("(id)=>{truck.money=1e7;const o=HOMES.list.find(x=>x.id===id).ft;return fastTravel(o)}", h["id"])
        chk("home seen but not visited: no fast travel", "VISIT" in (h["btn"] or "") and not h["known"] and ft is False, str(ft))
        await pg.evaluate("closeUI()")
        await pg.evaluate(TP, [h["ex"], h["ey"]]); await pg.wait_for_timeout(300)
        v = await pg.evaluate("(id)=>fogKnownObj(HOMES.list.find(x=>x.id===id).ft)", h["id"])
        chk("home visited: fast travel unlocked", v)
        # persistence round trip
        rt = await pg.evaluate("(()=>{saveGame();const d=JSON.parse(localStorage.getItem(saveKey()));const n=FOG.disc.size,b=FOG.bits.reduce((a,c)=>a+c,0);fogLoad(d.fog);return {len:JSON.stringify(d.fog).length,n,b,n2:FOG.disc.size,b2:FOG.bits.reduce((a,c)=>a+c,0)}})()")
        chk("save round trip", rt["n"] == rt["n2"] and rt["b"] == rt["b2"], json.dumps(rt))
        await pg.evaluate("BigRig.fog.revealAll()")
        chk("dev reveal all", not await pg.evaluate("fogActive()"))
        chk("no page errors (fresh)", not errs, json.dumps(errs)); await ctx.close()
        # ---- old save (no fog field): fully revealed
        ctx, pg, errs = await boot(b, "try{localStorage.clear()}catch(e){}")
        kd = await pg.evaluate("(()=>{saveGame();const k=saveKey(),d=JSON.parse(localStorage.getItem(k));delete d.fog;return [k,JSON.stringify(d)]})()")
        await ctx.close()
        ctx, pg, errs = await boot(b, "try{localStorage.clear();localStorage.setItem(%s,%s)}catch(e){}" % (json.dumps(kd[0]), json.dumps(kd[1])))
        o = await pg.evaluate("({on:FOG.on,act:fogActive(),n:(()=>{let c=0;mapPOIList(()=>c++);return c})()})")
        chk("old save fully revealed", not o["act"] and o["n"] > 150, json.dumps(o)); await ctx.close()
        # ---- sonjames: always revealed, even fresh
        ctx, pg, errs = await boot(b, "try{localStorage.clear();localStorage.setItem('bigrig.name','SonJames')}catch(e){}")
        chk("sonjames always revealed", not await pg.evaluate("fogActive()")); await ctx.close()
        await b.close()
        print("SUMMARY %d/%d %s" % (sum(R), len(R), "PASS" if all(R) else "FAIL"))
asyncio.run(main())
