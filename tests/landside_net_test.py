"""v64 road-network check for the Albion Airport landside + Kingsbridge corner junctions (James 22 Oct).
- every new/changed road joins the network at both ends (junction, curve, lane-drop link or roundabout); no dead ends in either area
- every map POI (depots, homes, shops, fuel, garages, stations, fast-travel points) has a road in the main connected network nearby
- Airport Way above the superstores is a curved bend (world.bends), no junction box there; AI never indicates on it
- departures loop is one-way: no AI vehicle ever drives against the flow; turns into it only from the entry leg
- Kingsbridge: no roundabouts left at the 4 loop corners, each corner is one signalised junction
Usage: python3 tests/landside_net_test.py [BigRig.html]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
JS = r"""(()=>{ const W=__bigrig.world, S=W.segs, fail=[], info={};
  const AP=[340,686,600,722], KB=[1400,1400,1950,1950];
  const inR=(q,R)=>{ const x0=q.dir==='h'?q.b0:q.a, x1=q.dir==='h'?q.b1:q.a+q.w-1, y0=q.dir==='h'?q.a:q.b0, y1=q.dir==='h'?q.a+q.w-1:q.b1; return x1>=R[0]&&x0<=R[2]&&y1>=R[1]&&y0<=R[3]; };
  const adj=S.map(()=>new Set()), add=(a,b)=>{ if(a==null||b==null||a<0||b<0) return; adj[a].add(b); adj[b].add(a); };
  for(const J of W.junctions) add(J.hs,J.vs);
  for(const c of W.curves||[]) if(c.A&&c.B) add(c.A.seg,c.B.seg);
  for(const q of S){ if(q.link0!=null) add(q.id,q.link0); if(q.link1!=null) add(q.id,q.link1); }
  for(const rb of W.rbs) for(const a of rb.arms) for(const b of rb.arms) add(a.seg,b.seg);
  const comp=new Int32Array(S.length).fill(-1); let nc=0; const size=[];
  for(let i=0;i<S.length;i++){ if(comp[i]>=0) continue; let n=0; const st=[i]; comp[i]=nc; while(st.length){ const u=st.pop(); n++; for(const v of adj[u]) if(comp[v]<0){ comp[v]=nc; st.push(v); } } size.push(n); nc++; }
  const main=size.indexOf(Math.max(...size)); info.segs=S.length; info.mainSegs=size[main];
  const endOK=(q,e)=>{ const r=(q.js||[]).map(j=>q.dir==='h'?[j.x,j.x+j.w]:[j.y,j.y+j.h]);
    return e? (r.some(z=>z[1]>=q.b1)||q.cv1!=null||q.link1!=null||q.rb1!=null) : (r.some(z=>z[0]<=q.b0+1)||q.cv0!=null||q.link0!=null||q.rb0!=null); };
  const dead=[], changed=[];
  for(const q of S){ const a=inR(q,AP), k=inR(q,KB); if(!a&&!k) continue;
    if(a||q.kbx) changed.push(q.id);
    for(const e of [0,1]) if(!endOK(q,e)) dead.push([a?'airport':'kingsbridge',q.id,q.dir,q.a,q.b0,q.b1,q.name||'',e?'end':'start']);
    if(comp[q.id]!==main) fail.push('not in main network: seg '+q.id+' '+(q.name||'')); }
  info.changedSegs=changed.length; info.deadEnds=dead;
  for(const d of dead) if(d[0]==='airport'||(S[d[1]]&&S[d[1]].kbx)) fail.push('dead end '+JSON.stringify(d));
  const segAt=(tx,ty)=>{ if(tx<0||ty<0||tx>=MW||ty>=MH) return -1; const i=tx+ty*MW; return W.roadH[i]>=0?W.roadH[i]:W.roadV[i]>=0?W.roadV[i]:-1; };
  const kinds={};
  for(const P of __bigrig.BigRig.mapPOIs()){ if(P.kind==='Hide box') continue; const cx=Math.floor(P.x/M_T), cy=Math.floor(P.y/M_T); let best=-1,bd=1e9;
    for(let r=0;r<=60&&best<0;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue; const s=segAt(cx+dx,cy+dy); if(s>=0&&comp[s]===main){ const d=Math.hypot(dx,dy); if(d<bd){bd=d;best=s;} } }
    const k=kinds[P.kind]||(kinds[P.kind]=[0,0]); k[1]++; if(best>=0) k[0]++; else fail.push('POI not reachable: '+P.kind+' '+P.name); }
  info.poi=kinds;
  const bend=(W.bends||[]).find(b=>b[0]===346&&b[1]===716); info.bend=bend||null; if(!bend) fail.push('Airport Way bend missing');
  const jHere=W.junctions.filter(J=>J.x>=340&&J.x<=352&&J.y>=710&&J.y<=724); info.junctionsAtBend=jHere.length; if(jHere.length) fail.push('junction box at the Airport Way bend');
  info.apJunctions=W.junctions.filter(J=>J.x>=340&&J.x<=600&&J.y>=686&&J.y<=722).map(J=>[J.x,J.y,S[J.hs].name,S[J.vs].name,J.lights?'signals':'give-way']);
  const L1=S.find(q=>q.dir==='v'&&q.a===410&&q.ow), L3=S.find(q=>q.dir==='v'&&q.a===494&&q.ow), AW=S.find(q=>q.dir==='h'&&q.a===716&&q.name==='Airport Way');
  for(const J of AW.js){ for(const d of [1,-1]){ const o=jOptions(J,AW,d); for(const op of o.opts) if(op[1]&&op[1].ow&&op[2]!==op[1].ow) fail.push('turn against one-way at '+J.x); } }
  const J410=AW.js.find(J=>J.x===410), J494=AW.js.find(J=>J.x===494);
  info.loopEntry=[1,-1].map(d=>jOptions(J410,AW,d).opts.filter(o=>o[1]===L1).length); info.loopExitIntoFromAW=[1,-1].map(d=>jOptions(J494,AW,d).opts.filter(o=>o[1]===L3).length);
  info.loopExitMoves=jOptions(J494,L3,1).opts.map(o=>o[0]);
  if(info.loopEntry.some(n=>n!==1)) fail.push('loop entry not reachable from both ways'); if(info.loopExitIntoFromAW.some(n=>n)) fail.push('can turn into the loop exit');
  const KC=[[1530,1530],[1705,1530],[1705,1680],[1530,1680]];
  info.kbRbsLeft=W.rbs.filter(r=>KC.some(c=>Math.hypot(r.cx-c[0],r.cy-c[1])<20)).length; if(info.kbRbsLeft) fail.push('roundabout left at a Kingsbridge corner');
  info.kbCorners=KC.map(c=>{ const js=W.junctions.filter(J=>Math.abs(J.x+J.w/2-c[0])<=4&&Math.abs(J.y+J.h/2-c[1])<=4); return {c, n:js.length, lights:js.map(J=>!!J.lights), arms:js.map(J=>[S[J.hs],S[J.vs]].reduce((n,q)=>{ const r=q.dir==='h'?[J.x,J.x+J.w]:[J.y,J.y+J.h]; return n+(q.b0<r[0]-0.5?1:0)+(q.b1+1>r[1]+0.5?1:0); },0))}; });
  for(const k of info.kbCorners){ if(k.n!==1) fail.push('Kingsbridge corner '+k.c+' has '+k.n+' junctions'); else if(!k.lights[0]) fail.push('Kingsbridge corner '+k.c+' not signalised'); }
  return {info,fail}; })()"""
SIM = r"""(async(secs)=>{ const W=__bigrig.world, S=W.segs, B=__bigrig; const T=B.truck; const out={wrong:0,onLoop:0,bendSig:0,bendCars:0,cars:0,errs:[]}; const seen=new Set();
  const L=new Set(S.filter(q=>q.ow).map(q=>q.id));
  const places=[[452*4,705*4],[372*4,740*4],[1610*4,1600*4]]; let pi=0;
  for(let t=0;t<secs;t+=0.1){
    if(t%20<0.1){ const p=places[pi++%places.length]; T.x=p[0]; T.y=p[1]; T.v=0; }
    try{ updateTraffic(0.1); }catch(e){ out.errs.push(String(e)); break; }
    for(const v of traffic.vs){ if(!v.plan) continue; const P=v.plan; out.cars++;
      if(L.has(P.seg)){ out.onLoop++; seen.add(v.id); if(P.dir!==S[P.seg].ow) out.wrong++; }
      const tx=v.x/M_T, ty=v.y/M_T; if(tx>344&&tx<356&&ty>712&&ty<726){ out.bendCars++; if(v.sig) out.bendSig++; } } }
  out.loopVehicles=seen.size; return out; })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader"])
        pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world&&__bigrig.world.ready&&__bigrig.truck", timeout=300000)
        await pg.wait_for_timeout(1500)
        r = await pg.evaluate(JS)
        print(json.dumps(r["info"], indent=1))
        sim = await pg.evaluate(SIM + "(240)")
        print("sim", json.dumps(sim))
        f = r["fail"]
        if sim["wrong"]: f.append("AI against the one-way flow: %d samples" % sim["wrong"])
        if sim["bendSig"]: f.append("AI indicating on the Airport Way bend: %d samples" % sim["bendSig"])
        if sim["errs"]: f.append("sim errors " + str(sim["errs"]))
        if errs: f.append("page errors " + str(errs))
        for x in f: print("FAIL", x)
        print("PASS" if not f else "FAILED (%d)" % len(f))
        await b.close()
        sys.exit(1 if f else 0)
asyncio.run(main())
