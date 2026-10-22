"""v69 pause menu: Esc opens (Jobs tab), Q/E tab switching incl. Map, settings persist across reload, sim frozen in single
player, MP pose carries the paused flag (128) and a paused remote rig gets no push / is drawn see-through.
Screenshots -> /workspace/pause/ (or argv[2]). Usage: python3 tests/pause_test.py [BigRig.html] [dir]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "..", "BigRig.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/pause"
os.makedirs(OUT, exist_ok=True)
R = []
def chk(n, ok, info=""):
    R.append(bool(ok)); print("ok  " if ok else "FAIL", n, info)
async def boot(pg):
    await pg.goto("file://" + os.path.abspath(HTML))
    await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
    await pg.keyboard.press("Enter"); await pg.wait_for_timeout(2500)
    await pg.evaluate("BigRig.fog&&BigRig.fog.revealAll()")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.clear();localStorage.setItem('bigrig.profile','pausetest')}")
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await boot(pg)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(600)
        s = await pg.evaluate("({on:PM.on,tab:PM.tab,ui:career.uiOpen,tabs:document.querySelectorAll('#ui .pmtabs [data-pmt]').length})")
        chk("Esc opens pause on Jobs", s["on"] and s["tab"] == "jobs" and s["ui"] == "board" and s["tabs"] == 8, json.dumps(s))
        await pg.screenshot(path=OUT + "/pause_1_jobs.png")
        names = ["map", "truck", "props", "stats", "players", "controls", "settings"]
        for i, n in enumerate(names):
            await pg.keyboard.press("e"); await pg.wait_for_timeout(700)
            t = await pg.evaluate("({tab:PM.tab,on:PM.on,map:bigmap.open,ui:career.uiOpen,bar:!!document.getElementById('pmMapBar')})")
            ok = t["tab"] == n and t["on"] and (t["map"] and t["bar"] if n == "map" else t["ui"] == "pause")
            chk("E -> " + n, ok, json.dumps(t))
            await pg.screenshot(path=OUT + "/pause_%d_%s.png" % (i + 2, n))
        await pg.keyboard.press("q"); await pg.wait_for_timeout(500)
        chk("Q back to controls", await pg.evaluate("PM.tab") == "controls")
        await pg.keyboard.press("e"); await pg.wait_for_timeout(500)
        # settings
        await pg.click("#ui [data-pm='0']"); await pg.wait_for_timeout(200)
        await pg.click("#ui [data-pg='low']"); await pg.wait_for_timeout(200)
        v0 = await pg.evaluate("SETTINGS.vol")
        await pg.click("#ui [data-pv='-']"); await pg.wait_for_timeout(200)
        st = await pg.evaluate("({mm:SETTINGS.mm,g:GFX.lvl,v:SETTINGS.vol})")
        chk("settings apply", st["mm"] is False and st["g"] == "low" and abs(st["v"] - (v0 - 0.1)) < 1e-6, json.dumps(st))
        # SP paused
        fr = await pg.evaluate("""async()=>{const T=truck,x=T.x,y=T.y,tv=traffic.vs.slice(0,5).map(v=>[v.x,v.y]),t0=gameT;T.v=8;
          await new Promise(r=>setTimeout(r,1200));const mv=traffic.vs.slice(0,5).filter((v,i)=>tv[i]&&Math.hypot(v.x-tv[i][0],v.y-tv[i][1])>0.01).length;
          const r={truck:Math.hypot(T.x-x,T.y-y),traffic:mv,clock:gameT-t0};T.v=0;return r}""")
        chk("single player sim paused", fr["truck"] < 0.01 and fr["traffic"] == 0, json.dumps(fr))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500)
        chk("Esc resumes", not await pg.evaluate("PM.on||!!career.uiOpen"))
        # Esc still closes other panels (job board via J) without opening pause
        await pg.keyboard.press("j"); await pg.wait_for_timeout(400)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
        chk("Esc closes other panels only", not await pg.evaluate("PM.on||!!career.uiOpen"))
        # MP flag + ghost
        m = await pg.evaluate("""async()=>{PM.on=true;const fl=mpSelfPose()[9];PM.on=false;
          const id='ghost1';MP.players[id]=mpNewPlayer(id,'Dave_HGV');const T=truck;
          const mk=(f)=>['p',id,Math.round(performance.now()),T.x+2,T.y,T.h,0,career.cur,'',f,0];
          const was=MP.on;MP.on=true;MP.sendT=99;const r={fl};
          for(const f of [128,0]){const x0=T.x,y0=T.y;const pl=MP.players[id];pl.buf=[];pl.has=false;
            for(let k=0;k<4;k++){mpPose(mk(f));await new Promise(q=>setTimeout(q,60));}
            for(let k=0;k<30;k++){updateMP(1/60);}
            r['push'+f]=+Math.hypot(T.x-x0,T.y-y0).toFixed(3);T.x=x0;T.y=y0;}
          r.has=MP.players[id].has;return r}""")
        chk("MP pose carries paused flag", m["fl"] & 128, json.dumps(m))
        chk("paused remote rig: no push (unpaused control pushes)", m["push128"] == 0 and m["push0"] > 0, json.dumps(m))
        await pg.evaluate("""async()=>{const id='ghost1',T=truck,pl=MP.players[id];pl.buf=[];for(let k=0;k<4;k++){mpPose(['p',id,Math.round(performance.now()),T.x+14,T.y-6,T.h,0,career.cur,'',128,0]);await new Promise(q=>setTimeout(q,60));}}""")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + "/pause_mp_paused_remote.png")
        await pg.evaluate("()=>{mpPlayerGone&&mpPlayerGone('ghost1');delete MP.players.ghost1;MP.on=false}")
        # persist across reload
        await pg.evaluate("saveGame()")
        await pg.reload(); await boot(pg)
        st2 = await pg.evaluate("({mm:SETTINGS.mm,g:GFX.lvl,v:SETTINGS.vol})")
        chk("settings persist after reload", st2["mm"] is False and st2["g"] == "low" and abs(st2["v"] - st["v"]) < 1e-6, json.dumps(st2))
        await pg.evaluate("SETTINGS.mm=true;gfxSet('high');saveGame()")
        chk("no page errors", not errs, json.dumps(errs))
        await ctx.close()
        # phone landscape shots
        ctx = await b.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
        await ctx.add_init_script("if(!sessionStorage.s){sessionStorage.s=1;localStorage.clear();localStorage.setItem('bigrig.profile','pausetest2')}")
        pg = await ctx.new_page()
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.evaluate("startGame()"); await pg.wait_for_timeout(2500)
        ph = await pg.evaluate("!!document.getElementById('mJobs')")
        await pg.evaluate("document.getElementById('mJobs')&&document.getElementById('mJobs').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); await pg.wait_for_timeout(700)
        if not await pg.evaluate("PM.on"): await pg.evaluate("openPause('jobs')"); await pg.wait_for_timeout(700)
        await pg.screenshot(path=OUT + "/pause_phone_jobs.png")
        await pg.evaluate("pmShow('settings')"); await pg.wait_for_timeout(700)
        await pg.screenshot(path=OUT + "/pause_phone_settings.png")
        chk("phone menu opens", await pg.evaluate("PM.on") and ph)
        await ctx.close(); await b.close()
        print("SUMMARY %d/%d %s" % (sum(R), len(R), "PASS" if all(R) else "FAIL"))
asyncio.run(main())
