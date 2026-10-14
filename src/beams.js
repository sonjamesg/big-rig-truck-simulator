// ===================== HEADLIGHTS: dipped (default, UK left-biased) / full beam toggle. L key, pad D-pad down, touch BEAM; saved; MP flag bit 64 =====================
const HB={on:false,k:0,t:0};
function hbToggle(){ HB.on=!HB.on; if(typeof flash==='function') flash(HB.on?'Full beam on':'Dipped beam'); if(typeof BigRig!=='undefined'&&BigRig.emit) BigRig.emit('beam',{on:HB.on}); }
// smooth 0..1 blend (≈0.35 s)
function hbStep(){ const n=performance.now(), dt=Math.min(0.1,(n-(HB.t||n))/1000); HB.t=n; const g=HB.on?1:0; HB.k+=(g-HB.k)*Math.min(1,dt*9); if(Math.abs(g-HB.k)<0.002) HB.k=g; return HB.k; }
// blue full-beam tell-tale (headlamp with horizontal rays), next to the indicator arrows
function drawBeamHUD(){ const k=HB.k; if(k<0.02&&!HB.on) return; const cx=VW-126-30, y=62+15; ctx.save(); ctx.globalAlpha=Math.max(0.15,k);
  ctx.fillStyle='rgba(13,15,20,0.72)'; ctx.beginPath(); ctx.roundRect?ctx.roundRect(cx-22,y-15,44,30,7):ctx.rect(cx-22,y-15,44,30); ctx.fill();
  ctx.fillStyle='#2f7bff'; ctx.strokeStyle='#2f7bff'; ctx.lineWidth=2.6; ctx.lineCap='round'; ctx.shadowColor='#3d8bff'; ctx.shadowBlur=10*k;
  ctx.beginPath(); ctx.moveTo(cx-4,y-10); ctx.bezierCurveTo(cx-17,y-10,cx-17,y+10,cx-4,y+10); ctx.closePath(); ctx.fill();
  for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(cx+1,y+i*4.5); ctx.lineTo(cx+15,y+i*4.5); ctx.stroke(); }
  ctx.restore(); }
addEventListener('keydown',e=>{ if(e.code!=='KeyL'||e.repeat||!started||career.uiOpen||bigmap.open) return; const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return; hbToggle(); e.preventDefault(); });
