"""East grade-separated junction (J3_SITES "East", James 25 Oct): the former water-edge roundabout at (1945,720) rebuilt with the
J103 blueprint on a N-S main road (segs 59 + 60 on a bridge deck) over a give-way ring, 4 slips + the west dual-carriageway arm (seg 69).
All checks run in the blueprint's LOCAL frame (j3W / j3L), so this file also works for any other site: pass its name.
 1. map: lower road continuous (every slip end + arm), main road continuous under the deck, old roundabout retired,
    no ring / slip / deck / verge tile in the sea (land fill), no traffic lights / signal heads
 2. contact: continuous tarmac at every slip <-> main road join and at the arm <-> ring join
 3. sat nav: straight through never touches the ring; main <-> arm routes go via slips + ring; no deck/ring snap
 4. AI sim: same-level collisions 0, give-way violations 0, nobody stuck, every movement used, merges collision-free,
    nobody on the wrong level
 5. player layer: deck = upper, ring under the deck = lower
Usage: python3 tests/j3east_test.py [index.html] [site name]"""
import asyncio,json,sys,os
from playwright.async_api import async_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','index.html')
SITE=sys.argv[2] if len(sys.argv)>2 else 'East'
SIM_MIN=8; MAX_STOP=45
JS=r"""(async ([SIM,MAXS,NAME])=>{ const w=__bigrig.world, out={};
 const C=(w.j3s||[]).find(c=>c.site.name===NAME); if(!C||!C.on) return {fatal:'site '+NAME+' not built'};
 const use=()=>{ J3=C; }; use();
 const W=(x,y)=>{use(); return j3W([x,y]);}, Lc=(x,y)=>{use(); return j3L([x,y]);};
 const WT=(x,y)=>{const p=W(x,y); return [Math.floor(p[0]),Math.floor(p[1])];};
 const isMw=(i)=>{use(); return j3isMw(i);};
 const lo=(X,Y)=>{ if(!inb(X,Y)) return false; const i=idx(X,Y); return (C.lo[i]===1&&isRoadT(i))||C.vmap.has(i); };
 // 1. continuity (world tiles, 4-connected)
 const st=WT(C.rx,C.cy+C.rs*30), seen=new Set([st[0]*4096+st[1]]), q=[st];
 while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=x+dx,Y=y+dy,k=X*4096+Y; if(seen.has(k)||!lo(X,Y)) continue; seen.add(k); q.push([X,Y]); } }
 out.connected={}; for(const k in C.slips){ const sl=C.slips[k], e=sl.ring?sl.b[0]:sl.b[3], [x,y]=WT(e[0]+(sl.ring?2:-2)*(e[0]<C.cx?-1:1)*-1,e[1]); let ok=false; for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) if(seen.has((x+dx)*4096+y+dy)) ok=true; out.connected[k]=ok; }
 out.underDeckRing=C.vr.length; let mwBroken=0; for(let x=C.cx-40;x<C.cx+40;x++) for(let y=C.top+0.5;y<C.bot;y++){ const [X,Y]=WT(x+0.5,y); if(!isMw(idx(X,Y))) mwBroken++; } out.mwBroken=mwBroken;
 // land: no lower / main / deck / 1-tile verge tile in the sea
 let wet=0, wetList=[]; const A=C.artW; for(let y=Math.floor(A[2]);y<=A[3];y++) for(let x=Math.floor(A[0]);x<=A[1];x++){ if(!inb(x,y)) continue; let need=false;
   for(let dy=-1;dy<=1&&!need;dy++) for(let dx=-1;dx<=1&&!need;dx++){ if(!inb(x+dx,y+dy)) continue; const i=idx(x+dx,y+dy); const p=Lc(x+dx+.5,y+dy+.5); if(C.lo[i]===1||(isMw(i)&&p[0]>C.cx-80&&p[0]<C.cx+80)){ use(); need=true; } }
   if(need&&G[idx(x,y)]===T.WATER){ wet++; if(wetList.length<6) wetList.push([x,y]); } }
 out.wet=wet; out.wetList=wetList; out.filled=(C.fill||[]).length;
 out.oldRb=C.rbOld!=null?{dead:!!w.rbs[C.rbOld].dead,obj:w.objects.filter(o=>o.kind==='rb'&&Math.hypot(o.x/TILE-C.cx,o.y/TILE-C.cy)<14).length}:null;
 out.signals=typeof RBSIG!=='undefined'&&RBSIG.on?1:0; out.masts=C.J?w.overhead.filter(o=>o.kind==='mast'&&o.J===C.J).length:0;
 // 2. contact
 out.contact={}; const tar=(x,y)=>{ const p=W(x,y); use(); return onTarmacT(p[0],p[1])&&(isMw(idx(Math.floor(p[0]),Math.floor(p[1])))||(use(),j3onLower(x,y))); };
 for(const k in C.slips){ const sl=C.slips[k], e=sl.ring?sl.b[0]:sl.b[3], lane=e[1]<C.cy?C.top+0.5:C.bot-0.5; let bad=0,n=0;
   for(let f=0.03;f<=0.3;f+=0.03){ const x=e[0]+(C.cx-e[0])*f; for(let y=Math.min(e[1],lane);y<=Math.max(e[1],lane);y+=0.1){ n++; if(!tar(x,y)) bad++; } } out.contact[k]={n,bad}; }
 { let bad=0,n=0; const hw=Math.max(0.7,C.rW/2-0.6); for(let y=C.ruralEnd+6*C.rs;(y-(C.cy+C.rs*(C.RO-0.5)))*C.rs>0;y-=0.1*C.rs) for(const dx of [-hw,0,hw]){ n++; if(!tar(C.rx+dx,y)) bad++; } out.contact.arm={n,bad}; }
 // 3. sat nav
 const R=(a,b)=>{ const pa=W(a[0],a[1]),pb=W(b[0],b[1]); const S=navSnap(pa[0],pa[1],4),Gg=navSnap(pb[0],pb[1],4); const p=navAStar(S[0],S[1],Gg[0],Gg[1]); if(!p) return {ok:false};
   let snap=0; for(let k=1;k<p.length;k++){ const A2=p[k-1],B=p[k]; const ma=isMw(A2),mb=isMw(B),la=C.lo[A2],lb=C.lo[B]; const l=Lc(A2%MW+.5,((A2/MW)|0)+.5);
     if(((ma&&lb)||(la&&mb))&&l[0]>=C.cx-29&&l[0]<=C.cx+29){ const cross=C.mainV?Math.abs(B-A2)===1:Math.abs(B-A2)===MW; if(!(cross&&(C.vmap.has(A2)||C.vmap.has(B)))) snap++; } }
   const Cw=W(C.cx,C.cy); return {ok:true,len:p.length,ring:p.some(i=>Math.hypot(i%MW+.5-Cw[0],((i/MW)|0)+.5-Cw[1])<11.5&&C.lo[i]===1),snap}; };
 const eb=[C.cx-100,C.top+1.5], wb=[C.cx+100,C.bot-1.5], arm=[C.rx,C.cy+C.rs*30];
 out.nav={through:R(eb,[C.cx+100,C.top+1.5]),throughW:R(wb,[C.cx-100,C.bot-1.5]),mwToArm:R(eb,arm),wToArm:R(wb,arm),armToE:R(arm,[C.cx+100,C.top+1.5]),armToW:R(arm,[C.cx-100,C.bot-1.5])};
 // 4. AI
 const oh=window.trafficHitTruck; window.trafficHitTruck=()=>false; const t=truck;
 traffic.vs.length=0; { const p=W(C.cx-60,C.cy-C.rs*40); t.x=p[0]*M_T; t.y=p[1]*M_T; } t.v=0; t.trl=null; t.foLay=0;
 const inA=(v)=>{const p=Lc(v.x/M_T,v.y/M_T); return p[0]>C.cx-100&&p[0]<C.cx+100&&Math.abs(p[1]-C.cy)<60;};
 const res={coll:0,collList:[],gwViol:0,gwList:[],moves:{},merges:0,mergeViol:0,maxStop:0,stuckIds:[],under:0,layerBad:0,lb:[],upperSeen:0,lowerSeen:0,spawned:0};
 const pairs=new Set(), stopAcc=new Map(), mergeWatch=[]; const dt=1/30, N=SIM*60/dt; let sp=0;
 use(); const ru=w.segs[C.ruralId];
 const mk=(xL,dL,lane)=>{ use(); const sg=j3mwAt(xL); return [sg,{seg:sg.id,along:j3aWof(sg,'m',xL)+0.5,dir:j3dW(sg,'m',dL),lane}]; };
 const mkA=()=>{ use(); return [ru,{seg:ru.id,along:j3aWof(ru,'r',C.cy+C.rs*50)+0.5,dir:j3dW(ru,'r',-C.rs),lane:0}]; };
 for(let k=0;k<N;k++){ timeS+=dt;
   if(k%75===0){ const ops=[mk(C.cx-125,1,sp%3),mk(C.cx+125,-1,(sp>>1)%3),mkA()];
     const [sg,o]=ops[sp%3]; sp++; const p=lanePt(sg,o.dir,o.lane,o.along); const v=spawnVehicle(p[0],p[1],true,o); if(v&&v.id!==undefined){ v.pinT=timeS+400; res.spawned++; } }
   for(const v of traffic.vs) if(inA(v)) v.pinT=timeS+60;
   updateTraffic(dt);
   const vs=traffic.vs.filter(inA);
   for(const v of vs){
     for(const m of v.mk){ const f=v.s+v.L/2;
       if(m.kind==='rb'&&m.rb===C.rb&&!m._x&&f>=m.d){ m._x=1; res.moves[m.key]=(res.moves[m.key]||0)+1;
         for(const o of traffic.vs){ if(o===v||o.ring!==C.rb||o.v<2) continue; const a=Math.atan2(o.y-C.rb.cy*M_T,o.x-C.rb.cx*M_T), df=mod2pi(m.ang-a); if(df>0.02&&df<0.3){ res.gwViol++; if(res.gwList.length<6) res.gwList.push([v.id,o.id,+df.toFixed(2),+o.v.toFixed(1)]); } } }
       if(m.kind==='jm'&&!m._x&&f>=m.d){ m._x=1; res.merges++; mergeWatch.push([v,timeS+2]); } }
     if(v.layer) res.upperSeen++; else res.lowerSeen++;
     { const p=Lc(v.x/M_T,v.y/M_T),X=p[0],Y=p[1], ud=X>C.X0&&X<C.X1&&Y>C.top&&Y<C.bot, onRing=v.ring===C.rb||v.mk.some(m=>m.kind==='ring'&&v.s>m.d0&&v.s<m.d1), hL=v.h+(C.rot?Math.PI/2:0), horiz=Math.abs(Math.cos(hL))<0.2;
       if(ud&&!onRing&&horiz&&!v.layer){ res.layerBad++; if(res.lb.length<6) res.lb.push(['lo',v.id,+X.toFixed(1),+Y.toFixed(1),v.mk.map(m=>m.kind).join(',')]); } if(onRing&&v.layer){ res.layerBad++; if(res.lb.length<6) res.lb.push(['hi',v.id,+X.toFixed(1),+Y.toFixed(1)]); } }
     const s=v.v<0.2&&!v.parked?(stopAcc.get(v)||0)+dt:0; stopAcc.set(v,s); if(s>res.maxStop) res.maxStop=s; if(s>MAXS&&!res.stuckIds.some(q=>q[0]===v.id)&&res.stuckIds.length<6) res.stuckIds.push([v.id,+(v.x/M_T).toFixed(1),+(v.y/M_T).toFixed(1)]); }
   for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const a=vs[i],b=vs[j]; if(a.parked||b.parked||Math.abs(a.x-b.x)>25||Math.abs(a.y-b.y)>25) continue;
     let hit=false; for(const p of boxesOf(a)) for(const q of boxesOf(b)) if(obbMTV(p,q)) hit=true; if(!hit) continue; const key=a.id+'-'+b.id; if(pairs.has(key)) continue; pairs.add(key);
     if(foApart(a.layer,a.x,a.y,b.layer,b.x,b.y)) res.under++; else { res.coll++; if(mergeWatch.find(([mv,tt])=>(mv===a||mv===b)&&timeS<tt)) res.mergeViol++; if(res.collList.length<8) res.collList.push([a.id,b.id,+(a.x/M_T).toFixed(1),+(a.y/M_T).toFixed(1),a.kind,b.kind,+a.v.toFixed(1),+b.v.toFixed(1),a.mk.map(m=>m.kind).join(','),b.mk.map(m=>m.kind).join(',')]); } }
   if(k%900===0) await new Promise(r=>setTimeout(r,0)); }
 out.ai=res;
 // 5. player layer
 traffic.vs.length=0; const put=(x,y)=>{ const p=W(x,y); t.x=p[0]*M_T; t.y=p[1]*M_T; foPlayerLayer(t); };
 t.v=0; put(C.cx-30,C.top+1.5); put(C.cx-1,C.top+1.5); const upper=t.foLay;
 put(C.rx,C.cy+C.rs*12); put(C.cx-10,C.cy); const lower=t.foLay;
 out.player={deck:upper,underDeck:lower};
 window.trafficHitTruck=oh; return out; })"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
    await pg.goto('file://'+os.path.abspath(HTML)); await pg.wait_for_function('window.__bigrig&&__bigrig.world&&__bigrig.world.ready',timeout=300000)
    r=await pg.evaluate(JS,[SIM_MIN,MAX_STOP,SITE]); print(json.dumps(r,indent=1)); await b.close()
    if 'fatal' in r: print('FAIL',r['fatal']); sys.exit(1)
    a=r['ai']; nv=r['nav']; fails=[]
    if not all(r['connected'].values()): fails.append('lower road not continuous: %s'%r['connected'])
    for k,c in r['contact'].items():
      if c['bad']: fails.append('gap at %s join: %d/%d samples off tarmac'%(k,c['bad'],c['n']))
    if r['mwBroken']: fails.append('main road broken under the deck (%d)'%r['mwBroken'])
    if r['wet']: fails.append('%d junction tiles in the sea %s'%(r['wet'],r['wetList']))
    if r['oldRb'] and (not r['oldRb']['dead'] or r['oldRb']['obj']): fails.append('old roundabout still live %s'%r['oldRb'])
    if r['signals'] or r['masts']: fails.append('traffic lights still on')
    if nv['through']['ring'] or nv['throughW']['ring']: fails.append('sat nav: through route uses the ring')
    for k in ['mwToArm','wToArm','armToE','armToW']:
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
