"""Reverse at full lock for 20 s (left/right, trailer/solo, keyboard + touch padSteer): rig must keep moving, cab+trailer headings must swing a lot in 5 s, articulation must grow, no sideways slip at the axles, articulation <= ~90 deg,
and driving forward afterwards straightens it.  Usage: python3 tests/reverse_lock_test.py [BigRig.html]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
JS=r"""(()=>{ const B=__bigrig, oh=hitTest, ot=window.trafficHitTruck, orb=window.railBarrierHit; const res=[];
  hitTest=()=>null; window.trafficHitTruck=()=>false; window.railBarrierHit=()=>false;   // isolate articulation physics from scenery
  try{ for(const trl of [true,false]) for(const side of [-1,1]) for(const ctl of ['kb','touch']){
    const s=Object.assign({},B.truck,{v:0,steer:0,mode:'D',gear:1,throttle:0,brake:0,brakeHold:0,skid:false,lockT:0,shiftT:0,fuel:100,trl:trl?B.truck.trl||{weight:14500}:null}); s.th=s.h;
    const inp={down:true,left:ctl==='kb'&&side<0,right:ctl==='kb'&&side>0,padSteer:ctl==='touch'?side:0};
    const dt=1/60; let path=0, minV=99, maxRel=0, slow=0, maxSlip=0, dH5=0, dT5=0, rel5=0; const h0=s.h, t0=s.th;
    const axl=q=>{ const k=kingpin(q), ft=fwd(q.th); return [k[0]-ft[0]*TRL.axle,k[1]-ft[1]*TRL.axle]; };
    for(let i=0;i<20*60;i++){ const x=s.x,y=s.y, a0=axl(s); stepTruck(s,inp,dt);
      if(i<5*60){ const a1=axl(s), rt=rgt(s.th), rc=rgt(s.h);   // lateral (sideways) slip of trailer axle and cab drive axle, m/s
        const sl=Math.max(Math.abs(((a1[0]-a0[0])*rt[0]+(a1[1]-a0[1])*rt[1])/dt)*(trl?1:0), Math.abs(((s.x-x)*rc[0]+(s.y-y)*rc[1])/dt)); maxSlip=Math.max(maxSlip,sl);
        dH5=Math.max(dH5,Math.abs(Math.atan2(Math.sin(s.h-h0),Math.cos(s.h-h0)))); dT5=Math.max(dT5,Math.abs(Math.atan2(Math.sin(s.th-t0),Math.cos(s.th-t0)))); }
      if(i===5*60) rel5=Math.abs(Math.atan2(Math.sin(s.h-s.th),Math.cos(s.h-s.th))); const d=Math.hypot(s.x-x,s.y-y); path+=d;
      if(i>120){ minV=Math.min(minV,Math.abs(s.v)); if(Math.abs(s.v)<0.5) slow++; }
      maxRel=Math.max(maxRel,Math.abs(Math.atan2(Math.sin(s.h-s.th),Math.cos(s.h-s.th)))); }
    const relEnd=Math.abs(Math.atan2(Math.sin(s.h-s.th),Math.cos(s.h-s.th)));
    const f={up:true}; for(let i=0;i<15*60;i++) stepTruck(s,f,dt);
    const relFwd=Math.abs(Math.atan2(Math.sin(s.h-s.th),Math.cos(s.h-s.th)));
    res.push({trl,side,ctl,mode:'R',path:+path.toFixed(1),minV:+minV.toFixed(2),slowFrames:slow,maxRelDeg:+(maxRel*57.3).toFixed(1),relEndDeg:+(relEnd*57.3).toFixed(1),relAfterFwdDeg:+(relFwd*57.3).toFixed(1),dHead5Deg:+(dH5*57.3).toFixed(1),dTrl5Deg:+(dT5*57.3).toFixed(1),rel5Deg:+(rel5*57.3).toFixed(1),maxSlip:+maxSlip.toFixed(3)}); }
  } finally { hitTest=oh; window.trafficHitTruck=ot; window.railBarrierHit=orb; }
  return res; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.truck',timeout=60000); await pg.wait_for_timeout(1500)
    res=await pg.evaluate(JS); ok=True
    for r in res:
      bad=r['path']<30 or r['slowFrames']>0 or r['maxRelDeg']>91 or r['relAfterFwdDeg']>10 \
        or r['dHead5Deg']<45 or r['maxSlip']>0.05 or (r['trl'] and (r['dTrl5Deg']<30 or r['rel5Deg']<60))
      ok&=not bad; print('FAIL' if bad else 'ok  ',json.dumps(r))
    errs=[e for e in errs if 'favicon' not in e and 'peer' not in e.lower()]
    if errs: ok=False; print('console errors:',errs[:5])
    await b.close(); print('PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
asyncio.run(main())
