"""Map debug logger test: phone profile, ?mapdbg=1, night, open the map, pan right (touch drags), then CRASH the renderer
(CDP Page.crash, like an Aw Snap) and reload: the banner must say the map may have crashed, the saved log must hold samples
from the pan, and the HUD must have been visible. Also checks no night base image on LOWMEM.
Usage: python3 tests/mapdbg_test.py [index.html]"""
import asyncio,sys,json,os
from playwright.async_api import async_playwright
HTML=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'index.html')
async def main():
  fails=[]
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await b.new_context(viewport={'width':412,'height':915},device_scale_factor=2.6,is_mobile=True,has_touch=True)
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    url='file://'+HTML+'?mapdbg=1'
    await pg.goto(url); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
    print('loaded',flush=True)
    await pg.keyboard.press('Enter'); await pg.mouse.click(200,500); await pg.wait_for_timeout(1500)
    await pg.evaluate("truck.x=300*M_T;truck.y=826*M_T;gameT=22.5"); await pg.wait_for_timeout(500)
    await pg.evaluate("openMap()"); await pg.wait_for_timeout(800)
    await pg.evaluate("mapZoomTo(0.87)"); await pg.wait_for_timeout(1000)
    cdp=await ctx.new_cdp_session(pg)
    for i in range(12):
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':350,'y':450}]})
      for k in range(1,9): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':350-k*35,'y':450}]}); await pg.wait_for_timeout(16)
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(120)
    await pg.wait_for_timeout(1300)
    live=await pg.evaluate("({hud:!!(MDBG.hud&&MDBG.hud.style.display!=='none'),txt:MDBG.hud?MDBG.hud.textContent:'',n:MDBG.buf.length,cc:chunkCache.size,mapc:MAPC.cache.size,big:MDBG.big.filter(b=>b[3]&&!/fogDraw/.test(b[2])),nm:NM.base?1:0,lowmem:LOWMEM,errs:MDBG.errs})")
    print('panned',flush=True)
    print('live',json.dumps(live))
    if not live['hud']: fails.append('HUD not shown while map open')
    if live['cc']>0: fails.append('world chunks held while map open: %d'%live['cc'])
    if live['mapc']>0: fails.append('detail map chunks held zoomed out: %d'%live['mapc'])
    if live['big']: fails.append('big canvases allocated while map open')
    if live['nm']: fails.append('night base image allocated on LOWMEM')
    if live['n']<10: fails.append('too few samples %d'%live['n'])
    print('crashing',flush=True)
    try: await asyncio.wait_for(cdp.send('Page.crash'),5)
    except Exception as e: print('crash exc',type(e).__name__,flush=True)
    await asyncio.sleep(1.5)
    pg2=await ctx.new_page(); await pg2.goto('file://'+HTML); await pg2.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
    print('reloaded',flush=True)
    
    try: await pg2.wait_for_function("!!MDBG.lastToast",timeout=15000)
    except Exception: pass
    r=await pg2.evaluate("({toast:MDBG.lastToast||null,banner:[...document.querySelectorAll('div')].some(d=>/Map may have crashed/.test(d.textContent||'')),prev:MDBG.prev?{open:MDBG.prev.open,n:MDBG.prev.buf.length,last:MDBG.prev.buf.slice(-2),hdr:MDBG.prev.hdr}:null,on:MDBG.on})")
    print('after crash',json.dumps(r))
    print('toast',r['toast'])
    if not r['toast']: fails.append('no crash report toast')
    if not r['on']: fails.append('mapdbg not remembered')
    if not r['banner']: fails.append('no crash banner')
    if not r['prev'] or r['prev']['n']<10 or not r['prev']['open']: fails.append('crash log missing / too short')
    if errs: fails.append('errors %s'%errs[:2])
    await b.close()
  print('FAIL' if fails else 'PASS',fails); sys.exit(1 if fails else 0)
asyncio.run(main())
