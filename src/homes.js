// ===================== py2: purchasable homes + estate agents =====================
// Homes sit on flat existing ground beside the road network (no elevation changes). Each plot: driveway from the road -> lorry hardstanding
// (1-2 rigs) -> house + gardens. Buying happens ONLY on the property's own driveway; estate agents list homes + commercial yards (view / fast travel).
const HOME_DEFS=[
  {id:'H1',kind:'mansion',name:'Ashcombe Park',set:'country',price:2500000,bed:7,lorries:2,w:32,h:28,desc:'Georgian-style country mansion with a heated pool, floodlit tennis court, orangery and acres of parkland.'},
  {id:'H2',kind:'cabin',name:'Ravensholt Cabin',set:'forest',price:85000,bed:2,lorries:1,w:20,h:18,desc:'Hand-built log cabin deep in the pines, with a cedar deck, fire pit and wood store.'},
  {id:'H3',kind:'villa',name:'Saltglass House',set:'coast',price:1450000,bed:5,lorries:2,w:24,h:20,desc:'Architect-designed glass villa above the shore: infinity pool, roof terrace and sea-view lounge.'},
  {id:'H4',kind:'farm',name:'Hollins Farm',set:'farm',price:420000,bed:4,lorries:2,w:28,h:24,desc:'Working stone farmhouse with a big red barn, kitchen garden, orchard and room for the rigs.'},
  {id:'H5',kind:'cottage',name:'Pentreath Cottage',set:'cottage',price:40000,bed:2,lorries:1,w:18,h:16,desc:'Whitewashed Cornish-style cottage with a slate roof, cottage garden and a granite wall.'},
  {id:'H6',kind:'town',name:'No. 9 Wharf Row',set:'city',price:310000,bed:3,lorries:1,w:16,h:16,desc:'Smart Victorian townhouse in the city with a gated, secure yard for one artic.'},
  {id:'H7',kind:'chapel',name:'Old Bethel Chapel',set:'village',price:265000,bed:3,lorries:1,w:18,h:18,desc:'Converted Methodist chapel: vaulted living room, bell tower study, quiet churchyard garden.'},
  {id:'H8',kind:'lodge',name:'Mirewater Lodge',set:'lake',price:690000,bed:4,lorries:2,w:24,h:20,desc:'Timber lakeside lodge with a private pond, jetty, hot tub and wraparound veranda.'},
  {id:'H9',kind:'bungalow',name:'Brackenrise',set:'hill',price:175000,bed:3,lorries:1,w:18,h:16,desc:'Hillside bungalow in the foothills: rock garden, sun terrace and big skies.'},
  {id:'H10',kind:'ranch',name:'Longhaul Ranch',set:'ranch',price:980000,bed:4,lorries:2,w:32,h:26,desc:'A trucker\u2019s ranch: single-storey homestead, paddock and a giant workshop with three roller doors.'}];
const HOMES={list:[],agents:[],owned:{},slot:null,tab:'res',thumbs:{}};
const HCITY={C1:'Albion',SV:'Sandvale',KB:'Kingsbridge',MF:'Millford',DW:'Dustwater',CM:'Coppermine',RH:'Redhill',FW:'Fenwick',AB:'Ashby'};
function homeOwned(h){ return !!HOMES.owned[h.id]; }
function homesSave(){ return HOMES.owned; }
function homesLoad(o){ HOMES.owned=(o&&typeof o==='object')?o:{}; }
// ---------- world generation (called from depots.js buildDepotsSteps; deterministic)
function homesGen(H){ const {findSpot,access,clearObjs,region,objs}=H; HOMES.list=[]; HOMES.agents=[];
  const C=64, N=MW/C, cnt={}; const K=['tree','water','sand','field','rock','bldg','grass','road'];
  for(const k of K) cnt[k]=new Float32Array(N*N);
  for(let y=0;y<MH;y+=4) for(let x=0;x<MW;x+=4){ const t=get(x,y), c=((y/C)|0)*N+((x/C)|0);
    const k=t===T.TREE?'tree':t===T.WATER?'water':t===T.SAND?'sand':t===T.FIELD?'field':t===T.ROCK?'rock':(t===T.BLDG||t===T.WALK||t===T.PLAZA||t===T.LOT)?'bldg':(t===T.GRASS||t===T.PGRASS)?'grass':t===T.ROAD?'road':null; if(k) cnt[k][c]++; }
  const nb=(k,cx,cy)=>{ let s=0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const X=cx+dx,Y=cy+dy; if(X<0||Y<0||X>=N||Y>=N) continue; s+=cnt[k][Y*N+X]*(dx||dy?0.5:1); } return s/256; };
  const SC={country:q=>q.grass+q.field*0.6-q.bldg*1.5-q.water-q.rock*0.5, forest:q=>q.tree*2-q.bldg*2-q.water*0.5, coast:q=>Math.min(q.sand,1.2)*2+Math.min(q.water,1.5)-q.bldg*1.2,
    farm:q=>q.field*2-q.bldg*1.5-q.tree*0.3, cottage:q=>Math.min(q.sand,1)*1.4+Math.min(q.water,1)*0.6+q.grass*0.4-q.bldg*0.6, city:q=>q.bldg*2-q.water, village:q=>Math.min(q.bldg,0.9)*1.2+q.grass*0.6-Math.max(0,q.bldg-1.2)*2,
    lake:(q,cx,cy)=>(cx>3&&cy>3&&cx<N-4&&cy<N-4?Math.min(q.water,1.6)*1.6:-9)-q.sand*1.2-q.bldg+q.tree*0.3, hill:q=>q.rock*2.5+q.tree*0.2-q.bldg, ranch:q=>q.grass*0.8+q.field-q.bldg*1.2-q.water};
  const taken=[]; const R=mulberry(4242);
  for(const D of HOME_DEFS){ const cells=[]; for(let cy=0;cy<N;cy++) for(let cx=0;cx<N;cx++){ if(cnt.road[cy*N+cx]+cnt.road[cy*N+Math.min(N-1,cx+1)]<2) continue; const q={}; for(const k of K) q[k]=nb(k,cx,cy); cells.push([SC[D.set](q,cx,cy)+R()*0.05,cx,cy]); }
    cells.sort((a,b)=>b[0]-a[0]); let placed=false;
    for(const [pass,[,cx,cy]] of cells.slice(0,120).map(c=>[0,c]).concat(cells.slice(0,300).map(c=>[1,c]))){ if(placed) break; const tx=cx*C+C/2, ty=cy*C+C/2; if(taken.some(p=>Math.hypot(p[0]-tx,p[1]-ty)<(pass?150:260))) continue;
      const rej=(x,y)=>HOMES.list.some(o=>Math.abs(o.x0-x)<90&&Math.abs(o.y0-y)<90)||(world.forSale||[]).some(o=>Math.abs(o.x0-x)<40&&Math.abs(o.y0-y)<40);
      const s=findSpot(tx,ty,D.w,D.h,10,rej,D.set==='city',pass?110:70); if(!s) continue; const [x,y,gap]=s; placed=true; taken.push([tx,ty]);
      access(x,y,D.w,gap); clearObjs(x,y,D.w,D.h); for(let j=y;j<y+D.h;j++) for(let i=x;i<x+D.w;i++){ world.reserved[idx(i,j)]=1; const t=get(i,j); if(t!==T.GRASS&&t!==T.PGRASS) set(i,j,T.PGRASS); }
      const hw=D.lorries>1?10:6, hd=7, hx=x+(D.w>>1)-(hw>>1); fill(hx,y,hw,hd,T.CONC);
      const h=Object.assign({},D,{x0:x,y0:y,gap,hard:{x:hx,y,w:hw,h:hd},region:region(x,y),entrance:{x:(x+(D.w>>1))*M_T,y:(y-gap)*M_T},solid:[],feat:[]});
      homeLayout(h); for(const r of h.solid) fill(r[0],r[1],r[2],r[3],r[4]===undefined?T.BLDG:r[4]);
      h.ft={name:h.name,entrance:h.entrance,x0:hx,y0:y,w:hw,h:hd+5,bays:[]}; h.city=homeNearCity(x,y); HOMES.list.push(h); break; }
    if(!placed) console.warn('[homes] no spot for',D.name); }
  // estate agents: one per city, on open ground just outside/inside the city grid near a road
  for(const k in HCITY){ const c=world.cities&&world.cities[k]; if(!c) continue; const cx=Math.round((c.xs[0]+c.X1)/2), cy=Math.round((c.ys[0]+c.Y1)/2);
    let s=null; for(const [ax,ay] of [[0,0],[0.4,0],[-0.4,0],[0,0.4],[0,-0.4],[0.8,0.8]]){ const tx=Math.round(cx+ax*(c.X1-c.xs[0])/2), ty=Math.round(cy+ay*(c.Y1-c.ys[0])/2); s=findSpot(tx,ty,12,9,6,(x,y)=>HOMES.agents.some(a=>Math.abs(a.x0-x)<30&&Math.abs(a.y0-y)<30),true,90); if(s) break; }
    if(!s) continue; const [x,y,gap]=s; homeClrB(objs,x-1,y-gap,14,9+gap+1); access(x,y,12,gap); clearObjs(x,y,12,9); for(let j=y;j<y+9;j++) for(let i=x;i<x+12;i++){ world.reserved[idx(i,j)]=1; set(i,j,T.WALK); }
    fill(x+3,y,6,4,T.CONC); fill(x+1,y+5,10,4,T.BLDG);
    const a={id:'EA'+k,city:HCITY[k],name:HCITY[k]+' Homes & Estates',x0:x,y0:y,gap,entrance:{x:(x+6)*M_T,y:(y-gap)*M_T},slot:{x:(x+6)*M_T,y:(y+2)*M_T,w:9,L:12}}; a.ft={name:a.name,entrance:a.entrance,x0:x+3,y0:y,w:6,h:9,bays:[]}; HOMES.agents.push(a); }
  console.log('[homes]',HOMES.list.map(h=>h.name+'@'+h.x0+','+h.y0).join(' | '),'agents',HOMES.agents.length); }
function homeClrB(objs,x,y,w,h){ const X0=x*TILE,Y0=y*TILE,X1=(x+w)*TILE,Y1=(y+h)*TILE; for(const o of objs){ if(o._dead||!(o.kind==='bldg'||o.kind==='lot'||o.kind==='awning'||o.kind==='tree')||o.w===undefined&&o.kind!=='tree') continue; const ow=o.w||1, oh=o.h||1; if(o.x<X1&&o.x+ow>X0&&o.y<Y1&&o.y+oh>Y0) o._dead=1; } }
function homeNearCity(x,y){ let best=null,bd=1e9; for(const k in HCITY){ const c=world.cities&&world.cities[k]; if(!c) continue; const d=Math.hypot((c.xs[0]+c.X1)/2-x,(c.ys[0]+c.Y1)/2-y); if(d<bd){ bd=d; best=HCITY[k]; } } return best; }
// ---------- per-kind layout (tile rects relative to the plot; y grows away from the road). solid rects become BLDG / WATER tiles
function homeLayout(h){ const X=h.x0, Y=h.y0, W=h.w, Hh=h.h, add=(k,x,y,w,hh,o)=>{ const r={k,x:X+x,y:Y+y,w,h:hh}; Object.assign(r,o||{}); h.feat.push(r); return r; }, sol=(r,t)=>h.solid.push([r.x,r.y,r.w,r.h,t]);
  const hc=W>>1;
  switch(h.kind){
    case 'mansion': sol(add('house',hc-7,10,14,7,{roof:'hip',col:'#7a4b3a',stone:'#d9cbb0'})); add('orangery',hc-3,17,6,2); sol(add('pool',hc-9,21,8,4),T.WATER); add('tennis',hc+3,20,8,6); add('patio',hc-9,17,6,3); add('lawn',1,1,hc-6,8); add('lawn',hc+6,1,W-hc-7,8); add('fountain',hc-1,8,2,2); add('trees',0,0,W,Hh,{n:22}); add('lamps',0,0,W,Hh); break;
    case 'cabin': sol(add('house',hc-3,9,7,5,{roof:'log',col:'#6b4a2c'})); add('deck',hc-4,14,9,2); add('firepit',hc+5,15,2,2); add('woodstore',hc-7,9,2,3); add('trees',0,0,W,Hh,{n:34,pine:1}); break;
    case 'villa': sol(add('house',hc-7,9,11,6,{roof:'flat'})); sol(add('pool',hc-7,16,12,3),T.WATER); add('terrace',hc-8,15,14,1); add('lawn',hc+5,9,6,9); add('trees',0,0,W,Hh,{n:8,palm:1}); add('lamps',0,0,W,Hh); break;
    case 'farm': sol(add('house',2,9,8,6,{roof:'gable',col:'#59616b',stone:'#c7b998'})); sol(add('barn',W-11,9,9,9,{roof:'barn',col:'#a3322a'})); add('veg',2,17,8,5); add('orchard',11,17,6,6); add('yard',11,8,6,8); add('trees',0,0,W,Hh,{n:10}); break;
    case 'cottage': sol(add('house',hc-4,9,8,4,{roof:'gable',col:'#4e5661',white:1})); add('cgarden',1,13,W-2,Hh-14); add('wall',0,0,W,Hh); add('trees',0,0,W,Hh,{n:5}); break;
    case 'town': sol(add('house',2,9,12,6,{roof:'terrace',col:'#5a5f66',brick:'#9b4d3a'})); add('gate',hc-3,0,6,1); add('trees',0,0,W,Hh,{n:3}); break;
    case 'chapel': sol(add('house',hc-3,9,7,8,{roof:'chapel',col:'#4c545e',stone:'#b9ad96'})); sol(add('tower',hc-2,8,3,3)); add('graves',1,9,hc-5,7); add('trees',0,0,W,Hh,{n:8,yew:1}); add('wall',0,0,W,Hh); break;
    case 'lodge': sol(add('house',hc-6,9,9,5,{roof:'gable',col:'#3d5a4a',timber:1})); add('deck',hc-7,14,11,2); sol(add('pond',hc-6,16,12,3),T.WATER); add('jetty',hc+2,15,1,3); add('hottub',hc+4,10,2,2); add('trees',0,0,W,Hh,{n:16,pine:1}); add('lamps',0,0,W,Hh); break;
    case 'bungalow': sol(add('house',hc-4,9,9,4,{roof:'hip',col:'#8a5236'})); add('rock',1,13,W-2,2); add('terrace',hc-4,13,8,1); add('trees',0,0,W,Hh,{n:7}); break;
    case 'ranch': sol(add('house',2,9,11,5,{roof:'hip',col:'#6e4a32'})); sol(add('workshop',W-15,8,14,10,{roof:'shed'})); add('paddock',2,16,13,9); add('yard',hc-2,8,4,9); add('trees',0,0,W,Hh,{n:8}); add('lamps',0,0,W,Hh); break; }
}
// ---------- art: prerendered plot canvas (tile units u=TILE px)
function hShade(c,k){ const n=parseInt(c.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; r=Math.max(0,Math.min(255,r*k)); g=Math.max(0,Math.min(255,g*k)); b=Math.max(0,Math.min(255,b*k)); return `rgb(${r|0},${g|0},${b|0})`; }
function hTree(g,x,y,r,o,R){ o=o||{}; g.fillStyle='rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x+r*0.35,y+r*0.35,r,r*0.9,0,0,7); g.fill();
  if(o.palm){ g.strokeStyle='#3f7d3a'; g.lineWidth=r*0.28; for(let k=0;k<7;k++){ const a=k/7*6.283+R()*0.3; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.6-2,x+Math.cos(a)*r*1.1,y+Math.sin(a)*r*1.1); g.stroke(); } g.fillStyle='#6b4f2a'; g.beginPath(); g.arc(x,y,r*0.18,0,7); g.fill(); return; }
  const base=o.pine?['#1f4d2b','#2a6338','#357a44']:o.yew?['#1c3b24','#25502f','#2f6339']:['#2f6b2c','#3f8a37','#5aa64a'];
  if(o.pine){ for(let k=0;k<3;k++){ g.fillStyle=base[k]; g.beginPath(); for(let i=0;i<9;i++){ const a=i/9*6.283, rr=(i%2?0.55:1)*r*(1-k*0.28); g.lineTo(x+Math.cos(a)*rr-k,y+Math.sin(a)*rr-k); } g.fill(); } return; }
  for(let k=0;k<3;k++){ g.fillStyle=base[k]; for(let i=0;i<5;i++){ const a=R()*6.283, d=R()*r*0.35*(1-k*0.3); g.beginPath(); g.arc(x+Math.cos(a)*d-k*r*0.12,y+Math.sin(a)*d-k*r*0.12,r*(0.62-k*0.12),0,7); g.fill(); } } }
function hRoof(g,x,y,w,h,f,u){ const col=f.col||'#6d4c3d', ty=f.roof; g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(x+u*0.4,y+u*0.4,w,h);
  const course=(x0,y0,x1,y1,horiz,c)=>{ g.strokeStyle=c; g.lineWidth=1; g.beginPath(); if(horiz) for(let yy=y0+5;yy<y1;yy+=6){ g.moveTo(x0,yy); g.lineTo(x1,yy); } else for(let xx=x0+5;xx<x1;xx+=6){ g.moveTo(xx,y0); g.lineTo(xx,y1); } g.stroke(); };
  if(ty==='hip'||ty==='terrace'){ const ins=Math.min(w,h)/2, horiz=w>=h; const p=horiz?[[x,y],[x+w,y],[x+w-ins,y+h/2],[x+ins,y+h/2]]:[[x,y],[x+w/2,y+ins],[x+w/2,y+h-ins],[x,y+h]];
    const faces=horiz?[[[x,y],[x+w,y],[x+w-ins,y+h/2],[x+ins,y+h/2],1.12],[[x,y+h],[x+w,y+h],[x+w-ins,y+h/2],[x+ins,y+h/2],0.72],[[x,y],[x+ins,y+h/2],[x,y+h],0.92],[[x+w,y],[x+w-ins,y+h/2],[x+w,y+h],0.85]]
      :[[[x,y],[x,y+h],[x+w/2,y+h-ins],[x+w/2,y+ins],0.9],[[x+w,y],[x+w,y+h],[x+w/2,y+h-ins],[x+w/2,y+ins],0.78],[[x,y],[x+w,y],[x+w/2,y+ins],1.1],[[x,y+h],[x+w,y+h],[x+w/2,y+h-ins],0.72]];
    for(const F of faces){ const k=F[F.length-1]; g.fillStyle=hShade(col,k); g.beginPath(); for(let i=0;i<F.length-1;i++) g.lineTo(F[i][0],F[i][1]); g.closePath(); g.fill(); g.save(); g.clip(); course(x,y,x+w,y+h,horiz,'rgba(0,0,0,0.13)'); g.restore(); }
    g.strokeStyle=hShade(col,1.35); g.lineWidth=2; g.beginPath(); if(horiz){ g.moveTo(x+ins,y+h/2); g.lineTo(x+w-ins,y+h/2); g.moveTo(x,y); g.lineTo(x+ins,y+h/2); g.lineTo(x,y+h); g.moveTo(x+w,y); g.lineTo(x+w-ins,y+h/2); g.lineTo(x+w,y+h); } g.stroke();
    if(ty==='terrace'){ g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=2; for(let xx=x+w/3;xx<x+w-4;xx+=w/3){ g.beginPath(); g.moveTo(xx,y); g.lineTo(xx,y+h); g.stroke(); } }
    for(const cx of (w>6*u?[x+w*0.22,x+w*0.78]:[x+w*0.7])){ g.fillStyle=f.brick||'#8c4a36'; g.fillRect(cx-6,y+h*0.18,12,14); g.fillStyle='#333'; g.fillRect(cx-4,y+h*0.18+2,3,3); g.fillRect(cx+1,y+h*0.18+2,3,3); } return; }
  if(ty==='gable'||ty==='barn'||ty==='log'||ty==='chapel'){ const horiz=w>=h; g.fillStyle=hShade(col,1.1); if(horiz){ g.fillRect(x,y,w,h/2); g.fillStyle=hShade(col,0.75); g.fillRect(x,y+h/2,w,h/2); } else { g.fillRect(x,y,w/2,h); g.fillStyle=hShade(col,0.75); g.fillRect(x+w/2,y,w/2,h); }
    if(ty==='log'){ g.strokeStyle='rgba(30,15,5,0.45)'; g.lineWidth=2; for(let k=6;k<(horiz?w:h);k+=8){ g.beginPath(); if(horiz){ g.moveTo(x+k,y); g.lineTo(x+k,y+h); } else { g.moveTo(x,y+k); g.lineTo(x+w,y+k); } g.stroke(); } g.fillStyle='#8a8f96'; g.fillRect(x+w*0.7,y+h*0.15,10,10); }
    else if(ty==='barn'){ g.strokeStyle='rgba(0,0,0,0.22)'; g.lineWidth=1.5; for(let k=4;k<(horiz?w:h);k+=5){ g.beginPath(); if(horiz){ g.moveTo(x+k,y); g.lineTo(x+k,y+h); } else { g.moveTo(x,y+k); g.lineTo(x+w,y+k); } g.stroke(); } g.fillStyle='rgba(255,255,255,0.5)'; g.fillRect(horiz?x+w*0.3:x+w/2-3,horiz?y+h/2-3:y+h*0.3,horiz?w*0.4:6,horiz?6:h*0.4); }
    else { g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip(); g.strokeStyle='rgba(0,0,0,0.16)'; g.lineWidth=1; for(let k=5;k<(horiz?h:w);k+=5){ g.beginPath(); if(horiz){ g.moveTo(x,y+k); g.lineTo(x+w,y+k); } else { g.moveTo(x+k,y); g.lineTo(x+k,y+h); } g.stroke(); } g.restore();
      if(f.white){ g.fillStyle='#f2f0ea'; g.fillRect(x-4,y-4,w+8,4); g.fillRect(x-4,y+h,w+8,4); g.fillRect(x-4,y,4,h); g.fillRect(x+w,y,4,h); }
      if(f.timber){ g.fillStyle='#5b3d24'; g.fillRect(x-3,y-3,w+6,3); g.fillRect(x-3,y+h,w+6,3); } if(ty!=='chapel'){ g.fillStyle=f.stone||'#9a9184'; g.fillRect(x+w*0.12,y+h/2-14,12,12); } }
    g.strokeStyle=hShade(col,1.4); g.lineWidth=2.5; g.beginPath(); if(horiz){ g.moveTo(x,y+h/2); g.lineTo(x+w,y+h/2); } else { g.moveTo(x+w/2,y); g.lineTo(x+w/2,y+h); } g.stroke(); return; }
  if(ty==='flat'){ g.fillStyle='#e9ecef'; g.fillRect(x,y,w,h); g.fillStyle='#cfd5da'; g.fillRect(x+4,y+4,w*0.45,h-8); const gx=x+w*0.52, gw=w*0.45; const gr=g.createLinearGradient(gx,y,gx+gw,y+h); gr.addColorStop(0,'#7fb6d6'); gr.addColorStop(0.5,'#c9e6f5'); gr.addColorStop(1,'#5f9cc0'); g.fillStyle=gr; g.fillRect(gx,y+4,gw-4,h-8); g.strokeStyle='rgba(255,255,255,0.8)'; g.lineWidth=1.5; for(let xx=gx;xx<gx+gw-4;xx+=16){ g.beginPath(); g.moveTo(xx,y+4); g.lineTo(xx,y+h-4); g.stroke(); }
    g.fillStyle='#2f3e4c'; for(let i=0;i<4;i++) g.fillRect(x+10+i*14,y+10,11,18); g.fillStyle='#8c6a4a'; g.fillRect(x+6,y+h-30,w*0.4,22); g.strokeStyle='rgba(0,0,0,0.25)'; g.strokeRect(x+0.5,y+0.5,w-1,h-1); return; }
  if(ty==='shed'){ g.fillStyle='#8d969e'; g.fillRect(x,y,w,h); g.strokeStyle='rgba(0,0,0,0.18)'; g.lineWidth=1.5; for(let k=4;k<w;k+=6){ g.beginPath(); g.moveTo(x+k,y); g.lineTo(x+k,y+h); g.stroke(); } g.fillStyle='#b9c2c9'; g.fillRect(x,y+h/2-2,w,4);
    g.fillStyle='rgba(200,230,255,0.55)'; for(let k=0;k<4;k++) g.fillRect(x+w*(0.12+k*0.22),y+8,w*0.08,h-16); g.fillStyle='#d35400'; g.fillRect(x,y-6,w,6); g.fillStyle='#fff'; g.font='900 '+Math.round(u*0.55)+'px Arial Black,Arial'; g.textAlign='center'; g.fillText('LONGHAUL RANCH',x+w/2,y+h/2-6); return; } }
function hDrawPlot(h){ const u=TILE, W=h.w*u, H=h.h*u, c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'), R=mulberry(h.x0*31+h.y0), L=(x)=>(x-h.x0)*u, Tt=(y)=>(y-h.y0)*u;
  // ground: lawn stripes (sand-tinted on the coast, gravel at the ranch)
  const lawn=h.kind==='villa'?'#79a85a':h.kind==='cabin'||h.kind==='lodge'?'#4f7d3c':h.kind==='bungalow'?'#7f9a5a':'#6aa04a';
  g.fillStyle=lawn; g.fillRect(0,0,W,H); g.fillStyle='rgba(255,255,255,0.05)'; for(let x=0;x<W;x+=u) if((x/u)%2) g.fillRect(x,0,u,H);
  if(h.kind==='cabin'||h.kind==='lodge'){ g.fillStyle='rgba(70,50,25,0.25)'; for(let i=0;i<60;i++){ g.beginPath(); g.arc(R()*W,R()*H,3+R()*6,0,7); g.fill(); } }
  // driveway apron + hardstanding with lorry bays
  const hd=h.hard; g.fillStyle='#a7a8a4'; g.fillRect(L(hd.x),0,hd.w*u,hd.h*u); g.strokeStyle='rgba(0,0,0,0.12)'; g.lineWidth=1; for(let x=L(hd.x);x<L(hd.x)+hd.w*u;x+=u*2){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,hd.h*u); g.stroke(); } for(let y=0;y<hd.h*u;y+=u*2){ g.beginPath(); g.moveTo(L(hd.x),y); g.lineTo(L(hd.x)+hd.w*u,y); g.stroke(); }
  g.strokeStyle='#f1d34a'; g.lineWidth=3; const n=h.lorries, bw=hd.w*u/n; for(let k=0;k<n;k++){ const bx=L(hd.x)+k*bw+10; g.strokeRect(bx,u*0.6,bw-20,hd.h*u-u*1.2); g.fillStyle='rgba(241,211,74,0.85)'; g.font='bold '+Math.round(u*0.42)+'px system-ui'; g.textAlign='center'; g.fillText('LORRY',bx+(bw-20)/2,hd.h*u-u*0.9); }
  g.fillStyle='#6f6e6a'; g.fillRect(L(hd.x)-4,0,4,hd.h*u); g.fillRect(L(hd.x)+hd.w*u,0,4,hd.h*u);
  // path from hardstanding to the front door
  const house=h.feat.find(f=>f.k==='house'); if(house){ g.fillStyle='#c9bfa8'; const px=L(house.x+house.w/2)-u*0.6; g.fillRect(px,hd.h*u,u*1.2,Tt(house.y)-hd.h*u); }
  const trees=[];
  for(const f of h.feat){ const x=L(f.x), y=Tt(f.y), w=f.w*u, hh=f.h*u;
    switch(f.k){
      case 'lawn': g.fillStyle='rgba(255,255,255,0.06)'; for(let k=0;k<w;k+=u*0.5) if((k/(u*0.5))%2) g.fillRect(x+k,y,u*0.5,hh); break;
      case 'pool': { g.fillStyle='#e8e3d6'; g.fillRect(x-6,y-6,w+12,hh+12); const gr=g.createLinearGradient(x,y,x+w,y+hh); gr.addColorStop(0,'#2fa6d9'); gr.addColorStop(1,'#7fd8f2'); g.fillStyle=gr; g.fillRect(x,y,w,hh); g.strokeStyle='rgba(255,255,255,0.5)'; g.lineWidth=1.5; for(let k=0;k<6;k++){ g.beginPath(); g.moveTo(x+R()*w,y+R()*hh); g.quadraticCurveTo(x+R()*w,y+R()*hh,x+R()*w,y+R()*hh); g.stroke(); }
        g.fillStyle='#fff'; for(let k=0;k<3;k++){ g.fillRect(x+k*u*1.3+6,y-u*1.0,u*0.5,u*0.9); g.fillStyle=['#e74c3c','#f1c40f','#1abc9c'][k]; g.fillRect(x+k*u*1.3+7,y-u*0.95,u*0.48,u*0.5); g.fillStyle='#fff'; } break; }
      case 'tennis': g.fillStyle='#3d7a56'; g.fillRect(x,y,w,hh); g.fillStyle='#2f6b9a'; g.fillRect(x+u*0.8,y+u*0.6,w-u*1.6,hh-u*1.2); g.strokeStyle='#fff'; g.lineWidth=2; g.strokeRect(x+u*0.8,y+u*0.6,w-u*1.6,hh-u*1.2); g.beginPath(); g.moveTo(x+w/2,y+u*0.6); g.lineTo(x+w/2,y+hh-u*0.6); g.moveTo(x+u*0.8,y+hh/2); g.lineTo(x+w-u*0.8,y+hh/2); g.stroke(); g.strokeStyle='#222'; g.lineWidth=3; g.beginPath(); g.moveTo(x+u*0.5,y+hh/2); g.lineTo(x+w-u*0.5,y+hh/2); g.stroke(); g.strokeStyle='rgba(40,40,40,0.6)'; g.lineWidth=2; g.strokeRect(x+2,y+2,w-4,hh-4); break;
      case 'patio': case 'terrace': g.fillStyle='#d8cdb7'; g.fillRect(x,y,w,hh); g.strokeStyle='rgba(0,0,0,0.1)'; for(let k=0;k<w;k+=12){ g.beginPath(); g.moveTo(x+k,y); g.lineTo(x+k,y+hh); g.stroke(); } g.fillStyle='#5b4636'; g.fillRect(x+w*0.3,y+hh*0.25,u*0.9,u*0.6); g.fillStyle='#fff'; g.beginPath(); g.arc(x+w*0.3+u*0.45,y+hh*0.25+u*0.3,u*0.5,0,7); g.globalAlpha=0.85; g.fill(); g.globalAlpha=1; break;
      case 'orangery': g.fillStyle='#c9e6f0'; g.fillRect(x,y,w,hh); g.strokeStyle='#ffffff'; g.lineWidth=2; for(let k=0;k<=w;k+=u*0.75){ g.beginPath(); g.moveTo(x+k,y); g.lineTo(x+k,y+hh); g.stroke(); } g.strokeRect(x,y,w,hh); break;
      case 'fountain': g.fillStyle='#d6d0c2'; g.beginPath(); g.arc(x+w/2,y+hh/2,w/2,0,7); g.fill(); g.fillStyle='#5ab8e0'; g.beginPath(); g.arc(x+w/2,y+hh/2,w/2-6,0,7); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.arc(x+w/2,y+hh/2,5,0,7); g.fill(); break;
      case 'deck': g.fillStyle='#9a6b3f'; g.fillRect(x,y,w,hh); g.strokeStyle='rgba(50,25,5,0.4)'; g.lineWidth=1; for(let k=0;k<hh;k+=5){ g.beginPath(); g.moveTo(x,y+k); g.lineTo(x+w,y+k); g.stroke(); } g.fillStyle='#3b2a1a'; for(let k=0;k<3;k++){ g.fillRect(x+u*(1+k*1.4),y+hh*0.3,u*0.7,u*0.7); } break;
      case 'firepit': g.fillStyle='#7d7d7d'; g.beginPath(); g.arc(x+w/2,y+hh/2,w/2-4,0,7); g.fill(); g.fillStyle='#3a2a1c'; g.beginPath(); g.arc(x+w/2,y+hh/2,w/2-10,0,7); g.fill(); g.fillStyle='#ff8c1a'; for(let k=0;k<6;k++){ g.beginPath(); g.arc(x+w/2+(R()-0.5)*14,y+hh/2+(R()-0.5)*14,3,0,7); g.fill(); } g.fillStyle='#6e4b2a'; for(let k=0;k<4;k++){ const a=k*1.57+0.4; g.fillRect(x+w/2+Math.cos(a)*w*0.62-8,y+hh/2+Math.sin(a)*w*0.62-4,16,8); } break;
      case 'woodstore': g.fillStyle='#5a3d22'; g.fillRect(x,y,w,hh); g.fillStyle='#b88a55'; for(let i=0;i<w;i+=9) for(let j=0;j<hh;j+=9){ g.beginPath(); g.arc(x+i+5,y+j+5,4,0,7); g.fill(); } break;
      case 'veg': g.fillStyle='#6b4a2e'; g.fillRect(x,y,w,hh); for(let j=0;j<hh;j+=u*0.6){ g.fillStyle=['#3f8f3a','#7bbf3a','#c0392b','#2e7d32'][((j/(u*0.6))|0)%4]; for(let i=6;i<w-6;i+=9){ g.beginPath(); g.arc(x+i,y+j+u*0.3,3.5,0,7); g.fill(); } } break;
      case 'orchard': for(let i=0;i<3;i++) for(let j=0;j<3;j++) trees.push([x+(i+0.5)*w/3,y+(j+0.5)*hh/3,u*0.75,{}]); break;
      case 'yard': g.fillStyle='#b5a789'; g.fillRect(x,y,w,hh); g.fillStyle='rgba(0,0,0,0.08)'; for(let i=0;i<40;i++){ g.fillRect(x+R()*w,y+R()*hh,3,3); } break;
      case 'cgarden': for(let i=0;i<90;i++){ g.fillStyle=['#e84393','#fdcb6e','#a29bfe','#ffffff','#ff7675','#74b9ff'][(R()*6)|0]; g.beginPath(); g.arc(x+R()*w,y+R()*hh,3,0,7); g.fill(); } g.fillStyle='#c9bfa8'; g.fillRect(x+w/2-u*0.4,y,u*0.8,hh); break;
      case 'graves': g.fillStyle='#58894a'; g.fillRect(x,y,w,hh); for(let i=0;i<w-8;i+=u*0.9) for(let j=0;j<hh-8;j+=u*1.1){ g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(x+i+8,y+j+8,10,5); g.fillStyle='#c9c6bd'; g.fillRect(x+i+6,y+j+6,10,5); } break;
      case 'pond': { g.fillStyle='#5b7a3a'; g.beginPath(); g.ellipse(x+w/2,y+hh/2,w/2+6,hh/2+6,0,0,7); g.fill(); const gr=g.createRadialGradient(x+w/2,y+hh/2,4,x+w/2,y+hh/2,w/2); gr.addColorStop(0,'#3a8fb7'); gr.addColorStop(1,'#2a6a8c'); g.fillStyle=gr; g.beginPath(); g.ellipse(x+w/2,y+hh/2,w/2,hh/2,0,0,7); g.fill(); g.fillStyle='#4f9a3f'; for(let k=0;k<6;k++){ g.beginPath(); g.arc(x+R()*w,y+hh*0.2+R()*hh*0.6,4,0,7); g.fill(); } break; }
      case 'jetty': g.fillStyle='#8a6038'; g.fillRect(x+4,y,w-8,hh); g.strokeStyle='rgba(0,0,0,0.3)'; for(let k=0;k<hh;k+=5){ g.beginPath(); g.moveTo(x+4,y+k); g.lineTo(x+w-4,y+k); g.stroke(); } break;
      case 'hottub': g.fillStyle='#7a5537'; g.fillRect(x,y,w,hh); g.fillStyle='#6fd0e8'; g.beginPath(); g.arc(x+w/2,y+hh/2,w/2-6,0,7); g.fill(); break;
      case 'rock': for(let i=0;i<26;i++){ const rx=x+R()*w, ry=y+R()*hh; g.fillStyle='rgba(0,0,0,0.2)'; g.beginPath(); g.arc(rx+3,ry+3,4+R()*6,0,7); g.fill(); g.fillStyle=['#9b9488','#b3ac9f','#87806f'][(R()*3)|0]; g.beginPath(); g.arc(rx,ry,4+R()*6,0,7); g.fill(); } for(let i=0;i<30;i++){ g.fillStyle=['#c56cf0','#ffd32a','#ff5e57'][(R()*3)|0]; g.fillRect(x+R()*w,y+R()*hh,3,3); } break;
      case 'paddock': g.fillStyle='#8fae5a'; g.fillRect(x,y,w,hh); g.strokeStyle='#e8e0cc'; g.lineWidth=2.5; g.strokeRect(x+3,y+3,w-6,hh-6); g.lineWidth=1; for(let k=x+3;k<x+w;k+=u){ g.beginPath(); g.moveTo(k,y+3); g.lineTo(k,y+7); g.stroke(); } for(let k=0;k<3;k++){ const hx=x+u*(2+k*3.2), hy=y+hh*(0.35+0.2*(k%2)); g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(hx+3,hy+3,22,9); g.fillStyle=['#6b3e1f','#2b2b2b','#c9a46b'][k]; g.fillRect(hx,hy,22,9); g.fillRect(hx+20,hy-2,7,6); } break;
      case 'gate': break;
    } }
  // buildings over the ground
  for(const f of h.feat){ const x=L(f.x), y=Tt(f.y), w=f.w*u, hh=f.h*u;
    if(f.k==='house'||f.k==='barn'||f.k==='workshop') hRoof(g,x,y,w,hh,f.k==='workshop'?{roof:'shed'}:f,u);
    if(f.k==='workshop'){ g.fillStyle='#4a5157'; for(let k=0;k<3;k++) g.fillRect(x+w*(0.12+k*0.3),y-4,w*0.2,6); }
    if(f.k==='tower'){ g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(x+6,y+6,w,hh); g.fillStyle='#b9ad96'; g.fillRect(x,y,w,hh); g.fillStyle='#4c545e'; g.beginPath(); g.moveTo(x,y); g.lineTo(x+w,y); g.lineTo(x+w/2,y+hh/2); g.closePath(); g.fill(); g.fillStyle='#3e454e'; g.beginPath(); g.moveTo(x+w,y); g.lineTo(x+w,y+hh); g.lineTo(x+w/2,y+hh/2); g.closePath(); g.fill(); g.fillStyle='#5a636e'; g.beginPath(); g.moveTo(x,y+hh); g.lineTo(x+w,y+hh); g.lineTo(x+w/2,y+hh/2); g.closePath(); g.fill(); g.fillStyle='#d4af37'; g.fillRect(x+w/2-2,y+hh/2-10,4,20); g.fillRect(x+w/2-8,y+hh/2-4,16,4); }
    if(f.k==='house'&&f.roof==='chapel'){ g.fillStyle='rgba(120,160,220,0.75)'; for(let k=1;k<4;k++){ g.fillRect(x-5,y+hh*k/4-8,5,16); g.fillRect(x+w,y+hh*k/4-8,5,16); } g.fillStyle='#6b3a2a'; g.fillRect(x+w/2-10,y+hh,20,6); } }
  // boundary: hedge / wall / railings / timber post-and-rail
  const bd=h.kind==='cottage'||h.kind==='chapel'?'wall':h.kind==='town'?'rail':h.kind==='cabin'||h.kind==='lodge'||h.kind==='ranch'||h.kind==='farm'?'timber':'hedge';
  const gapL=L(hd.x)-4, gapR=L(hd.x)+hd.w*u+4;
  const seg=(x0,y0,x1,y1)=>{ if(bd==='hedge'){ g.fillStyle='#2e5f2a'; g.fillRect(Math.min(x0,x1)-5,Math.min(y0,y1)-5,Math.abs(x1-x0)+10,Math.abs(y1-y0)+10); g.fillStyle='#3d7a35'; for(let t=0;t<=1;t+=8/Math.max(8,Math.hypot(x1-x0,y1-y0))){ g.beginPath(); g.arc(x0+(x1-x0)*t,y0+(y1-y0)*t,5,0,7); g.fill(); } }
    else if(bd==='wall'){ g.fillStyle='#8f8a80'; g.fillRect(Math.min(x0,x1)-4,Math.min(y0,y1)-4,Math.abs(x1-x0)+8,Math.abs(y1-y0)+8); g.fillStyle='#b0aa9e'; g.fillRect(Math.min(x0,x1)-3,Math.min(y0,y1)-3,Math.abs(x1-x0)+6,3); }
    else if(bd==='rail'){ g.strokeStyle='#1f2326'; g.lineWidth=3; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.fillStyle='#1f2326'; const L2=Math.hypot(x1-x0,y1-y0); for(let t=0;t<=L2;t+=7){ g.fillRect(x0+(x1-x0)*t/L2-1.5,y0+(y1-y0)*t/L2-1.5,3,3); } g.fillStyle='#c9a227'; for(let t=0;t<=L2;t+=28){ g.beginPath(); g.arc(x0+(x1-x0)*t/L2,y0+(y1-y0)*t/L2,2.5,0,7); g.fill(); } }
    else { g.strokeStyle='#7a5a3a'; g.lineWidth=2.5; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.fillStyle='#5a3f26'; const L2=Math.hypot(x1-x0,y1-y0); for(let t=0;t<=L2;t+=u*0.75) g.fillRect(x0+(x1-x0)*t/L2-3,y0+(y1-y0)*t/L2-3,6,6); } };
  const m=6; seg(m,m,gapL,m); seg(gapR,m,W-m,m); seg(W-m,m,W-m,H-m); seg(W-m,H-m,m,H-m); seg(m,H-m,m,m);
  if(h.kind==='town'){ g.fillStyle='#1f2326'; g.fillRect(gapL,0,gapR-gapL,6); g.fillStyle='#c9a227'; for(let x=gapL;x<gapR;x+=12) g.fillRect(x,1,3,4); g.fillRect(gapL-6,-2,8,10); g.fillRect(gapR-2,-2,8,10); }
  else { g.fillStyle='#555'; g.fillRect(gapL-8,0,8,10); g.fillRect(gapR,0,8,10); }
  // trees, kept off the drive, hardstanding and buildings
  const tf=h.feat.find(f=>f.k==='trees'); const solid=h.feat.filter(f=>['house','barn','workshop','tower','pool','pond','tennis','deck','paddock','veg','yard','patio','terrace','orangery','graves','jetty','hottub','rock','cgarden'].includes(f.k));
  if(tf){ let tries=0; while(trees.length<tf.n+9*(h.kind==='farm'?1:0)&&tries++<600){ const tx=12+R()*(W-24), ty=12+R()*(H-24), r=u*(0.55+R()*0.55);
      if(tx>L(hd.x)-r-8&&tx<L(hd.x)+hd.w*u+r+8&&ty<hd.h*u+r+4) continue; if(solid.some(f=>tx>L(f.x)-r&&tx<L(f.x)+f.w*u+r&&ty>Tt(f.y)-r&&ty<Tt(f.y)+f.h*u+r)) continue; if(trees.some(t=>Math.hypot(t[0]-tx,t[1]-ty)<t[2]+r*0.8)) continue; trees.push([tx,ty,r,{pine:tf.pine,palm:tf.palm,yew:tf.yew}]); } }
  for(const t of trees) hTree(g,t[0],t[1],t[2],t[3],R);
  // night light points (world px): windows along the house, lamps along the drive / garden
  h.lights=[]; for(const f of h.feat) if(f.k==='house'||f.k==='workshop'){ for(let k=1;k<4;k++){ h.lights.push([(f.x+f.w*k/4)*u,(f.y+f.h+0.2)*u,60,'rgba(255,200,120,0.9)',0.55]); h.lights.push([(f.x+f.w*k/4)*u,(f.y-0.2)*u,50,'rgba(255,200,120,0.9)',0.4]); } }
  for(const s of [-1,1]) h.lights.push([(hd.x+(s<0?-0.4:hd.w+0.4))*u,(hd.y+1)*u,110,'rgba(255,225,170,1)',0.7]);
  if(h.feat.some(f=>f.k==='lamps')) for(let k=0;k<5;k++) h.lights.push([(h.x0+2+R()*(h.w-4))*u,(h.y0+9+R()*(h.h-11))*u,70,'rgba(255,220,150,1)',0.45]);
  for(const f of h.feat) if(f.k==='pool'||f.k==='hottub') h.lights.push([(f.x+f.w/2)*u,(f.y+f.h/2)*u,f.w*u*0.7,'rgba(90,200,255,1)',0.6]);
  for(const f of h.feat) if(f.k==='firepit') h.lights.push([(f.x+1)*u,(f.y+1)*u,90,'rgba(255,140,40,1)',0.8]);
  return c; }
function hArt(h){ return h.art||(h.art=hDrawPlot(h)); }
function hAgentArt(a){ if(a.art) return a.art; const u=TILE, c=document.createElement('canvas'); c.width=12*u; c.height=9*u; const g=c.getContext('2d');
  g.fillStyle='#cfc9bd'; g.fillRect(0,0,c.width,c.height); g.strokeStyle='rgba(0,0,0,0.08)'; for(let x=0;x<c.width;x+=16){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,c.height); g.stroke(); }
  g.fillStyle='#9c9d99'; g.fillRect(3*u,0,6*u,4*u); g.strokeStyle='#fff'; g.lineWidth=2; g.strokeRect(3*u+6,6,6*u-12,4*u-12); g.fillStyle='rgba(255,255,255,0.8)'; g.font='bold 13px system-ui'; g.textAlign='center'; g.fillText('CUSTOMER PARKING',6*u,2.2*u);
  g.fillStyle='rgba(0,0,0,0.3)'; g.fillRect(u+8,5*u+8,10*u,4*u); g.fillStyle='#2c3e50'; g.fillRect(u,5*u,10*u,4*u); g.fillStyle='#34495e'; g.fillRect(u,5*u,10*u,1.2*u);
  g.fillStyle='#0f5132'; g.fillRect(u-6,5*u-14,10*u+12,22); g.fillStyle='#d4af37'; g.font='900 15px Georgia,serif'; g.fillText(a.name.toUpperCase(),6*u,5*u+2);
  g.fillStyle='#bfe3f2'; for(let k=0;k<5;k++) g.fillRect(u+12+k*2*u,5*u+10,1.6*u,6); g.fillStyle='#e74c3c'; g.fillRect(1.5*u,4.2*u,6,0.8*u); g.fillRect(10.2*u,4.2*u,6,0.8*u);
  for(const x of [1.2*u,10.6*u]){ g.fillStyle='#2e5f2a'; g.beginPath(); g.arc(x,4.4*u,12,0,7); g.fill(); }
  g.fillStyle='#fff'; g.font='900 22px Arial Black,Arial'; g.fillText('\u{1F3E0}',6*u,7.6*u); return a.art=c; }
// ---------- per-frame: driveway / agent triggers
function homeIn(r){ const f=fwd(truck.h), cx=truck.x+f[0]*1.9, cy=truck.y+f[1]*1.9; return cx>r.x0*M_T&&cx<(r.x0+r.w)*M_T&&cy>r.y0*M_T&&cy<(r.y0+r.h)*M_T; }
function updateHomes(dt){ if(!world.ready||!started||!HOMES.list.length) return; let hit=null;
  if(Math.abs(truck.v)<4){ for(const h of HOMES.list){ if(homeIn({x0:h.hard.x-1,y0:h.y0-h.gap,w:h.hard.w+2,h:h.hard.h+h.gap})){ hit=['h',h]; break; } }
    if(!hit) for(const a of HOMES.agents) if(homeIn({x0:a.x0+2,y0:a.y0-a.gap,w:8,h:a.gap+4.5})){ hit=['a',a]; break; } }
  const key=hit?hit[0]+hit[1].id:null; if(key!==HOMES.slot){ HOMES.slot=key; if(hit&&!career.uiOpen&&!(typeof bigmap!=='undefined'&&bigmap.open)){ if(hit[0]==='h') homeCard(hit[1]); else estatePanel(hit[1]); } } }
// ---------- drawing in the world (low layer, under vehicles)
function drawHomes(vx0,vy0,vx1,vy1){ if(!HOMES.list.length) return; const u=TILE, dark=typeof DN!=='undefined'?DN.dark:0;
  for(const h of HOMES.list){ const x=h.x0*u, y=h.y0*u, w=h.w*u, hh=h.h*u; if(x>vx1+40||x+w<vx0-40||y-h.gap*u>vy1+40||y+hh<vy0-40) continue;
    // driveway from the road to the plot
    const hd=h.hard; ctx.fillStyle='#a7a8a4'; ctx.fillRect(((h.x0+(h.w>>1))-3)*u,(h.y0-h.gap)*u,6*u,h.gap*u); ctx.fillStyle='#8f908c'; ctx.fillRect(((h.x0+(h.w>>1))-3)*u-3,(h.y0-h.gap)*u,3,h.gap*u); ctx.fillRect(((h.x0+(h.w>>1))+3)*u,(h.y0-h.gap)*u,3,h.gap*u);
    ctx.drawImage(hArt(h),x,y);
    // FOR SALE / HOME board at the drive mouth
    const own=homeOwned(h), bx=((h.x0+(h.w>>1))+3.6)*u, by=(h.y0-h.gap+0.3)*u; ctx.fillStyle='#5a3f26'; ctx.fillRect(bx+20,by+18,4,16); ctx.fillStyle=own?'#1e8449':'#c0392b'; ctx.fillRect(bx,by,44,20); ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.strokeRect(bx+1.5,by+1.5,41,17);
    ctx.fillStyle='#fff'; ctx.font='bold 9px system-ui'; ctx.textAlign='center'; ctx.fillText(own?'HOME':'FOR SALE',bx+22,by+13); ctx.textAlign='left';
    if(dark>0.05&&typeof dnLight==='function'){ for(const L of h.lights) dnLight(L[0],L[1],L[2],L[3],L[4]*(own?1:0.55)); dnLight(bx+22,by+10,40,own?'rgba(120,255,160,1)':'rgba(255,120,110,1)',0.5); } }
  for(const a of HOMES.agents){ const x=a.x0*u, y=a.y0*u; if(x>vx1+40||x+12*u<vx0-40||y-a.gap*u>vy1+40||y+9*u<vy0-40) continue; ctx.fillStyle='#9c9d99'; ctx.fillRect((a.x0+3)*u,(a.y0-a.gap)*u,6*u,a.gap*u); ctx.drawImage(hAgentArt(a),x,y);
    if(dark>0.05&&typeof dnLight==='function'){ dnLight((a.x0+6)*u,(a.y0+5)*u,170,'rgba(255,230,160,1)',0.8); for(const k of [1.5,10.5]) dnLight((a.x0+k)*u,(a.y0+4.4)*u,60,'rgba(255,90,80,1)',0.5); } } }
// ---------- map icons + POIs
function homeMapIcons(icon,px,py){ for(const a of HOMES.agents) icon(px(a.entrance.x),py(a.entrance.y),'#0f5132','E'); for(const h of HOMES.list) if(homeOwned(h)) icon(px(h.entrance.x),py(h.entrance.y),'#1e8449','\u{1F3E0}'); }
function homePOIs(test){ for(const a of HOMES.agents) test(a.ft,a.entrance.x,a.entrance.y,'Estate agent'); for(const h of HOMES.list) if(homeOwned(h)) test(h.ft,h.entrance.x,h.entrance.y,'Your home'); }
// ---------- UI
const HOME_CSS=`.hmm{width:min(980px,96%)!important;max-width:none!important;height:min(640px,92%);max-height:92%;padding:0!important;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#14202c,#0d1620)!important;border:1px solid rgba(212,175,55,.35)!important}
.hmm .hh{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);flex:none}.hmm .hh h2{margin:0;font-size:17px;color:#f4e6b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hmm .hh .sub{font-size:11px;opacity:.65}.hmm .bank{margin-left:auto;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:4px 10px;font-weight:800;color:#7dff9a;white-space:nowrap;font-size:13px}
.hmm .hx{background:rgba(255,255,255,.08);border:0;color:#fff;border-radius:8px;width:32px;height:32px;font-size:16px;cursor:pointer;flex:none}
.hmm .tabs{display:flex;gap:6px;padding:8px 14px 0;flex:none}.hmm .tabs .ti{flex:1;min-height:0;height:auto;line-height:1.2;padding:9px;border-radius:10px 10px 0 0;border:1px solid rgba(255,255,255,.1);border-bottom:0;background:rgba(255,255,255,.04);color:#cfd8e0;font-weight:800;letter-spacing:1px;cursor:pointer;font-size:12px}.hmm .tabs .ti.on{background:#1d2e3d;color:#f4e6b5;box-shadow:inset 0 3px 0 #d4af37}
.hmm .grid{flex:1;min-height:0;overflow:auto;padding:10px 14px;background:#1d2e3d;display:flex;flex-direction:column;gap:8px}
.hmm .li{display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:8px}.hmm .li img{width:92px;height:70px;border-radius:8px;object-fit:cover;flex:none;background:#2a3a2a}
.hmm .li .md{flex:1;min-width:0}.hmm .li .nm{font-weight:800;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hmm .li .rg{font-size:11px;opacity:.7}.hmm .li .fx{font-size:11px;opacity:.85;margin-top:3px}.hmm .li .pr{font-weight:900;color:#f4e6b5;font-size:15px}
.hmm .bdg{display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:1px;padding:2px 6px;border-radius:5px;margin-left:6px;vertical-align:middle}.hmm .bdg.o{background:#1e8449;color:#fff}.hmm .bdg.s{background:#c0392b;color:#fff}
.hmm .rt{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none}.hmm .ftb{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 10px;font-weight:800;font-size:11.5px;cursor:pointer;white-space:nowrap}.hmm .ftb.padfocus,.hmm .ti.padfocus,.hmm .hx.padfocus{outline:3px solid #ffd23f;outline-offset:1px}
.hmm .vf{font-size:10px;opacity:.6;font-style:italic}.hmm .ft{flex:none;padding:8px 14px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;opacity:.75;display:flex;justify-content:space-between;gap:10px}
@media (max-width:560px){.hmm .li{display:grid!important;grid-template-columns:64px 1fr;align-items:start}.hmm .li .rt{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;width:100%}.hmm .li .nm{white-space:normal}.hmm .tabs .ti{min-height:0!important;height:auto!important;padding:8px 4px!important;font-size:11px!important}.hmm{width:100%!important;height:100%!important;max-height:100%!important;border-radius:0!important}.hmm .li{gap:8px;padding:6px}.hmm .li img{width:64px;height:52px}.hmm .li .nm{font-size:13px}.hmm .li .fx{font-size:10.5px}.hmm .ftb{padding:7px 8px;font-size:11px}.hmm .hh h2{font-size:15px}.hmm .ft span:last-child{display:none}}
@media (max-height:480px){.hmm{height:96%!important;max-height:96%!important}.hmm .li img{height:46px;width:60px}.hmm .hh{padding:6px 12px}.hmm .tabs{padding-top:4px}.hmm .tabs .ti{padding:6px}}
.hcm{width:min(760px,95%)!important;max-width:none!important;max-height:92%;overflow:auto;padding:14px!important;background:linear-gradient(180deg,#14202c,#0d1620)!important;border:1px solid rgba(212,175,55,.35)!important}.hcm .wrap{display:flex;gap:14px}.hcm canvas{width:46%;border-radius:10px;align-self:flex-start;background:#2a3a2a}.hcm .in{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px}
.hcm h2{margin:0;color:#f4e6b5;font-size:19px}.hcm .k{font-size:11px;letter-spacing:1px;font-weight:800;color:#d4af37}.hcm .ds{font-size:12.5px;opacity:.85;line-height:1.35}.hcm .fa{display:grid;grid-template-columns:1fr 1fr;gap:5px}.hcm .fa div{background:rgba(255,255,255,.06);border-radius:8px;padding:5px 8px;font-size:11px}.hcm .fa b{display:block;font-size:13.5px;color:#fff}
.hcm .pr{font-size:24px;font-weight:900;color:#7dff9a}.hcm .bt{display:flex;gap:8px;margin-top:4px}.hcm .bt button{flex:1;padding:11px;border-radius:10px;border:0;font-weight:900;cursor:pointer}.hcm .buy{background:#16a34a;color:#fff}.hcm .buy:disabled{background:#4b5563;color:#ccc}.hcm .cn{background:rgba(255,255,255,.1);color:#fff}.hcm .padfocus{outline:3px solid #ffd23f}
@media (max-width:560px){.hcm .wrap{flex-direction:column}.hcm canvas{width:100%}.hcm{width:100%!important;max-height:100%!important;border-radius:0!important}}`;
function homeCss(){ if(document.getElementById('homecss')) return; const s=document.createElement('style'); s.id='homecss'; s.textContent=HOME_CSS; document.head.appendChild(s); }
function homeThumb(h,W,H){ const k=h.id+W; if(HOMES.thumbs[k]) return HOMES.thumbs[k]; const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'), a=hArt(h); const s=Math.max(W/a.width,H/a.height)*1.02; g.fillStyle='#4a6b3a'; g.fillRect(0,0,W,H); g.drawImage(a,(W-a.width*s)/2,(H-a.height*s)/2,a.width*s,a.height*s); return HOMES.thumbs[k]=c.toDataURL('image/jpeg',0.82); }
function yardThumb(yd){ const k='Y'+yd.id+(ownedYard(yd)?(ownedYard(yd).tier||1):0); if(HOMES.thumbs[k]) return HOMES.thumbs[k]; const c=document.createElement('canvas'); c.width=280; c.height=215; try{ ydPreview(c,yd,!!ownedYard(yd),(ownedYard(yd)||{}).tier||1); }catch(e){} return HOMES.thumbs[k]=c.toDataURL('image/jpeg',0.82); }
function homeKind(h){ return {mansion:'Country mansion',cabin:'Log cabin',villa:'Coastal glass villa',farm:'Farmhouse & barn',cottage:'Cornish-style cottage',town:'City townhouse',chapel:'Converted chapel',lodge:'Lakeside lodge',bungalow:'Hillside bungalow',ranch:'Trucker\u2019s ranch'}[h.kind]; }
function homePlot(h){ const m2=h.w*h.h*M_T*M_T; return m2>=10000?(m2/10000).toFixed(2)+' ha':Math.round(m2).toLocaleString('en-GB')+' m\u00b2'; }
function homeWhere(h){ return (h.city?'near '+h.city:'')+(h.region?' \u2022 '+h.region:''); }
function homeCard(h){ homeCss(); const own=homeOwned(h), can=truck.money>=h.price;
  const b=openModal('home',`<div class="wrap"><canvas width="520" height="420"></canvas><div class="in"><div class="k">${esc(homeKind(h).toUpperCase())} ${own?'<span style="color:#7dff9a">\u2022 YOUR HOME</span>':'\u2022 FOR SALE'}</div><h2>${esc(h.name)}</h2><div class="rg" style="font-size:12px;opacity:.7">${esc(homeWhere(h))}</div>
    <div class="ds">${esc(h.desc)}</div><div class="fa"><div>Bedrooms<b>${h.bed}</b></div><div>Plot<b>${homePlot(h)}</b></div><div>Lorry spaces<b>${h.lorries} rig${h.lorries>1?'s':''} + trailer</b></div><div>Fast travel<b>${own?'Enabled':'When owned'}</b></div></div>
    ${own?`<div class="pr" style="color:#f4e6b5">Welcome home</div><div class="ds">Your home is on the map and works as a fast-travel point.</div><div class="bt"><button class="cn btn sel" id="hmNo">CLOSE</button></div>`
      :`<div class="pr">${money(h.price)}</div><div class="ds">Bank: <b style="color:${can?'#7dff9a':'#ff7b72'}">${money(truck.money)}</b></div><div class="bt"><button class="buy btn sel" id="hmBuy" ${can?'':'disabled'}>${can?'BUY '+money(h.price):'NEED '+money(h.price-truck.money)+' MORE'}</button><button class="cn btn" id="hmNo">NOT NOW</button></div>`}
    <div class="ds" style="font-size:10.5px;opacity:.55">Enter / \u24b6 select \u2022 Esc / \u24b7 close</div></div></div>`,'hcm');
  const cv=b.querySelector('canvas'), g=cv.getContext('2d'), a=hArt(h), s=Math.min(cv.width/a.width,cv.height/a.height); g.fillStyle='#4a6b3a'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(a,(cv.width-a.width*s)/2,(cv.height-a.height*s)/2,a.width*s,a.height*s);
  const by=b.querySelector('#hmBuy'); if(by) by.addEventListener('click',()=>{ closeUI(); homeBuy(h); }); b.querySelector('#hmNo').addEventListener('click',closeUI); if(typeof padNav==='function') setTimeout(()=>padNav(null),40); }
function homeBuy(h){ if(homeOwned(h)) return false; if(truck.money<h.price){ toast('Not enough money: '+money(h.price)+' needed'); return false; }
  truck.money-=h.price; HOMES.owned[h.id]={bought:Date.now()}; HOMES.thumbs={}; toast('\u{1F3E0} '+h.name+' is yours! It\u2019s on your map as a fast-travel point.'); if(typeof saveGame==='function') saveGame(); if(typeof BigRig!=='undefined'&&BigRig.emit) BigRig.emit('homeBought',{id:h.id,name:h.name,price:h.price}); return true; }
function estatePanel(agent){ homeCss(); const tab=HOMES.tab;
  const res=HOMES.list.slice().sort((a,b)=>a.price-b.price).map((h,i)=>`<div class="li"><img src="${homeThumb(h,184,140)}" alt=""><div class="md"><div class="nm">${esc(h.name)}<span class="bdg ${homeOwned(h)?'o':'s'}">${homeOwned(h)?'OWNED':'FOR SALE'}</span></div><div class="rg">${esc(homeKind(h))} \u2022 ${esc(homeWhere(h))}</div><div class="fx">${h.bed} bed \u2022 ${homePlot(h)} \u2022 ${h.lorries} lorry space${h.lorries>1?'s':''}</div></div><div class="rt"><div class="pr">${money(h.price)}</div><button class="ftb btn${i===0?' sel':''}" data-h="${h.id}">FAST TRAVEL \u203a</button><div class="vf">${homeOwned(h)?'Your home':'View in person to buy'}</div></div></div>`).join('')||'<div class="li">No listings</div>';
  const com=(world.forSale||[]).map((yd,i)=>{ const o=ownedYard(yd), t=o?(o.tier||1):(yd.tier||1), T=OWN_TIERS[t]; return `<div class="li"><img src="${yardThumb(yd)}" alt=""><div class="md"><div class="nm">${esc(ydBrand(yd).name)}<span class="bdg ${o?'o':'s'}">${o?'OWNED \u2022 T'+t:'FOR SALE'}</span></div><div class="rg">Haulage yard \u2022 ${esc(yd.region||'')}</div><div class="fx">${esc(T.label)} \u2022 ${T.trucks} AI trucks \u2022 +${money(T.pay)}/container \u2022 ${T.bays} bays${OWN_TIERS[t+1]?' \u2022 next tier '+money(OWN_TIERS[t+1].price):''}</div></div><div class="rt"><div class="pr">${o?'Owned':money(OWN_TIERS[yd.tier||1].price)}</div><button class="ftb btn${i===0?' sel':''}" data-y="${yd.id}">FAST TRAVEL \u203a</button><div class="vf">${o?'Your yard':'View in person to buy'}</div></div></div>`; }).join('')||'<div class="li">No commercial listings</div>';
  const b=openModal('estate',`<div class="hh"><div style="font-size:24px">\u{1F3E1}</div><div style="min-width:0"><h2>${esc(agent?agent.name:'Estate agent')}</h2><div class="sub">Homes &amp; commercial property across the region</div></div><div class="bank">${money(truck.money)}</div><button class="hx btn" id="hmX">\u2715</button></div>
    <div class="tabs"><button class="ti btn${tab==='res'?' on':''}" data-t="res">RESIDENTIAL \u2022 ${HOMES.list.length}</button><button class="ti btn${tab==='com'?' on':''}" data-t="com">COMMERCIAL \u2022 ${(world.forSale||[]).length}</button></div>
    <div class="grid">${tab==='res'?res:com}</div><div class="ft"><span>No buying here \u2014 drive onto a property's driveway to view &amp; buy</span><span>\u2190 \u2192 / LB RB tabs \u2022 Enter / \u24b6 travel \u2022 Esc / \u24b7 close</span></div>`,'hmm');
  b.querySelector('#hmX').addEventListener('click',closeUI);
  for(const t of b.querySelectorAll('.ti')) t.addEventListener('click',()=>{ if(HOMES.tab===t.dataset.t) return; HOMES.tab=t.dataset.t; estatePanel(agent); setTimeout(()=>{ const e=document.querySelector('.hmm .ti.on'); if(e&&typeof padNav==='function'){ for(const q of document.querySelectorAll('.padfocus')) q.classList.remove('padfocus'); } },50); });
  for(const f of b.querySelectorAll('.ftb')) f.addEventListener('click',()=>{ const o=f.dataset.h?HOMES.list.find(h=>h.id===f.dataset.h).ft:(world.forSale||[]).find(y=>y.id===f.dataset.y); closeUI(); HOMES.slot='ft'; setTimeout(()=>fastTravel(o),60); });
  HOMES.agentOpen=agent; if(typeof padNav==='function') setTimeout(()=>padNav(null),40); }
addEventListener('keydown',e=>{ if(career.uiOpen!=='estate') return; if(e.code==='KeyQ'||e.code==='KeyE'||e.code==='PageUp'||e.code==='PageDown'){ HOMES.tab=HOMES.tab==='res'?'com':'res'; estatePanel(HOMES.agentOpen); e.preventDefault(); } },true);
setInterval(()=>{ if(career.uiOpen!=='estate'||!navigator.getGamepads) return; const g=[...navigator.getGamepads()].find(g=>g&&g.connected); if(!g) return; const lb=g.buttons[4]&&g.buttons[4].pressed, rb=g.buttons[5]&&g.buttons[5].pressed; if((lb||rb)&&!HOMES.pb){ HOMES.tab=HOMES.tab==='res'?'com':'res'; estatePanel(HOMES.agentOpen); } HOMES.pb=lb||rb; },60);
setTimeout(()=>{ if(typeof drawPortTrucksLow==='function'){ const d=drawPortTrucksLow; drawPortTrucksLow=function(a,b,c,e){ drawHomes(a,b,c,e); return d.apply(this,arguments); }; }
  if(typeof updatePortTrucks==='function'){ const u=updatePortTrucks; updatePortTrucks=function(dt){ u.apply(this,arguments); try{ updateHomes(dt); }catch(e){ console.warn(e); } }; } },0);
BigRig.homes=()=>HOMES.list.map(h=>({id:h.id,name:h.name,kind:h.kind,price:h.price,x:h.entrance.x,y:h.entrance.y,region:h.region,city:h.city,owned:homeOwned(h)}));
