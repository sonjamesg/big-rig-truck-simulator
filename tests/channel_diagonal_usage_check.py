"""Channel Diagonal usage: count AI vehicles that pass its north T and how many turn onto the diagonal in 90 s. Usage: python3 tests/channel_diagonal_usage_check.py [BigRig.html]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page()
    await pg.goto('file://'+os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html'))); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=120000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
    print(await pg.evaluate("""(()=>{const C=world.kbChan; const r=[]; for(const s of C){ r.push({id:s.id,a:s.a,b0:s.b0,b1:s.b1,js:s.js.map(J=>({id:J.id,hs:J.hs,vs:J.vs,x:J.x,y:J.y,lights:J.lights,opts:[1,-1].map(d=>{const H=world.segs[J.hs];return jOptions(J,H,d).opts.map(o=>o[0]+o[3])}) }))}); } const cv=world.curves.find(c=>c.name==='Channel Diagonal'); return JSON.stringify({r,cv:cv&&{id:cv.id,n:cv.pts.length}}); })()"""))
    await pg.evaluate("""(()=>{const tk=__bigrig.truck; tk.x=1745*M_T; tk.y=1700*M_T; window.__cu=new Set(); window.__pass=new Set(); const cv=world.curves.find(c=>c.name==='Channel Diagonal'); setInterval(()=>{ for(const v of __bigrig.traffic.vs){ const x=v.x/M_T,y=v.y/M_T; if(Math.hypot(x-1740,y-1680)<14) __pass.add(v.id); for(let i=0;i<cv.pts.length;i+=8){ const p=cv.pts[i]; if(Math.hypot(p[0]-x,p[1]-y)<3){ __cu.add(v.id); break; } } } },200); })()""")
    await pg.wait_for_timeout(90000)
    print('chan users in 90s', await pg.evaluate("__cu.size"),'passing T', await pg.evaluate("__pass.size"), 'vehicles near', await pg.evaluate("__bigrig.traffic.vs.length"))
    await b.close()
asyncio.run(m())
