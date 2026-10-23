"""Per truck: side (czSide), top (czArt) and 360 (ttDraw x4 angles) from real game art -> one sheet per truck.
Usage: python3 tests/wheel_sheets.py outdir"""
import asyncio, os, sys, base64
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = sys.argv[1]
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("typeof ttDraw==='function'", timeout=300000)
        await pg.wait_for_timeout(1500)
        R = await pg.evaluate("""(()=>{const o={};for(const m of TRUCK_MODELS){const c=document.createElement('canvas');c.width=1500;c.height=560;
          const g=c.getContext('2d');g.fillStyle='#d8dde3';g.fillRect(0,0,1500,560);g.fillStyle='#000';g.font='16px sans-serif';
          g.fillText(m.name+'  side / top / 360',8,18);
          czSide(g,560,250,60,m,m.cols[0],{});g.strokeStyle='#888';g.beginPath();g.moveTo(0,250);g.lineTo(700,250);g.stroke();
          const A=czArt(m,m.cols[0],{});const s=Math.min(250/A.W,520/A.H);g.drawImage(A.c,760,30,A.W*s,A.H*s);
          for(let i=0;i<4;i++){const x=1010+(i%2)*245,y=30+Math.floor(i/2)*265;g.save();g.beginPath();g.rect(x,y,240,260);g.clip();
            ttDraw(g,x+120,y+190,22,[0.6,2.5,3.75,5.5][i],0.26,m,m.cols[0],{});g.restore();}
          o[m.id]=c.toDataURL();}return o})()""")
        for k, v in R.items(): open(f"{OUT}/{k}.png", "wb").write(base64.b64decode(v.split(",")[1]))
        print(list(R), "ERRS", errs[:3]); await b.close()
asyncio.run(m())
