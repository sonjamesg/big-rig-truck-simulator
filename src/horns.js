/**
 * @file horns.js — HORNS: every horn sound in one editable table: the player's horn choices (customisation "Horns" tab)
 *   and the AI traffic horns by vehicle class. All synthesised in WebAudio (no samples).
 * Exposes (globals): HORNS, HORN_DEFAULT, hornDef, hornSeqAt, AI_HORNS, aiHornClass, aiHornShot
 * Depends on: audio.js (audio.ctx, posOut, distVol), traffic.js (vehicle kinds), tune3.js (shop parts look.hrn = index)
 * Load order: before audio.js in build.py. All files share one global scope (see AGENTS.md, SYMBOLS.md).
 *
 * Player horn fields (index = look.hrn, saved with the truck's fitted parts exactly as before):
 *   n     name shown in the picker          f   six oscillator pitches in Hz (pairs slightly detuned = beating reeds)
 *   g     six oscillator levels              lp  lowpass cutoff (Hz): lower = darker, more distant
 *   bell  trumpet-bell resonance (Hz)        air valve hiss level on attack
 *   att   pitch on attack as a factor of f (air pressure building up; 1 = instant)
 *   gA/gR gain time constants (s) for attack / release (bigger = softer swell / longer tail)
 *   seq   optional pattern played while held: [[ratio, seconds], ...]; ratio multiplies every pitch, 0 = silent gap
 *   pv    preview length in ms
 */
"use strict";
const HG6 = [0.3, 0.22, 0.27, 0.2, 0.05, 0.035];
const HORNS = [
  // 0: the stock deep dual-trumpet air horn (default): F3 + A3, a major third, each a detuned pair + octave
  {
    n: "Stock air horn",
    f: [175, 176.3, 220.5, 222, 350, 441],
    g: HG6,
    lp: 3800,
    bell: 760,
    air: 0.05,
    att: 0.9,
    gA: 0.018,
    gR: 0.06,
    pv: 900,
  },
  // 1: European twin-tone (simultaneous, Fiamm-style): bright, a major third, compressor horn bite
  {
    n: "Euro twin-tone",
    f: [362, 363.8, 454, 456.5, 724, 908],
    g: [0.28, 0.2, 0.26, 0.19, 0.06, 0.04],
    lp: 5200,
    bell: 1250,
    air: 0.03,
    att: 0.94,
    gA: 0.012,
    gR: 0.05,
    pv: 800,
  },
  // 2: deep air horn: G2 + B2 + D3, a big low major triad
  {
    n: "Deep air horn",
    f: [98, 99.4, 123.5, 124.8, 147, 196],
    g: [0.3, 0.24, 0.28, 0.22, 0.16, 0.05],
    lp: 2600,
    bell: 520,
    air: 0.06,
    att: 0.86,
    gA: 0.025,
    gR: 0.09,
    pv: 1000,
  },
  // 3: musical chime: C#4 E4 F#4 A4 (a soft four-note chord)
  {
    n: "Musical chime",
    f: [277.2, 329.6, 370, 440, 554.4, 659.3],
    g: [0.22, 0.2, 0.2, 0.2, 0.06, 0.05],
    lp: 4200,
    bell: 880,
    air: 0.02,
    att: 0.97,
    gA: 0.03,
    gR: 0.12,
    pv: 1000,
  },
  // 4: train horn (five-chime): Eb3 F#3 Bb3 Eb4 F#4 Bb4
  {
    n: "Train horn",
    f: [155.6, 185, 233.1, 311.1, 370, 466.2],
    g: [0.24, 0.22, 0.22, 0.18, 0.08, 0.05],
    lp: 2800,
    bell: 640,
    air: 0.05,
    att: 0.88,
    gA: 0.04,
    gR: 0.12,
    pv: 1200,
  },
  // 5: big American triple-chime locomotive horn (K3LA-style chord D#4 F#4 B4, each bell a detuned pair), slow swell
  {
    n: "Triple-chime train horn",
    f: [311.1, 312.6, 370, 371.6, 493.9, 495.8],
    g: [0.25, 0.2, 0.24, 0.19, 0.22, 0.17],
    lp: 3200,
    bell: 700,
    air: 0.07,
    att: 0.84,
    gA: 0.06,
    gR: 0.16,
    pv: 1600,
  },
  // 6: classic European two-tone: hi-lo alternating (A4 / F4) while held
  {
    n: "Euro two-tone (hi-lo)",
    f: [440, 441.6, 880, 882, 1320, 660],
    g: [0.32, 0.24, 0.08, 0.06, 0.03, 0.04],
    lp: 4600,
    bell: 1100,
    air: 0.02,
    att: 0.97,
    gA: 0.01,
    gR: 0.04,
    seq: [
      [1, 0.42],
      [0.8, 0.42],
    ],
    pv: 1700,
  },
  // 7: ship's foghorn: very low A1 diaphone, dark and slow, long tail
  {
    n: "Ship foghorn",
    f: [55, 55.4, 110, 110.7, 82.4, 165],
    g: [0.34, 0.3, 0.26, 0.22, 0.12, 0.06],
    lp: 900,
    bell: 240,
    air: 0.08,
    att: 0.8,
    gA: 0.16,
    gR: 0.35,
    pv: 2000,
  },
  // 8: musical "La Cucaracha" melody horn (C5 base): C C C F A, C C C F A, F F E E D D C
  {
    n: "La Cucaracha",
    f: [523.3, 525, 1046.5, 1049, 261.6, 1569.8],
    g: [0.3, 0.22, 0.1, 0.07, 0.06, 0.03],
    lp: 5000,
    bell: 1300,
    air: 0.01,
    att: 0.99,
    gA: 0.006,
    gR: 0.02,
    seq: [
      [1, 0.13],
      [1, 0.13],
      [1, 0.13],
      [4 / 3, 0.3],
      [1.682, 0.4],
      [0, 0.1],
      [1, 0.13],
      [1, 0.13],
      [1, 0.13],
      [4 / 3, 0.3],
      [1.682, 0.4],
      [0, 0.1],
      [4 / 3, 0.2],
      [4 / 3, 0.2],
      [1.26, 0.2],
      [1.26, 0.2],
      [1.1225, 0.2],
      [1.1225, 0.2],
      [1, 0.5],
      [0, 0.4],
    ],
    pv: 4900,
  },
  // 9: squeaky "meep meep": two short high blips with an upward chirp
  {
    n: "Meep meep",
    f: [1175, 1182, 2350, 2364, 1760, 3525],
    g: [0.3, 0.22, 0.06, 0.04, 0.05, 0.02],
    lp: 7000,
    bell: 2400,
    air: 0,
    att: 0.78,
    gA: 0.005,
    gR: 0.015,
    seq: [
      [1, 0.12],
      [0, 0.07],
      [1.06, 0.15],
      [0, 0.45],
    ],
    pv: 800,
  },
];
const HORN_DEFAULT = 0;
function hornDef(k) {
  return HORNS[k] || HORNS[HORN_DEFAULT];
}
// pattern step at time t (s) since the horn was pressed; notes leave a 25 ms gap so repeats re-articulate
function hornSeqAt(H, t) {
  if (!H.seq) return { r: 1, on: 1, i: 0 };
  let tot = 0;
  for (const s of H.seq) tot += s[1];
  let u = t % tot;
  for (let i = 0; i < H.seq.length; i++) {
    const [r, d] = H.seq[i];
    if (u < d) return { r: r || 1, on: r > 0 && u < d - 0.025 ? 1 : 0, i };
    u -= d;
  }
  return { r: 1, on: 0, i: -1 };
}
// ---- AI traffic horns by vehicle class (emergency vehicles never honk; they keep their sirens)
// beep: small cars, one high blip; two: big cars and vans, mid two-tone; air: buses and lorries, a reed air horn
const AI_HORNS = {
  beep: { f: [470, 474], wave: "square", lp: 3000, dur: [0.14, 0.26], blasts: 1, k: 0.12 },
  two: { f: [350, 440], wave: "square", lp: 2300, dur: [0.18, 0.34], blasts: 2, k: 0.13 },
  air: {
    f: [122, 126, 155, 159, 250],
    wave: "sawtooth",
    lp: 1500,
    dur: [0.35, 0.8],
    blasts: 1,
    k: 0.2,
    att: 0.93,
  },
};
function aiHornClass(v) {
  const k = v.kind;
  if (v.heavy || k === "bus" || k === "lorry" || k === "cab" || k === "box") return "air";
  if (k === "van" || k === "suv" || k === "estate") return "two";
  return "beep";
}
// one honk from an AI vehicle: per-vehicle pitch (v.hornPr, 0.92-1.08), stereo pan and distance falloff (distVol)
function aiHornShot(v) {
  const ctx = audio.ctx;
  if (!ctx || !audio.master) return;
  const H = AI_HORNS[aiHornClass(v)];
  if (v.hornPr === undefined) v.hornPr = 0.92 + (v.r ? v.r() : Math.random()) * 0.16;
  const vol = distVol(v.x, v.y, H.k, 160);
  if (vol < 0.002) return;
  const t = ctx.currentTime,
    g = posOut(v.x, v.y),
    lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = H.lp;
  lp.connect(g);
  const dur = H.dur[0] + Math.random() * (H.dur[1] - H.dur[0]),
    n = H.blasts > 1 && Math.random() < 0.6 ? 2 : 1,
    end = n * dur + (n - 1) * 0.1;
  for (const f0 of H.f) {
    const o = ctx.createOscillator(),
      F = f0 * v.hornPr;
    o.type = H.wave;
    o.frequency.setValueAtTime(F * (H.att || 1), t);
    o.frequency.setTargetAtTime(F, t, 0.05);
    o.connect(lp);
    o.start(t);
    o.stop(t + end + 0.1);
  }
  const lv = vol / Math.sqrt(H.f.length);
  g.gain.setValueAtTime(0, t);
  for (let b = 0; b < n; b++) {
    const a = t + b * (dur + 0.1);
    g.gain.setValueAtTime(0, a);
    g.gain.linearRampToValueAtTime(lv, a + 0.012);
    g.gain.setValueAtTime(lv, a + dur);
    g.gain.linearRampToValueAtTime(0, a + dur + 0.03);
  }
}
