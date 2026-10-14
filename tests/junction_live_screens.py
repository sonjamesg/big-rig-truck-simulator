"""Live junction-audit screenshots: day + night at audited spots, AI vehicles seen and overlap samples. Usage: python3 tests/junction_live_screens.py [url] [prefix]"""
import asyncio,json
from playwright.async_api import async_playwright
import sys
U=sys.argv[1] if len(sys.argv)>1 else 'https://sonjamesg.github.io/big-rig-truck-simulator/'
PFX=sys.argv[2] if len(sys.argv)>2 else 'ja'
SP=[('airportway_T',1402,1786,0.8),('airportway_wide',1402,1786,0.4),('j34_cluster',445,288,0.7),('j129_cluster',1765,290,0.7),('rb3',None,3,0.6),('rb4',None,4,0.6),('chan_diag_N',1740,1680,0.7),('xroads_470_285',472,287,0.8),('xroads_470_393',472,395,0.8),('rb6',None,6,0.6)]
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); errs=[]; out={}
    pg=await b.new_page(viewport={'width':1280,'height':800}); pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto(U); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=120000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
    print('live has fix', await pg.evaluate("world.segs.some(s=>s.dir==='v'&&s.a===1400&&s.b0===1683&&s.b1===1787)"))
    for name,x,y,zm in SP:
      if x is None: x,y=await pg.evaluate(f"[world.rbs[{y}].cx,world.rbs[{y}].cy]")
      sx,sy=await pg.evaluate(f"(()=>{{const n=navSnap({x}+14,{y}+14,40)||[{x},{y}]; return n;}})()")
      await pg.evaluate(f"(()=>{{const B=__bigrig,tk=B.truck; tk.x={sx}*M_T; tk.y={sy}*M_T; tk.v=0; B.cam.zLock={zm}; B.cam.z={zm};}})()")
      await pg.evaluate("""(()=>{window.__pass=new Set(); window.__ov=0; window.__iv=setInterval(()=>{const vs=__bigrig.traffic.vs; const tk=__bigrig.truck; for(const v of vs) if(Math.hypot(v.x-tk.x,v.y-tk.y)<120) __pass.add(v.id); for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++) if(Math.hypot(vs[i].x-tk.x,vs[i].y-tk.y)<120&&Math.hypot(vs[i].x-vs[j].x,vs[i].y-vs[j].y)<1.2&&(vs[i].layer|0)===(vs[j].layer|0)&&!(vs[i].ghostT>0||vs[j].ghostT>0)) __ov++; },250);})()""")
      for tn,t in [('day',12),('night',23)]:
        await pg.evaluate(f"gameT={t}"); await pg.wait_for_timeout(25000); await pg.screenshot(path=f'/workspace/v2test/{PFX}_{name}_{tn}.png')
      out[name]=await pg.evaluate("(()=>{clearInterval(__iv); return {vehiclesSeen:__pass.size,overlapSamples:__ov};})()"); print(name,out[name],flush=True)
    print('errors',errs); await b.close()
asyncio.run(m())
