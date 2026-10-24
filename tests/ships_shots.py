"""Ship departure + tug shots. Usage: ships_shots.py html outdir port(0|1) day|night"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
SRC,OUT,PI,MODE=sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4]
os.makedirs(OUT,exist_ok=True)
FF=r"""([pi,cond,maxs,mode])=>{ const P=portList()[pi]; const f=new Function('P','S','return '+cond);
  const okH=()=>{ const h=gameT; return mode==='any'||(mode==='night'?(h>21.2||h<4):(h>9.5&&h<15.5)); };
  for(let i=0;i<maxs;i++){ const S=(P.cur&&P.cur.ships)||[]; if(f(P,S)&&okH()) return [i,gameT]; updateDayNight(0.1,true); for(const Q of portList()) updateOnePort(Q,0.1); } return [-1,gameT]; }"""
CAM=r"""([pi,z])=>{ const P=portList()[pi]; const t=P.tugs[0]; const o=(P.cur.ships||[]).find(s=>s.k===P.watch)||null; let u=t.u,v=t.v;
  if(o&&z<1){ u=(o.pose.u+t.u)/2; v=(o.pose.v+t.v)/2; } const w=PL(P,u,v); window.__camHold=[w[0]*TILE,w[1]*TILE]; cam.zLock=z; cam.z=z; return [u,v,o&&o.pose.k,P.tugs.map(t=>t.st)]; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; log=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto('file://'+os.path.abspath(SRC)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    await pg.evaluate("(()=>{ WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; })()")
    r=await pg.evaluate(FF,[PI,"P.tugs&&P.tugs.every(t=>t.st==='idle')",200000,MODE]); log.append(['idle',r])
    await pg.evaluate(f"(()=>{{ const P=portList()[{PI}]; const b=P.tugBerth[0]; const w=PL(P,b[0]+2,b[1]); window.__camHold=[w[0]*TILE,w[1]*TILE]; cam.zLock=cam.z=1.6; }})()")
    await pg.wait_for_timeout(2500); await pg.screenshot(path=f'{OUT}/{MODE}_p{PI}_tugberth.png')
    stages=[('1_tugs_sail_out',"P.tugs.some(t=>t.st==='out'&&t.wp.length===0)",0.55),
            ('2_made_fast',"P.tugs.every(t=>t.st==='tow')",0.55),
            ('3_pull_off_berth',"S.some(s=>s.k===P.watch&&s.pose.k==='sideOut'&&s.pose.f>0.55)",0.5),
            ('4_turning',"S.some(s=>s.k===P.watch&&s.tl>P.tOut+40)",0.45),
            ('5_turning_late',"S.some(s=>s.k===P.watch&&s.tl>P.tOut+75)",0.45),
            ('6_escort_to_mouth',"S.some(s=>s.k===P.watch&&s.tl>P.tRel-25)",0.45),
            ('7_released',"P.tugs.every(t=>t.st==='clear'||t.st==='home')",0.5),
            ('8_tugs_return',"P.tugs.every(t=>t.st==='home')",0.6)]
    r=await pg.evaluate(FF,[PI,"P.tugs.some(t=>t.st==='out')",400000,MODE]); log.append(['call',r])
    await pg.evaluate(f"(()=>{{ const P=portList()[{PI}]; P.watch=P.tugs[0].ship; }})()")
    for nm,cond,z in stages:
      r=await pg.evaluate(FF,[PI,cond,40000,'any']); c=await pg.evaluate(CAM,[PI,z]); log.append([nm,r,c])
      await pg.wait_for_timeout(2200); await pg.screenshot(path=f'{OUT}/{MODE}_p{PI}_{nm}.png')
      await pg.evaluate(CAM,[PI,1.6]); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}/{MODE}_p{PI}_{nm}_close.png')
    print(json.dumps({'log':log,'errors':errs})); await b.close()
asyncio.run(main())
