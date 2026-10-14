"""Gate lorries vs AI traffic on the public-road stretch: no body overlaps, both sides yield. Usage: dock3_traffic_test.py [html|url] [prefix] [hour]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1]; PRE=sys.argv[2]; HR=float(sys.argv[3]) if len(sys.argv)>3 else 12
URL=SRC if SRC.startswith('http') else 'file://'+os.path.abspath(SRC)
CHK="""((pi)=>{ const P=portList()[pi]; let ov=0, near=1e9, ly=0, cy=0; for(const l of P.lors){ if(l.x==null) continue; if(l.yield) ly++; const pts=portLorryPts(P,l);
  for(const o of traffic.vs){ const f=fwd(o.h||0), r=rgt(o.h||0), hl=(o.L||4.6)/2, hw=(o.W||1.8)/2; for(const q of pts){ const rx=q[0]-o.x, ry=q[1]-o.y, a=Math.abs(rx*f[0]+ry*f[1]), b=Math.abs(rx*r[0]+ry*r[1]);
      near=Math.min(near,Math.hypot(rx,ry)); if(a<hl+0.2&&b<hw+0.9) ov++; } } }
  for(const o of traffic.vs) if(portLorryAcc(o,o.vmax||13)<0) cy++; return [ov,Math.round(near*10)/10,ly,cy,P.lors.filter(l=>l.x!=null&&(l.p<0||l.p>P.laneLen)).length,traffic.vs.length]; })"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; out={'fail':[]}
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    await pg.evaluate(f"(()=>{{ gameT={HR}; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; }})()")
    for pi in [0,1]:
      tot={'overlaps':0,'minDist':1e9,'lorryYieldFrames':0,'carBrakeFrames':0,'onRoadFrames':0,'maxCars':0}; shot=0
      for leg,(s0) in enumerate(['pre','post']):
        # camera beside the public-road stretch (not on it), entry leg then exit leg
        await pg.evaluate(f"""(()=>{{ const P=portList()[{pi}]; const q=polyAt(P.lpath,'{s0}'==='pre'?P.lpre*0.55:P.lpre+P.laneLen+P.lpost*0.45), w=PL(P,q[0],q[1]); const t=__bigrig.truck; if(t.trl){{ t.trl.coupled=false; t.trl=null; }} t.x=w[0]*M_T; t.y=w[1]*M_T+(P===world.kbPort?-14:14); t.v=0; }})()""")
        for k in range(45):
          await pg.wait_for_timeout(1000)
          r=await pg.evaluate(CHK+f"({pi})")
          tot['overlaps']+=r[0]; tot['minDist']=min(tot['minDist'],r[1]); tot['lorryYieldFrames']+=1 if r[2] else 0; tot['carBrakeFrames']+=1 if r[3] else 0; tot['onRoadFrames']+=1 if r[4] else 0; tot['maxCars']=max(tot['maxCars'],r[5])
          if r[4] and shot<4 and k%3==0: await pg.screenshot(path=f'{PRE}_p{pi}_{s0}_{shot}.png'); shot+=1
        if shot==0: await pg.screenshot(path=f'{PRE}_p{pi}_{s0}_x.png')
      out[f'port{pi}']=tot
      if tot['overlaps']: out['fail'].append(f'port {pi}: {tot["overlaps"]} lorry/car overlaps')
      if not tot['onRoadFrames']: out['fail'].append(f'port {pi}: no lorry seen on the public road')
    out['errors']=errs
    if errs: out['fail'].append('page errors')
    print(json.dumps(out)); print('PASS' if not out['fail'] else 'FAIL'); await b.close()
asyncio.run(main())
