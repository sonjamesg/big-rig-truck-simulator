"""Store: owned trucks show a paint-shop button instead of swatches; unowned swatches change the colour.
Usage: python3 tests/store_colour_test.py"""
import asyncio, json, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = "/workspace/storecolour"
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        await pg.evaluate("truck.v=0; dealerState.sel=career.cur; openDealer({name:'BIG RIG TRUCKS'})"); await pg.wait_for_timeout(1200)
        R = {"own_sw": await pg.evaluate("document.querySelectorAll('#ui .stage .sw').length"),
             "own_btn": await pg.evaluate("!!document.querySelector('#repaint')")}
        await pg.evaluate("document.querySelector('#repaint').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + "/owned_phone.png")
        un = await pg.evaluate("(TRUCK_MODELS.find(m=>!career.owned.includes(m.id))||{}).id")
        await pg.evaluate(f"truck.money=1e7; dealerState.sel='{un}'; dealerState.col=null; renderDealer()"); await pg.wait_for_timeout(600)
        R["un_sw"] = await pg.evaluate("document.querySelectorAll('#ui .stage .sw').length")
        c0 = await pg.evaluate("document.querySelector('#ui .tt360').toDataURL().length")
        await pg.evaluate("document.querySelectorAll('#ui .stage .sw')[1].click()"); await pg.wait_for_timeout(800)
        R["un_col"] = await pg.evaluate("dealerState.col")
        c1 = await pg.evaluate("document.querySelector('#ui .tt360').toDataURL().length")
        R["canvas_changed"] = c0 != c1
        await pg.evaluate("document.querySelector('#ui .stage .sw').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + "/unowned_phone.png")
        await pg.evaluate(f"dealerState.sel=career.cur; renderDealer()"); await pg.wait_for_timeout(400)
        await pg.tap("#repaint"); await pg.wait_for_timeout(800)
        R["after_tap"] = await pg.evaluate("career.uiOpen"); R["tab"] = await pg.evaluate("CZ.tab")
        await pg.screenshot(path=OUT + "/paintshop_phone.png")
        ok = R["own_sw"] == 0 and R["own_btn"] and R["un_sw"] > 1 and R["un_col"] and R["canvas_changed"] and R["after_tap"] == "tune" and R["tab"] == "paint"
        print(json.dumps(R)); print("ERRS", errs[:3]); print("PASS" if ok and not errs else "FAIL"); await b.close()
asyncio.run(m())
