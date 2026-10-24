"""J103 grade-separated junction (motorway seg 58 on a bridge deck over a give-way roundabout with 4 slips + rural seg 145).
Checks, all from the real game data:
 1. map: ring / slips / rural mouth are continuous lower-level road (4-connected from every slip end to the rural road),
    motorway tiles intact under the deck, the services moved off the ring, no lights / gantries
 2. sat nav: motorway straight through never touches the ring; motorway <-> rural routes go via the slips + ring;
    no step between the deck and the ring (except straight under the deck on virtual lower nodes)
 3. AI sim (SIM_MIN game minutes, extra traffic spawned upstream on every approach):
    - collisions on the same level = 0 (deck vs ring overlaps counted separately: layer-separated)
    - give way: nobody crosses the give-way line while a circulating vehicle is within 0.3 rad upstream
    - nobody stopped > MAX_STOP s near the junction (no deadlock), throughput on every movement
    - on-slip merges: no collision within 2 s of a merge
 4. player layer: driving the deck = upper, driving the ring under it = lower
Usage: python3 tests/j103_test.py [index.html]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','index.html')
SIM_MIN=8; MAX_STOP=45
JS=r"""(async ([SIM,MAXS])=>{ const w=__bigrig.world, J3=w.j103, t=truck, out={};
 if(!J3||!J3.on) return {fatal:'j103 not built'};
 const lo=(x,y)=>(J3.lo[idx(x,y)]===1&&isRoadT(idx(x,y)))||J3.vmap.has(idx(x,y));
 const seen=new Set(), q=[[901,134]]; seen.add(901*4096+134);
 while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=x+dx,Y=y+dy,k=X*4096+Y; if(seen.has(k)||!lo(X,Y)) continue; seen.add(k); q.push([X,Y]); } }
 const ends={ebOff:[836,96],ebOn:[966,96],wbOff:[966,104],wbOn:[836,104],services:[905,119]};
 out.connected={}; for(const k in ends){ const [x,y]=ends[k]; let ok=false; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(seen.has((x+dx)*4096+y+dy)) ok=true; out.connected[k]=ok; }
 out.underDeckRing=J3.vr.length; let mwBroken=0; for(let x=860;x<945;x++) for(let y=97;y<103;y++) if(w.roadH[idx(x,y)]!==58) mwBroken++; out.mwBroken=mwBroken;
 out.servicesY=J3.fuel?J3.fuel.y/M_T:null; let fuelOnRing=0; for(let y=103;y<126;y++) for(let x=905;x<926;x++){ const i=idx(x,y); if((G[i]===T.CONC||G[i]===T.PUMP||G[i]===T.BLDG)&&Math.hypot(x+.5-901,y+.5-100)<12.5) fuelOnRing++; } out.fuelOnRing=fuelOnRing;
 // contact: continuous tarmac (tile + exact geometry) from each slip's parallel lane to the motorway kerb lane, and from the rural road into the ring
 out.contact={}; const tar=(x,y)=>onTarmacT(x,y)&&(w.roadH[idx(Math.floor(x),Math.floor(y))]===J3.mw||j3onLower(x,y));
 for(const k in J3.slips){ const sl=J3.slips[k], e=sl.ring?sl.b[0]:sl.b[3], lane=e[1]<J3.cy?J3.top+0.5:J3.bot-0.5; let bad=0,n=0;
   for(let f=0.03;f<=0.3;f+=0.03){ const x=e[0]+(J3.cx-e[0])*f; for(let y=Math.min(e[1],lane);y<=Math.max(e[1],lane);y+=0.1){ n++; if(!tar(x,y)) bad++; } } out.contact[k]={n,bad}; }
 { let bad=0,n=0; for(let y=J3.ruralEnd+6;(y-(J3.cy+J3.rs*(J3.RO-0.5)))*J3.rs>0;y-=0.1*J3.rs) for(const dx of [-0.7,0,0.7]){ n++; if(!tar(J3.rx+dx,y)) bad++; } out.contact.rural={n,bad}; }
 out.lights=J3.J.lights; out.masts=w.overhead.filter(o=>o.kind==='mast'&&o.J===J3.J).length;
 const R=(a,b)=>{ const S=navSnap(a[0],a[1],4),Gg=navSnap(b[0],b[1],4); const p=navAStar(S[0],S[1],Gg[0],Gg[1]); if(!p) return {ok:false};
   let snap=0; for(let k=1;k<p.length;k++){ const A=p[k-1],B=p[k],x=A%MW; const ma=w.roadH[A]===58,mb=w.roadH[B]===58,la=J3.lo[A],lb=J3.lo[B];
     if(((ma&&lb)||(la&&mb))&&x>=872&&x<=930){ const vert=Math.abs(B-A)===MW; if(!(vert&&(J3.vmap.has(A)||J3.vmap.has(B)))) snap++; } }
   return {ok:true,len:p.length,ring:p.some(i=>Math.hypot(i%MW+.5-901,((i/MW)|0)+.5-100)<11.5&&J3.lo[i]===1),snap}; };
 out.nav={through:R([800,98],[1000,98]),throughW:R([1000,101],[800,101]),mwToRural:R([800,98],[901,130]),wToRural:R([1000,102],[901,130]),ruralToE:R([901,130],[1000,98]),ruralToW:R([901,130],[800,102])};
 const oh=window.trafficHitTruck; window.trafficHitTruck=()=>false;
 traffic.vs.length=0; t.x=870*M_T; t.y=124*M_T; t.v=0; t.trl=null; t.foLay=0;
 const inA=(v)=>{const X=v.x/M_T,Y=v.y/M_T; return X>800&&X<1000&&Y>84&&Y<138;};
 const res={coll:0,collList:[],gwViol:0,gwList:[],moves:{},merges:0,mergeViol:0,maxStop:0,stuckIds:[],under:0,layerBad:0,lb:[],upperSeen:0,lowerSeen:0,spawned:0};
 const pairs=new Set(), stopAcc=new Map(), mergeWatch=[]; const dt=1/30, N=SIM*60/dt; let sp=0;
 const s58=w.segs[58], s145=w.segs[145];
 for(let k=0;k<N;k++){ timeS+=dt;
   if(k%75===0){ const ops=[[s58,{seg:58,along:790.5,dir:1,lane:sp%3}],[s58,{seg:58,along:1012.5,dir:-1,lane:(sp>>1)%3}],[s145,{seg:145,along:150.5,dir:-1,lane:0}]];
     const [sg,o]=ops[sp%3]; sp++; const p=lanePt(sg,o.dir,o.lane,o.along); const v=spawnVehicle(p[0],p[1],true,o); if(v&&v.id!==undefined){ v.pinT=timeS+400; res.spawned++; } }
   for(const v of traffic.vs) if(inA(v)) v.pinT=timeS+60;
   updateTraffic(dt);
   const vs=traffic.vs.filter(inA);
   for(const v of vs){
     for(const m of v.mk){ const f=v.s+v.L/2;
       if(m.kind==='rb'&&m.rb===J3.rb&&!m._x&&f>=m.d){ m._x=1; res.moves[m.key]=(res.moves[m.key]||0)+1;
         for(const o of traffic.vs){ if(o===v||o.ring!==J3.rb||o.v<2) continue; const a=Math.atan2(o.y-J3.cy*M_T,o.x-J3.cx*M_T), df=mod2pi(m.ang-a); if(df>0.02&&df<0.3){ res.gwViol++; if(res.gwList.length<6) res.gwList.push([v.id,o.id,+df.toFixed(2),+o.v.toFixed(1)]); } } }
       if(m.kind==='jm'&&!m._x&&f>=m.d){ m._x=1; res.merges++; mergeWatch.push([v,timeS+2]); } }
     if(v.layer) res.upperSeen++; else res.lowerSeen++;
     { const X=v.x/M_T,Y=v.y/M_T, ud=X>J3.X0&&X<J3.X1&&Y>97&&Y<103, onRing=v.ring===J3.rb||v.mk.some(m=>m.kind==='ring'&&v.s>m.d0&&v.s<m.d1), horiz=Math.abs(Math.cos(v.h))<0.2;
       if(ud&&!onRing&&horiz&&!v.layer){ res.layerBad++; if(res.lb.length<6) res.lb.push(['lo',v.id,+X.toFixed(1),+Y.toFixed(1),v.mk.map(m=>m.kind).join(','),v.cr?1:0]); } if(onRing&&v.layer){ res.layerBad++; if(res.lb.length<6) res.lb.push(['hi',v.id,+X.toFixed(1),+Y.toFixed(1)]); } }
     const st=v.v<0.2&&!v.parked?(stopAcc.get(v)||0)+dt:0; stopAcc.set(v,st); if(st>res.maxStop) res.maxStop=st; if(st>MAXS&&!res.stuckIds.some(s=>s[0]===v.id)&&res.stuckIds.length<6) res.stuckIds.push([v.id,+(v.x/M_T).toFixed(1),+(v.y/M_T).toFixed(1)]); }
   for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const a=vs[i],b=vs[j]; if(a.parked||b.parked||Math.abs(a.x-b.x)>25||Math.abs(a.y-b.y)>25) continue;
     let hit=false; for(const p of boxesOf(a)) for(const q of boxesOf(b)) if(obbMTV(p,q)) hit=true; if(!hit) continue; const key=a.id+'-'+b.id; if(pairs.has(key)) continue; pairs.add(key);
     if(foApart(a.layer,a.x,a.y,b.layer,b.x,b.y)) res.under++; else { res.coll++; if(mergeWatch.find(([mv,tt])=>(mv===a||mv===b)&&timeS<tt)) res.mergeViol++; if(res.collList.length<8) res.collList.push([a.id,b.id,+(a.x/M_T).toFixed(1),+(a.y/M_T).toFixed(1),+(b.x/M_T).toFixed(1),+(b.y/M_T).toFixed(1),a.kind,b.kind,+a.v.toFixed(1),+b.v.toFixed(1),a.mk.map(m=>m.kind).join(','),b.mk.map(m=>m.kind).join(',')]); } }
   if(k%900===0) await new Promise(r=>setTimeout(r,0)); }
 out.ai=res;
 traffic.vs.length=0; t.x=870*M_T; t.y=97.5*M_T; t.h=Math.PI/2; t.v=0; foPlayerLayer(t); t.x=900*M_T; foPlayerLayer(t); const upper=t.foLay;
 t.x=901*M_T; t.y=112*M_T; foPlayerLayer(t); t.x=891*M_T; t.y=100*M_T; foPlayerLayer(t); const lower=t.foLay;
 out.player={deck:upper,underDeck:lower};
 window.trafficHitTruck=oh; return out; })"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
    r=await pg.evaluate(JS,[SIM_MIN,MAX_STOP]); print(json.dumps(r,indent=1)); await b.close()
    if 'fatal' in r: print('FAIL',r['fatal']); sys.exit(1)
    a=r['ai']; nv=r['nav']; fails=[]
    if not all(r['connected'].values()): fails.append('lower road not continuous: %s'%r['connected'])
    for k,c in r['contact'].items():
      if c['bad']: fails.append('gap at %s join: %d/%d samples off tarmac'%(k,c['bad'],c['n']))
    if r['mwBroken']: fails.append('motorway tiles broken under the deck')
    if r['fuelOnRing']: fails.append('services still on the ring')
    if r['lights'] or r['masts']: fails.append('traffic lights still at J103')
    if nv['through']['ring'] or nv['throughW']['ring']: fails.append('sat nav: motorway through uses the ring')
    for k in ['mwToRural','wToRural','ruralToE','ruralToW']:
      if not nv[k]['ok'] or not nv[k]['ring']: fails.append('sat nav %s does not go via the ring'%k)
    if any(nv[k].get('snap',0) for k in nv): fails.append('sat nav snaps between deck and ring')
    if a['coll']: fails.append('%d same-level collisions'%a['coll'])
    if a['gwViol']: fails.append('%d give-way violations'%a['gwViol'])
    if a['stuckIds']: fails.append('stuck > %ds: %s'%(MAX_STOP,a['stuckIds']))
    for k in ['j103:ebOff','j103:wbOff','j103:rural']:
      if a['moves'].get(k,0)<3: fails.append('too few %s movements (%d)'%(k,a['moves'].get(k,0)))
    if a['merges']<3: fails.append('too few on-slip merges')
    if a['layerBad']: fails.append('%d vehicle-frames on the wrong level'%a['layerBad'])
    if a['mergeViol']: fails.append('%d merge collisions'%a['mergeViol'])
    if r['player']['deck']!=1 or r['player']['underDeck']!=0: fails.append('player layer wrong %s'%r['player'])
    if errs: fails.append('page errors %s'%errs[:3])
    print('FAIL' if fails else 'PASS', fails); sys.exit(1 if fails else 0)
asyncio.run(main())
