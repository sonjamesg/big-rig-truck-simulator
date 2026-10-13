'use strict';
// ===================== AUDIO =====================
// Engine: real diesel idle recording (BigSoundBank #1145, CC0) pitch-shifted with RPM, layered with a synthesised low firing rumble.
const audio={ctx:null,ready:false};
function b64ToBuf(b){ const s=atob(b), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u.buffer; }
function initAudio(){
  if(audio.ctx) { if(audio.ctx.state==='suspended') audio.ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  const ctx=new AC(); audio.ctx=ctx;
  const master=ctx.createGain(); master.gain.value=(typeof SETTINGS!=='undefined'?SETTINGS.vol:0.7); master.connect(ctx.destination); audio.master=master;
  // engine sample
  const eng=ctx.createGain(); eng.gain.value=0; const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1800; eng.connect(lp); lp.connect(master); audio.eng=eng; audio.engLP=lp;
  // synth rumble layer (firing frequency of a 6-cylinder: rpm/20 Hz)
  const rum=ctx.createGain(); rum.gain.value=0; const rlp=ctx.createBiquadFilter(); rlp.type='lowpass'; rlp.frequency.value=180; rlp.Q.value=4; rum.connect(rlp); rlp.connect(master);
  const o1=ctx.createOscillator(); o1.type='sawtooth'; const o2=ctx.createOscillator(); o2.type='square'; o1.connect(rum); const g2=ctx.createGain(); g2.gain.value=0.5; o2.connect(g2); g2.connect(rum); o1.start(); o2.start();
  audio.o1=o1; audio.o2=o2; audio.rum=rum; audio.rlp=rlp;
  // turbo whistle
  const tb=ctx.createOscillator(); tb.type='sine'; const tg=ctx.createGain(); tg.gain.value=0; tb.connect(tg); tg.connect(master); tb.start(); audio.turbo=tb; audio.turboG=tg;
  // noise buffer
  const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), nd=nb.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1; audio.noise=nb;
  // horn
  const hg=ctx.createGain(); hg.gain.value=0; const hlp=ctx.createBiquadFilter(); hlp.type='lowpass'; hlp.frequency.value=1400; hg.connect(hlp); hlp.connect(master);
  for(const f of [185,233,277]){ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.connect(hg); o.start(); } audio.horn=hg;
  // reverse beeper
  const bo=ctx.createOscillator(); bo.type='square'; bo.frequency.value=1150; const bg=ctx.createGain(); bg.gain.value=0; bo.connect(bg); bg.connect(master); bo.start(); audio.beep=bg;
  ctx.decodeAudioData(b64ToBuf(ENGINE_WAV_B64)).then(buf=>{ const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true; src.connect(eng); src.start(); audio.engSrc=src; audio.ready=true; }).catch(e=>{ console.warn('engine sample decode failed',e); audio.ready=true; });
}
function noiseBurst(dur,freq,q,gain,type='bandpass'){ const ctx=audio.ctx; if(!ctx) return; const s=ctx.createBufferSource(); s.buffer=audio.noise; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=ctx.createGain(); const t=ctx.currentTime; g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(f); f.connect(g); g.connect(audio.master); s.start(t); s.stop(t+dur+0.05); }
function airHiss(){ noiseBurst(0.9,4200,0.7,0.35,'highpass'); }
function thump(str){ const ctx=audio.ctx; if(!ctx) return; noiseBurst(0.35,180,1.2,0.9*str); const o=ctx.createOscillator(); o.frequency.value=55; const g=ctx.createGain(); const t=ctx.currentTime; g.gain.setValueAtTime(0.8*str,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4); o.connect(g); g.connect(audio.master); o.start(t); o.stop(t+0.45); }
function updateAudio(s,inp,time){
  const ctx=audio.ctx; if(!ctx) return; const t=ctx.currentTime;
  const load=s.throttle, rpm=s.rpm;
  if(typeof BREAKDOWN!=='undefined'&&BREAKDOWN.active){ audio.eng.gain.setTargetAtTime(0,t,0.25); audio.rum.gain.setTargetAtTime(0,t,0.25); audio.turboG.gain.setTargetAtTime(0,t,0.2); if(s.rpm!==undefined) s.rpm=Math.max(0,s.rpm*0.97); return; }
  if(audio.engSrc) audio.engSrc.playbackRate.setTargetAtTime(0.78*rpm/IDLE*0.72+0.22,t,0.05);
  audio.eng.gain.setTargetAtTime(0.32+0.38*load+0.1*(rpm-IDLE)/1600,t,0.08);
  audio.engLP.frequency.setTargetAtTime(900+load*2200+rpm*0.6,t,0.1);
  const fire=rpm/20; audio.o1.frequency.setTargetAtTime(fire,t,0.05); audio.o2.frequency.setTargetAtTime(fire/2,t,0.05);
  audio.rlp.frequency.setTargetAtTime(120+fire*2+load*120,t,0.1);
  audio.rum.gain.setTargetAtTime(0.10+0.16*load,t,0.08);
  audio.turbo.frequency.setTargetAtTime(2400+rpm*1.8,t,0.2); audio.turboG.gain.setTargetAtTime(load>0.5&&rpm>1200?0.012*(rpm-1200)/1000:0,t,0.3);
  audio.horn.gain.setTargetAtTime(inp.horn?0.22:0,t,0.02);
  audio.beep.gain.setTargetAtTime(s.mode==='R' && (time%1)<0.5 ? 0.09:0,t,0.005);
}
// ---- v22: tyre screech, area ambience (city hum / birds / gulls / wind), volume control ----
function audioLoop(freq,q,type){ const ctx=audio.ctx, s=ctx.createBufferSource(); s.buffer=audio.noise; s.loop=true; const f=ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq; f.Q.value=q; const g=ctx.createGain(); g.gain.value=0; s.connect(f); f.connect(g); g.connect(audio.master); s.start(); return {g,f}; }
function chirp(f0,f1,dur,gain,type){ const ctx=audio.ctx; if(!ctx) return; const t=ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(g); g.connect(audio.master); o.start(t); o.stop(t+dur+0.05); }
const AMB={t:0,city:0,green:0,water:0,birdT:0};
function updateAudioExtra(s,dt){ const ctx=audio.ctx; if(!ctx||!audio.noise) return; const t=ctx.currentTime;
  if(!audio.scr){ audio.scr=audioLoop(2600,4); audio.hum=audioLoop(260,0.6,'lowpass'); audio.wind=audioLoop(700,0.4,'bandpass'); }
  const slip=s.skid?1:Math.min(1,Math.max(0,(Math.abs(s.v)-12)/10)*Math.max(0,Math.abs(s.steer||0)-0.55)*3);
  audio.scr.g.gain.setTargetAtTime(slip*0.22,t,0.05); audio.scr.f.frequency.setTargetAtTime(2200+Math.abs(s.v)*25,t,0.1);
  AMB.t-=dt; if(AMB.t<=0){ AMB.t=1; const cx=Math.floor(s.x/M_T), cy=Math.floor(s.y/M_T); let b=0,gr=0,w=0,n=0; for(let dy=-24;dy<=24;dy+=4) for(let dx=-24;dx<=24;dx+=4){ const tt=get(cx+dx,cy+dy); n++; if(tt===T.BLDG||tt===T.PLAZA) b++; else if(tt===T.GRASS||tt===T.PGRASS||tt===T.PARK||tt===T.TREE) gr++; else if(tt===T.WATER) w++; } AMB.city=b/n; AMB.green=gr/n; AMB.water=w/n; }
  const night=(typeof DN!=='undefined')?DN.dark:0;
  audio.hum.g.gain.setTargetAtTime(Math.min(0.09,AMB.city*0.18)*(1-night*0.5),t,0.5);
  audio.wind.g.gain.setTargetAtTime(0.012+0.03*Math.max(0,AMB.green-0.5)+Math.min(0.05,Math.abs(s.v)*0.0015),t,0.5);
  AMB.birdT-=dt; if(AMB.birdT<=0){ AMB.birdT=0.6+Math.random()*2.5;
    if(AMB.water>0.25&&Math.random()<0.6) { chirp(1400,700,0.35,0.03,'triangle'); setTimeout(()=>chirp(1300,650,0.3,0.025,'triangle'),380); }   // gulls
    else if(AMB.green>0.3&&night<0.5&&Math.random()<0.8){ const f=2800+Math.random()*1800; chirp(f,f*1.25,0.07,0.02); setTimeout(()=>chirp(f*1.1,f*0.9,0.06,0.018),110); }   // songbirds
    else if(night>0.6&&AMB.green>0.3&&Math.random()<0.3) chirp(4200,4300,0.05,0.008); } }   // crickets
function setVolume(v){ SETTINGS.vol=Math.max(0,Math.min(1,v)); if(audio.master) audio.master.gain.setTargetAtTime(SETTINGS.vol,audio.ctx.currentTime,0.03); for(const id of ['vol','volM']){ const el=document.getElementById(id); if(el) el.value=Math.round(SETTINGS.vol*100); } try{ saveGame(); }catch(e){} }
addEventListener('keydown',e=>{ if(e.target&&e.target.tagName==='INPUT') return; if(e.key==='-'||e.key==='='||e.key==='+'){ setVolume((SETTINGS.vol||0)+(e.key==='-'?-0.1:0.1)); if(typeof flash==='function') flash('Volume '+Math.round(SETTINGS.vol*100)+'%'); } });
addEventListener('load',()=>{ if(document.body.classList.contains('touch')){ const ov=document.getElementById('overlay'); if(ov&&!document.getElementById('volM')){ const d=document.createElement('div'); d.style.cssText='margin-top:12px;display:flex;align-items:center;gap:10px;justify-content:center;color:#cfd6e0;font-weight:700;pointer-events:auto'; d.innerHTML='&#x1F50A; Volume <input id="volM" type="range" min="0" max="100" style="width:160px;accent-color:#e8a317">'; ov.appendChild(d); const el=document.getElementById('volM'); el.value=Math.round((SETTINGS.vol??0.7)*100); el.addEventListener('input',e=>{ e.stopPropagation(); setVolume(el.value/100); }); for(const ev of ['pointerdown','click','touchstart']) d.addEventListener(ev,e=>e.stopPropagation()); } } const tb=document.querySelector('#titlebar small'); if(tb){ tb.innerHTML='&#x1F50A; <input id="vol" type="range" min="0" max="100" style="width:110px;vertical-align:middle;accent-color:#1d1406">'; const el=document.getElementById('vol'); el.value=Math.round((SETTINGS.vol??0.7)*100); el.addEventListener('input',()=>setVolume(el.value/100)); el.addEventListener('keydown',e=>e.stopPropagation()); } });
