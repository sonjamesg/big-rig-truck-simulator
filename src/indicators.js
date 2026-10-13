'use strict';
// ===================== PLAYER INDICATORS (UK): Q/E, pad D-pad L/R, LB+RB or Z hazards, touch; self-cancelling; lamps, HUD, tick-tock, MP =====================
const IND={side:0,haz:false,t0:0,h0:0,x0:0,y0:0,ph:0,lastBlink:false};
function indToggle(side){ if(IND.side===side){ IND.side=0; } else { IND.side=side; IND.t0=timeS; IND.h0=truck.h; IND.x0=truck.x; IND.y0=truck.y; IND.ph=0; } BigRig.emit('indicator',{side:IND.side,haz:IND.haz}); }
function hazToggle(){ IND.haz=!IND.haz; BigRig.emit('indicator',{side:IND.side,haz:IND.haz}); }
function indOn(){ return IND.side||(IND.haz?3:0); }
function indBlink(){ return (timeS*1.5)%1<0.5; }
function updateIndicators(dt){ const s=truck; if(!IND.side) { indTick(); return; } const sg=IND.side===1?-1:1, st=s.steer*sg;
  // self-cancel: steer into the turn / lane, then steering returns past the threshold after a real heading change or lateral move
  const f0=fwd(IND.h0), r0=rgt(IND.h0), lat=Math.abs((s.x-IND.x0)*r0[0]+(s.y-IND.y0)*r0[1]), dh=Math.abs(wrapA(s.h-IND.h0));
  if(IND.ph===0&&st>0.06&&Math.abs(s.v)>1) IND.ph=1;
  if(IND.ph===1&&st<0.02&&(dh>0.6||(lat>2.6&&dh<0.35))){ IND.side=0; IND.ph=0; BigRig.emit('indicator',{side:0,haz:IND.haz,auto:true}); }
  indTick(); }
function indTick(){ const on=indOn(), b=on&&indBlink(); if(on&&b!==IND.lastBlink){ const ctx=audio.ctx; if(ctx&&audio.master){ const t=ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain(); o.type='square'; o.frequency.value=b?2100:1500; g.gain.setValueAtTime(0.035,t); g.gain.exponentialRampToValueAtTime(0.0005,t+0.025); o.connect(g); g.connect(audio.master); o.start(t); o.stop(t+0.03); } } IND.lastBlink=b; }
function indLampsAt(x,y,h,trl,kx,ky,th,side,haz){ if(!(side||haz)||!indBlink()) return; const f=fwd(h), r=rgt(h); const sides=haz?[-1,1]:[side===1?-1:1]; ctx.fillStyle='rgba(255,170,20,0.95)';
  const dot=(px,py,rad)=>{ ctx.beginPath(); ctx.arc(px*PPM,py*PPM,rad,0,7); ctx.fill(); ctx.fillStyle='rgba(255,180,40,0.25)'; ctx.beginPath(); ctx.arc(px*PPM,py*PPM,rad*2.6,0,7); ctx.fill(); ctx.fillStyle='rgba(255,170,20,0.95)'; };
  for(const sd of sides){ dot(x+f[0]*4.9+r[0]*sd*1.2,y+f[1]*4.9+r[1]*sd*1.2,3); if(trl){ const ft=fwd(th), rt=rgt(th); dot(kx-ft[0]*12.35+rt[0]*sd*1.22,ky-ft[1]*12.35+rt[1]*sd*1.22,3); } else dot(x-f[0]*1.1+r[0]*sd*1.15,y-f[1]*1.1+r[1]*sd*1.15,2.6); } }
function drawIndHUD(){ const on=indOn(); const cx=VW/2, y=VH-34, b=indBlink(); ctx.save();
  for(const sd of [-1,1]){ const lit=on&&b&&(IND.haz||(IND.side===1&&sd<0)||(IND.side===2&&sd>0)); ctx.fillStyle=lit?'#3dff6a':'rgba(255,255,255,0.12)'; ctx.beginPath(); const x=cx+sd*120; ctx.moveTo(x+sd*14,y); ctx.lineTo(x-sd*2,y-11); ctx.lineTo(x-sd*2,y-4); ctx.lineTo(x-sd*14,y-4); ctx.lineTo(x-sd*14,y+4); ctx.lineTo(x-sd*2,y+4); ctx.lineTo(x-sd*2,y+11); ctx.closePath(); ctx.fill(); }
  if(IND.haz){ ctx.strokeStyle=b?'#ff4d3d':'rgba(255,255,255,0.15)'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(cx,y-10); ctx.lineTo(cx+10,y+8); ctx.lineTo(cx-10,y+8); ctx.closePath(); ctx.stroke(); }
  ctx.restore(); }
addEventListener('keydown',e=>{ if(!started||e.repeat||career.uiOpen||bigmap.open) return; const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')) return;
  if(e.code==='KeyQ'){ indToggle(1); e.preventDefault(); } else if(e.code==='KeyE'){ indToggle(2); e.preventDefault(); } else if(e.code==='KeyZ'){ hazToggle(); e.preventDefault(); } });
// ---- AI courtesy: yield to the player's signalled lane change / merge; don't undertake or overtake into that lane
function indYield(v,v0,acc){ const s=truck; if(!IND.side||IND.haz&&!IND.side) return acc; const sd=IND.side===1?-1:1, f=fwd(s.h), r=rgt(s.h);
  if(Math.cos(v.h-s.h)<0.85||Math.abs(s.v)<2) return acc; const dx=v.x-s.x, dy=v.y-s.y, lon=dx*f[0]+dy*f[1], lat=(dx*r[0]+dy*r[1])*sd;
  const rearLon=-(s.trl?12.4:1.4), vFront=lon+v.L/2, vRear=lon-v.L/2;
  if(lon<-(45+3*v.v)||vRear>4.5) return acc;                       // too far behind, or already far enough ahead: carry on
  if(timeS-IND.t0<(v.react||(v.react=0.4+v.r()*0.6))) return acc;  // brief human hesitation
  const inTarget=lat>1.9&&lat<6.2, sameLane=Math.abs(lat)<1.6;
  if(inTarget){ const gap=(rearLon-7)-vFront;                     // open at least rig length + margin ahead of me
    const a=idmAcc(v,Math.min(v0,Math.max(0,s.v)),Math.max(0.1,gap),Math.max(0,s.v)*0.95);
    if(vFront<rearLon&&a<-4.5) return acc;                          // too close to stop safely: continue, the gap opens behind it
    v.yieldT=timeS; return Math.min(acc,Math.max(a,-3.2)); }        // ease off, never stop dead
  if(sameLane&&lon<0&&v.sig===sd){ const gap=rearLon-vFront; v.yieldT=timeS; return Math.min(acc,idmAcc(v,v0,Math.max(0.1,gap),Math.max(0,s.v))); } // no undertaking/overtaking into my target lane
  return acc; }
