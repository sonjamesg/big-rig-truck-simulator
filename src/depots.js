'use strict';
// ===================== DEPOTS, TRAILERS, COUPLING & EVENT HOOKS =====================
// Data is mission-ready: depots (name, tier, entrance, numbered reverse-in bays), trailers (id, type, cargo, weight, reqLevel, target flag),
// and an event API: BigRig.on('couple'|'uncouple'|'parkedInBay', fn)  (also BigRig.onCouple/onUncouple/onParkedInBay).
const TRAILER_TYPES={
  curtain:{name:'Curtain-sider',tare:6800,level:1,cargos:[['Pallets of drinks',9000],['Building supplies',15000],['Paper rolls',19000]],cols:['#2e4053','#1f618d','#a93226','#1e8449','#7d6608']},
  fridge:{name:'Fridge box',tare:8600,level:2,cargos:[['Chilled food',8000],['Frozen food',15000],['Pharmaceuticals',5000]],cols:['#f4f4f4','#eaf2f8']},
  cont:{name:'Container skeletal',tare:4600,level:2,cargos:[['40ft container (general)',14000],['40ft container (machinery)',24000]],cols:['#c0392b','#2e86c1','#e67e22','#27ae60','#7f8c8d']},
  flat:{name:'Flatbed',tare:5800,level:3,cargos:[['Timber',13000],['Steel coils',26000],['Steel beams',22000]],cols:['#5b4a3a']},
  tank:{name:'Tanker',tare:7600,level:4,cargos:[['Milk',20000],['Diesel fuel',24000],['Chemicals (ADR)',22000]],cols:['#dfe3e6']},
  box:{name:'Box van',tare:7500,level:1,cargos:[['General freight',7000]],cols:['#f4f4f4']}
};
const TRL_KP_TO_CENTRE=5.6, TRL_LEN=13.6, TRL_W=2.55;
const BigRig={ listeners:{}, on(ev,fn){ (this.listeners[ev]=this.listeners[ev]||[]).push(fn); return ()=>this.off(ev,fn); },
  off(ev,fn){ const a=this.listeners[ev]; if(a){ const i=a.indexOf(fn); if(i>=0) a.splice(i,1); } },
  emit(ev,data){ (this.eventLog=this.eventLog||[]).push({ev,t:timeS,id:data&&data.trailer&&data.trailer.id,bay:data&&data.bay&&data.bay.label}); for(const f of (this.listeners[ev]||[]).slice()) try{ f(data); }catch(e){ console.error(e); } },
  onCouple(fn){ return this.on('couple',fn); }, onUncouple(fn){ return this.on('uncouple',fn); }, onParkedInBay(fn){ return this.on('parkedInBay',fn); },
  get depots(){ return world.depots; }, get trailers(){ return world.trailers; },
  trailer(id){ return world.trailers.find(t=>t.id===id); }, depot(id){ return world.depots.find(d=>d.id===id||d.name===id); },
  setTarget(tr,on=true){ if(typeof tr==='string') tr=this.trailer(tr); if(tr) tr.target=on; return tr; },
  setBayTarget(bay,on=true){ bay.target=on; return bay; },
  bayOf(tr){ return trailerInBay(tr); },
  coupledTrailer(){ return truck.trl; },
  BAY_TOL:{pos:0.9, ang:0.10}
};
window.BigRig=BigRig;
let trlSeq=0;
function trailerArt(kind,col,logo){
  const key='dt'+kind+col+logo; if(traffic.arts[key]) return traffic.arts[key];
  let c;
  if(kind==='tank'||kind==='flat'||kind==='box') c=makeTrailerArtAI(col,logo,kind==='box'?'box':kind);
  else { const L=TRL_LEN,W=TRL_W; c=vCanvas(L,W); const g=c.getContext('2d'),cx=c.width/2,X=m=>cx+m*VS,Y=m=>0.15*VS+m*VS;
    g.fillStyle='#121212'; for(const fy of [9.6,10.7,11.8]) for(const s of [-1,1]) g.fillRect(X(s*W/2-(s>0?0.12:0.08)),Y(fy),0.2*VS,0.8*VS);
    if(kind==='cont'){ g.fillStyle='#2a2c30'; g.fillRect(X(-0.5),Y(0),VS,L*VS); g.fillRect(X(-W/2),Y(0.3),W*VS,0.3*VS); g.fillRect(X(-W/2),Y(L-0.8),W*VS,0.3*VS);
      g.fillStyle=grad(g,X(-W/2),X(W/2),col); g.fillRect(X(-W/2+0.04),Y(0.4),(W-0.08)*VS,12.2*VS); g.strokeStyle='rgba(0,0,0,0.22)'; for(let k=0.6;k<12.5;k+=0.28){ g.beginPath(); g.moveTo(X(-W/2),Y(k)); g.lineTo(X(W/2),Y(k)); g.stroke(); }
      g.fillStyle='rgba(255,255,255,0.75)'; g.save(); g.translate(X(0),Y(6.5)); g.rotate(Math.PI/2); g.font=`900 ${0.8*VS}px Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(logo||'MAERSKO',0,0); g.restore();
      g.fillStyle='#ddd'; for(const [a,b] of [[0.45,-1],[0.45,1],[12.45,-1],[12.45,1]]) g.fillRect(X(b*(W/2-0.2))-3,Y(a)-3,6,6); }
    else if(kind==='curtain'){ g.fillStyle=grad(g,X(-W/2),X(W/2),col); g.fillRect(X(-W/2),Y(0),W*VS,L*VS);
      g.fillStyle='rgba(255,255,255,0.08)'; for(let k=0.3;k<L;k+=0.9) g.fillRect(X(-W/2),Y(k),W*VS,0.45*VS);
      g.fillStyle='rgba(0,0,0,0.35)'; for(let k=0.5;k<L;k+=1.2){ g.fillRect(X(-W/2),Y(k),0.12*VS,0.05*VS*4); g.fillRect(X(W/2-0.12),Y(k),0.12*VS,0.2*VS); }
      g.fillStyle='#d9dde2'; g.fillRect(X(-W/2),Y(0),W*VS,0.2*VS); g.fillRect(X(-W/2),Y(L-0.2),W*VS,0.2*VS);
      if(logo){ g.save(); g.translate(X(0),Y(L/2)); g.rotate(Math.PI/2); g.fillStyle='#fff'; g.font=`900 ${0.9*VS}px Arial Black,Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(logo,0,0); g.restore(); } }
    else { // fridge
      g.fillStyle=grad(g,X(-W/2),X(W/2),col); g.fillRect(X(-W/2),Y(0),W*VS,L*VS); g.strokeStyle='rgba(0,0,0,0.4)'; g.strokeRect(X(-W/2)+0.5,Y(0)+0.5,W*VS-1,L*VS-1);
      g.fillStyle='#4a4f57'; g.fillRect(X(-0.9),Y(0.05),1.8*VS,0.7*VS); g.fillStyle='#2b2e33'; for(let k=0;k<3;k++){ g.beginPath(); g.arc(X(-0.55+k*0.55),Y(0.4),0.2*VS,0,7); g.fill(); }
      g.fillStyle='#2e86c1'; g.save(); g.translate(X(0),Y(L/2)); g.rotate(Math.PI/2); g.font=`900 ${0.75*VS}px Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText((logo||'')+' \u2744 FRESH',0,0); g.restore(); }
    g.fillStyle='#6e0d0d'; g.fillRect(X(-W/2+0.08),Y(L-0.16),0.35*VS,0.12*VS); g.fillRect(X(W/2-0.43),Y(L-0.16),0.35*VS,0.12*VS); }
  return traffic.arts[key]={c,sh:shadowOf(c)};
}
function makeTrailer(type,r,opt={}){
  const T_=TRAILER_TYPES[type], ci=(r()*T_.cargos.length)|0, cg=T_.cargos[ci], col=T_.cols[(r()*T_.cols.length)|0], logo=COMPANIES[(r()*COMPANIES.length)|0];
  const heavy=cg[1]>=20000;
  const tr={id:'TR-'+String(++trlSeq).padStart(4,'0'),type,typeName:T_.name,cargo:cg[0],cargoKg:cg[1],tareKg:T_.tare,weight:T_.tare+cg[1],
    reqLevel:T_.level+(heavy?1:0),x:0,y:0,th:0,coupled:false,target:false,bay:null,logo,col,art:null};
  Object.assign(tr,opt); if(type!=='player') tr.art=trailerArt(type,tr.col,tr.logo); return tr;
}
function trailerBox(t){ const ft=fwd(t.th); return {x:t.x-ft[0]*TRL_KP_TO_CENTRE,y:t.y-ft[1]*TRL_KP_TO_CENTRE,h:t.th,L:TRL_LEN,W:TRL_W}; }
// ---------- world generation
function buildDepots(objs,R){ for(const _ of buildDepotsSteps(objs,R)); }
// original haulier identities for the purchasable yards (not real brands)
const YARD_BRANDS=[{name:'Ironhaul Logistics',mono:'IH',col:'#24508f',acc:'#f2b134',glyph:'chev'},{name:'Saltmarsh Freight',mono:'SF',col:'#1d7f73',acc:'#e8fff8',glyph:'wave'},{name:'Copperline Haulage',mono:'CL',col:'#a8532a',acc:'#ffe2c4',glyph:'bars'},{name:'Northwind Carriers',mono:'NW',col:'#4a3a8c',acc:'#bfe3ff',glyph:'peak'}];
const YD_H=24;   // up: yard = 15 rows of apron + warehouse strip + rail siding
function yardSpot(tx,ty,rj,dbg){ const OK=[T.GRASS,T.TREE,T.SAND,T.FIELD,T.HEDGE,T.GRAVEL,T.PGRASS,T.ROCK], ok=(i,j)=>inb(i,j)&&OK.includes(get(i,j))&&(!world.reserved[idx(i,j)]||get(i,j)===T.GRASS); let best=null,bd=1e9;
      for(let y=ty-320;y<=ty+320;y+=3) for(let x=tx-320;x<=tx+320;x+=3){ const dd=(x-tx)**2+(y-ty)**2; if(dd>=bd||rj(x,y)) continue; let gap=0;
        for(let g=1;g<=10&&!gap;g++){ const j=y-1-g; let r=0; for(let i=x+8;i<x+12;i++){ if(!inb(i,j)) break; const sid=world.roadH[idx(i,j)]; if(sid>=0&&world.segs[sid].type!=='hwy') r++; } if(r===4) gap=g; }
        if(!gap) continue; let good=true; for(let j=y-gap;j<y&&good;j++) for(let i=x+7;i<x+13;i++) if(!ok(i,j)&&get(i,j)!==T.WALK){ good=false; break; }
        for(let j=y;j<y+YD_H+1&&good;j++) for(let i=x-1;i<x+21;i++) if(!ok(i,j)){ good=false; break; } if(good){ best=[x,y,gap]; bd=dd; } } return best; }
function* buildDepotsSteps(objs,R){
  world.depots=[]; world.trailers=[];
  // bucket index of clearable scenery so clearing a site doesn't scan every object in the world
  const BK=16*TILE, bucket=new Map(), CLR={tree:1,hedge:1,bale:1,rock:1,scrub:1,cactus:1,field:1};
  for(const o of objs){ if(!CLR[o.kind]) continue; const w=o.w||0, h=o.h||0; for(let by=Math.floor(o.y/BK);by<=Math.floor((o.y+h)/BK);by++) for(let bx=Math.floor(o.x/BK);bx<=Math.floor((o.x+w)/BK);bx++){ const k=bx*4096+by; let a=bucket.get(k); if(!a){ a=[]; bucket.set(k,a); } a.push(o); } }
  const clearObjs=(x,y,w,h)=>{ const X0=x*TILE-8,Y0=y*TILE-8,X1=(x+w)*TILE+8,Y1=(y+h)*TILE+8; const cand=new Set();
    for(let by=Math.floor(Y0/BK);by<=Math.floor(Y1/BK);by++) for(let bx=Math.floor(X0/BK);bx<=Math.floor(X1/BK);bx++){ const a=bucket.get(bx*4096+by); if(a) for(const o of a) cand.add(o); }
    for(const o of cand){
      if((o.kind==='tree'||o.kind==='hedge'||o.kind==='bale'||o.kind==='rock'||o.kind==='scrub'||o.kind==='cactus')&&o.x>=X0&&o.x<=X1&&o.y>=Y0&&o.y<=Y1) o._dead=1;
      else if(o.kind==='field'&&o.x<X1&&o.x+o.w>X0&&o.y<Y1&&o.y+o.h>Y0){ o._dead=1; if(world.crops){ const k=world.crops.indexOf(o); if(k>=0) world.crops.splice(k,1); } if(world.animals) for(const a of world.animals) if(a.x>=o.x&&a.x<=o.x+o.w&&a.y>=o.y&&a.y<=o.y+o.h) a._dead=1; } } };
  function makeDepot(name,code,tier,x,y,w,h,opts={}){
    const dp={id:'D'+(world.depots.length+1),name,code,tier,x,y,w,h,bays:[],entrance:null};
    if(!opts.keep){ clearObjs(x,y,w,h); fill(x,y,w,h,T.CONC); for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) world.reserved[idx(i,j)]=1;
      fill(x+1,y+1,6,4,T.BLDG); objs.push({kind:'bldg',x:(x+1)*TILE,y:(y+1)*TILE,w:6*TILE,h:4*TILE,style:'warehouse',height:22,seed:(R()*1e9)|0,logo:code}); }
    objs.push({kind:'yard',dp,x:(x+(opts.keep?2:8))*TILE,y:(y+(opts.keep?7:1.5))*TILE,w:12*TILE,h:2*TILE});
    const nb=Math.min(opts.maxBays||14,Math.floor((w-1.5)/1.25)), bx0=x+(w-nb*1.25)/2;
    for(let k=0;k<nb;k++){ const cxT=bx0+k*1.25+0.625, y0=y+h-4.7, y1=y+h-0.3;
      const bay={id:k+1,label:code+'-'+(k+1),depot:dp,cx:cxT*M_T,cy:(y0+y1)/2*M_T,th:0,w:1.25*M_T,L:(y1-y0)*M_T,target:false,trailer:null,x0:(cxT-0.625)*M_T,x1:(cxT+0.625)*M_T,y0:y0*M_T,y1:y1*M_T,dock:y1*M_T};
      bay.kx=bay.cx; bay.ky=bay.cy-TRL_KP_TO_CENTRE+0.2;   // where the kingpin must be (reverse-in: trailer nose faces the yard)
      dp.bays.push(bay); objs.push({kind:'tbay',bay,x:(cxT-0.625)*TILE,y:(y0-0.6)*TILE,w:1.25*TILE,h:(y1-y0+0.6)*TILE}); }
    dp.entrance=opts.entrance||{x:(x+w/2)*M_T,y:(y-1)*M_T};
    world.depots.push(dp); return dp;
  }
  // start depot (city block, keeps its building)
  const sd=world.startDepot; const D0=makeDepot('Big Rig Haulage HQ','HQ',1,sd.x0,sd.y0,sd.w,sd.h,{keep:true,entrance:{x:(sd.x0+sd.w)*M_T,y:(sd.y0+15)*M_T}});
  // other depots: find open grass next to a (non-motorway) road
  const okT=t=>t===T.GRASS||t===T.TREE||t===T.SAND||t===T.QUAY||t===T.FIELD||t===T.HEDGE||t===T.GRAVEL||t===T.WALK||t===T.PGRASS||t===T.ROCK||t===T.CONC;
  function findSpot(tx,ty,w,h,maxGap,rej,allowB,maxR){ const okB=allowB?(t=>okT(t)||t===T.BLDG||t===T.LOT||t===T.PLAZA):okT, soft=t=>allowB&&(t===T.WALK||t===T.PLAZA||t===T.PGRASS||t===T.BLDG||t===T.LOT);
    // summed-area table of unusable tiles over the search window (fast rectangle tests)
    const RAD=162, X0=Math.max(0,tx-RAD-2), Y0=Math.max(0,ty-RAD-2), X1=Math.min(MW-1,tx+RAD+w+3), Y1=Math.min(MH-1,ty+RAD+h+3), SW=X1-X0+2, sat=new Int32Array(SW*(Y1-Y0+2));
    for(let j=Y0;j<=Y1;j++){ let row=0; const o=(j-Y0+1)*SW, op=(j-Y0)*SW; for(let i=X0;i<=X1;i++){ const k=idx(i,j); row+=(!okB(G[k])||(world.reserved[k]&&!soft(G[k])))?1:0; sat[o+i-X0+1]=sat[op+i-X0+1]+row; } }
    const badIn=(x,y,ww,hh)=>{ if(x<X0||y<Y0||x+ww-1>X1||y+hh-1>Y1) return true; const a=x-X0, b=y-Y0, c=a+ww, d=b+hh; return sat[d*SW+c]-sat[b*SW+c]-sat[d*SW+a]+sat[b*SW+a]>0; };
    for(let rad=0;rad<(maxR||160);rad+=2) for(let dy=-rad;dy<=rad;dy+=2) for(let dx=-rad;dx<=rad;dx+=2){ if(Math.max(Math.abs(dx),Math.abs(dy))!==rad) continue;
      const x=tx+dx, y=ty+dy; if(x<2||y<4||x+w>MW-2||y+h>MH-2) continue;
      if(badIn(x-1,y,w+2,h+1)) continue; if(rej&&rej(x,y)) continue;
      for(let gap=1;gap<=(maxGap||8);gap++){ const j=y-1-gap; let road=0; for(let i=x+w/2-2;i<x+w/2+2;i++){ const sid=world.roadH[idx(i,j)]; if((get(i,j)===T.ROAD||get(i,j)===T.BRIDGE)&&sid>=0&&world.segs[sid].type!=='hwy'&&world.roadV[idx(i,j)]<0) road++; }
        if(road===4){ let clear=true; for(let jj=y-gap;jj<y;jj++) for(let i=x+w/2-3;i<x+w/2+3;i++) if((!okB(get(i,jj))&&get(i,jj)!==T.WALK)||(world.reserved[idx(i,jj)]&&!soft(get(i,jj)))) clear=false; if(clear) return [x,y,gap]; } }
    } return null; }
  const region=(x,y)=> world.regionAt(x,y);
  const plan=[['Albion Airport Cargo','AAC',3,620,470],['Millford Agri Depot','MAD',1,300,900],['Ashby Farm Supplies','AFS',1,280,1170],['Greyfell Quarry','GQY',4,120,1610],
    ['Sandvale Distribution','SVD',3,1560,520],['Sandvale Air Cargo','SAC',4,1300,360],['Dustwater Outpost','DWO',2,1020,500],['Coppermine Mine','CMM',4,1640,660],
    ['Kingsbridge Freight Park','KFP',3,1415,1386],['Kingsbridge Harbour Terminal','KHT',3,1640,1832],['Redhill Logistics','RHL',2,1000,1792],['Moorside Timber Yard','MTY',2,1830,1510]];
  const access=(x,y,w,gap)=>{ for(let jj=y-gap;jj<y;jj++) for(let i=x+(w>>1)-3;i<x+(w>>1)+3;i++){ set(i,jj,T.CONC); world.reserved[idx(i,jj)]=1; } clearObjs(x+(w>>1)-3,y-gap,6,gap); };
  if(world.port){ const H=world.port.hole, gap=H.y-(world.port.aisles[3]+4); access(H.x,H.y,20,gap); const dp=makeDepot('Albion Port Container Terminal','APT',2,H.x,H.y,20,15,{entrance:{x:(H.x+10)*M_T,y:(H.y-gap)*M_T}}); dp.region=region(H.x,H.y); }
  for(const [n,c,tier,tx,ty] of plan){ const s=findSpot(tx,ty,20,15); if(!s){ console.warn('no depot spot',n); continue; } const [x,y,gap]=s;
    access(x,y,20,gap); const dp=makeDepot(n,c,tier,x,y,20,15,{entrance:{x:(x+10)*M_T,y:(y-gap)*M_T}}); dp.region=region(x,y); }
  D0.region='Westmere';
  yield 'Building fuel stations';
  // ---- petrol / truck stops
  world.fuel=[]; world.garages=[];
  const BRANDS=[['ROADSTAR','#c0392b'],['FUELWAY','#1e8449'],['TRUCKSTOP','#2471a3'],['NORTHGAS','#d68910']];
  function fuelStation(name,x,y,gap,price){ const w=18,h=12; access(x,y,w,gap); clearObjs(x,y,w,h); fill(x,y,w,h,T.CONC); for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) world.reserved[idx(i,j)]=1;
    const br=BRANDS[world.fuel.length%BRANDS.length];
    for(const ix of [x+5,x+11]) for(let j=y+3;j<y+6;j++){ set(ix,j,T.PUMP); objs.push({kind:'pump',x:ix*TILE,y:j*TILE}); }
    world.overhead.push({kind:'canopy',x:(x+2)*TILE,y:(y+2)*TILE,w:14*TILE,h:5*TILE});
    fill(x+1,y+h-3,6,3,T.BLDG); objs.push({kind:'bldg',x:(x+1)*TILE,y:(y+h-3)*TILE,w:6*TILE,h:3*TILE,style:'shop',height:14,seed:(R()*1e9)|0,front:'n',sign:'SHOP',awning:br[1]});
    objs.push({kind:'fsign',x:(x+w-1.5)*TILE,y:(y+1.2)*TILE,r:30,brand:br[0],col:br[1],price});
    objs.push({kind:'paint',x:(x+8)*TILE,y:(y+h-2)*TILE,text:'DIESEL',small:true});
    const zones=[[x+1.6,y+1,x+5,y+9.5],[x+6,y+1,x+11,y+9.5],[x+12,y+1,x+16.5,y+9.5]].map(z=>z.map(v=>v*M_T));
    world.fuel.push({id:'F'+(world.fuel.length+1),name,brand:br[0],price,x:(x+w/2)*M_T,y:(y+h/2)*M_T,zones,region:region(x,y)}); }
  const cf=world.cityFuel; if(cf) world.fuel.push({id:'F0',name:'Albion City Fuel',brand:'ROADSTAR',price:1.59,x:(cf.x0+9)*M_T,y:(cf.y0+11)*M_T,zones:[[(cf.x0+3)*M_T,(cf.y0+10.9)*M_T,(cf.x0+14)*M_T,(cf.y0+13.5)*M_T]],region:world.regionAt(cf.x0,cf.y0)});
  const fplan=[['Millford Services',330,900],['Ashby Pumps',300,1170],['Airport Road Fuel',560,470],['Dustwater Fuel',1060,500],['Sandvale Truckstop',1800,520],['Coppermine Fuel',1600,670],['Redhill Services',1060,1250],['Fenwick Pumps',1560,1200],['Kingsbridge Truckstop',1800,1760],['Moor Field Diesel',1300,1790]];
  // v7 forecourt: car canopy in the middle-west, HGV diesel lanes with marked bays + tall pumps on the side, shop, price board, air/water
  function forecourt(name,x,y,gap,price){ const w=26,h=20;
    for(let jj=y-gap;jj<y;jj++) for(let i=x+8;i<x+23;i++){ const t=get(i,jj); if((okT(t)||t===T.CONC)&&!world.reserved[idx(i,jj)]){ set(i,jj,T.CONC); world.reserved[idx(i,jj)]=1; } }
    clearObjs(x+8,y-gap,15,gap); access(x,y,w,gap);
    clearObjs(x,y,w,h); fill(x,y,w,h,T.CONC); for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) world.reserved[idx(i,j)]=1;
    const br=BRANDS[world.fuel.length%BRANDS.length], M=v=>v*M_T;
    // car islands + canopy
    for(const ix of [x+3,x+7]) for(let j=y+5;j<y+7;j++){ set(ix,j,T.PUMP); objs.push({kind:'pump',x:ix*TILE,y:j*TILE,car:1}); }
    world.overhead.push({kind:'canopy',x:(x+1)*TILE,y:(y+3)*TILE,w:9.6*TILE,h:6*TILE,col:br[1],brand:br[0]});
    const spots=[2.5,4.5,6.5,8.5].map(sx=>({x:M(x+sx),y:M(y+6),busy:null}));
    // HGV lanes
    set(x+19,y+5,T.PUMP); set(x+19,y+6,T.PUMP); set(x+19,y+7,T.PUMP); set(x+19,y+8,T.PUMP);
    objs.push({kind:'hgvisland',x:(x+19)*TILE,y:(y+4.6)*TILE,w:TILE,h:4.8*TILE,col:br[1]});
    const bays=[[M(x)+70,M(x)+75.6],[M(x)+80.4,M(x)+86]].map((r,i)=>({x0:r[0],x1:r[1],y0:M(y+1.5),y1:M(y+15),id:i+1}));
    for(const b of bays) objs.push({kind:'hgvbay',x:b.x0*PPM,y:b.y0*PPM,w:(b.x1-b.x0)*PPM,h:(b.y1-b.y0)*PPM,n:b.id});
    // shop + air/water + price board + paint
    fill(x+21,y+10,5,5,T.BLDG); objs.push({kind:'bldg',x:(x+21)*TILE,y:(y+10)*TILE,w:5*TILE,h:5*TILE,style:'shop',height:14,seed:(R()*1e9)|0,front:'w',sign:'SHOP',awning:br[1]});
    objs.push({kind:'airw',x:(x+20.2)*TILE,y:(y+16)*TILE,w:34,h:22});
    objs.push({kind:'pboard',x:(x+0.6)*TILE,y:(y+0.4)*TILE,w:66,h:78,brand:br[0],col:br[1],price});
    objs.push({kind:'paint',x:(x+2)*TILE,y:(y+10.5)*TILE,text:'CARS',small:true});
    objs.push({kind:'fcarrows',x:x*TILE,y:y*TILE,w:26*TILE,h:20*TILE});
    const zones=spots.map(p=>[p.x-2.3,p.y-4.5,p.x+2.3,p.y+4.5]);
    world.fuel.push({id:'F'+(world.fuel.length+1),name,brand:br[0],price,x:M(x+w/2),y:M(y+h/2),zones,hgv:bays,spots,v7:true,x0:M(x),y0:M(y),gap,
      entIn:[M(x+12.5),M(y-gap)-1.5],entOut:[M(x+15.5),M(y-gap)-1.5],aisleIn:M(x+12.5),aisleOut:M(x+15.5),region:region(x,y)}); }
  const tf0=performance.now(); for(const [n,tx,ty] of fplan){ let s=findSpot(tx,ty,26,20); if(s){ forecourt(n,s[0],s[1],s[2],+(1.49+R()*0.25).toFixed(2)); continue; }
    s=findSpot(tx,ty,18,12); if(!s){ console.warn('no fuel spot',n); continue; } fuelStation(n,s[0],s[1],s[2],+(1.49+R()*0.25).toFixed(2)); }
  yield 'Building garages';
  // ---- repair garages (stub for later: damage repairs)
  function garage(name,x,y,gap,w=14,h=10){ access(x,y,w,gap); clearObjs(x,y,w,h); fill(x,y,w,h,T.CONC); for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) world.reserved[idx(i,j)]=1;
    fill(x+w-13,y+h-5,12,5,T.BLDG); objs.push({kind:'bldg',x:(x+w-13)*TILE,y:(y+h-5)*TILE,w:12*TILE,h:5*TILE,style:'warehouse',height:20,seed:(R()*1e9)|0,logo:'TRUCK REPAIRS'});
    objs.push({kind:'paint',x:(x+2)*TILE,y:(y+1.2)*TILE,text:'REPAIRS',small:true});
    world.garages.push({id:'G'+(world.garages.length+1),name,x:(x+w/2)*M_T,y:(y+h/2)*M_T,bay:{x:(x+w/2)*M_T,y:(y+2.5)*M_T},ratePerPct:45,region:region(x,y)}); }
  for(const [n,tx,ty] of [['Albion Truck Repairs',420,470],['Millford Motors',360,900],['Sandvale Heavy Repairs',1700,520],['Dustwater Garage',1000,520],['Kingsbridge Commercial',1600,1760],['Redhill Garage',980,1260]]){ const s=findSpot(tx,ty,14,10); if(s) garage(n,s[0],s[1],s[2]); }
if(typeof buildCareerSites==='function') buildCareerSites({findSpot,access,clearObjs,region,R,objs,okT});
  yield 'Building city fuel & garages';
  // v13: every city gets 4 fuel stations (HGV bays + car pumps) and 4 artic-friendly repair garages, spread over its districts
  { const CN={C1:'Albion',SV:'Sandvale',KB:'Kingsbridge',MF:'Millford',DW:'Dustwater',CM:'Coppermine',RH:'Redhill',FW:'Fenwick',AB:'Ashby'}, Q=['North','East','South','West','Central','Park','Ring','Bridge'];
    world.cityPOI={};
    for(const k in CN){ const c=world.cities[k]; if(!c) continue; const x0=c.xs[0], y0=c.ys[0], x1=c.X1, y1=c.Y1, cx=(x0+x1)/2, cy=(y0+y1)/2, hw=(x1-x0)/2, hh=(y1-y0)/2, mg=Math.max(hw,hh)<40?130:Math.max(hw,hh)<90?80:40;
      const inC=p=>{ const tx=p.x/M_T, ty=p.y/M_T; return tx>x0-mg&&tx<x1+mg&&ty>y0-mg&&ty<y1+mg; };
      const tg=[[0,-.55],[.55,0],[0,.55],[-.55,0],[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>[Math.round(cx+a*hw),Math.round(cy+b*hh)]); for(const [a,b] of [[0,-1.3],[1.3,0],[0,1.3],[-1.3,0],[1,-1],[1,1],[-1,1],[-1,-1]]) tg.push([Math.round(cx+a*hw),Math.round(cy+b*hh)]);
      const far=(list,d)=>(x,y)=>x<x0-mg||x>x1+mg-20||y<y0-mg||y>y1+mg-16||list.some(p=>Math.hypot(p.x/M_T-x,p.y/M_T-y)<d);
      const clrB=(x,y,w,h)=>{ const X0=x*TILE,Y0=y*TILE,X1=(x+w)*TILE,Y1=(y+h)*TILE; for(const o of objs){ if(o._dead||!(o.kind==='bldg'||o.kind==='lot'||o.kind==='awning')||o.w===undefined) continue; if(o.x<X1&&o.x+o.w>X0&&o.y<Y1&&o.y+o.h>Y0){ o._dead=1; if(o.kind!=='awning'){ const a=Math.floor(o.x/TILE),b=Math.floor(o.y/TILE); for(let j=b;j<b+Math.ceil(o.h/TILE);j++) for(let i=a;i<a+Math.ceil(o.w/TILE);i++) if(!world.reserved[idx(i,j)]&&(get(i,j)===T.BLDG||get(i,j)===T.LOT||get(i,j)===T.PLAZA)) set(i,j,T.PGRASS); } } } };
      const spotB=(tx,ty,w,h,rej)=>{ const sp=findSpot(tx,ty,w,h,8,rej,true); if(sp){ clrB(sp[0]-1,sp[1]-sp[2],w+2,h+sp[2]); } return sp; };
      const fs=()=>world.fuel.filter(inC), gs=()=>world.garages.filter(inC), MR=Math.round(Math.max(hw,hh)+mg), pr=()=>+(1.49+R()*0.25).toFixed(2);
      const tryF=(nm,tx,ty,sep)=>{ for(const [w,h,b,f] of [[26,20,0,1],[18,12,0,.6],[26,20,1,.6],[18,12,1,.4]]){ const sp=findSpot(tx,ty,w,h,16,far(fs(),sep*f),!!b,MR); if(sp){ if(b) clrB(sp[0]-1,sp[1]-sp[2],w+2,h+sp[2]); (w===26?forecourt:fuelStation)(nm,sp[0],sp[1],sp[2],pr()); return true; } } return false; };
      const tryG=(nm,tx,ty,sep)=>{ for(const [w,h,b,f] of [[22,14,0,1],[22,14,1,.6],[14,10,1,.5],[14,10,1,.25]]){ const sp=findSpot(tx,ty,w,h,16,far(gs(),sep*f),!!b,MR); if(sp){ if(b) clrB(sp[0]-1,sp[1]-sp[2],w+2,h+sp[2]); garage(nm,sp[0],sp[1],sp[2],w,h); return true; } } return false; };
      const sep=Math.max(14,Math.min(hw,hh)*0.5);
      for(let t=0;fs().length<4&&t<10;t++){ const [tx,ty]=tg[t]; if(!tryF(CN[k]+' '+Q[t%8]+(t>=8?' Road':'')+' Fuel',tx,ty,sep)) t+=0; }
      for(let t=0;gs().length<4&&t<10;t++){ const [tx,ty]=tg[(t+2)%16]; tryG(CN[k]+' '+Q[(t+2)%8]+((t+2)%16>=8?' Road':'')+' Truck Repairs',tx,ty,sep); }
      world.cityPOI[CN[k]]={fuel:fs().length,garages:gs().length}; }
    console.log('[sites] per city fuel+garages',JSON.stringify(world.cityPOI)); }
  // v31 empty yards FOR SALE (tier-1 player depots; bought per player, see owndepot.js)
  world.forSale=[]; for(const [tx,ty] of [[380,960],[1010,1300],[1640,1700],[700,700],[1300,900],[900,1600],[400,1400],[1400,1450],[250,800],[1150,1350]]){ if(world.forSale.length>=3) break; const rj=(x,y)=>world.forSale.some(o=>Math.abs(o.x0-x)<120&&Math.abs(o.y0-y)<120); const s=findSpot(tx,ty,20,YD_H,16,rj)||yardSpot(tx,ty,rj); if(!s) continue; const BR=YARD_BRANDS[world.forSale.length%YARD_BRANDS.length], n=BR.name; const [x,y,gap]=s;
    access(x,y,20,gap); clearObjs(x,y,20,YD_H); fill(x,y,20,YD_H,T.CONC); for(let j=y;j<y+YD_H;j++) for(let i=x;i<x+20;i++) world.reserved[idx(i,j)]=1;
    const yd={id:'Y'+(world.forSale.length+1),name:n,tier:1,x0:x,y0:y,w:20,h:YD_H,x:(x+10)*M_T,y:(y+7.5)*M_T,entrance:{x:(x+10)*M_T,y:(y-gap)*M_T},slot:{x:(x+10)*M_T,y:(y+3.2)*M_T,w:7,L:12},bays:[],region:region(x,y)};
    for(let k=0;k<8;k++){ const cxT=x+7.5+k*1.25+0.625, y0=y+15-4.7, y1=y+15-0.3; const b={id:k+1,label:yd.id+'-'+(k+1),depot:yd,cx:cxT*M_T,cy:(y0+y1)/2*M_T,th:0,w:1.25*M_T,L:(y1-y0)*M_T,x0:(cxT-0.625)*M_T,x1:(cxT+0.625)*M_T,y0:y0*M_T,y1:y1*M_T,dock:y1*M_T}; b.kx=b.cx; b.ky=b.cy-TRL_KP_TO_CENTRE+0.2; b.need=k<4?1:k<6?2:3; if(b.need>1) b.assigned=true; yd.bays.push(b); }
    Object.assign(yd,{brand:BR,office:{x0:x+1,y0:y+1,w:5,h:4},garage:{x0:x+14,y0:y+1,w:5,h:3}}); fill(x+1,y+1,5,4,T.BLDG); fill(x+14,y+1,5,3,T.BLDG); fill(x+7,y+15,6,4,T.BLDG); yd.wh={x0:x+7,y0:y+15,w:6,h:4}; yd.wh2={x0:x+13,y0:y+15,w:6,h:4}; yd.hq={x0:x+1,y0:y+15,w:5,h:4};   // T1 warehouse (bays back onto it); T2 warehouse + T3 HQ become solid on upgrade   // solid site office + truck garage
    yd.gslot={x:(x+16.5)*M_T,y:(y+5.6)*M_T,w:7,L:10}; yd.oslot={x:(x+3.5)*M_T,y:(y+6.6)*M_T,w:7,L:9}; yd.sslot={x:(x+3.5)*M_T,y:(y+12)*M_T,w:7,L:10};
    world.forSale.push(yd); }
  yield 'Parking trailers';
  // fill bays with parked trailers
  const types=['curtain','curtain','fridge','cont','flat','tank'];
  for(const dp of world.depots) dp.bays.forEach((bay,i)=>{ if(R()<(dp===D0?0.7:0.55)){ const tr=makeTrailer(types[(R()*types.length)|0],R); tr.x=bay.kx; tr.y=bay.ky; tr.th=bay.th; tr.bay=bay; tr.depot=dp; bay.trailer=tr; world.trailers.push(tr); } });
}
function drawTrailerBay(g,o){ const b=o.bay, x=o.x, y=o.y, w=o.w, h=o.h;
  g.fillStyle=b.target?'rgba(255,214,0,0.18)':'rgba(0,0,0,0.04)'; g.fillRect(x,y+18,w,h-18);
  g.fillStyle='#ececec'; g.fillRect(x,y+18,3,h-18); g.fillRect(x+w-3,y+18,3,h-18); g.fillStyle='#f2c230'; g.fillRect(x,y+h-5,w,5);
  for(let k=y+40;k<y+h-30;k+=26){ g.fillStyle='rgba(236,236,236,0.6)'; g.beginPath(); g.moveTo(x+w/2-8,k); g.lineTo(x+w/2+8,k); g.lineTo(x+w/2,k+9); g.closePath(); g.fill(); }
  g.fillStyle='#ececec'; g.font='bold 18px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(b.id),x+w/2,y+8); }
function drawYardSign(g,o){ g.save(); g.fillStyle='rgba(240,240,230,0.8)'; g.font='bold 26px sans-serif'; g.textBaseline='top'; g.textAlign='left'; g.fillText(o.dp.name.toUpperCase(),o.x,o.y);
  g.font='bold 14px sans-serif'; g.fillText('TIER '+o.dp.tier+' \u2022 REVERSE INTO NUMBERED BAYS',o.x,o.y+30); g.restore(); }
// ---------- bay check
function trailerInBay(tr){ if(!tr||tr.coupled) return null;
  for(const dp of world.depots){ if(Math.abs(dp.bays[0]?.cx-tr.x)>200) continue;
    for(const b of dp.bays){ if(Math.hypot(tr.x-b.kx,tr.y-b.ky)<=BigRig.BAY_TOL.pos && Math.abs(wrapA(tr.th-b.th))<=BigRig.BAY_TOL.ang) return b; } }
  return null; }
// ---------- coupling
let coupleMsg={t:-9,text:''};
function flash(text){ coupleMsg={t:timeS,text}; }
function coupleCandidate(){ const s=truck; if(s.trl) return null; const k=kingpin(s); let best=null;
  for(const tr of world.trailers){ if(tr.coupled) continue; const d=Math.hypot(tr.x-k[0],tr.y-k[1]); if(d>28) continue; if(!best||d<best.d) best={tr,d,a:wrapA(s.h-tr.th)}; }
  if(best){ const ft=fwd(best.tr.th); best.along=(k[0]-best.tr.x)*ft[0]+(k[1]-best.tr.y)*ft[1]; const rt=rgt(best.tr.th); best.lat=(k[0]-best.tr.x)*rt[0]+(k[1]-best.tr.y)*rt[1];
    best.ok= best.d<1.0 && Math.abs(best.a)<0.2 && Math.abs(s.v)<1.2; }
  return best; }
function clunk(str){ thump(str); const ctx=audio.ctx; if(!ctx) return; const t=ctx.currentTime; const o=ctx.createOscillator(); o.type='square'; o.frequency.setValueAtTime(1300,t); o.frequency.exponentialRampToValueAtTime(300,t+0.06);
  const g=ctx.createGain(); g.gain.setValueAtTime(0.25*str,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09); o.connect(g); g.connect(audio.master); o.start(t); o.stop(t+0.1); noiseBurst(0.15,2600,2,0.35*str); }
function couple(c){ const s=truck, tr=c.tr, k=kingpin(s);
  s.x+=tr.x-k[0]; s.y+=tr.y-k[1]; s.th=tr.th; s.v=0; s.trl=tr; tr.coupled=true;
  const bay=tr.bay; if(bay){ bay.trailer=null; tr.bay=null; }
  clunk(1); setTimeout(()=>airHiss(),250); flash('Coupled: '+tr.id+' \u2022 '+tr.typeName+' \u2022 '+tr.cargo+' ('+(tr.weight/1000).toFixed(1)+' t)');
  BigRig.emit('couple',{trailer:tr,fromBay:bay}); }
function uncouple(){ const s=truck, tr=s.trl; if(!tr) return; const k=kingpin(s);
  tr.x=k[0]; tr.y=k[1]; tr.th=s.th; tr.coupled=false; s.trl=null; s.th=s.h;
  clunk(0.6); airHiss(); flash('Uncoupled '+tr.id+' \u2014 landing legs down');
  BigRig.emit('uncouple',{trailer:tr});
  const bay=trailerInBay(tr); if(bay){ tr.bay=bay; bay.trailer=tr; flash('Parked '+tr.id+' in bay '+bay.label+' \u2714'); BigRig.emit('parkedInBay',{trailer:tr,bay,depot:bay.depot}); } }
function toggleCouple(){
  const s=truck; if(s.trl){ if(Math.abs(s.v)>0.3){ flash('Stop the lorry before uncoupling'); return; } uncouple(); return; }
  const c=coupleCandidate(); if(c&&c.ok){ couple(c); return; }
  if(c&&c.d<12) flash('Not lined up: reverse slowly so the fifth wheel meets the kingpin'); else flash('No trailer behind you'); }
// ---------- collisions vs parked trailers
function trailerHitTest(s){
  if(!world.trailers) return null; const f=fwd(s.h);
  const cabBody={x:s.x+f[0]*3.7,y:s.y+f[1]*3.7,h:s.h,L:2.6,W:CAB.w-0.1};
  const k=kingpin(s), ft=fwd(s.th); const myT=s.trl?{x:k[0]-ft[0]*TRL_KP_TO_CENTRE,y:k[1]-ft[1]*TRL_KP_TO_CENTRE,h:s.th,L:TRL_LEN-0.2,W:TRL_W-0.1}:null;
  const r=rgt(s.h); const chassis=[[1.2,-0.9],[1.2,0.9],[-1.0,0],[0.3,-0.9],[0.3,0.9]].map(([ly,lx])=>[s.x-f[0]*ly+r[0]*lx,s.y-f[1]*ly+r[1]*lx]);
  for(const t of world.trailers){ if(t.coupled) continue; if(Math.abs(t.x-s.x)>30||Math.abs(t.y-s.y)>30) continue;
    const tb=trailerBox(t); if(obbMTV(tb,cabBody)) return 'cab'; if(myT&&obbMTV(tb,myT)) return 'trailer';
    const tf=fwd(t.th), tr=rgt(t.th);
    for(const p of chassis){ const dx=p[0]-tb.x, dy=p[1]-tb.y, lf=dx*tf[0]+dy*tf[1], lr=dx*tr[0]+dy*tr[1]; if(Math.abs(lr)<TRL_W/2 && Math.abs(lf)<TRL_LEN/2 && (TRL_LEN/2-lf)>3.0) return 'cab'; } }
  return null; }
// ---------- drawing
function drawTrailerAt(tr,kx,ky,th,shadow){
  if(tr.type==='player'){ if(shadow) blit(TRLSH,kx,ky,th,6,6); else blit(TRLART,kx,ky,th); return; }
  const ft=fwd(th), cx=kx-ft[0]*TRL_KP_TO_CENTRE, cy=ky-ft[1]*TRL_KP_TO_CENTRE;
  if(!tr.art||!tr.art.sh) return;
  if(shadow) blitV(tr.art.sh,cx,cy,th,TRL_LEN,TRL_W,6,6); else blitV(tr.art.c,cx,cy,th,TRL_LEN,TRL_W,0,0); }
function drawParkedTrailers(vx0,vy0,vx1,vy1){
  const vis=[]; for(const t of world.trailers){ if(t.coupled) continue; const X=t.x*PPM,Y=t.y*PPM; if(X<vx0-160||X>vx1+160||Y<vy0-160||Y>vy1+160) continue; vis.push(t); }
  for(const t of vis) drawTrailerAt(t,t.x,t.y,t.th,true);
  for(const t of vis){ drawTrailerAt(t,t.x,t.y,t.th,false);
    const ft=fwd(t.th), rt=rgt(t.th); ctx.fillStyle='#3a3d42'; for(const sd of [-1,1]){ const lx=t.x-ft[0]*2.8+rt[0]*sd*1.0, ly=t.y-ft[1]*2.8+rt[1]*sd*1.0; ctx.fillRect(lx*PPM-2.5,ly*PPM-2.5,5,5); }
    if(t.target){ const b=trailerBox(t); ctx.save(); ctx.translate(b.x*PPM,b.y*PPM); ctx.rotate(t.th); ctx.strokeStyle=`rgba(255,214,0,${0.55+0.4*Math.sin(timeS*5)})`; ctx.lineWidth=4; ctx.strokeRect(-TRL_W/2*PPM-5,-TRL_LEN/2*PPM-5,TRL_W*PPM+10,TRL_LEN*PPM+10); ctx.restore(); } }
  // coupling guide
  const c=coupleCandidate(); if(c&&c.d<22){ const t=c.tr, ft=fwd(t.th); const col=c.ok?'rgba(60,230,90,0.95)':(c.d<4&&Math.abs(c.a)<0.35)?'rgba(255,200,40,0.95)':'rgba(255,255,255,0.75)';
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=2; ctx.setLineDash([8,6]); ctx.beginPath(); ctx.moveTo(t.x*PPM,t.y*PPM); ctx.lineTo((t.x+ft[0]*16)*PPM,(t.y+ft[1]*16)*PPM); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(t.x*PPM,t.y*PPM,8,0,7); ctx.stroke(); const k=kingpin(truck); ctx.fillStyle=col; ctx.beginPath(); ctx.arc(k[0]*PPM,k[1]*PPM,4,0,7); ctx.fill(); ctx.restore(); }
}
function drawCoupleHUD(){
  const s=truck; let text=null, col='#fff', sub=null;
  if(!s.trl){ const c=coupleCandidate();
    if(c&&c.ok){ text='Press T to couple'; col='#5df07a'; sub=c.tr.id+' \u2022 '+c.tr.typeName+' \u2022 '+c.tr.cargo+' \u2022 '+(c.tr.weight/1000).toFixed(1)+' t \u2022 lvl '+c.tr.reqLevel; }
    else if(c&&c.d<22){ text='Reverse onto trailer '+c.tr.id; col= (c.d<4&&Math.abs(c.a)<0.35)?'#ffd23f':'#fff';
      sub=`gap ${Math.max(0,c.along).toFixed(1)} m \u2022 offset ${c.lat>0?'R':'L'} ${Math.abs(c.lat).toFixed(2)} m \u2022 angle ${(c.a*57.3).toFixed(0)}\u00b0` + (Math.abs(s.v)>1.2?' \u2022 slow down':''); }
    else text='SOLO CAB \u2022 T: couple (reverse onto a trailer)'; }
  else if(Math.abs(s.v)<0.3) { text='T: uncouple'; col='rgba(255,255,255,0.8)'; }
  if(timeS-coupleMsg.t<3.5){ sub=text?(sub||''):''; text=coupleMsg.text; col='#ffe9a8'; }
  if(!text) return;
  ctx.save(); ctx.font='bold 17px system-ui,sans-serif'; ctx.textAlign='center'; const w=Math.max(ctx.measureText(text).width, sub?ctx.measureText(sub).width*0.8:0)+30;
  ctx.fillStyle='rgba(8,12,20,0.72)'; ctx.fillRect(VW/2-w/2,14,w,sub?52:32); ctx.fillStyle=col; ctx.fillText(text,VW/2,36);
  if(sub){ ctx.font='13px system-ui,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillText(sub,VW/2,56); } ctx.restore(); }

function drawFuelSign(g,o){ g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(o.x-10,o.y+8,30,16); g.fillStyle='#55595f'; g.fillRect(o.x-2,o.y,4,30);
  g.fillStyle=o.col; g.fillRect(o.x-22,o.y-26,44,34); g.fillStyle='#fff'; g.font='bold 9px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(o.brand,o.x,o.y-18);
  g.fillStyle='#111'; g.fillRect(o.x-18,o.y-10,36,14); g.fillStyle='#ffcf33'; g.font='bold 10px monospace'; g.fillText('\u00a3'+o.price.toFixed(2),o.x,o.y-3); }
