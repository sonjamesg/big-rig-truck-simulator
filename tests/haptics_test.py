"""Haptics test: stubs navigator.vibrate, taps every visible #mob deck button with real CDP touch events
(touchStart/touchEnd -> pointerdown/touchstart) in portrait and landscape, asserts vibrate fired for each.
Usage: python3 tests/haptics_test.py [url]"""
import sys, os
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file://'+os.path.abspath('index.html')
STUB="""(()=>{window.__vib=[];const f=function(p){window.__vib.push(p);return true};
try{Object.defineProperty(Navigator.prototype,'vibrate',{value:f,configurable:true,writable:true});}catch(e){}
try{Object.defineProperty(navigator,'vibrate',{value:f,configurable:true,writable:true});}catch(e){} })()"""
BTNS="""()=>[...document.querySelectorAll('#mob .b')].filter(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);
 return r.width>4&&r.height>4&&s.display!=='none'&&s.visibility!=='hidden'&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight})
 .map(b=>{const r=b.getBoundingClientRect();return {id:b.id,x:r.left+r.width/2,y:r.top+r.height/2}})"""
allok=True
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    for w,h,tag in [(390,844,'portrait'),(844,390,'landscape')]:
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,device_scale_factor=2)
        ctx.add_init_script(STUB); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(2500)
        pg.touchscreen.tap(w//2,h//2); pg.wait_for_timeout(1500)
        if not pg.evaluate("()=>{try{return started}catch(e){return false}}"): pg.evaluate('startGame()')
        pg.wait_for_timeout(5000)
        cdp=ctx.new_cdp_session(pg)
        btns=pg.evaluate(BTNS); print(tag,'buttons:',len(btns),[x['id'] for x in btns])
        if len(btns)<8: print('FAIL',tag,'too few deck buttons'); allok=False
        skip={'mMap','mJobs','mMenu','mPause','mShop'}  # opening a modal is fine, but close it after
        for bt in btns:
            for _ in range(10):  # make sure no modal (Jobs/Map) covers the deck before the tap
                hit=pg.evaluate("([x,y,id])=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest('#'+id))}",[bt['x'],bt['y'],bt['id']])
                if hit: break
                pg.evaluate("()=>{try{closeUI()}catch(e){}; try{if(typeof closeMap==='function')closeMap()}catch(e){}}"); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            if not hit: print('WARN',tag,bt['id'],'covered by another element')
            pg.evaluate('window.__vib.length=0')
            pt=[{'x':bt['x'],'y':bt['y'],'id':1}]
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':pt}); pg.wait_for_timeout(60)
            n=pg.evaluate('window.__vib.slice()')
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); pg.wait_for_timeout(120)
            ok=len(n)>0; allok&=ok
            print('PASS' if ok else 'FAIL',tag,bt['id'],'vibrate',n)
            pg.evaluate("()=>{try{if(career.uiOpen)closeUI()}catch(e){}}"); pg.wait_for_timeout(80)
        ctx.close()
    b.close()
print('SUMMARY','PASS' if allok else 'FAIL'); sys.exit(0 if allok else 1)
