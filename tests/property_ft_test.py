"""Fast travel to every home (HOMES.list, owned or for sale) and every commercial yard (world.forSale) through the real
fastTravel(): the rig must land with nothing solid under cab or trailer, on the property's own drive / hard standing / yard
or on the road at its drive mouth or gate (within 12 tiles of the entrance), and facing out (towards the entrance / road).
Usage: python3 tests/property_ft_test.py [BigRig.html]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
LIST = r"""()=>[...HOMES.list.map(h=>({k:'home',id:h.id,name:h.name})),...(world.forSale||[]).map(y=>({k:'yard',id:y.id,name:ydBrand(y).name}))]"""
ONE = r"""(async(q)=>{ const T=truck; T.money=1e7; T.v=0; if(career.active) abandonJob(true);
  const o=q.k==='home'?HOMES.list.find(h=>h.id===q.id).ft:world.forSale.find(y=>y.id===q.id);
  const e=o.entrance; const x0=T.x, y0=T.y;
  if(!fastTravel(o)) return {...q,err:'refused'}; await new Promise(r=>setTimeout(r,650));
  const f=fwd(T.h), R=rgt(T.h); let solid=0;
  for(let s=(T.trl?-12:-1.2);s<=5;s+=1) for(const w of [-1.1,1.1]) if(solidAtM(T.x+f[0]*s+R[0]*w,T.y+f[1]*s+R[1]*w)) solid++;
  const tx=T.x/M_T, ty=T.y/M_T, i=Math.floor(tx)+Math.floor(ty)*MW;
  const rect=o.x0!==undefined?[o.x0,o.y0,o.w,o.h]:[o.x,o.y,o.w,o.h];
  const inR=tx>=rect[0]-0.5&&tx<=rect[0]+rect[2]+0.5&&ty>=rect[1]-0.5&&ty<=rect[1]+rect[3]+0.5;
  const d=Math.hypot(T.x-e.x,T.y-e.y)/M_T, road=isRoadT(i);
  // facing out: inside the plot / yard the cab points at the entrance; on the road anything along the lane is fine
  const toE=[e.x-T.x,e.y-T.y], n=Math.hypot(...toE)||1, dot=(f[0]*toE[0]+f[1]*toE[1])/n;
  const out = road && !inR ? true : dot > 0.5 || d < 2;
  const moved=Math.hypot(T.x-x0,T.y-y0)>1;
  return {...q,d:+d.toFixed(1),road,inR,solid,dot:+dot.toFixed(2),out,moved,ok:moved&&solid===0&&(inR||(road&&d<=12))&&out}; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(2000)
        L = await pg.evaluate(LIST); npass = 0
        for q in L:
            r = await pg.evaluate(ONE, q); npass += bool(r.get("ok"))
            print("ok  " if r.get("ok") else "FAIL", json.dumps(r))
        await b.close()
        print("errors", errs)
        print("SUMMARY %d/%d %s" % (npass, len(L), "PASS" if npass == len(L) and not errs else "FAIL"))
asyncio.run(main())
