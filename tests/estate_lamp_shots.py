"""Night shots of the 3 densest housing estates + lamp counts. Usage: estate_lamp_shots.py html outdir prefix"""
import asyncio,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1]; OUT=sys.argv[2]; PRE=sys.argv[3] if len(sys.argv)>3 else ''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto('file://'+os.path.abspath(SRC)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=300000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    info=await pg.evaluate("""(()=>{const H=world.objects.filter(o=>(o.kind==='bldg'&&o.style==='house')||o.kind==='drive');
      const sc=H.map(o=>[o,H.filter(q=>Math.abs(q.x-o.x)<450&&Math.abs(q.y-o.y)<300).length]).sort((a,b)=>b[1]-a[1]);const pick=[];
      for(const [o] of sc){if(pick.every(p=>Math.hypot(p[0]-o.x,p[1]-o.y)>2500))pick.push([o.x,o.y]);if(pick.length==3)break}
      const L=slBuild();let bad=0;for(const l of L){const tx=Math.floor(l.px/TILE),ty=Math.floor(l.py/TILE);if(inb(tx,ty)&&(G[idx(tx,ty)]===T.ROAD||G[idx(tx,ty)]===T.BLDG))bad++;
        for(const J of world.junctions)if(tx>=J.x&&tx<J.x+J.w&&ty>=J.y&&ty<J.y+J.h)bad++}
      const t0=performance.now();SL.list=null;slBuild();const ms=performance.now()-t0;
      return {pick,lamps:L.length,postsOnRoadOrInJunction:bad,buildMs:Math.round(ms)}})()""")
    for i,pt in enumerate(info['pick']):
      await pg.evaluate(f"(()=>{{ window.__camHold=[{pt[0]},{pt[1]}]; cam.zLock=0.9; truck.x={pt[0]}/PPM+60; truck.y={pt[1]}/PPM+60; truck.v=0; gameT=23; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; }})()")
      await pg.wait_for_timeout(3500); await pg.screenshot(path=f'{OUT}/{PRE}estate{i+1}_night.png')
    print('info',info,'errors',errs); await b.close()
asyncio.run(main())
