import asyncio,json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1400,'height':1400}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///workspace/curvy/BigRig.html'); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=60000)
    st=await pg.evaluate("(()=>{const G=buildRoadGraph();return rgStats(G)})()"); print(json.dumps(st,indent=1))
    # render previews to PNG data URLs
    shots={'v13_s1_world_map':[1024,1024,0.66,{'labels':1}], 'v13_s1_city_kingsbridge':[1590,1600,3.8,{'nodes':1,'labels':1}], 'v13_s1_city_portalbion':[300,300,3.8,{'nodes':1,'labels':1}],'v13_s1_interchange':None,'v13_s1_stack':None}
    for name,v in shots.items():
      if v is None:
        kind='cloverleaf' if 'interchange' in name else 'stack'
        I=await pg.evaluate(f"(()=>{{const I=world.rg.inter.find(i=>i.kind==='{kind}');return [I.x,I.y]}})()"); v=[I[0],I[1],14 if kind=='cloverleaf' else 8,{'nodes':1}]
      cx,cy,z,o=v
      url=await pg.evaluate("""([cx,cy,z,o])=>{const c=document.createElement('canvas');c.width=1300;c.height=1300;const g=c.getContext('2d');
        const X=x=>650+(x-cx)*z, Y=y=>650+(y-cy)*z; g.fillStyle='#5f8f4a';g.fillRect(0,0,1300,1300);
        const W=world.water, s=Math.max(1,Math.floor(1/z)); g.fillStyle='#2f6ea8'; const x0=Math.max(0,Math.floor(cx-650/z)),x1=Math.min(MW,Math.ceil(cx+650/z)),y0=Math.max(0,Math.floor(cy-650/z)),y1=Math.min(MH,Math.ceil(cy+650/z));
        for(let y=y0;y<y1;y+=s) for(let x=x0;x<x1;x+=s) if(W[y*MW+x]) g.fillRect(X(x),Y(y),Math.ceil(z*s)+0.5,Math.ceil(z*s)+0.5);
        for(const c of world.rg.cities) for(const p of c.parks){ g.fillStyle='#3f9a3a'; g.beginPath(); g.arc(X(p.x),Y(p.y),p.r*z,0,7); g.fill(); }
        rgDrawMap(g,world.rg,X,Y,z,o); return c.toDataURL('image/png');}""",[cx,cy,z,o])
      import base64; open(f'shots/{name}.png','wb').write(base64.b64decode(url.split(',')[1]))
    print(errs); await b.close()
asyncio.run(main())
