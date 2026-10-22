"""v68 police line of sight + hide spots.
- rig behind a building (Albion West Truck Repairs area, or any hide spot) is not seen by police passing on every nearby road tile
- rig in the open on a straight road is seen by a police car 60 m down the road
- live sim: wanted + a police car parked on the nearest road: hidden rig -> no chase; rig in view -> chase
- every hide spot (except under-bridge) is out of sight from all roads within HIDE_LOS_R; spots are spread across the map
Screenshots -> /workspace/police/ (or argv[2]). Usage: python3 tests/police_los_test.py [BigRig.html] [dir]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "..", "BigRig.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/police"
os.makedirs(OUT, exist_ok=True)
R = []
def chk(n, ok, info=""):
    R.append(bool(ok)); print("ok  " if ok else "FAIL", n, info)
PLACE = """(p)=>{const T=truck;T.x=p[0];T.y=p[1];T.h=p[2]||0;T.th=T.h;T.v=0;if(T.trl){const f=fwd(T.h);T.trl.x=T.x-f[0]*9;T.trl.y=T.y-f[1]*9;T.trl.th=T.h;}cam.x=T.x*PPM;cam.y=T.y*PPM;}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script("try{localStorage.clear()}catch(e){}")
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(2000)
        await pg.evaluate("BigRig.fog&&BigRig.fog.revealAll()")
        # hide spots
        h = await pg.evaluate("""(()=>{HIDE.list=null;const L=hideBuild();let bad=[];const q=new Set();
          for(const h of L){q.add(Math.floor(h.x/1024)+','+Math.floor(h.y/1024));if(h.kind!=='bridge'&&hideSeenFromRoad(h.x+h.w/2,h.y+h.h/2))bad.push(h);}
          return {n:L.length,bad:bad.length,quads:q.size}})()""")
        chk("hide spots LOS-hidden from roads", h["bad"] == 0 and h["n"] > 50, json.dumps(h))
        chk("hide spots spread across the map", h["quads"] >= 25, json.dumps(h))
        # hidden scenario: hide spot nearest Albion West Truck Repairs (else the first spot)
        s = await pg.evaluate("""(()=>{const g=(world.garages||[]).find(g=>/Albion West/.test(g.name))||world.garages[0];
          const rd=(h)=>{const tx=Math.floor((h.x+h.w/2)/M_T),ty=Math.floor((h.y+h.h/2)/M_T);for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++)if(inb(tx+dx,ty+dy)&&isRoadT(idx(tx+dx,ty+dy))&&Math.hypot(dx,dy)*M_T>POL_TAIL_R+4)return true;return false};
          const L=HIDE.list.filter(h=>h.kind!=='bridge'&&rd(h));L.sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y));const h=L[0];
          return {g:g.name,x:h.x+h.w/2,y:h.y+h.h/2,d:Math.round(Math.hypot(h.x-g.x,h.y-g.y))}})()""")
        await pg.evaluate(PLACE, [s["x"], s["y"], 0])
        r = await pg.evaluate("""(()=>{truck.v=1; // moving: no hide-box bonus, pure line of sight
          let n=0,seen=0;const tx=Math.floor(truck.x/M_T),ty=Math.floor(truck.y/M_T);
          for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){const x=tx+dx,y=ty+dy;if(!inb(x,y)||!isRoadT(idx(x,y)))continue;
            const mx=(x+.5)*M_T,my=(y+.5)*M_T;if(Math.hypot(mx-truck.x,my-truck.y)>HIDE_LOS_R||Math.hypot(mx-truck.x,my-truck.y)<POL_TAIL_R)continue;n++;
            const P=truck,o=[P.x,P.y];if(polSeesPt(mx,my,P.x,P.y))seen++;}
          truck.v=0;return {roads:n,seen}})()""")
        chk("rig behind building: not seen from passing police", r["roads"] > 0 and r["seen"] == 0, json.dumps({**s, **r}))
        # open scenario: straight road, police 60 m along it
        o = await pg.evaluate("""(()=>{for(let i=0;i<MW*MH;i+=997){const x=i%MW,y=(i/MW)|0;let ok=true;for(let k=0;k<=16&&ok;k++)ok=inb(x+k,y)&&isRoadT(idx(x+k,y))&&inb(x+k,y-1)&&isRoadT(idx(x+k,y-1));
          if(ok)return {x:(x+.5)*M_T,y:(y+.5)*M_T,px:(x+15.5)*M_T,py:(y+.5)*M_T}}return null})()""")
        await pg.evaluate(PLACE, [o["x"], o["y"], 1.5708])
        seen = await pg.evaluate("(o)=>{truck.v=1;const r=polSeesRig(o.px,o.py);truck.v=0;return r}", o)
        chk("rig in the open: seen", seen, json.dumps(o))
        # live sim
        SIM = """async(q)=>{polEndChase&&POL.chase&&polEndChase();WANT.lvl=1;WANT.t=60;WANT.chased=false;
          const v=spawnVehicle(q.px,q.py,true,{kind:'estate'});if(!v)return 'nospawn';polMake(v,null);v.pol.search=true;v.pinT=timeS+1e6;v.x=q.px;v.y=q.py;v.v=0;
          await new Promise(r=>setTimeout(r,3000));const c=!!POL.chase;return {chase:c,pd:Math.round(Math.hypot(v.x-truck.x,v.y-truck.y))}}"""
        near = await pg.evaluate("""(s)=>{let best=null,bd=1e9;const tx=Math.floor(s.x/M_T),ty=Math.floor(s.y/M_T);
          for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){const x=tx+dx,y=ty+dy;if(inb(x,y)&&isRoadT(idx(x,y))){const d=Math.hypot(dx,dy);if(d<bd&&d*M_T>POL_TAIL_R+4){bd=d;best={px:(x+.5)*M_T,py:(y+.5)*M_T}}}}return best}""", s)
        await pg.evaluate(PLACE, [s["x"], s["y"], 0])
        a = await pg.evaluate(SIM, near)
        await pg.screenshot(path=OUT + "/police_hidden.png")
        chk("sim: hidden rig, police nearby -> no chase", isinstance(a, dict) and not a["chase"], json.dumps(a))
        await pg.evaluate("()=>{for(const v of POL.cars.slice()){const i=traffic.vs.indexOf(v);if(i>=0)traffic.vs.splice(i,1)}POL.cars.length=0;wantClear();}")
        await pg.evaluate(PLACE, [o["x"], o["y"], 1.5708])
        a2 = await pg.evaluate(SIM, {"px": o["x"] + 45, "py": o["y"]})
        await pg.screenshot(path=OUT + "/police_visible.png")
        chk("sim: rig in view -> chase", isinstance(a2, dict) and a2["chase"], json.dumps(a2))
        await pg.evaluate("()=>{polEndChase&&POL.chase&&polEndChase();wantClear();}")
        # map shot with blue hide icons
        await pg.evaluate(PLACE, [s["x"], s["y"], 0])
        await pg.evaluate("openMap();mapZoomTo(bigmap.zt/2.5)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + "/police_map_hide_icons.png"); await pg.evaluate("closeMap()")
        chk("no page errors", not errs, json.dumps(errs))
        await b.close()
        print("SUMMARY %d/%d %s" % (sum(R), len(R), "PASS" if all(R) else "FAIL"))
asyncio.run(main())
