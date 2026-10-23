"""Mount Cinder volcano: cone + lava clear of every road/bridge tile and the railway; basalt ground/boulders (no grey rock,
no trees on the cone); per-frame draw cost budget (high + low graphics). Usage: python3 tests/volcano_test.py [html]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "BigRig.html")
JS = r"""(()=>{ volcanoBake(); const K=VOLCANO,V=K.V,G=world.ground; let grey=0,trees=0,bas=0;
 for(let y=V.y-V.r-4;y<V.y+V.r+4;y++)for(let x=V.x-V.r-4;x<V.x+V.r+4;x++){const t=G[y*MW+x];
   if(t===T.ROCK){ if(world.inVolc(x,y)) bas++; else if(Math.hypot(x-V.x,y-V.y)<V.r+8) grey++; } }
 let greyRocks=0; for(const o of world.objects){ const d=Math.hypot(o.x/TILE-V.x,o.y/TILE-V.y); if(d>V.r) continue;
   if(o.kind==='rock'&&!o.basalt) greyRocks++; if(o.kind==='tree'&&world.inVolc(o.x/TILE,o.y/TILE)&&G[((o.y/TILE)|0)*MW+((o.x/TILE)|0)]===T.ROCK) trees++; }
 const t=(n,f)=>{const a=performance.now(); for(let i=0;i<n;i++) f(); return (performance.now()-a)/n;};
 const vx0=V.x*TILE-600,vy0=V.y*TILE-400,vr=[vx0,vy0,vx0+1200,vy0+800];
 GFX.lvl='high'; const hi=t(40,()=>volcanoDraw(...vr)); gameT=23; const ni=t(40,()=>volcanoNight(...vr));
 GFX.lvl='low'; const lo=t(40,()=>volcanoDraw(...vr)); GFX.lvl='high'; gameT=12;
 return {CR:K.CR,LMAX:K.LMAX,dmin:K.dmin,lavaClear:K.lavaClear,segs:K.segs,frags:K.frags,bas,grey,greyRocks,trees,msHigh:hi,msNight:ni,msLow:lo}; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.abspath(SRC)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        r = await pg.evaluate(JS); r["errors"] = errs; print(json.dumps(r)); await b.close()
        fails = []
        if r["CR"] > r["dmin"] - 3: fails.append("cone reaches within 3 tiles of a road/rail")
        if r["lavaClear"] < 10: fails.append("lava within 10 tiles of a road/rail")
        if r["bas"] < 1000: fails.append("no basalt ground")
        if r["grey"] or r["greyRocks"] or r["trees"]: fails.append("grey rock / grey boulders / trees on the cone")
        if r["msHigh"] > 4 or r["msLow"] > 2 or r["msNight"] > 3: fails.append("perf budget (ms/frame, software GL)")
        if errs: fails.append("page errors")
        print("FAIL: " + "; ".join(fails) if fails else "PASS"); sys.exit(1 if fails else 0)
asyncio.run(main())
