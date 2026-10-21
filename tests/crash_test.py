"""Mass-based crash checks (short). python3 tests/crash_test.py [BigRig.html] [shotdir] [tag]
 A: loaded rig (40 t) at 60 mph rear-ends a 30 mph car -> rig keeps >=80% speed, car shoved ahead / wrecked
 B: pile-up into a stopped queue of 4 cars -> several wrecked, rig keeps moving
 C: head-on into an AI lorry -> heavy damage both
 D: hard hit on a tanker -> explosion"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
SHOT=sys.argv[2] if len(sys.argv)>2 else None
TAG=sys.argv[3] if len(sys.argv)>3 else 'after'
SETUP=r"""(sc)=>{
  WX.st='clear'; WX.rain=0; WX.timer=1e9; try{FIRE.t=1e9;BK.nextGang=1e9;}catch(e){}
  if(!window.__oSpawn){window.__oSpawn=spawnVehicle; spawnVehicle=()=>null;}
  try{ if(typeof CRASH!=='undefined') CRASH.reset(); }catch(e){}
  traffic.vs.length=0; FX.boom=null; FX.p.length=0;
  // longest straight hwy/dual stretch without junctions
  let best=null;
  for(const sg of world.segs){ if(!(sg.type==='hwy'||sg.type==='dual')||segDeadEnd(sg)) continue;
    const js=sg.js.map(J=>jRange(sg,J)).sort((a,b)=>a[0]-b[0]); let a=sg.b0+3;
    for(const r of js.concat([[sg.b1,sg.b1]])){ if(r[0]-3-a>(best?best.len:0)) best={sg,a,len:r[0]-3-a}; a=Math.max(a,r[1]+3);} }
  const sg=best.sg, A=best.a+4, d=1, sid=world.segs.indexOf(sg);
  const p=lanePt(sg,d,0,A), q=lanePt(sg,d,0,A+1), h=ang(q[0]-p[0],q[1]-p[1]);
  const T=__bigrig.truck;
  if(!T.trl) T.trl={type:'curtain',weight:32400}; else T.trl.weight=32400;
  Object.assign(T,{x:p[0],y:p[1],h:h,th:h,v:26.8,steer:0,mode:'D',gear:8,throttle:0,brake:0,skid:false,damage:0,crunchT:0,bump:0});
  window.__camHold=null; cam.z=cam.zLock=2.6;
  const mk=(along,dir,lane,v,kind,tank)=>{ const o=__oSpawn(0,0,true,{seg:sid,dir,lane,along,clear:0}); if(!o) return null;
    if(kind){ o.kind=kind; Object.assign(o,{L:VTYPES[kind].L,W:VTYPES[kind].W,heavy:VTYPES[kind].heavy}); o.art=artFor(kind,tank?()=>0.01:(kind==='lorry'?()=>0.9:o.r)); if(tank){o.art.tank=true;o.tanker=true;} placeVeh(o);} o.v=v; o.drv=0.5; return o; };
  const M=4/1; const t0=A, out=[];
  if(sc==='A') out.push(mk(t0+10,1,0,13.4,'sedan'));
  if(sc==='B') for(let i=0;i<4;i++) out.push(mk(t0+12+i*2.6,1,0,0,['hatch','sedan','suv','estate'][i]));
  if(sc==='C'){ const o=mk(t0+16,-1,0,20,'lorry'); const lp=lanePt(sg,-1,0,A); // put the rig on the oncoming lorry's line
     T.x=lp[0]; T.y=lp[1]; out.push(o); }
  if(sc==='D') out.push(mk(t0+12,1,0,0,'lorry',true));
  window.__sc={vs:out.filter(Boolean).map(o=>o.id)};
  return {seg:sid,len:best.len,n:window.__sc.vs.length};
}"""
PROBE=r"""()=>{const T=__bigrig.truck; const vs=traffic.vs.filter(o=>__sc.vs.includes(o.id));
 return {tv:T.v, dmg:T.damage, boom:!!(FX.boom)||!!(typeof CRASH!=='undefined'&&CRASH.booms&&CRASH.booms.length),
   vs:vs.map(o=>({id:o.id,kind:o.kind,v:o.cr?Math.hypot(o.cr.vx,o.cr.vy):o.v,dmg:o.dmg||0,wreck:!!o.wreck,tank:!!o.tanker,x:o.x,y:o.y})),
   gone:__sc.vs.length-vs.length, tx:T.x,ty:T.y}}"""
async def run(pg,sc):
  info=await pg.evaluate(SETUP,sc); rec=[]
  for i in range(30):
    await pg.keyboard.down('ArrowUp') if False else None
    await pg.evaluate("()=>{__bigrig.input.up=false;__bigrig.input.down=false; const T=__bigrig.truck; if(T.v<26.8&&!window.__hit) T.throttle=1;}")
    r=await pg.evaluate(PROBE); rec.append(r)
    if SHOT and i in (4,10,18): await pg.screenshot(path=f"{SHOT}/{TAG}_{sc}_{i:02d}.png")
    await pg.wait_for_timeout(100)
  return info,rec
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=await b.new_page(viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.truck',timeout=90000); await pg.wait_for_timeout(1500)
    await pg.evaluate("()=>{try{if(!started)startGame()}catch(e){} try{closeUI()}catch(e){}}"); await pg.wait_for_timeout(1500)
    ok=True; res={}
    for sc in 'ABCD':
      info,rec=await run(pg,sc); res[sc]=rec
      v0=26.8; vmin=min(r['tv'] for r in rec[:15]); last=rec[-1]; mx=max(len(r['vs']) for r in rec)
      wrecks=max(sum(1 for o in r['vs'] if o['wreck'] or o['dmg']>=1) for r in rec)
      odmg=max([o['dmg'] for r in rec for o in r['vs']] or [0])
      if sc=='A': good= vmin>=0.8*v0 and (wrecks>=1 or odmg>=0.5)
      elif sc=='B': good= vmin>0.4*v0 and wrecks>=2
      elif sc=='C': good= last['dmg']>=30 and odmg>=1
      else: good= any(r['boom'] for r in rec)
      ok&=good
      print('ok  ' if good else 'FAIL',sc,json.dumps({'info':info,'rigMinV_mph':round(vmin*2.237,1),'rigEndV_mph':round(last['tv']*2.237,1),'rigDmg':round(last['dmg'],1),'wrecks':wrecks,'otherMaxDmg':round(odmg,2),'boom':any(r['boom'] for r in rec)}))
    if errs: print('page errors:',errs[:3]); ok=False
    await b.close(); print('PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
asyncio.run(main())
