"""Render every truck on the real 360 turntable (ttDraw) at 8 yaw angles -> one contact sheet per truck.
Background is bright magenta so any see-through gap in the body is obvious. Usage: python3 tests/solid360_shots.py outdir"""
import asyncio, os, sys, base64
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/solid360"
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("typeof ttDraw==='function'&&typeof TRUCK_MODELS!=='undefined'", timeout=300000)
        await pg.wait_for_timeout(1500)
        R = await pg.evaluate("""(()=>{const o={};for(const m of TRUCK_MODELS){const W=400,H=260,c=document.createElement('canvas');c.width=W*4;c.height=H*2;
          const g=c.getContext('2d');g.fillStyle='#ff00ff';g.fillRect(0,0,c.width,c.height);
          for(let i=0;i<8;i++){const x=(i%4)*W,y=Math.floor(i/4)*H;g.save();g.beginPath();g.rect(x,y,W,H);g.clip();
            ttDraw(g,x+W/2,y+H*0.74,36,i*Math.PI/4+0.01,0.26,m,m.cols[0],{});g.fillStyle='#000';g.font='14px sans-serif';g.fillText(m.name+' '+(i*45)+'\u00B0',x+6,y+16);g.restore();}
          o[m.id]=c.toDataURL();}return o})()""")
        for k, v in R.items():
            open(f"{OUT}/{k}.png", "wb").write(base64.b64decode(v.split(",")[1]))
        print(list(R), "ERRS", errs[:3]); await b.close()
asyncio.run(m())
