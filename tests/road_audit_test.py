"""Road network audit (static, no soak): dead ends, curve gaps/kinks/bad joins, unreachable or disconnected road,
roads in water / out of bounds, rail crossing road without a level crossing or bridge, curve-over-road conflicts
(not flyovers), stair-step runs of tiny segments, unmarked roads, long stretches without fuel.
Usage: python3 tests/road_audit_test.py [BigRig.html] [out.json]   exit code 1 when unintended defects remain."""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BigRig.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else None
AUDIT = r"""(()=>{ const W=world,S=W.segs,D=[]; const add=(k,o)=>D.push(Object.assign({k},o));
 const tar=(x,y)=>onTarmacT(x+0.5,y+0.5);
 const anyRoad=(x,y)=>inb(x,y)&&(W.roadH[idx(x,y)]!==-1||W.roadV[idx(x,y)]!==-1);
 const site=(t)=>t===T.CONC||t===T.LOT||t===T.GRAVEL||t===T.QUAY||t===T.PLAZA;
 // 1 segment ends
 for(const s of S){ if(s.dead) continue; for(const e of [0,1]){
   const jr=(s.js||[]).map(j=>jRange(s,j)), conn=jr.some(q=>e?q[1]>=s.b1:q[0]<=s.b0+1)||s['cv'+e]!=null||s['rb'+e]!=null||s['link'+e]!=null;
   if(conn) continue; const b=e?s.b1+1:s.b0-1; let road=0,wat=0,oob=0,st=0;
   for(let k=0;k<s.w;k++){ const x=s.dir==='h'?b:s.a+k,y=s.dir==='h'?s.a+k:b; if(!inb(x,y)){oob++;continue;} if(anyRoad(x,y)||tar(x,y)) road++; const t=get(x,y); if(t===T.WATER) wat++; if(site(t)||W.reserved[idx(x,y)]) st++; }
   if(road>=s.w) continue; const at=s.dir==='h'?[b,s.a]:[s.a,b];
   const intended=st>=s.w||s.type==='dirt'||s.mil;   // site entrance / track to a destination / base road
   add(oob?'out-of-bounds':wat?'into-water':'dead-end',{seg:s.id,type:s.type,name:s.name||null,at,intended}); } }
 // 2 curves: gaps, kinks, joins, bounds, water
 for(const c of W.curves){ const P=c.pts; let gap=0,g0=null; for(let i=0;i<P.length;i++){ if(!onTarmacT(P[i][0],P[i][1])){ gap++; g0=g0||P[i]; } }
   if(gap) add('curve-gap',{curve:c.id,name:c.name||null,n:gap,at:g0.map(Math.round)});
   let kink=0,k0=null; for(let i=2;i<P.length;i++){ const a=Math.atan2(P[i-1][1]-P[i-2][1],P[i-1][0]-P[i-2][0]),b=Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0]); let d=Math.abs(b-a); if(d>Math.PI) d=2*Math.PI-d; if(d>0.35){kink++; k0=k0||P[i];} }
   if(kink) add('curve-kink',{curve:c.id,name:c.name||null,n:kink,at:k0.map(Math.round)});
   for(const [E,p] of [[c.A,P[0]],[c.B,P[P.length-1]]]){ if(!E){ add('curve-loose-end',{curve:c.id,name:c.name||null,at:p.map(Math.round)}); continue; }
     const sg=S[E.seg], cc=sg.a+sg.w/2, b=E.end?sg.b1+1:sg.b0, q=sg.dir==='h'?[b,cc]:[cc,b]; const d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(d>1.2) add('curve-bad-join',{curve:c.id,name:c.name||null,d:+d.toFixed(1),at:p.map(Math.round)}); }
   if(P.some(p=>!inb(Math.floor(p[0]),Math.floor(p[1])))) add('out-of-bounds',{curve:c.id,name:c.name||null}); }
 // 3 reachability: 8-connected flood over drivable tarmac from the start depot road; report unreached segs/curves + fragments
 const N=MW*MH, seen=new Uint8Array(N), q=new Int32Array(N); const ok=(x,y)=>inb(x,y)&&(anyRoad(x,y)||tar(x,y));
 let s0=null; for(const s of S) if(s.type==='hwy'){ s0=s; break; }
 { const x=s0.dir==='h'?((s0.b0+s0.b1)>>1):s0.a+1, y=s0.dir==='h'?s0.a+1:((s0.b0+s0.b1)>>1); let h=0,t=0; q[t++]=idx(x,y); seen[idx(x,y)]=1;
   while(h<t){ const j=q[h++],x=j%MW,y=(j/MW)|0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const X=x+dx,Y=y+dy; if(!ok(X,Y)) continue; const k=idx(X,Y); if(seen[k]) continue; if(dx&&dy&&!ok(x+dx,y)&&!ok(x,y+dy)) continue; seen[k]=1; q[t++]=k; } } }
 for(const s of S){ if(s.dead) continue; const m=(s.b0+s.b1)>>1, x=s.dir==='h'?m:s.a+(s.w>>1), y=s.dir==='h'?s.a+(s.w>>1):m; if(inb(x,y)&&!seen[idx(x,y)]&&ok(x,y)) add('unreachable',{seg:s.id,type:s.type,name:s.name||null,at:[x,y],mil:!!s.mil,intended:!!s.mil}); }
 for(const c of W.curves){ const p=c.pts[c.pts.length>>1], x=Math.floor(p[0]),y=Math.floor(p[1]); if(ok(x,y)&&!seen[idx(x,y)]) add('unreachable',{curve:c.id,name:c.name||null,at:[x,y]}); }
 // 4 road tiles on open water (not a bridge)
 { let n=0,a0=null; for(let i=0;i<N;i++) if((W.roadH[i]>=0||W.roadV[i]>=0||W.roadH[i]===-3)&&G[i]===T.WATER){ n++; a0=a0||[i%MW,(i/MW)|0]; } if(n) add('road-on-water',{n,at:a0}); }
 // 5 rail vs road: rail samples over tarmac far from any recorded level crossing / bridge
 if(RAIL.ready){ const cr=(RAIL.cross||[]).map(c=>[c.mx,c.my]); const br=(RAIL.bridges||[]); let last=-1e9;
   for(let s=0;s<RAIL.L;s+=2){ const x=RAIL.X[s],y=RAIL.Y[s],tx=Math.floor(x/M_T),ty=Math.floor(y/M_T); if(!anyRoad(tx,ty)) continue; if(cr.some(c=>Math.hypot(c[0]-x,c[1]-y)<40)) continue; if(s-last<60){ continue; } last=s; add('rail-crosses-road',{at:[tx,ty],s}); } }
 // 6 curve over a straight road away from its ends (crossing without a junction), excluding flyovers
 { const fo=new Set((W.flyovers||[]).map(f=>f.cv!=null?f.cv:(f.cvId!=null?f.cvId:-1))); const by={}; for(const r of W.cflog||[]){ const cv=W.curves.find(c=>(c.name||c.type)===r[0]); const isFo=cv&&cv.fo&&cv.fo.length; if(isFo) continue; by[r[0]]=(by[r[0]]||0)+1; } for(const k in by) add('crossing-no-junction',{name:k,n:by[k]}); }
 // 7 stair-steps: runs of >=3 tiny (<=6 tile) segments alternating h/v joined end to end
 { const tiny=S.filter(s=>!s.dead&&s.b1-s.b0<=5); const used=new Set(); for(const s of tiny){ if(used.has(s.id)) continue; let run=[s],cur=s; for(;;){ const nx=tiny.find(o=>!run.includes(o)&&o.dir!==cur.dir&&Math.abs((o.dir==='h'?o.a:o.b0)-(cur.dir==='h'?cur.b1:cur.a))<=cur.w+1&&Math.abs((o.dir==='h'?o.b0:o.a)-(cur.dir==='h'?cur.a:cur.b1))<=cur.w+1); if(!nx) break; run.push(nx); cur=nx; } if(run.length>=3){ run.forEach(o=>used.add(o.id)); add('stair-step',{segs:run.map(o=>o.id),at:[run[0].dir==='h'?run[0].b0:run[0].a,run[0].dir==='h'?run[0].a:run[0].b0]}); } } }
 // 8 unmarked roads: types render.js draws without a centre line (RD_NOCENTRE)
 const NC=(t)=>typeof RD_NOCENTRE!=='undefined'&&RD_NOCENTRE.has(t);
 for(const s of S) if(!s.dead&&NC(s.type)) add('unmarked',{seg:s.id,name:s.name||null,at:[s.dir==='h'?s.b0:s.a,s.dir==='h'?s.a:s.b0]});
 for(const c of W.curves) if(NC(c.type)) add('unmarked',{curve:c.id,name:c.name||null,at:c.pts[0].map(Math.round)});
 // 9 fuel coverage: road distance (8-conn BFS over tarmac, tiles) from every fuel station; report stretches > FUEL_GAP_KM
 { const dist=new Float32Array(N).fill(1e9), Q=[]; for(const f of W.fuel){ const fx=Math.floor(f.x/M_T),fy=Math.floor(f.y/M_T); let best=null,bd=1e9; for(let dy=-30;dy<=30;dy++) for(let dx=-30;dx<=30;dx++){ const x=fx+dx,y=fy+dy; if(ok(x,y)&&seen[idx(x,y)]){ const d=Math.hypot(dx,dy); if(d<bd){bd=d;best=idx(x,y);} } } if(best!=null){ dist[best]=0; Q.push(best); } }
   let h=0; while(h<Q.length){ const j=Q[h++],x=j%MW,y=(j/MW)|0,d0=dist[j]; for(const [dx,dy,c] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.41],[1,-1,1.41],[-1,1,1.41],[-1,-1,1.41]]){ const X=x+dx,Y=y+dy; if(!ok(X,Y)) continue; const k=idx(X,Y); if(dist[k]>d0+c+0.01&&!(dist[k]<1e9&&Math.abs(dist[k]-d0-c)<1)){ if(dist[k]>=1e9) Q.push(k); dist[k]=Math.min(dist[k],d0+c); } } }
   const LIM=window.FUEL_GAP_KM||3.2, lt=LIM*1000/M_T; const far=[]; for(let i=0;i<N;i+=1){ if(dist[i]<1e9&&dist[i]>lt&&seen[i]){ const x=i%MW,y=(i/MW)|0; if(!far.some(f=>Math.abs(f[0]-x)<120&&Math.abs(f[1]-y)<120)) far.push([x,y,Math.round(dist[i]*M_T/100)/10]); } }
   for(const f of far) add('fuel-gap',{at:[f[0],f[1]],km:f[2]}); window.__fuelDist=dist; }
 const n={}; for(const d of D) n[d.k+(d.intended?'(intended)':'')]=(n[d.k+(d.intended?'(intended)':'')]||0)+1;
 return {counts:n, defects:D, nSegs:S.length, nCurves:W.curves.length, nJ:W.junctions.length, nFuel:W.fuel.length}; })()"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 900, "height": 700})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        await pg.goto("file://" + os.path.abspath(HTML))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.evaluate("window.FUEL_GAP_KM=" + os.environ.get("FUEL_GAP_KM", "3.2"))
        r = await pg.evaluate(AUDIT)
        print("ROAD AUDIT", json.dumps({k: r[k] for k in ["nSegs", "nCurves", "nJ", "nFuel"]}))
        for k, v in sorted(r["counts"].items()):
            print(f"  {k}: {v}")
        for d in r["defects"]:
            if not d.get("intended"):
                print("   ", json.dumps(d))
        if OUT:
            json.dump(r, open(OUT, "w"), indent=1)
        print("ERRS", errs[:5])
        bad = [d for d in r["defects"] if not d.get("intended") and d["k"] not in ("unmarked",)]
        await b.close()
        sys.exit(1 if bad or errs else 0)

asyncio.run(main())
