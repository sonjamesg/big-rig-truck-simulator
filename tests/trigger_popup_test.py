"""Edge-triggered popups: a save parked on a trigger (yard sale slot) must NOT open its card on reload
or after fast travel / spawn; driving out and back in must open it.  Usage: python3 tests/trigger_popup_test.py [BigRig.html]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
PUT = r"""(()=>{ truck.v=0; const yd=ownYards().find(y=>!ownedYard(y)), s=yd.slot, x=s.x, y=s.y+1.9, h=0;
  __bigrig.BigRig.rigPlace({x,y,h}); return [x,y,h,ydBrand(yd).name]; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = await b.new_context(viewport={"width": 1280, "height": 800}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        async def boot():
            await pg.goto("file://" + os.path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=120000)
            await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500)
        await boot(); res = {}
        if await pg.evaluate("!!truck.trl"): await pg.evaluate("truck.trl.coupled=false; truck.trl=null")
        pos = await pg.evaluate(PUT + "()"); await pg.wait_for_timeout(2500)
        res["after_spawn_on_slot"] = await pg.evaluate("career.uiOpen||null")
        await pg.evaluate("saveGame()"); await boot()
        res["reload_pos"] = await pg.evaluate(f"Math.hypot(truck.x-{pos[0]},truck.y-{pos[1]})<3")
        await pg.wait_for_timeout(2500); res["after_reload_on_slot"] = await pg.evaluate("career.uiOpen||null")
        # drive out (no teleport reset) and back in, stop -> card opens
        await pg.evaluate("truck.y+=30"); await pg.wait_for_timeout(800)
        await pg.evaluate(f"truck.x={pos[0]};truck.y={pos[1]};truck.h={pos[2]};truck.v=0"); await pg.wait_for_timeout(1500)
        res["after_drive_in"] = await pg.evaluate("career.uiOpen||null")
        print(json.dumps(res), pos[3])
        ok = res["reload_pos"] and res["after_spawn_on_slot"] is None and res["after_reload_on_slot"] is None and res["after_drive_in"] is not None
        if errs: print("page errors", errs[:3]); ok = False
        print("SUMMARY", "PASS" if ok else "FAILED"); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
