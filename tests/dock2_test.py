"""Docks v2 test: road-connected gate lorries (articulated), tractors, straddle carrier/workers, player yield at both ports,
pickup-bay board jobs, ship in/out ends. Usage: dock2_test.py [html|url] [prefix] [hour]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
SRC=sys.argv[1]; PRE=sys.argv[2]; HR=float(sys.argv[3]) if len(sys.argv)>3 else 12
URL=SRC if SRC.startswith('http') else 'file://'+os.path.abspath(SRC)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; out={'fail':[]}
    pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
    await pg.goto(URL); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(640,500); await pg.wait_for_timeout(800)
    await pg.evaluate(f"(()=>{{ gameT={HR}; WX.st='clear'; WX.rain=0; WX.fog=0; WX.timer=1e6; const t=__bigrig.truck; if(t.trl){{ t.trl.coupled=false; t.trl=null; }} }})()")
    # ships: start and end of the timeline are off the map edge
    out['ships']=await pg.evaluate("portList().map(P=>{ const a=shipPose(P,0.01), z=shipPose(P,P.Ltot-0.01), A=PL(P,a.u,a.v), Z=PL(P,z.u,z.v); return {start:A.map(Math.round),end:Z.map(Math.round),offStart:A[0]<0||A[1]<0||A[0]>MW||A[1]>MH,offEnd:Z[0]<0||Z[1]<0||Z[0]>MW||Z[1]>MH}; })")
    for s in out['ships']:
      if not (s['offStart'] and s['offEnd']): out['fail'].append('ship not off-map '+json.dumps(s))
    # path sanity: every lorry path point on road / port ground, never water
    out['paths']=await pg.evaluate("portList().map(P=>{ let wet=0, road=0; for(let s=0;s<P.lpath.len;s+=0.5){ const q=polyAt(P.lpath,s), w=PL(P,q[0],q[1]), g=get(Math.floor(w[0]),Math.floor(w[1])); if(g===T.WATER) wet++; if(g===T.ROAD) road++; } const a=PL(P,...P.lpath.pts[0]), z=PL(P,...P.lpath.pts[P.lpath.pts.length-1]); return {wet,road,startRoad:get(Math.floor(a[0]),Math.floor(a[1]))===T.ROAD,endRoad:get(Math.floor(z[0]),Math.floor(z[1]))===T.ROAD,len:Math.round(P.lpath.len)}; })")
    for q in out['paths']:
      if q['wet'] or not q['startRoad'] or not q['endRoad']: out['fail'].append('lorry path '+json.dumps(q))
    for pi in [0,1]:
      # camera at the gate entry curve; wait for lorries arriving by road (spawn is out of sight)
      await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const q=polyAt(P.lpath,P.lpre-6), w=PL(P,q[0],q[1]); const t=__bigrig.truck; t.x=w[0]*M_T+(P===world.kbPort?0:40); t.y=w[1]*M_T+(P===world.kbPort?40:30); t.v=0; }})()")
      maxArt=0; seen=0
      for k in range(14):
        await pg.wait_for_timeout(2000)
        r=await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; let a=0, n=0; for(const l of P.lors){{ if(l.th==null) continue; n++; let d=l.h-l.th; d=Math.abs(Math.atan2(Math.sin(d),Math.cos(d))); a=Math.max(a,d); }} return [a*180/Math.PI,n,P.lors.map(l=>Math.round(l.p))]; }})()")
        maxArt=max(maxArt,r[0]); seen=max(seen,r[1])
        await pg.evaluate('typeof closeUI==="function"&&closeUI()')
        if k%2==1: await pg.screenshot(path=f'{PRE}_p{pi}_gate_{k//2}.png')
      out[f'gate{pi}']={'maxArticDeg':round(maxArt,1),'lorries':seen,'ps':r[2]}
      if seen==0: out['fail'].append(f'no gate lorries at port {pi}')
      # tractor turning at the loop end
      await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const w=PL(P,(P.tl1+P.tl2)/2,P.lv1); const t=__bigrig.truck; t.x=w[0]*M_T; t.y=w[1]*M_T-60; t.v=0; }})()")
      for k in range(4):
        await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{PRE}_p{pi}_tractor_{k}.png')
      # yard: straddle carrier + workers + pickup bays
      await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const w=PL(P,P.legL-3,P.strad.v); const t=__bigrig.truck; t.x=w[0]*M_T; t.y=w[1]*M_T; }})()")
      await pg.evaluate('typeof closeUI==="function"&&closeUI()'); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{PRE}_p{pi}_yard.png')
      b0=await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const b=portPickBays(P)[0]; if(!b) return null; const t=__bigrig.truck; t.x=b.kx+25; t.y=b.ky+10; return [b.kx,b.ky]; }})()")
      if not b0: out['fail'].append(f'no pickup bays port {pi}')
      await pg.wait_for_timeout(1200); await pg.evaluate('typeof closeUI==="function"&&closeUI()'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{PRE}_p{pi}_pickbays.png')
      # deterministic: insert a test lorry with a clear 30+ tile stretch behind the queue and park the player 14 tiles ahead of it on its path
      await pg.evaluate(f"(()=>{{ const t=__bigrig.truck; const P=portList()[{pi}]; const w=PL(P,P.legL-4,P.impC); t.x=w[0]*M_T; t.y=w[1]*M_T; }})()")
      placed=0
      for k in range(40):
        placed=await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const mn=Math.min(P.laneLen,...P.lors.map(l=>l.p)); const x=Math.max(-P.lpre+2,mn-40); if(mn-x<30) return 0; const l={{p:x,box:'#2e86c1',kind:'exp',w:0,still:0,col:'#f4f6f7',test:1}}; P.lors.push(l); P.ex=Math.min(P.ex,2); const q=polyAt(P.lpath,P.lpre+x+14), w=PL(P,q[0],q[1]); const t=__bigrig.truck; t.x=w[0]*M_T; t.y=w[1]*M_T; t.v=0; return 1; }})()")
        if placed: break
        await pg.wait_for_timeout(1500)
      if not placed: out['fail'].append(f'no moving gate lorry to test against at port {pi}')
      md=1e9; ys=0
      for k in range(12):
        await pg.wait_for_timeout(1500)
        d=await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; let m=1e9,y=0; for(const l of P.lors){{ if(l.x==null) continue; const w=PL(P,l.x,l.y); m=Math.min(m,Math.hypot(w[0]*M_T-__bigrig.truck.x,w[1]*M_T-__bigrig.truck.y)); if(l.yield) y++; }} let tm=1e9; for(const tr of P.tracs){{ const q=loopPos(P,tr.s), w=PL(P,q[0],q[1]); tm=Math.min(tm,Math.hypot(w[0]*M_T-__bigrig.truck.x,w[1]*M_T-__bigrig.truck.y)); }} return [m,y]; }})()")
        md=min(md,d[0]); ys=max(ys,d[1])
        if k==11: await pg.screenshot(path=f'{PRE}_p{pi}_block_lorry.png')
      out[f'blockLorry{pi}']={'minDist':round(md,1),'yielding':ys}
      if md<8: out['fail'].append(f'lorry drove into player at port {pi}: {md}')
      if ys==0: out['fail'].append(f'no lorry yielded at port {pi}')
      # player on the tractor loop
      await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const q=loopPos(P,P.lLv*0.5), w=PL(P,q[0],q[1]); const t=__bigrig.truck; t.x=w[0]*M_T; t.y=w[1]*M_T; t.v=0; }})()")
      md=1e9; ys=0
      for k in range(10):
        await pg.wait_for_timeout(1500)
        d=await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; let m=1e9,y=0; for(const tr of P.tracs){{ const q=loopPos(P,tr.s), w=PL(P,q[0],q[1]); m=Math.min(m,Math.hypot(w[0]*M_T-__bigrig.truck.x,w[1]*M_T-__bigrig.truck.y)); if(tr.yield) y++; }} return [m,y]; }})()")
        md=min(md,d[0]); ys=max(ys,d[1])
        if k==9: await pg.screenshot(path=f'{PRE}_p{pi}_block_tractor.png')
      out[f'blockTractor{pi}']={'minDist':round(md,1),'yielding':ys}
      if md<7: out['fail'].append(f'tractor drove into player at port {pi}: {md}')
      # map
      await pg.evaluate("openMap()"); await pg.wait_for_timeout(300)
      await pg.evaluate(f"(()=>{{ const P=portList()[{pi}]; const w=PL(P,0,(P.vA+P.vB)/2); bigmap.zt=bigmap.z=3.2; bigmap.cx=w[0]; bigmap.cy=w[1]; bigmap.anchor=null; }})()"); await pg.wait_for_timeout(800)
      await pg.screenshot(path=f'{PRE}_p{pi}_map.png'); await pg.evaluate("closeMap()")
    # board: port container jobs listed, accept one -> trailer in the pickup bay
    j=await pg.evaluate("""(()=>{ career.jobs=[]; fillBoard(); const pj=career.jobs.filter(j=>j.portBoard); if(!pj.length) return {n:0}; const j=pj[0]; const ok=acceptJob(j); const a=career.active; const tr=a&&a.trailer; return {n:pj.length,list:pj.map(j=>[j.from.name,j.to.name,j.pay]),ok,inPickBay:!!(a&&a.pickBay&&a.pickBay.portPick),trailer:tr&&tr.type}; })()""")
    out['board']=j
    if not j.get('n') or not j.get('inPickBay'): out['fail'].append('board port jobs '+json.dumps(j))
    await pg.evaluate("openJobs&&openJobs()") if await pg.evaluate("typeof openJobs==='function'") else None
    await pg.wait_for_timeout(800); await pg.screenshot(path=f'{PRE}_board.png')
    out['errors']=errs
    if errs: out['fail'].append('page errors')
    print(json.dumps(out)); print('PASS' if not out['fail'] else 'FAIL'); await b.close()
asyncio.run(main())
