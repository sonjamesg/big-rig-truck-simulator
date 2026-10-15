'use strict';
// ===================== v29 REPAIR BAYS: a drive-in REPAIR box beside the TUNE SHOP box at every truck repair garage =====================
function rpBays(){ if(RP.bays) return RP.bays; const out=[]; for(const g of world.garages||[]){ const b=g.bay; if(!b) continue; out.push({g,name:g.name,x:b.x-16,y:b.y+1.5,w:4.6,L:12}); } return RP.bays=out; }
const RP={bays:null,here:null};
function rpHere(){ if(!world.ready||!started) return null; const s=truck, f=fwd(s.h), cx=s.x+f[0]*2.2, cy=s.y+f[1]*2.2; for(const b of rpBays()) if(Math.abs(cx-b.x)<b.w*0.9&&Math.abs(cy-b.y)<b.L/2) return b; return null; }
function rpCost(b){ const d=(truck.damage||0)+((truck.trl&&truck.trl.damage)||0)*0.5; return Math.ceil(d*(b.g.ratePerPct||45)); }
function rpDo(){ const b=RP.here; if(!b) return; const c=rpCost(b); if(c<=0){ toast('\u2714 No damage to repair'); return; } if(truck.money<c){ toast('Repair costs '+money(c)+' \u2014 not enough money'); return; }
  truck.money-=c; truck.damage=0; if(truck.trl) truck.trl.damage=0; toast('\u{1F527} Repaired at '+b.name+' \u2014 '+money(c)); if(typeof saveGame==='function') saveGame(); }
function rpTick(){ const ok=started&&!(typeof bigmap!=='undefined'&&bigmap.open)&&!career.uiOpen&&Math.abs(truck.v)<0.4; RP.here=ok?rpHere():null; let el=document.getElementById('rpGo');
  if(RP.here&&!el){ el=document.createElement('button'); el.id='rpGo'; el.addEventListener('click',e=>{ e.stopPropagation(); rpDo(); }); (document.getElementById('frame')||document.body).appendChild(el);
    const st=document.createElement('style'); st.textContent='#rpGo{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);z-index:30;padding:14px 22px;min-height:56px;border-radius:16px;border:0;font:900 18px system-ui;color:#fff;background:linear-gradient(180deg,#3ddc84,#1e9e57);box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer}#rpGo small{display:block;font-size:10px;opacity:.8}'; document.head.appendChild(st); }
  if(el){ if(!RP.here) el.remove(); else { const c=rpCost(RP.here); el.innerHTML=(c>0?'\u{1F527} REPAIR '+money(c):'\u2714 NO DAMAGE')+' <small>Enter / \u24b6</small>'; } } }
addEventListener('keydown',e=>{ if(career.uiOpen||!(e.code==='Enter'||e.code==='NumpadEnter')) return; if(document.getElementById('rpGo')){ e.preventDefault(); e.stopImmediatePropagation(); rpDo(); } },true);
function rpDraw(vx0,vy0,vx1,vy1){ if(!world.ready) return; const S=PPM, dark=typeof DN!=='undefined'?DN.dark:0;
  for(const b of rpBays()){ const x=b.x*S, y=b.y*S, w=b.w*S, L=b.L*S; if(x<vx0-200||x>vx1+200||y<vy0-200||y>vy1+200) continue; const here=RP.here===b, col=here?'#2ecc71':'#3ddc84';
    ctx.save(); ctx.fillStyle='rgba(61,220,132,0.12)'; ctx.fillRect(x-w/2,y-L/2,w,L); ctx.strokeStyle=col; ctx.lineWidth=3; ctx.setLineDash([10,6]); ctx.strokeRect(x-w/2,y-L/2,w,L); ctx.setLineDash([]);
    for(let k=0;k<6;k++){ ctx.fillStyle=k%2?'#111':col; ctx.fillRect(x-w/2+k*w/6,y+L/2-0.5*S,w/6,0.5*S); }
    ctx.translate(x,y); ctx.rotate(-Math.PI/2); ctx.font='900 '+Math.round(1.3*S)+'px Arial Black,Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=col; ctx.fillText('REPAIR',0,0); ctx.restore();
    if(dark>0.05&&typeof dnLight==='function') dnLight(x,y,110,'rgba(170,255,200,0.9)',0.6); } }
// audit: every garage must have a repair box and a tune box on drivable concrete (no building under either)
function rpAudit(){ const out=[]; const tb=typeof czBays==='function'?czBays().filter(b=>!b.yd):[]; for(const g of world.garages||[]){ const r=rpBays().find(b=>b.g===g), t=tb.find(b=>b.name===g.name&&Math.hypot(b.x-g.bay.x+23.5,b.y-g.bay.y-1.5)<1);
    const clear=b=>{ if(!b) return false; for(let y=b.y-b.L/2+0.5;y<b.y+b.L/2;y+=2) for(let x=b.x-b.w/2+0.5;x<b.x+b.w/2;x+=2){ const t=get(Math.floor(x/M_T),Math.floor(y/M_T)); if(t===T.BLDG||t===T.WATER) return false; } return true; };
    out.push({name:g.name,repair:!!r&&clear(r),tune:!!t&&clear(t)}); } return out; }
// night: garages + shops/malls get forecourt floodlights, lit frontage and sign glow (called from dnBuild)
function siteLights(add){ for(const g of world.garages||[]){ const X=g.x*PPM, Y=g.y*PPM; add(X-120,Y-90,150,'fl'); add(X+120,Y-90,150,'fl'); add(X,Y-150,140,'fl'); add(X,Y+60,170,'sh'); }
  for(const o of world.objects) if(o.kind==='mall'){ add(o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)*0.55,'b',{o,win:[],shop:true,neon:o.col||'rgba(255,215,90,0.9)',aw:'rgba(255,215,90,0.9)'}); add(o.x+o.w/2,o.y+o.h+18,Math.min(200,o.w*0.7+40),'sh'); }
  for(const m of world.malls||[]){ const x0=m.tx*TILE, y0=m.ty*TILE, w=m.w*TILE, h=m.h*TILE; for(let y=y0+60;y<y0+h;y+=170) for(let x=x0+60;x<x0+w;x+=170) add(x,y,150,'fl'); add(m.entrance.x*PPM,m.entrance.y*PPM,140,'fl'); } }
setTimeout(()=>{ const ub=updateBreakdown; updateBreakdown=function(dt){ ub.apply(this,arguments); try{ rpTick(); }catch(e){} };
  const dl=drawPortTrucksLow; drawPortTrucksLow=function(a,b,c,d){ dl.apply(this,arguments); try{ rpDraw(a,b,c,d); }catch(e){} };
  if(typeof BigRig!=='undefined') BigRig.repairAudit=rpAudit; },0);
