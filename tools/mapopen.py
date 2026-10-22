"""World map open time: python3 tools/mapopen.py [shot.png]  -> first-frame ms, frames until detail complete, long frames"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = """() => new Promise(res => { const out = {f: []}; let t0;
  const step = (t) => { const now = performance.now(); out.f.push(+(now - t0).toFixed(1)); t0 = now;
    if (out.ready == null && bigmap.miss === 0 && out.f.length > 1) out.ready = +(now - out.start).toFixed(0);
    if (now - out.start < 4000) requestAnimationFrame(step); else { out.ovN = OV.n; out.ovT = OV.total; res(out); } };
  out.start = t0 = performance.now(); openMap(); requestAnimationFrame(step); })"""
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(int(os.environ.get("WAIT", 8000)))
        res = []
        for k in range(3):
            r = await pg.evaluate(JS); f = r.pop("f")
            r.update(first=f[1] if len(f) > 1 else None, max=max(f[1:]), long=sum(1 for x in f[1:] if x > 50), sumFirst10=round(sum(f[1:11])))
            res.append(r)
            if k == 0 and len(sys.argv) > 1: await pg.screenshot(path=sys.argv[1])
            await pg.evaluate("closeMap()"); await pg.wait_for_timeout(3000)
        print(json.dumps(res), errs[:2]); await b.close()
asyncio.run(m())
