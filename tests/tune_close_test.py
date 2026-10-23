"""Tune shop close: the X button (mouse + touch tap), Esc key and controller B all close the shop like DONE.
Usage: python3 tests/tune_close_test.py"""
import asyncio, json, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        async def open_():
            await pg.evaluate("career.uiOpen=null; document.querySelectorAll('.mback').forEach(e=>e.remove()); truck.v=0; czOpen()")
            await pg.wait_for_timeout(400); return await pg.evaluate("career.uiOpen")
        R = {}
        R["open"] = await open_()
        await pg.click("#czClose"); await pg.wait_for_timeout(400); R["mouse"] = await pg.evaluate("career.uiOpen")
        await open_(); await pg.tap("#czClose"); await pg.wait_for_timeout(400); R["touch"] = await pg.evaluate("career.uiOpen")
        await open_(); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400); R["esc"] = await pg.evaluate("career.uiOpen")
        await open_()
        R["padB"] = await pg.evaluate("""(()=>{const g={axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===1}))};
          czPad(g,(i)=>i===1,performance.now(),0.016); return career.uiOpen})()""")
        await open_(); await pg.click("#czAct"); await pg.wait_for_timeout(400); R["done"] = await pg.evaluate("career.uiOpen")
        ok = R["open"] == "tune" and all(R[k] is None for k in ("mouse", "touch", "esc", "padB", "done"))
        print(json.dumps(R)); print("ERRS", errs[:3]); print("PASS" if ok and not errs else "FAIL"); await b.close()
asyncio.run(m())
