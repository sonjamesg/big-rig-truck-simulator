// Haptics: phone vibration on touch controls. Feature-detected, touch-only, toggle in SETTINGS.vib (saved with game).
const HAP={touch:0,last:0,dmg:null,dmgT:0};
if(SETTINGS.vib===undefined) SETTINGS.vib=true;
addEventListener('pointerdown',e=>{ if(e.pointerType==='touch'){ HAP.touch=1; HAP.last=performance.now(); } else if(e.pointerType==='mouse') HAP.touch=0; },true);
addEventListener('keydown',()=>{ HAP.touch=0; },true);
function haptic(p){ try{ if(!HAP.touch||SETTINGS.vib===false||typeof navigator.vibrate!=='function') return; navigator.vibrate(p); }catch(e){} }
const HAP_STRONG={mHorn:1,mCouple:1,mFuel:1,mUnload:1};
function hapPress(id){ haptic(HAP_STRONG[id]?35:12); }
const hapRecent=()=>performance.now()-HAP.last<800;
for(const ev of ['couple','uncouple','refuel','unloadStart','missionStart']) BigRig.on&&BigRig.on(ev,()=>{ if(hapRecent()) haptic(35); });
for(const ev of ['explode','breakdown']) BigRig.on&&BigRig.on(ev,()=>haptic([80,40,120]));
(function dmgWatch(){ try{ if(typeof truck!=='undefined'&&typeof truck.damage==='number'){ const d=truck.damage; if(HAP.dmg!==null&&d-HAP.dmg>0.5){ const n=performance.now(); if(n-HAP.dmgT>400){ HAP.dmgT=n; haptic(d-HAP.dmg>5?[90,50,140]:[50,30,60]); } } HAP.dmg=d; } }catch(e){} requestAnimationFrame(dmgWatch); })();
function setVib(on){ SETTINGS.vib=!!on; const el=document.getElementById('vibM'); if(el) el.checked=SETTINGS.vib; try{ saveGame(); }catch(e){} if(on) haptic(20); }
addEventListener('load',()=>{ if(!document.body.classList.contains('touch')||typeof navigator.vibrate!=='function') return; const ov=document.getElementById('overlay'); if(!ov||document.getElementById('vibM')) return;
  const d=document.createElement('label'); d.style.cssText='margin-top:10px;display:flex;align-items:center;gap:10px;justify-content:center;color:#cfd6e0;font-weight:700;pointer-events:auto';
  d.innerHTML='&#x1F4F3; Vibration <input id="vibM" type="checkbox" style="width:22px;height:22px;accent-color:#e8a317">'; ov.appendChild(d);
  const el=d.querySelector('input'); el.checked=SETTINGS.vib!==false; el.addEventListener('change',e=>{ e.stopPropagation(); setVib(el.checked); });
  for(const ev of ['pointerdown','click','touchstart']) d.addEventListener(ev,e=>e.stopPropagation());
  setTimeout(()=>{ el.checked=SETTINGS.vib!==false; },500); });
