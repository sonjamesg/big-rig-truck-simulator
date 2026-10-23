"""Police car art shots (3 variants, day + night, close up). Usage: police_car_shots.py [html] [outdir] [prefix]"""
import asyncio,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1]; OUT=sys.argv[2]; PRE=sys.argv[3] if len(sys.argv)>3 else ''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto('file://'+os.path.abspath(SRC)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=300000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    await pg.evaluate("""(()=>{for(let i=MW*400;i<MW*MH;i+=991){const x=i%MW,y=(i/MW)|0;let ok=true;for(let k=-2;k<=20&&ok;k++)for(let j=-1;j<=2&&ok;j++)ok=inb(x+k,y+j)&&isRoadT(idx(x+k,y+j));
      if(ok){const T=truck;T.x=(x+4)*M_T;T.y=(y+0.5)*M_T;T.h=1.5708;T.v=0;if(T.trl){T.trl.coupled=false;T.trl=null;}
      const Y=(y+1)*M_T;window.__camHold=[(x+13)*M_T*PPM,Y*PPM];cam.zLock=3.6;
      POL_T.forEach((pt,k)=>{const a=emArt(pt);const v={parked:true,kind:a.kind,L:a.L,W:a.W,x:(x+9+k*4)*M_T,y:Y+(k==1?1.2:-1.2),h:k==1?-1.5708:1.5708,offX:0,offY:0,art:{body:a.body},v:0,role:'police',polT:pt,pol:{}};
        traffic.parked.push(v);const kk=Math.floor(v.x/64)+','+Math.floor(v.y/64);let A=traffic.parkedIdx.get(kk);if(!A){A=[];traffic.parkedIdx.set(kk,A)}A.push(v);});
      traffic.vs.length=0;return}}})()""")
    for hr,nm in [(12,'day'),(23,'night')]:
      await pg.evaluate(f"(()=>{{ gameT={hr}; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; }})()")
      await pg.wait_for_timeout(3000); await pg.screenshot(path=f'{OUT}/{PRE}police_{nm}.png')
    import base64
    d=await pg.evaluate("""(()=>{const S=3,A=POL_T.map(t=>emArt(t).body.c),w=A.reduce((s,c)=>s+c.height*S+40,40),h=Math.max(...A.map(c=>c.width))*S+80;
      const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#3a3d42';g.fillRect(0,0,w,h);let x=40;
      for(const a of A){g.save();g.translate(x+a.height*S/2,h/2);g.rotate(Math.PI/2);g.imageSmoothingQuality='high';g.drawImage(a,-a.width*S/2,-a.height*S/2,a.width*S,a.height*S);g.restore();x+=a.height*S+40}
      return c.toDataURL()})()""")
    open(f'{OUT}/{PRE}police_closeup.png','wb').write(base64.b64decode(d.split(',')[1]))
    print('errors',errs); await b.close()
asyncio.run(main())
