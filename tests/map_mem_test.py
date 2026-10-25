"""Map memory test (James 25 Oct: zoomed-out M map crashed phone browsers). For a phone (412x915, DPR 2.6, touch -> LOWMEM)
and a desktop profile: open the map, zoom right out, FORCE the overview to finish building (desktop: every chunk into the
2 px/tile sheets; phone: no sheets, MINIMAP path), switch to night (night map built), pan the corners, zoom back in.
Measures every canvas the game holds (all canvases ever created are tracked; live = width > 0 and still referenced by a
cache) and the peak. FAILS if a page error / crash happens, the desktop overview did not actually build, or retained canvas
memory is over the cap (retained: 130 MB; all live canvases incl. garbage: 200 MB, phone and desktop; desktop default = no overview sheets).
Baseline before the fix (6c58bfe): live canvas peak 661 MB (phone) / 640 MB (desktop) while the overview built.
Usage: python3 tests/map_mem_test.py index.html [phone|desktop|both]"""
import asyncio,sys,json,os
from playwright.async_api import async_playwright
HTML=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else 'index.html'); MODE=sys.argv[2] if len(sys.argv)>2 else 'both'
CAP={'phone':130,'desktop':130}; LIVECAP={'phone':200,'desktop':200} # MB: retained by caches / all live canvases incl. not-yet-GC'd
INIT=r"""(()=>{ const ce=Document.prototype.createElement; window.__cvs=[]; Document.prototype.createElement=function(t){ const e=ce.apply(this,arguments); if(String(t).toLowerCase()==='canvas'&&window.__cvs.length<200000) window.__cvs.push(new WeakRef(e)); return e; }; })()"""
JS=r"""(async()=>{ const out={}; const MB=(px)=>Math.round(px*4/1e5)/10;
 const fr=(k)=>new Promise(r=>{let i=0;const f=()=>{if(++i>=k)r();else requestAnimationFrame(f)};requestAnimationFrame(f);});
 const held=()=>{ const S=new Set(), add=(c)=>{ if(c&&c.width!==undefined) S.add(c); };
   add(MINIMAP); for(const s of OV.sheets) add(s.c); if(OVL.L) for(const o of OVL.L){ add(o.c); add(o.n); } add(OVL.tmp);
   for(const c of chunkCache.values()) add(c); for(const c of chunkLo.values()) add(c); for(const c of MAPC.cache.values()) add(c);
   if(typeof NM!=='undefined'){ add(NM.base); add(NM.lit); add(NM.glow); } for(const c of document.querySelectorAll('canvas')) add(c);
   if(world.j3s) for(const s of world.j3s) add(s.dc);
   let px=0; for(const c of S) px+=c.width*c.height; return MB(px); };
 const live=()=>{ let px=0,n=0; for(const w of window.__cvs){ const c=w.deref(); if(c&&c.width){ px+=c.width*c.height; n++; } } return [MB(px),n]; };
 const st={peakHeld:0,peakLive:0}; const snap=(k)=>{ const h=held(), l=live(); st.peakHeld=Math.max(st.peakHeld,h); st.peakLive=Math.max(st.peakLive,l[0]); (out.steps=out.steps||[]).push([k,h,l[0],l[1],performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):-1]); };
 const MC=typeof MEMCAP!=='undefined'?MEMCAP:{ov:true}; out.LOWMEM=typeof LOWMEM!=='undefined'?LOWMEM:null; out.MEMCAP=MC; out.ovPx=OV.px;
 openMap(); await fr(30); snap('open');
 for(let i=0;i<14;i++){ mapZoomTo(bigmap.zt/1.6); await fr(10); } await fr(60); snap('minzoom');
 // force the overview to finish (as if the map sat open zoomed out for minutes)
 const t0=performance.now(); let it=0; while(MC.ov&&OV.n<OV.total&&it<4000){ ovTick(250); it++; if(it%8===0){ await fr(1); if(it%40===0) snap('ov'+OV.n); } }
 out.ovBuilt=[OV.n,OV.total]; out.ovSecs=Math.round((performance.now()-t0)/100)/10; await fr(30); snap('ovDone');
 gameT=22.5; await fr(90); snap('night');
 for(const [x,y] of [[0,0],[MW,0],[MW,MH],[0,MH]]){ bigmap.cx=x; bigmap.cy=y; await fr(40); } snap('corners');
 for(let i=0;i<20;i++){ mapZoomTo(bigmap.zt*1.6); await fr(10);} await fr(60); for(const [x,y] of [[300,300],[1700,1700],[1000,700]]){ bigmap.cx=x; bigmap.cy=y; await fr(60); } snap('zoomIn');
 out.peakHeld=st.peakHeld; out.peakLive=st.peakLive; out.zFinite=Number.isFinite(bigmap.z)&&Number.isFinite(bigmap.cx)&&Number.isFinite(bigmap.cy);
 return out; })()"""
async def run(p,prof):
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--enable-precise-memory-info','--js-flags=--expose-gc','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await (b.new_context(viewport={'width':412,'height':915},device_scale_factor=2.6,is_mobile=True,has_touch=True) if prof=='phone' else b.new_context(viewport={'width':1280,'height':800}))
  await ctx.add_init_script(INIT)
  pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('crash',lambda: errs.append('PAGE CRASHED'))
  await pg.goto('file://'+HTML); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
  await pg.keyboard.press('Enter'); await pg.mouse.click(200,500); await pg.wait_for_timeout(1500)
  try: r=await pg.evaluate(JS)
  except Exception as e: r={'exc':str(e)[:400]}
  await b.close(); r['errs']=errs; return r
async def main():
  fails=[]; res={}
  async with async_playwright() as p:
    for prof in (['phone','desktop'] if MODE=='both' else [MODE]):
      r=await run(p,prof); res[prof]=r; print(prof,json.dumps(r))
      if 'exc' in r or r['errs']: fails.append('%s: errors %s %s'%(prof,r.get('exc'),r['errs'][:3])); continue
      if prof=='phone' and not r['LOWMEM']: fails.append('phone profile did not get LOWMEM')
      if r['MEMCAP'].get('ov') and r['ovBuilt'][0]<r['ovBuilt'][1]: fails.append('overview sheets enabled but not built %s'%r['ovBuilt'])
      if r['peakHeld']>CAP[prof]: fails.append('%s retained canvas %.1f MB > cap %d MB'%(prof,r['peakHeld'],CAP[prof]))
      if r['peakLive']>LIVECAP[prof]: fails.append('%s live canvas peak %.1f MB > cap %d MB (churn)'%(prof,r['peakLive'],LIVECAP[prof]))
      if not r['zFinite']: fails.append('%s map centre/zoom not finite'%prof)
  print('FAIL' if fails else 'PASS',fails); sys.exit(1 if fails else 0)
asyncio.run(main())
