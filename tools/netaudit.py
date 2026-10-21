#!/usr/bin/env python3
"""Full road-network audit (programmatic): python3 build.py && python3 tools/netaudit.py OUTDIR [tag]
Enumerates every junction box, roundabout, curve/bend and straight segment from the loaded world and flags:
  lights-on-plain-corner  signalised box with <=2 road arms and no entrance/driveway
  square-corner           unsignalised 2-arm L box (should be a smooth bend)
  through-box             2-arm box whose arms are opposite (junction box on a straight road)
  missing-lights          3+ arm junction on city/town/hwy/dual roads with no signals (not base)
  short-arm               signalised junction with an arm <=6 tiles long (stub)
  seg-gap                 tiles inside a segment's carriageway that aren't road/bridge
  overlap                 road tiles claimed by both an h and a v segment outside any junction / flyover
  orphan-road             small clusters of ROAD tiles not owned by any segment/curve/roundabout/corner
  parallel-dup            two same-direction segments whose carriageways are <=10 tiles apart for >=30 tiles
  grass-mismatch          kerb fillet grass colour differs from the surrounding grass in the baked chunk
Writes OUTDIR/<tag>.json and a PNG crop per flagged spot (OUTDIR/<tag>/<kind>_<x>_<y>.png).
AT="x,y;x,y" renders only those crops."""
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/roadaudit"
TAG = sys.argv[2] if len(sys.argv) > 2 else "before"
ONLY = os.environ.get("AT")
AUDIT = r"""(()=>{ const W=world,S=W.segs,F=[]; const add=(k,x,y,o)=>F.push(Object.assign({k,x:Math.round(x),y:Math.round(y)},o||{}));
 const isR=(x,y)=>{const t=get(x,y);return t===T.ROAD||t===T.BRIDGE;};
 const DRV=new Set([T.CONC,T.LOT,T.QUAY,T.GRAVEL,T.PUMP]);
 const arms=(j)=>{ const top=[],bot=[],lef=[],rig=[];
   for(let x=j.x;x<j.x+j.w;x++){top.push([x,j.y-2]);bot.push([x,j.y+j.h+1]);}
   for(let y=j.y;y<j.y+j.h;y++){lef.push([j.x-2,y]);rig.push([j.x+j.w+1,y]);}
   const side=(p)=>p.filter(([x,y])=>isR(x,y)).length>=Math.max(1,Math.floor(p.length/2));
   const ent=(pts,k)=>{let c=0;for(const [x0,y0] of pts) for(const dd of [0,1]){const x=k==='W'?x0+1-dd:k==='E'?x0-1+dd:x0,y=k==='N'?y0+1-dd:k==='S'?y0-1+dd:y0; if(DRV.has(get(x,y))){c++;break;}} return c>=Math.max(2,Math.floor(pts.length/2));};
   const near=(k)=>{const L=k==='N'||k==='S';let c=0;for(let t=0;t<6;t++)for(const sd of [-1,1]){const u=k==='N'?j.y-1-t:k==='S'?j.y+j.h+t:k==='W'?j.x-1-t:j.x+j.w+t;let v=sd<0?(L?j.x:j.y):(L?j.x+j.w-1:j.y+j.h-1);let g=0;while((L?isR(v,u):isR(u,v))&&g++<40)v+=sd;if(DRV.has(L?get(v,u):get(u,v)))c++;}return c>=2;};
   const r=[],e=[]; for(const [k,p] of [['N',top],['S',bot],['W',lef],['E',rig]]){ if(side(p)) r.push(k); else if(ent(p,k)) e.push(k); }
   if(r.length===2&&!e.length&&r.some(k=>near(k))) e.push('d'); return {r,e}; };
 const LT=t=>t==='city'||t==='town'||t==='hwy'||t==='dual';
 const J=[]; for(const j of W.junctions){ const a=arms(j),hs=S[j.hs],vs=S[j.vs],cx=j.x+j.w/2,cy=j.y+j.h/2, n=a.r.length+a.e.length;
   const opp=a.r.length===2&&((a.r.includes('N')&&a.r.includes('S'))||(a.r.includes('W')&&a.r.includes('E')));
   const mil=!!(hs.mil||vs.mil); const cls=n<=1?'stub':n===2?(a.e.length?'entrance':opp?'through':'bend'):n===3?'T':'cross';
   J.push({id:j.id,x:j.x,y:j.y,w:j.w,h:j.h,cls,arms:a.r.join('')+a.e.join('').toLowerCase(),L:!!j.lights,ht:hs.type,vt:vs.type,mil});
   if(j.lights&&(cls==='bend'||cls==='through'||cls==='stub')) add('lights-on-plain-corner',cx,cy,{j:j.id,jx:j.x,jy:j.y,cls,arms:a.r.join(''),ht:hs.type,vt:vs.type});
   else if(!j.lights&&cls==='bend'&&!mil) add('square-corner',cx,cy,{j:j.id,jx:j.x,jy:j.y,arms:a.r.join(''),ht:hs.type,vt:vs.type});
   else if(!j.lights&&cls==='through') add('through-box',cx,cy,{j:j.id,jx:j.x,jy:j.y,arms:a.r.join(''),ht:hs.type,vt:vs.type});
   { const L=[['W',j.x-hs.b0,hs,0],['E',hs.b1-(j.x+j.w-1),hs,1],['N',j.y-vs.b0,vs,0],['S',vs.b1-(j.y+j.h-1),vs,1]]; for(const [k,len,sg,e] of L){ if(len>0&&len<=6&&j.lights){ const cont=sg['cv'+e]!=null||sg['rb'+e]!=null||sg['link'+e]!=null; add('short-arm',cx,cy,{j:j.id,jx:j.x,jy:j.y,arm:k,len,cont,ht:hs.type,vt:vs.type}); } } }
   if(!j.lights&&(cls==='T'||cls==='cross')&&!mil&&LT(hs.type)&&LT(vs.type)) add('missing-lights',cx,cy,{j:j.id,jx:j.x,jy:j.y,cls,ht:hs.type,vt:vs.type}); }
 for(const s of S){ if(s.dead) continue; let n=0,f=null; for(let b=s.b0;b<=s.b1;b++) for(let k=0;k<s.w;k++){const x=s.dir==='h'?b:s.a+k,y=s.dir==='h'?s.a+k:b; if(!inb(x,y))continue; if(!isR(x,y)&&!(W.cornerAt[idx(x,y)]>=0)&&!(W.rbMask&&W.rbMask[idx(x,y)])){n++;f=f||[x,y];}} if(n) add('seg-gap',f[0],f[1],{seg:s.id,n,type:s.type}); }
 { const N=MW*MH; let cl=[]; const fo=W.foF; for(let i=0;i<N;i++){ const h=W.roadH[i],v=W.roadV[i]; if(h>=0&&v>=0&&!W.jMask[i]&&!(fo&&fo[i])&&!S[h].mil){ const x=i%MW,y=(i/MW)|0; if(!cl.some(c=>Math.abs(c[0]-x)<12&&Math.abs(c[1]-y)<12)){cl.push([x,y]); add('overlap',x,y,{h,v,ht:S[h].type,vt:S[v].type});} } } }
 { const N=MW*MH,seen=new Uint8Array(N); const own=(i)=>W.roadH[i]!==-1||W.roadV[i]!==-1||W.cornerAt[i]>=0||(W.cvOwn&&W.cvOwn[i]>0)||(W.rbMask&&W.rbMask[i]);
   for(let i=0;i<N;i++){ if(seen[i]||G[i]!==T.ROAD||own(i)) continue; const st=[i],cs=[];seen[i]=1; while(st.length&&cs.length<400){const j=st.pop();cs.push(j);const x=j%MW,y=(j/MW)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(!inb(X,Y))continue;const k=idx(X,Y);if(!seen[k]&&G[k]===T.ROAD&&!own(k)){seen[k]=1;st.push(k);}}}
     if(cs.length>=3&&cs.length<400) add('orphan-road',cs[0]%MW,(cs[0]/MW)|0,{n:cs.length}); } }
 { const L=S.filter(s=>!s.dead&&!s.mil&&s.type!=='dirt'); const by={h:[],v:[]}; for(const s of L) by[s.dir].push(s);
   for(const d of ['h','v']){ const A=by[d].sort((p,q)=>p.a-q.a); for(let i=0;i<A.length;i++) for(let k=i+1;k<A.length;k++){ const p=A[i],q=A[k]; const gap=q.a-(p.a+p.w); if(gap>10) break; if(gap<0) continue; const o0=Math.max(p.b0,q.b0),o1=Math.min(p.b1,q.b1); if(o1-o0<30) continue;
     const m=(o0+o1)/2; add('parallel-dup',d==='h'?m:(p.a+q.a+q.w)/2,d==='h'?(p.a+q.a+q.w)/2:m,{a:p.id,b:q.id,at:p.type,bt:q.type,gap,len:o1-o0,dir:d,an:p.name||null,bn:q.name||null}); } } }
 window.__NA={F,J}; const n={}; for(const f of F) n[f.k]=(n[f.k]||0)+1; const jc={}; for(const j of J) jc[j.cls+(j.L?'+L':'')]=(jc[j.cls+(j.L?'+L':'')]||0)+1;
 return {counts:n,jclass:jc,nJ:W.junctions.length,nSeg:S.length,nCv:W.curves.length,nRb:W.rbs.length,nCorner:W.corners.length,F,J}; })()"""
GRASS = r"""()=>{ const out=[]; const C=CHUNK; const px=(x,y)=>{ const cx=Math.floor(x/C),cy=Math.floor(y/C),c=getChunk(cx,cy,true); return c.getContext('2d').getImageData(Math.floor(x-cx*C),Math.floor(y-cy*C),1,1).data; };
 const avg=(pts)=>{let r=0,g=0,b=0;for(const p of pts){const d=px(p[0],p[1]);r+=d[0];g+=d[1];b+=d[2];}const n=pts.length;return [r/n,g/n,b/n];};
 const GT=new Set([T.GRASS,T.PGRASS]);
 for(const c of world.corners){ if(c.R<4) continue; const X=c.cx*TILE,Y=c.cy*TILE;
   // land block lies on the side of the circle centre away from the junction box corner (px,py)
   const ux=Math.sign(c.cx-c.px),uy=Math.sign(c.cy-c.py); const gt=get(Math.floor(c.cx+ux*0.5),Math.floor(c.cy+uy*0.5)); if(!GT.has(gt)) continue;
   const Rr=(c.R-1)*TILE; const inn=[]; const a0=Math.atan2(c.py-c.cy,c.px-c.cx); for(let k=-2;k<=2;k++){const a=a0+k*0.2; inn.push([X+Math.cos(a)*Rr*0.55,Y+Math.sin(a)*Rr*0.55]);}
   const oth=[]; for(const [ox,oy] of [[ux*2,uy*2],[ux*3,0],[0,uy*3],[ux*3,uy*1],[ux*1,uy*3]]){ const tx=Math.floor(c.cx+ox),ty=Math.floor(c.cy+oy); if(GT.has(get(tx,ty))) oth.push([(tx+0.5)*TILE,(ty+0.5)*TILE]); }
   if(oth.length<2) continue; const a=avg(inn),b=avg(oth),d=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]); out.push({x:Math.round(c.cx),y:Math.round(c.cy),d:+d.toFixed(1),gt,a:a.map(Math.round),b:b.map(Math.round)}); }
 return out; }"""
CROP = r"""([x,y,r,s,lab])=>{ const C=CHUNK, x0=(x-r)*TILE,y0=(y-r)*TILE,sz=2*r*TILE, cv=document.createElement('canvas'); cv.width=cv.height=s; const g=cv.getContext('2d'); const k=s/sz;
 for(let cy=Math.floor(y0/C);cy<=Math.floor((y0+sz)/C);cy++) for(let cx=Math.floor(x0/C);cx<=Math.floor((x0+sz)/C);cx++){ if(cx<0||cy<0||cx*C>=MW*TILE||cy*C>=MH*TILE) continue; const ch=getChunk(cx,cy,true); if(ch) g.drawImage(ch,(cx*C-x0)*k,(cy*C-y0)*k,C*k,C*k); }
 g.strokeStyle='#ff2d55'; g.lineWidth=3; g.beginPath(); g.arc(s/2,s/2,s*0.12,0,7); g.stroke();
 g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(0,0,s,22); g.fillStyle='#fff'; g.font='bold 13px sans-serif'; g.fillText(lab,6,15); return cv.toDataURL('image/png'); }"""
async def main():
    os.makedirs(os.path.join(OUT, TAG), exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 900, "height": 700})
        await pg.goto("file://" + os.path.join(ROOT, "BigRig.html"))
        await pg.wait_for_function("window.__bigrig&&__bigrig.world.ready", timeout=300000)
        await pg.wait_for_timeout(1500)
        r = await pg.evaluate(AUDIT)
        gr = [] if os.environ.get("NOGRASS") else await pg.evaluate(GRASS)
        r["grass"] = gr
        for q in gr:
            if q["d"] > 18: r["F"].append({"k": "grass-mismatch", "x": q["x"], "y": q["y"], "d": q["d"]})
        r["counts"]["grass-mismatch"] = sum(1 for q in gr if q["d"] > 18)
        spots = r["F"]
        if ONLY: spots = [{"k": "at", "x": int(a.split(",")[0]), "y": int(a.split(",")[1])} for a in ONLY.split(";")]
        n = 0
        if not os.environ.get("NOCROP"):
            for f in spots:
                fn = os.path.join(OUT, TAG, f"{f['k']}_{f['x']}_{f['y']}.png")
                rad = int(os.environ.get("RAD", 0)) or 8 if f["k"] == "grass-mismatch" else 22 if f["k"] == "parallel-dup" else 14
                u = await pg.evaluate(CROP, [f["x"], f["y"], rad, 420, f"{TAG}: {f['k']} @ {f['x']},{f['y']}"])
                open(fn, "wb").write(base64.b64decode(u.split(",")[1])); f["img"] = fn; n += 1
        json.dump(r, open(os.path.join(OUT, TAG + ".json"), "w"), indent=1)
        await b.close()
    print("NETAUDIT", TAG, json.dumps(r["counts"]), "junctions", json.dumps(r["jclass"]), "crops", n)
asyncio.run(main())
