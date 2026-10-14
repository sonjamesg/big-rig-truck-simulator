"""Canvas aspect test: CSS-size / backing-size must be uniform (1:1 world pixels) at phone + desktop sizes,
including rotate-after-load. Usage: python3 tests/landscape_aspect_test.py [url] [shotprefix]"""
import sys, os
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file://'+os.path.abspath('index.html')
SHOT=sys.argv[2] if len(sys.argv)>2 else None
SIZES=[(844,390,True),(915,412,True),(740,360,True),(390,844,True),(1280,800,False)]
JS="""()=>{const c=document.getElementById('game'),r=c.getBoundingClientRect();return {cw:r.width,ch:r.height,bw:c.width,bh:c.height}}"""
def check(m,tag):
    sx=m['cw']/m['bw']; sy=m['ch']/m['bh']; err=abs(sx/sy-1)
    ok=err<0.01
    print(('PASS' if ok else 'FAIL'),tag,m,'sx=%.4f sy=%.4f'%(sx,sy)); return ok
allok=True
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    for w,h,t in SIZES:
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=t,is_mobile=t,device_scale_factor=2 if t else 1)
        pg=ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(2500)
        pg.mouse.click(w//2,h//2) if not t else pg.touchscreen.tap(w//2,h//2)
        pg.wait_for_timeout(5000)
        allok&=check(pg.evaluate(JS),f'{w}x{h}')
        if SHOT: pg.screenshot(path=f'{SHOT}{w}x{h}.png')
        if t and w>h:  # rotate: load portrait then turn to landscape, and back
            pg.set_viewport_size({'width':h,'height':w}); pg.wait_for_timeout(600); allok&=check(pg.evaluate(JS),f'rot->{h}x{w}')
            pg.set_viewport_size({'width':w,'height':h-56}); pg.wait_for_timeout(600); allok&=check(pg.evaluate(JS),f'bar {w}x{h-56}')
            pg.set_viewport_size({'width':w,'height':h}); pg.wait_for_timeout(600); allok&=check(pg.evaluate(JS),f'back {w}x{h}')
        ctx.close()
    # portrait load then rotate (the reported bug path)
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(2500)
    pg.set_viewport_size({'width':844,'height':390}); pg.wait_for_timeout(800); allok&=check(pg.evaluate(JS),'portrait-load->844x390')
    b.close()
print('SUMMARY','PASS' if allok else 'FAIL'); sys.exit(0 if allok else 1)
