"""Wheel size setting + 360 pause: slider saves/loads per truck, LT/RT and [ ] step it, geometry per truck (wheelbase),
360 pause via button / Space / pad Y, manual rotate still works while paused. Optional shots dir.
Usage: python3 tests/wheel_size_test.py [shotdir]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SHOT = sys.argv[1] if len(sys.argv) > 1 else None
PAD = "(i)=>czPad({axes:[0,0,0,0],buttons:Array.from({length:17},(_,k)=>({pressed:k===i}))},(k)=>k===i,performance.now(),0.016)"
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        url = "file://" + os.path.join(ROOT, "BigRig.html")
        await pg.goto(url); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        R = {}
        await pg.evaluate("applyModel('titan'); truck.v=0; CZ.tab='tyres'; czOpen()"); await pg.wait_for_timeout(600)
        R["geomTitan"] = await pg.evaluate("[truck.wb,truck.cf,truck.cr]")
        await pg.evaluate(f"({PAD})(7)"); R["rt"] = await pg.evaluate("czWS('titan')")
        await pg.evaluate(f"({PAD})(6)"); await pg.evaluate(f"({PAD})(6)"); R["lt"] = await pg.evaluate("czWS('titan')")
        await pg.click(".czh h2"); R["focus"] = await pg.evaluate("document.activeElement&&document.activeElement.tagName"); await pg.keyboard.press("BracketRight"); R["key"] = await pg.evaluate("czWS('titan')")
        await pg.fill("#czWs", "120"); await pg.dispatch_event("#czWs", "input"); R["slider"] = await pg.evaluate("czWS('titan')")
        # pause: button tap, Space, pad Y; manual rotate while paused
        a0 = await pg.evaluate("CZ.ang"); await pg.tap(".czp .ttpause"); await pg.wait_for_timeout(300)
        R["pausedTap"] = await pg.evaluate("TT.paused"); a1 = await pg.evaluate("CZ.ang"); await pg.wait_for_timeout(600); a2 = await pg.evaluate("CZ.ang")
        R["stillWhilePaused"] = abs(a2 - a1) < 1e-6
        await pg.keyboard.press("KeyX"); R["manualWhilePaused"] = (await pg.evaluate("CZ.ang")) != a2
        if SHOT: await pg.screenshot(path=f"{SHOT}/pause_360.png")
        await pg.click(".czh h2"); await pg.keyboard.press("KeyP"); R["playSpace"] = not await pg.evaluate("TT.paused")
        await pg.evaluate(f"({PAD})(3)"); R["pausePadY"] = await pg.evaluate("TT.paused")
        await pg.evaluate("ttTogglePause()")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await pg.evaluate("saveGame()")
        await pg.reload(); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        R["afterReload"] = await pg.evaluate("[career.cur, czWS('titan'), truck.wb]")
        await pg.evaluate("wsSet('titan',1); applyModel('rigger'); saveGame()"); R["geomRigger"] = await pg.evaluate("truck.wb")
        ok = (R["geomTitan"][0] == 5.85 and R["rt"] == 1.05 and R["lt"] == 0.95 and R["key"] == 1.0 and R["slider"] == 1.2
              and R["pausedTap"] and R["stillWhilePaused"] and R["manualWhilePaused"] and R["playSpace"] and R["pausePadY"]
              and R["afterReload"][1] == 1.2 and R["afterReload"][2] == 5.85 and R["geomRigger"] == 3.8)
        print(json.dumps(R)); print("ERRS", errs[:3]); print("PASS" if ok and not errs else "FAIL"); await b.close()
asyncio.run(m())
