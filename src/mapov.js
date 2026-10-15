// ---- map overview: the M map + minimap are drawn from the real game chunks (same renderer as the world / fly-mode LOD),
// downscaled to 2 px per tile into persistent sheets that are never evicted (no flicker). Built progressively near the
// view first; anything not yet built falls back to the per-tile MINIMAP image underneath (same coordinates).
const OV={px:2,sheetT:512,sheets:[],done:null,n:0,total:0,fx:-1,fy:-1,r:0};
function ovInit(){ if(OV.done) return; const NC=MW/(CHUNK/TILE); OV.nc=NC; OV.total=NC*(MH/(CHUNK/TILE)); OV.done=new Uint8Array(OV.total);
  const S=Math.ceil(MW/OV.sheetT); for(let j=0;j<Math.ceil(MH/OV.sheetT);j++) for(let i=0;i<S;i++){ OV.sheets.push({i,j,c:null}); } OV.sw=S; }
function ovSheet(i,j){ const s=OV.sheets[j*OV.sw+i]; if(!s.c){ s.c=mkCanvas(OV.sheetT*OV.px,OV.sheetT*OV.px); const g=s.c.getContext('2d'); if(MINIMAP){ g.imageSmoothingEnabled=false; g.drawImage(MINIMAP,i*OV.sheetT,j*OV.sheetT,OV.sheetT,OV.sheetT,0,0,s.c.width,s.c.height); } } return s; }
function ovBuild(cx,cy){ const k=cy*OV.nc+cx; if(OV.done[k]) return false; OV.done[k]=1; OV.n++;
  const N=CHUNK/TILE, src=chunkCache.get(cx+','+cy)||chunkLo.get(cx+','+cy)||renderChunk(cx,cy); const tx=cx*N, ty=cy*N, si=Math.floor(tx/OV.sheetT), sj=Math.floor(ty/OV.sheetT);
  const s=ovSheet(si,sj), g=s.c.getContext('2d'); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; const d=N*OV.px;
  g.drawImage(src,(tx-si*OV.sheetT)*OV.px,(ty-sj*OV.sheetT)*OV.px,d,d); ovlPaint(g,(tx-si*OV.sheetT)*OV.px,(ty-sj*OV.sheetT)*OV.px,tx,ty,N,N,OV.px); return true; }
// build a few chunks per frame, spiralling out from the focus (map centre when open, truck otherwise)
function ovTick(ms){ if(!MINIMAP||typeof chunkCache==='undefined') return; ovInit(); if(OV.n>=OV.total) return;
  const N=CHUNK/TILE, fxT=bigmap.open?bigmap.cx:truck.x*PPM/TILE, fyT=bigmap.open?bigmap.cy:truck.y*PPM/TILE;
  const fx=Math.max(0,Math.min(OV.nc-1,Math.floor(fxT/N))), fy=Math.max(0,Math.min(OV.total/OV.nc-1,Math.floor(fyT/N)));
  if(fx!==OV.fx||fy!==OV.fy){ OV.fx=fx; OV.fy=fy; OV.r=0; }
  const t0=performance.now(), NR=OV.total/OV.nc, RM=Math.max(OV.nc,NR);
  while(OV.r<=RM&&performance.now()-t0<ms){ const r=OV.r; let built=false;
    for(let dy=-r;dy<=r&&performance.now()-t0<ms;dy++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue; const cx=fx+dx, cy=fy+dy; if(cx<0||cy<0||cx>=OV.nc||cy>=NR) continue;
      if(ovBuild(cx,cy)){ built=true; if(performance.now()-t0>=ms) break; } }
    if(performance.now()-t0<ms) OV.r++; else if(!built) OV.r++; }
  if(OV.r>RM&&OV.n<OV.total) OV.r=0; }
// draw the overview: X0/Y0 = screen px of tile (0,0), z = px per tile; clip rect x0..x1/y0..y1
function ovDraw(X0,Y0,z,x0,y0,x1,y1){ if(!OV.done){ ctx.drawImage(MINIMAP,X0,Y0,MW*z,MH*z); return; } const T=OV.sheetT; ctx.imageSmoothingEnabled=z<OV.px*1.5; ctx.imageSmoothingQuality='high';
  for(const s of OV.sheets){ const sx=X0+s.i*T*z, sy=Y0+s.j*T*z, w=T*z; if(sx>x1||sy>y1||sx+w<x0||sy+w<y0) continue;
    if(s.c) ctx.drawImage(s.c,Math.floor(sx),Math.floor(sy),Math.ceil(w)+1,Math.ceil(w)+1); else ctx.drawImage(MINIMAP,s.i*T,s.j*T,T,T,Math.floor(sx),Math.floor(sy),Math.ceil(w)+1,Math.ceil(w)+1); }
  ctx.imageSmoothingEnabled=true; }
// ground layers that the game draws live on top of the chunks (airport airfield/landside) are painted into the map too.
// They draw on the main ctx, so each block is rendered into the corner of the main canvas, copied out, and the corner restored
// within the same task (never composited -> nothing visible).
const OVL={tmp:null};
function ovlBoxes(){ const L=[]; const A=typeof apA==='function'?apA():null; if(A) L.push([A.x0-50,A.y0-30,A.x1+50,A.term.y1+40]); return L; }
function ovlHits(tx0,ty0,tx1,ty1){ return ovlBoxes().some(b=>tx1>b[0]&&tx0<b[2]&&ty1>b[1]&&ty0<b[3]); }
// queued and run at the start of the next frame, when the main ctx carries no clip from the map/minimap
function ovlPaint(g,dx,dy,tx0,ty0,wT,hT,ppt){ if(!ovlHits(tx0,ty0,tx0+wT,ty0+hT)) return; (OVL.q||(OVL.q=[])).push([g,dx,dy,tx0,ty0,wT,hT,ppt]); }
function ovlFlush(ms){ if(!OVL.q||!OVL.q.length) return; const t0=performance.now(); while(OVL.q.length&&performance.now()-t0<ms){ const j=OVL.q.shift(); ovlNow(...j); } }
function ovlNow(g,dx,dy,tx0,ty0,wT,hT,ppt){ const B=256, k=ppt/TILE; if(!OVL.tmp) OVL.tmp=mkCanvas(B,B); const tg=OVL.tmp.getContext('2d');
  const W=Math.ceil(wT*ppt), H=Math.ceil(hT*ppt);
  for(let by=0;by<H;by+=B) for(let bx=0;bx<W;bx+=B){ const bw=Math.min(B,W-bx), bh=Math.min(B,H-by), wx0=tx0*TILE+bx/k, wy0=ty0*TILE+by/k;
    tg.globalCompositeOperation='copy'; tg.drawImage(cv,0,0,bw,bh,0,0,bw,bh); tg.globalCompositeOperation='source-over';
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,bw,bh); ctx.beginPath(); ctx.rect(0,0,bw,bh); ctx.clip(); ctx.setTransform(k,0,0,k,-wx0*k,-wy0*k);
    try{ apDrawLow(wx0,wy0,wx0+bw/k,wy0+bh/k); }catch(e){ OVL.err=String(e&&e.stack||e); } ctx.restore();
    g.drawImage(cv,0,0,bw,bh,dx+bx,dy+by,bw,bh);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='copy'; ctx.drawImage(OVL.tmp,0,0,bw,bh,0,0,bw,bh); ctx.restore(); } }
