"""Signal cycle stats + live day shot at a UK junction: python3 tools/sigshots.py OUTDIR TAG"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, TAG = sys.argv[1], sys.argv[2]
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800)
        st = await pg.evaluate("""(()=>{ const L=world.junctions.filter(j=>j.lights); const T=L.map(j=>sigOf(j).T); const U=L.filter(j=>j.uk).map(j=>sigOf(j).T), N=L.filter(j=>!j.uk).map(j=>sigOf(j).T);
          const av=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):0; const kinds={}; for(const j of L) for(const s of sigOf(j).stages) kinds[s.kind]=(kinds[s.kind]||0)+1;
          const J=L.find(j=>j.uk&&j.x>150&&j.x<450&&j.y>140&&j.y<450&&sigOf(j).stages.length>=3)||L.find(j=>j.uk);
          return {n:L.length,avg:av(T),min:Math.min(...T),max:Math.max(...T),ukAvg:av(U),nonUkAvg:av(N),nUk:U.length,stageKinds:kinds,J:[J.id,J.x,J.y],Jstages:sigOf(J).stages.map(s=>[s.kind,s.g]),JT:sigOf(J).T}; })()""")
        x, y = st["J"][1] + 2, st["J"][2] + 2
        await pg.evaluate(f"(()=>{{const B=__bigrig,tk=B.truck; const n=navSnap({x}+10,{y}+2,40)||[{x}+10,{y}]; tk.x=n[0]*M_T; tk.y=n[1]*M_T; tk.v=0; B.cam.zLock=0.9; B.cam.z=0.9; gameT=12;}})()")
        await pg.evaluate("""(()=>{window.__pass=new Set(); window.__ov=0; window.__stk=0; window.__iv=setInterval(()=>{const vs=__bigrig.traffic.vs, tk=__bigrig.truck; for(const v of vs){ if(Math.hypot(v.x-tk.x,v.y-tk.y)<120) __pass.add(v.id);} for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++) if(Math.hypot(vs[i].x-tk.x,vs[i].y-tk.y)<120&&Math.hypot(vs[i].x-vs[j].x,vs[i].y-vs[j].y)<1.2&&(vs[i].layer|0)===(vs[j].layer|0)&&!(vs[i].ghostT>0||vs[j].ghostT>0)) __ov++; },250);})()""")
        await pg.wait_for_timeout(20000); await pg.screenshot(path=f'{OUT}/{TAG}_junction_day.png')
        await pg.wait_for_timeout(70000)
        st["flow"] = await pg.evaluate("(()=>{clearInterval(__iv); return {vehiclesSeen90s:__pass.size,overlapSamples:__ov, peds:(__bigrig.traffic.peds||traffic.peds||[]).length, pedsOnCrossing:(traffic.peds||[]).filter(p=>p.onX).length};})()")
        await pg.screenshot(path=f'{OUT}/{TAG}_junction_day2.png')
        st["errors"] = errs; json.dump(st, open(f'{OUT}/{TAG}_cycles.json', 'w'), indent=1); print(json.dumps(st)); await b.close()
asyncio.run(m())
