"""Dock shots: gate, quay, map. Usage: dock_shots.py [html|url] [prefix] [hour]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1]; PRE=sys.argv[2]; HR=float(sys.argv[3]) if len(sys.argv)>3 else 12
URL=SRC if SRC.startswith('http') else 'file://'+os.path.abspath(SRC)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; out={}
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    await pg.evaluate(f"(()=>{{ gameT={HR}; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; }})()")
    for pi in [0,1]:
      for nm,js in [('gate','[P.lorU,P.lor[0]]'),('quay','[0,(P.vA+P.vB)/2]'),('yard','[(P.legL+P.tl1)/2,(P.vA+P.vB)/2]')]:
        q=await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; if(!P) return null; const l={js}; const w=PL(P,l[0],l[1]); const t=__bigrig.truck; if(t.trl){{ t.trl.coupled=false; t.trl=null; }} t.x=w[0]*M_T-30; t.y=w[1]*M_T; t.v=0; return w; }})()")
        if not q: continue
        for k in range(3):
          await pg.wait_for_timeout(1200 if k else 2500); await pg.screenshot(path=f'{PRE}_p{pi}_{nm}_{k}.png')
      # block test: park the truck in the gate lane and in the tractor loop; dock vehicles must stop short of it
      bl=await pg.evaluate(f"""(()=>{{ const P=portList()[{pi}]; const w=PL(P,P.lorU,P.lor[0]+P.laneDir*14); const t=__bigrig.truck; t.x=w[0]*M_T; t.y=w[1]*M_T; t.h=Math.atan2(P.U[1]*0+P.V[1]*P.laneDir,P.U[0]*0+P.V[0]*P.laneDir)+Math.PI/2; t.v=0; return 1; }})()""")
      mind=1e9
      for k in range(8):
        await pg.wait_for_timeout(1500)
        d=await pg.evaluate(f"""(()=>{{ const P=portList()[{pi}]; let m=1e9, y=0; for(const l of P.lors){{ const w=PL(P,P.lorU,P.lor[0]+P.laneDir*l.p); m=Math.min(m,Math.hypot(w[0]*M_T-__bigrig.truck.x,w[1]*M_T-__bigrig.truck.y)); if(l.yield) y++; }} return [m,y,P.lors.length]; }})()""")
        mind=min(mind,d[0]); out.setdefault('block%d'%pi,[]).append(d)
        if k in (3,7): await pg.screenshot(path=f'{PRE}_p{pi}_block_{k}.png')
      out['minDist%d'%pi]=mind
      await pg.evaluate("openMap()"); await pg.wait_for_timeout(300)
      await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const w=PL(P,0,(P.vA+P.vB)/2); bigmap.zt=bigmap.z=3.2; bigmap.cx=w[0]; bigmap.cy=w[1]; bigmap.anchor=null; }})()"); await pg.wait_for_timeout(800)
      await pg.screenshot(path=f'{PRE}_p{pi}_map.png'); await pg.evaluate("closeMap()")
    out['errors']=errs; print(json.dumps(out)); await b.close()
asyncio.run(main())
