"""Map pan test (James 25 Oct, phone Chrome 'Aw, Snap!'): phone profile (412x915, DPR 2.6, touch), truck on the LEFT of the
world, open the M map at its default zoom and pan steadily (real touch drags + direct centre steps) across to the right edge,
then the four corners, by day and by night. Records live canvas memory (every canvas created is tracked), canvases created,
renderChunk / getImageData calls, cache sizes and JS heap. FAILS on a page crash, page error, live canvas peak > CAP_MB, or
retained cache canvases > HELD_MB. Usage: python3 tests/map_pan_test.py [index.html] [phone|desktop]"""
import asyncio,sys,json,os
from playwright.async_api import async_playwright
HTML=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'index.html'); PROF=sys.argv[2] if len(sys.argv)>2 else 'phone'
CAP_MB=150; HELD_MB=110
INIT=r"""(()=>{ const ce=Document.prototype.createElement; window.__cvs=[]; window.__st={cv:0,gid:0,rc:0};
 Document.prototype.createElement=function(t){ const e=ce.apply(this,arguments); if(String(t).toLowerCase()==='canvas'){ __st.cv++; if(__cvs.length<300000) __cvs.push(new WeakRef(e)); } return e; };
 const gi=CanvasRenderingContext2D.prototype.getImageData; CanvasRenderingContext2D.prototype.getImageData=function(){ __st.gid++; return gi.apply(this,arguments); }; })()"""
MEAS=r"""(()=>{ const MB=(px)=>Math.round(px*4/1e5)/10; let px=0,n=0; for(const w of __cvs){ const c=w.deref(); if(c&&c.width){ px+=c.width*c.height; n++; } }
 const S=new Set(), add=(c)=>{ if(c&&c.width!==undefined) S.add(c); }; add(MINIMAP); for(const s of OV.sheets) add(s.c); if(OVL.L) for(const o of OVL.L){ add(o.c); add(o.n); } add(OVL.tmp);
 for(const c of chunkCache.values()) add(c); for(const c of chunkLo.values()) add(c); for(const c of MAPC.cache.values()) add(c); if(typeof NM!=='undefined'){ add(NM.base); add(NM.lit); add(NM.glow); }
 for(const c of document.querySelectorAll('canvas')) add(c); let hp=0; for(const c of S) hp+=c.width*c.height;
 return {live:MB(px),n,held:MB(hp),cv:__st.cv,gid:__st.gid,rc:(window.__rc||0),mapc:MAPC.cache.size,cc:chunkCache.size,lo:chunkLo.size,z:+bigmap.z.toFixed(2),cx:Math.round(bigmap.cx),detail:!!bigmap.detail,heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):-1}; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--enable-precise-memory-info','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await (b.new_context(viewport={'width':412,'height':915},device_scale_factor=2.6,is_mobile=True,has_touch=True) if PROF=='phone' else b.new_context(viewport={'width':1280,'height':800}))
    await ctx.add_init_script(INIT); pg=await ctx.new_page(); errs=[]; crashed=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200])); pg.on('crash',lambda: crashed.append(1))
    await pg.goto('file://'+HTML); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(200,500); await pg.wait_for_timeout(1500)
    await pg.evaluate("(()=>{ const rc=renderChunk; renderChunk=function(){ window.__rc=(window.__rc||0)+1; return rc.apply(this,arguments); }; truck.x=150*M_T; truck.y=1000*M_T; truck.v=0; cam.x=truck.x*PPM; cam.y=truck.y*PPM; })()")
    await pg.wait_for_timeout(2000)
    cdp=await ctx.new_cdp_session(pg); steps=[]; peak={'live':0,'held':0}
    async def meas(tag):
      if crashed: return
      m=await pg.evaluate(MEAS); m['t']=tag; steps.append(m); peak['live']=max(peak['live'],m['live']); peak['held']=max(peak['held'],m['held'])
    async def drag(x0,y0,x1,y1,n=12):
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x0,'y':y0}]})
      for k in range(1,n+1): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x0+(x1-x0)*k/n,'y':y0+(y1-y0)*k/n}]}); await pg.wait_for_timeout(16)
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    try:
      for night in [False,True]:
        await pg.evaluate("gameT=%s"%('22.5' if night else '13.0'))
        await pg.evaluate("openMap()"); await pg.wait_for_timeout(1500); await meas(('night' if night else 'day')+'-open')
        W=412 if PROF=='phone' else 1280
        for i in range(40):  # real finger drags right-to-left = pan the map to the right
          await drag(W*0.85,450,W*0.15,450); await pg.wait_for_timeout(60)
          if i%8==7: await meas('drag%d'%i)
        for k in range(60):  # then steady steps to the right edge
          await pg.evaluate("bigmap.cx=Math.min(MW,bigmap.cx+30)"); await pg.wait_for_timeout(50)
          if k%15==14: await meas('step%d'%k)
        for x,y in [[2048,0],[2048,2048],[0,2048],[0,0],[1024,1024]]:
          await pg.evaluate("bigmap.cx=%d;bigmap.cy=%d"%(x,y)); await pg.wait_for_timeout(700); await meas('c%d,%d'%(x,y))
        await pg.evaluate("bigmap.z=bigmap.zt=6;bigmap.cx=150;bigmap.cy=1000"); await pg.wait_for_timeout(800); await meas('z6-open')
        for i in range(30):  # zoomed in (detail chunks on): drag right across
          await drag(W*0.85,450,W*0.15,450); await pg.wait_for_timeout(80)
          if i%10==9: await meas('z6drag%d'%i)
        await pg.evaluate("closeMap&&closeMap()") if await pg.evaluate("typeof closeMap==='function'") else None
        await pg.wait_for_timeout(500)
    except Exception as e: errs.append('EXC '+str(e)[:200])
    for s in steps: print(json.dumps(s))
    fails=[]
    if crashed: fails.append('PAGE CRASHED (Aw, Snap)')
    if errs: fails.append('errors %s'%errs[:3])
    if peak['live']>CAP_MB: fails.append('live canvas peak %.1f MB > %d MB'%(peak['live'],CAP_MB))
    if peak['held']>HELD_MB: fails.append('retained canvas %.1f MB > %d MB'%(peak['held'],HELD_MB))
    print('peak',peak); print('FAIL' if fails else 'PASS',fails)
    try: await b.close()
    except Exception: pass
    sys.exit(1 if fails else 0)
asyncio.run(main())
