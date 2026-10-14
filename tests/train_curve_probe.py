"""Train-on-curve frame sequence + curve smoothness metric. Usage: train_curve_probe.py [html|url] [prefix]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','index.html')
PRE=sys.argv[2] if len(sys.argv)>2 else '/workspace/v2test/tn_curve'
URL=SRC if SRC.startswith('http') else 'file://'+os.path.abspath(SRC)
FIND=r"""(()=>{ const R=__bigrig.RAIL, L=R.L; let best=null;
 // tightest curve (radius over 40 m chord), avoid hub
 for(let s=0;s<L;s+=4){ const a=s,b=(s+20)%L,c=(s+40)%L; const ax=R.X[a],ay=R.Y[a],bx=R.X[b],by=R.Y[b],cx=R.X[c],cy=R.Y[c]; const A2=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax)); if(A2<1e-6) continue; const r=Math.hypot(bx-ax,by-ay)*Math.hypot(cx-bx,cy-by)*Math.hypot(cx-ax,cy-ay)/(2*A2);
   if(Math.abs(((b-R.hub.s)%L+L)%L-L/2)<L/2-500 && (!best||r<best.r)) best={r,s:b}; }
 // heading jitter metric: max |d2 heading| at 1 m along the centreline
 let jit=0; for(let s=2;s<L-2;s++){ const h0=Math.atan2(R.Y[s]-R.Y[s-1],R.X[s]-R.X[s-1]), h1=Math.atan2(R.Y[s+1]-R.Y[s],R.X[s+1]-R.X[s]); let d=h1-h0; d=Math.atan2(Math.sin(d),Math.cos(d)); jit=Math.max(jit,Math.abs(d)); }
 // a time when a train is mid-curve
 const T0=railTime(); let hit=null; for(let dt=0;dt<4000&&!hit;dt+=1){ for(const tr of R.trains){ const h=railHead(tr,T0+dt), mid=tr.pax?h-tr.len/2:h+tr.len/2; const d=Math.abs(((mid-best.s)%L+L+L/2)%L-L/2); if(d<15){ hit={dt,pax:tr.pax}; break; } } }
 return {best,jitDeg:jit*180/Math.PI,hit,T0,x:R.X[best.s],y:R.Y[best.s],nx:R.NX[best.s],ny:R.NY[best.s]}; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(195,600); await pg.wait_for_timeout(800)
    f=await pg.evaluate("(()=>{ gameT=12; WX&&(WX.st='clear'); return 1; })()")
    f=await pg.evaluate(FIND); print(json.dumps(f))
    await pg.evaluate(f"(()=>{{ const t=__bigrig.truck; t.x={f['x']}+{f['nx']}*45; t.y={f['y']}+{f['ny']}*28; t.v=0; }})()")
    T=f['T0']+f['hit']['dt']-12
    for k in range(8):
      tt=T+k*3
      await pg.evaluate(f"(()=>{{ const tt={tt}; gameDay=Math.floor(tt/DAY_LEN); gameT=(tt-gameDay*DAY_LEN)*24/DAY_LEN; RAIL._t=null; }})()")
      await pg.wait_for_timeout(250)
      await pg.screenshot(path=f'{PRE}_{k}.png')
    print('errors',errs); await b.close()
asyncio.run(main())
