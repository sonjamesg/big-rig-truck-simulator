"""Map-wide junction audit: every T/crossroads, roundabout, lane-drop taper and curve tie.
Static: tarmac continuity through each junction box + arm mouths, lane arrows match legal moves, left-hand lane order,
mast arms on every approach of a signalled junction, sat-nav route between every pair of arms.
Dynamic: AI soak at every junction cluster (forced spawns) - overlaps, stuck vehicles, console errors.
Usage: python3 tests/junction_audit_test.py [BigRig.html] [seconds_per_cluster]   env ONLY=J12,RB3 limits the soak"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','BigRig.html')
SECS=float(sys.argv[2]) if len(sys.argv)>2 else 14
STATIC=r"""(()=>{ const W=world, S=W.segs, bad=[]; let nJ=0,nT=0,nC=0;
  const isR=(x,y)=>onTarmacT(x+0.5,y+0.5);
  for(const J of W.junctions){ nJ++;
    for(let y=J.y;y<J.y+J.h;y++) for(let x=J.x;x<J.x+J.w;x++) if(!isR(x,y)) bad.push({J:J.id,why:'box-gap',x,y});
    for(const sg of [S[J.hs],S[J.vs]]) for(const d of [-1,1]){ if(J.gs&&sg.id===J.vs) continue; /* J103: minor arm replaced by the slip roundabout (tests/j103_test.py) */ const o=jOptions(J,sg,d); const ap=J.appr&&J.appr[sg.id+':'+d];
      const has= d>0? sg.b0<o.stop-0.5 : sg.b1+1>o.stop+0.5; if(!has) continue;
      for(let k=1;k<=Math.min(3,Math.abs(d>0?o.stop-sg.b0:sg.b1+1-o.stop));k++) for(let c=sg.a;c<sg.a+sg.w;c++){ const u=d>0?o.stop-k:o.stop+k-1; const x=sg.dir==='h'?u:c, y=sg.dir==='h'?c:u; if(!isR(x,y)) bad.push({J:J.id,why:'mouth-gap',x,y}); }
      if(ap&&ap.lanes){ const mv=o.opts.map(q=>q[0]); for(let l=0;l<ap.lanes.length;l++) for(const ch of ap.lanes[l]) if(mv.indexOf(ch)<0) bad.push({J:J.id,why:'arrow-illegal',key:sg.id+':'+d,lane:l,lanes:ap.lanes,mv});
        for(const m of mv) if(!ap.lanes.some(L=>L.indexOf(m)>=0)) bad.push({J:J.id,why:'move-unmarked',key:sg.id+':'+d,m,lanes:ap.lanes});
        if(ap.lanes.length>1){ const iL=ap.lanes.findIndex(L=>L.indexOf('L')>=0), iR=ap.lanes.findIndex(L=>L.indexOf('R')>=0); if(iL>=0&&iR>=0&&iL>iR) bad.push({J:J.id,why:'L-right-of-R',key:sg.id+':'+d}); } }
      if(J.lights){ const f=sg.dir==='h'?[d,0]:[0,d]; if(!W.overhead.some(o=>(o.kind==='mast'&&o.J===J&&o.f[0]===f[0]&&o.f[1]===f[1])||(o.kind==='ukjx'&&o.J===J&&o.arms.some(A=>A&&A.key===sg.id+':'+d)))) bad.push({J:J.id,why:'no-signal-head',key:sg.id+':'+d}); } } }
  { const seen=new Map(); for(const J of W.junctions){ const k=J.x+','+J.y; if(seen.has(k)) bad.push({J:J.id,why:'duplicate-junction',with:seen.get(k)}); else seen.set(k,J.id); } }
  for(const sg of S) for(const d of [-1,1]){ const p=lanePt(sg,d,0,(sg.b0+sg.b1)/2), c=(sg.a+sg.w/2)*M_T;
    if(nLanes(sg)>1||sg.w>=2){ if(sg.dir==='h'){ if(Math.sign(p[1]-c)!==-d) bad.push({seg:sg.id,why:'right-hand',d}); } else if(Math.sign(p[0]-c)!==d) bad.push({seg:sg.id,why:'right-hand',d}); } }
  for(const t of W.tapers||[]){ nT++; let g=0; for(const p of t.pts) if(!onTarmacT(p[0],p[1])) g++; if(g) bad.push({taper:t.id,why:'taper-gap',g}); }
  for(const cv of W.curves){ nC++; let g=0; for(const p of cv.pts) if(!onTarmacT(p[0],p[1])) g++; if(g) bad.push({curve:cv.id,name:cv.name,why:'curve-gap',g}); }
  return {nJ,nT,nC,nRb:W.rbs.length,bad}; })()"""
NAVT=r"""((i)=>{ const S=world.segs,J=world.junctions[i]; const arms=[]; for(const sg of [S[J.hs],S[J.vs]]) for(const d of [-1,1]){ const o=jOptions(J,sg,d); let far=Math.round(o.stop-d*8); if(d>0?sg.b0>far:sg.b1<far) continue; const c=sg.a+(sg.w>>1); for(let k=0;k<8&&get(sg.dir==='h'?far:c,sg.dir==='h'?c:far)!==T.ROAD;k++) far+=d; /* the nav grid is tile-based: a stub ending in a roundabout mouth has verge tiles under the drawn asphalt */ arms.push(sg.dir==='h'?[far,c]:[c,far]); }
  const out=[]; for(let a=0;a<arms.length;a++) for(let b=0;b<arms.length;b++) if(a!==b){ const p=navAStar(arms[a][0],arms[a][1],arms[b][0],arms[b][1]); const m=Math.abs(arms[a][0]-arms[b][0])+Math.abs(arms[a][1]-arms[b][1]); if(!p||p.length>m*4+20) out.push({J:i,from:arms[a],to:arms[b],len:p?p.length:null,m}); } return {n:arms.length*(arms.length-1),bad:out}; })"""
SOAK=r"""((cx,cy,R)=>{ const B=__bigrig, tk=B.truck; tk.x=cx*M_T; tk.y=cy*M_T; tk.v=0; { let best=null; for(let r=6;r<40&&!best;r++) for(let k=0;k<64&&!best;k++){ const x=Math.floor(cx+Math.cos(k/64*6.283)*r), y=Math.floor(cy+Math.sin(k/64*6.283)*r); let ok=true; for(let dy=-3;dy<=3&&ok;dy++) for(let dx=-3;dx<=3;dx++){ const t=get(x+dx,y+dy); if(t===1||t===4||t===3||world.roadH[idx(x+dx,y+dy)]!==-1){ ok=false; break; } } if(ok) best=[x,y]; } if(best){ tk.x=(best[0]+0.5)*M_T; tk.y=(best[1]+0.5)*M_T; } }   // park the test truck off the road so it never blocks the traffic it is watching
  const T={coll:new Set(),seen:new Set(),stuck:new Set(),last:new Map(),t0:timeS,rec0:B.traffic.recovers||0,pairs:[],why:[],hist:new Map()}; const STUCK=window.__STUCK||60;
  const zone=v=>Math.hypot(v.x/M_T-cx,v.y/M_T-cy)<R;
  const box=(x,y,h,L,Wd)=>{ const f=fwd(h), r=rgt(h); return [[L,Wd],[L,-Wd],[-L,-Wd],[-L,Wd]].map(([a,b])=>[x+f[0]*a+r[0]*b,y+f[1]*a+r[1]*b]); };
  const corners=v=>{ const o=[box(v.x,v.y,v.h||0,v.L*0.42,v.W*0.4)]; if(v.trl) o.push(box(v.trl.x,v.trl.y,v.trl.h,13.6*0.42,2.5*0.4)); return o; };
  const sep=(A,Bq)=>{ for(const P of [A,Bq]) for(let i=0;i<4;i++){ const p=P[i],q=P[(i+1)%4], nx=q[1]-p[1], ny=p[0]-q[0]; let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9; for(const z of A){ const d=z[0]*nx+z[1]*ny; a0=Math.min(a0,d); a1=Math.max(a1,d); } for(const z of Bq){ const d=z[0]*nx+z[1]*ny; b0=Math.min(b0,d); b1=Math.max(b1,d); } if(a1<b0||b1<a0) return true; } return false; };
  const hit=(A,Bq)=>A.some(a=>Bq.some(b=>!sep(a,b)));
  window.__jaT=T; clearInterval(window.__jaI);
  window.__jaI=setInterval(()=>{ const vs=B.traffic.vs.filter(zone);
    for(const v of vs){ if(window.__DBG){ let H=T.hist.get(v.id); if(!H){H=[];T.hist.set(v.id,H);} H.push([+(v.x/M_T).toFixed(1),+(v.y/M_T).toFixed(1),+v.v.toFixed(1)]); if(H.length>40) H.shift(); } T.seen.add(v.id); const L=T.last.get(v.id); if(!L||Math.hypot(v.x-L.x,v.y-L.y)>1) T.last.set(v.id,{x:v.x,y:v.y,t:timeS}); else if(timeS-L.t>STUCK&&!v.parked&&!T.stuck.has(v.id)){ T.stuck.add(v.id); let h=v,n=0; while(h.lead&&n<30){ h=h.lead; n++; } const m=h.mk&&h.mk.find(m=>(m.kind==='light'||m.kind==='gw'||m.kind==='rb')&&!m.go&&m.d>h.s);
      T.why.push({id:v.id,at:[v.x/M_T|0,v.y/M_T|0],queue:n,head:[h.x/M_T|0,h.y/M_T|0],headPlayer:!h.mk,mk:m&&m.kind,st:m&&m.kind==='light'?sigState(m.J,m.key,m.move):null,J:m&&m.J&&m.J.id,rb:m&&m.rb&&m.rb.id,headStop:+(h.stopT||0).toFixed(0)}); } }
    for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const a=vs[i],b=vs[j]; if(a.ghostT>0||b.ghostT>0||(a.layer|0)!==(b.layer|0)||Math.hypot(a.x-b.x,a.y-b.y)>30) continue; if(hit(corners(a),corners(b))){ const k=Math.min(a.id,b.id)+'-'+Math.max(a.id,b.id); if(!T.coll.has(k)){ T.coll.add(k); const d=o=>({hist:(T.hist.get(o.id)||[]).slice(-12),age:+(timeS-o.born).toFixed(1),lead:o.lead&&o.lead.id,mk:o.mk.map(m=>m.kind+':'+(m.d!==undefined?(m.d-o.s).toFixed(0):(m.d0-o.s).toFixed(0))).join(' '),id:o.id,k:o.kind,h:+(o.h||0).toFixed(2),v:+o.v.toFixed(1),seg:o.plan&&o.plan.seg,lane:o.plan&&o.plan.lane,trl:!!o.trl,ring:o.ring&&o.ring.id}); T.pairs.push({at:[a.x/M_T|0,a.y/M_T|0],a:d(a),b:d(b)}); } } }
    if(vs.length<12 && Math.random()<0.5){ const segs=B.world.segs.filter(s=>s.dir==='h'?(Math.abs(s.a-cy)<R&&s.b0<cx+R&&s.b1>cx-R):(Math.abs(s.a-cx)<R&&s.b0<cy+R&&s.b1>cy-R)); if(segs.length){ const sg=segs[(Math.random()*segs.length)|0], c=sg.dir==='h'?cx:cy, al=Math.max(sg.b0+1,Math.min(sg.b1-1,c+(Math.random()*2-1)*R*0.8)), dir=Math.random()<0.5?1:-1;
      if(!sg.js.some(j=>{ const [a,b]=jRange(sg,j); return al>a-3&&al<b+3; })){ const x=sg.dir==='h'?al:sg.a+sg.w/2, y=sg.dir==='h'?sg.a+sg.w/2:al; try{ B.spawnVehicle(x*M_T,y*M_T,true,{seg:sg.id,along:al,dir}); }catch(e){} } } } },250); })"""
STOP="""(()=>{ clearInterval(window.__jaI); const T=window.__jaT; return {nvs:__bigrig.traffic.vs.length,fps:+(__bigrig.fps||0).toFixed(0),seen:T.seen.size,stuck:T.why,coll:T.pairs,recov:(__bigrig.traffic.recovers||0)-T.rec0}; })()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':900,'height':700}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' and not m.text.startswith('Failed to load resource') else None)
    OPT=('favicon.ico','apple-touch-icon.png','manifest.webmanifest')   # page icons: absent when the HTML is copied elsewhere, not a game error
    pg.on('requestfailed',lambda r: None if r.url.split('?')[0].endswith(OPT) else errs.append('requestfailed '+r.url[:160]))
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=120000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
    if os.environ.get("DBG"): await pg.evaluate("window.__DBG=1")
    st=await pg.evaluate(STATIC); print('STATIC',json.dumps({k:st[k] for k in ['nJ','nT','nC','nRb']}),'issues',len(st['bad']),flush=True)
    for x in st['bad'][:80]: print('  ',json.dumps(x))
    nav=[]; nn=0
    for i in range(st['nJ']):
      try: r=await pg.evaluate(NAVT+f"({i})")
      except Exception as e: r={'n':1,'bad':[{'J':i,'err':str(e).split(chr(10))[0][:120]}]}   # navAStar threw (reported, the audit keeps going)
      nn+=r['n']; nav+=r['bad']
    print('NAV pairs',nn,'bad',len(nav),flush=True); [print('  ',json.dumps(x)) for x in nav[:30]]
    pts=await pg.evaluate("[...world.junctions.map(J=>[J.x+J.w/2,J.y+J.h/2,'J'+J.id]),...world.rbs.map(r=>[r.cx,r.cy,'RB'+r.id]),...(world.kbChan||[]).map(s=>[s.a+1,(s.b0+s.b1)/2,'Chan'+s.id])]")
    only=os.environ.get('ONLY'); cl=[]
    for x,y,n in pts:
      if only and n not in only.split(','): continue
      c=next((c for c in cl if abs(c[0]-x)<40 and abs(c[1]-y)<40),None)
      if c: c[2].append(n)
      else: cl.append([x,y,[n]])
    print('CLUSTERS',len(cl),flush=True); dyn=[]; thin=0; seen=0
    skip=int(os.environ.get('SKIP',0))   # resume a long soak after cluster N
    for x,y,names in cl[skip:skip+int(os.environ.get('LIMIT',10**6))]:
      if SECS<=0: break
      slow=os.environ.get('SLOW','').split(','); t=max(SECS,float(os.environ.get('SLOW_SECS',60))) if any(n in slow for n in names) else SECS
      await pg.evaluate(SOAK+f"({x},{y},40)"); await pg.wait_for_timeout(int(t*1000)); r=await pg.evaluate(STOP); seen+=r['seen']; thin+=r['seen']<3
      print('  progress',cl.index([x,y,names])+1,'/',len(cl),names[0],'secs',t,'seen',r['seen'],'vs',r.get('nvs'),'fps',r.get('fps'),flush=True)
      if os.environ.get('V'): print('  ',names[:4],json.dumps(r),flush=True)
      if r['stuck'] or r['coll']: dyn.append({'at':[x,y],'names':names,**r}); print('  DYN',json.dumps(dyn[-1]),flush=True)
    await b.close()
    print(json.dumps({'errors':errs[:10]}))
    ok=not st['bad'] and not nav and not dyn and not errs
    print('SUMMARY junctions',st['nJ'],'roundabouts',st['nRb'],'tapers',st['nT'],'curves',st['nC'],'clusters',len(cl),'static',len(st['bad']),'nav',len(nav),'dyn',len(dyn),'vehicles',seen,'thin',thin)
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
asyncio.run(main())
