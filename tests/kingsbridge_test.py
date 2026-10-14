"""Kingsbridge road audit: connectivity, signalised junctions, no duplicate/misaligned crossings, AI not stuck.
Usage: python3 tests/kingsbridge_test.py [path/to/BigRig.html]   (needs playwright + /usr/bin/google-chrome)"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
AUDIT=r"""(()=>{ const W=__bigrig.world,S=W.segs, X0=1385,Y0=1370,X1=1945,Y1=1945, inKB=(x,y)=>x>=X0&&y>=Y0&&x<=X1&&y<=Y1;
  const fail=[]; const kbJ=W.junctions.filter(J=>inKB(J.x,J.y)), nearRb=J=>W.rbs.some(r=>Math.hypot(J.x+J.w/2-r.cx,J.y+J.h/2-r.cy)<r.rout+1);
  // 1) every Kingsbridge junction is signalised (roundabouts are separate objects and stay as they are)
  for(const J of kbJ) if(!J.lights&&!nearRb(J)) fail.push('unlit junction '+J.x+','+J.y);
  // 2) no two junctions on the same spot
  const seen=new Map(); for(const J of kbJ){ const k=[J.x,J.y,J.w,J.h].join(); if(seen.has(k)) fail.push('duplicate junction '+k); seen.set(k,1); }
  // 3) junction boxes are open asphalt (no median / verge across them)
  for(const J of kbJ) for(let y=J.y;y<J.y+J.h;y++) for(let x=J.x;x<J.x+J.w;x++){ const g=G[idx(x,y)]; if(g!==T.ROAD&&g!==T.BRIDGE) fail.push('non-road tile in junction '+x+','+y); if(!W.jMask[idx(x,y)]) fail.push('unmasked junction tile '+x+','+y); }
  // 4) no dogleg: side streets on opposite sides of a dual carriageway that nearly (1-8 tiles) line up
  for(const D of S){ if(D.type!=='dual'||!inKB(D.dir==='h'?D.b0:D.a,D.dir==='h'?D.a:D.b0)) continue; const lo=S.filter(P=>P.dir!==D.dir&&P.b1===D.a-1&&P.a>=D.b0&&P.a<=D.b1), hi=S.filter(P=>P.dir!==D.dir&&P.b0===D.a+D.w&&P.a>=D.b0&&P.a<=D.b1);
    for(const p of lo) for(const q of hi){ const d=Math.abs(p.a-q.a); if(d>0&&d<=8) fail.push('dogleg across dual '+D.id+' at '+p.a+'/'+q.a); if(d===0&&p.w===q.w) fail.push('unmerged crossing '+p.a); } }
  // 5) connectivity: flood fill drivable tiles from the loop; every Kingsbridge street tile must be reached
  const isR=i=>G[i]===T.ROAD||G[i]===T.BRIDGE; const vis=new Uint8Array(MW*MH), st=[]; const s0=idx(1617,1531); if(!isR(s0)) fail.push('seed not road'); st.push(s0); vis[s0]=1;
  while(st.length){ const i=st.pop(), x=i%MW, y=(i/MW)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx,ny=y+dy; if(!inb(nx,ny)) continue; const j=idx(nx,ny); if(!vis[j]&&isR(j)){ vis[j]=1; st.push(j); } } }
  let tiles=0,unreached=0; for(const s of S){ if(s.type==='dirt') continue; for(let b=s.b0;b<=s.b1;b++){ const x=s.dir==='h'?b:s.a, y=s.dir==='h'?s.a:b; if(!inKB(x,y)||!inb(x,y)) continue; tiles++; if(!vis[idx(x,y)]){ unreached++; if(unreached<5) fail.push('unreachable street tile '+x+','+y+' seg '+s.id); } } }
  // 6) every signalised junction has a working phase plan: each approach gets a green at some point
  for(const J of kbJ){ if(!J.lights) continue; const P=sigOf(J); if(!P.stages.length) fail.push('no stages '+J.x+','+J.y); for(const k of Object.keys(J.appr||{})) if(!P.mvs.some(m=>m.key===k)) fail.push('approach never green '+J.x+','+J.y+' '+k); }
  // 7) Northgate Diagonal: chain of straight stubs joined by tied curves, every stub junction signalised
  const DG=W.kbDiag||[]; if(DG.length) fail.push('Northgate Diagonal should be gone'); const dset=new Set();
  for(const sg of DG){ if(!sg.js.length) fail.push('diagonal stub without junction '+sg.id); for(const J of sg.js) if(!J.lights) fail.push('diagonal junction unlit '+J.x+','+J.y);
    for(let b=sg.b0;b<=sg.b1;b++) for(let k=0;k<sg.w;k++) dset.add(sg.dir==='h'?idx(b,sg.a+k):idx(sg.a+k,b)); }
  const dcv=W.curves.filter(c=>c.name==='Northgate Diagonal'); if(dcv.length) fail.push('diagonal links '+dcv.length); for(const c of dcv){ if(!c.A||!c.B) fail.push('diagonal curve not tied '+c.id); for(const [x,y] of c.pts) dset.add(idx(Math.floor(x),Math.floor(y))); }
  const CH=W.kbChan||[]; if(CH.length!==2) fail.push('channel diagonal stubs missing'); for(const sg of CH){ if(!sg.js.length) fail.push('channel stub without junction'); for(const J of sg.js) if(!J.lights) fail.push('channel junction unlit');
    for(let b=sg.b0;b<=sg.b1;b++) for(let k=0;k<sg.w;k++) dset.add(sg.dir==='h'?idx(b,sg.a+k):idx(sg.a+k,b)); }
  const ccv=W.curves.filter(c=>c.name==='Channel Diagonal'); if(ccv.length!==1||!ccv[0].A||!ccv[0].B) fail.push('channel curve not tied'); for(const c of ccv) for(const [x,y] of c.pts){ dset.add(idx(Math.floor(x),Math.floor(y))); if(G[idx(Math.floor(x),Math.floor(y))]!==T.ROAD&&G[idx(Math.floor(x),Math.floor(y))]!==T.BRIDGE) fail.push('channel tile painted over '+x+','+y); }
  window.__diag=dset; const diagJ=DG.reduce((n,sg)=>n+sg.js.length,0);
  return {diagJunctions:diagJ,junctions:kbJ.length,lit:kbJ.filter(J=>J.lights).length,tiles,unreached,fail}; })()"""
OVL=r"""(()=>{ const vs=__bigrig.traffic.vs; let n=0; for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const a=vs[i],c=vs[j]; if((a.layer|0)===(c.layer|0)&&Math.hypot(a.x-c.x,a.y-c.y)<1.2) n++; } return n; })()"""
SAMPLE=r"""(()=>{ const out=[]; for(const v of __bigrig.traffic.vs){ const tx=v.x/M_T,ty=v.y/M_T; if(tx<1385||ty<1370) continue; out.push([v.id!==undefined?v.id:(v.__i||(v.__i=Math.random())),+v.x.toFixed(1),+v.y.toFixed(1),+(v.v||0).toFixed(2),window.__diag.has(idx(Math.floor(tx),Math.floor(ty)))?1:0]); } return out; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); res={}; ok=True
    for vw,vh in [(390,844),(1280,800)]:
      pg=await b.new_page(viewport={'width':vw,'height':vh}); errs=[]
      pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
      await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=120000)
      await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
      a=await pg.evaluate(AUDIT)
      await pg.evaluate("(()=>{const VW_="+str(vw)+",t=__bigrig.truck; t.x=(VW_<500?1460:1775)*M_T; t.y=(VW_<500?1470:1775)*M_T; t.v=0; if(t.trl) t.trl=null;})()")
      # AI soak: 100 s; a vehicle that never moves more than 2 m the whole time is stuck (longest light cycle < 80 s)
      first={}; last={}; still=0; ovl=0; onDiag=set()
      for k in range(50):
        await pg.wait_for_timeout(2000)
        ovl+=await pg.evaluate(OVL)
        for vid,x,y,v,dg in await pg.evaluate(SAMPLE):
          if dg: onDiag.add(vid)
          first.setdefault(vid,(x,y,k)); last[vid]=(x,y,k)
      stuck=[vid for vid,(x,y,k) in first.items() if last[vid][2]-k>=45 and abs(last[vid][0]-x)+abs(last[vid][1]-y)<2]
      r=dict(overlaps=ovl,stuckAt=[(round(first[v][0]/4),round(first[v][1]/4)) for v in stuck],audit=a,aiOnDiagonal=len(onDiag),aiSeen=len(first),aiStuck=len(stuck),errors=errs); res[f'{vw}x{vh}']=r
      if a['fail'] or stuck or errs or ovl: ok=False
      diagSeen=globals().setdefault('DS',[0]); diagSeen[0]+=len(onDiag)
      await pg.close()
    await b.close(); print(json.dumps(res,indent=1)); print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
asyncio.run(main())
