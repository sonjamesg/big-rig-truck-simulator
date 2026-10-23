"""LGV learner trailer shots + checks. Usage: lgv_trailer_shots.py [html|url] [outdir]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1]; OUT=sys.argv[2]
URL=SRC if SRC.startswith('http') else 'file://'+os.path.abspath(SRC)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    info=await pg.evaluate("""(()=>{ const L=LTG.trl||[]; const inW=__bigrig.world.trailers.some(t=>t.decor); const t=__bigrig.truck; if(t.trl){t.trl.coupled=false;t.trl=null;}
      t.x=ltgTX(26)*M_T; t.y=ltgTY(26.5)*M_T; t.h=0; t.v=0;
      const solid=L.map(tr=>{ const b=trailerBox(tr); let bad=0; for(const s of [-1,1]) for(const a of [-1,0,1]){ const f=fwd(b.h),r=rgt(b.h); const x=b.x+f[0]*a*6.5+r[0]*s*1.2, y=b.y+f[1]*a*6.5+r[1]*s*1.2; if(solidAtM(x,y)) bad++; } return bad; });
      return {n:L.length, pos:L.map(t=>[+(t.x/M_T-LTG.X0).toFixed(1),+(t.y/M_T-LTG.Y0).toFixed(1),t.type]), solidPts:solid, cand: coupleCandidate()&&coupleCandidate().tr.decor||false, inWorldList:inW}; })()""")
    for hr,nm in [(12,'day'),(23,'night')]:
      await pg.evaluate(f"(()=>{{ gameT={hr}; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; }})()")
      await pg.wait_for_timeout(2500); await pg.screenshot(path=f'{OUT}/lgv_{nm}.png')
      await pg.evaluate("openMap()"); await pg.wait_for_timeout(300)
      await pg.evaluate("(()=>{ bigmap.zt=bigmap.z=3.2; bigmap.cx=ltgTX(30); bigmap.cy=ltgTY(25); bigmap.anchor=null; })()"); await pg.wait_for_timeout(900)
      await pg.screenshot(path=f'{OUT}/lgv_map_{nm}.png'); await pg.evaluate("closeMap()")
    # collision: drive into a trailer nose
    hit=await pg.evaluate("""(()=>{ const tr=LTG.trl[0]; const t=__bigrig.truck; t.x=tr.x; t.y=tr.y+6; t.h=0; t.v=0; return trailerHitTest(t); })()""")
    info['hit']=hit; info['errors']=errs; print(json.dumps(info)); await b.close()
asyncio.run(main())
