import asyncio,json,sys,os
from playwright.async_api import async_playwright
URL='file://'+os.path.abspath(sys.argv[1]); JS=sys.argv[2]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    for step in JS.split('|||'):
      if step.startswith('WAIT'): await pg.wait_for_timeout(int(step[4:])); continue
      if step.startswith("PRESS"): await pg.keyboard.press(step[5:]); continue
      if step.startswith("SHOT"): await pg.screenshot(path=step[4:]); continue
      r=await pg.evaluate(step); print(json.dumps(r)[:3000])
    print('ERR',errs[:5]); await b.close()
asyncio.run(main())
