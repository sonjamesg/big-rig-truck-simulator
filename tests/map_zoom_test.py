"""Map crash repro (James 25 Oct): open the M map, zoom right out, pan to every corner, past the edge and to NaN, zoom in, pan again.
Fails on any page error or crash. Usage: python3 tests/map_zoom_test.py index.html [mob]"""
import asyncio,sys,json
from playwright.async_api import async_playwright
HTML=sys.argv[1]; MOB=len(sys.argv)>2
JS=r"""(async()=>{ const out={steps:[]}; const mem=()=>performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):-1;
 const cv=()=>{let n=0,px=0; for(const c of document.querySelectorAll('canvas')){n++;px+=c.width*c.height;} return [n,Math.round(px/1e6)];};
 openMap(); const fr=(k)=>new Promise(r=>{let i=0;const f=()=>{if(++i>=k)r();else requestAnimationFrame(f)};requestAnimationFrame(f);});
 await fr(30); out.steps.push(['open',bigmap.z,mem()]);
 for(let i=0;i<14;i++){ mapZoomTo(bigmap.zt/1.6); await fr(20); } await fr(120); out.steps.push(['minzoom',bigmap.z,mapFitZ(),mem()]);
 for(const [x,y] of [[0,0],[MW,0],[MW,MH],[0,MH],[-1e5,-1e5],[1e9,NaN]]){ bigmap.cx=x; bigmap.cy=y; await fr(60); out.steps.push(['pan',x,y,bigmap.cx,bigmap.cy,mem()]); }
 for(let i=0;i<20;i++){ mapZoomTo(bigmap.zt*1.6); await fr(15);} await fr(60); out.steps.push(['maxzoom',bigmap.z,mem()]);
 for(const [x,y] of [[0,0],[MW,MH]]){ bigmap.cx=x; bigmap.cy=y; await fr(60); out.steps.push(['panZ',x,y,mem()]); }
 out.ov=typeof OV!=='undefined'?Object.keys(OV).map(k=>[k,typeof OV[k]==='object'&&OV[k]&&OV[k].size!==undefined?OV[k].size:(Array.isArray(OV[k])?OV[k].length:0)]):null;
 return out; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--enable-precise-memory-info','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await b.new_context(viewport={'width':412,'height':915},device_scale_factor=2.6,is_mobile=True,has_touch=True) if MOB else await b.new_context(viewport={'width':1280,'height':800})
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('crash',lambda: errs.append('PAGE CRASHED'))
    await pg.goto('file://'+HTML); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(200,500); await pg.wait_for_timeout(1500)
    try: r=await pg.evaluate(JS)
    except Exception as e: r={'exc':str(e)[:400]}
    print(json.dumps(r)); print('ERRS',errs); await b.close()
    sys.exit(1 if errs or 'exc' in r else 0)
asyncio.run(main())

