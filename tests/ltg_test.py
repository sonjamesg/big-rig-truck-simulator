"""LGV training ground (ltg.js): cones knock over and reset, the timed cone loop (start -> both checkpoints -> finish,
best time saved), every cancel path (Esc, Backspace, hold pad B, the on-screen button, leaving the tarmac), a cone hit
fails the run, the e-stop light, the wet skid pan grip, the map POI. The rig is moved along the lane centre frame by frame.
Usage: python3 tests/ltg_test.py [BigRig.html]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
JS = r"""async()=>{ const out={}, fr=()=>new Promise(r=>requestAnimationFrame(r)), U=(u)=>(LTG.X0+u)*M_T, V=(v)=>(LTG.Y0+v)*M_T;
  const place=(u,v,h)=>{ rigPlace({x:U(u),y:V(v),h}); truck.v=0; };
  const wait=async(n)=>{ for(let i=0;i<n;i++) await fr(); };
  FIRE.t=1e9; BK.nextGang=1e9; localStorage.removeItem('bigrig.ltgBest'); LTG.best=0;
  // lane centre of the loop (between the two cone rings), driven clockwise on screen: east along the bottom
  const P=ltgRing(10.5,90.5,115,17,7.5,0.6).reverse().map(([u,v])=>Math.abs(v-90.5)<0.01&&u>34&&u<94?[u,90.5+0.8*Math.cos(Math.PI*(u-40)/12)]:[u,v]); let k0=0,bd=1e9; P.forEach((p,i)=>{const d=Math.hypot(p[0]-45,p[1]-107.5); if(d<bd){bd=d;k0=i}});
  const lap=async(n,stopAt)=>{ for(let s=0;s<n;s++){ const a=P[(k0+s)%P.length], b=P[(k0+s+1)%P.length]; place(a[0],a[1],Math.atan2(b[0]-a[0],-(b[1]-a[1]))); await fr(); if(stopAt&&stopAt()) return s; } return n; };
  ltgCones(); out.cones=LTG.cones.length;
  // 1) full lap: run starts at START, finishes at FINISH with both checkpoints, best saved
  place(45,107.5,Math.PI/2); await wait(3);
  await lap(40); out.started=!!LTG.run;
  await lap(P.length+40,()=>!LTG.run&&LTG.res); out.lap=LTG.res&&{kind:LTG.res.kind,t:+LTG.res.t.toFixed(1)}; out.best=localStorage.getItem('bigrig.ltgBest');
  out.knockedOnLap=LTG.cones.filter(c=>c.dn).length; out.kn=LTG.cones.filter(c=>c.dn).map(c=>[+(c.hx/M_T-LTG.X0).toFixed(1),+(c.hy/M_T-LTG.Y0).toFixed(1)]); out.trl=!!truck.trl;
  const startRun=async()=>{ LTG.res=null; place(55,107.5,Math.PI/2); await wait(2); for(let u=56;u<66;u+=0.5){ place(u,107.5,Math.PI/2); await fr(); } return !!LTG.run; };
  // 2) cancel paths
  const res={};
  if(await startRun()){ dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'})); await wait(2); res.esc=LTG.res&&LTG.res.kind; }
  if(await startRun()){ dispatchEvent(new KeyboardEvent('keydown',{code:'Backspace',key:'Backspace'})); await wait(2); res.bksp=LTG.res&&LTG.res.kind; }
  if(await startRun()){ const og=navigator.getGamepads; navigator.getGamepads=()=>[{buttons:Array.from({length:16},(_,i)=>({pressed:i===1,value:i===1?1:0})),axes:[0,0,0,0],connected:true,index:0,id:'fake'}];
    const t0=performance.now(); while(LTG.run&&performance.now()-t0<2500) await fr(); navigator.getGamepads=og; res.holdB=LTG.res&&LTG.res.kind; res.holdBms=Math.round(performance.now()-t0); }
  if(await startRun()){ res.btn=!!document.getElementById('ltgX'); document.getElementById('ltgX').click(); await wait(2); res.btnRes=LTG.res&&LTG.res.kind; res.btnGone=!document.getElementById('ltgX'); }
  if(await startRun()){ place(66,120,Math.PI/2); await wait(3); res.offTarmac=LTG.res&&LTG.res.kind; res.offMsg=LTG.res&&LTG.res.msg; }
  // 3) cone hit fails the run; the cone is knocked over, slides, then resets when the rig is clear
  if(await startRun()){ const c=LTG.cones.find(c=>c.loop&&!c.dn&&Math.abs(c.hy/M_T-LTG.Y0-109.2)<0.2&&c.hx/M_T-LTG.X0>80);
    place(c.hx/M_T-LTG.X0-3,109.2,Math.PI/2); truck.v=4; for(let i=0;i<12;i++){ place(c.hx/M_T-LTG.X0-3+i*0.25,109.2,Math.PI/2); truck.v=4; await fr(); }
    res.coneFail=LTG.res&&LTG.res.kind; res.coneDown=c.dn; const x1=c.x; await wait(10); res.coneSlid=+Math.hypot(c.x-c.hx,c.y-c.hy).toFixed(2);
    place(45,60,Math.PI/2); c.t=timeS-13; await wait(3); res.coneReset=!c.dn&&c.x===c.hx; }
  out.res=res;
  // 4) emergency stop light: arm on the run-in, red at a random point, stopping distance reported
  { const E=LTG.es; for(let u=10;u<75;u+=0.5){ place(u,77,Math.PI/2); truck.v=12; await fr(); if(E.st==='r') break; }
    out.esRed=E.st==='r'; for(let i=0;i<10;i++){ place(76+i*0.6,77,Math.PI/2); truck.v=Math.max(0,12-i*1.5); await fr(); } truck.v=0; await wait(3); out.es=E.res&&{d:+E.res.d.toFixed(1),mph:Math.round(E.res.mph)}; }
  // 5) skid pan grip + POI
  out.gripPan=ltgGrip({x:U(160),y:V(82)}); out.gripOff=ltgGrip({x:U(40),y:V(60)});
  { let n=0; mapPOIList((o,x,y,k)=>{ if(k==='Training ground') n++; }); out.poi=n; }
  out.tarmacGate=ltgOnTarmac((LTG.X0+LTG.W+3)*M_T,V(50)); out.tarmacSite=ltgOnTarmac(U(90),V(50));
  return out; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500)
        r = await pg.evaluate(JS)
        print(json.dumps(r))
        R = r["res"]
        ok = (r["started"] and r["lap"] and r["lap"]["kind"] == "done" and r["best"] and r["knockedOnLap"] == 0
              and R.get("esc") == "cancel" and R.get("bksp") == "cancel" and R.get("holdB") == "cancel" and R.get("btn") and R.get("btnRes") == "cancel"
              and R.get("btnGone") and R.get("offTarmac") == "cancel" and R.get("coneFail") == "fail" and R.get("coneDown") and R.get("coneSlid", 0) > 0.2
              and R.get("coneReset") and r["esRed"] and r["es"] and r["gripPan"] < 1 and r["gripOff"] == 1 and r["poi"] == 1 and r["tarmacGate"] and r["tarmacSite"])
        print("ERRS", errs)
        print("PASS" if ok and not errs else "FAIL")
        await b.close()
asyncio.run(main())
