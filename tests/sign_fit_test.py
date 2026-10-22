"""v71 sign text fit (signfit.js): drives past every POI (depots, yards, fuel, garages, malls, dealers, stations, services,
airport) with a long player company name and owned yards, logs every signFit call and asserts text width <= board inner width.
Usage: python3 tests/sign_fit_test.py [BigRig.html]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "..", "BigRig.html")
LONG = "Sonjames Intercontinental Heavy"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script("window.__SIGNLOG=1;")
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(2000)
        await pg.evaluate("(n)=>{localStorage.setItem('bigrig.name',n); for(const y of world.forSale||[]) OWN.yards[y.id]={tier:3,bought:0,delivered:0,earned:0};}", LONG)
        pts = await pg.evaluate("(()=>{const a=[];FOG_MPL((o,x,y,k)=>{if(k!=='Hide box')a.push([x,y,k])});return a})()")
        for x, y, k in pts:
            await pg.evaluate("(p)=>{truck.x=p[0];truck.y=p[1];truck.v=0;if(truck.trl){truck.trl.x=p[0];truck.trl.y=p[1]+12;}}", [x, y])
            await pg.wait_for_timeout(120)
        TPY = "(i)=>{const y=world.forSale[i];truck.x=y.x;truck.y=y.y;truck.v=0;if(truck.trl){truck.trl.x=y.x;truck.trl.y=y.y+12;}}"
        ny = await pg.evaluate("(world.forSale||[]).length")
        for own in (1, 0):
            if not own: await pg.evaluate("for(const y of world.forSale||[]) delete OWN.yards[y.id]")
            for i in range(ny):
                await pg.evaluate(TPY, i); await pg.wait_for_timeout(3000)
        # unit: long company names on the yard board widths at every tier of length
        unit = await pg.evaluate("""(()=>{const c=document.createElement('canvas').getContext('2d');const r=[];
          for(const n of ['A','Sonjames Haulage','SONJAMES INTERCONTINENTAL HEAVY HAULAGE','XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX HAULAGE','W W W W W W W W W W W W W W W W W W'])
            for(const mw of [60,120,200]) r.push(signFit(c,n.toUpperCase(),0,0,mw,20,'900 ','Arial Black,Arial',{id:'unit'}));
          return r.every(Boolean)})()""")
        L = await pg.evaluate("SIGNFIT.log")
        seen = {}
        for e in L: seen[(e["id"], e["t"], e["maxW"])] = e
        bad = [e for e in seen.values() if e["w"] > e["maxW"] + 0.5 or (e["sq"] and e["id"] != "unit")]
        yb = [e for e in seen.values() if e["id"] == "yardboard-sub" and LONG.upper() in e["t"]]
        print("long company name on yard boards:", [(e["t"], e["w"], e["maxW"], e["px"], e["lines"]) for e in yb])
        fixed = [e for e in seen.values() if e["w0"] > e["maxW"] + 0.5 and e["id"] != "unit"]
        ids = sorted({e["id"] for e in seen.values()})
        print("POIs visited", len(pts), "| distinct signs", len(seen), "| kinds", len(ids))
        print("kinds:", ", ".join(ids))
        print("would have overflowed (now fitted):", len(fixed))
        for e in sorted(fixed, key=lambda e: e["id"])[:60]: print("   ", e["id"], repr(e["t"]), "need", e["w0"], "box", e["maxW"], "->", e["px0"], "->", e["px"], "px", e["lines"], "line(s)")
        for e in bad: print("FAIL overflow", e)
        ok = not bad and unit and yb and len(seen) > 20 and not errs
        print("unit", unit, "ERRS", errs[:3]); print("PASS" if ok else "FAIL")
        json.dump(list(seen.values()), open("/workspace/signs/sign_log.json", "w"), indent=0)
        await b.close()
asyncio.run(main())
