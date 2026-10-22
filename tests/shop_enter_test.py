"""Tune shop / truck shop Enter buttons (v70): no auto-open, button shows on the bay/pad, opens only under 3 mph.
Usage: python3 tests/shop_enter_test.py [shotdir]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = sys.argv[1] if len(sys.argv) > 1 else None
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        R = {}
        for name, place, btn, kind in [
            ("dealer", "(()=>{const d=world.dealers[0],p=d.pad,f=fwd(truck.h); truck.x=(p.x0+p.x1)/2-f[0]*1.9; truck.y=(p.y0+p.y1)/2-f[1]*1.9; return 1;})()", "dlGo", "dealer"),
            ("tune", "(()=>{const b=czBays().find(b=>!b.yd); const f=fwd(truck.h); truck.x=b.x-f[0]*2.2; truck.y=b.y-f[1]*2.2; return 1;})()", "czGo", "tune")]:
            await pg.evaluate("career.uiOpen=null; document.querySelectorAll('.mback').forEach(e=>e.remove())")
            await pg.evaluate("truck.v=3"); await pg.evaluate(place); await pg.wait_for_timeout(600)
            moving = await pg.evaluate(f"(()=>{{truck.v=3; const e=document.getElementById('{btn}'); return {{btn:!!e, txt:e?e.textContent:'', open:career.uiOpen}};}})()")
            await pg.evaluate("truck.v=3"); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
            movingEnter = await pg.evaluate("career.uiOpen")
            await pg.evaluate("truck.v=0"); await pg.wait_for_timeout(1500)
            stopped = await pg.evaluate(f"(()=>{{const e=document.getElementById('{btn}'); return {{btn:!!e, txt:e?e.textContent:'', open:career.uiOpen}};}})()")
            if SHOT: await pg.screenshot(path=f"{SHOT}/{name}_enter_prompt.png")
            await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
            opened = await pg.evaluate("career.uiOpen")
            R[name] = {"moving": moving, "movingEnterOpened": movingEnter, "stopped": stopped, "afterEnter": opened}
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        ok = all(r["moving"]["btn"] and not r["moving"]["open"] and not r["movingEnterOpened"] and r["stopped"]["btn"] and not r["stopped"]["open"] and r["afterEnter"] for r in R.values())
        print(json.dumps(R)); print("ERRS", errs[:3]); print("PASS" if ok and not errs else "FAIL"); await b.close()
asyncio.run(m())
