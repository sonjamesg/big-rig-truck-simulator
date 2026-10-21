"""Fast travel to every big-map icon: targets come from mapPOIList (the live data the icons are drawn from). For every icon the rig
must land on a road tile facing along it within NEAR tiles of the icon (or, when the icon sits further back from the road than
that, within one rig length (21 m) + 4 tiles of the closest road tile to it), or on the place's own drivable ground (depot/yard rect, fuel HGV lane or
forecourt, garage bay), with nothing solid under cab or trailer. Also runs the real fastTravel(o, icon) for one icon of every kind.
Usage: python3 tests/fasttravel_poi_test.py [BigRig.html]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
NEAR = 10  # tiles (40 m): the rig is ~5 tiles long and may not sit across a driveway junction
JS = r"""((NEAR)=>{ const B=__bigrig, W=B.world, T=B.truck, out=[];
  const inRect=(o,x,y)=>{ const tx=x/M_T, ty=y/M_T; if(o.x0!==undefined&&o.w) return tx>=o.x0&&tx<=o.x0+o.w&&ty>=o.y0&&ty<=o.y0+o.h;
    if(o.w&&o.x!==undefined&&o.x<MW) return tx>=o.x&&tx<=o.x+o.w&&ty>=o.y&&ty<=o.y+o.h; return false; };
  for(const P of B.BigRig.mapPOIs()){ const r={kind:P.kind,name:P.name};
    if(P.kind==='Hide box'){ continue; }   // hide boxes refuse fast travel by design
    const p=B.BigRig.ftTarget(P.o,P); if(!p){ r.err='no spot'; out.push(r); continue; }
    B.BigRig.rigPlace(p); const tx=Math.floor(T.x/M_T), ty=Math.floor(T.y/M_T), i=tx+ty*MW;
    r.d=+(Math.hypot(T.x-P.x,T.y-P.y)/M_T).toFixed(1); r.road=isRoadT(i); r.yard=!!p.bay||inRect(P.o,T.x,T.y);
    const f=fwd(T.h), R=rgt(T.h); let solid=0; for(let s=(T.trl?-12:-1.2);s<=5;s+=1) for(const w of [-1.1,1.1]) if(solidAtM(T.x+f[0]*s+R[0]*w,T.y+f[1]*s+R[1]*w)) solid++;
    r.solid=solid; if(p.seg!=null){ r.headOK=Math.abs(Math.atan2(Math.sin(T.h-rigHeading(W.segs[p.seg],p.dir)),Math.cos(T.h-rigHeading(W.segs[p.seg],p.dir))))<1e-6; }
    let rm=999; const cx=P.x/M_T, cy=P.y/M_T; for(let dy=-150;dy<=150;dy++) for(let dx=-150;dx<=150;dx++){ if(Math.abs(dx)+Math.abs(dy)>212) continue; const x=Math.floor(cx+dx), y=Math.floor(cy+dy);
      if(x>=0&&y>=0&&x<MW&&y<MH&&isRoadT(x+y*MW)) rm=Math.min(rm,Math.hypot(dx,dy)); }
    r.roadMin=+rm.toFixed(1); if(p.place){ r.place=true; r.yard=false; }
    r.ok=solid===0&&(p.place?r.d<=NEAR+12:r.yard||(r.road&&r.headOK!==false&&r.d<=Math.max(NEAR,rm+21/M_T+4)));
    out.push(r); }
  return out; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.truck", timeout=60000)
        await pg.wait_for_timeout(2500)
        await pg.evaluate("__bigrig.BigRig.fog&&__bigrig.BigRig.fog.revealAll()")  # v66: revealed mode
        res = await pg.evaluate(JS + f"({NEAR})")
        kinds = {}; npass = 0
        for r in res:
            k = kinds.setdefault(r["kind"], [0, 0]); k[1] += 1
            if r.get("ok"): k[0] += 1; npass += 1
            else: print("FAIL", json.dumps(r))
        real = await pg.evaluate(r"""(async()=>{ const B=__bigrig,T=B.truck,o=[],seen={};
          for(const P of B.BigRig.mapPOIs()){ if(seen[P.kind]||P.kind==='Hide box') continue; seen[P.kind]=1; T.money=1e6; T.v=0;
            if(!B.BigRig.fastTravel(P.o,P)){ o.push({kind:P.kind,name:P.name,err:'refused'}); continue; } await new Promise(r=>setTimeout(r,700));
            const i=Math.floor(T.x/M_T)+Math.floor(T.y/M_T)*MW; o.push({kind:P.kind,name:P.name,d:+(Math.hypot(T.x-P.x,T.y-P.y)/M_T).toFixed(1),road:isRoadT(i)}); }
          return o; })()""")
        rp = 0
        for r in real:
            ok = "err" not in r and r["d"] <= 40
            rp += ok; print("ok  " if ok else "FAIL", "fastTravel", json.dumps(r))
        # no fast travel during a job / heist / wanted: toast, greyed button, keyboard (Enter on the map) refused, back after
        jb = await pg.evaluate(r"""(async()=>{ const B=__bigrig,T=B.truck,P=B.BigRig.mapPOIs().find(p=>p.kind==='Garage'),o={};
          const key=()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter',bubbles:true}))||window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'}));
          const cases={job:()=>{fillBoard(); const j=career.jobs.find(j=>(j.tier||1)<=career.tier)||career.jobs[0]; o.jobStarted=acceptJob(j)},bm:()=>{BM.act={m:{},step:0}},wanted:()=>{WANT.lvl=1}};
          const clear=()=>{if(career.active) abandonJob(true); career.active=null;BM.act=null;WANT.lvl=0};
          for(const [k,set] of Object.entries(cases)){ clear(); set(); T.money=1e6; T.v=0; const x0=T.x;
            const why=ftBlock(P.o,true), grey=ftJobBlock()!==null; coupleMsg=null; const r=fastTravel(P.o,P);
            openMap(); NAV.sel={o:P.o,kind:P.kind,name:P.name,x:P.x,y:P.y}; key(); await new Promise(r=>setTimeout(r,500));
            o[k]={...(o[k]||{}),why,refused:r===false,toast:coupleMsg&&coupleMsg.text,grey,moved:Math.hypot(T.x-x0,T.y-x0===T.x?0:T.y)>1&&T.x!==x0};
            if(typeof closeMap==='function') closeMap(); }
          clear(); o.after={why:ftBlock(P.o,true),ok:B.BigRig.fastTravel(P.o,P)}; await new Promise(r=>setTimeout(r,600));
          return o; })()""")
        jok = all(v["refused"] and v["why"] == "Fast travel unavailable during a job" and v["toast"] == v["why"] and v["grey"] and not v["moved"] for k, v in jb.items() if k not in ("after", "jobStarted")) and jb["after"]["ok"] and jb["after"]["why"] is None
        print("ok  " if jok else "FAIL", "job block", json.dumps(jb))
        for k, (a, n) in sorted(kinds.items()): print(f"  {k:22s} {a}/{n}")
        if errs: print("page errors:", errs[:5])
        ok = npass == len(res) and rp == len(real) and jok and not errs
        print(f"SUMMARY {npass}/{len(res)} icons, real fast travel {rp}/{len(real)} kinds, job block {'ok' if jok else 'FAIL'}", "PASS" if ok else "FAILED")
        await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
