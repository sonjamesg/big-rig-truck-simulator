/**
 * @file audio.js — AUDIO: WebAudio context + master volume, diesel engine (recorded idle pitch-shifted by RPM + synth rumble), horn, tyres, ambience
 * Exposes (globals): audio, b64ToBuf, initAudio, noiseBurst, airHiss, thump, updateAudio,
 *   audioLoop, chirp, AMB, updateAudioExtra, setVolume, posOut, distVol (+6 more)
 * Depends on: world.js, physics.js, traffic.js, depots.js, career.js, breakdown.js, owndepot.js,
 *   tune3.js, rail.js, daynight.js, main.js
 * Load order: #7 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== AUDIO =====================
// Engine: real diesel idle recording (BigSoundBank #1145, CC0) pitch-shifted with RPM, layered with a synthesised low firing rumble.
const audio = { ctx: null, ready: false };
function b64ToBuf(b) {
  const s = atob(b),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}
function initAudio() {
  if (audio.ctx) {
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  audio.ctx = ctx;
  const master = ctx.createGain();
  master.gain.value = typeof SETTINGS !== "undefined" ? SETTINGS.vol : 0.7;
  master.connect(ctx.destination);
  audio.master = master;
  // engine sample
  const eng = ctx.createGain();
  eng.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  eng.connect(lp);
  lp.connect(master);
  audio.eng = eng;
  audio.engLP = lp;
  // synth rumble layer (firing frequency of a 6-cylinder: rpm/20 Hz)
  const rum = ctx.createGain();
  rum.gain.value = 0;
  const rlp = ctx.createBiquadFilter();
  rlp.type = "lowpass";
  rlp.frequency.value = 180;
  rlp.Q.value = 4;
  rum.connect(rlp);
  rlp.connect(master);
  const o1 = ctx.createOscillator();
  o1.type = "sawtooth";
  const o2 = ctx.createOscillator();
  o2.type = "square";
  o1.connect(rum);
  const g2 = ctx.createGain();
  g2.gain.value = 0.5;
  o2.connect(g2);
  g2.connect(rum);
  o1.start();
  o2.start();
  audio.o1 = o1;
  audio.o2 = o2;
  audio.rum = rum;
  audio.rlp = rlp;
  // turbo whistle
  const tb = ctx.createOscillator();
  tb.type = "sine";
  const tg = ctx.createGain();
  tg.gain.value = 0;
  tb.connect(tg);
  tg.connect(master);
  tb.start();
  audio.turbo = tb;
  audio.turboG = tg;
  // noise buffer
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
    nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  audio.noise = nb;
  // horn: dual-trumpet lorry air horn (v57): two low reed tones a major third apart (each a slightly detuned pair) built
  // from a reed-like harmonic series, a soft saturator, two trumpet-bell resonances, an air-pressure pitch rise and hiss
  // on attack (see audioUpdate), a short release. Tuning comes from CZ_HORNS (tune3.js), indexes 0-3 main, 4-5 octave.
  const hg = ctx.createGain();
  hg.gain.value = 0;
  const hsh = ctx.createWaveShaper();
  const cv = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = i / 511.5 - 1;
    cv[i] = Math.tanh(1.7 * x) / Math.tanh(1.7);
  }
  hsh.curve = cv;
  hsh.oversample = "2x";
  const hb1 = ctx.createBiquadFilter();
  hb1.type = "peaking";
  hb1.frequency.value = 760;
  hb1.Q.value = 2.2;
  hb1.gain.value = 8;
  const hb2 = ctx.createBiquadFilter();
  hb2.type = "peaking";
  hb2.frequency.value = 1550;
  hb2.Q.value = 3;
  hb2.gain.value = 4;
  const hhp = ctx.createBiquadFilter();
  hhp.type = "highpass";
  hhp.frequency.value = 110;
  const hlp = ctx.createBiquadFilter();
  hlp.type = "lowpass";
  hlp.frequency.value = 3800;
  const hlim = ctx.createDynamicsCompressor();
  hlim.threshold.value = -10;
  hlim.knee.value = 4;
  hlim.ratio.value = 12;
  hlim.attack.value = 0.003;
  hlim.release.value = 0.15;
  hg.connect(hsh);
  hsh.connect(hhp);
  hhp.connect(hb1);
  hb1.connect(hb2);
  hb2.connect(hlp);
  hlp.connect(hlim);
  hlim.connect(master);
  // reed spectrum: strong low partials, slow 1/n^0.85 roll-off, odd partials a little stronger (pinched reed)
  const NH = 28,
    re = new Float32Array(NH + 1),
    im = new Float32Array(NH + 1);
  for (let n = 1; n <= NH; n++) im[n] = (n % 2 ? 1 : 0.72) / Math.pow(n, 0.85);
  const reed = ctx.createPeriodicWave(re, im);
  audio.hornOsc = [];
  const HG = [0.3, 0.22, 0.27, 0.2, 0.05, 0.035];
  (typeof CZ_HORNS !== "undefined" ? CZ_HORNS[0] : [175, 176.3, 220.5, 222, 350, 441]).forEach(
    (f, i) => {
      const o = ctx.createOscillator();
      o.setPeriodicWave(reed);
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = HG[i];
      o.connect(og);
      og.connect(hg);
      o.start();
      audio.hornOsc.push([o, f]);
    },
  );
  // air: band-passed hiss, a burst on attack and a little under the tone
  const hn = ctx.createBufferSource();
  hn.buffer = nb;
  hn.loop = true;
  const hnf = ctx.createBiquadFilter();
  hnf.type = "bandpass";
  hnf.frequency.value = 2400;
  hnf.Q.value = 0.8;
  const hng = ctx.createGain();
  hng.gain.value = 0;
  hn.connect(hnf);
  hnf.connect(hng);
  hng.connect(hlim);
  hn.start();
  audio.hornAir = hng;
  audio.horn = hg;
  // reverse beeper
  const bo = ctx.createOscillator();
  bo.type = "square";
  bo.frequency.value = 1150;
  const bg = ctx.createGain();
  bg.gain.value = 0;
  bo.connect(bg);
  bg.connect(master);
  bo.start();
  audio.beep = bg;
  ctx
    .decodeAudioData(b64ToBuf(ENGINE_WAV_B64))
    .then((buf) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(eng);
      src.start();
      audio.engSrc = src;
      audio.ready = true;
    })
    .catch((e) => {
      console.warn("engine sample decode failed", e);
      audio.ready = true;
    });
}
function noiseBurst(dur, freq, q, gain, type = "bandpass") {
  const ctx = audio.ctx;
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = audio.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(audio.master);
  s.start(t);
  s.stop(t + dur + 0.05);
}
function airHiss() {
  noiseBurst(0.9, 4200, 0.7, 0.35, "highpass");
}
function thump(str) {
  const ctx = audio.ctx;
  if (!ctx) return;
  noiseBurst(0.35, 180, 1.2, 0.9 * str);
  const o = ctx.createOscillator();
  o.frequency.value = 55;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.8 * str, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g);
  g.connect(audio.master);
  o.start(t);
  o.stop(t + 0.45);
}
function updateAudio(s, inp, time) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  const load = s.throttle,
    rpm = s.rpm;
  if (typeof BREAKDOWN !== "undefined" && BREAKDOWN.active) {
    audio.eng.gain.setTargetAtTime(0, t, 0.25);
    audio.rum.gain.setTargetAtTime(0, t, 0.25);
    audio.turboG.gain.setTargetAtTime(0, t, 0.2);
    if (s.rpm !== undefined) s.rpm = Math.max(0, s.rpm * 0.97);
    return;
  }
  if (audio.engSrc)
    audio.engSrc.playbackRate.setTargetAtTime(
      (((0.78 * rpm) / IDLE) * 0.72 + 0.22) * (s.sndP || 1),
      t,
      0.05,
    );
  audio.eng.gain.setTargetAtTime(0.32 + 0.38 * load + (0.1 * (rpm - IDLE)) / 1600, t, 0.08);
  audio.engLP.frequency.setTargetAtTime(900 + load * 2200 + rpm * 0.6, t, 0.1);
  const fire = rpm / 20;
  audio.o1.frequency.setTargetAtTime(fire, t, 0.05);
  audio.o2.frequency.setTargetAtTime(fire / 2, t, 0.05);
  audio.rlp.frequency.setTargetAtTime(120 + fire * 2 + load * 120, t, 0.1);
  audio.rum.gain.setTargetAtTime((0.1 + 0.16 * load) * (s.sndR || 1), t, 0.08);
  audio.turbo.frequency.setTargetAtTime(2400 + rpm * 1.8, t, 0.2);
  audio.turboG.gain.setTargetAtTime(
    load > 0.5 && rpm > 1200 ? (0.012 * (rpm - 1200)) / 1000 : 0,
    t,
    0.3,
  );
  {
    const hp = audio.hornUntil > performance.now() ? audio.hornPrev : s.hornP || 0;
    if (audio.hornP !== hp && typeof CZ_HORNS !== "undefined" && CZ_HORNS[hp]) {
      audio.hornP = hp;
      audio.hornOsc.forEach((e, i) => {
        e[1] = CZ_HORNS[hp][i];
        e[0].frequency.setValueAtTime(e[1], t);
      });
    }
  }
  const hornIn = inp.horn || audio.hornUntil > performance.now();
  if (hornIn && !audio.hornOn) {
    // pressure builds: each reed starts flat and sharpens up, slightly staggered; hiss burst as the valve opens
    audio.hornOsc.forEach(([o, f], i) => {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setValueAtTime(f * (0.9 - 0.01 * (i & 1)), t);
      o.frequency.setTargetAtTime(f, t + 0.005 * i, 0.055);
    });
    audio.hornAir.gain.cancelScheduledValues(t);
    audio.hornAir.gain.setValueAtTime(0.05, t);
    audio.hornAir.gain.setTargetAtTime(0.012, t + 0.04, 0.05);
  }
  if (!hornIn && audio.hornOn) {
    // valve closes: pitch sags a touch as pressure drops
    for (const [o, f] of audio.hornOsc) o.frequency.setTargetAtTime(f * 0.96, t, 0.08);
    audio.hornAir.gain.setTargetAtTime(0, t, 0.05);
  }
  audio.hornOn = !!hornIn;
  audio.horn.gain.setTargetAtTime(hornIn ? 0.6 : 0, t, hornIn ? 0.018 : 0.06);
  audio.beep.gain.setTargetAtTime(s.mode === "R" && time % 1 < 0.5 ? 0.09 : 0, t, 0.005);
}
// ---- v22: tyre screech, area ambience (city hum / birds / gulls / wind), volume control ----
function audioLoop(freq, q, type) {
  const ctx = audio.ctx,
    s = ctx.createBufferSource();
  s.buffer = audio.noise;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type || "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  s.connect(f);
  f.connect(g);
  g.connect(audio.master);
  s.start();
  return { g, f };
}
function chirp(f0, f1, dur, gain, type) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t = ctx.currentTime,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(audio.master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
const AMB = { t: 0, city: 0, green: 0, water: 0, birdT: 0 };
function updateAudioExtra(s, dt) {
  const ctx = audio.ctx;
  if (!ctx || !audio.noise) return;
  const t = ctx.currentTime;
  try {
    updateTrainAudio(s, dt);
  } catch (e) {
    if (!audio.trErr) {
      audio.trErr = 1;
      console.warn("train audio", e);
    }
  }
  if (!audio.scr) {
    audio.scr = audioLoop(2600, 4);
    audio.hum = audioLoop(260, 0.6, "lowpass");
    audio.wind = audioLoop(700, 0.4, "bandpass");
  }
  const slip = s.skid
    ? 1
    : Math.min(
        1,
        Math.max(0, (Math.abs(s.v) - 12) / 10) * Math.max(0, Math.abs(s.steer || 0) - 0.55) * 3,
      );
  audio.scr.g.gain.setTargetAtTime(slip * 0.22, t, 0.05);
  audio.scr.f.frequency.setTargetAtTime(2200 + Math.abs(s.v) * 25, t, 0.1);
  AMB.t -= dt;
  if (AMB.t <= 0) {
    AMB.t = 1;
    const cx = Math.floor(s.x / M_T),
      cy = Math.floor(s.y / M_T);
    let b = 0,
      gr = 0,
      w = 0,
      n = 0;
    for (let dy = -24; dy <= 24; dy += 4)
      for (let dx = -24; dx <= 24; dx += 4) {
        const tt = get(cx + dx, cy + dy);
        n++;
        if (tt === T.BLDG || tt === T.PLAZA) b++;
        else if (tt === T.GRASS || tt === T.PGRASS || tt === T.PARK || tt === T.TREE) gr++;
        else if (tt === T.WATER) w++;
      }
    AMB.city = b / n;
    AMB.green = gr / n;
    AMB.water = w / n;
  }
  const night = typeof DN !== "undefined" ? DN.dark : 0;
  audio.hum.g.gain.setTargetAtTime(Math.min(0.09, AMB.city * 0.18) * (1 - night * 0.5), t, 0.5);
  audio.wind.g.gain.setTargetAtTime(
    0.012 + 0.03 * Math.max(0, AMB.green - 0.5) + Math.min(0.05, Math.abs(s.v) * 0.0015),
    t,
    0.5,
  );
  AMB.birdT -= dt;
  if (AMB.birdT <= 0) {
    AMB.birdT = 0.6 + Math.random() * 2.5;
    if (AMB.water > 0.25 && Math.random() < 0.6) {
      chirp(1400, 700, 0.35, 0.03, "triangle");
      setTimeout(() => chirp(1300, 650, 0.3, 0.025, "triangle"), 380);
    } // gulls
    else if (AMB.green > 0.3 && night < 0.5 && Math.random() < 0.8) {
      const f = 2800 + Math.random() * 1800;
      chirp(f, f * 1.25, 0.07, 0.02);
      setTimeout(() => chirp(f * 1.1, f * 0.9, 0.06, 0.018), 110);
    } // songbirds
    else if (night > 0.6 && AMB.green > 0.3 && Math.random() < 0.3) chirp(4200, 4300, 0.05, 0.008);
  }
} // crickets
function setVolume(v) {
  SETTINGS.vol = Math.max(0, Math.min(1, v));
  if (audio.master) audio.master.gain.setTargetAtTime(SETTINGS.vol, audio.ctx.currentTime, 0.03);
  for (const id of ["vol", "volM"]) {
    const el = document.getElementById(id);
    if (el) el.value = Math.round(SETTINGS.vol * 100);
  }
  try {
    saveGame();
  } catch (e) {}
}
addEventListener("keydown", (e) => {
  if (e.target && e.target.tagName === "INPUT") return;
  if (e.key === "-" || e.key === "=" || e.key === "+") {
    setVolume((SETTINGS.vol || 0) + (e.key === "-" ? -0.1 : 0.1));
    if (typeof flash === "function") flash("Volume " + Math.round(SETTINGS.vol * 100) + "%");
  }
});
addEventListener("load", () => {
  if (document.body.classList.contains("touch")) {
    const ov = document.getElementById("overlay");
    if (ov && !document.getElementById("volM")) {
      const d = document.createElement("div");
      d.style.cssText =
        "margin-top:12px;display:flex;align-items:center;gap:10px;justify-content:center;color:#cfd6e0;font-weight:700;pointer-events:auto";
      d.innerHTML =
        '&#x1F50A; Volume <input id="volM" type="range" min="0" max="100" style="width:160px;accent-color:#e8a317">';
      ov.appendChild(d);
      const el = document.getElementById("volM");
      el.value = Math.round((SETTINGS.vol ?? 0.7) * 100);
      el.addEventListener("input", (e) => {
        e.stopPropagation();
        setVolume(el.value / 100);
      });
      for (const ev of ["pointerdown", "click", "touchstart"])
        d.addEventListener(ev, (e) => e.stopPropagation());
    }
  }
  const tb = document.querySelector("#titlebar small");
  if (tb) {
    tb.innerHTML =
      '&#x1F50A; <input id="vol" type="range" min="0" max="100" style="width:110px;vertical-align:middle;accent-color:#1d1406">';
    const el = document.getElementById("vol");
    el.value = Math.round((SETTINGS.vol ?? 0.7) * 100);
    el.addEventListener("input", () => setVolume(el.value / 100));
    el.addEventListener("keydown", (e) => e.stopPropagation());
  }
});

// ===================== TRAIN AUDIO (synth, positional, nearest 3 trains) =====================
function posOut(x, y) {
  const ctx = audio.ctx,
    g = ctx.createGain();
  g.gain.value = 0;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.6, Math.min(0.6, (x - truck.x) / 80));
    g.connect(p);
    p.connect(audio.master);
    g.pan = p;
  } else g.connect(audio.master);
  return g;
}
function distVol(x, y, k, R) {
  const d = Math.hypot(x - truck.x, y - truck.y);
  return d > R ? 0 : (k / (1 + (d / 35) ** 2)) * (1 - d / R);
}
// one-shot lorry air horn at a world position (AI lorries)
function airHornShot(x, y, vol) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t = ctx.currentTime,
    g = posOut(x, y),
    lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  lp.connect(g);
  const dur = 0.35 + Math.random() * 0.4,
    base = 0.9 + Math.random() * 0.2;
  for (const f of [122, 126, 155, 159, 250]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const F = f * base;
    o.frequency.setValueAtTime(F * 0.93, t);
    o.frequency.setTargetAtTime(F, t, 0.06);
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.012);
  g.gain.setValueAtTime(vol * 0.6, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
}
// two-tone train horn (high then low)
function trainHorn(x, y) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const v = distVol(x, y, 0.14, 900);
  if (v < 0.002) return;
  const t = ctx.currentTime,
    g = posOut(x, y),
    lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  lp.connect(g);
  [
    [0, 0.5, [370, 374, 555]],
    [0.55, 0.7, [311, 314, 466]],
  ].forEach(([a, l, fs]) => {
    for (const f of fs) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t + a);
      og.gain.linearRampToValueAtTime(f > 500 ? 0.25 : 1, t + a + 0.03);
      og.gain.setValueAtTime(f > 500 ? 0.25 : 1, t + a + l);
      og.gain.linearRampToValueAtTime(0, t + a + l + 0.06);
      o.connect(og);
      og.connect(lp);
      o.start(t + a);
      o.stop(t + a + l + 0.1);
    }
  });
  g.gain.value = v;
  TRA.horns++;
}
function clack(g, t, v, br) {
  const ctx = audio.ctx,
    s = ctx.createBufferSource();
  s.buffer = audio.noise;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = br;
  f.Q.value = 3;
  const e = ctx.createGain();
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(v, t + 0.003);
  e.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  s.connect(f);
  f.connect(e);
  e.connect(g);
  s.start(t, Math.random() * 1.5, 0.08);
}
const TRA = {
  voices: null,
  prev: new Map(),
  cross: new Map(),
  dwell: new Map(),
  horns: 0,
  dbg: [],
  bell: null,
};
function trVoice() {
  const ctx = audio.ctx,
    g = posOut(0, 0);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = 40;
  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = 80;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 150;
  lp.Q.value = 2;
  const rg = ctx.createGain();
  rg.gain.value = 0;
  o.connect(lp);
  o2.connect(lp);
  lp.connect(rg);
  rg.connect(g);
  o.start();
  o2.start();
  g.gain.value = 1;
  return { g, rg, o, o2, cl: ctx.createGain(), next: 0, id: null };
}
function updateTrainAudio(s, dt) {
  const ctx = audio.ctx;
  if (typeof RAIL === "undefined" || !RAIL.ready || !audio.master) return;
  const t = ctx.currentTime,
    rt = railTime(),
    L = RAIL.L;
  if (!TRA.voices) {
    TRA.voices = [0, 1, 2].map(() => {
      const v = trVoice();
      v.cl.connect(v.g);
      v.cl.gain.value = 0;
      return v;
    });
    const b = posOut(0, 0),
      o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 1250;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = 1580;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 1.5;
    const bg = ctx.createGain();
    bg.gain.value = 0;
    o.connect(bp);
    o2.connect(bp);
    bp.connect(bg);
    bg.connect(b);
    b.gain.value = 1;
    o.start();
    o2.start();
    TRA.bell = { g: bg, out: b };
  }
  // sources: timetabled trains + yard trains on the spur/main line
  const src = [];
  for (const tr of RAIL.trains) {
    const h = railHead(tr, rt),
      w = tr.pax ? RW_P : RW_F,
      p = railPt(h, w);
    const pv = TRA.prev.get(tr);
    let v = 0;
    if (pv && rt > pv.t) {
      let d = rlMod(h - pv.h, L);
      if (d > L / 2) d = L - d;
      v = d / (rt - pv.t);
      if (v > 80) v = pv.v || 0;
    }
    TRA.prev.set(tr, { h, t: rt, v });
    src.push({ id: tr, x: p[0], y: p[1], v, pax: tr.pax, tr });
  }
  if (typeof ownYards === "function")
    for (const yd of ownYards()) {
      const R = yd.rt;
      if (yd.rc && R && (R.st === "ext" || R.st === "hold" || R.st === "main" || R.st === "back")) {
        const p = rlPos(yd, R.d);
        src.push({ id: yd, x: p[0], y: p[1], v: R.v || 0 });
      } else if (R && R.x != null) {
        src.push({
          id: yd,
          x: (yd.x0 + R.x + 8) * M_T,
          y: (yd.y0 + RAIL_Y) * M_T,
          v: R.st === "load" ? 0 : 2,
        });
      }
    }
  for (const q of src) q.d = Math.hypot(q.x - s.x, q.y - s.y);
  src.sort((a, b) => a.d - b.d);
  const near = src.slice(0, 3);
  TRA.voices.forEach((V, i) => {
    const q = near[i];
    const vol = q ? distVol(q.x, q.y, 1, 700) : 0;
    if (q && V.g.pan)
      V.g.pan.pan.setTargetAtTime(Math.max(-0.6, Math.min(0.6, (q.x - s.x) / 80)), t, 0.1);
    const sp = q ? q.v : 0,
      run = Math.min(1, sp / 12);
    V.rg.gain.setTargetAtTime(vol * (0.05 + 0.07 * run), t, 0.15);
    V.o.frequency.setTargetAtTime(34 + sp * 0.9, t, 0.3);
    V.o2.frequency.setTargetAtTime(68 + sp * 1.8, t, 0.3);
    V.cl.gain.setTargetAtTime(vol * 0.22, t, 0.1);
    if (q && sp > 1.5 && vol > 0.003) {
      const gap = 18 / sp;
      if (V.next < t || V.id !== q.id) {
        V.next = Math.max(t, V.next);
        V.id = q.id;
      }
      while (V.next < t + 0.15) {
        const k = Math.min(1, sp / 25),
          br = 1800 + Math.random() * 500;
        clack(V.cl, V.next, 0.7, br);
        clack(V.cl, V.next + 2.4 / sp, 0.55, br * 0.9);
        clack(V.cl, V.next + Math.min(gap * 0.5, 15 / sp), 0.6, br);
        clack(V.cl, V.next + Math.min(gap * 0.5, 15 / sp) + 2.4 / sp, 0.5, br * 0.9);
        V.next += Math.max(0.12, gap);
      }
    }
    if (i === 0)
      TRA.dbg.push({
        t: +t.toFixed(2),
        d: q ? Math.round(q.d) : null,
        v: q ? +sp.toFixed(1) : 0,
        rumble: +(vol * (0.05 + 0.07 * run)).toFixed(4),
        clack: +(vol * 0.22).toFixed(4),
      });
  });
  if (TRA.dbg.length > 400) TRA.dbg.splice(0, 200);
  // crossings: horn as the alarm starts, bells while lit
  let bc = null,
    bd = 1e9;
  for (const c of RAIL.cross) {
    if (c.over) continue;
    const d = Math.hypot(c.mx - s.x, c.my - s.y);
    const was = TRA.cross.get(c) || 0;
    if (c.lit && !was && d < 800) {
      let best = null,
        b2 = 1e9;
      for (const q of src) {
        const e = Math.hypot(q.x - c.mx, q.y - c.my);
        if (e < b2) {
          b2 = e;
          best = q;
        }
      }
      if (best && b2 < 400) trainHorn(best.x, best.y);
    }
    TRA.cross.set(c, c.lit ? 1 : 0);
    if (c.lit && d < bd) {
      bd = d;
      bc = c;
    }
  }
  const bv = bc ? distVol(bc.mx, bc.my, 0.09, 300) : 0;
  if (bc && TRA.bell.out.pan)
    TRA.bell.out.pan.pan.setTargetAtTime(Math.max(-0.6, Math.min(0.6, (bc.mx - s.x) / 80)), t, 0.1);
  TRA.bell.g.gain.setTargetAtTime(bv > 0 && (t * 3.2) % 1 < 0.4 ? bv : 0, t, 0.008);
  // station arrival horn (passenger trains among the nearest few)
  for (const q of near) {
    if (!q.pax) continue;
    const dw = !!railDwelling(q.tr, rt),
      was = TRA.dwell.get(q.tr);
    if (dw && was === false) trainHorn(q.x, q.y);
    TRA.dwell.set(q.tr, dw);
  }
}
// mobile: resume the audio context on any tap / key
for (const ev of ["pointerdown", "touchstart", "keydown"])
  addEventListener(
    ev,
    () => {
      if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
    },
    { passive: true },
  );
