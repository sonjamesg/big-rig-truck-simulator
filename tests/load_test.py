"""Load test (James 25 Oct: load stuck at 98 %). Phone (412x915 DPR 2.6 touch) and desktop profiles: records every
homeProgress(p) call, asserts it reaches 100 within BOUND seconds, and reports the post-stage init (j103Build: world.j3ms)
and the total. Also fails if the gap from the last stage to 100 % exceeds 1.5 s (was 4.4 s headless desktop before the fix:
j103Build scanned every world object once per new lower tile). Usage: python3 tests/load_test.py [index.html] [phone|desktop|both] [bound_s]"""
import asyncio,sys,json,os,time
from playwright.async_api import async_playwright
HTML=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'index.html'); MODE=sys.argv[2] if len(sys.argv)>2 else 'both'
BOUND=float(sys.argv[3]) if len(sys.argv)>3 else 60
INIT=r"""(()=>{ window.__prog=[]; const t0=performance.now(); let hp; Object.defineProperty(window,'homeProgress',{configurable:true,get(){return hp?function(p,t){ window.__prog.push([Math.round(p),Math.round(performance.now()-t0),String(t).slice(0,40)]); return hp.apply(this,arguments); }:undefined;},set(f){hp=f;}}); })()"""
async def run(p,prof):
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await (b.new_context(viewport={'width':412,'height':915},device_scale_factor=2.6,is_mobile=True,has_touch=True) if prof=='phone' else b.new_context(viewport={'width':1280,'height':800}))
  await ctx.add_init_script(INIT); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
  t=time.time(); await pg.goto('file://'+HTML); ok=True
  try: await pg.wait_for_function('window.__prog&&window.__prog.some(q=>q[0]>=100)',timeout=BOUND*1000)
  except Exception: ok=False
  wall=round(time.time()-t,1)
  r=await pg.evaluate("({prog:window.__prog.slice(-4),loadMs:Math.round((window.__bigrig&&__bigrig.world&&__bigrig.world.loadMs)||-1),j3ms:(window.__bigrig&&__bigrig.world&&__bigrig.world.j3ms),ready:!!(window.__bigrig&&__bigrig.world&&__bigrig.world.ready)})")
  await b.close(); r.update(ok=ok,wall=wall,errs=errs); return r
async def main():
  fails=[]
  async with async_playwright() as p:
    for prof in (['phone','desktop'] if MODE=='both' else [MODE]):
      r=await run(p,prof); print(prof,json.dumps(r))
      if not r['ok']: fails.append('%s: progress never reached 100 %% within %ds (last %s)'%(prof,BOUND,r['prog'][-1:]))
      pr=r['prog']
      if r['ok'] and len(pr)>1 and pr[-1][1]-pr[-2][1]>1500: fails.append('%s: %d ms between the last stage and 100 %% (post-load init too slow)'%(prof,pr[-1][1]-pr[-2][1]))
      if r['errs']: fails.append('%s errors %s'%(prof,r['errs'][:2]))
  print('FAIL' if fails else 'PASS',fails); sys.exit(1 if fails else 0)
asyncio.run(main())
