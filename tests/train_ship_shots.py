"""Night ships (clear/rain/fog) + world-map trains (pax/freight, tap popup, legend). Usage: train_ship_shots.py [html|url] [prefix]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','index.html')
PRE=sys.argv[2] if len(sys.argv)>2 else '/workspace/v2test/tn'
URL=SRC if SRC.startswith('http') else 'file://'+os.path.abspath(SRC)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; out={}
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    # ships: find a time when a ship is berthed / visible at the main port, at night
    for wx in ['clear','rain','fog']:
      r=await pg.evaluate("""(wx)=>{ const P=portList()[0]; gameT=23; WX.st=wx; WX.rain=wx==='rain'?1:0; WX.fog=wx==='fog'?1:0; WX.wet=WX.rain; WX.timer=1e6;
        let t0=railTime(), hit=null; for(let dt=0;dt<3000;dt+=5){ const sh=portShips(P,t0+dt); const o=sh.find(o=>o.pose&&(o.pose.k==='in'||o.pose.k==='out'||true)); if(o){ hit=[dt,o.pose]; if(dt>0) break; } }
        return {hit,t0}; }""",wx)
      if not r['hit']: out['ship_'+wx]='no ship'; continue
      dt=r['hit'][0]
      await pg.evaluate(f"""(()=>{{ const tt=railTime()+{dt}+20; gameDay=Math.floor(tt/DAY_LEN); gameT=(tt-gameDay*DAY_LEN)*24/DAY_LEN; if(gameT<20){{ const d=Math.floor(tt/DAY_LEN); }} }})()""")
      await pg.wait_for_timeout(300)
      # if clock is daytime, shift by whole days isn't possible (timetable period); instead force darkness via night hour of a later day with same ship phase
      pos=await pg.evaluate("""(()=>{ const P=portList()[0]; const o=(P.cur&&P.cur.ships||[])[0]||portShips(P,railTime())[0]; if(!o) return null; const w=PL(P,o.pose.u,o.pose.v); const t=__bigrig.truck; t.x=w[0]*M_T; t.y=w[1]*M_T; t.v=0; return [w[0],w[1],gameT,o.pose.k,DN.dark]; })()""")
      await pg.wait_for_timeout(1500)
      pos2=await pg.evaluate("[gameT,DN.dark,WX.rain,WX.fog]")
      out['ship_'+wx]=[pos,pos2]
      await pg.screenshot(path=f'{PRE}_ship_night_{wx}.png')
    # map trains
    await pg.evaluate("(()=>{ gameT=12; WX.st='clear'; WX.rain=0; WX.fog=0; })()"); await pg.wait_for_timeout(500)
    for kind in ['pax','frt']:
      q=await pg.evaluate(f"""(()=>{{ const tr=RAIL.trains.find(t=>{'t.pax' if kind=='pax' else '!t.pax'}); const ps=railTrainPoses(tr,railTime()); const m=ps[ps.length>>1]; return [m.x/M_T,m.y/M_T,tr.id]; }})()""")
      await pg.evaluate("openMap()"); await pg.wait_for_timeout(300)
      await pg.evaluate(f"(()=>{{ bigmap.leg=true; bigmap.zt=bigmap.z=7; bigmap.cx={q[0]}; bigmap.cy={q[1]}; bigmap.anchor=null; }})()"); await pg.wait_for_timeout(600)
      # real tap on the train's middle car (screen centre of the map view)
      cpos=await pg.evaluate("""(()=>{ const r=cv.getBoundingClientRect(); return [r.left+r.width/2, r.top+(VH/2+10)*r.height/VH]; })()""")
      await pg.mouse.click(cpos[0],cpos[1]); await pg.wait_for_timeout(500)
      sel=await pg.evaluate("RAIL.mapSel?RAIL.mapSel.id:null"); out['tap_'+kind]=[q[2],sel]
      await pg.screenshot(path=f'{PRE}_map_{kind}.png')
      await pg.evaluate("(()=>{ RAIL.mapSel=null; bigmap.zt=bigmap.z=1.2; })()"); await pg.wait_for_timeout(400)
      await pg.screenshot(path=f'{PRE}_map_{kind}_out.png')
      await pg.evaluate(f"""(()=>{{ gameT=23; const tr=RAIL.trains.find(t=>{'t.pax' if kind=='pax' else '!t.pax'}); const ps=railTrainPoses(tr,railTime()); const m=ps[ps.length>>1]; bigmap.cx=m.x/M_T; bigmap.cy=m.y/M_T; bigmap.zt=bigmap.z=7; }})()"""); await pg.wait_for_timeout(1500)
      await pg.screenshot(path=f'{PRE}_map_{kind}_night.png')
      await pg.evaluate("(()=>{ gameT=12; closeMap(); })()"); await pg.wait_for_timeout(400)
    out['errors']=errs; print(json.dumps(out)); await b.close()
asyncio.run(main())
