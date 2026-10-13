"""Railway route audit (v29 router): track never overlaps a building, functional site or road except at its crossings; crossings are
near-square; bridges/stations/hub kept; corridor clear of trees; timetable self-test; fast travel + map; no console errors at 390x844.
Usage: python3 tests/rail_route_test.py [path/to/index.html] [screenshot_dir]   (needs playwright + /usr/bin/google-chrome)"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','index.html')
SHOTS=sys.argv[2] if len(sys.argv)>2 else None
AUDIT=r"""(()=>{ const R=__bigrig.RAIL, W=__bigrig.world, L=R.L, fail=[], H=R.hard;
  const RD=t=>t===T.ROAD||t===T.BRIDGE||t===T.WALK||t===T.ISLAND;
  const inFP=(tx,ty)=>(W.funcFP||[]).some(b=>tx>=b[0]&&tx<=b[2]&&ty>=b[1]&&ty<=b[3]);
  const zone=s=>R.cross.some(c=>{ const d=((s-c.sa)%L+L)%L; return d<=(c.sb-c.sa)+30 || L-d<=30; });   // crossing + 30 m approach (pavements/verges)
  let samples=0, bad={bldg:0,func:0,road:0}; const where=[];
  const hit=(k,x,y,s,tr)=>{ bad[k]++; if(where.length<12) where.push([k,tr,Math.round(s),Math.round(x/M_T),Math.round(y/M_T)]); };
  for(const tr of R.tracks){ for(const p of tr.P){ samples++; for(const w of [-2.9,-1.5,0,1.5,2.9]){ const x=p.x+p.nx*w, y=p.y+p.ny*w, tx=Math.floor(x/M_T), ty=Math.floor(y/M_T), i=ty*MW+tx;
        if(H&&H[i]) hit('bldg',x,y,p.s,tr.id); else if(inFP(tx,ty)) hit('func',x,y,p.s,tr.id);
        if(RD(G[i])&&!(tr.main&&zone(p.s))) hit('road',x,y,p.s,tr.id); } } }
  // station platforms (hub: both islands)
  for(const st of R.stations){ const plat=st.kind==='hub'?[[3.6,7.5],[12.7,16.6]]:[[3.6,7.4]];
    for(let s=st.s-st.len/2;s<=st.s+st.len/2;s+=2){ const i0=((Math.round(s)%L)+L)%L; for(const [a,b] of plat) for(let w=a;w<=b;w+=1){ const x=R.X[i0]+R.NX[i0]*w, y=R.Y[i0]+R.NY[i0]*w, tx=Math.floor(x/M_T), ty=Math.floor(y/M_T), i=ty*MW+tx;
      if(H&&H[i]) hit('bldg',x,y,s,'plat:'+st.name); else if(inFP(tx,ty)) hit('func',x,y,s,'plat:'+st.name); if(RD(G[i])||G[i]===T.WATER) hit('road',x,y,s,'plat:'+st.name); } }
    let near=1e9; const cx=Math.floor(R.X[st.s]/M_T), cy=Math.floor(R.Y[st.s]/M_T); const RW=st.kind==='hub'?35:20; for(let dy=-RW;dy<=RW;dy++) for(let dx=-RW;dx<=RW;dx++){ const g=get(cx+dx,cy+dy); if(g===T.ROAD) near=Math.min(near,Math.hypot(dx,dy)*M_T); }
    if(near>(st.kind==='hub'?140:100)) fail.push('station far from road '+st.name+' '+Math.round(near)); }
  for(const k in bad) if(bad[k]) fail.push(k+' overlaps: '+bad[k]);
  // crossings are near-square: road axis by PCA of road tiles around the crossing vs track tangent
  const ang=[]; for(const c of R.cross){ const x0=Math.floor(c.mx/M_T), y0=Math.floor(c.my/M_T); let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
    for(let dy=-7;dy<=7;dy++) for(let dx=-7;dx<=7;dx++){ const g=get(x0+dx,y0+dy); if(g!==T.ROAD&&g!==T.BRIDGE) continue; n++; sx+=dx; sy+=dy; sxx+=dx*dx; syy+=dy*dy; sxy+=dx*dy; }
    sx/=n; sy/=n; const a=sxx/n-sx*sx, b=syy/n-sy*sy, cc=sxy/n-sx*sy, phi=0.5*Math.atan2(2*cc,a-b); const rx=Math.cos(phi), ry=Math.sin(phi);
    const deg=Math.round(Math.acos(Math.min(1,Math.abs(rx*c.tx+ry*c.ty)))*180/Math.PI); ang.push(deg); if(deg<62) fail.push('crossing not square: '+deg+' deg at '+x0+','+y0); }
  // curvature: radius over 40 m chords
  let minR=1e9, at=null; const rad=[]; for(let s=0;s<L;s+=4){ const a=s, b=(s+20)%L, c=(s+40)%L; const ax=R.X[a],ay=R.Y[a],bx=R.X[b],by=R.Y[b],cx=R.X[c],cy=R.Y[c]; const A2=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax)); if(A2<1e-6) continue; const r=Math.hypot(bx-ax,by-ay)*Math.hypot(cx-bx,cy-by)*Math.hypot(cx-ax,cy-ay)/(2*A2); if(r<minR){ minR=r; at=[Math.round(bx/M_T),Math.round(by/M_T)]; } rad.push(r); }
  rad.sort((a,b)=>a-b); const pct=q=>Math.round(rad[Math.floor(rad.length*q)]);
  if(minR<R_MIN) fail.push('curve too tight: R='+Math.round(minR)+' m at '+at);
  // trees/bushes/rocks inside the corridor (6 m either side of the centreline)
  let trees=0; const seen=new Set(); for(const arr of W.chunkObjs.values()) for(const o of arr){ if(seen.has(o)) continue; seen.add(o); if(!({tree:1,bush:1,rock:1,hedge:1,cactus:1,scrub:1})[o.kind]) continue;
    const px=o.x/PPM, py=o.y/PPM; const s0=0; let best=1e9; for(let s=0;s<L;s+=6){ const d=Math.hypot(R.X[s]-px,R.Y[s]-py); if(d<best) best=d; if(d>400) s+=Math.floor(d/2); } if(best<6) trees++; }
  if(trees) fail.push('trees in corridor: '+trees);
  // bridges, stations, hub, timetable
  if(!R.route||!R.route.cells) fail.push('router fell back to legacy spline: '+R.routeFail);
  if((R.bridges||[]).length<3) fail.push('too few suspension bridges: '+(R.bridges||[]).length);
  if(R.stations.length!==13||!R.hub) fail.push('stations/hub missing');
  const st5=railSelfTest(5,1); if(!st5.ok) fail.push('timetable clash '+JSON.stringify(st5));
  return {L,samples,bad,where,cross:R.cross.length,over:R.cross.filter(c=>c.over).length,crossDeg:ang,bridges:(R.bridges||[]).length,stations:R.stations.map(s=>s.name),minR:Math.round(minR),minRat:at,rP5:pct(0.05),rP50:pct(0.5),trees,route:{ms:R.route&&R.route.ms},self5:st5,fail}; })()""".replace('R_MIN','40')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True); errs=[]
    pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready",timeout=180000)
    await pg.keyboard.press('Enter'); await pg.mouse.click(195,600); await pg.wait_for_timeout(800)
    a=await pg.evaluate(AUDIT)
    # crossings still work: barrier closes while a train occupies a crossing
    cr=await pg.evaluate("""(()=>{ const R=__bigrig.RAIL; const c=R.cross.find(c=>!c.over); if(!c) return {none:1}; let closed=0,open=0; for(let t=0;t<2400;t+=2){ const st=__bigrig.railCrossState(c,t); if(st.f>0.9) closed++; else if(st.f<0.05) open++; } return {closed,open}; })()""")
    if not cr.get('none') and (cr['closed']==0 or cr['open']==0): a['fail'].append('crossing never cycles '+json.dumps(cr))
    # fast travel to a station
    ft=await pg.evaluate("""(()=>{ const P=railPOIs(); const t=__bigrig.truck; if(t.trl){ t.trl.coupled=false; t.trl=null; } t.v=0; const st=P.find(q=>/Millford/.test(q.name))||P[0]; const x0=t.x; t.money=1e6; const ok=fastTravel(st); return {ok,name:st.name,sx:st.x,sy:st.y}; })()""")
    await pg.wait_for_timeout(1500)
    pos=await pg.evaluate("[__bigrig.truck.x,__bigrig.truck.y]")
    d=((pos[0]-ft['sx'])**2+(pos[1]-ft['sy'])**2)**0.5
    if not ft['ok'] or d>500: a['fail'].append('fast travel to station failed '+json.dumps(ft)+' d='+str(round(d)))
    if SHOTS:
      os.makedirs(SHOTS,exist_ok=True)
      await pg.evaluate("openMap()"); await pg.wait_for_timeout(300)
      await pg.evaluate("(()=>{ mapZoomTo(mapFitZ()); bigmap.z=bigmap.zt; bigmap.cx=MW/2; bigmap.cy=MH/2; })()"); await pg.wait_for_timeout(900)
      await pg.screenshot(path=os.path.join(SHOTS,'rr_map_full.png'))
      for nm,(cx,cy,z) in {'rr_map_north':(700,420,0.55),'rr_map_south':(700,1500,0.55),'rr_map_albion':(330,560,2.6)}.items():
        await pg.evaluate(f"(()=>{{ bigmap.zt=bigmap.z={z}; bigmap.cx={cx}; bigmap.cy={cy}; bigmap.anchor=null; }})()"); await pg.wait_for_timeout(900)
        await pg.screenshot(path=os.path.join(SHOTS,nm+'.png'))
      await pg.evaluate("closeMap()")
      # in-game close-up of Albion East Fuel (camera over the forecourt, daytime)
      f=await pg.evaluate("(()=>{ const f=__bigrig.world.fuel.find(f=>/Albion East/.test(f.name)); return f?[f.x,f.y,f.name]:null; })()")
      if f:
        await pg.evaluate(f"(()=>{{ const t=__bigrig.truck; t.x={f[0]}; t.y={f[1]}+40; t.v=0; if(typeof gameT!=='undefined') gameT=12; }})()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=os.path.join(SHOTS,'rr_albion_east_fuel.png'))
        await pg.evaluate("openMap()"); await pg.wait_for_timeout(200)
        await pg.evaluate(f"(()=>{{ bigmap.zt=bigmap.z=5; bigmap.cx={f[0]}/M_T; bigmap.cy={f[1]}/M_T; bigmap.anchor=null; }})()"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=os.path.join(SHOTS,'rr_albion_east_fuel_map.png')); await pg.evaluate("closeMap()")
        a['albionEastFuel']=f
      # a bridge and the hub in game
      for nm,js in {'rr_bridge':"(()=>{const R=__bigrig.RAIL,b=R.bridges[0];return [b.cx,b.cy];})()",'rr_hub':"(()=>{const R=__bigrig.RAIL,h=R.hub;return [R.X[h.s],R.Y[h.s]];})()"}.items():
        q=await pg.evaluate(js); await pg.evaluate(f"(()=>{{ const t=__bigrig.truck; t.x={q[0]}; t.y={q[1]}; t.v=0; }})()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=os.path.join(SHOTS,nm+'.png'))
    await pg.wait_for_timeout(500)
    a['crossCycle']=cr; a['fastTravel']=dict(ft,dist=round(d)); a['errors']=errs
    if errs: a['fail'].append('console errors')
    await b.close(); print(json.dumps(a,indent=1)); ok=not a['fail']; print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
asyncio.run(main())
