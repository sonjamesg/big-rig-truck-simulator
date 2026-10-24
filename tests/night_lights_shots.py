"""Night shots: city, housing, industrial, truck-repairs yard. Usage: night_lights_shots.py html outdir prefix"""
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
    spots=await pg.evaluate("""(()=>{const B=world.objects.filter(o=>o.kind==='bldg');
      const dens=(o,st)=>B.filter(q=>q.style===st&&Math.abs(q.x-o.x)<500&&Math.abs(q.y-o.y)<400).length;
      const best=st=>{let bo=null,bn=-1;const L=B.filter(o=>o.style===st);for(let i=0;i<L.length;i+=Math.max(1,(L.length/60)|0)){const n=dens(L[i],st);if(n>bn){bn=n;bo=L[i]}}return bo?[bo.x+bo.w/2,bo.y+bo.h/2]:null};
      const cy=B.filter(o=>o.cyber);const c=cy[(cy.length/2)|0];const g=(world.garages||[])[0];
      return {city:[c.x+c.w/2,c.y+c.h/2],housing:best('house'),industrial:best('warehouse'),repairs:g?[g.x*PPM,g.y*PPM-60]:null}})()""")
    for nm,pt in spots.items():
      if not pt: continue
      await pg.evaluate(f"(()=>{{ window.__camHold=[{pt[0]},{pt[1]}]; cam.zLock=0.9; truck.x={pt[0]}/PPM+40; truck.y={pt[1]}/PPM+40; truck.v=0; gameT=23; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; }})()")
      await pg.wait_for_timeout(3500); await pg.screenshot(path=f'{OUT}/{PRE}{nm}_night.png')
    print('spots',spots,'errors',errs); await b.close()
asyncio.run(main())
