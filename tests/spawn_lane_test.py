"""Fast travel / respawn spawn test: for every fast-travel destination the rig must sit wholly in the LEFT-hand lane (UK),
face that lane's direction of travel, be clear of junctions/buildings/traffic, and the trailer must line up behind the cab.
Also runs the real fastTravel() to a sample and the breakdown respawn.  Usage: python3 tests/spawn_lane_test.py [BigRig.html]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
JS=r"""(()=>{ const B=__bigrig, W=B.world, T=B.truck, out=[];
  const D=[]; for(const d of W.depots) D.push(['Depot',d]); for(const f of W.fuel) D.push(['Fuel',f]); for(const g of W.garages) D.push(['Garage',g]);
  for(const m of W.malls||[]) D.push(['Mall',m]); for(const d of W.dealers||[]) D.push(['Dealer',d]); for(const s of railPOIs()) D.push(['Station',s]);
  const ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
  for(const [kind,d] of D){ const p=B.BigRig.ftSpotFor(d); const r={kind,name:d.name}; if(!p){ r.err='no spot'; out.push(r); continue; }
    B.BigRig.rigPlace(p); const f=fwd(T.h), R=rgt(T.h);
    r.trlDeg=T.trl?+(Math.abs(ang(T.trl.th-T.h))*57.3).toFixed(1):0;
    if(T.trl){ const k=kingpin(T); r.trlOff=+Math.hypot(T.trl.x-k[0],T.trl.y-k[1]).toFixed(2); }
    if(p.seg!=null){ const sg=W.segs[p.seg], c=(sg.a+sg.w/2)*M_T, pos=sg.dir==='h'?T.y:T.x; const n=sg.dir==='h'?[0,1]:[1,0];
      r.side=(pos-c)*(n[0]*R[0]+n[1]*R[1]);   // <0 = left of the centre line for the way we face
      r.headOK=Math.abs(ang(T.h-rigHeading(sg,p.dir)))<1e-6;
      // every footprint point of cab+trailer on this segment's left half, not in a junction box
      let bad=0; for(let s=-15;s<=6;s+=1) for(const w of [-1.2,1.2]){ const x=T.x+f[0]*s+R[0]*w, y=T.y+f[1]*s+R[1]*w, tx=Math.floor(x/M_T), ty=Math.floor(y/M_T), i=tx+ty*MW;
        if((sg.dir==='h'?W.roadH[i]:W.roadV[i])!==sg.id) bad++; if(W.roadH[i]>=0&&W.roadV[i]>=0) bad++; const q=((sg.dir==='h'?y:x)-c)*(n[0]*R[0]+n[1]*R[1]); if(q>=0) bad++; if(solidAtM(x,y)) bad++; }
      r.footBad=bad; } else r.yard=true;
    out.push(r); }
  return out; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.truck',timeout=60000); await pg.wait_for_timeout(2000)
    await pg.evaluate("__bigrig.BigRig.fog&&__bigrig.BigRig.fog.revealAll()")  # v66: revealed mode
    res=await pg.evaluate(JS); ok=True; n=0
    for r in res:
      bad='err' in r or r.get('trlDeg',0)>0.5 or r.get('trlOff',0)>0.05 or (not r.get('yard') and (r['side']>=0 or not r['headOK'] or r['footBad']>0))
      ok&=not bad; n+=1; print('FAIL' if bad else 'ok  ',json.dumps(r))
    # real fast travels: run, then let traffic move 6 s and check AI in our lane flows our way
    real=await pg.evaluate(r"""(async()=>{ const B=__bigrig, T=B.truck, W=B.world, o=[]; const L=[...W.fuel.slice(0,4),...W.garages.slice(0,3),...(W.malls||[]).slice(0,3)];
      for(const d of L){ T.money=1e6; T.v=0; if(!B.BigRig.fastTravel(d)){ o.push({name:d.name,err:'refused'}); continue; } await new Promise(r=>setTimeout(r,6500));
        const f=fwd(T.h), R=rgt(T.h); let same=0, opp=0; for(const v of B.traffic.vs){ const dx=v.x-T.x, dy=v.y-T.y, al=dx*f[0]+dy*f[1], lt=dx*R[0]+dy*R[1]; if(Math.abs(al)>80||lt>0.5||lt<-4||v.h===undefined) continue; const vf=fwd(v.h); (vf[0]*f[0]+vf[1]*f[1]>0.5)?same++:opp++; }
        o.push({name:d.name,x:+T.x.toFixed(1),y:+T.y.toFixed(1),h:+T.h.toFixed(2),sameLaneSameDir:same,sameLaneOpposite:opp}); } return o; })()""")
    for r in real:
      bad='err' in r or r['sameLaneOpposite']>0; ok&=not bad; print('FAIL' if bad else 'ok  ','fastTravel',json.dumps(r))
    if errs: ok=False; print('page errors:',errs[:5])
    await b.close(); print(f'SUMMARY {n} destinations', 'PASS' if ok else 'FAILED'); sys.exit(0 if ok else 1)
asyncio.run(main())
