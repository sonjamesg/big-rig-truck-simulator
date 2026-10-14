// ===================== v31 player-owned depots (tier 1). Per player: ownership lives in this client's save only, so in
// multiplayer other players keep seeing an empty FOR SALE yard and never get the owner's trucks (traffic is local per client).
const OWN_TIERS={1:{price:2000,trucks:2,pay:350,label:'Tier 1 yard'},2:{price:6000,trucks:4,pay:420,label:'Tier 2 depot',soon:true},3:{price:15000,trucks:6,pay:500,label:'Tier 3 hub',soon:true}};
const OWN={yards:{},armed:true,inc:0};   // yards: id -> {tier,bought,delivered,earned}
function ownCompany(){ const n=(localStorage.getItem('bigrig.name')||'').trim(); return (n?n:'Your')+' Haulage'; }
function ownSave(){ return {yards:OWN.yards}; }
function ownLoad(o){ OWN.yards=(o&&o.yards)||{}; }
function ownYards(){ return (world.forSale||[]); }
function ownedYard(yd){ return OWN.yards[yd.id]||null; }
function ownTier(yd){ return OWN_TIERS[(ownedYard(yd)||{}).tier||1]; }
function ownInSlot(yd){ const s=yd.slot, f=fwd(truck.h), cx=truck.x+f[0]*1.9, cy=truck.y+f[1]*1.9; return Math.abs(cx-s.x)<s.w/2&&Math.abs(cy-s.y)<s.L/2; }
function updateOwnDepots(dt){ if(!world.ready||!world.forSale) return;
  let inAny=null; for(const yd of ownYards()) if(!ownedYard(yd)&&ownInSlot(yd)) inAny=yd;
  if(!inAny) OWN.armed=true; else if(OWN.armed&&Math.abs(truck.v)<0.6&&!career.uiOpen&&!(typeof bigmap!=='undefined'&&bigmap.open)){ OWN.armed=false; ownPrompt(inAny); }
  // keep each owned yard's AI fleet alive (count from its tier: structure for 4+ trucks later)
  if(typeof PTRUCK==='undefined') return;
  for(const yd of ownYards()){ const o=ownedYard(yd); if(!o) continue; const need=ownTier(yd).trucks, have=PTRUCK.list.filter(T=>T.home===yd).length;
    if(have<need&&PTRUCK.t>(yd.spawnT||0)){ yd.spawnT=PTRUCK.t+6; const g=ptDepotGeo(yd); if(!g) continue; const P=portList().filter(P=>P.ready&&P.lpath).sort((a,b)=>Math.hypot(a.O[0]*M_T-yd.x,a.O[1]*M_T-yd.y)-Math.hypot(b.O[0]*M_T-yd.x,b.O[1]*M_T-yd.y))[0]; if(!P) continue;
      const T={P,st:'new',box:null,t:0,id:'own'+yd.id+have,home:yd}; for(const dir of [1,-1]) if(ptToRoad(T,g.sg,dir,g.along+dir*7,ptGateGoal(P))){ T.tgt='port'; PTRUCK.list.push(T); break; } } } }
function ownDelivered(T){ const yd=T.home, o=ownedYard(yd); if(!o) return; const pay=ownTier(yd).pay; truck.money+=pay; o.delivered=(o.delivered||0)+1; o.earned=(o.earned||0)+pay; OWN.inc+=pay;
  toast('+'+money(pay)+' \u2022 '+ownCompany()+' truck delivered a container to '+yd.name); if(typeof saveGame==='function') saveGame(); }
function ownBuy(yd){ const t=OWN_TIERS[yd.tier||1]; if(ownedYard(yd)) return false; if(truck.money<t.price){ toast('Not enough money: '+money(t.price)+' needed'); return false; }
  truck.money-=t.price; OWN.yards[yd.id]={tier:yd.tier||1,bought:Date.now(),delivered:0,earned:0}; toast(yd.name+' is now '+ownCompany()+'. '+t.trucks+' trucks start work at the docks.'); if(typeof saveGame==='function') saveGame(); return true; }
function ownPrompt(yd){ uiInit(); const t=OWN_TIERS[yd.tier||1]; const old=uiRoot.querySelector('.mback,.celebrate'); if(old) old.remove(); career.uiOpen='buy';
  const d=document.createElement('div'); d.className='mback'; d.innerHTML=`<div class="modal" style="max-width:420px"><h2>FOR SALE: ${esc(yd.name)}</h2><p style="margin:8px 0">${esc(t.label)} \u2022 ${t.trucks} AI trucks haul dock containers here and earn you ${money(t.pay)} per delivery.</p><p style="margin:8px 0;font-size:22px;font-weight:900;color:#ffd866">${money(t.price)}</p><p style="opacity:.7;font-size:12px">You have ${money(truck.money)}. Enter / (A) buy \u2022 Esc / (B) not now</p><div style="display:flex;gap:10px;justify-content:center;margin-top:10px"><button class="btn" id="ownBuy" style="min-width:140px;min-height:52px">BUY ${money(t.price)}</button><button class="btn" id="ownNo" style="min-width:120px;min-height:52px;background:#444">NOT NOW</button></div></div>`;
  uiRoot.appendChild(d); requestAnimationFrame(()=>d.classList.add('on'));
  d.querySelector('#ownBuy').addEventListener('click',()=>{ closeUI(); ownBuy(yd); }); d.querySelector('#ownNo').addEventListener('click',closeUI);
  if(typeof padNav==='function') setTimeout(()=>padNav(null),30); }
addEventListener('keydown',e=>{ if(career.uiOpen!=='buy') return; if(e.code==='Enter'||e.code==='NumpadEnter'){ const b=document.getElementById('ownBuy'); if(b){ e.preventDefault(); e.stopPropagation(); b.click(); } } else if(e.code==='Escape'){ closeUI(); } },true);
// ---- in-game drawing
function drawOwnDepots(vx0,vy0,vx1,vy1){ if(!world.forSale) return; const S=PPM;
  for(const yd of ownYards()){ const X0=yd.x0*TILE, Y0=yd.y0*TILE, W=yd.w*TILE, H=yd.h*TILE; if(X0>vx1+50||X0+W<vx0-50||Y0>vy1+50||Y0+H<vy0-50) continue; const own=ownedYard(yd);
    ctx.save(); ctx.strokeStyle=own?'#2ecc71':'#f39c12'; ctx.lineWidth=4; ctx.setLineDash(own?[]:[14,10]); ctx.strokeRect(X0+3,Y0+3,W-6,H-6); ctx.setLineDash([]);
    if(own){ // office + workshop, company sign, numbered reverse bays
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(X0+1.2*TILE+10,Y0+1.2*TILE+10,5*TILE,3.4*TILE); ctx.fillStyle='#34495e'; ctx.fillRect(X0+1.2*TILE,Y0+1.2*TILE,5*TILE,3.4*TILE); ctx.fillStyle='#2ecc71'; ctx.fillRect(X0+1.2*TILE,Y0+1.2*TILE,5*TILE,0.5*TILE);
      ctx.fillStyle='#fff'; ctx.font='900 '+(0.55*TILE)+'px Arial Black,Arial'; ctx.textAlign='center'; ctx.fillText(ownCompany().toUpperCase(),X0+3.7*TILE,Y0+3.2*TILE);
      ctx.font='900 '+(0.9*TILE)+'px Arial Black,Arial'; ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fillText(ownCompany().toUpperCase(),X0+W/2+2*TILE,Y0+5.6*TILE); ctx.font='bold '+(0.42*TILE)+'px system-ui'; ctx.fillText(yd.name.toUpperCase()+' \u2022 '+((own.delivered||0))+' DELIVERIES \u2022 '+money(own.earned||0),X0+W/2+2*TILE,Y0+6.4*TILE);
      ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=3; for(const b of yd.bays){ ctx.beginPath(); ctx.moveTo(b.x0*S,b.y0*S); ctx.lineTo(b.x0*S,b.y1*S); ctx.moveTo(b.x1*S,b.y0*S); ctx.lineTo(b.x1*S,b.y1*S); ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='bold '+(0.5*TILE)+'px system-ui'; ctx.fillText(String(b.id),b.cx*S,b.y0*S-6); }
      ctx.fillStyle='#f1c40f'; ctx.fillRect(yd.bays[0].x0*S,yd.bays[0].y1*S-4,(yd.bays[3].x1-yd.bays[0].x0)*S,6); }
    else { // empty yard: FOR SALE board + painted purchase slot
      ctx.fillStyle='rgba(243,156,18,0.9)'; ctx.font='900 '+(1.6*TILE)+'px Arial Black,Arial'; ctx.textAlign='center'; ctx.globalAlpha=0.55; ctx.fillText('FOR SALE',X0+W/2,Y0+H*0.66); ctx.globalAlpha=1;
      ctx.font='bold '+(0.6*TILE)+'px system-ui'; ctx.fillStyle='#fff'; ctx.fillText(yd.name.toUpperCase()+' \u2022 '+money(OWN_TIERS[yd.tier||1].price),X0+W/2,Y0+H*0.66+0.9*TILE);
      ctx.fillStyle='#f39c12'; ctx.fillRect(X0+1.5*TILE,Y0+1.4*TILE,3.2*TILE,1.6*TILE); ctx.fillStyle='#fff'; ctx.font='900 '+(0.5*TILE)+'px Arial Black,Arial'; ctx.fillText('FOR SALE',X0+3.1*TILE,Y0+2.15*TILE); ctx.font='bold '+(0.32*TILE)+'px system-ui'; ctx.fillText('TIER 1 YARD',X0+3.1*TILE,Y0+2.7*TILE);
      ctx.fillStyle='#555'; ctx.fillRect(X0+2.2*TILE,Y0+3*TILE,6,0.8*TILE); ctx.fillRect(X0+4*TILE-6,Y0+3*TILE,6,0.8*TILE);
      const s=yd.slot, sx=s.x*S, sy=s.y*S, here=ownInSlot(yd); ctx.strokeStyle=here?'#2ecc71':'#ffd866'; ctx.lineWidth=4; ctx.setLineDash([10,6]); ctx.strokeRect(sx-s.w/2*S,sy-s.L/2*S,s.w*S,s.L*S); ctx.setLineDash([]);
      ctx.fillStyle=here?'#2ecc71':'#ffd866'; ctx.font='900 '+(0.42*TILE)+'px Arial Black,Arial'; ctx.fillText('STOP HERE TO BUY',sx,sy+s.L/2*S+0.5*TILE); }
    ctx.restore(); } }
function ownMap(BX,BY,z){ if(!world.forSale) return; ctx.save(); ctx.textAlign='center';
  for(const yd of ownYards()){ const own=ownedYard(yd), x=BX(yd.x/M_T), y=BY(yd.y/M_T), r=Math.max(6,1.5*z); ctx.fillStyle=own?'#2ecc71':'#f39c12'; ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.beginPath(); ctx.rect(x-r,y-r,2*r,2*r); ctx.fill(); ctx.stroke();
    const t=own?ownCompany():'FOR SALE '+money(OWN_TIERS[yd.tier||1].price); ctx.font='bold 12px system-ui'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.strokeText(t,x,y-r-5); ctx.fillStyle=own?'#9dffbf':'#ffd08a'; ctx.fillText(t,x,y-r-5); }
  ctx.restore(); }
