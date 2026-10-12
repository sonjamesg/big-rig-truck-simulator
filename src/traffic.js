'use strict';
// ===================== AI TRAFFIC (GTA2-style ring spawning, lane graph, IDM following) =====================
const VTYPES={
  hatch:{L:4.0,W:1.75,heavy:false,acc:2.2},  sedan:{L:4.6,W:1.8,heavy:false,acc:2.0}, estate:{L:4.8,W:1.85,heavy:false,acc:1.9},
  sports:{L:4.4,W:1.85,heavy:false,acc:3.0}, suv:{L:4.8,W:1.95,heavy:false,acc:1.8},  taxi:{L:4.6,W:1.85,heavy:false,acc:2.0},
  van:{L:5.6,W:2.05,heavy:false,acc:1.5},    box:{L:8.0,W:2.45,heavy:true,acc:1.0},   bus:{L:11.5,W:2.55,heavy:true,acc:0.9},
  lorry:{L:6.2,W:2.5,heavy:true,acc:0.75}
};
const CAR_COLS=['#c0392b','#ecf0f1','#2c3e50','#2980b9','#7f8c8d','#16a085','#f1c40f','#8e44ad','#d35400','#1e1e1e','#bdc3c7','#27ae60','#6d1a1a','#34495e'];
const MIX={dirt:{van:3,suv:4,box:1,lorry:2},city:{hatch:14,sedan:16,estate:6,sports:3,suv:8,taxi:12,van:12,bus:9,box:8,lorry:4},
  town:{hatch:16,sedan:16,estate:8,sports:3,suv:9,taxi:5,van:13,bus:6,box:8,lorry:5},
  hwy:{hatch:8,sedan:16,estate:8,sports:5,suv:10,van:12,box:12,lorry:26,bus:2},
  res:{hatch:26,sedan:22,estate:14,suv:14,sports:3,van:12,taxi:6},
  dual:{hatch:10,sedan:18,estate:10,sports:4,suv:12,van:12,box:10,lorry:18,bus:3},
  lane:{hatch:20,estate:16,suv:18,van:12,sedan:8},
  rural:{hatch:16,sedan:14,estate:12,suv:14,van:14,lorry:14,box:8}};
const SPEED={dirt:8,city:13,town:12,res:9,rural:17,hwy:27,dual:22,lane:10};
const AREAW={dirt:0.05,city:1.0,town:0.95,hwy:1.1,res:0.4,rural:0.22,dual:0.7,lane:0.1};
const traffic={vs:[],peds:[],parked:[],parkedIdx:new Map(),nextId:1,hash:new Map(),target:0,spawned:0,despawned:0,arts:{},lastTarget:-9};
function pickW(o,r){ let t=0; for(const k in o) t+=o[k]; let x=r*t; for(const k in o){ x-=o[k]; if(x<=0) return k; } return Object.keys(o)[0]; }
const ang=(dx,dy)=>Math.atan2(dx,-dy); // heading for direction vector (0 = north)
const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
const mod2pi=a=>((a%6.283185307)+6.283185307)%6.283185307;

// ---------------- vehicle art (16 px per metre, nose up) ----------------
const VS=16;
function vCanvas(L,W){ const c=mkCanvas(Math.ceil((W+0.5)*VS),Math.ceil((L+0.3)*VS)); return c; }
function grad(g,x0,x1,col){ const gr=g.createLinearGradient(x0,0,x1,0); gr.addColorStop(0,shade(col,0.7)); gr.addColorStop(0.35,shade(col,1.15)); gr.addColorStop(0.65,shade(col,1.15)); gr.addColorStop(1,shade(col,0.7)); return gr; }
function glass(g,x,y,w,h,r){ const gr=g.createLinearGradient(x,y,x+w,y+h); gr.addColorStop(0,'#2a3b4d'); gr.addColorStop(0.5,'#4f6a85'); gr.addColorStop(1,'#1c2836'); g.fillStyle=gr; rr(g,x,y,w,h,r); g.fill(); }
function makeCarArt(kind,col){
  const t=VTYPES[kind], L=t.L, W=t.W, c=vCanvas(L,W), g=c.getContext('2d');
  const cx=c.width/2, y0=0.15*VS, X=m=>cx+m*VS, Y=m=>y0+m*VS, w=W*VS;
  // tyres peeking out
  g.fillStyle='#121212'; for(const fy of [0.75,L-1.15]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.18:0.05)),Y(fy),0.23*VS,0.62*VS);
  // body
  g.fillStyle=grad(g,X(-W/2),X(W/2),col); rr(g,X(-W/2+0.05),Y(0),w-0.1*VS,L*VS,(kind==='sports'?0.7:0.45)*VS); g.fill();
  g.strokeStyle='rgba(0,0,0,0.45)'; g.lineWidth=1.2; g.stroke();
  const prof={hatch:[0.75,1.25,1.4,0.35],sedan:[1.05,1.35,1.4,0.75],estate:[1.0,1.35,2.0,0.35],sports:[1.35,1.1,1.0,0.6],suv:[0.95,1.35,1.95,0.35],taxi:[1.0,1.3,1.6,0.6]}[kind];
  const [bon,ws,roof,rw]=prof; const iw=W-0.32;
  // bonnet crease lines
  g.strokeStyle='rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(X(-0.35),Y(0.25)); g.lineTo(X(-0.3),Y(bon)); g.moveTo(X(0.35),Y(0.25)); g.lineTo(X(0.3),Y(bon)); g.stroke();
  // windscreen, roof, rear window
  glass(g,X(-iw/2),Y(bon),iw*VS,ws*0.55*VS,0.25*VS);
  g.fillStyle=shade(col,kind==='taxi'?0.95:1.05); rr(g,X(-iw/2+0.08),Y(bon+ws*0.5),(iw-0.16)*VS,roof*VS,0.2*VS); g.fill();
  g.fillStyle='rgba(255,255,255,0.12)'; g.fillRect(X(-iw/2+0.25),Y(bon+ws*0.5+0.1),0.25*VS,roof*0.8*VS);
  if(kind==='suv'){ g.fillStyle='#1d1d1d'; g.fillRect(X(-iw/2+0.18),Y(bon+ws*0.6),0.08*VS,roof*0.9*VS); g.fillRect(X(iw/2-0.26),Y(bon+ws*0.6),0.08*VS,roof*0.9*VS); }
  if(kind==='sports'){ g.fillStyle='rgba(0,0,0,0.6)'; g.fillRect(X(-0.15),Y(0.2),0.3*VS,(L-0.4)*VS); }
  glass(g,X(-iw/2+0.1),Y(bon+ws*0.5+roof),(iw-0.2)*VS,rw*VS,0.2*VS);
  // side windows
  g.fillStyle='rgba(35,50,65,0.85)'; g.fillRect(X(-W/2+0.08),Y(bon+0.2),0.1*VS,(ws*0.3+roof)*VS); g.fillRect(X(W/2-0.18),Y(bon+0.2),0.1*VS,(ws*0.3+roof)*VS);
  // mirrors
  g.fillStyle=shade(col,0.6); g.fillRect(X(-W/2-0.15),Y(bon+0.1),0.2*VS,0.18*VS); g.fillRect(X(W/2-0.05),Y(bon+0.1),0.2*VS,0.18*VS);
  // lamps
  g.fillStyle='#fffbe0'; g.fillRect(X(-W/2+0.15),Y(0.05),0.42*VS,0.16*VS); g.fillRect(X(W/2-0.57),Y(0.05),0.42*VS,0.16*VS);
  g.fillStyle='#6e0d0d'; g.fillRect(X(-W/2+0.12),Y(L-0.17),0.45*VS,0.13*VS); g.fillRect(X(W/2-0.57),Y(L-0.17),0.45*VS,0.13*VS);
  if(kind==='taxi'){ g.fillStyle='#f6d32d'; rr(g,X(-0.35),Y(bon+ws*0.5+0.2),0.7*VS,0.28*VS,3); g.fill(); g.fillStyle='#222'; g.font=`bold ${0.2*VS}px sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TAXI',X(0),Y(bon+ws*0.5+0.34)); }
  return c;
}
function makeVanArt(col,logo){
  const L=5.6,W=2.05,c=vCanvas(L,W),g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS;
  g.fillStyle='#121212'; for(const fy of [0.6,L-1.3]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.18:0.05)),Y(fy),0.23*VS,0.65*VS);
  g.fillStyle=grad(g,X(-W/2),X(W/2),col); rr(g,X(-W/2),Y(0),W*VS,L*VS,0.35*VS); g.fill(); g.strokeStyle='rgba(0,0,0,0.45)'; g.stroke();
  glass(g,X(-W/2+0.15),Y(0.6),(W-0.3)*VS,0.55*VS,0.2*VS);
  g.fillStyle=shade(col,1.08); g.fillRect(X(-W/2+0.12),Y(1.25),(W-0.24)*VS,(L-1.45)*VS);
  g.strokeStyle='rgba(0,0,0,0.15)'; for(let k=1.8;k<L-0.3;k+=0.55){ g.beginPath(); g.moveTo(X(-W/2+0.2),Y(k)); g.lineTo(X(W/2-0.2),Y(k)); g.stroke(); }
  if(logo){ g.save(); g.translate(X(0),Y(3.3)); g.rotate(Math.PI/2); g.fillStyle='rgba(0,0,0,0.55)'; g.font=`900 ${0.42*VS}px Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(logo,0,0); g.restore(); }
  g.fillStyle=shade(col,0.6); g.fillRect(X(-W/2-0.18),Y(0.85),0.22*VS,0.2*VS); g.fillRect(X(W/2-0.04),Y(0.85),0.22*VS,0.2*VS);
  g.fillStyle='#fffbe0'; g.fillRect(X(-W/2+0.12),Y(0.04),0.42*VS,0.16*VS); g.fillRect(X(W/2-0.54),Y(0.04),0.42*VS,0.16*VS);
  g.fillStyle='#6e0d0d'; g.fillRect(X(-W/2+0.08),Y(L-0.18),0.3*VS,0.14*VS); g.fillRect(X(W/2-0.38),Y(L-0.18),0.3*VS,0.14*VS);
  return c;
}
function makeBusArt(){
  const L=11.5,W=2.55,c=vCanvas(L,W),g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS, col='#c8102e';
  g.fillStyle='#121212'; for(const fy of [1.3,L-3.2]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.15:0.05)),Y(fy),0.2*VS,0.9*VS);
  g.fillStyle=grad(g,X(-W/2),X(W/2),col); rr(g,X(-W/2),Y(0),W*VS,L*VS,0.4*VS); g.fill(); g.strokeStyle='rgba(0,0,0,0.5)'; g.stroke();
  // upper deck window strips + roof
  g.fillStyle='#22303d'; g.fillRect(X(-W/2+0.05),Y(0.4),0.18*VS,(L-0.8)*VS); g.fillRect(X(W/2-0.23),Y(0.4),0.18*VS,(L-0.8)*VS);
  glass(g,X(-W/2+0.15),Y(0.15),(W-0.3)*VS,0.45*VS,0.2*VS);
  g.fillStyle='#e9e4dc'; rr(g,X(-W/2+0.3),Y(0.75),(W-0.6)*VS,(L-1.1)*VS,0.3*VS); g.fill();
  g.fillStyle='#cfc9bf'; for(const fy of [2.5,6.5]){ g.fillRect(X(-0.45),Y(fy),0.9*VS,0.9*VS); }
  g.fillStyle='#9aa0a6'; g.fillRect(X(-0.6),Y(L-1.9),1.2*VS,1.1*VS); g.fillStyle='#777'; for(let k=0;k<5;k++) g.fillRect(X(-0.55),Y(L-1.8+k*0.2),1.1*VS,0.06*VS);
  g.fillStyle='#fff'; g.font=`bold ${0.55*VS}px Arial`; g.textAlign='center'; g.textBaseline='middle'; g.save(); g.translate(X(0),Y(4.6)); g.rotate(Math.PI/2); g.fillStyle='#c8102e'; g.fillText('CITY BUS 24',0,0); g.restore();
  g.fillStyle='#fffbe0'; g.fillRect(X(-W/2+0.12),Y(0.03),0.45*VS,0.14*VS); g.fillRect(X(W/2-0.57),Y(0.03),0.45*VS,0.14*VS);
  g.fillStyle='#6e0d0d'; g.fillRect(X(-W/2+0.1),Y(L-0.17),0.35*VS,0.13*VS); g.fillRect(X(W/2-0.45),Y(L-0.17),0.35*VS,0.13*VS);
  return c;
}
function cabFront(g,X,Y,W,col,len){ g.fillStyle=grad(g,X(-W/2),X(W/2),col); rr(g,X(-W/2),Y(0),W*VS,len*VS,0.35*VS); g.fill(); g.strokeStyle='rgba(0,0,0,0.5)'; g.stroke();
  glass(g,X(-W/2+0.1),Y(0.08),(W-0.2)*VS,0.35*VS,0.12*VS); g.fillStyle=shade(col,1.2); rr(g,X(-W/2+0.15),Y(0.55),(W-0.3)*VS,(len-0.75)*VS,0.25*VS); g.fill();
  g.fillStyle='rgba(0,0,0,0.15)'; g.fillRect(X(-0.1),Y(0.7),0.2*VS,(len-1)*VS);
  g.fillStyle='#2a2a2a'; g.fillRect(X(-W/2-0.25),Y(0.35),0.28*VS,0.35*VS); g.fillRect(X(W/2-0.03),Y(0.35),0.28*VS,0.35*VS);
  g.fillStyle='#fffbe0'; g.fillRect(X(-W/2+0.1),Y(0.0),0.4*VS,0.1*VS); g.fillRect(X(W/2-0.5),Y(0.0),0.4*VS,0.1*VS); }
function makeBoxArt(col,boxcol,logo){
  const L=8.0,W=2.45,c=vCanvas(L,W),g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS;
  g.fillStyle='#121212'; for(const fy of [0.5,L-2.0]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.12:0.08)),Y(fy),0.2*VS,0.9*VS);
  g.fillStyle='rgba(0,0,0,0.5)'; g.fillRect(X(-0.6),Y(1.9),1.2*VS,0.4*VS);
  // box
  g.fillStyle=grad(g,X(-W/2),X(W/2),boxcol); g.fillRect(X(-W/2),Y(2.2),W*VS,(L-2.2)*VS); g.strokeStyle='rgba(0,0,0,0.4)'; g.strokeRect(X(-W/2)+0.5,Y(2.2)+0.5,W*VS-1,(L-2.2)*VS-1);
  g.strokeStyle='rgba(0,0,0,0.12)'; for(let k=2.6;k<L-0.2;k+=0.6){ g.beginPath(); g.moveTo(X(-W/2),Y(k)); g.lineTo(X(W/2),Y(k)); g.stroke(); }
  if(logo){ g.save(); g.translate(X(0),Y(5.0)); g.rotate(Math.PI/2); g.fillStyle=shade(col,0.8); g.font=`900 ${0.5*VS}px Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(logo,0,0); g.restore(); }
  cabFront(g,X,Y,W-0.15,col,2.0);
  g.fillStyle='#6e0d0d'; g.fillRect(X(-W/2+0.08),Y(L-0.16),0.35*VS,0.12*VS); g.fillRect(X(W/2-0.43),Y(L-0.16),0.35*VS,0.12*VS);
  return c;
}
function makeTractorArt(col){
  const L=6.2,W=2.5,c=vCanvas(L,W),g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS;
  g.fillStyle='#26282c'; g.fillRect(X(-0.55),Y(2.3),0.35*VS,3.7*VS); g.fillRect(X(0.2),Y(2.3),0.35*VS,3.7*VS);
  g.fillStyle='#121212'; for(const fy of [0.6,4.3]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.45:-0.0)),Y(fy),0.45*VS,1.0*VS);
  g.fillStyle='#55595f'; g.beginPath(); g.arc(X(0),Y(4.7),0.7*VS,0,7); g.fill();
  g.fillStyle='#b9bec5'; g.fillRect(X(-1.2),Y(2.6),0.4*VS,1.4*VS); g.fillRect(X(0.8),Y(2.6),0.4*VS,1.4*VS);
  cabFront(g,X,Y,W,col,2.5);
  for(const s of [-1,1]){ g.fillStyle='#d9dde2'; g.beginPath(); g.arc(X(s*0.95),Y(2.6),0.16*VS,0,7); g.fill(); }
  return c;
}
function makeTrailerArtAI(col,logo,kind){
  const L=13.6,W=2.55,c=vCanvas(L,W),g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS;
  g.fillStyle='#121212'; for(const fy of [9.6,10.7,11.8]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.12:0.08)),Y(fy),0.2*VS,0.8*VS);
  if(kind==='tank'){ const gr=g.createLinearGradient(X(-W/2),0,X(W/2),0); gr.addColorStop(0,'#8c9299'); gr.addColorStop(0.5,'#f2f4f6'); gr.addColorStop(1,'#8c9299'); g.fillStyle=gr; rr(g,X(-W/2+0.05),Y(0.2),(W-0.1)*VS,(L-0.4)*VS,1.1*VS); g.fill();
    g.fillStyle='#6d737a'; for(let k=1.5;k<L-1;k+=2.8){ g.beginPath(); g.arc(X(0),Y(k),0.35*VS,0,7); g.fill(); } g.fillStyle='#555'; g.fillRect(X(-0.08),Y(0.5),0.16*VS,(L-1)*VS); return c; }
  if(kind==='flat'){ g.fillStyle='#5b4a3a'; g.fillRect(X(-W/2),Y(0),W*VS,L*VS); g.strokeStyle='rgba(0,0,0,0.3)'; for(let k=0.3;k<L;k+=0.4){ g.beginPath(); g.moveTo(X(-W/2),Y(k)); g.lineTo(X(W/2),Y(k)); g.stroke(); }
    const cc=['#2e86c1','#b03a2e','#239b56'][(logo||'').length%3]; g.fillStyle=cc; g.fillRect(X(-W/2+0.08),Y(0.6),(W-0.16)*VS,6*VS); g.strokeStyle='rgba(0,0,0,0.35)'; for(let k=0.9;k<6.6;k+=0.35){ g.beginPath(); g.moveTo(X(-W/2+0.1),Y(k)); g.lineTo(X(W/2-0.1),Y(k)); g.stroke(); } return c; }
  g.fillStyle=grad(g,X(-W/2),X(W/2),col); g.fillRect(X(-W/2),Y(0),W*VS,L*VS); g.strokeStyle='rgba(0,0,0,0.45)'; g.strokeRect(X(-W/2)+0.5,Y(0)+0.5,W*VS-1,L*VS-1);
  g.strokeStyle='rgba(0,0,0,0.1)'; for(let k=0.4;k<L;k+=0.5){ g.beginPath(); g.moveTo(X(-W/2),Y(k)); g.lineTo(X(W/2),Y(k)); g.stroke(); }
  if(logo){ g.save(); g.translate(X(0),Y(L/2)); g.rotate(Math.PI/2); g.fillStyle=col==='#f4f4f4'||col==='#ecf0f1'?'#c0392b':'#fff'; g.font=`900 ${0.95*VS}px Arial Black,Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(logo,0,0); g.restore(); }
  g.fillStyle='#6e0d0d'; g.fillRect(X(-W/2+0.08),Y(L-0.16),0.35*VS,0.12*VS); g.fillRect(X(W/2-0.43),Y(L-0.16),0.35*VS,0.12*VS);
  return c;
}
function shadowOf(c){ const s=mkCanvas(c.width,c.height), g=s.getContext('2d'); g.drawImage(c,0,0); g.globalCompositeOperation='source-in'; g.fillStyle='rgba(8,12,20,0.4)'; g.fillRect(0,0,c.width,c.height); return s; }
function artFor(kind,r){
  const col=CAR_COLS[(r()*CAR_COLS.length)|0];
  let key, mk;
  if(kind==='taxi'){ key='taxi'; mk=()=>makeCarArt('taxi','#151515'); }
  else if(VTYPES[kind]&&!VTYPES[kind].heavy&&kind!=='van'){ key=kind+col; mk=()=>makeCarArt(kind,col); }
  else if(kind==='van'){ const cl=['#ecf0f1','#ecf0f1','#ecf0f1','#2c3e50','#c0392b','#f1c40f','#7f8c8d'][(r()*7)|0]; const lg=r()<0.5?['PLUMBING','PARCELS','FLOWERS','BUILDERS','CATERING'][(r()*5)|0]:''; key='van'+cl+lg; mk=()=>makeVanArt(cl,lg); }
  else if(kind==='bus'){ key='bus'; mk=makeBusArt; }
  else if(kind==='box'){ const cc=['#ecf0f1','#2471a3','#c0392b','#1e8449'][(r()*4)|0], bc=['#f4f4f4','#e8e4d8','#f2c230'][(r()*3)|0], lg=COMPANIES[(r()*COMPANIES.length)|0]; key='box'+cc+bc+lg; mk=()=>makeBoxArt(cc,bc,lg); }
  else { const cc=['#d35400','#2471a3','#ecf0f1','#1e8449','#7d3c98','#2c3e50','#f1c40f'][(r()*7)|0]; key='tr'+cc; mk=()=>makeTractorArt(cc); }
  if(!traffic.arts[key]){ const c=mk(); traffic.arts[key]={c,sh:shadowOf(c)}; }
  const out={body:traffic.arts[key]};
  if(kind==='lorry'){ const tk=r(), lg=COMPANIES[(r()*COMPANIES.length)|0], tcol=['#f4f4f4','#2e4053','#a93226','#1f618d','#7d6608'][(r()*5)|0];
    const kk= tk<0.15?'tank':tk<0.3?'flat':'box'; const key2='trl'+kk+tcol+lg; if(!traffic.arts[key2]){ const c=makeTrailerArtAI(tcol,lg,kk); traffic.arts[key2]={c,sh:shadowOf(c)}; } out.trl=traffic.arts[key2]; }
  return out;
}

// ---------------- lane geometry (all in metres) ----------------
const M_T=TILE/PPM; // metres per tile (4)
function nLanes(sg){ return Math.max(1,Math.floor(sg.w/2)); }
function laneLat(sg,dir,lane){ if(sg.dir==='h') return dir>0? sg.a+lane : sg.a+sg.w-1-lane; return dir<0? sg.a+lane : sg.a+sg.w-1-lane; }
function lanePt(sg,dir,lane,along){ const l=(laneLat(sg,dir,lane)+0.5)*M_T, a=along*M_T; return sg.dir==='h'?[a,l]:[l,a]; }
function jRange(sg,J){ return sg.dir==='h'?[J.x,J.x+J.w]:[J.y,J.y+J.h]; }
function dirVec(sg,dir){ return sg.dir==='h'?[dir,0]:[0,dir]; }

function pathPush(v,x,y){ const n=v.px.length; if(n){ const dx=x-v.px[n-1], dy=y-v.py[n-1], d=Math.hypot(dx,dy); if(d<0.05) return; v.pd.push(v.pd[n-1]+d); } else v.pd.push(0); v.px.push(x); v.py.push(y); }
function pathLine(v,x1,y1){ const n=v.px.length, x0=v.px[n-1], y0=v.py[n-1]; const d=Math.hypot(x1-x0,y1-y0), k=Math.max(1,Math.ceil(d/3)); for(let i=1;i<=k;i++) pathPush(v,x0+(x1-x0)*i/k,y0+(y1-y0)*i/k); }
function pathQuad(v,cx,cy,x1,y1){ const n=v.px.length, x0=v.px[n-1], y0=v.py[n-1]; const d=Math.hypot(cx-x0,cy-y0)+Math.hypot(x1-cx,y1-cy), k=Math.max(3,Math.ceil(d/0.8)); for(let i=1;i<=k;i++){ const t=i/k, u=1-t; pathPush(v,u*u*x0+2*u*t*cx+t*t*x1,u*u*y0+2*u*t*cy+t*t*y1); } }
function pathEnd(v){ return v.pd[v.pd.length-1]; }

// plan one more piece of route from v.plan; returns false if impossible
function planPiece(v,r){
  const P=v.plan, sg=world.segs[P.seg], d=P.dir;
  let J=null;
  for(const j of sg.js){ const [js,je]=jRange(sg,j); if(d>0){ if(js>=P.pos-0.01){ J=j; break; } } else if(je<=P.pos+0.01) J=j; }
  if(J){
    const o=jOptions(J,sg,d), ap=J.appr&&J.appr[sg.id+':'+d], stop=o.stop, exitA=o.exitA;
    if(!o.opts.length){ const p=lanePt(sg,d,P.lane,stop); pathLine(v,p[0],p[1]); return planUTurn(v,sg,d,stop,r); }
    const lineA=ap?ap.lineA:stop, lanes=ap?ap.lanes:null;
    let opts=o.opts; const distT=Math.abs(lineA-P.pos);
    if(lanes && distT<5){ const f=opts.filter(op=>lanes[P.lane]&&lanes[P.lane].indexOf(op[0])>=0); if(f.length) opts=f; }
    let tw=0; for(const q of opts) tw+=q[3]; let x=r()*tw, ch=opts[0]; for(const q of opts){ x-=q[3]; if(x<=0){ ch=q; break; } }
    let tl=P.lane;
    if(lanes && !(lanes[tl]&&lanes[tl].indexOf(ch[0])>=0)){ let bd=99; for(let i=0;i<lanes.length;i++) if(lanes[i].indexOf(ch[0])>=0 && Math.abs(i-P.lane)<bd){ bd=Math.abs(i-P.lane); tl=i; } }
    if(tl!==P.lane){ laneChange(v,sg,d,P.lane,tl,P.pos,lineA); P.lane=tl; }
    let p=lanePt(sg,d,P.lane,lineA); pathLine(v,p[0],p[1]); const dStop=pathEnd(v);
    p=lanePt(sg,d,P.lane,stop); pathLine(v,p[0],p[1]);
    if(traffic.log) traffic.log.push({J:J.id,key:sg.id+':'+d,lane:P.lane,move:ch[0],allowed:lanes?lanes[P.lane]:'*',veh:v.id});
    const mk={kind:J.lights?'light':(ap&&ap.gw)?'gw':'major',d:dStop,J,ns:sg.dir==='v',axis:sg.dir,move:ch[0],key:sg.id+':'+d};
    if(ch[0]==='S'){ const q=lanePt(sg,d,P.lane,exitA); pathLine(v,q[0],q[1]); mk.dEnd=pathEnd(v); v.mk.push(mk); P.pos=exitA; return true; }
    const C2=ch[1], cd=ch[2], nl=nLanes(C2), lane= ch[0]==='L'?0:Math.min(nl-1,P.lane);
    const ex= cd>0?o.ce:o.cs, q=lanePt(C2,cd,lane,ex);
    const ctrl= sg.dir==='h'?[q[0],p[1]]:[p[0],q[1]];
    pathQuad(v,ctrl[0],ctrl[1],q[0],q[1]); mk.dEnd=pathEnd(v); mk.turn=ch[0]; v.mk.push(mk);
    v.mk.push({kind:'sig',d0:dStop-38,d1:mk.dEnd,side:ch[0]==='L'?-1:1});
    v.mk.push({kind:'slow',d0:dStop,d1:mk.dEnd,v:ch[0]==='L'?5.5:6.5});
    P.seg=C2.id; P.dir=cd; P.lane=lane; P.pos=ex; return true;
  }
  const E=d>0?sg.b1+1:sg.b0; const rbId=d>0?sg.rb1:sg.rb0;
  const cref=d>0?sg.cv1:sg.cv0; if(cref) return planCurve(v,sg,d,E,cref);
  const lk=d>0?sg.link1:sg.link0;
  if(lk!==undefined && rbId===undefined){ const N=world.segs[lk], rowsN=[]; for(let i=0;i<nLanes(N);i++) rowsN.push(laneLat(N,d,i));
    let ni=rowsN.indexOf(laneLat(sg,d,P.lane));
    if(ni<0){ let best=-1,bd=99; for(let i=0;i<nLanes(sg);i++){ if(rowsN.indexOf(laneLat(sg,d,i))>=0&&Math.abs(i-P.lane)<bd){ bd=Math.abs(i-P.lane); best=i; } }
      if(best>=0){ laneChange(v,sg,d,P.lane,best,P.pos,E); P.lane=best; ni=rowsN.indexOf(laneLat(sg,d,best)); } else ni=0; }
    const p=lanePt(sg,d,P.lane,E); pathLine(v,p[0],p[1]);
    if(laneLat(sg,d,P.lane)!==rowsN[ni]){ const q=lanePt(N,d,ni,E+d*2.5); pathLine(v,q[0],q[1]); P.pos=E+d*2.5; } else P.pos=E;
    P.seg=N.id; P.lane=ni; return true; }
  if(rbId!==undefined){ const rb=world.rbs[rbId]; const myArm=rb.arms.find(a=>a.seg===sg.id&&a.side===d);
    let arms=rb.arms.filter(a=>a!==myArm); if(!arms.length) arms=rb.arms; const arm=arms[(r()*arms.length)|0];
    const del=mod2pi(arm.ang-(myArm?myArm.ang:0)); const mv= del<2.0?'L':del<3.9?'S':'R';
    const ap=rb.appr&&rb.appr[sg.id+':'+d]; let tl=P.lane;
    if(ap && ap.lanes[tl].indexOf(mv)<0){ let bd=99; for(let i=0;i<ap.lanes.length;i++) if(ap.lanes[i].indexOf(mv)>=0&&Math.abs(i-P.lane)<bd){ bd=Math.abs(i-P.lane); tl=i; } }
    if(tl!==P.lane){ laneChange(v,sg,d,P.lane,tl,P.pos,E); P.lane=tl; }
    if(traffic.log) traffic.log.push({rb:rb.id,key:sg.id+':'+d,lane:P.lane,move:mv,allowed:ap?ap.lanes[P.lane]:'*',veh:v.id});
    const p=lanePt(sg,d,P.lane,E); pathLine(v,p[0],p[1]);
    return planRB(v,rb,sg,d,r,arm); }
  const p=lanePt(sg,d,P.lane,E); pathLine(v,p[0],p[1]);
  return planUTurn(v,sg,d,E,r);
}
function planCurve(v,sg,d,E,cref){
  const P=v.plan, cv=world.curves[cref.cv]; const pts=cref.start?cv.pts:cv.pts.slice().reverse(); const other=cref.start?cv.B:cv.A;
  const p=lanePt(sg,d,P.lane,E); pathLine(v,p[0],p[1]);
  const dv=dirVec(sg,d), c=sg.dir==='h'?[E*M_T,(sg.a+sg.w/2)*M_T]:[(sg.a+sg.w/2)*M_T,E*M_T];
  const o=(p[0]-c[0])*(-dv[1])+(p[1]-c[1])*dv[0]; const d0=pathEnd(v), n=pts.length;
  for(let i=2;i<n-1;i+=2){ const a=pts[i-1], b=pts[i+1]; let tx=b[0]-a[0], ty=b[1]-a[1]; const l=Math.hypot(tx,ty)||1; tx/=l; ty/=l; pathPush(v,pts[i][0]*M_T-ty*o, pts[i][1]*M_T+tx*o); }
  const Q=world.segs[other.seg], qd=other.end===0?1:-1, qpos=other.end===0?Q.b0:Q.b1+1;
  const qv=dirVec(Q,qd), qc=Q.dir==='h'?[qpos*M_T,(Q.a+Q.w/2)*M_T]:[(Q.a+Q.w/2)*M_T,qpos*M_T];
  let best=0,bd=1e9; for(let l=0;l<nLanes(Q);l++){ const q=lanePt(Q,qd,l,qpos); const oo=(q[0]-qc[0])*(-qv[1])+(q[1]-qc[1])*qv[0]; if(Math.abs(oo-o)<bd){ bd=Math.abs(oo-o); best=l; } }
  const q=lanePt(Q,qd,best,qpos); pathLine(v,q[0],q[1]);
  v.mk.push({kind:'slow',d0:d0,d1:pathEnd(v),v:cv.vmax});
  if(traffic.log) traffic.log.push({curve:cv.id,from:sg.id,to:Q.id,lane:best,off:o});
  P.seg=Q.id; P.dir=qd; P.lane=best; P.pos=qpos; return true; }
function planUTurn(v,sg,d,at,r){
  const n=v.px.length, x0=v.px[n-1], y0=v.py[n-1]; const q=lanePt(sg,-d,0,at); const dv=dirVec(sg,d);
  const back=Math.max(0,Math.min(3,Math.abs(at-(d>0?sg.b0:sg.b1+1))))*0; // stay inside the road
  const mx=(x0+q[0])/2+dv[0]*3, my=(y0+q[1])/2+dv[1]*3;
  v.mk.push({kind:'slow',d0:pathEnd(v)-1,d1:pathEnd(v)+12,v:3}); v.mk.push({kind:'sig',d0:pathEnd(v)-25,d1:pathEnd(v)+8,side:1});
  pathQuad(v,x0+dv[0]*3,y0+dv[1]*3,mx,my); pathQuad(v,q[0]+dv[0]*3,q[1]+dv[1]*3,q[0],q[1]);
  v.plan.dir=-d; v.plan.lane=0; v.plan.pos=at; return true;
}
function laneChange(v,sg,d,l0,l1,pos,lineA){
  const dist=Math.abs(lineA-pos); let m1=pos+d*Math.max(0.2,dist-7), m2=lineA-d*Math.max(0.8,Math.min(2,dist*0.25));
  if((m2-m1)*d<1.2){ m1=pos+d*0.1; m2=pos+d*dist*0.85; }
  const p=lanePt(sg,d,l0,m1); pathLine(v,p[0],p[1]); const d0=pathEnd(v);
  const c0=laneLat(sg,d,l0)+0.5, c1=laneLat(sg,d,l1)+0.5, n=Math.max(4,Math.ceil(Math.abs(m2-m1)*2));
  for(let k=1;k<=n;k++){ const t=k/n, e=t*t*(3-2*t), al=(m1+(m2-m1)*t)*M_T, cr=(c0+(c1-c0)*e)*M_T; if(sg.dir==='h') pathPush(v,al,cr); else pathPush(v,cr,al); }
  v.mk.push({kind:'sig',d0:d0-12,d1:pathEnd(v),side:l1<l0?-1:1});
}
function planRB(v,rb,sg,d,r,forceArm){
  const C=[rb.cx*M_T,rb.cy*M_T], R=(rb.rin*0.42+rb.rout*0.58)*M_T;
  const n=v.px.length, ex=v.px[n-1], ey=v.py[n-1];
  const myArm=rb.arms.find(a=>a.seg===sg.id&&a.side===d);
  let arms=rb.arms.filter(a=>a!==myArm); if(!arms.length) arms=rb.arms;
  const arm=forceArm||arms[(r()*arms.length)|0], Q=world.segs[arm.seg], qd=arm.side<0?1:-1, qpos=arm.side<0?Q.b0:Q.b1+1;
  const lane=Math.min(nLanes(Q)-1,(r()*nLanes(Q))|0);
  const xp=lanePt(Q,qd,lane,qpos);
  const aIn=Math.atan2(ey-C[1],ex-C[0])+0.38, aOut=Math.atan2(xp[1]-C[1],xp[0]-C[0])-0.38;
  let del=mod2pi(aOut-aIn); if(del<0.4) del+=6.283185307;
  const dIn=pathEnd(v);
  v.mk.push({kind:'rb',d:dIn,rb,ang:aIn-0.2});
  pathQuad(v,C[0]+Math.cos(aIn-0.38)*R,C[1]+Math.sin(aIn-0.38)*R,C[0]+Math.cos(aIn)*R,C[1]+Math.sin(aIn)*R);
  const d0=pathEnd(v); const k=Math.ceil(del*R/2);
  for(let i=1;i<=k;i++){ const a=aIn+del*i/k; pathPush(v,C[0]+Math.cos(a)*R,C[1]+Math.sin(a)*R); }
  const d1=pathEnd(v);
  pathQuad(v,C[0]+Math.cos(aOut+0.38)*R,C[1]+Math.sin(aOut+0.38)*R,xp[0],xp[1]);
  v.mk.push({kind:'ring',d0:dIn,d1:pathEnd(v),rb});
  v.mk.push({kind:'slow',d0:dIn,d1:pathEnd(v),v:8});
  v.mk.push({kind:'sig',d0:d1-14,d1:pathEnd(v),side:-1});
  if(del>3.6) v.mk.push({kind:'sig',d0:dIn-30,d1:d0+del*R*0.6,side:1});
  v.plan.seg=Q.id; v.plan.dir=qd; v.plan.lane=lane; v.plan.pos=qpos; return true;
}

// ---------------- spawning ----------------
let tRand=mulberry(4242);
function viewRectM(){ const z=cam.z; return [ (cam.x-VW/2/z)/PPM, (cam.y-VH/2/z)/PPM, (cam.x+VW/2/z)/PPM, (cam.y+VH/2/z)/PPM ]; }
function onScreen(x,y,m){ const v=viewRectM(); return x>v[0]-m&&x<v[2]+m&&y>v[1]-m&&y<v[3]+m; }
function spawnVehicle(x,y,force){
  const r=tRand;
  const tx=Math.floor(x/M_T), ty=Math.floor(y/M_T); if(!inb(tx,ty)) return null;
  const i=idx(tx,ty); let sid=world.roadH[i]>=0&&world.roadV[i]>=0 ? (r()<0.5?world.roadH[i]:world.roadV[i]) : Math.max(world.roadH[i],world.roadV[i]);
  if(sid<0) return null; const sg=world.segs[sid];
  const along=(sg.dir==='h'?tx:ty)+0.5;
  for(const J of sg.js){ const [a,b]=jRange(sg,J); if(along>a-3&&along<b+3) return null; }
  if(along<sg.b0+2||along>sg.b1-1) return null;
  const dir=r()<0.5?1:-1, lane=(r()*nLanes(sg))|0;
  const p=lanePt(sg,dir,lane,along);
  for(const o of traffic.vs) if(Math.abs(o.x-p[0])<16&&Math.abs(o.y-p[1])<16) return null;
  const kind=pickW(MIX[sg.type]||MIX.city,r()), t=VTYPES[kind];
  const v={id:traffic.nextId++,kind,L:t.L,W:t.W,heavy:t.heavy,amax:t.acc,art:artFor(kind,r),px:[],py:[],pd:[],i:0,s:0,mk:[],
    plan:{seg:sid,dir,lane,pos:along},v:0,x:p[0],y:p[1],offX:0,offY:0,stopT:0,honkT:0,blockT:0,shakeT:0,ghostT:0,pinT:0,brake:false,sig:0,h:undefined,
    drv:0.88+r()*0.22, r:mulberry((r()*1e9)|0), born:timeS, dist:0};
  const back=lanePt(sg,dir,lane,along-dir*7);
  pathPush(v,back[0],back[1]); pathLine(v,p[0],p[1]); v.s=pathEnd(v);
  while(pathEnd(v)-v.s<90) if(!planPiece(v,v.r)) break;
  v.v=Math.min(SPEED[sg.type]||12,(v.heavy?20:30))*0.6;
  placeVeh(v); traffic.vs.push(v); traffic.spawned++; return v;
}
function densityTarget(px,py){
  let w=0, n=0; const r=tRand;
  for(let k=0;k<80;k++){ const a=r()*6.283, d=20+r()*200; const tx=Math.floor((px+Math.cos(a)*d)/M_T), ty=Math.floor((py+Math.sin(a)*d)/M_T); n++;
    if(!inb(tx,ty)) continue; const i=idx(tx,ty); const sid=Math.max(world.roadH[i],world.roadV[i]); if(sid>=0) w+=AREAW[world.segs[sid].type]||0.6; else if(world.roadH[i]===-2) w+=0.8; else if(world.roadH[i]===-3) w+=0.7; }
  return Math.round(Math.max(5,Math.min(75,w*2.6)));
}
// ---------------- per-frame ----------------
function placeVeh(v){
  let i=v.i; const pd=v.pd; while(i<pd.length-2&&pd[i+1]<v.s) i++; v.i=i;
  const t=Math.max(0,Math.min(1,(v.s-pd[i])/((pd[i+1]-pd[i])||1)));
  const x=v.px[i]+(v.px[i+1]-v.px[i])*t, y=v.py[i]+(v.py[i+1]-v.py[i])*t;
  // heading from a short look-ahead/behind chord for smooth rotation
  const a=pathAt(v,v.s+1.2), b=pathAt(v,v.s-1.2); const nh=ang(a[0]-b[0],a[1]-b[1]);
  v.h= v.h===undefined?nh: v.h+wrapA(nh-v.h)*0.6;
  v.x=x+v.offX; v.y=y+v.offY;
  if(v.kind==='lorry'){ const k=pathAt(v,v.s-1.6), ax=pathAt(v,v.s-1.6-10.5); const th=ang(k[0]-ax[0],k[1]-ax[1]); const f=fwd(th);
    v.trl={x:k[0]-f[0]*(13.6/2-1.2)+v.offX,y:k[1]-f[1]*(13.6/2-1.2)+v.offY,h:th}; }
}
function pathAt(v,s){ const pd=v.pd; if(s<=pd[0]){ return [v.px[0],v.py[0]]; } let i=Math.min(v.i,pd.length-2); while(i>0&&pd[i]>s) i--; while(i<pd.length-2&&pd[i+1]<s) i++;
  const t=Math.max(0,Math.min(1,(s-pd[i])/((pd[i+1]-pd[i])||1))); return [v.px[i]+(v.px[i+1]-v.px[i])*t, v.py[i]+(v.py[i+1]-v.py[i])*t]; }
function trimPath(v){ if(v.i<40) return; const cut=v.i-30; v.px.splice(0,cut); v.py.splice(0,cut); v.pd.splice(0,cut); v.i-=cut; }
// obstacle boxes: {x,y,h,L,W,vel,veh,player}
function boxesOf(v){ const b=[{x:v.x,y:v.y,h:v.h,L:v.L,W:v.W,vel:v.v,veh:v}]; if(v.trl) b.push({x:v.trl.x,y:v.trl.y,h:v.trl.h,L:13.6,W:2.55,vel:v.v,veh:v}); return b; }
function playerBoxes(){ const s=truck, f=fwd(s.h), k=kingpin(s), ft=fwd(s.th);
  const out=[{x:s.x+f[0]*1.9,y:s.y+f[1]*1.9,h:s.h,L:6.2,W:CAB.w,vel:s.v,player:true}]; if(s.trl) out.push({x:k[0]-ft[0]*5.6,y:k[1]-ft[1]*5.6,h:s.th,L:13.6,W:TRL.w,vel:s.v,player:true}); return out; }
const HC=24; const hkey=(x,y)=>(Math.floor(x/HC)+4096)*8192+Math.floor(y/HC)+4096;
function hashAdd(b){ const k=hkey(b.x,b.y); let a=traffic.hash.get(k); if(!a){ a=[]; traffic.hash.set(k,a); } a.push(b); }
function ptBoxDist(px,py,b){ const f=fwd(b.h), r=rgt(b.h), dx=px-b.x, dy=py-b.y; const lf=dx*f[0]+dy*f[1], lr=dx*r[0]+dy*r[1];
  return Math.hypot(Math.max(0,Math.abs(lr)-b.W/2),Math.max(0,Math.abs(lf)-b.L/2)); }
function obbCorners(b){ const f=fwd(b.h), r=rgt(b.h), out=[]; for(const [a,c] of [[1,1],[1,-1],[-1,-1],[-1,1]]) out.push([b.x+f[0]*b.L/2*a+r[0]*b.W/2*c, b.y+f[1]*b.L/2*a+r[1]*b.W/2*c]); return out; }
function obbMTV(A,B){ // returns [nx,ny,depth] pushing B away from A, or null
  const ca=obbCorners(A), cb=obbCorners(B); let best=1e9, bn=null;
  for(const h of [A.h,B.h]) for(const ax of [fwd(h),rgt(h)]){
    let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9; for(const p of ca){ const d=p[0]*ax[0]+p[1]*ax[1]; a0=Math.min(a0,d); a1=Math.max(a1,d); } for(const p of cb){ const d=p[0]*ax[0]+p[1]*ax[1]; b0=Math.min(b0,d); b1=Math.max(b1,d); }
    const o=Math.min(a1,b1)-Math.max(a0,b0); if(o<=0) return null; if(o<best){ best=o; const sgn=((b0+b1)-(a0+a1))>0?1:-1; bn=[ax[0]*sgn,ax[1]*sgn]; } }
  return [bn[0],bn[1],best];
}
// called from the lorry physics (120 Hz): heavy AI vehicles behave like walls; light ones get shoved
function trafficHitTruck(s){
  if(!traffic.vs.length && !traffic.parked.length) return false;
  const pb=playerBoxes(); let solid=false;
  const test=(v,boxes)=>{ for(const b of boxes){ for(const p of pb){ if(Math.abs(b.x-p.x)>12||Math.abs(b.y-p.y)>12) continue; const m=obbMTV(p,b); if(!m) continue;
      if(v.heavy){ solid=true; v.hitT=timeS; return; }
      v.offX+=m[0]*(m[2]+0.05); v.offY+=m[1]*(m[2]+0.05); v.x+=m[0]*(m[2]+0.05); v.y+=m[1]*(m[2]+0.05); if(v.trl){ v.trl.x+=m[0]*(m[2]+0.05); v.trl.y+=m[1]*(m[2]+0.05); }
      if(!v.parked){ if(v.shakeT<=0&&(!v.hitEnd||timeS-v.hitEnd>1.2)){ v.honkT=0; v.shakeT=1.6; v.v=0; v.hits=(v.hits||0)+1; } v.hitEnd=timeS; }
      v.h+=(Math.random()-0.5)*0.04*Math.min(1,Math.abs(s.v)/5);
      if(!v.hitCool||timeS-v.hitCool>0.6){ v.hitCool=timeS; const imp=Math.abs(s.v); s.v*=0.85; if(imp>1.5){ s.bump=Math.min(1,imp/16); } }
      return; } } };
  for(const v of traffic.vs){ if(Math.abs(v.x-s.x)>40||Math.abs(v.y-s.y)>40) continue; test(v,boxesOf(v)); if(solid) return true; }
  const k=Math.floor(s.x/64)+','+Math.floor(s.y/64);
  for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){ const a=traffic.parkedIdx.get((Math.floor(s.x/64)+dx)+','+(Math.floor(s.y/64)+dy)); if(a) for(const v of a) test(v,[{x:v.x,y:v.y,h:v.h,L:v.L,W:v.W}]); }
  return solid;
}
function honkAt(x,y,heavy){
  traffic.honkReq=(traffic.honkReq||0)+1;
  const ctx=audio.ctx; if(!ctx||!audio.master) return; const d=Math.hypot(x-truck.x,y-truck.y); if(d>110) return;
  const vol=0.16*Math.max(0,1-d/110)**1.3; const t=ctx.currentTime; const g=ctx.createGain(); g.gain.value=0;
  let node=g; if(ctx.createStereoPanner){ const p=ctx.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,(x-truck.x)/40)); g.connect(p); p.connect(audio.master); } else g.connect(audio.master);
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=heavy?900:2400; lp.connect(g);
  const fr=heavy?[150,190,227]:[392,494]; const dur=0.18+Math.random()*0.25, two=Math.random()<0.6;
  for(const f of fr){ const o=ctx.createOscillator(); o.type=heavy?'sawtooth':'square'; o.frequency.value=f*(0.97+Math.random()*0.06); o.connect(lp); o.start(t); o.stop(t+(two?dur*2+0.12:dur)+0.05); }
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.01); g.gain.setValueAtTime(vol,t+dur); g.gain.linearRampToValueAtTime(0,t+dur+0.02);
  if(two){ g.gain.setValueAtTime(0,t+dur+0.1); g.gain.linearRampToValueAtTime(vol,t+dur+0.11); g.gain.setValueAtTime(vol,t+dur*2+0.1); g.gain.linearRampToValueAtTime(0,t+dur*2+0.12); }
  traffic.honks=(traffic.honks||0)+1;
}
function giveWayBusy(v,J){
  const jx=(J.x+J.w/2)*M_T, jy=(J.y+J.h/2)*M_T, kx=Math.floor(jx/HC), ky=Math.floor(jy/HC);
  for(let dx=-2;dx<=2;dx++) for(let dy=-2;dy<=2;dy++){ const a=traffic.hash.get((kx+dx+4096)*8192+ky+dy+4096); if(!a) continue;
    for(const b of a){ if(b.veh===v) continue; const rx=jx-b.x, ry=jy-b.y, dist=Math.hypot(rx,ry);
      const inside= Math.abs(rx)<J.w*2+1.5 && Math.abs(ry)<J.h*2+1.5;
      if(inside && !(b.veh&&b.veh.trl===b) && Math.abs(b.vel||0)>0.2) return true;
      if(Math.abs(b.vel||0)<0.5) continue; if(Math.abs(Math.cos(b.h-v.h))>0.6) continue;
      const f=fwd(b.h), sgn=Math.sign(b.vel||1); if((f[0]*rx+f[1]*ry)*sgn<=0) continue;
      if(dist<8+Math.abs(b.vel)*3.2) return true; } }
  return false; }
function boxBlocked(v,m){ // UK box junction: don't enter unless the exit is clear
  for(let s=m.dEnd+0.5;s<m.dEnd+v.L+4;s+=2){ const p=pathAt(v,s); const kx=Math.floor(p[0]/HC), ky=Math.floor(p[1]/HC);
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){ const a=traffic.hash.get((kx+dx+4096)*8192+ky+dy+4096); if(!a) continue;
      for(const b of a){ if(b.veh===v) continue; if(Math.abs(b.vel||0)<2.5 && ptBoxDist(p[0],p[1],b)<v.W/2+0.3) return true; } } }
  return false; }
function releaseJ(v){ if(v.jHeld){ const o=v.jHeld.occ; const i=o.indexOf(v.jEntry); if(i>=0) o.splice(i,1); v.jHeld=null; } }
function idmAcc(v,v0,gap,vl){ const a=v.amax, b=3.0, T=v.heavy?1.7:1.25, s0=2.2; const ss=s0+Math.max(0,v.v*T+v.v*(v.v-vl)/(2*Math.sqrt(a*b)));
  return a*(1-Math.pow(v.v/Math.max(0.5,v0),4)-(gap<1e8?(ss/Math.max(0.1,gap))**2:0)); }
function updateTraffic(dt){
  const P=truck; traffic.hash.clear();
  for(const v of traffic.vs) for(const b of boxesOf(v)) hashAdd(b);
  const pbs=playerBoxes(); for(const b of pbs) hashAdd(b);
  if(world.trailers) for(const t of world.trailers){ if(t.coupled) continue; if(Math.abs(t.x-P.x)>400||Math.abs(t.y-P.y)>400) continue; const b=trailerBox(t); b.vel=0; hashAdd(b); }
  // spawn / despawn (GTA2 ring)
  if(timeS-traffic.lastTarget>1){ traffic.lastTarget=timeS; traffic.target=densityTarget(P.x,P.y); }
  let near=0; for(const v of traffic.vs) if(Math.hypot(v.x-P.x,v.y-P.y)<230) near++;
  traffic.near=near;
  for(let tries=0, made=0; tries<25 && made<3 && near+made<traffic.target && traffic.vs.length<130; tries++){
    const a=tRand()*6.283, d=95+tRand()*150; const x=P.x+Math.cos(a)*d, y=P.y+Math.sin(a)*d;
    if(onScreen(x,y,25)) continue; if(spawnVehicle(x,y)) made++; }
  for(let k=traffic.vs.length-1;k>=0;k--){ const v=traffic.vs[k]; const d=Math.hypot(v.x-P.x,v.y-P.y);
    if(d<70) v.pinT=timeS+60;
    if(d>300 && v.pinT<timeS && !onScreen(v.x,v.y,30)){ releaseJ(v); traffic.vs.splice(k,1); traffic.despawned++; } }
  // sub-stepped simulation
  const n=Math.ceil(dt/0.034), h=dt/n;
  for(let st=0;st<n;st++) for(const v of traffic.vs) stepVeh(v,h,pbs);
  updatePeds(dt);
}
function stepVeh(v,dt,pbs){
  const r=v.r; while(pathEnd(v)-v.s<90) if(!planPiece(v,r)) break;
  const sg=world.segs[v.plan.seg]; let v0=(SPEED[sg.type]||12)*v.drv; if(v.heavy) v0=Math.min(v0,v.kind==='bus'?14:22);
  const front=v.s+v.L/2;
  let acc=1e9, sig=0; v.ring=null;
  for(let k=v.mk.length-1;k>=0;k--){ const m=v.mk[k];
    const end=m.d1!==undefined?m.d1:(m.dEnd!==undefined?m.dEnd:m.d);
    if(v.s-v.L/2-(v.kind==='lorry'?14:0)>end+1){ if(m.kind==='gw'&&v.jHeld===m.J) releaseJ(v); v.mk.splice(k,1); continue; }
    if(m.kind==='slow'){ const gap=m.d0-front; if(gap<=0) v0=Math.min(v0,m.v); else v0=Math.min(v0,Math.sqrt(m.v*m.v+2*2.2*gap)); }
    else if(m.kind==='sig'){ if(v.s>m.d0&&v.s<m.d1) sig=m.side; }
    else if(m.kind==='ring'){ if(v.s>m.d0&&v.s<m.d1){ v.ring=m.rb; } }
    else if(m.kind==='major'){ }
    else if(m.kind==='light'||m.kind==='gw'||m.kind==='rb'){
      const gap=m.d-front-0.8; if(gap<-0.5||m.go) continue; if(gap>70) continue;
      let stop=false;
      if(m.kind==='light'){ const ls=sigState(m.J,m.key,m.move); if(ls==='r'||ls==='ra') stop=true; else if(ls==='a') stop= gap> v.v*v.v/(2*3.5)+1;
        if(!stop&&gap<12&&boxBlocked(v,m)) stop=true;            // never enter unless the exit is clear
        if(!stop&&gap<6&&jBusy(v,m.J)) stop=true;                 // give way to anything still crossing the junction
        if(!stop&&gap<3){ m.go=true; m.goT=timeS; if(traffic.goLog) traffic.goLog.push({J:m.J.id,key:m.key,mv:m.move,t:timeS,st:ls,veh:v.id}); } }
      else if(m.kind==='gw'){ if(gap<18){ if(!giveWayBusy(v,m.J)||v.stopT>10) { if(gap<2.5) m.go=true; } else stop=true; } }
      else { if(gap<14){ let busy=false; for(const o of traffic.vs){ if(o===v||o.ring!==m.rb) continue; const a=Math.atan2(o.y-m.rb.cy*M_T,o.x-m.rb.cx*M_T); const df=mod2pi(m.ang-a); if(df<1.5&&df>0.05){ busy=true; break; } }
          if(!busy||v.stopT>5) m.go=true; else stop=true; } }
      if(stop) acc=Math.min(acc,idmAcc(v,v0,Math.max(0.1,gap),0));
    }
  }
  v.sig=sig;
  // leader search along own path
  let lgap=1e9, lvel=0, lplayer=false; const cands=[];
  const kx=Math.floor(v.x/HC), ky=Math.floor(v.y/HC);
  for(let dx=-2;dx<=2;dx++) for(let dy=-2;dy<=2;dy++){ const a=traffic.hash.get((kx+dx+4096)*8192+ky+dy+4096); if(!a) continue;
    for(const b of a){ if(b.veh===v) continue; if(v.ghostT>0&&!b.player) continue; if(Math.abs(b.x-v.x)>48||Math.abs(b.y-v.y)>48) continue; cands.push(b); } }
  if(cands.length){ const half=v.W/2+0.35;
    for(let k=0;k<17;k++){ const sd=front+0.4+k*2.5; const p=pathAt(v,sd); const px=p[0]+v.offX, py=p[1]+v.offY;
      for(const b of cands){ if(ptBoxDist(px,py,b)<half){ const g=sd-front; if(g<lgap){ lgap=g; const rel=Math.cos(b.h-v.h); lvel=Math.max(0,(b.vel||0)*rel); lplayer=!!b.player; } } }
      if(lgap<1e8) break; } }
  if(lgap<1e8) acc=Math.min(acc,idmAcc(v,v0,lgap,lvel));
  acc=Math.min(acc,idmAcc(v,v0,1e9,0));
  if(v.shakeT>0){ v.shakeT-=dt; v.v=0; acc=0; }
  acc=Math.max(-9,acc);
  const pv=v.v; v.v=Math.max(0,v.v+acc*dt); if(lgap<0.6) v.v=Math.min(v.v,0.2);
  v.brake= acc<-0.6 || v.v<0.3;
  v.s+=v.v*dt; v.dist+=v.v*dt;
  // stuck handling / honks
  if(v.v<0.2){ v.stopT+=dt; } else v.stopT=0;
  if(lplayer&&lgap<10&&v.v<0.5){ v.blockT+=dt; } else v.blockT=Math.max(0,v.blockT-dt);
  v.honkT-=dt;
  if(v.honkT<=0 && (v.shakeT>1.3 || v.blockT>1.4 || (lplayer&&lgap<5&&pv>4))){ honkAt(v.x,v.y,v.heavy); v.honkT=2.5+v.r()*3; v.honking=0.5; }
  if(v.honking>0) v.honking-=dt;
  if(v.stopT>7 && !lplayer && lgap<6){ v.ghostT=2.5; v.stopT=0; }
  if(v.ghostT>0) v.ghostT-=dt;
  if(v.shakeT<=0 && (v.offX||v.offY)){
    // recovery: a forward shove is simply absorbed as progress along the path (never slide back into whoever hit us);
    // sideways displacement steers back into lane while driving (faster with speed), slowly when stood still
    const f=fwd(v.h), along=v.offX*f[0]+v.offY*f[1]; if(along>0){ v.s+=along; v.offX-=f[0]*along; v.offY-=f[1]*along; }
    const k=Math.exp(-dt*(0.35+0.45*Math.min(8,v.v))); v.offX*=k; v.offY*=k; if(Math.abs(v.offX)+Math.abs(v.offY)<0.02){ v.offX=0; v.offY=0; } }
  // fallback: stood still too long with nothing legitimate ahead (or pushed far off-lane) -> ghost through and re-join the lane
  if(v.stopT>6 && v.shakeT<=0 && v.hitEnd && timeS-v.hitEnd<40 && !(lplayer&&lgap<4)){ v.ghostT=3; v.stopT=0; v.recovers=(v.recovers||0)+1; traffic.recovers=(traffic.recovers||0)+1; }
  if(Math.hypot(v.offX,v.offY)>3.5 && v.stopT>2){ v.ghostT=Math.max(v.ghostT,2); }
  placeVeh(v); trimPath(v);
}
// ---------------- parked cars ----------------
function initParked(){
  const r=mulberry(777);
  const add=(x,y,h,kind)=>{ const t=VTYPES[kind]; const v={parked:true,kind,L:t.L,W:t.W,heavy:false,x,y,h,offX:0,offY:0,art:artFor(kind,r),v:0}; traffic.parked.push(v);
    const k=Math.floor(x/64)+','+Math.floor(y/64); let a=traffic.parkedIdx.get(k); if(!a){ a=[]; traffic.parkedIdx.set(k,a); } a.push(v); };
  for(const o of world.objects){
    if(o.kind==='lot'){ const x0=o.x/PPM, y0=o.y/PPM, w=o.w/PPM, h=o.h/PPM; const vert=h>w;
      if(!vert){ for(let row=0; row*6+5.5<=h; row++) for(let x=x0+1.6; x<x0+w-1.6; x+=2.8){ if(r()<0.55) add(x,y0+row*6+2.8,(row%2?0:Math.PI)+(r()-0.5)*0.06,pickW({hatch:3,sedan:3,estate:2,suv:2,van:1},r())); } }
      else { for(let col=0; col*6+5.5<=w; col++) for(let y=y0+1.6; y<y0+h-1.6; y+=2.8){ if(r()<0.55) add(x0+col*6+2.8,y,(col%2?Math.PI/2:-Math.PI/2)+(r()-0.5)*0.06,pickW({hatch:3,sedan:3,estate:2,suv:2,van:1},r())); } } }
  }
}
// ---------------- pedestrians ----------------
const WALKABLE=new Uint8Array(32); [T.WALK,T.PLAZA,T.PARK].forEach(t=>WALKABLE[t]=1);
const PED_COLS=['#c0392b','#2980b9','#27ae60','#f1c40f','#8e44ad','#ecf0f1','#2c3e50','#e67e22','#16a085','#7f8c8d'];
function updatePeds(dt){
  const P=truck, ps=traffic.peds;
  const want= traffic.target>20?34:traffic.target>10?18:6;
  for(let t=0;t<12&&ps.length<want;t++){ const a=tRand()*6.283, d=30+tRand()*90; const x=P.x+Math.cos(a)*d, y=P.y+Math.sin(a)*d; const tx=Math.floor(x/M_T), ty=Math.floor(y/M_T);
    if(!WALKABLE[get(tx,ty)]||onScreen(x,y,6)) continue; const dirs=[[1,0],[-1,0],[0,1],[0,-1]]; const dd=dirs[(tRand()*4)|0];
    ps.push({x:(tx+0.2+tRand()*0.6)*M_T,y:(ty+0.2+tRand()*0.6)*M_T,dx:dd[0],dy:dd[1],sp:1.1+tRand()*0.6,col:PED_COLS[(tRand()*PED_COLS.length)|0],hair:['#2b1d0e','#000','#8a5a2b','#d9c27a','#777'][(tRand()*5)|0],ph:tRand()*6,flee:0,down:0}); }
  const pb=playerBoxes();
  for(let k=ps.length-1;k>=0;k--){ const p=ps[k]; const d=Math.hypot(p.x-P.x,p.y-P.y);
    if(d>140){ ps.splice(k,1); continue; }
    if(p.down>0){ p.down-=dt; continue; }
    let sp=p.sp;
    const close=Math.min(...pb.map(b=>ptBoxDist(p.x,p.y,b)));
    if(close<0.3 && Math.abs(P.v)>1){ p.down=3; const f=fwd(P.h); p.x+=f[0]*1.5; p.y+=f[1]*1.5; continue; }
    if(close<7 && Math.abs(P.v)>2){ p.flee=1.5; const ax=p.x-pb[0].x, ay=p.y-pb[0].y; if(Math.abs(ax)>Math.abs(ay)){ p.dx=Math.sign(ax); p.dy=0; } else { p.dx=0; p.dy=Math.sign(ay); } }
    if(p.flee>0){ p.flee-=dt; sp=4.2; }
    const nx=p.x+p.dx*sp*dt, ny=p.y+p.dy*sp*dt; const t=get(Math.floor((nx+p.dx*0.6)/M_T),Math.floor((ny+p.dy*0.6)/M_T));
    if(WALKABLE[t]){ p.x=nx; p.y=ny; if(tRand()<dt*0.05){ const o=[[p.dy,p.dx],[-p.dy,-p.dx]][(tRand()*2)|0]; p.dx=o[0]; p.dy=o[1]; } }
    else { const dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(q=>WALKABLE[get(Math.floor((p.x+q[0]*1.2)/M_T),Math.floor((p.y+q[1]*1.2)/M_T))]&&!(q[0]===p.dx&&q[1]===p.dy)); if(dirs.length){ const q=dirs[(tRand()*dirs.length)|0]; p.dx=q[0]; p.dy=q[1]; } else { p.dx=-p.dx; p.dy=-p.dy; } }
    p.ph+=dt*sp*5;
  }
}
// ---------------- drawing ----------------
function blitV(a,x,y,h,L,W,dx,dy){ ctx.save(); ctx.translate(x*PPM+dx,y*PPM+dy); ctx.rotate(h); ctx.drawImage(a,-a.width/2*PPM/VS,-a.height/2*PPM/VS,a.width*PPM/VS,a.height*PPM/VS); ctx.restore(); }
function lampsOf(x,y,h,L,W,col,front,sides,rad){ const f=fwd(h), r=rgt(h); ctx.fillStyle=col; const ly=front?L/2-0.15:-(L/2-0.12);
  for(const s of sides){ ctx.beginPath(); ctx.arc((x+f[0]*ly+r[0]*s*(W/2-0.3))*PPM,(y+f[1]*ly+r[1]*s*(W/2-0.3))*PPM,rad,0,7); ctx.fill(); } }
function drawTraffic(vx0,vy0,vx1,vy1){
  const m=20; const inV=(x,y)=>x*PPM>vx0-m*PPM&&x*PPM<vx1+m*PPM&&y*PPM>vy0-m*PPM&&y*PPM<vy1+m*PPM;
  const list=[];
  const kx0=Math.floor(vx0/PPM/64)-1, kx1=Math.floor(vx1/PPM/64)+1, ky0=Math.floor(vy0/PPM/64)-1, ky1=Math.floor(vy1/PPM/64)+1;
  for(let kx=kx0;kx<=kx1;kx++) for(let ky=ky0;ky<=ky1;ky++){ const a=traffic.parkedIdx.get(kx+','+ky); if(a) for(const v of a) list.push(v); }
  for(const v of traffic.vs) if(inV(v.x,v.y)) list.push(v);
  // pedestrians
  for(const p of traffic.peds){ if(!inV(p.x,p.y)) continue; const X=p.x*PPM, Y=p.y*PPM;
    if(p.down>0){ ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(X-6,Y-1,13,5); ctx.fillStyle=p.col; ctx.fillRect(X-7,Y-3,10,5); ctx.fillStyle='#e0b48c'; ctx.beginPath(); ctx.arc(X+5,Y-1,2.2,0,7); ctx.fill(); continue; }
    const h=ang(p.dx,p.dy); ctx.save(); ctx.translate(X,Y); ctx.rotate(h); const sw=Math.sin(p.ph)*2.2;
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(2,2,3.6,2.6,0,0,7); ctx.fill();
    ctx.fillStyle='#2b2b33'; ctx.fillRect(-2.2,-1+sw,1.6,3.2); ctx.fillRect(0.6,-1-sw,1.6,3.2);
    ctx.fillStyle=p.col; ctx.beginPath(); ctx.ellipse(0,0,3.4,2.1,0,0,7); ctx.fill();
    ctx.fillStyle=p.hair; ctx.beginPath(); ctx.arc(0,0.2,1.7,0,7); ctx.fill(); ctx.restore(); }
  for(const v of list){ blitV(v.art.body.sh,v.x,v.y,v.h,v.L,v.W,4,4); if(v.trl) blitV(v.art.trl.sh,v.trl.x,v.trl.y,v.trl.h,13.6,2.55,6,6); }
  const blink=(timeS%0.8)<0.4;
  for(const v of list){
    if(v.trl){ blitV(v.art.trl.c,v.trl.x,v.trl.y,v.trl.h,13.6,2.55,0,0); }
    blitV(v.art.body.c,v.x,v.y,v.h,v.L,v.W,0,0);
    if(v.parked) continue;
    const rx=v.trl||v; const rL=v.trl?13.6:v.L, rW=v.trl?2.55:v.W;
    if(v.brake) lampsOf(rx.x,rx.y,rx.h,rL,rW,v.v<0.3?'rgba(255,30,20,0.75)':'rgba(255,40,30,0.95)',false,[-1,1],v.v<0.3?2.2:3);
    if(v.sig&&blink){ lampsOf(v.x,v.y,v.h,v.L,v.W,'rgba(255,170,0,0.95)',true,[v.sig],2.4); lampsOf(rx.x,rx.y,rx.h,rL,rW,'rgba(255,170,0,0.95)',false,[v.sig],2.4); }
    if(v.honking>0){ ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5; const f=fwd(v.h); const X=(v.x+f[0]*(v.L/2+1))*PPM, Y=(v.y+f[1]*(v.L/2+1))*PPM; for(let k=1;k<=2;k++){ ctx.beginPath(); ctx.arc(X,Y,k*5+(1-v.honking*2)*4,v.h-Math.PI/2-0.6,v.h-Math.PI/2+0.6); ctx.stroke(); } }
  }
}
