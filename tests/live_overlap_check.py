"""Live check: watch AI around the Airport Way T (Kingsbridge) for 50 s and list any overlapping vehicle pairs. Usage: python3 tests/live_overlap_check.py [url]"""
import asyncio,json
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1280,'height':800})
    import sys; await pg.goto(sys.argv[1] if len(sys.argv)>1 else 'https://sonjamesg.github.io/big-rig-truck-simulator/'); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=120000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
    sx,sy=await pg.evaluate("navSnap(1416,1800,40)")
    await pg.evaluate(f"(()=>{{const B=__bigrig,tk=B.truck; tk.x={sx}*M_T; tk.y={sy}*M_T; B.cam.zLock=0.4;B.cam.z=0.4; window.__o=[]; setInterval(()=>{{const vs=B.traffic.vs; for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){{const a=vs[i],c=vs[j]; if(Math.hypot(a.x-c.x,a.y-c.y)<1.2&&(a.layer|0)===(c.layer|0)&&!(a.ghostT>0||c.ghostT>0)&&__o.length<15) __o.push([a.x/M_T|0,a.y/M_T|0,a.id,c.id,a.kind,c.kind,+a.v.toFixed(1),+c.v.toFixed(1),!!a.parked,!!c.parked]);}} }},250);}})()")
    await pg.wait_for_timeout(50000); print(await pg.evaluate("JSON.stringify(__o)")); await b.close()
asyncio.run(m())
