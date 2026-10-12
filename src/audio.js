'use strict';
// ===================== AUDIO =====================
// Engine: real diesel idle recording (BigSoundBank #1145, CC0) pitch-shifted with RPM, layered with a synthesised low firing rumble.
const audio={ctx:null,ready:false};
function b64ToBuf(b){ const s=atob(b), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u.buffer; }
function initAudio(){
  if(audio.ctx) { if(audio.ctx.state==='suspended') audio.ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  const ctx=new AC(); audio.ctx=ctx;
  const master=ctx.createGain(); master.gain.value=0.7; master.connect(ctx.destination); audio.master=master;
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
