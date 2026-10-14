// ===================== v33 player-owned haulage yards (tier 1). Per player: ownership lives in this client's save only, so in
// multiplayer other players keep seeing an empty FOR SALE yard and never get the owner's trucks (traffic is local per client).
const OWN_TIERS={1:{price:2000,trucks:2,pay:500,bays:4,label:'Tier 1 haulage yard',adds:'Office, truck garage and warehouse \u2022 4 bays'},
  2:{price:3000,trucks:4,pay:500,bays:6,label:'Tier 2 depot',adds:'Second warehouse \u2022 6 bays \u2022 4 trucks'},
  3:{price:5000,trucks:6,pay:500,bays:8,label:'Tier 3 distribution hub',adds:'Distribution centre HQ \u2022 8 bays \u2022 more floodlights \u2022 6 trucks'}};   // up: prices are test values - edit here
const OWN_MAX=3;
const OWN={yards:{},slot:null,inc:0,home:null};   // yards: id -> {tier,bought,delivered,earned}
function ownCompany(){ const n=(localStorage.getItem('bigrig.name')||'').trim(); return (n?n:'Your')+' Haulage'; }
function ownSave(){ return {yards:OWN.yards,home:OWN.home}; }
function ownLoad(o){ OWN.yards=(o&&o.yards)||{}; OWN.home=(o&&o.home)||null; OWN.applied=0; }
function ownT(yd){ const o=OWN.yards[yd.id]; return o?o.tier||1:0; }
// make the yard match its tier: open the extra bays, make the new buildings solid
function ownApplyTier(yd){ const t=ownT(yd); for(const b of yd.bays){ const on=t>=(b.need||1)||(!t&&b.need===1); if(b.need>1) b.assigned=!on; }
  if(typeof DOCK_FENCE!=='undefined'){ if(!DOCK_FENCE) DOCK_FENCE=new Uint8Array(MW*MH); for(const [R,need] of [[yd.wh2,2],[yd.hq,3]]) if(R) for(let j=R.y0;j<R.y0+R.h;j++) for(let i=R.x0;i<R.x0+R.w;i++) DOCK_FENCE[idx(i,j)]=t>=need?1:0; for(let j=yd.y0+19;j<yd.y0+yd.h;j++) for(let i=yd.x0;i<yd.x0+yd.w;i++) DOCK_FENCE[idx(i,j)]=1; } }
function ownUpgrade(yd){ const o=ownedYard(yd); if(!o) return false; const nt=(o.tier||1)+1; if(nt>OWN_MAX){ toast('Already at the top tier'); return false; } const T=OWN_TIERS[nt];
  if(truck.money<T.price){ toast('Not enough money: '+money(T.price)+' needed'); return false; }
  truck.money-=T.price; o.tier=nt; ownApplyTier(yd); toast(ydBrand(yd).name+' upgraded to '+T.label+' \u2022 '+T.trucks+' trucks'); if(typeof saveGame==='function') saveGame(); return true; }
function ownYards(){ return (world.forSale||[]); }
function ownedYard(yd){ return OWN.yards[yd.id]||null; }
function ownTier(yd){ return OWN_TIERS[(ownedYard(yd)||{}).tier||yd.tier||1]; }
function ydBrand(yd){ return yd.brand||{name:yd.name,mono:'YD',col:'#2c3e50',acc:'#f5b82e',glyph:'chev'}; }
function ownIn(s){ const f=fwd(truck.h), cx=truck.x+f[0]*1.9, cy=truck.y+f[1]*1.9; return Math.abs(cx-s.x)<s.w/2&&Math.abs(cy-s.y)<s.L/2; }
// ---- logo: round badge, brand colour, accent ring + glyph + monogram (vector, any size)
function ydLogo(g,x,y,r,B){ g.save(); g.translate(x,y);
  g.fillStyle='rgba(0,0,0,0.35)'; g.beginPath(); g.arc(r*0.06,r*0.1,r,0,7); g.fill();
  g.fillStyle=B.col; g.beginPath(); g.arc(0,0,r,0,7); g.fill(); g.lineWidth=Math.max(1.5,r*0.12); g.strokeStyle=B.acc; g.beginPath(); g.arc(0,0,r*0.86,0,7); g.stroke();
  g.strokeStyle=B.acc; g.fillStyle=B.acc; g.lineWidth=Math.max(1.2,r*0.1); g.lineCap='round'; g.lineJoin='round'; g.globalAlpha=0.55;
  if(B.glyph==='chev'){ for(const k of [-0.32,0]){ g.beginPath(); g.moveTo(-r*0.5,r*(0.42+k)); g.lineTo(0,r*(0.18+k)); g.lineTo(r*0.5,r*(0.42+k)); g.stroke(); } }
  else if(B.glyph==='wave'){ for(const k of [0.28,0.48]){ g.beginPath(); for(let i=0;i<=16;i++){ const t=i/16, px=-r*0.6+t*r*1.2, py=r*k+Math.sin(t*Math.PI*3)*r*0.07; i?g.lineTo(px,py):g.moveTo(px,py); } g.stroke(); } }
  else if(B.glyph==='bars'){ for(let i=0;i<3;i++) g.fillRect(-r*0.48+i*r*0.36,r*0.22,r*0.22,r*0.3); }
  else { g.beginPath(); g.moveTo(-r*0.55,r*0.5); g.lineTo(-r*0.15,r*0.12); g.lineTo(r*0.05,r*0.3); g.lineTo(r*0.3,r*0.05); g.lineTo(r*0.55,r*0.5); g.stroke(); }
  g.globalAlpha=1; g.fillStyle='#fff'; g.font='900 '+Math.round(r*0.62)+'px Arial Black,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(B.mono,0,-r*0.14); g.restore(); }
// ---- per frame: slots (buy / garage / office / free service), fleet upkeep
function updateOwnDepots(dt){ if(!world.ready||!world.forSale) return; if(!OWN.applied){ OWN.applied=1; for(const yd of world.forSale) ownApplyTier(yd); } for(const yd of world.forSale) ownTrain(yd,dt);
  let hit=null; if(Math.abs(truck.v)<0.6) for(const yd of ownYards()){ const o=ownedYard(yd);
    if(!o&&ownIn(yd.slot)) hit=[yd,'buy']; else if(o&&yd.gslot&&ownIn(yd.gslot)) hit=[yd,'garage']; else if(o&&yd.oslot&&ownIn(yd.oslot)) hit=[yd,'office']; else if(o&&yd.sslot&&ownIn(yd.sslot)) hit=[yd,'service']; }
  const key=hit?hit[0].id+hit[1]:null;
  if(key!==OWN.slot){ OWN.slot=key; if(hit&&!career.uiOpen&&!(typeof bigmap!=='undefined'&&bigmap.open)){ const [yd,k]=hit;
      if(k==='buy') ownBuyCard(yd); else if(k==='garage'){ if(typeof openDealer==='function'){ dealerState.sel=career.cur; openDealer({name:ydBrand(yd).name+' \u2022 Garage',entrance:yd.entrance}); } }
      else if(k==='office') ownDash(yd); else if(k==='service'){ const f=truck.tank||truck.fuel, d=truck.damage; truck.fuel=truck.tank||truck.fuel; truck.damage=0; if(truck.trl&&truck.trl.damage) truck.trl.damage=0; toast(ydBrand(yd).name+' service bay: '+(d>0.5||truck.fuel>f?'refuelled and repaired':'all topped up')+' \u2022 free'); } } }
  if(typeof PTRUCK==='undefined') return;
  for(const yd of ownYards()){ const o=ownedYard(yd); if(!o) continue; const need=ownTier(yd).trucks, have=PTRUCK.list.filter(T=>T.home===yd).length;
    if(have<need&&PTRUCK.t>(yd.spawnT||0)){ yd.spawnT=PTRUCK.t+6; const g=ptDepotGeo(yd); if(!g) continue; const P=portList().filter(P=>P.ready&&P.lpath).sort((a,b)=>Math.hypot(a.O[0]*M_T-yd.x,a.O[1]*M_T-yd.y)-Math.hypot(b.O[0]*M_T-yd.x,b.O[1]*M_T-yd.y))[0]; if(!P) continue;
      const T={P,st:'new',box:null,t:0,id:'own'+yd.id+have,home:yd}; ownMission(T); for(const dir of [1,-1]) if(ptToRoad(T,g.sg,dir,g.along+dir*7,T.tgt==='port'?ptGateGoal(T.P):T.dest)){ PTRUCK.list.push(T); break; } } } }
// up: random mission for a company truck leaving its yard empty: a container terminal (docks) or another depot / container yard on the map
function ownMission(T){ const yd=T.home, e=yd.entrance;
  const L=world.depots.filter(d=>d.bays&&d.bays.length&&!portList().some(Q=>Q.depot===d)&&ptDepotGeo(d)&&d.bays.every(b=>!b.th)).map(d=>[d,Math.hypot(d.entrance.x-e.x,d.entrance.y-e.y)]).filter(q=>q[1]>400&&q[1]<7000);
  if(L.length&&Math.random()<0.55){ T.dest=L[(Math.random()*L.length)|0][0]; T.pick=1; T.tgt='depot'; T.mis=T.dest.name; }
  else { const P=portList().filter(P=>P.ready&&P.lpath); T.P=P[(Math.random()*P.length)|0]||T.P; T.dest=null; T.pick=0; T.tgt='port'; T.mis=T.P&&T.P.depot?T.P.depot.name:'docks'; } }
function ownDelivered(T){ const yd=T.home, o=ownedYard(yd); if(!o) return; const pay=ownTier(yd).pay; truck.money+=pay; o.delivered=(o.delivered||0)+1; o.earned=(o.earned||0)+pay; OWN.inc+=pay;
  o.stock=(o.stock||0)+1; toast('+'+money(pay)+' \u2022 '+ydBrand(yd).name+' truck unloaded a container into the warehouse'); if(typeof saveGame==='function') saveGame(); }
function ownBuy(yd){ const t=OWN_TIERS[yd.tier||1]; if(ownedYard(yd)) return false; if(truck.money<t.price){ toast('Not enough money: '+money(t.price)+' needed'); return false; }
  truck.money-=t.price; OWN.yards[yd.id]={tier:yd.tier||1,bought:Date.now(),delivered:0,earned:0}; if(!OWN.home) OWN.home=yd.id; ownApplyTier(yd); toast(ydBrand(yd).name+' is yours! '+t.trucks+' trucks start work at the docks.'); if(typeof saveGame==='function') saveGame(); return true; }
// ---- purchase card
const OWN_CSS=`.ydc{display:flex;gap:18px;height:100%;padding:18px;box-sizing:border-box}.ydc .pv{flex:1.1;min-width:0;display:flex;flex-direction:column;gap:10px}.ydc .pv canvas{width:100%;height:auto;aspect-ratio:560/430;max-height:100%;border-radius:12px;background:#222}
.ydc .in{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}.ydc .hd{display:flex;align-items:center;gap:12px}.ydc h2{margin:0;font-size:24px;line-height:1.1}.ydc .chip{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:99px}
.ydc .price{font-size:34px;font-weight:900;color:#ffd866}.ydc .inc{font-size:15px;color:#7dff9a;font-weight:800}.ydc ul{margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#dfe7f1}.ydc .bt{display:flex;gap:12px;margin-top:auto}
.ydc .bt button{flex:1;min-height:70px;font-size:20px;font-weight:900;border-radius:14px;border:0;cursor:pointer}.ydc .buy{background:linear-gradient(180deg,#3ddc84,#1f9d57);color:#06210f}.ydc .buy[disabled]{filter:grayscale(1);opacity:.6}.ydc .cn{background:#3a4352;color:#fff}
.ydc .hint{font-size:12px;opacity:.65;text-align:center}.ydc .row{display:flex;justify-content:space-between;font-size:14px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}
@media (max-width:700px),(orientation:portrait){.ydc{flex-direction:column;overflow:auto}.ydc .pv canvas{max-height:28vh;width:auto;align-self:center}}`;
function ownCss(){ if(document.getElementById('ydcss')) return; const s=document.createElement('style'); s.id='ydcss'; s.textContent=OWN_CSS; document.head.appendChild(s); }
function ydPreview(cv,yd,owned,tier){ tier=tier||1; const g=cv.getContext('2d'), W=cv.width, H=cv.height, B=ydBrand(yd); g.fillStyle='#5f8f3e'; g.fillRect(0,0,W,H);
  const s=Math.min(W/24,H/28), ox=(W-22*s)/2, oy=(H-26*s)/2+2.4*s, X=t=>ox+(t+1)*s, Y=t=>oy+t*s;
  g.fillStyle='#2b2f34'; g.fillRect(0,oy-2.6*s,W,2.2*s); g.strokeStyle='#e8e8e8'; g.setLineDash([s*0.8,s*0.6]); g.lineWidth=2; g.beginPath(); g.moveTo(0,oy-1.5*s); g.lineTo(W,oy-1.5*s); g.stroke(); g.setLineDash([]);
  g.fillStyle='#3d4249'; g.fillRect(X(7),oy-0.4*s,6*s,0.6*s); g.fillRect(X(0),Y(0),20*s,24*s);
  g.strokeStyle='#9aa3ad'; g.lineWidth=2; g.beginPath(); g.moveTo(X(7),Y(0)); g.lineTo(X(0),Y(0)); g.lineTo(X(0),Y(24)); g.lineTo(X(20),Y(24)); g.lineTo(X(20),Y(0)); g.lineTo(X(13),Y(0)); g.stroke();
  g.strokeStyle='#fff'; const nb=OWN_TIERS[tier].bays; for(let k=0;k<=nb;k++){ g.beginPath(); g.moveTo(X(7.5+k*1.25),Y(10.3)); g.lineTo(X(7.5+k*1.25),Y(14.7)); g.stroke(); } g.fillStyle='#f1c40f'; g.fillRect(X(7.5),Y(14.6),nb*1.25*s,0.15*s);
  const pb=(x,y,w,h,c,rc)=>{ g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(X(x)+4,Y(y)+4,w*s,h*s); g.fillStyle=c; g.fillRect(X(x),Y(y),w*s,h*s); g.fillStyle=rc; for(let k=0.4;k<w;k+=0.8) g.fillRect(X(x+k),Y(y),0.12*s,h*s); };
  pb(7,15,6,4,'#8796a5','#6f7d8b'); if(tier>=2) pb(13,15,6,4,'#8a9a7a','#717f63'); else { g.strokeStyle='#888'; g.setLineDash([4,4]); g.strokeRect(X(13),Y(15),6*s,4*s); g.setLineDash([]); }
  if(tier>=3){ pb(1,15,5,4,'#e6e9ee','#ccd2d9'); g.fillStyle=B.col; g.fillRect(X(1),Y(15),5*s,0.5*s); } else { g.strokeStyle='#888'; g.setLineDash([4,4]); g.strokeRect(X(1),Y(15),5*s,4*s); g.setLineDash([]); }
  g.fillStyle='#6d5a48'; g.fillRect(X(0),Y(20.9),20*s,1.2*s); g.fillStyle='#bfc5cb'; g.fillRect(X(0),Y(21.1),20*s,0.12*s); g.fillRect(X(0),Y(21.8),20*s,0.12*s); g.fillStyle='#f1c40f'; g.fillRect(X(9.6),Y(19.3),0.4*s,4.4*s); g.fillRect(X(9.6),Y(19.3),2.6*s,0.3*s); g.fillRect(X(11.8),Y(19.3),0.4*s,4.4*s);
  g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(X(1)+5,Y(1)+5,5*s,4*s); g.fillRect(X(14)+5,Y(1)+5,5*s,3*s);
  g.fillStyle='#e9edf1'; g.fillRect(X(1),Y(1),5*s,4*s); g.fillStyle=B.col; g.fillRect(X(1),Y(1),5*s,0.7*s); g.fillStyle='#7fb2d8'; for(let k=0;k<4;k++) g.fillRect(X(1.4+k*1.15),Y(4.3),0.7*s,0.4*s);
  g.fillStyle='#6b737c'; g.fillRect(X(14),Y(1),5*s,3*s); g.fillStyle='#3a3f45'; for(let k=0;k<5;k++) g.fillRect(X(14.6),Y(3.3)+k*0.12*s,3.8*s,0.06*s);
  ydLogo(g,X(3.5),Y(3),s*1.15,B);
  for(const [bx,col] of [[8.1,B.col],[10.6,'#d63b2f']]){ g.fillStyle='#333'; g.fillRect(X(bx-0.3),Y(10.6),0.6*s,3.4*s); g.fillStyle=col; g.fillRect(X(bx-0.35),Y(9.4),0.7*s,1.4*s); g.fillStyle=YARD_COLS[(bx*3|0)%8]; g.fillRect(X(bx-0.3),Y(10.9),0.6*s,3*s); }
  if(!owned){ g.save(); g.translate(X(10),Y(7.5)); g.rotate(-0.12); g.fillStyle='rgba(243,156,18,.92)'; g.fillRect(-4.2*s,-0.9*s,8.4*s,1.8*s); g.fillStyle='#fff'; g.font='900 '+Math.round(s*1.1)+'px Arial Black,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('FOR SALE',0,0.05*s); g.restore(); } }
function ownBuyCard(yd){ ownCss(); const t=OWN_TIERS[yd.tier||1], B=ydBrand(yd), can=truck.money>=t.price;
  const b=openModal('ownbuy',`<div class="ydc"><div class="pv"><canvas width="560" height="430"></canvas><div class="hint">${esc(yd.name)} \u2022 20 \u00d7 24 tile yard \u2022 4 reverse bays, office, garage, warehouse, rail siding</div></div>
   <div class="in"><div class="hd"><canvas class="lg" width="84" height="84" style="width:64px;height:64px"></canvas><div><span class="chip" style="background:${B.col};color:${B.acc}">${esc(t.label.toUpperCase())}</span><h2>${esc(B.name)}</h2></div><div style="flex:1"></div></div>
   <div><div class="price">${money(t.price)}</div><div class="inc">+${money(t.pay)} for every container your trucks deliver here</div></div>
   <ul><li>${t.trucks} AI trucks fetch containers from the docks and other yards</li><li>Warehouse + rail siding: a gantry loads your stock onto trains</li><li>Upgrade later: T2 ${money(OWN_TIERS[2].price)}, T3 ${money(OWN_TIERS[3].price)}</li><li>Truck garage: buy, swap and paint your trucks</li><li>Free fuel &amp; repair bay</li><li>Office with your company dashboard</li><li>Your home yard (one-tap travel)</li></ul>
   <div class="row"><span>Your money</span><b style="color:${can?'#7dff9a':'#ff7b72'}">${money(truck.money)}</b></div>
   <div class="bt"><button class="buy btn sel" id="ownBuy" ${can?'':'disabled'}>${can?'BUY':'NEED '+money(t.price-truck.money)}</button><button class="cn btn" id="ownNo">CANCEL</button></div>
   <div class="hint">Enter / \u24b6 buy \u2022 Esc / \u24b7 cancel</div></div></div>`,'ydm');
  ydPreview(b.querySelector('.pv canvas'),yd,false); const lg=b.querySelector('canvas.lg'); ydLogo(lg.getContext('2d'),42,42,38,B);
  b.querySelector('#ownBuy').addEventListener('click',()=>{ closeUI(); ownBuy(yd); }); b.querySelector('#ownNo').addEventListener('click',closeUI);
  if(typeof padNav==='function') setTimeout(()=>padNav(null),40); }
// ---- office: company dashboard
function ownTruckStatus(T){ const port=T.P&&T.P.depot?T.P.depot.name.replace(/ Container Terminal| Terminal/,''):'docks';
  if(T.st==='gate'){ return T.box?'Loaded, leaving '+port:(T.l&&T.l.at?'Waiting for a container at '+port:'Entering '+port); }
  if(T.st==='depot') return T.dest===T.home||!T.pick?(T.ph==='rev'?'Reversing into a yard bay':T.ph==='drop'?'Unloading into the warehouse':'Manoeuvring in the yard'):(T.ph==='drop'?'Loading a container at '+T.dest.name:'Manoeuvring at '+T.dest.name);
  if(T.st==='road') return T.box?'Bringing a container back to the yard':'Driving empty to '+(T.pick&&T.dest?T.dest.name:port); return 'Starting up'; }
function ownDash(yd){ ownCss(); const mine=ownYards().filter(ownedYard), B=ydBrand(yd); let tot=0,del=0; for(const y of mine){ const o=ownedYard(y); tot+=o.earned||0; del+=o.delivered||0; }
  const rows=mine.map(y=>{ const o=ownedYard(y), Bb=ydBrand(y), tr=(typeof PTRUCK!=='undefined'?PTRUCK.list.filter(T=>T.home===y):[]);
    return `<div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05);margin-bottom:8px"><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;height:12px;border-radius:50%;background:${Bb.col};outline:2px solid ${Bb.acc}"></span><b>${esc(Bb.name)}</b>${OWN.home===y.id?' <span class="chip" style="background:#f5b82e;color:#000">HOME</span>':''}<span style="flex:1"></span><span>${o.delivered||0} deliveries \u2022 <b style="color:#7dff9a">${money(o.earned||0)}</b></span></div>
     ${tr.map((T,i)=>`<div class="row"><span>Truck ${i+1} ${T.box?'\u25A0 loaded':'\u25A1 empty'}</span><span>${esc(ownTruckStatus(T))}</span></div>`).join('')||'<div class="row"><span>Trucks starting\u2026</span></div>'}</div>`; }).join('');
  const b=openModal('owndash',`<div class="ydc"><div class="in" style="flex:1"><div class="hd"><canvas class="lg" width="84" height="84" style="width:56px;height:56px"></canvas><div><span class="chip" style="background:${B.col};color:${B.acc}">COMPANY DASHBOARD</span><h2>${esc(ownCompany())}</h2></div><div style="flex:1"></div><div style="text-align:right"><div class="inc">${money(tot)} earned</div><div style="font-size:13px;opacity:.75">${del} containers delivered</div></div></div>
   <div style="flex:1;overflow:auto;min-height:0">${rows}</div>
   <div class="bt"><button class="buy btn sel" id="ownUpg">UPGRADES</button><button class="buy btn" id="ownHome">${OWN.home===yd.id?'HOME YARD \u2713':'SET AS HOME'}</button><button class="cn btn" id="ownNo">CLOSE</button></div><div class="hint">Home yard: tap it on the map for fast travel \u2022 Esc / \u24b7 close</div></div></div>`,'ydm');
  ydLogo(b.querySelector('canvas.lg').getContext('2d'),42,42,38,B);
  b.querySelector('#ownHome').addEventListener('click',()=>{ OWN.home=yd.id; if(typeof saveGame==='function') saveGame(); closeUI(); toast(ydBrand(yd).name+' set as your home yard'); }); b.querySelector('#ownNo').addEventListener('click',closeUI); b.querySelector('#ownUpg').addEventListener('click',()=>{ closeUI(); ownUpCard(yd); });
  if(typeof padNav==='function') setTimeout(()=>padNav(null),40); }
// ---- upgrades card (office / dashboard). Tiers + prices live in OWN_TIERS.
function ownUpCard(yd){ ownCss(); const o=ownedYard(yd); if(!o) return; const cur=o.tier||1, nt=cur+1, N=OWN_TIERS[nt], B=ydBrand(yd), can=N&&truck.money>=N.price;
  const li=[1,2,3].map(k=>{ const T=OWN_TIERS[k]; return `<div class="row" style="${k===cur?'outline:2px solid #7dff9a;border-radius:8px;':''}"><span><b>T${k}</b> ${esc(T.label)}<br><small style="opacity:.75">${esc(T.adds)}</small></span><b>${k<=cur?'\u2713 OWNED':money(T.price)}</b></div>`; }).join('');
  const b=openModal('ownup',`<div class="ydc"><div class="pv"><canvas width="560" height="430"></canvas><div class="hint">${N?'After upgrade: '+esc(N.label):'Fully upgraded'}</div></div>
   <div class="in"><div class="hd"><div><span class="chip" style="background:${B.col};color:${B.acc}">YARD UPGRADES</span><h2>${esc(B.name)}</h2></div></div>
   <div>${li}</div><div class="inc">${money(500)} per container your trucks unload \u2022 ${OWN_TIERS[cur].trucks} trucks working</div>
   <div class="row"><span>Your money</span><b style="color:${!N||can?'#7dff9a':'#ff7b72'}">${money(truck.money)}</b></div>
   <div class="bt">${N?`<button class="buy btn sel" id="ownUp" ${can?'':'disabled'}>${can?'UPGRADE TO T'+nt+' \u2022 '+money(N.price):'NEED '+money(N.price-truck.money)}</button>`:''}<button class="cn btn${N?'':' sel'}" id="ownNo">BACK</button></div>
   <div class="hint">Enter / \u24b6 upgrade \u2022 Esc / \u24b7 back</div></div></div>`,'ydm');
  ydPreview(b.querySelector('.pv canvas'),yd,true,N?nt:cur);
  const u=b.querySelector('#ownUp'); if(u) u.addEventListener('click',()=>{ if(ownUpgrade(yd)){ closeUI(); ownUpCard(yd); } }); b.querySelector('#ownNo').addEventListener('click',()=>{ closeUI(); ownDash(yd); });
  if(typeof padNav==='function') setTimeout(()=>padNav(null),40); }
addEventListener('keydown',e=>{ const k=career.uiOpen; if(k!=='ownbuy'&&k!=='owndash'&&k!=='ownup') return; if(e.code==='Enter'||e.code==='NumpadEnter'){ const b=document.querySelector('.btn.sel')||document.getElementById(k==='ownbuy'?'ownBuy':k==='ownup'?'ownUp':'ownUpg'); if(b&&!b.disabled){ e.preventDefault(); e.stopPropagation(); b.click(); } } else if(e.code==='Escape'){ e.preventDefault(); closeUI(); } },true);
// ---- in-game yard art
function ydText(t,x,y,px,col,font){ ctx.font=(font||'900 ')+px+'px Arial Black,Arial'; ctx.fillStyle=col; ctx.fillText(t,x,y); }
function drawOwnDepots(vx0,vy0,vx1,vy1){ if(!world.forSale) return; const S=PPM, Tt=TILE, dark=typeof DN!=='undefined'?DN.dark:0;
  for(const yd of ownYards()){ const X0=yd.x0*Tt, Y0=yd.y0*Tt, W=yd.w*Tt, H=yd.h*Tt; if(X0>vx1+120||X0+W<vx0-120||Y0>vy1+120||Y0+H<vy0-120) continue; const own=ownedYard(yd), B=ydBrand(yd), X=t=>(yd.x0+t)*Tt, Y=t=>(yd.y0+t)*Tt;
    ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
    // tarmac with patching + kerb
    ctx.fillStyle='#8d9196'; ctx.fillRect(X0-4,Y0-4,W+8,H+8); ctx.fillStyle='#34383d'; ctx.fillRect(X0,Y0,W,H); ctx.fillStyle='#34383d'; ctx.fillRect(X(7),Y(-1.2),6*Tt,1.2*Tt+2);
    ctx.fillStyle='rgba(255,255,255,0.025)'; for(let k=0;k<9;k++) ctx.fillRect(X(((k*7.3)%17)+1),Y(((k*5.1)%12)+1),2.4*Tt,1.6*Tt);
    // painted bays + lane arrows
    ctx.strokeStyle=own?'rgba(255,255,255,0.92)':'rgba(255,255,255,0.45)'; ctx.lineWidth=3; const tr=ownT(yd)||1, act=yd.bays.filter(b=>tr>=(b.need||1)); for(const b of act){ ctx.beginPath(); ctx.moveTo(b.x0*S,b.y0*S); ctx.lineTo(b.x0*S,b.y1*S); ctx.moveTo(b.x1*S,b.y0*S); ctx.lineTo(b.x1*S,b.y1*S); ctx.stroke(); ydText(String(b.id),b.cx*S,b.y0*S-10,Math.round(0.42*Tt),ctx.strokeStyle); }
    ctx.fillStyle='#f1c40f'; ctx.fillRect(yd.bays[0].x0*S,yd.bays[0].y1*S-5,(act[act.length-1].x1-yd.bays[0].x0)*S,6);
    ownDrawBack(yd,X,Y,Tt,dark,own,B,tr);
    // service, office and garage pads
    const pad=(s,lbl,col)=>{ const sx=s.x*S, sy=s.y*S; ctx.strokeStyle=col; ctx.lineWidth=3; ctx.setLineDash([10,6]); ctx.strokeRect(sx-s.w/2*S,sy-s.L/2*S,s.w*S,s.L*S); ctx.setLineDash([]); ctx.save(); ctx.translate(sx,sy); ctx.rotate(-Math.PI/2); ydText(lbl,0,0,Math.round(0.36*Tt),col); ctx.restore(); };
    if(own){ pad(yd.sslot,'FUEL & REPAIR','#7dff9a'); pad(yd.oslot,'OFFICE','#8fc8ff'); pad(yd.gslot,'GARAGE','#ffd866'); }
    else { const s=yd.slot, here=ownIn(s); pad(s,'STOP TO BUY',here?'#2ecc71':'#ffd866');
      ctx.globalAlpha=0.5; ydText('FOR SALE',X0+W/2+1.5*Tt,Y0+H*0.6,Math.round(1.25*Tt),'#f39c12'); ctx.globalAlpha=1; }
    // office (solid): shadow, walls, livery band, windows (lit at night), roof logo
    const of=yd.office, ox=X(of.x0-yd.x0), oy=Y(of.y0-yd.y0), ow=of.w*Tt, oh=of.h*Tt;
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(ox+12,oy+12,ow,oh); ctx.fillStyle='#dfe4e9'; ctx.fillRect(ox,oy,ow,oh); ctx.fillStyle='#c9d0d7'; ctx.fillRect(ox+6,oy+6,ow-12,oh-12);
    ctx.fillStyle=own?B.col:'#7f8c8d'; ctx.fillRect(ox,oy+oh-0.55*Tt,ow,0.55*Tt); ctx.fillStyle=dark>0.05?'#ffd27a':'#88b7da'; for(let k=0;k<5;k++) ctx.fillRect(ox+0.35*Tt+k*0.95*Tt,oy+oh-0.42*Tt,0.6*Tt,0.28*Tt);
    if(own) ydLogo(ctx,ox+ow/2,oy+oh/2-0.25*Tt,0.95*Tt,B); else { ctx.fillStyle='#95a5a6'; ctx.beginPath(); ctx.arc(ox+ow/2,oy+oh/2-0.25*Tt,0.9*Tt,0,7); ctx.fill(); ydText('SALE',ox+ow/2,oy+oh/2-0.25*Tt,Math.round(0.42*Tt),'#fff'); }
    // garage (solid): roof ribs + roller door, open when it's yours
    const ga=yd.garage, gx=X(ga.x0-yd.x0), gy=Y(ga.y0-yd.y0), gw=ga.w*Tt, gh=ga.h*Tt;
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(gx+12,gy+12,gw,gh); ctx.fillStyle='#6f7882'; ctx.fillRect(gx,gy,gw,gh); ctx.fillStyle='rgba(255,255,255,0.08)'; for(let k=0;k<gw;k+=10) ctx.fillRect(gx+k,gy,4,gh);
    ctx.fillStyle=own?'#15181c':'#9aa1a8'; ctx.fillRect(gx+0.6*Tt,gy+gh-0.35*Tt,gw-1.2*Tt,0.35*Tt); if(own){ ctx.fillStyle=B.col; ctx.fillRect(gx,gy,gw,0.4*Tt); ydText('GARAGE',gx+gw/2,gy+gh/2,Math.round(0.45*Tt),'#fff'); if(dark>0.05) dnLight(gx+gw/2,gy+gh+0.4*Tt,90,'rgba(255,230,180,0.9)',0.7); }
    // fence (gate gap at the top middle) + posts
    ctx.strokeStyle='#2a2d31'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(X(7),Y0+2); ctx.lineTo(X0+2,Y0+2); ctx.lineTo(X0+2,Y0+H-2); ctx.lineTo(X0+W-2,Y0+H-2); ctx.lineTo(X0+W-2,Y0+2); ctx.lineTo(X(13),Y0+2); ctx.stroke();
    ctx.fillStyle='#1d1f22'; for(let t=0;t<=20;t+=2){ if(t>7&&t<13) continue; ctx.fillRect(X(t)-3,Y0-1,6,6); ctx.fillRect(X(t)-3,Y0+H-5,6,6); } for(let t=2;t<yd.h;t+=2){ ctx.fillRect(X0-1,Y(t)-3,6,6); ctx.fillRect(X0+W-5,Y(t)-3,6,6); }
    // entrance sign: livery board with logo + name
    { const sx=X(5.6), sy=Y(-0.9); ctx.fillStyle='#444'; ctx.fillRect(sx-0.1*Tt,sy,0.2*Tt,0.8*Tt); ctx.fillStyle=own||1?B.col:'#7f8c8d'; ctx.fillRect(sx-2.6*Tt,sy-0.55*Tt,4.6*Tt,1.1*Tt); ctx.strokeStyle=B.acc; ctx.lineWidth=2; ctx.strokeRect(sx-2.6*Tt,sy-0.55*Tt,4.6*Tt,1.1*Tt);
      ydLogo(ctx,sx-2*Tt,sy,0.45*Tt,B); ctx.textAlign='left'; ydText(B.name.toUpperCase(),sx-1.45*Tt,sy-0.08*Tt,Math.round(0.3*Tt),'#fff'); ydText(own?ownCompany().toUpperCase():'FOR SALE \u2022 '+money(OWN_TIERS[yd.tier||1].price),sx-1.45*Tt,sy+0.27*Tt,Math.round(0.2*Tt),B.acc,'bold '); ctx.textAlign='center';
      if(dark>0.05) dnLight(sx,sy,80,'rgba(255,255,255,0.9)',0.6); }
    // floodlight masts
    for(const [fx,fy] of [[0.4,0.4],[19.6,0.4],[0.4,23.6],[19.6,23.6],[6.5,9]].concat(tr>=3?[[0.4,8],[19.6,8],[0.4,14.6],[19.6,14.6],[10,19.1]]:[])){ ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(X(fx),Y(fy),5,0,7); ctx.fill(); ctx.fillStyle=dark>0.05?'#fff6d8':'#bbb'; ctx.fillRect(X(fx)-6,Y(fy)-2,12,4); if(dark>0.05) dnLight(X(fx),Y(fy),own?300:150,'rgba(255,240,205,0.95)',own?0.85:0.45); }
    if(dark>0.05){ dnLight(ox+ow/2,oy+oh+0.3*Tt,110,'rgba(255,214,140,0.9)',0.7); }
    ctx.restore(); } }
function ownMapLabels(BX,BY,z,IR){ if(!world.forSale||z<=1.2) return; for(const yd of ownYards()){ const own=ownedYard(yd); mapLabel(ydBrand(yd).name+(own?' (yours)':' \u2022 for sale'),BX(yd.entrance.x/M_T)+IR+4,BY(yd.entrance.y/M_T),own?'#9dffbf':'#ffd08a',true); } }
// ---- warehouses / HQ / rail siding + gantry + train (all in yard tile units)
const RAIL_Y=21.5, TR_STOP=1.2, FLAT0=4.9, FLAT_L=3.2;
function ownBld(R,yd,X,Y,Tt,dark,body,rib,label,col,doors){ const x=X(R.x0-yd.x0), y=Y(R.y0-yd.y0), w=R.w*Tt, h=R.h*Tt;
  ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+12,y+12,w,h); ctx.fillStyle=body; ctx.fillRect(x,y,w,h); ctx.fillStyle=rib; for(let k=8;k<w;k+=16) ctx.fillRect(x+k,y,5,h);
  ctx.fillStyle=col; ctx.fillRect(x,y,w,0.45*Tt); ydText(label,x+w/2,y+h*0.42,Math.round(0.42*Tt),'#fff');
  for(let k=0;k<doors;k++){ const dx=x+(k+0.5)*w/doors; ctx.fillStyle=dark>0.05?'#ffd27a':'#2a2e33'; ctx.fillRect(dx-0.45*Tt,y+0.45*Tt,0.9*Tt,0.25*Tt); ctx.fillRect(dx-0.45*Tt,y+h-0.25*Tt,0.9*Tt,0.25*Tt); if(dark>0.05){ dnLight(dx,y-0.2*Tt,70,'rgba(255,220,150,0.9)',0.6); dnLight(dx,y+h+0.3*Tt,70,'rgba(255,220,150,0.9)',0.6); } } }
function ownDrawBack(yd,X,Y,Tt,dark,own,B,tr){
  ownBld(yd.wh,yd,X,Y,Tt,dark,'#8796a5','#7a8896','WAREHOUSE',own?B.col:'#7f8c8d',3);
  const plot=R=>{ ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=2; ctx.setLineDash([8,6]); ctx.strokeRect(X(R.x0-yd.x0)+3,Y(R.y0-yd.y0)+3,R.w*Tt-6,R.h*Tt-6); ctx.setLineDash([]); if(own) ydText('UPGRADE PLOT',X(R.x0-yd.x0)+R.w*Tt/2,Y(R.y0-yd.y0)+R.h*Tt/2,Math.round(0.3*Tt),'rgba(255,255,255,0.4)'); };
  if(tr>=2&&own) ownBld(yd.wh2,yd,X,Y,Tt,dark,'#8a9a7a','#7d8c6e','MAINTENANCE & STORE',B.col,3); else plot(yd.wh2);
  if(tr>=3&&own){ ownBld(yd.hq,yd,X,Y,Tt,dark,'#e6e9ee','#d5dae0','DISTRIBUTION HQ',B.col,2); ydLogo(ctx,X(3.5),Y(18.15),0.45*Tt,B); } else plot(yd.hq);
  // rail siding: ballast, sleepers, rails, buffer stop, tunnel portal on the east fence
  const ry=Y(RAIL_Y); ctx.fillStyle='#6d5a48'; ctx.fillRect(X(0),ry-0.75*Tt,20*Tt,1.5*Tt); ctx.fillStyle='#4a3a2c'; for(let t=0.2;t<20;t+=0.5) ctx.fillRect(X(t),ry-0.6*Tt,0.18*Tt,1.2*Tt);
  ctx.fillStyle='#c4cad0'; ctx.fillRect(X(0),ry-0.42*Tt,20*Tt,4); ctx.fillRect(X(0),ry+0.42*Tt-4,20*Tt,4);
  ctx.fillStyle='#c0392b'; ctx.fillRect(X(0.3),ry-0.6*Tt,0.4*Tt,1.2*Tt);
  ctx.fillStyle='#4b4f55'; ctx.fillRect(X(19.2),ry-1.4*Tt,1.6*Tt,2.8*Tt); ctx.fillStyle='#0b0c0e'; ctx.fillRect(X(19.5),ry-0.9*Tt,1.3*Tt,1.8*Tt);
  // crane rails
  ctx.fillStyle='#9aa1a8'; ctx.fillRect(X(0),Y(19.4)-2,20*Tt,4); ctx.fillRect(X(0),Y(23.6)-2,20*Tt,4);
  const R=yd.rt||{}; // train
  if(R.x!=null){ ctx.save(); ctx.beginPath(); ctx.rect(X(0),ry-2*Tt,19.5*Tt,4*Tt); ctx.clip(); const tx=t=>X(R.x+t);
    ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(tx(0)+8,ry-0.55*Tt+8,3.4*Tt,1.1*Tt); ctx.fillStyle='#d35400'; ctx.fillRect(tx(0),ry-0.55*Tt,3.4*Tt,1.1*Tt); ctx.fillStyle='#2c3e50'; ctx.fillRect(tx(0.3),ry-0.4*Tt,0.8*Tt,0.8*Tt); ctx.fillStyle='#f1c40f'; ctx.fillRect(tx(0),ry-0.55*Tt,0.15*Tt,1.1*Tt);
    if(dark>0.05){ dnLight(tx(-0.3),ry,120,'rgba(255,250,220,0.95)',0.8); }
    for(let k=0;k<4;k++){ const fx=FLAT0+k*FLAT_L; ctx.fillStyle='#3d4249'; ctx.fillRect(tx(fx-1.2),ry-0.4*Tt,(FLAT_L-0.2)*Tt,0.8*Tt); ctx.fillStyle='#22262b'; ctx.fillRect(tx(fx-1.2),ry-0.4*Tt,(FLAT_L-0.2)*Tt,3); ctx.fillRect(tx(fx-1.2),ry+0.4*Tt-3,(FLAT_L-0.2)*Tt,3);
      if(R.box&&R.box[k]){ ctx.fillStyle=R.box[k]; ctx.fillRect(tx(fx-1.1),ry-0.48*Tt,(FLAT_L-0.4)*Tt,0.96*Tt); ctx.fillStyle='rgba(0,0,0,.18)'; for(let q=0.3;q<FLAT_L-0.5;q+=0.3) ctx.fillRect(tx(fx-1.1+q),ry-0.48*Tt,2,0.96*Tt); } }
    ctx.restore(); }
  // staged box at the warehouse door
  if(own&&(ownedYard(yd).stock||0)>0&&!(R.cb&&R.ph==='up')){ ctx.fillStyle='#b9770e'; ctx.fillRect(X(8.6),Y(19.55),2.8*Tt,0.9*Tt); }
  // rail-mounted gantry
  const gx=X(R.gx!=null?R.gx:10), ty=Y(R.gy!=null?R.gy:RAIL_Y);
  ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fillRect(gx-1.3*Tt+14,Y(19.2)+14,2.6*Tt,4.6*Tt);
  ctx.fillStyle='#e1b12c'; ctx.fillRect(gx-1.4*Tt,Y(19.1),0.45*Tt,4.8*Tt); ctx.fillRect(gx+0.95*Tt,Y(19.1),0.45*Tt,4.8*Tt); ctx.fillRect(gx-1.4*Tt,Y(19.1),2.8*Tt,0.4*Tt); ctx.fillRect(gx-1.4*Tt,Y(23.5),2.8*Tt,0.4*Tt);
  if(R.cb){ ctx.fillStyle=R.cb; ctx.fillRect(gx-1.35*Tt+3,ty-0.45*Tt,2.7*Tt-6,0.9*Tt); }
  ctx.fillStyle='#2d3436'; ctx.fillRect(gx-0.95*Tt,ty-0.3*Tt,1.9*Tt,0.6*Tt); ctx.fillStyle='#e1b12c'; ctx.fillRect(gx-0.5*Tt,ty-0.2*Tt,1*Tt,0.4*Tt);
  if(dark>0.05){ dnLight(gx,Y(21.5),180,'rgba(255,240,205,0.95)',own?0.8:0.4); }
}
function ownTrain(yd,dt){ const o=ownedYard(yd); let R=yd.rt; if(!R) R=yd.rt={st:'away',t:8+Math.random()*10,x:null,gx:10,gy:RAIL_Y,box:[0,0,0,0]};
  if(!o){ return; }
  const near=(a,b,v)=>{ const d=b-a; return Math.abs(d)<=v*dt?b:a+Math.sign(d)*v*dt; };
  if(R.st==='away'){ R.x=null; R.t-=dt; if(R.t<=0){ R.st='in'; R.x=21; R.box=[0,0,0,0]; } }
  else if(R.st==='in'){ R.x=near(R.x,TR_STOP,Math.max(0.6,Math.min(4,(R.x-TR_STOP)*0.6))); if(R.x===TR_STOP){ R.st='load'; R.k=0; R.ph='go'; R.t=6; } }
  else if(R.st==='load'){ const fx=TR_STOP+FLAT0+R.k*FLAT_L+0.2;
    if(R.ph==='go'){ R.gy=near(R.gy,19.9,1.5); R.gx=near(R.gx,10,2.5); if(R.gx===10&&R.gy===19.9){ if((o.stock||0)>0){ o.stock--; R.cb=YARD_COLS[(Math.random()*8)|0]; R.ph='up'; } else { R.t-=dt; if(R.t<=0||R.k>0&&R.t<=3) { R.st='out'; } } } }
    else if(R.ph==='up'){ R.gx=near(R.gx,fx,2.2); R.gy=near(R.gy,RAIL_Y,1.2); if(R.gx===fx&&R.gy===RAIL_Y){ R.box[R.k]=R.cb; R.cb=null; R.k++; R.t=6; R.ph=R.k>=4?'done':'go'; if(R.k>=4) R.st='out'; } } }
  else if(R.st==='out'){ R.gy=near(R.gy,RAIL_Y,1.2); R.x+=Math.min(5,0.5+(R.x-TR_STOP)*0.4)*dt; if(R.x>21){ R.st='away'; R.x=null; R.t=70+Math.random()*40; if(R.k) toast(ydBrand(yd).name+': freight train left with '+R.k+' container'+(R.k>1?'s':'')); } } }
function ownMap(BX,BY,z){ if(!world.forSale) return; ctx.save(); for(const yd of ownYards()){ const y=BY(yd.y0+RAIL_Y), x0=BX(yd.x0), x1=BX(yd.x0+20);
  ctx.strokeStyle='#5d4c3c'; ctx.lineWidth=Math.max(2,0.9*z); ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); ctx.strokeStyle='#d0d4d8'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); ctx.setLineDash([]);
  const R=yd.rt; if(R&&R.x!=null&&R.x<19.5){ ctx.fillStyle='#d35400'; ctx.fillRect(BX(yd.x0+R.x),y-Math.max(2,0.6*z),Math.max(4,(Math.min(19.5,R.x+17)-R.x)*z),Math.max(4,1.2*z)); } }
  ctx.restore(); }
