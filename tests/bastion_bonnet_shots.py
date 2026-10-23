"""Bastion 360 bonnet at several angles + top-down art. Usage: python3 tests/bastion_bonnet_shots.py <tag>"""
import asyncio, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); TAG = sys.argv[1]
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(viewport={'width': 1200, 'height': 700}); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1000)
        await pg.evaluate("""(()=>{const m=modelById('bastion');const c=document.createElement('canvas');c.width=1200;c.height=700;c.id='bb';
          c.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#1b2027';document.body.appendChild(c);const g=c.getContext('2d');
          const yaws=[-0.4,-0.8,-1.2,0.4,0.8,0];yaws.forEach((y,i)=>ttDraw(g,200+(i%3)*400,230+Math.floor(i/3)*330,40,y,0.26,m,m.cols[0],{}));
          const a=modelArt(m,m.cols[0]);g.save();g.translate(1150,350);g.drawImage(a.c,-a.W/2,-a.H/2);g.restore();})()""")
        await pg.wait_for_timeout(300); await pg.screenshot(path=f"/workspace/storecolour/bastion_{TAG}.png")
        print("ERRS", errs[:3]); await b.close()
asyncio.run(m())
