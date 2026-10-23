"""Private yard road (Copperline Y3, v66): no AI vehicle ever enters it, it is not in the road/sat-nav graph, the owner-only
barrier blocks a non-owner and opens for the owner, the through siding + level crossing exist.
Usage: python3 build.py && python3 tests/private_road_test.py [secs]   exit 1 on any failure."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 90
STATIC = r"""(()=>{ const W=world, Y=W.forSale.find(y=>y.ppath), F=[];
 if(!Y) return {fail:['no private-road yard']};
 let segT=0, roadT=0; for(const k of Y.ptiles){ if(W.roadH[k]!==-1||W.roadV[k]!==-1) segT++; if(isRoadT(k)) roadT++; }
 if(segT) F.push('private road tiles in a road segment: '+segT); if(roadT) F.push('private road tiles in sat nav graph: '+roadT);
 // connected: spine reaches the public road at the mouth and the gate spur reaches the yard access
 const g=Y.gate, below=idx(g.x, g.y+4); if(!(W.roadH[below]>=0||W.roadV[below]>=0)) F.push('mouth not on a public road');
 const E=Y.ppath[Y.ppath.length-1]; if(!(Math.abs(E[0]-(Y.x0+10))<1.5 && Math.abs(E[1]-Y.y0)<1)) F.push('road does not reach the yard access');
 // bends: no square corner - heading changes <= 12 deg per 0.5 tile step; full width (2 lanes) at every sample
 let kink=0, narrow=0; const P=Y.ppath; for(let k=2;k<P.length;k++){ const a=Math.atan2(P[k-1][1]-P[k-2][1],P[k-1][0]-P[k-2][0]), b=Math.atan2(P[k][1]-P[k-1][1],P[k][0]-P[k-1][0]); let d=Math.abs(b-a); if(d>Math.PI) d=2*Math.PI-d; if(d>0.21) kink++; }
 for(const q of P){ for(const o of [-0.7,0,0.7]) for(const w of [[1,0],[0,1]]){ const i=Math.floor(q[0]+w[0]*o), j=Math.floor(q[1]+w[1]*o); if(!ownPrivAt(i,j)&&get(i,j)!==T.ROAD&&!(i>=Y.x0-1&&i<Y.x0+Y.w+1&&j>=Y.y0-2&&j<Y.y0+Y.h)) {narrow++; if(!window.__nw) window.__nw=[]; __nw.push([i,j]);} } }
 if(kink) F.push('square/kinked corner samples: '+kink); if(narrow) F.push('road narrower than 2 lanes at '+narrow+' samples '+JSON.stringify(__nw.slice(0,4)));
 // sat nav for the owner targets the mouth and finds a route
 const n=navSnap(Y.navE.x/M_T, Y.navE.y/M_T, 6); if(!n) F.push('navE not on a public road');
 ownTrain(Y,0.05); const rc=Y.rc; if(!rc||!rc.thru) F.push('no through siding');
 const xc=RAIL.cross.filter(c=>ownPrivAt(Math.floor(c.mx/M_T),Math.floor(c.my/M_T))); if(!xc.length) F.push('no level crossing on the private road');
 // barrier: drive a non-owner north through the gate line
 const gy=(g.y+0.5)*M_T, gxm=(g.x+1)*M_T;
 const drive=()=>{ for(let y=gy+20;y>gy-20;y-=0.3){ const a={x:gxm,y:y,h:0,trl:null}; if(ownGateHit(Object.assign({},truck,a,{y:y-0.3}),{x:a.x,y:a.y,h:a.h})) return true; } return false; };
 delete OWN.yards[Y.id]; const blockNon=drive();
 OWN.yards[Y.id]={tier:1,bought:1,delivered:0,earned:0}; const blockOwn=drive(); delete OWN.yards[Y.id];
 if(!blockNon) F.push('barrier does not stop a non-owner'); if(blockOwn) F.push('barrier stops the owner');
 return {fail:F, id:Y.id, name:Y.name, siding:rc&&Math.round(rc.Lq), crossings:xc.length, navE:n};})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader"]); errs = []
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html")); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(800)
        r = await pg.evaluate(STATIC)
        # soak: park the player at the mouth so traffic simulates here; sample every AI vehicle 4x a second
        await pg.evaluate("""(()=>{const Y=world.forSale.find(y=>y.ppath),tk=__bigrig.truck; tk.x=(Y.gate.x-14)*M_T; tk.y=(Y.gate.y+4.5)*M_T; tk.v=0;
          window.__pr={n:0,in:0,ids:new Set(),ex:[]}; window.__pi=setInterval(()=>{ for(const v of __bigrig.traffic.vs){ if(v.parked) continue; __pr.ids.add(v.id); __pr.n++;
            const Q=ownPrivAt(Math.floor(v.x/M_T),Math.floor(v.y/M_T)); if(Q){__pr.in++; if(__pr.ex.length<5) __pr.ex.push([v.id,Math.round(v.x/M_T),Math.round(v.y/M_T)]);} } },250);})()""")
        await pg.wait_for_timeout(SECS * 1000)
        soak = await pg.evaluate("(()=>{clearInterval(__pi); return {samples:__pr.n, vehicles:__pr.ids.size, inside:__pr.in, ex:__pr.ex};})()")
        r["soak"] = soak
        if soak["inside"]: r["fail"].append("AI vehicle entered the private road %s" % soak["ex"])
        if soak["vehicles"] == 0: r["fail"].append("no AI traffic seen during soak")
        if errs: r["fail"].append("page errors %s" % errs[:3])
        print(json.dumps(r)); await b.close()
        print("PASS" if not r["fail"] else "FAIL"); sys.exit(1 if r["fail"] else 0)
asyncio.run(main())
