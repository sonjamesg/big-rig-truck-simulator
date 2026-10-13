'use strict';
// ===================== WORLD GENERATION (v2: 640x640 tiles, ~2.5 km square) =====================
const TILE = 32;            // px per tile (4 m)
const PPM = 8;              // px per metre
const MW = 2048, MH = 2048;   // map size in tiles
const T = { GRASS:0, ROAD:1, WALK:2, WATER:3, BRIDGE:4, PARK:5, CONC:6, BLDG:7, PGRASS:8, GRAVEL:9, TREE:10, QUAY:11, CONT:12, SAND:13, PLAZA:14, LOT:15, TANK:16, PUMP:17, FIELD:18, ISLAND:19, HEDGE:20, ROCK:21 };
const PORT_Y0=262, PORT_Y1=414;   // v14 compact Albion container terminal (tiles)
const M_TILE = TILE/PPM; // metres per tile
const SOLID = new Uint8Array(32); [T.WATER,T.BLDG,T.TREE,T.CONT,T.TANK,T.PUMP,T.HEDGE].forEach(t=>SOLID[t]=1);
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash2(x,y){ let h=(x*374761393+y*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
const CHUNK=512;
const world = {
  ground: new Uint8Array(MW*MH),
  under: new Uint8Array(MW*MH), roadH: new Int16Array(MW*MH).fill(-1), roadV: new Int16Array(MW*MH).fill(-1),
  segs: [], objects: [], overhead: [], start: {x:0,y:0,h:0}, districts: [], junctions: [], corners: [], rbs: [], labels: [], curves: [], airports: [], boats: [], smokers: [], flags: [], beacons: [], animals: []
};
const G = world.ground;
const idx=(x,y)=>y*MW+x;
const inb=(x,y)=>x>=0&&y>=0&&x<MW&&y<MH;
function get(x,y){ return inb(x,y)?G[idx(x,y)]:T.WATER; }
function set(x,y,t){ if(!inb(x,y)) return; const i=idx(x,y); if(world.roadLock&&(world.roadH[i]!==-1||world.roadV[i]!==-1)&&t!==T.ROAD&&t!==T.BRIDGE) return; G[i]=t; }   // v24: once the road net is laid, nothing paints over it
function fill(x0,y0,w,h,t){ for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++) set(x,y,t); }
function isSolidTile(tx,ty){ return !inb(tx,ty) || SOLID[G[idx(tx,ty)]]===1; }
const SHOPS=['CAFE','PIZZA','BAKERY','FISH & CHIPS','PHARMACY','BOOKS','NEWS','BARBER','FLORIST','TOOLS','DINER','KEBAB','BANK','GYM','PUB','TESCOMART'];
const COMPANIES=['BIG RIG','NORTHWAY','EXPRESSO','GLOBAL FREIGHT','STAR LOGISTICS','REDLINE','ALBION','MERIDIAN'];

function vnoise(x,y,s){ const fx=x/s, fy=y/s, ix=Math.floor(fx), iy=Math.floor(fy), tx=fx-ix, ty=fy-iy; const u=tx*tx*(3-2*tx), v=ty*ty*(3-2*ty);
  const a=hash2(ix,iy), b=hash2(ix+1,iy), c=hash2(ix,iy+1), d=hash2(ix+1,iy+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function fbm(x,y){ return vnoise(x,y,90)*0.55+vnoise(x+333,y+71,35)*0.3+vnoise(x+17,y+911,12)*0.15; }
// ===== v4 ORIGINAL world: three landmasses split by winding sea channels, a river and an inlet =====
const cW=y=>700+60*Math.sin(y/260+0.5)+25*Math.sin(y/90);      // Albion Sound (west channel centre x)
const cWh=y=>40+16*Math.sin(y/170+1);
const cE=x=>880+55*Math.sin(x/210+1)+20*Math.sin(x/70);         // Sandreach Strait (centre y)
const cEh=x=>34+12*Math.sin(x/130);
const riverX=y=>1150+50*Math.sin(y/120)+15*Math.sin(y/37);
const MTN={x:290,y:1600,r:230,name:'Mount Greyfell'};
const HILLS=[MTN,{x:1720,y:1130,r:95},{x:830,y:1640,r:70},{x:1030,y:620,r:85,desert:true},{x:1250,y:470,r:55,desert:true}];
function regionAt(x,y){ return x<cW(y)?'Westmere':y<cE(x)?'The Sandreach':'Highmoor'; }
function isDesert(x,y){ if(x<cW(y)+20||y>cE(x)-25+(vnoise(x,y,60)-0.5)*110) return false; return !(y>560 && x<cW(y)+150+(vnoise(x+50,y,80)-0.5)*140); }
function forestD(x,y){ return vnoise(x,y,120)*0.6+vnoise(x+77,y+5,40)*0.4; }
world.regionAt=regionAt; world.hills=HILLS; world.isDesert=isDesert;
function genWorld(){
  const t0=performance.now();
  const R = mulberry(20261012);
  const water = new Uint8Array(MW*MH); world.water=water; const CE=new Float32Array(MW), CEH=new Float32Array(MW); for(let x=0;x<MW;x++){ CE[x]=cE(x); CEH[x]=cEh(x); }
  for(let y=0;y<MH;y++){ const cw=cW(y), cwh=cWh(y); for(let x=0;x<MW;x++){
    const d=Math.min(x,y,MW-1-x,MH-1-y); let w= d<22 || (d<107 && d < 22+fbm(x*1.4,y*1.4)*85);
    if(!w){ const dc=Math.abs(x-cw); if(dc<cwh+9 && dc<cwh+(vnoise(x,y,25)-0.5)*18) w=true; }
    if(!w && x>cw){ const ce=CE[x], dc=Math.abs(y-ce), eh=CEH[x]; if(dc<eh+8 && dc<eh+(vnoise(x+9,y,25)-0.5)*16) w=true; }
    water[idx(x,y)]=w?1:0; } }
  (world.tm=world.tm||[]).push(['// Greyfell Inlet',performance.now()-t0|0]);
  // Greyfell Inlet (winding sea inlet into Westmere)
  for(let x=380;x<760;x++){ const yc=1270+25*Math.sin(x/45), hw=3+Math.max(0,(x-380)/(cW(yc)-380))*24; for(let y=Math.floor(yc-hw);y<=yc+hw;y++) if(inb(x,y)) water[idx(x,y)]=1; }
  // River Moor across Highmoor to the south coast
  for(let y=Math.floor(cE(1150))-10;y<MH;y++){ const xc=riverX(y), hw=4+2*Math.sin(y/50); for(let x=Math.floor(xc-hw);x<=xc+hw;x++) water[idx(x,y)]=1; }
  const lake=(cx,cy,rx,ry)=>{ for(let y=Math.max(0,cy-ry-4);y<Math.min(MH,cy+ry+4);y++) for(let x=Math.max(0,cx-rx-4);x<Math.min(MW,cx+rx+4);x++){ const dx=(x-cx)/rx, dy=(y-cy)/ry, n=0.12*Math.sin(x/5)+0.1*Math.cos(y/4); if(dx*dx+dy*dy<1+n) water[idx(x,y)]=1; } };
  lake(470,700,30,20); lake(1600,1270,40,24); lake(1250,1650,30,18); lake(800,1500,18,30); lake(1330,600,14,10); lake(560,1420,16,12);
  for(let y=1500;y<1586;y++) for(let x=1110;x<1240;x++){ const dx=(x-riverX(1545))/(48+6*Math.sin(y/9)), dy=(y-1545)/40; if(dx*dx+dy*dy<1) water[idx(x,y)]=1; }   // Moor Reservoir (dammed)
  // keep land under cities / airports, then cut dock basins
  for(const [x0,y0,x1,y1] of [[145,135,720,655],[1060,150,1830,515],[1395,1375,1800,1884],[995,1785,1385,1905],[240,775,355,885],[235,1095,300,1162]]) for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) water[idx(x,y)]=0;
  for(let y=145;y<456;y++) for(let x=478;x<800;x++) if(!(x<600&&y>=PORT_Y0&&y<PORT_Y1)) water[idx(x,y)]=1;   // v14 Port Albion: compact terminal, open water around it
  for(let y=1885;y<1936;y++) for(let x=1430;x<1790;x++) water[idx(x,y)]=1; for(let y=1850;y<1885;y++) for(let x=1478;x<1528;x++) water[idx(x,y)]=1; for(let y=1394;y<1885;y++) for(let x=1752;x<1760;x++) water[idx(x,y)]=1;   // Kingsbridge harbour + inlet + Kingsbridge Channel                                             // Kingsbridge harbour
  for(let k=0;k<4;k++) for(let x=1480+k*80;x<1496+k*80;x++) for(let y=1815;y<1885;y++) water[idx(x,y)]=1;
  (world.tm=world.tm||[]).push(['// ground: water',performance.now()-t0|0]);
  const CW=new Float32Array(MH); for(let y=0;y<MH;y++) CW[y]=cW(y);
  // ground: water / desert sand / mountain rock / grass
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){ const i=idx(x,y); if(water[i]){ G[i]=T.WATER; continue; }
    let t=(x>CW[y]+20&&y<CE[x]+40&&isDesert(x,y))?T.SAND:T.GRASS;
    for(const h of HILLS){ const dx=x-h.x, dy=y-h.y; if(Math.abs(dx)>h.r*1.2||Math.abs(dy)>h.r*1.2) continue; if(Math.hypot(dx,dy)<h.r*(0.82+0.3*vnoise(x,y,40))) t=T.ROCK; }
    G[i]=t; }
  (world.tm=world.tm||[]).push(['// beaches:',performance.now()-t0|0]);
  // beaches: 1-5 tiles of sand along the coasts
  const bd=new Uint8Array(MW*MH);
  for(let pass=1;pass<=5;pass++) for(let y=1;y<MH-1;y++) for(let x=1;x<MW-1;x++){ const i=idx(x,y); if(water[i]||bd[i]) continue;
    const n=(j)=> pass===1? water[j] : bd[j]===pass-1;
    if(n(i-1)||n(i+1)||n(i-MW)||n(i+MW)){ if(pass>1+Math.floor(vnoise(x,y,45)*5.5)) continue; bd[i]=pass; if(G[i]!==T.ROCK) G[i]=T.SAND; } }
  (world.tm=world.tm||[]).push(['// ---------------- ',performance.now()-t0|0]);
  // ---------------- roads ----------------
  function road(dir,a,b0,b1,w,type){
    const id=world.segs.length; const sg={id,dir,a,b0,b1,w,type,js:[]}; world.segs.push(sg);
    for(let i=b0;i<=b1;i++) for(let k=0;k<w;k++){
      const x= dir==='h'? i : a+k, y = dir==='h'? a+k : i; if(!inb(x,y)) continue;
      set(x,y, water[idx(x,y)]?T.BRIDGE:T.ROAD);
      if(dir==='h') world.roadH[idx(x,y)]=id; else world.roadV[idx(x,y)]=id;
    }
    return sg;
  }
  function roundabout(cx,cy,rin,rout){
    const rb={cx,cy,rin,rout,arms:[],id:world.rbs.length}; world.rbs.push(rb);
    for(let y=Math.floor(cy-rout-1);y<=cy+rout+1;y++) for(let x=Math.floor(cx-rout-1);x<=cx+rout+1;x++){ const d=Math.hypot(x+0.5-cx,y+0.5-cy);
      if(d<=rout+0.3 && d>=rin-0.3){ set(x,y,water[idx(x,y)]?T.BRIDGE:T.ROAD); world.roadH[idx(x,y)]=-2; world.roadV[idx(x,y)]=-2; }
      else if(d<rin-0.3) set(x,y,T.ISLAND); }
    world.objects.push({kind:'rb',x:(cx-rout-1)*TILE,y:(cy-rout-1)*TILE,w:(2*rout+2)*TILE,h:(2*rout+2)*TILE,rb,seed:(R()*1e9)|0});
    return rb;
  }
  // ---- smooth curved roads (motorway bends, winding country roads) joining straight segment ends
  const pending=[]; let conflicts=0;
  const segEnd=(sg,end)=>{ const c=sg.a+sg.w/2, b=end?sg.b1+1:sg.b0; return sg.dir==='h'?[b,c]:[c,b]; };
  const segOut=(sg,end)=>{ const s=end?1:-1; return sg.dir==='h'?[s,0]:[0,s]; };
  function spline(ctrl,step){ const out=[]; for(let i=0;i<ctrl.length-1;i++){ const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)];
      const n=Math.max(1,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/step));
      for(let k=0;k<n;k++){ const t=k/n,t2=t*t,t3=t2*t; out.push([0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3))); } }
    out.push(ctrl[ctrl.length-1].slice()); return out; }
  function bez(S,C1,C2,E,step){ const L=Math.hypot(C1[0]-S[0],C1[1]-S[1])+Math.hypot(C2[0]-C1[0],C2[1]-C1[1])+Math.hypot(E[0]-C2[0],E[1]-C2[1]); const n=Math.max(4,Math.ceil(L/step)), out=[];
    for(let k=0;k<=n;k++){ const t=k/n,u=1-t; out.push([0,1].map(j=>u*u*u*S[j]+3*u*u*t*C1[j]+3*u*t*t*C2[j]+t*t*t*E[j])); } return out; }
  function curve(type,w,pts,A,B,name){
    const cv={id:world.curves.length,type,w,pts,A,B,name}; world.curves.push(cv);
    if(A) world.segs[A.seg]['cv'+A.end]={cv:cv.id,start:true};
    if(B) world.segs[B.seg]['cv'+B.end]={cv:cv.id,start:false};
    const hw=w/2; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; let wet=0;
    for(let pi=0;pi<pts.length;pi++){ const px=pts[pi][0],py=pts[pi][1]; x0=Math.min(x0,px); y0=Math.min(y0,py); x1=Math.max(x1,px); y1=Math.max(y1,py);
      for(let ty=Math.floor(py-hw-1);ty<=py+hw+1;ty++) for(let tx=Math.floor(px-hw-1);tx<=px+hw+1;tx++){ if(!inb(tx,ty)) continue;
        if(Math.hypot(tx+0.5-px,ty+0.5-py)>hw+0.05) continue; const i=idx(tx,ty);
        if(world.roadH[i]!==-1||world.roadV[i]!==-1){ if(world.roadH[i]>=0||world.roadV[i]>=0){ const e0=Math.hypot(px-pts[0][0],py-pts[0][1]), e1=Math.hypot(px-pts[pts.length-1][0],py-pts[pts.length-1][1]); if(Math.min(e0,e1)>w+1){ conflicts++; (world.cflog=world.cflog||[]).push([name||type,tx,ty,world.roadH[i],world.roadV[i]]); (cv.cfI=cv.cfI||[]).push(pi); (cv.cfT=cv.cfT||new Set()).add(i); } } continue; }
        (world.cvOwn||(world.cvOwn=new Int16Array(MW*MH).fill(-1)))[i]=cv.id; world.under[i]=G[i]; const wt=water[i]||G[i]===T.WATER; if(wt) wet++; G[i]=wt?T.BRIDGE:T.ROAD; world.roadH[i]=-3; world.roadV[i]=-3; } }
    cv.bridge=wet>0;
    // tightest radius -> advisory speed
    let rmin=1e9; for(let i=4;i<pts.length-4;i+=2){ const a=pts[i-4],b=pts[i],c=pts[i+4]; const A2=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])); const la=Math.hypot(b[0]-a[0],b[1]-a[1]),lb=Math.hypot(c[0]-b[0],c[1]-b[1]),lc=Math.hypot(c[0]-a[0],c[1]-a[1]); if(A2>1e-6) rmin=Math.min(rmin,la*lb*lc/(2*A2)); }
    cv.rmin=rmin*M_T; cv.vmax=Math.min(40,Math.sqrt(Math.max(9,cv.rmin)*2.4));
    world.objects.push({kind:'curve',cv,x:(x0-hw-2)*TILE,y:(y0-hw-2)*TILE,w:(x1-x0+hw*2+4)*TILE,h:(y1-y0+hw*2+4)*TILE});
    return cv; }
  function link(type,w,sa,ea,sb,eb,wps,h,name){ const S=segEnd(sa,ea),E=segEnd(sb,eb),dA=segOut(sa,ea),dB=segOut(sb,eb); h=h||8;
    const ctrl=[S,[S[0]+dA[0]*h,S[1]+dA[1]*h],...(wps||[]),[E[0]+dB[0]*h,E[1]+dB[1]*h],E];
    pending.push(()=>{ let pts=spline(ctrl,0.5); pts=pts.filter((p,i)=> i===0||i===pts.length-1 || (((p[0]-S[0])*dA[0]+(p[1]-S[1])*dA[1])>0.2 && ((p[0]-E[0])*dB[0]+(p[1]-E[1])*dB[1])>0.2)); curve(type,w,pts,{seg:sa.id,end:ea},{seg:sb.id,end:eb},name); }); }
  // v12: winding road between two stub segments — waypoints wander off the straight line; amplitude backs off until the spline crosses nothing
  // centripetal Catmull-Rom (no cusps/loops); first & last points are phantoms that fix the end tangents
  function crSpline(C,step){ const out=[]; for(let i=1;i<C.length-2;i++){ const P0=C[i-1],P1=C[i],P2=C[i+1],P3=C[i+2]; const tj=(a,b)=>Math.pow(Math.hypot(b[0]-a[0],b[1]-a[1])||1e-4,0.5);
      const t0=0,t1=tj(P0,P1),t2=t1+tj(P1,P2),t3=t2+tj(P2,P3); const n=Math.max(1,Math.ceil(Math.hypot(P2[0]-P1[0],P2[1]-P1[1])/step));
      for(let k=0;k<n;k++){ const t=t1+(t2-t1)*k/n; const L=(A,B,ta,tb)=>[0,1].map(j=>(tb-t)/(tb-ta)*A[j]+(t-ta)/(tb-ta)*B[j]);
        const A1=L(P0,P1,t0,t1),A2=L(P1,P2,t1,t2),A3=L(P2,P3,t2,t3),B1=L(A1,A2,t0,t2),B2=L(A2,A3,t1,t3); out.push(L(B1,B2,t1,t2)); } }
    out.push(C[C.length-2].slice()); return out; }
  function dryHit(pts,w,S,E){ const hw=w/2; for(const [px,py] of pts){ if(Math.hypot(px-S[0],py-S[1])<w+3||Math.hypot(px-E[0],py-E[1])<w+3) continue;
      for(let ty=Math.floor(py-hw-1);ty<=py+hw+1;ty++) for(let tx=Math.floor(px-hw-1);tx<=px+hw+1;tx++){ if(!inb(tx,ty)) return true; if(Math.hypot(tx+0.5-px,ty+0.5-py)>hw+1.2) continue; const i=idx(tx,ty); if(world.roadH[i]!==-1||world.roadV[i]!==-1) return true; } } return false; }
  function windLink(type,w,sa,ea,sb,eb,wps,amp,name,seed){ const S=segEnd(sa,ea),E=segEnd(sb,eb),dA=segOut(sa,ea),dB=segOut(sb,eb); const h=10, rr=mulberry(seed||7);
    const base=wps&&wps.length?wps:(()=>{ const L=Math.hypot(E[0]-S[0],E[1]-S[1]), n=Math.max(1,Math.round(L/70)), o=[]; for(let k=1;k<n;k++){ const t=k/n; o.push([S[0]+(E[0]-S[0])*t,S[1]+(E[1]-S[1])*t]); } return o; })();
    const nx=-(E[1]-S[1]), ny=E[0]-S[0], nl=Math.hypot(nx,ny)||1; const offs=base.map((p,k)=>(k%2?1:-1)*(0.6+0.4*rr()));
    amp=Math.min(amp,18); pending.push(()=>{ for(const a of [amp,amp*0.6,amp*0.3,0]){ const ctrl=[S,[S[0]+dA[0]*h,S[1]+dA[1]*h],...base.map((p,k)=>[p[0]+nx/nl*offs[k]*a,p[1]+ny/nl*offs[k]*a]),[E[0]+dB[0]*h,E[1]+dB[1]*h],E];
        const pts=crSpline([[S[0]-dA[0]*h,S[1]-dA[1]*h],...ctrl,[E[0]-dB[0]*h,E[1]-dB[1]*h]],0.5);
        if(a>0&&dryHit(pts,w,S,E)) continue; const cv=curve(type,w,pts,{seg:sa.id,end:ea},{seg:sb.id,end:eb},name); cv.amp=a; return; } }); }
  // straight stub + far stub + winding link: replaces a straight connector road('h'|'v',a,b0,b1)
  function wind(dir,a,b0,b1,w,type,amp,name,stubType){ const L=6; const s0=road(dir,a,b0,b0+L-1,w,stubType||type), s1=road(dir,a,b1-L+1,b1,w,stubType||type); s0.name=s1.name=name;
    windLink(type,w,s0,1,s1,0,null,amp,name,(a*131+b0*7)|0); return [s0,s1]; }
  const rbAt=new Map(); const rbNode=(x,y)=>{ const k=x+','+y; if(!rbAt.has(k)) rbAt.set(k,roundabout(x,y,5,10)); return rbAt.get(k); };
  const RW=4, MWD=6, RBT=11;
  // motorway from axis-aligned waypoints [x,y,'rb'?] with large-radius curved bends
  function mway(P,closed,Rc,name,type,w){ type=type||'hwy'; w=w||MWD; const n=P.length, L=closed?n:n-1, lens=[], legs=[];
    for(let i=0;i<L;i++){ const p=P[i],q=P[(i+1)%n]; lens.push(Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1])); }
    const tr=(pt,len,adj)=> pt[2]==='rb'?RBT : adj===null?0 : Math.min(Rc,Math.min(len,adj)/2-2);
    for(let i=0;i<L;i++){ const p=P[i],q=P[(i+1)%n], hz=p[1]===q[1], len=lens[i];
      const t0=tr(p,len,(i>0)?lens[i-1]:(closed?lens[L-1]:null)), t1=tr(q,len,(i<L-1)?lens[i+1]:(closed?lens[0]:null));
      const s=hz?Math.sign(q[0]-p[0]):Math.sign(q[1]-p[1]); let sg;
      if(hz){ const x0=p[0]+s*t0, x1=q[0]-s*t1; sg=road('h',p[1]-w/2,Math.round(Math.min(x0,x1)),Math.round(Math.max(x0,x1))-1,w,type); }
      else { const y0=p[1]+s*t0, y1=q[1]-s*t1; sg=road('v',p[0]-w/2,Math.round(Math.min(y0,y1)),Math.round(Math.max(y0,y1))-1,w,type); }
      sg.name=name; legs.push({sg,s,t1}); }
    for(const p of P) if(p[2]==='rb') rbNode(p[0],p[1]);
    for(let i=0;i<L;i++){ const j=i+1; if(!closed&&j>=L) break; const lin=legs[i], lout=legs[j%L], p=P[j%n]; if(p[2]==='rb') continue;
      const eIn=lin.s>0?1:0, eOut=lout.s>0?0:1, S=segEnd(lin.sg,eIn), E=segEnd(lout.sg,eOut), dA=segOut(lin.sg,eIn), dB=segOut(lout.sg,eOut), k=0.552*lin.t1;
      pending.push(()=>curve(type,w,bez(S,[S[0]+dA[0]*k,S[1]+dA[1]*k],[E[0]+dB[0]*k,E[1]+dB[1]*k],E,0.5),{seg:lin.sg.id,end:eIn},{seg:lout.sg.id,end:eOut},name)); }
    return legs.map(l=>l.sg); }
  const jit=(n,p)=>{ const j=[0]; for(let k=1;k<n-1;k++) j.push(Math.round((R()-0.5)*p*0.36)); j.push(0); return j; };
  const grid=(x0,y0,nx,ny,p)=>{ const xs=[],ys=[], jx=jit(nx,p), jy=jit(ny,p); for(let k=0;k<nx;k++) xs.push(x0+k*p+jx[k]); for(let k=0;k<ny;k++) ys.push(y0+k*p+jy[k]); return {xs,ys,X1:xs[nx-1]+RW-1,Y1:ys[ny-1]+RW-1}; };
  function gridRoads(g,type,walk){ if(walk){ for(let y=g.ys[0]-1;y<=g.Y1+1;y++) for(let x=g.xs[0]-1;x<=g.X1+1;x++){ if(!inb(x,y)) continue; const i=idx(x,y); if(world.roadH[i]!==-1||world.roadV[i]!==-1) continue; G[i]=T.WALK; } } g.rows=[]; g.cols=[];   // v24: never pave over a road that is already there (was leaving pavement strips across the Kingsbridge dual carriageways)
    for(const y of g.ys) g.rows.push(road('h',y,g.xs[0],g.X1,RW,type)); for(const x of g.xs) g.cols.push(road('v',x,g.ys[0],g.Y1,RW,type)); }
  // --- cities (corners of the landmasses) & towns
  const C1=grid(150,140,11,11,28), SV=grid(1460,170,13,12,30), KB=grid(1560,1560,6,5,22);   // v17 Kingsbridge downtown core (inside the loop)
  gridRoads(C1,'city',true); gridRoads(SV,'city',true); gridRoads(KB,'city',true);
  const MF=grid(250,780,5,5,24), DW=grid(1000,420,4,4,22), CM=grid(1600,600,4,3,22), RH=grid(980,1150,5,5,22), FW=grid(1500,1120,4,4,22);
  for(const g of [MF,DW,CM,RH,FW]) gridRoads(g,'town',true);
  const AB=grid(240,1100,4,4,18); gridRoads(AB,'res',false);
  // --- motorways: the M1 orbital loops round the coast; M2 and M3 cut through the middle over long bridges
  mway([[100,100],[1945,100],[1945,720,'rb'],[1945,1945],[900,1945,'rb'],[100,1945],[100,980,'rb']],true,70,'M1');
  mway([[100,980,'rb'],[600,980],[600,1060],[1250,1060],[1250,720],[1945,720,'rb']],false,60,'M2');
  mway([[900,1945,'rb'],[900,1380],[1360,1380,'rb']],false,60,'M3');
  // --- city & town connections
  for(const k of [3,7]) road('h',C1.ys[k],103,C1.xs[0]-1,RW,'city');
  for(const k of [2,8]) road('v',C1.xs[k],103,C1.ys[0]-1,RW,'city');
  for(const k of [2,6]) road('v',C1.xs[k],C1.Y1+1,459,RW,'city');
  road('h',460,103,600,RW,'city');                                                    // Albion Airport road
  { const o=12, X0=C1.xs[0]-o, Y0=C1.ys[0]-o, X1=C1.X1+o-RW+1, Y1=C1.Y1+o-RW+1;   // v23 Albion Ring: city loop 12 tiles outside the grid
    road('h',Y0,X0,X1+RW-1,RW,'city'); road('h',Y1,X0,X1+RW-1,RW,'city'); road('v',X0,Y0,Y1+RW-1,RW,'city'); road('v',X1,Y0,Y1+RW-1,RW,'city');
    for(const k of [1,5,9]) road('v',C1.xs[k],Y0+RW,C1.ys[0]-1,RW,'city'); for(const k of [1,4,9]) road('h',C1.ys[k],X0+RW,C1.xs[0]-1,RW,'city'); for(const k of [3,8]) road('v',C1.xs[k],C1.Y1+1,Y1-1,RW,'city');   // extra radials to the ring
    world.abRing={X0,Y0,X1,Y1}; }
  for(const k of [1,5,9]) road('h',C1.ys[k],C1.X1+1,469,RW,'city'); road('v',470,C1.ys[0],459,RW,'city');   // docks
  { // v14 port aisles: the city streets carry straight through the gate, two extra aisles tee off the boundary road, a quay road links them
    const A=[C1.ys[5],Math.round((C1.ys[5]+C1.ys[7])/2),C1.ys[7],Math.round((C1.ys[7]+C1.ys[9])/2),C1.ys[9]];
    for(const a of A) road('h',a,474,583,RW,'city'); road('v',584,A[0],A[4]+RW-1,RW,'city');
    world.port={x0:474,x1:600,y0:PORT_Y0,y1:PORT_Y1,aisles:A,quayX:588,edge:600,hole:{x:477,y:A[3]+RW+3,w:22,h:17}}; }
  for(const k of [2,6,10]) road('h',SV.ys[k],SV.X1+1,1941,RW,'city');
  for(const k of [3,9]) road('v',SV.xs[k],103,SV.ys[0]-1,RW,'city');
  for(const k of [2,8]) road('v',SV.xs[k],SV.Y1+1,716,RW,'city');
  const apRoad=road('h',SV.ys[6],1060,SV.xs[0]-1,RW,'city');                           // Sandvale Airport road
  // v17 Kingsbridge: elevated-style dual loop round a compact downtown, roundabout interchanges at its corners, five radials, district grids of differing pitch, channel bridges
  mway([[1530,1530,'rb'],[1705,1530,'rb'],[1705,1680,'rb'],[1530,1680,'rb']],true,0,'Kingsbridge Loop','dual');
  mway([[1360,1380,'rb'],[1530,1380],[1530,1530,'rb']],false,40,'K1 Northway','dual');
  mway([[1705,1530,'rb'],[1940,1530]],false,0,'K2 Eastway','dual');
  mway([[1705,1680,'rb'],[1850,1680],[1850,1940]],false,40,'K3 Portway','dual');
  mway([[1530,1680,'rb'],[1400,1680]],false,0,'K4 Westway','dual');
  road('v',1400,1683,1790,RW,'city'); road('h',1589,1400,1526,2,'rural');                           // Airport Way + Dam Road (K5) feed in
  for(const k of [1,3]){ road('h',KB.ys[k],1533,KB.xs[0]-1,RW,'city'); road('h',KB.ys[k],KB.X1+1,1701,RW,'city'); }
  for(const k of [1,4]){ road('v',KB.xs[k],1533,KB.ys[0]-1,RW,'city'); road('v',KB.xs[k],KB.Y1+1,1676,RW,'city'); }
  const KD={NG:grid(1404,1400,5,5,26),CH:grid(1545,1398,7,4,30),RM:grid(1768,1404,5,4,40),RS:grid(1768,1545,5,4,38),WM:grid(1408,1540,4,4,36),OH:grid(1408,1697,4,4,34),MK:grid(1545,1697,6,4,34)};
  { // v24: snap district streets that nearly line up with a street across the loop/radials (no 1-8 tile doglegs at the dual carriageways)
    const anc={xs:[KB.xs[1],KB.xs[4]],ys:[KB.ys[1],KB.ys[3]]};
    for(const g of Object.values(KD)){ for(const ax of ['xs','ys']){ const v=g[ax]; for(let k=0;k<v.length;k++){ let best=null; for(const a of anc[ax]){ const d=Math.abs(a-v[k]); if(d>0&&d<=8&&(best===null||d<Math.abs(best-v[k]))) best=a; }
          if(best!==null&&(k===0||best-v[k-1]>=14)&&(k===v.length-1||v[k+1]-best>=14)) v[k]=best; }
        for(const x of v) anc[ax].push(x); }
      g.X1=g.xs[g.xs.length-1]+RW-1; g.Y1=g.ys[g.ys.length-1]+RW-1; } }
  for(const g of Object.values(KD)) gridRoads(g,'city',true);
  // stitch each district grid to its neighbours: extend edge streets outward to the first straight road (bridging the channel where needed)
  { const hit=(x,y)=>inb(x,y)&&(world.roadH[idx(x,y)]>=0||world.roadV[idx(x,y)]>=0);
    const ext=(dir,a,from,step,lim)=>{ for(let k=1;k<=lim;k++){ const b=from+step*k; let any=false; for(let q=0;q<RW;q++){ const x=dir==='h'?b:a+q, y=dir==='h'?a+q:b; if(hit(x,y)) any=true; } if(any){ if(k>1) road(dir,a,Math.min(from+step,b-step),Math.max(from+step,b-step),RW,'city'); return; } } };
    for(const g of Object.values(KD)){ for(const y of g.ys){ ext('h',y,g.xs[0],-1,40); ext('h',y,g.X1,1,40); } for(const x of g.xs){ ext('v',x,g.ys[0],-1,40); ext('v',x,g.Y1,1,40); } } }
  road('h',1866,1404,1846,RW,'city');                                                                  // Kingsbridge coast road
  // Bath-style crescents: sweeping arcs joining grid ends (AI-drivable curves)
  link('city',RW,KD.RM.cols[1],0,KD.RM.cols[3],0,[[KD.RM.xs[2]+2,1384]],8,'Royal Crescent');
  link('city',RW,KD.OH.cols[0],1,KD.OH.cols[2],1,[[KD.OH.xs[1]+2,KD.OH.Y1+22]],8,'Harbour Crescent');
  // diagonal avenues along district edges (curves; drivable + routable)
  pending.push(()=>{ curve('city',RW,crSpline([[1716,1700],[1722,1706],[1745,1740],[1800,1800],[1840,1858],[1845,1870]],0.5),null,null,'Channel Diagonal'); });
  world.kbDistricts=KD;
  { // v24 Northgate Diagonal: a staircase avenue across the Northgate grid. Each street it crosses is crossed mid-block on a short straight
    // stub (a real signalised crossroads), the stubs are joined by drivable curves, and both ends T into the grid — so AI and sat nav use it.
    const N=KD.NG, xs=N.xs, ys=N.ys, L=3, mid=(a,b)=>Math.round((a+RW+b)/2-RW/2);
    const H=(k,j)=>road('h',mid(ys[j],ys[j+1]),xs[k]-L,xs[k]+RW-1+L,RW,'city'), V=(k,j)=>road('v',mid(xs[j],xs[j+1]),ys[k]-L,ys[k]+RW-1+L,RW,'city');
    const st=road('v',mid(xs[3],xs[4]),ys[4]-6,ys[4]-1,RW,'city'), en=road('v',mid(xs[0],xs[1]),ys[1]+RW,ys[1]+RW+5,RW,'city');
    const chain=[st,H(3,3),V(3,2),H(2,2),V(2,1),H(1,1),en]; for(const sg of chain) sg.name='Northgate Diagonal';
    for(let i=0;i<chain.length-1;i++) link('city',RW,chain[i],0,chain[i+1],1,[],4,'Northgate Diagonal');
    world.kbDiag=chain; }
  const rbN=road('v',1359,1300,1380-RBT-1,2,'rural');
  wind('h',1784,903,1399,RW,'city',30,'Airport Way');                     // curved bridge over the River Moor                                             // Kingsbridge Airport road (over the River Moor)
  wind('h',MF.ys[2],103,MF.xs[0]-1,RW,'town',14,'Millford Road'); wind('v',MF.xs[1],MF.Y1+1,976,RW,'town',10,'Millford South Road');
  road('v',AB.xs[2],983,AB.ys[0]-1,2,'rural');
  wind('h',DW.ys[2],DW.X1+1,1246,RW,'town',22,'Dustwater Road');
  wind('v',CM.xs[1],CM.Y1+1,716,RW,'town',8,'Coppermine Road');
  wind('v',RH.xs[2],1063,RH.ys[0]-1,RW,'town',10,'Redhill Road'); wind('v',RH.xs[2],RH.Y1+1,1376,RW,'town',26,'Redhill South Road');
  // winding country roads
  const wwA=road('h',MF.ys[1]+1,MF.X1+1,MF.X1+8,2,'lane'), wwB=road('h',900,500,540,2,'lane');
  link('lane',2,wwA,1,wwB,0,[[420,770],[470,850]],8,'Wendwood Lane');
  const mA=road('h',1599,103,139,2,'rural'), mS=road('h',1599,MTN.x-14,MTN.x+8,2,'rural'); const spiral=[];
  for(let a=Math.PI+0.35;a<7*Math.PI-0.5;a+=0.12){ const r=150-118*(a-Math.PI)/(6*Math.PI); spiral.push([MTN.x+r*Math.cos(a),MTN.y+r*Math.sin(a)]); }
  link('rural',2,mA,1,mS,0,spiral,5,'Greyfell Summit Road');
  const dwN=road('v',900,103,300,2,'rural'); link('rural',2,dwN,1,DW.rows[1],0,[[880,360],[940,420]],10,'Old Desert Road');
  link('town',RW,DW.cols[1],0,apRoad,0,[],10);
  const fwS=road('v',FW.xs[1]+1,FW.Y1+1,FW.Y1+18,2,'rural'); link('rural',2,fwS,1,rbN,0,[[1480,1262],[1400,1252]],10,'Fenwick Road');
  const rhE=road('h',RH.ys[2]+1,RH.X1+1,RH.X1+8,2,'rural'), fwW=road('h',FW.ys[2]+1,FW.xs[0]-10,FW.xs[0]-1,2,'rural');
  link('rural',2,rhE,1,fwW,0,[[1200,1232],[1350,1150]],10,'Moor Lane');
  // v12: Sound Coast Road — hugs the west shore of Albion Sound from the airport road down to Wendwood
  { const ap=world.segs.find(s=>s.dir==='h'&&s.a===460&&s.b1===600); const cst=[]; for(let y=520;y<=860;y+=34) cst.push([Math.min(cW(y)-cWh(y)-16,y<700?700:9999),y]); cst.push([600,880]);
    windLink('rural',2,ap,1,wwB,1,cst,0,'Sound Coast Road'); }
  // v12: Greyfell Pass — hairpin switchbacks from the summit down the south face to the M1
  { const pB=road('v',430,1925,1941,2,'rural'); pB.name='Greyfell Pass';
    windLink('rural',2,mS,1,pB,0,[[350,1612],[392,1640],[346,1676],[404,1710],[352,1748],[414,1786],[362,1826],[420,1872]],0,'Greyfell Pass'); }
  // v12: Moor Dam road — M3 → over the dam (Moor Reservoir behind it) → Kingsbridge
  { const dy=1589, dA=road('h',dy,903,912,2,'rural'), dam=road('h',dy,Math.floor(riverX(dy))-22,Math.floor(riverX(dy))+22,2,'rural'), dB=road('h',dy,1388,1399,2,'rural');
    dam.name='Moor Dam'; dam.dam=true; world.dam={x0:dam.b0,x1:dam.b1+1,y:dy};
    windLink('rural',2,dA,1,dam,0,null,24,'Dam Road',11); windLink('rural',2,dam,1,dB,0,null,30,'Dam Road',12); }
  // v12: dirt tracks — desert quarry off Dustwater, forest track in Highmoor
  { const q0=road('v',DW.xs[3],DW.Y1+1,DW.Y1+6,2,'dirt'), q1=road('h',600,1150,1157,2,'dirt'); q0.name=q1.name='Quarry Track'; world.quarry={x:1158,y:600};
    windLink('dirt',2,q0,1,q1,0,[[DW.xs[3]+40,560],[1110,585]],0,'Quarry Track');
    const f0=road('h',FW.ys[3]+1,FW.X1+1,FW.X1+6,2,'dirt'), f1=road('v',1790,1290,1297,2,'dirt'); f0.name=f1.name='Fen Forest Track';
    windLink('dirt',2,f0,1,f1,0,[[1700,FW.ys[3]+30],[1760,1230]],0,'Fen Forest Track'); }
  world.cities={C1,SV,KB,MF,DW,CM,RH,FW,AB};
  (world.tm=world.tm||[]).push(['for(const f of pendi',performance.now()-t0|0]);
  for(const f of pending) f();
  world.curveConflicts=conflicts;
  { // v24: side streets meeting a dual carriageway from both sides in line become ONE street running through it (a real crossroads, one junction, one set of lights)
    const S=world.segs, kill=new Map();
    for(const D of S){ if(D.type!=='dual') continue; for(const P of S){ if(P===D||kill.has(P)||P.dir===D.dir||P.type==='dual'||P.b1!==D.a-1) continue; if(P.a<D.b0||P.a+P.w-1>D.b1) continue;
        const Q=S.find(q=>q!==P&&!kill.has(q)&&q.dir===P.dir&&q.a===P.a&&q.w===P.w&&q.type===P.type&&q.b0===D.a+D.w); if(!Q) continue;
        for(let i=P.b1+1;i<=Q.b1;i++) for(let k=0;k<P.w;k++){ const x=P.dir==='h'?i:P.a+k, y=P.dir==='h'?P.a+k:i; if(!inb(x,y)) continue; if(P.dir==='h') world.roadH[idx(x,y)]=P.id; else world.roadV[idx(x,y)]=P.id; }
        P.b1=Q.b1; if(Q.cv1) P.cv1=Q.cv1; if(Q.name&&!P.name) P.name=Q.name; kill.set(Q,P); } }
    // ...and any two in-line streets of the same width/type that simply butt end to end become one street (one junction per crossing, not two
    // half-junctions with separate lights)
    const live=S.filter(q=>!kill.has(q)&&q.type!=='hwy'&&q.type!=='dual'), byK=new Map(); for(const q of live){ const k=q.dir+q.a+','+q.w+q.type; if(!byK.has(k)) byK.set(k,[]); byK.get(k).push(q); }
    for(const arr of byK.values()){ arr.sort((a,b)=>a.b0-b.b0); for(let i=0;i<arr.length-1;i++){ const P=arr[i], Q=arr[i+1]; if(Q.b0!==P.b1+1||P.cv1||Q.cv0||P.rbEnd||Q.dam||P.dam) continue;
        for(let b=Q.b0;b<=Q.b1;b++) for(let k=0;k<Q.w;k++){ const x=Q.dir==='h'?b:Q.a+k, y=Q.dir==='h'?Q.a+k:b; if(!inb(x,y)) continue; if(Q.dir==='h'){ if(world.roadH[idx(x,y)]===Q.id) world.roadH[idx(x,y)]=P.id; } else if(world.roadV[idx(x,y)]===Q.id) world.roadV[idx(x,y)]=P.id; }
        P.b1=Q.b1; if(Q.cv1) P.cv1=Q.cv1; if(Q.name&&!P.name) P.name=Q.name; kill.set(Q,P); arr[i+1]=P; } }
    if(kill.size){ const map=new Int32Array(S.length).fill(-1); const keep=S.filter(q=>!kill.has(q)); keep.forEach((q,i)=>{ map[q.id]=i; });
      for(const [q,P] of kill){ let r=P; while(kill.has(r)) r=kill.get(r); map[q.id]=map[r.id]; }
      for(const arr of [world.roadH,world.roadV]) for(let i=0;i<arr.length;i++) if(arr[i]>=0) arr[i]=map[arr[i]];
      for(const cv of world.curves) for(const E of [cv.A,cv.B]) if(E) E.seg=map[E.seg];
      keep.forEach((q,i)=>{ q.id=i; }); world.segs=keep; world.kbMerged=kill.size; } }
  buildFlyovers();
  (world.tm=world.tm||[]).push(['// segment continuat',performance.now()-t0|0]);
  // segment continuations (same direction, abutting) -> lane drops / gains
  for(const a of world.segs) for(const b of world.segs){ if(a===b||a.dir!==b.dir||b.b0!==a.b1+1) continue;
    if(a.a+a.w-1<b.a||b.a+b.w-1<a.a) continue; a.link1=b.id; b.link0=a.id; }
  // sidewalks along urban roads (walk the two kerb lines of each urban segment)
  for(const sg of world.segs){ if(sg.type!=='city'&&sg.type!=='town'&&sg.type!=='res') continue;
    for(let b=sg.b0-1;b<=sg.b1+1;b++) for(const a of [sg.a-1,sg.a+sg.w]){ const x=sg.dir==='h'?b:a, y=sg.dir==='h'?a:b; if(!inb(x,y)) continue; const t=G[idx(x,y)]; if(t===T.GRASS||t===T.SAND) G[idx(x,y)]=T.WALK; } }
  // v13: lane-drop tapers wherever a wider road meets a narrower one end to end (straight->straight or straight->curve)
  world.tapers=[]; const TPL=15; // taper length in tiles (60 m)
  function taper(W,end,wN,path,urban,narrowCv,off){ off=off||0; if(path.length<4) return; const wW=W.w; if(wW<=wN) return;
    // trim path to ~TPL tiles of arc length
    const P=[path[0]]; let s=0; for(let i=1;i<path.length&&s<TPL+1;i++){ s+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]); P.push(path[i]); }
    if(s<6.5) return; const L=Math.min(TPL,s-0.5), S=[0]; for(let i=1;i<P.length;i++) S.push(S[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
    const dW=segOut(W,end); const eP=Math.max(wN/2,off+wW/2), eM=Math.max(wN/2,wW/2-off); const tp={id:world.tapers.length,W:W.id,end,wW,wN,L,pts:P,s:S,dW,urban,cv:narrowCv,eP,eM,drop:Math.round(eM-wN/2)};
    tp.hs=(t,sd)=>{ const u=Math.max(0,Math.min(1,t/L)), e=u*u*(3-2*u); return wN/2+((sd>0?eP:eM)-wN/2)*(1-e); };
    world.tapers.push(tp);
    // tiles under the visible taper become drivable (grip matches the asphalt)
    for(let i=0;i<P.length;i++){ const [px,py]=P[i], a=P[Math.max(0,i-1)], b=P[Math.min(P.length-1,i+1)], tl=Math.hypot(b[0]-a[0],b[1]-a[1])||1, nx=-(b[1]-a[1])/tl, ny=(b[0]-a[0])/tl, hw=Math.max(tp.hs(S[i],1),tp.hs(S[i],-1));
      for(let ty=Math.floor(py-hw-2);ty<=py+hw+2;ty++) for(let tx=Math.floor(px-hw-2);tx<=px+hw+2;tx++){ if(!inb(tx,ty)) continue; const k=idx(tx,ty), lat=(tx+0.5-px)*nx+(ty+0.5-py)*ny, lon=(tx+0.5-px)*(ny)-(ty+0.5-py)*nx; if(Math.abs(lon)>0.6) continue; const hh=tp.hs(S[i],lat>0?1:-1), d=Math.abs(lat)-hh+hw;
        if(world.roadH[k]!==-1||world.roadV[k]!==-1) continue;
        if(d<=hw+0.05){ if(G[k]===T.WATER||water[k]||G[k]===T.BLDG) continue; world.under[k]=G[k]===T.WALK?T.GRASS:G[k]; G[k]=T.ROAD; world.roadH[k]=-3; world.roadV[k]=-3; }
        else if(G[k]===T.WALK && S[i]<1.5 && d<=hw+1.6){ G[k]=T.GRASS; } } }
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const back=[P[0][0]-dW[0]*20,P[0][1]-dW[1]*20];
    for(const q of [...P,back]){ x0=Math.min(x0,q[0]); y0=Math.min(y0,q[1]); x1=Math.max(x1,q[0]); y1=Math.max(y1,q[1]); }
    const m=wW/2+3; world.objects.push({kind:'taper',tp,x:(x0-m)*TILE,y:(y0-m)*TILE,w:(x1-x0+2*m)*TILE,h:(y1-y0+2*m)*TILE}); return tp; }
  const URB=t=>t==='city'||t==='town'||t==='res';
  for(const cv of world.curves) for(const [E,k] of [[cv.A,'A'],[cv.B,'B']]){ if(!E) continue; const W=world.segs[E.seg]; if(W.w<=cv.w) continue;
    const path=k==='A'?cv.pts:cv.pts.slice().reverse(); const tp=taper(W,E.end,cv.w,path,URB(W.type),cv.id); if(tp) (cv.tap=cv.tap||{})[k]=tp; }
  for(const a of world.segs){ if(a.link1===undefined) continue; const b=world.segs[a.link1]; if(a.w===b.w) continue;
    const [W,N,end]=a.w>b.w?[a,b,1]:[b,a,0]; const d=end?1:-1, c=N.a+N.w/2, J=end?W.b1+1:W.b0, path=[];
    const len=end?(N.b1+1-J):(J-N.b0); for(let t=0;t<=len;t+=0.5){ const al=J+d*t; path.push(W.dir==='h'?[al,c]:[c,al]); }
    const cr=end?N.cv1:N.cv0; if(cr&&len<TPL+1){ const cv=world.curves[cr.cv]; const cp=cr.start?cv.pts:cv.pts.slice().reverse(); for(let i=1;i<cp.length;i++){ const a=cp[i-1], b=cp[i], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, dd=W.dir==='h'?[d,0]:[0,d]; if(((b[0]-a[0])*dd[0]+(b[1]-a[1])*dd[1])/l<0.94) break; path.push(b); } }
    const off=((W.a+W.w/2)-c)*(W.dir==='h'?d:-d);
    const tp=taper(W,end,N.w,path,URB(W.type),null,off); if(tp) (W.tap=W.tap||{})[end]=tp; }
  (world.tm=world.tm||[]).push(['// ---------------- ',performance.now()-t0|0]);
  // ---------------- junctions & lorry-friendly kerb radii ----------------
  const reserved=new Uint8Array(MW*MH); world.reserved=reserved; world.jMask=new Uint8Array(MW*MH); world.cornerAt=new Int32Array(MW*MH).fill(-1);
  const S=world.segs;
  for(const hs of S){ if(hs.dir!=='h') continue; for(const vs of S){ if(vs.dir!=='v') continue;
    if(vs.a+vs.w-1<hs.b0-1||vs.a>hs.b1+1||hs.a+hs.w-1<vs.b0-1||hs.a>vs.b1+1) continue;
    { // v24: a stub that merely abuts a road another in-line street of the same width already crosses would make a duplicate junction
      const ov=(lo,hi,a0,a1)=>!(hi<a0||lo>a1), same=(q,sg)=>q>=0&&q!==sg.id&&S[q].a===sg.a&&S[q].w===sg.w;
      if(!ov(vs.b0,vs.b1,hs.a,hs.a+hs.w-1)&&same(world.roadV[idx(vs.a,hs.a)],vs)) continue;
      if(!ov(hs.b0,hs.b1,vs.a,vs.a+vs.w-1)&&same(world.roadH[idx(vs.a,hs.a)],hs)) continue; }
    const jx=vs.a, jy=hs.a, jw=vs.w, jh=hs.w;
    { let rbT=false; for(let y=jy;y<jy+jh&&!rbT;y++) for(let x=jx-1;x<=jx+jw;x++) if(inb(x,y)&&(world.roadH[idx(x,y)]===-2||world.roadV[idx(x,y)]===-2)){ rbT=true; break; } if(rbT&&(hs.type==='dual'||vs.type==='dual')) continue; }   // v24: street meeting a dual right at its roundabout is a roundabout arm, not a second junction
    const kr= (hs.type==='res'||vs.type==='res'||hs.type==='lane'||vs.type==='lane')?2 : (hs.type==='rural'||vs.type==='rural')?3 : (hs.type==='town'||vs.type==='town')?5 : 6;
    const LT=t=>t==='city'||t==='town'||t==='hwy'||t==='dual', lights = LT(hs.type)&&LT(vs.type)&&(hs.type!=='hwy'||vs.type!=='dual')&&(vs.type!=='hwy'||hs.type!=='dual') || (jx>=1385&&jy>=1370&&hs.type!=='hwy'&&vs.type!=='hwy'&&(LT(hs.type)||LT(vs.type)));   // v24: every Kingsbridge junction is signalised
    const J={id:world.junctions.length,x:jx,y:jy,w:jw,h:jh,hs:hs.id,vs:vs.id,phase:hash2(jx,jy)*16,corners:[],lights,occ:[]};
    for(const [px,py,dx,dy] of [[jx,jy,-1,-1],[jx+jw,jy,1,-1],[jx,jy+jh,-1,1],[jx+jw,jy+jh,1,1]]){
      const tA=get(px+(dx<0?-1:0),py+(dy<0?-1:0)); if(tA===T.ROAD||tA===T.BRIDGE||tA===T.WATER) continue;
      // v9: only round a corner when BOTH arms that meet there actually exist (T-junctions keep a straight kerb on the closed side)
      { const isR=t=>t===T.ROAD||t===T.BRIDGE; const armH=isR(get(dx<0?jx-1:jx+jw, jy+(jh>>1))), armV=isR(get(jx+(jw>>1), dy<0?jy-1:jy+jh)); if(!armH||!armV) continue; }
      const tB=get(px+(dx<0?-1:0)+dx*kr,py+(dy<0?-1:0)); const tC=get(px+(dx<0?-1:0),py+(dy<0?-1:0)+dy*kr);
      if(tB===T.WATER||tC===T.WATER) continue;
      const c={px,py,dx,dy,cx:px+dx*kr,cy:py+dy*kr,R:kr}; const ci=world.corners.length; world.corners.push(c); J.corners.push(c);
      const ext=kr>2?1:0;
      for(let k=0;k<kr+ext;k++) for(let q=0;q<kr+ext;q++){ const tx=px+(dx<0?-1-k:k), ty=py+(dy<0?-1-q:q); if(inb(tx,ty)){ reserved[idx(tx,ty)]=1; if(k<kr&&q<kr) world.cornerAt[idx(tx,ty)]=ci; } }
    }
    for(let y=jy;y<jy+jh;y++) for(let x=jx;x<jx+jw;x++) if(inb(x,y)) world.jMask[idx(x,y)]=1;
    world.junctions.push(J); hs.js.push(J); vs.js.push(J);
  } }
  for(const rb of world.rbs){ for(const sg of S){
    const ends= sg.dir==='h' ? [[sg.b0,sg.a+sg.w/2,-1],[sg.b1+1,sg.a+sg.w/2,1]] : [[sg.a+sg.w/2,sg.b0,-1],[sg.a+sg.w/2,sg.b1+1,1]];
    for(const [ex,ey,side] of ends){ const d=Math.hypot(ex-rb.cx,ey-rb.cy); if(d<rb.rout+2.5){ rb.arms.push({seg:sg.id,side,ang:Math.atan2(ey-rb.cy,ex-rb.cx)}); sg['rb'+(side<0?0:1)]=rb.id; } } } }
  for(const sg of S) sg.js.sort((a,b)=> sg.dir==='h'? a.x-b.x : a.y-b.y);
  (world.tm=world.tm||[]).push(['// ---------------- ',performance.now()-t0|0]);
  // ---------------- buildings & landmarks ----------------
  const objs=world.objects;
  world.roadLock=true;
  const fillNR=(x0,y0,w,h,t)=>{ for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++){ if(!inb(x,y)) continue; const i=idx(x,y); if(world.roadH[i]!==-1||world.roadV[i]!==-1) continue; set(x,y,t); } };   // v24: parks/plazas never paint over a road
  function building(x,y,w,h,style,height,extra){
    const hit=(x,y,w,h)=>{ for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) if(!inb(i,j)||reserved[idx(i,j)]||world.roadH[idx(i,j)]!==-1||world.roadV[idx(i,j)]!==-1||G[idx(i,j)]===T.ROAD||G[idx(i,j)]===T.WATER) return true; return false; };
    let guard=0; while(hit(x,y,w,h) && guard++<14){ if(hit(x,y,1,h)&&w>3){ x++; w--; } else if(hit(x+w-1,y,1,h)&&w>3){ w--; } else if(hit(x,y,w,1)&&h>3){ y++; h--; } else if(hit(x,y+h-1,w,1)&&h>3){ h--; } else break; }
    if(hit(x,y,w,h)||w<2||h<2) return null;
    fill(x,y,w,h,T.BLDG); const o=Object.assign({kind:'bldg',x:x*TILE,y:y*TILE,w:w*TILE,h:h*TILE,style,height,seed:(R()*1e9)|0},extra||{}); objs.push(o); return o;
  }
  function tree(px,py,r,solid=true,sp=0){ const tx=Math.floor(px/TILE),ty=Math.floor(py/TILE); if(reserved[idx(tx,ty)]) return; objs.push({kind:'tree',x:px,y:py,r,sp,seed:(R()*1e9)|0}); if(solid) set(tx,ty,T.TREE); }
  function lot(x,y,w,h){ fill(x,y,w,h,T.LOT); objs.push({kind:'lot',x:x*TILE,y:y*TILE,w:w*TILE,h:h*TILE,seed:(R()*1e9)|0}); }
  function park(x,y,w,h){
    fillNR(x,y,w,h,T.PGRASS); const mx=x+(w>>1), my=y+(h>>1); fillNR(x,my,w,1,T.PLAZA); fillNR(mx,y,1,h,T.PLAZA);
    if(w>=10&&h>=10&&R()<0.6){ const pw=(w>>1)-3, ph=(h>>1)-3; objs.push({kind:'pond',x:(x+2)*TILE,y:(y+2)*TILE,w:pw*TILE,h:ph*TILE}); fill(x+2,y+2,pw,ph,T.WATER); }
    objs.push({kind:'fountain',x:(mx+0.5)*TILE,y:(my+0.5)*TILE});
    for(let i=0;i<w*h*0.2;i++){ const tx=x+((R()*w)|0), ty=y+((R()*h)|0); if(G[idx(tx,ty)]===T.PGRASS && !reserved[idx(tx,ty)]) tree((tx+0.5)*TILE+(R()-0.5)*10,(ty+0.5)*TILE+(R()-0.5)*10,10+R()*8); }
  }
  // street-facing frontage helper: which sides of a rect touch a sidewalk
  function frontSide(x,y,w,h){ if(get(x+(w>>1),y-1)===T.WALK) return 'n'; if(get(x+(w>>1),y+h)===T.WALK) return 's'; if(get(x-1,y+(h>>1))===T.WALK) return 'w'; if(get(x+w,y+(h>>1))===T.WALK) return 'e'; return null; }
  function splitBuildings(x0,y0,w,h,styles,hmin,hvar,shopChance){
    const out=[]; (function sp(x,y,w,h,d){ if(d>3 || (w<7&&h<7) || (d>1&&R()<0.25)){ out.push([x,y,w,h]); return; }
      if(w>=h){ const c=3+((R()*(w-6))|0); if(w-c<3){out.push([x,y,w,h]);return;} sp(x,y,c,h,d+1); sp(x+c,y,w-c,h,d+1); }
      else { const c=3+((R()*(h-6))|0); if(h-c<3){out.push([x,y,w,h]);return;} sp(x,y,w,c,d+1); sp(x,y+c,w,h-c,d+1); } })(x0,y0,w,h,0);
    for(const [x,y,bw,bh] of out){
      fill(x,y,bw,bh,T.PLAZA);
      if(bw>=3&&bh>=3){ const st=styles[(R()*styles.length)|0]; const fs=frontSide(x,y,bw,bh);
        const shop = fs && R()<shopChance;
        const o=building(x+(shop&&fs==='n'?1:0),y+(shop&&fs==='w'?1:0),bw-(shop&&(fs==='e'||fs==='w')?1:0),bh-(shop&&(fs==='n'||fs==='s')?1:0),shop?'shop':st,hmin+R()*hvar);
        if(o&&shop){ o.front=fs; o.sign=SHOPS[(R()*SHOPS.length)|0]; o.awning=['#c0392b','#27ae60','#2471a3','#d68910','#7d3c98'][(R()*5)|0]; objs.push({kind:'awning',b:o,x:o.x-TILE,y:o.y-TILE,w:o.w+2*TILE,h:o.h+2*TILE}); }
      } else if(R()<0.5) tree((x+bw/2)*TILE,(y+bh/2)*TILE,9+R()*4);
    }
  }
  // ---- Port Albion blocks (start depot, fuel, stadium, hospital, downtown towers)
  const cxs=C1.xs, cys=C1.ys; const downtown=(bx,by)=>Math.hypot(bx-300,by-290)<90;
  for(let i=0;i<cxs.length-1;i++) for(let j=0;j<cys.length-1;j++){
    const x0=cxs[i]+RW+1, y0=cys[j]+RW+1, w=cxs[i+1]-x0-1, h=cys[j+1]-y0-1;
    const dt=downtown(x0+11,y0+11); const r=R();
    if(i===1&&j===1){ fill(x0,y0,w,h,T.CONC); building(x0+5,y0,w-10,6,'depot',34);
      world.startDepot={x0,y0,w,h}; world.flags.push({x:(x0+3)*TILE,y:(y0+1)*TILE,col:'#f5b82e'});
      objs.push({kind:'paint',x:(x0+7)*TILE,y:(y0+10)*TILE,text:'DEPOT'}); world.start={x:(x0+9)*TILE,y:(y0+15)*TILE,h:Math.PI/2}; continue; }
    if(i===4&&j===2){ fill(x0,y0,w,h,T.CONC); building(x0+11,y0+6,6,5,'shop',18,{sign:'FUEL & SHOP'});
      world.cityFuel={x0,y0,w,h}; for(let k=0;k<3;k++){ set(x0+6+k*2,y0+10,T.PUMP); objs.push({kind:'pump',x:(x0+6+k*2)*TILE,y:(y0+10)*TILE}); }
      world.overhead.push({kind:'canopy',x:(x0+4.5)*TILE,y:(y0+8.5)*TILE,w:7*TILE,h:4*TILE}); lot(x0+6,y0+14,10,4); continue; }
    if(i===7&&j===7){ stadium(x0,y0,w,h); continue; }
    if(i===0&&j===4){ fill(x0,y0,w,h,T.PLAZA); building(x0+4,y0+4,w-8,h-8,'hospital',45); lot(x0+5,y0+h-4,w-10,3); continue; }
    if(i===3&&j===0){ fill(x0,y0,w,h,T.PLAZA); building(x0+4,y0+3,w-8,h-6,'carpark',26); continue; }
    if((!dt && r<0.14) || (i===5&&j===7)){ park(x0,y0,w,h); continue; }
    if(r<0.24){ lot(x0+5,y0,w-10,h>>1); splitBuildings(x0,y0+(h>>1),w,h-(h>>1),['office','brick','gravel'],18,30,0.5); continue; }
    if(dt && r<0.45){ fill(x0,y0,w,h,T.PLAZA); const b=building(x0+4,y0+4,w-8,h-8,'tower',100+R()*60); if(b) world.beacons.push({x:b.x+12,y:b.y+12,col:'#ff3030',ph:R()*6});
      for(const [tx,ty] of [[x0+6,y0+1],[x0+w-7,y0+1],[x0+6,y0+h-2],[x0+w-7,y0+h-2]]) tree((tx+0.5)*TILE,(ty+0.5)*TILE,11); continue; }
    splitBuildings(x0,y0,w,h, dt?['office','glass','gravel','tower','office','solar']:['gravel','brick','office','flat','brick','green'], dt?40:16, dt?70:26, dt?0.35:0.55);
  }
  function stadium(x0,y0,w,h){ fill(x0,y0,w,h,T.PLAZA); const b=building(x0+2,y0+2,w-4,h-4,'stadium',30); if(b){ for(const [fx,fy] of [[b.x+10,b.y+10],[b.x+b.w-10,b.y+10],[b.x+10,b.y+b.h-10],[b.x+b.w-10,b.y+b.h-10]]) world.flags.push({x:fx,y:fy,col:['#c0392b','#2e5c9a','#f1c40f','#27ae60'][world.flags.length%4]}); } }
  function townBlocks(xs,ys,mode,skip){ const dtm0=mode==='dt'; if(dtm0) mode='city';
    for(let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++){ if(skip===i+','+j) continue;
      const x0=xs[i]+RW+1, y0=ys[j]+RW+1, w=xs[i+1]-x0-1, h=ys[j+1]-y0-1; if(w<4||h<4) continue; const r=R();
      if(mode==='res'){ fillNR(x0,y0,w,h,T.PGRASS); for(let hx=x0;hx+4<=x0+w;hx+=5) for(const top of [true,false]){ const hh=3+(R()<0.5?1:0), yy=top?y0:y0+h-hh; if(R()<0.85){ const b=building(hx,yy,4,hh,'house',12+R()*6); if(b){ const gy=top?yy+hh+1.2:yy-1.2; if(R()<0.6) objs.push({kind:'tree',x:(hx+1+R()*2)*TILE,y:gy*TILE,r:8+R()*5,sp:(R()*3)|0,seed:(R()*1e9)|0}); if(R()<0.5) objs.push({kind:'hedge',x:(hx+3.6)*TILE,y:(top?yy+hh+0.5:yy-0.5)*TILE,seed:(R()*1e9)|0}); } if(b&&R()<0.9) objs.push({kind:'drive',x:(hx+0.3)*TILE,y:(top?yy+hh:yy-1)*TILE,seed:(R()*1e9)|0,top}); } } continue; }
      const dtm=dtm0; const centre= dtm || (mode==='city' && i>=2&&i<=3&&j>=1&&j<=3);
      if(r<(dtm?0.05:0.1)){ park(x0,y0,w,h); continue; }
      if(r<0.18){ lot(x0+3,y0+2,w-6,h>>1); splitBuildings(x0,y0+(h>>1)+2,w,h-(h>>1)-2,['brick','office'],14,24,0.6); continue; }
      if(centre && r<0.5){ fill(x0,y0,w,h,T.PLAZA); building(x0+3,y0+3,w-6,h-6,r<0.3?'tower':'glass',80+R()*60); continue; }
      splitBuildings(x0,y0,w,h, mode==='city'?(centre?['office','glass','tower','solar']:['office','brick','gravel','flat']):['brick','house','gravel','flat','brick'], mode==='city'?30:12, mode==='city'?60:22, 0.6);
    } }
  // other cities: stadium + downtown towers via townBlocks; mark a stadium block first
  function cityFill(g,si,sj){ const x0=g.xs[si]+RW+1, y0=g.ys[sj]+RW+1, w=g.xs[si+1]-x0-1, h=g.ys[sj+1]-y0-1; stadium(x0,y0,w,h); g.skip=si+','+sj; townBlocks(g.xs,g.ys,'city',g.skip); }
  cityFill(SV,9,8); townBlocks(KB.xs,KB.ys,'dt'); const dense=(xs,ys,st,h0,h1)=>{ for(let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++){ const x0=xs[i]+RW+1,y0=ys[j]+RW+1,x1=xs[i+1]-1,y1=ys[j+1]-1;
  for(let y=y0;y+4<=y1;y+=5) for(let x=x0;x+4<=x1;x+=5){ const w=Math.min(4+(R()<0.4?1:0),x1-x),h=Math.min(4+(R()<0.4?1:0),y1-y); let ok=true; for(let q=-1;q<=h&&ok;q++) for(let k=-1;k<=w;k++){ if(!inb(x+k,y+q)){ok=false;break;} const t=G[idx(x+k,y+q)]; const edge=q<0||k<0||q===h||k===w; if(t===T.BLDG&&!edge||t===T.ROAD&&!edge||t===T.WATER||t===T.BRIDGE||t===T.BLDG){ok=false;break;} }
    if(ok){ fill(x,y,w,h,T.BLDG); objs.push({kind:'bldg',x:x*TILE,y:y*TILE,w:w*TILE,h:h*TILE,style:st[(R()*st.length)|0],height:h0+R()*(h1-h0),seed:(R()*1e9)|0}); } else if(R()<0.55){ const t=get(x+2,y+2); if(t===T.PLAZA||t===T.SAND||t===T.CONC) tree((x+2.5)*TILE,(y+2.5)*TILE,10+R()*4); } } } };
dense(KB.xs,KB.ys,['office','glass','tower','solar','office','glass'],45,140);
  const greenUp=(xs,ys)=>{ const free=(x,y,w,h)=>{ for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++){ if(!inb(i,j)) return false; const t=G[idx(i,j)]; if(t!==T.PLAZA&&t!==T.SAND&&t!==T.GRASS) return false; } return true; };
    for(let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++){ const x0=xs[i]+RW+1,y0=ys[j]+RW+1,x1=xs[i+1]-1,y1=ys[j+1]-1;
      for(let y=y0;y+4<=y1;y+=4) for(let x=x0;x+4<=x1;x+=4){ if(!free(x,y,4,4)) continue; fillNR(x,y,4,4,T.PGRASS); const k=R();
        if(k<0.3){ fill(x,y+1,4,1,T.PLAZA); fill(x+1,y,1,4,T.PLAZA); objs.push({kind:'fountain',x:(x+1.5)*TILE,y:(y+1.5)*TILE}); }
        for(const [a,b] of [[0.6,0.6],[3.4,0.6],[0.6,3.4],[3.4,3.4]]) if(R()<0.85) objs.push({kind:'tree',x:(x+a)*TILE,y:(y+b)*TILE,r:9+R()*5,sp:(R()*3)|0,seed:(R()*1e9)|0}); } } };
  greenUp(KB.xs,KB.ys);
  const denseRect=(X0,Y0,X1,Y1,st,h0,h1)=>{ const placed=[]; const OK={[T.GRASS]:1,[T.PLAZA]:1,[T.SAND]:1,[T.PGRASS]:1,[T.TREE]:1}; for(let y=Y0;y+4<=Y1;y+=5) for(let x=X0;x+4<=X1;x+=5){ const w=4+(R()<0.4?1:0),h=4+(R()<0.4?1:0); let ok=true;
      for(let q=-1;q<=h&&ok;q++) for(let k=-1;k<=w;k++){ if(!inb(x+k,y+q)){ok=false;break;} const t=G[idx(x+k,y+q)], e=q<0||k<0||q===h||k===w; if(!(OK[t]||(e&&(t===T.ROAD||t===T.WALK)))||(!e&&reserved[idx(x+k,y+q)])){ok=false;break;} }
      if(ok&&R()<0.85){ fill(x,y,w,h,T.BLDG); objs.push({kind:'bldg',x:x*TILE,y:y*TILE,w:w*TILE,h:h*TILE,style:st[(R()*st.length)|0],height:h0+R()*(h1-h0),seed:(R()*1e9)|0}); placed.push([x*TILE-20,y*TILE-20,(x+w)*TILE+20,(y+h)*TILE+20]); } }
    for(const o of objs) if(o.kind==='tree'&&!o._dead) for(const b of placed) if(o.x>b[0]&&o.x<b[2]&&o.y>b[1]&&o.y<b[3]){ o._dead=1; break; } };
  if(world.abRing){ const A=world.abRing; greenUp(C1.xs,C1.ys); denseRect(A.X0+RW+1,A.Y0+RW+1,A.X1-1,C1.ys[0]-2,['brick','flat','office','shop','gravel'],18,45); denseRect(A.X0+RW+1,C1.Y1+2,A.X1-1,A.Y1-1,['brick','flat','office','shop','warehouse'],16,40);
    denseRect(A.X0+RW+1,C1.ys[0]-1,C1.xs[0]-2,C1.Y1+1,['brick','flat','shop','office'],16,40); denseRect(C1.X1+2,C1.ys[0]-1,A.X1-1,C1.Y1+1,['warehouse','brick','office','shop'],16,40); }
for(const o of objs) if(o.kind==='bldg'&&o.x>=KB.xs[0]*TILE&&o.x<KB.X1*TILE&&o.y>=KB.ys[0]*TILE&&o.y<KB.Y1*TILE) o.cyber=true; { const K=world.kbDistricts; cityFill(K.MK,2,1); for(const k of ['NG','CH','RS']) townBlocks(K[k].xs,K[k].ys,'city'); for(const k of ['NG','CH','RS']) dense(K[k].xs,K[k].ys,['office','brick','flat','glass','gravel'],22,60); for(const k of ['NG','CH','RS']) greenUp(K[k].xs,K[k].ys); townBlocks(K.RM.xs,K.RM.ys,'town'); townBlocks(K.WM.xs,K.WM.ys,'res'); townBlocks(K.OH.xs,K.OH.ys,'town'); for(let k=0;k<3;k++) ind(1772+k*18,1736,15,22); for(let k=0;k<3;k++) ind(1772+k*18,1764,15,22); } { const SH=['FRESH FISH','CHANDLERY','DOCK CAFE','TOOLS','MARINE','PARTS','KEBAB','BAIT & TACKLE']; let n=0;   // Portside shops + warehouses
  for(let y=1780;y+6<=1862;y+=7) for(let x=1690;x+7<=1850;x+=8){ let ok=true; for(let q=-1;q<=6&&ok;q++) for(let k=-1;k<=7;k++){ const t=get(x+k,y+q); if(t!==T.GRASS&&t!==T.PGRASS&&t!==T.SAND&&t!==T.CONC&&t!==T.WALK&&t!==T.PLAZA){ ok=false; break; } }
    if(ok){ const wh=R()<0.5, w=wh?7:5, h=wh?6:4; fill(x,y,w,h,T.BLDG); objs.push(Object.assign({kind:'bldg',x:x*TILE,y:y*TILE,w:w*TILE,h:h*TILE,style:wh?'warehouse':'shop',height:wh?16+R()*8:9+R()*5,seed:(R()*1e9)|0},wh?{logo:COMPANIES[(R()*COMPANIES.length)|0]}:{sign:SH[(n++)%SH.length]})); } } }
  for(const g of [MF,DW,CM,RH,FW]) townBlocks(g.xs,g.ys,'town'); townBlocks(AB.xs,AB.ys,'res');
  for(let k=0;k<6;k++) building(505+k*6,906,4,4,'house',12);  building(490,906,6,4,'church',22);        // Wendwood hamlet
  for(let k=0;k<4;k++) building(MTN.x-12+k*6,1592,4,3,'house',10);                                      // summit cafe & viewpoint
  // industry
  function ind(x0,y0,w,h){
    fill(x0,y0,w,h,T.CONC); const r=R();
    if(r<0.45){ const b=building(x0+1,y0+1,w-2,Math.max(3,h-6),'warehouse',28+R()*10,{logo:COMPANIES[(R()*COMPANIES.length)|0]}); lot(x0+2,y0+h-4,w-4,3); if(b&&R()<0.6) world.smokers.push({x:b.x+b.w*0.8,y:b.y+20,s:1.4}); }
    else if(r<0.7){ for(let ty=y0+1;ty+3<=y0+h;ty+=4) for(let tx=x0+1;tx+3<=x0+w;tx+=4){ if(reserved[idx(tx,ty)]||reserved[idx(tx+2,ty+2)]) continue; fill(tx,ty,3,3,T.TANK); objs.push({kind:'tank',x:(tx+1.5)*TILE,y:(ty+1.5)*TILE,r:1.4*TILE,seed:(R()*1e9)|0}); } world.smokers.push({x:(x0+w/2)*TILE,y:(y0+2)*TILE,s:2}); }
    else { building(x0+1,y0+1,Math.max(3,(w>>1)-1),h-2,'warehouse',30); fill(x0+(w>>1)+1,y0+1,w-(w>>1)-2,h-2,T.GRAVEL);
      for(let k=0;k<3;k++) objs.push({kind:'pallets',x:(x0+(w>>1)+2+k*2)*TILE,y:(y0+3)*TILE,seed:(R()*1e9)|0}); }
  }
  for(let k=0;k<4;k++) ind(1770+k*40,560,34,30);              // Sandvale east industry (south of grid)
  for(let k=0;k<3;k++) ind(1190+k*50,1395,44,24);             // Kingsbridge west industry (north of M3)
  for(let k=0;k<3;k++) ind(160+k*50,666,44,30);               // Albion south industry
  function docks(x0,y0,x1,y1){
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ const t=G[idx(x,y)]; if(t===T.GRASS||t===T.SAND||t===T.WALK) set(x,y,T.QUAY); }
    const cols=['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'];
    for(let y=y0+2;y<y1-2;y+=3) for(let x=x0+2;x<x1-8;x+=8){
      let ok=true; for(let k=0;k<7;k++) for(let q=0;q<2;q++){ const t=get(x+k,y+q); if(t!==T.QUAY||reserved[idx(x+k,y+q)]) ok=false; }
      if(!ok||R()<0.25) continue;
      fill(x,y,6,2,T.CONT); objs.push({kind:'cont',x:x*TILE,y:y*TILE,w:6*TILE,h:2*TILE,c1:cols[(R()*8)|0],c2:cols[(R()*8)|0],c3:cols[(R()*8)|0],seed:(R()*1e9)|0}); }
  }
  { // v14 Albion container terminal: quay apron + 3 berths, neat stack rows between the aisles, gate, loading-bay terminal
    const P=world.port; for(let y=P.y0;y<P.y1;y++) for(let x=P.x0;x<P.edge;x++){ const t=G[idx(x,y)]; if(t===T.GRASS||t===T.SAND||t===T.WALK||t===T.PGRASS||t===T.TREE) set(x,y,T.QUAY); }
    const cols=['#c0392b','#2e86c1','#e67e22','#27ae60','#8e44ad','#d4ac0d','#7f8c8d','#16a085'], H=P.hole, A=P.aisles;
    const inHole=(x,y)=>x+6>H.x-1&&x<H.x+H.w+1&&y+2>H.y-2&&y<H.y+H.h+1;
    for(let i=0;i<A.length-1;i++){ for(let y=A[i]+RW+2;y+2<=A[i+1]-2;y+=3) for(let x=P.x0+4;x+6<=580;x+=8){ if(inHole(x,y)) continue; let ok=true; for(let k=0;k<6;k++) for(let q=0;q<2;q++) if(get(x+k,y+q)!==T.QUAY) ok=false; if(!ok) continue;
      fill(x,y,6,2,T.CONT); objs.push({kind:'cont',x:x*TILE,y:y*TILE,w:6*TILE,h:2*TILE,c1:cols[(R()*8)|0],c2:cols[(R()*8)|0],c3:cols[(R()*8)|0],seed:(R()*1e9)|0}); } }
    for(let y=A[4]+RW+2;y+2<=P.y1-2;y+=3) for(let x=P.x0+4;x+6<=580;x+=8){ let ok=true; for(let k=0;k<6;k++) for(let q=0;q<2;q++) if(get(x+k,y+q)!==T.QUAY) ok=false; if(ok){ fill(x,y,6,2,T.CONT); objs.push({kind:'cont',x:x*TILE,y:y*TILE,w:6*TILE,h:2*TILE,c1:cols[(R()*8)|0],c2:cols[(R()*8)|0],c3:cols[(R()*8)|0],seed:(R()*1e9)|0}); } }
    for(let y=A[0]-10;y<A[0]-2;y++) for(let x=P.x0+4;x<580;x++) if(get(x,y)===T.QUAY){} 
    building(P.x0+6,P.y0+2,14,A[0]-P.y0-5,'warehouse',24,{logo:'ALBION PORT'});
    objs.push({kind:'paint',x:(P.x0+1)*TILE,y:(A[2]-3)*TILE,text:'PORT GATE',small:true});
    world.port.berths=[0,1,2].map(i=>{ const L=(P.y1-P.y0)/3; return {i,y0:P.y0+i*L,y1:P.y0+(i+1)*L,ship:null}; });
    world.port.cranes=[0,1,2,3].map(i=>({i,y:P.y0+18+i*(P.y1-P.y0-36)/3,ty:0,tr:0.5,ph:0,car:null}));
  }
  docks(1540,1846,1750,1884);
  { // v18 Kingsbridge container quay (faces south onto the harbour): local u = towards the water, v = along the quay (east)
    const L=(1745-1552)/3; world.kbPort={O:[0,1885],U:[0,1],V:[1,0],vIn:1436,vOut:1800,dep:'KHT',legL:-9,asg:[0,1,2],off:[0,0,0],qy0:1548,qy1:1748,
      berths:[0,1,2].map(i=>({i,y0:1552+i*L,y1:1552+(i+1)*L,ship:null})), cranes:[0,1,2].map(i=>({i,y:1552+L*(i+0.5),ty:0,tr:0.5,ph:0,car:null}))}; }
  // airports: concrete apron, runways, terminal, hangars
  function airport(name,x0,y0,x1,y1,rws,term){ for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ const t=G[idx(x,y)]; if(t!==T.ROAD&&t!==T.WATER&&t!==T.BRIDGE&&t!==T.WALK) set(x,y,T.CONC); }
    const ap={name,rw:[]}; for(const [rx,ry,rw] of rws){ objs.push({kind:'runway',x:rx*TILE,y:ry*TILE,w:rw*TILE,h:12*TILE}); ap.rw.push({x:rx*TILE,y:(ry+6)*TILE,len:rw*TILE}); for(let k=0;k<rw;k+=10) world.beacons.push({x:(rx+k)*TILE,y:(ry-0.5)*TILE,col:'#ffd23f',ph:k*0.05,run:1}); }
    const [tx,ty,tw]=term; building(tx,ty,tw,10,'warehouse',30,{logo:name.toUpperCase()}); for(let k=0;k<3;k++) building(tx+tw+4+k*24,ty,20,12,'warehouse',24);
    world.flags.push({x:tx*TILE-20,y:ty*TILE,col:'#2471a3'}); world.airports.push(ap); }
  airport('Albion Airport',160,470,640,660,[[190,488,400],[190,620,400]],[220,520,60]);
  airport('Sandvale Intl',1070,160,1445,340,[[1090,180,330],[1090,300,330]],[1110,215,80]);
  airport('Kingsbridge Field',1195,1792,1385,1905,[[1205,1860,175]],[1210,1812,40]);
  if(world.quarry){ const {x,y}=world.quarry; for(let j=y-10;j<y+12;j++) for(let i=x;i<x+26;i++){ const t=get(i,j); if(t!==T.ROAD&&t!==T.WATER&&t!==T.BRIDGE) set(i,j,T.GRAVEL); }
    for(let k=0;k<14;k++) objs.push({kind:'rock',x:(x+3+R()*22)*TILE,y:(y-9+R()*20)*TILE,r:14+R()*24,seed:(R()*1e9)|0,desert:true}); building(x+18,y-9,6,4,'warehouse',16,{logo:'QUARRY'}); }
  if(world.dam){ const d=world.dam; objs.push({kind:'dam',x:d.x0*TILE,y:(d.y-1)*TILE,w:(d.x1-d.x0)*TILE,h:5*TILE,d}); }
  (world.tm=world.tm||[]).push(['// ---- farmland',performance.now()-t0|0]);
  // ---- farmland with hedgerows, pasture with livestock
  const crops=['wheat','green','plough','rape','pasture','wheat','pasture','green'];
  function farmland(x0,y0,x1,y1){
    for(let fy=y0;fy<y1;fy+=18+((R()*8)|0)){ for(let fx=x0;fx<x1;fx+=20+((R()*10)|0)){
      const fw=Math.min(18+((R()*8)|0),x1-fx), fh=Math.min(16,y1-fy); if(fw<6||fh<6) continue;
      if(forestD(fx+fw/2,fy+fh/2)>0.56) continue;
      let ok=true; for(let y=fy;y<fy+fh&&ok;y++) for(let x=fx;x<fx+fw;x++){ const t=get(x,y); if(t!==T.GRASS||reserved[idx(x,y)]){ ok=false; break; } }
      if(!ok) continue;
      if(R()<0.12){ fill(fx,fy,fw,fh,T.GRAVEL); building(fx+1,fy+1,6,4,'barn',16); const hb=building(fx+8,fy+1,4,4,'house',13); if(hb) world.smokers.push({x:hb.x+hb.w*0.7,y:hb.y+6,s:0.6});
        for(let k=0;k<2;k++){ fill(fx+2+k*3,fy+7,2,2,T.TANK); objs.push({kind:'silo',x:(fx+3+k*3)*TILE,y:(fy+8)*TILE,r:0.95*TILE}); }
        for(let k=0;k<5;k++) objs.push({kind:'bale',x:(fx+8+R()*(fw-10))*TILE,y:(fy+7+R()*(fh-9))*TILE}); continue; }
      const cr=crops[(R()*crops.length)|0]; fill(fx+1,fy+1,fw-2,fh-2,T.FIELD);
      const fo={kind:'field',x:(fx+1)*TILE,y:(fy+1)*TILE,w:(fw-2)*TILE,h:(fh-2)*TILE,crop:cr,vert:R()<0.5,seed:(R()*1e9)|0}; objs.push(fo);
      if(cr==='pasture'){ const sheep=R()<0.6, n=sheep?6+((R()*8)|0):3+((R()*4)|0); for(let k=0;k<n;k++) world.animals.push({kind:sheep?'sheep':'cow',x0:fo.x+20,y0:fo.y+20,x1:fo.x+fo.w-20,y1:fo.y+fo.h-20,x:fo.x+20+R()*(fo.w-40),y:fo.y+20+R()*(fo.h-40),h:R()*6.28,t:R()*5,c:R()}); }
      else if(cr==='wheat'||cr==='rape') world.crops=(world.crops||[]),world.crops.push(fo);
      for(let x=fx;x<fx+fw;x++){ if(R()<0.85) objs.push({kind:'hedge',x:(x+0.5)*TILE,y:(fy+0.5)*TILE,seed:(R()*1e9)|0}); }
      for(let y=fy;y<fy+fh;y++){ if(R()<0.85) objs.push({kind:'hedge',x:(fx+0.5)*TILE,y:(y+0.5)*TILE,seed:(R()*1e9)|0}); }
    } }
  }
  world.crops=[];
  farmland(110,680,600,960); farmland(110,1000,560,1250); farmland(450,1300,640,1900); farmland(700,1100,1350,1370); farmland(1250,950,1950,1420);
  farmland(700,1400,1350,1780); farmland(780,560,1000,850); farmland(110,1780,880,1930);
  for(let k=0;k<90;k++){ const tx=40+((R()*1960)|0), ty=40+((R()*1960)|0); const t=G[idx(tx,ty)]; if((t!==T.GRASS&&t!==T.SAND)||reserved[idx(tx,ty)]) continue; set(tx,ty,T.TANK); world.overhead.push({kind:'turbine',x:(tx+0.5)*TILE,y:(ty+0.5)*TILE,ph:R()*6}); }
  // ---- forests (varied species), roadside trees, bushes, rocks, desert scrub & cacti
  (world.tm=world.tm||[]).push(['const DES=world.des',performance.now()-t0|0]);
  const DES=world.des=new Uint8Array(MW*MH);
  const FD=world.fd=new Uint8Array(MW*MH);
  const nearRoad=(x,y,r)=>{ for(const [dx,dy] of [[r,0],[-r,0],[0,r],[0,-r]]){ const t=get(x+dx,y+dy); if(t===T.ROAD||t===T.BRIDGE) return true; } return false; };
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    const t=G[idx(x,y)]; if(reserved[idx(x,y)]) continue; const h=hash2(x,y);
    if(t===T.GRASS){ const fd=forestD(x,y); FD[idx(x,y)]=fd*255; const p=fd>0.6?0.3 : fd>0.54?0.14 : 0.015; const pine= y<500||fd>0.68||hash2(x+3,y)<0.2;
      if(h<p){ const sp= pine?1 : hash2(y,x+1)<0.12?2 : hash2(y+5,x)<0.08?3 : 0;
        tree((x+0.5)*TILE+(hash2(y,x)-0.5)*18,(y+0.5)*TILE+(hash2(x+7,y)-0.5)*18,(sp===1?9:sp===2?8:11)+hash2(x+3,y+9)*(fd>0.6?10:7),true,sp); }
      else if(h>0.985 && nearRoad(x,y,2)) tree((x+0.5)*TILE,(y+0.5)*TILE,10+hash2(x,y+3)*8,true,hash2(x,y+9)<0.3?3:0);
      else if(h>0.975&&h<0.983) objs.push({kind:'bush',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:5+hash2(x+2,y)*6,seed:(h*1e9)|0});
      else if(fd>0.5 && h>0.996) objs.push({kind:'rock',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:12+hash2(x+1,y)*18,seed:(h*1e9)|0}); }
    else if(t===T.ROCK){ if(h<0.05) objs.push({kind:'rock',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:10+hash2(x+1,y)*26,seed:(h*1e9)|0}); else if(h>0.96) tree((x+0.5)*TILE,(y+0.5)*TILE,8+hash2(x,y+1)*6,true,1); }
    else if(t===T.SAND && (DES[idx(x,y)]=isDesert(x,y)?1:0)){
      if(h<0.02) objs.push({kind:'scrub',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:6+hash2(x,y+5)*7,seed:(h*1e9)|0});
      else if(h>0.9965) objs.push({kind:'rock',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:12+hash2(x+1,y)*30,seed:(h*1e9)|0,desert:true});
      else if(h>0.993&&h<0.9945) objs.push({kind:'cactus',x:(x+0.5)*TILE,y:(y+0.5)*TILE,seed:(h*1e9)|0}); }
  }
  (world.tm=world.tm||[]).push(['// ---- boats',performance.now()-t0|0]);
  // ---- boats & ferries on the sea channels, river and harbours (ping-pong routes, tiles)
  const route=(f,a,b,st)=>{ const p=[]; for(let s=a;s<=b;s+=st) p.push(f(s)); return p; };
  const okW=p=>p.every(([x,y])=>get(Math.round(x),Math.round(y))===T.WATER||get(Math.round(x),Math.round(y))===T.BRIDGE);
  const routes=[[route(y=>[cW(y)-10,y],60,1980,12),'ferry'],[route(y=>[cW(y)+14,y],80,1960,12),'cargo'],[route(x=>[x,cE(x)+6],cW(880)+40,2030,12),'ferry'],[route(x=>[x,cE(x)-12],cW(880)+60,2030,12),'yacht'],
    [route(y=>[riverX(y),y],Math.floor(cE(1150))+40,2000,8),'barge'],[route(x=>[x,1910],1440,1780,10),'tug'],[route(x=>[x,1270+25*Math.sin(x/45)],400,720,8),'yacht'],
    [route(t=>[22+t,30+((t*7)%60)],0,1980,30),'yacht'],[route(t=>[2020,40+t],0,1960,30),'cargo'],[route(t=>[40+t,2025],0,1960,30),'ferry']];
  for(const [pts,kind] of routes){ const runs=[[]]; for(const p of pts){ const t=get(Math.round(p[0]),Math.round(p[1])); if(t===T.WATER||t===T.BRIDGE) runs[runs.length-1].push(p); else if(runs[runs.length-1].length) runs.push([]); } const P=runs.sort((a,b)=>b.length-a.length)[0]; if(P.length<4) continue;
    let L=0; const d=[0]; for(let i=1;i<P.length;i++){ L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); d.push(L); }
    const n=kind==='tug'?1:2+((R()*2)|0); for(let k=0;k<n;k++) world.boats.push({kind,pts:P.map(p=>[p[0]*TILE,p[1]*TILE]),d:d.map(v=>v*TILE),L:L*TILE,s:R()*L*TILE*2,v:(kind==='yacht'?5:kind==='ferry'?7:kind==='cargo'?4:3)*PPM,col:['#ecf0f1','#c0392b','#2c3e50','#f1c40f'][(R()*4)|0]}); }
  (world.tm=world.tm||[]).push(['world.genMs=',performance.now()-t0|0]);
  world.genMs=performance.now()-t0;
  // ---- kerb radii carving
  for(const c of world.corners){
    for(let k=0;k<c.R;k++) for(let q=0;q<c.R;q++){ const tx=c.px+(c.dx<0?-1-k:k), ty=c.py+(c.dy<0?-1-q:q); if(!inb(tx,ty)||G[idx(tx,ty)]===T.WATER) continue;
      const d=Math.hypot(tx+0.5-c.cx,ty+0.5-c.cy); if(d>c.R-0.15) set(tx,ty,T.ROAD); else if(SOLID[get(tx,ty)]) set(tx,ty,T.WALK); }
    objs.push({kind:'kerb',x:Math.min(c.px,c.cx)*TILE,y:Math.min(c.py,c.cy)*TILE,w:c.R*TILE,h:c.R*TILE,c});
  }
  // v9: American-style mast arms — one per approach, pole on the near-side (left, we drive on the left) pavement, arm spanning the inbound lanes, one head per lane
  for(const J of world.junctions) if(J.lights){ const C=[J.x+J.w/2,J.y+J.h/2]; const isR=t=>t===T.ROAD||t===T.BRIDGE;
    for(const f of [[0,-1],[0,1],[1,0],[-1,0]]){ const l=[f[1],-f[0]], e=f[0]?J.w/2:J.h/2, hw=f[0]?J.h/2:J.w/2, E=[C[0]-f[0]*e,C[1]-f[1]*e];
      if(!isR(get(Math.floor(E[0]+l[0]*hw*0.5-f[0]*3),Math.floor(E[1]+l[1]*hw*0.5-f[1]*3)))) continue;      // no arm on this side
      const off=0.55, kc=[E[0]+l[0]*hw,E[1]+l[1]*hw]; const c=J.corners.find(c=>Math.abs(c.px-kc[0])<0.01&&Math.abs(c.py-kc[1])<0.01);
      // pole on the pavement corner (inside the kerb radius, at the diagonal), arm straight from pole to the centre line just past the stop line
      const pLat=hw+0.9, pLon=off;   // v13: straight arm, perpendicular to traffic, pole on the near-side pavement just before the stop line
      const n=Math.max(1,Math.round(hw*M_T/3.6)), A=[E[0]-f[0]*off,E[1]-f[1]*off];
      world.overhead.push({kind:'mast',J,f,l,A,pLat,pLon,hw,n,ns:f[0]===0,x:A[0]*TILE,y:A[1]*TILE}); } }
  // v12: Golden-Gate-style suspension bridges on the long motorway sea crossings (other bridges keep girder / curved-viaduct styles)
  world.susp=[]; for(const sg of world.segs){ if(sg.type!=='hwy') continue; const c=sg.a+(sg.w>>1); let r0=-1;
    for(let u=sg.b0;u<=sg.b1+1;u++){ const t=u<=sg.b1?(sg.dir==='h'?get(u,c):get(c,u)):-1; if(t===T.BRIDGE){ if(r0<0) r0=u; } else if(r0>=0){ const L=u-r0;
        if(L>=40){ const S={sg,r0:r0-6,r1:u+6,dir:sg.dir,a:sg.a,w:sg.w}; S.L=S.r1-S.r0; S.t0=S.r0+S.L*0.2; S.t1=S.r1-S.L*0.2; world.susp.push(S);
          const P=(uu,v)=>sg.dir==='h'?[uu*TILE,v*TILE]:[v*TILE,uu*TILE];
          for(let p=S.r0;p<S.r1;p+=8){ const q=P(p+4,S.a+S.w/2); world.overhead.push({kind:'susp',S,p0:p,p1:Math.min(S.r1,p+8),x:q[0],y:q[1]}); }
          for(const tu of [S.t0,S.t1]){ const q=P(tu,S.a+S.w/2); world.overhead.unshift({kind:'stower',S,u:tu,x:q[0],y:q[1]}); } }
        r0=-1; } } }
  (world.tm=world.tm||[]).push(['if(typeof buildMarki',performance.now()-t0|0]);
  if(typeof buildMarkings==='function') buildMarkings(objs);
  (world.tm=world.tm||[]).push(['if(typeof buildDepot',performance.now()-t0|0]);
  if(typeof buildDepots==='function') buildDepots(objs,R);
  { const URB={[T.BLDG]:1,[T.PLAZA]:1,[T.PGRASS]:1,[T.LOT]:1,[T.PARK]:1}, D=[[1,0],[-1,0],[0,1],[0,-1]];   // street trees on the outer pavement edge + planted central reservations
    for(let y=2;y<MH-2;y++) for(let x=2;x<MW-2;x++){ const t=G[idx(x,y)];
      if(t===T.WALK){ for(const [dx,dy] of D){ if(G[idx(x+dx,y+dy)]!==T.ROAD||!URB[G[idx(x-dx,y-dy)]]) continue; const along=dx?y:x; if(along%4) break; const px=dy?1:0, py=dx?1:0;
          let ok=true; for(const s of [-2,-1,1,2]) if(G[idx(x+px*s,y+py*s)]!==T.WALK||G[idx(x+px*s+dx,y+py*s+dy)]!==T.ROAD) ok=false;
          if(ok) objs.push({kind:'tree',x:(x+0.5-dx*0.15)*TILE,y:(y+0.5-dy*0.15)*TILE,r:8+R()*3,sp:(R()*3)|0,seed:(R()*1e9)|0,street:1}); break; } }
      else if(t===T.ISLAND&&(x+y)%3===0){ const h=G[idx(x-1,y)]===T.ISLAND&&G[idx(x+1,y)]===T.ISLAND, v=G[idx(x,y-1)]===T.ISLAND&&G[idx(x,y+1)]===T.ISLAND; if(h!==v) objs.push(R()<0.5?{kind:'hedge',x:(x+0.5)*TILE,y:(y+0.5)*TILE,seed:(R()*1e9)|0}:{kind:'tree',x:(x+0.5)*TILE,y:(y+0.5)*TILE,r:7+R()*2,sp:(R()*3)|0,seed:(R()*1e9)|0}); } } }
  // v24: functional areas stay paved: no trees/parks/fountains/ponds/hedges inside depots, fuel, garages, dealers, malls, port
  { const FP=[], M=v=>v/M_T; const box=(x0,y0,x1,y1)=>FP.push([Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1)]);
    for(const d of world.depots||[]){ if(d.w!==undefined) box(d.x-1,d.y-1,d.x+d.w+1,d.y+d.h+1); const e=d.entrance; if(e) box(M(e.x)-4,M(e.y)-4,M(e.x)+4,M(e.y)+4); for(const b of d.bays||[]) box(M(b.kx)-5,M(b.ky)-5,M(b.kx)+5,M(b.ky)+5); }
    for(const f of world.fuel||[]){ if(f.v7) box(M(f.x0)-1,M(f.y0)-(f.gap||0)-1,M(f.x0)+27,M(f.y0)+21); else box(M(f.x)-10,M(f.y)-7,M(f.x)+10,M(f.y)+7); }
    for(const g of world.garages||[]) box(M(g.x)-12,M(g.y)-8,M(g.x)+12,M(g.y)+8);
    for(const d of world.dealers||[]) box(M(d.x)-14,M(d.y)-12,M(d.x)+14,M(d.y)+12);
    for(const m of world.malls||[]) if(m.tx!==undefined) box(m.tx-1,m.ty-1,m.tx+m.w+1,m.ty+m.h+1); else box(M(m.x)-16,M(m.y)-14,M(m.x)+16,M(m.y)+14);
    if(world.port) box(world.port.x0,world.port.y0,world.port.x1,world.port.y1);
    if(world.cityFuel){ const c=world.cityFuel; box(c.x0,c.y0,c.x0+c.w,c.y0+c.h); }
    world.funcFP=FP; const DEC={tree:1,fountain:1,pond:1,hedge:1};
    const inFP=(tx,ty)=>FP.some(b=>tx>=b[0]&&tx<=b[2]&&ty>=b[1]&&ty<=b[3]);
    for(const o of objs){ if(!DEC[o.kind]||o._dead) continue; const cx=(o.x+(o.w||0)/2)/TILE, cy=(o.y+(o.h||0)/2)/TILE; if(inFP(cx,cy)) o._dead=1; }
    for(const b of FP) for(let y=Math.floor(b[1]);y<=b[3];y++) for(let x=Math.floor(b[0]);x<=b[2];x++){ if(!inb(x,y)) continue; const t=G[idx(x,y)]; if(t===T.PGRASS||t===T.TREE||(t===T.WATER&&!world.port)||t===T.PARK) set(x,y,T.CONC); } }
  (world.tm=world.tm||[]).push(['world.labels=',performance.now()-t0|0]);
  world.labels=[['WESTMERE',330,1000,1],['THE SANDREACH',1200,450,1],['HIGHMOOR',1350,1250,1],['ALBION SOUND',cW(700),700,2],['SANDREACH STRAIT',1500,cE(1500),2],['GREYFELL INLET',560,1272,2],['OUTER SEA',1024,25,2],['OUTER SEA',1024,2028,2],
    ['PORT ALBION',300,290],['SANDVALE',1640,340],['KINGSBRIDGE',1580,1590],['Millford',300,830],['Dustwater',1035,455],['Coppermine',1635,625],['Redhill',1025,1195],['Fenwick',1535,1155],['Ashby',270,1130],['Wendwood',520,890],
    ['Mount Greyfell',MTN.x,MTN.y-40],['River Moor',riverX(1500)+30,1500],['Albion Airport',400,560],['Sandvale Intl',1260,250],['Kingsbridge Field',1290,1830],['Albion Port',540,PORT_Y0-6],['Kingsbridge Harbour',1600,1905],
    ['M1',1000,94],['M1',1951,1300],['M1',94,1500],['M1',1400,1951],['M2',900,1054],['M2',1600,714],['M3',906,1650],['Moor Reservoir',1172,1540,2],['Greyfell Pass',395,1740],['Sound Coast Road',690,600],['Quarry',1170,590]];
  (world.tm=world.tm||[]).push(['// spatial index',performance.now()-t0|0]);
  if(typeof railBuild==='function') railBuild(objs);
  // v25: keep every solid decoration (trees, bushes, rocks, hedges, cacti, scrub) >=3 m clear of any road surface or railway.
  // Exact-ish distance field (two-pass 8-neighbour Euclidean propagation) from every ROAD/BRIDGE tile (straights, diagonals,
  // curves, tapers, junctions, roundabouts) plus the rail polyline; then a sweep removes anything overlapping that clearance.
  { const N=MW*MH, NX=new Int16Array(N).fill(-1), NY=new Int16Array(N), D=new Float32Array(N).fill(1e9);
    const src=(x,y)=>{ if(!inb(x,y)) return; const i=idx(x,y); NX[i]=x; NY[i]=y; D[i]=0; };
    for(let i=0;i<N;i++){ const t=G[i]; if(t===T.ROAD||t===T.BRIDGE){ NX[i]=i%MW; NY[i]=(i/MW)|0; D[i]=0; } }
    // curve / taper centre-lines: every tile under the polyline's full width counts as road even where the tile grid kept another type
    const poly=(pts,hw)=>{ for(const [px,py] of pts) for(let ty=Math.floor(py-hw);ty<=py+hw;ty++) for(let tx=Math.floor(px-hw);tx<=px+hw;tx++) if(Math.hypot(tx+0.5-px,ty+0.5-py)<=hw+0.5) src(tx,ty); };
    for(const c of world.curves) poly(c.pts,c.w/2); for(const t of world.tapers||[]) poly(t.pts,t.wW/2);
    if(typeof RAIL!=='undefined'&&RAIL.X&&RAIL.L){ for(let s2=0;s2<RAIL.L;s2++){ const cx=RAIL.X[s2]/M_TILE, cy=RAIL.Y[s2]/M_TILE; for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) src(Math.floor(cx+ox*0.5),Math.floor(cy+oy*0.5)); } }
    const relax=(i,j)=>{ if(NX[j]<0) return; const x=i%MW,y=(i/MW)|0, dx=x-NX[j], dy=y-NY[j], d=dx*dx+dy*dy; if(d<D[i]){ D[i]=d; NX[i]=NX[j]; NY[i]=NY[j]; } };
    for(let y=0;y<MH;y++){ for(let x=0;x<MW;x++){ const i=idx(x,y); if(x>0) relax(i,i-1); if(y>0){ relax(i,i-MW); if(x>0) relax(i,i-MW-1); if(x<MW-1) relax(i,i-MW+1); } } for(let x=MW-2;x>=0;x--) relax(idx(x,y),idx(x,y)+1); }
    for(let y=MH-1;y>=0;y--){ for(let x=MW-1;x>=0;x--){ const i=idx(x,y); if(x<MW-1) relax(i,i+1); if(y<MH-1){ relax(i,i+MW); if(x<MW-1) relax(i,i+MW+1); if(x>0) relax(i,i+MW-1); } } for(let x=1;x<MW;x++) relax(idx(x,y),idx(x,y)-1); }
    // clearance in tiles from a point (tile units) to the nearest road/rail tile's square edge
    const clear=(px,py)=>{ const tx=Math.floor(px),ty=Math.floor(py); if(!inb(tx,ty)) return 0; const i=idx(tx,ty); if(NX[i]<0) return 1e9; const qx=NX[i],qy=NY[i];
      const ex=Math.max(qx-px,0,px-(qx+1)), ey=Math.max(qy-py,0,py-(qy+1)); return Math.max(0,Math.hypot(ex,ey)-0.35); };   // -0.35: slack for the neighbour approximation
    const MARGIN=3/M_TILE; world.roadClear=clear;
    const SOLIDDEC={tree:1,bush:1,rock:1,hedge:1,cactus:1,scrub:1}; let removed=0, removedTrees=0, tiles=0;
    for(const o of objs){ if(!SOLIDDEC[o.kind]||o._dead) continue; const r=(o.r||(o.kind==='hedge'?TILE*0.5:o.kind==='cactus'?TILE*0.4:8))/TILE;
      const cx=o.x/TILE, cy=o.y/TILE; const ct=get(Math.floor(cx),Math.floor(cy));
      // urban street trees on pavements / medians are planted by design next to kerbs: only require their canopy stays off the asphalt
      const need=(o.street||ct===T.WALK||ct===T.ISLAND)? r*0.55 : r+MARGIN;
      if(clear(cx,cy)<need){ o._dead=1; removed++; if(o.kind==='tree') removedTrees++; } }
    for(let i=0;i<N;i++){ if(G[i]!==T.TREE&&G[i]!==T.HEDGE&&G[i]!==T.ROCK) continue; const x=i%MW,y=(i/MW)|0; if(clear(x+0.5,y+0.5)<0.5+MARGIN && G[i]!==T.ROCK){ G[i]=T.GRASS; tiles++; } }
    // tree tiles whose tree was removed are no longer solid
    for(const o of objs) if(o._dead&&o.kind==='tree'){ const tx=Math.floor(o.x/TILE),ty=Math.floor(o.y/TILE); if(get(tx,ty)===T.TREE){ set(tx,ty,T.GRASS); tiles++; } }
    world.roadSweep={removed,removedTrees,tiles}; }
  // spatial index of ground objects per chunk
  world.chunkObjs=new Map();
  if(world.animals) world.animals=world.animals.filter(a=>!a._dead);
  for(const o of objs){ if(o._dead) continue;
    let x0,y0,x1,y1;
    if(o.kind==='tree'||o.kind==='hedge'||o.kind==='bale'||o.kind==='rock'||o.kind==='scrub'||o.kind==='cactus'||o.kind==='fsign'||o.kind==='bush'){ const r=o.r||16; x0=o.x-r-2; y0=o.y-r-2; x1=o.x+r*2+8; y1=o.y+r*2+8; }
    else if(o.kind==='tank'||o.kind==='silo'){ x0=o.x-o.r; y0=o.y-o.r; x1=o.x+o.r*2.2+20; y1=o.y+o.r*2.2+20; }
    else if(o.kind==='paint'){ x0=o.x; y0=o.y; x1=o.x+400; y1=o.y+60; }
    else if(o.kind==='fountain'){ x0=o.x-60; y0=o.y-60; x1=o.x+60; y1=o.y+60; }
    else if(o.kind==='pump'||o.kind==='pallets'||o.kind==='drive'){ x0=o.x; y0=o.y-TILE; x1=o.x+TILE*2+12; y1=o.y+TILE*2+12; }
    else { const s=(o.height||0)*0.6+4; x0=o.x; y0=o.y; x1=o.x+o.w+s; y1=o.y+o.h+s; }
    o.z = o.kind==='curve'?-1.5 : o.kind==='kerb'||o.kind==='rb'||o.kind==='field'||o.kind==='runway'?-1 : o.kind==='appr'||o.kind==='boxj'||o.kind==='ldrop'?-0.5 : o.kind==='lot'||o.kind==='pond'||o.kind==='paint'||o.kind==='bay'||o.kind==='drive'?0 : o.kind==='tree'?3 : o.kind==='awning'?2.5 : 2;
    for(let cy=Math.floor(y0/CHUNK);cy<=Math.floor(y1/CHUNK);cy++) for(let cx=Math.floor(x0/CHUNK);cx<=Math.floor(x1/CHUNK);cx++){
      const k=cx+','+cy; if(!world.chunkObjs.has(k)) world.chunkObjs.set(k,[]); world.chunkObjs.get(k).push(o);
    }
  }
  for(const arr of world.chunkObjs.values()) arr.sort((a,b)=>a.z-b.z);
}
function onRoadM(mx,my){
  const px=mx*PPM, py=my*PPM, tx=Math.floor(px/TILE), ty=Math.floor(py/TILE); if(!inb(tx,ty)) return false;
  const ci=world.cornerAt[idx(tx,ty)];
  if(ci>=0){ const c=world.corners[ci]; return Math.hypot(px/TILE-c.cx,py/TILE-c.cy)>c.R; }
  const t=G[idx(tx,ty)]; return t===T.ROAD||t===T.BRIDGE;
}

// v20: flyovers — a curved major road (motorway / dual / rural link with real ends) that crosses a straight road mid-span, with no junction,
// is grade-separated: raised deck drawn over the lower road, traffic layers (upper never meets lower), sat nav keeps them unconnected.
// City/town curves with no tied ends (diagonal avenues) are meant as at-grade streets and are left alone.
function buildFlyovers(){ world.flyovers=[]; const Z=world.foZ=new Uint8Array(MW*MH), F=world.foF=new Uint8Array(MW*MH);
  for(const cv of world.curves){ if(!cv.cfI||!cv.cfI.length) continue; if(!(cv.A&&cv.B) && (cv.type==='city'||cv.type==='town'||cv.type==='res')) continue;
    const I=[...new Set(cv.cfI)].sort((a,b)=>a-b); const groups=[]; let g=[I[0],I[0]];
    for(const i of I.slice(1)){ if(i-g[1]<=8) g[1]=i; else { groups.push(g); g=[i,i]; } } groups.push(g);
    for(const [a0,b0] of groups){ const pad=Math.ceil(cv.w*2)+4, a=Math.max(0,a0-pad), b=Math.min(cv.pts.length-1,b0+pad);
      const fo={id:world.flyovers.length,cv:cv.id,a,b,a0,b0,lower:new Set()}; world.flyovers.push(fo); (cv.fo=cv.fo||[]).push(fo);
      const hw=cv.w/2+4; for(let k=a;k<=b;k++){ const [px,py]=cv.pts[k]; for(let ty=Math.floor(py-hw);ty<=py+hw;ty++) for(let tx=Math.floor(px-hw);tx<=px+hw;tx++){ if(!inb(tx,ty)) continue; if(Math.hypot(tx+0.5-px,ty+0.5-py)<=hw) Z[idx(tx,ty)]=fo.id+1; } } } }
  for(const cv of world.curves) if(cv.fo&&cv.cfT) for(const i of cv.cfT){ F[i]=1; const s=world.roadH[i]>=0?world.roadH[i]:world.roadV[i]; for(const fo of cv.fo) if(Z[i]===fo.id+1) fo.lower.add(s); }
  for(const fo of world.flyovers) fo.lower=[...fo.lower];
}
// layer test for any two boxes (AI or player): different layers inside the same flyover zone never interact
function foApart(la,xa,ya,lb,xb,yb){ if((la|0)===(lb|0)||!world.foZ) return false; const za=world.foZ[idx(Math.floor(xa/M_T),Math.floor(ya/M_T))], zb=world.foZ[idx(Math.floor(xb/M_T),Math.floor(yb/M_T))]; return za>0&&za===zb; }
