/**
 * @file tune2.js — truck customiser stage 2: gearbox, suspension, fuel tank, exhaust, armour (crash damage), bulletproof panels (bullet damage)
 * Exposes (globals): czIcon2
 * Depends on: world.js, render.js, lorry.js, physics.js, career.js, tune.js, main.js
 * Load order: #32 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== cz stage 2: gearbox, suspension, fuel tank, exhaust, armour =====================
CZ_TABS.push(
  { id: "gearbox", n: "Gearbox", ic: "\u{1F579}\uFE0F", slots: ["gbx"] },
  { id: "susp", n: "Suspension", ic: "\u{1F6E0}\uFE0F", slots: ["sus"] },
  { id: "tank", n: "Fuel tank", ic: "\u26FD", slots: ["tnk"] },
  { id: "exhaust", n: "Exhaust", ic: "\u{1F4A8}", slots: ["exh", "exs"] },
  { id: "armour", n: "Chassis & armour", ic: "\u{1F6E1}\uFE0F", slots: ["arm", "bpl"] },
);
Object.assign(CZ_SLOTS, {
  gbx: "Gearbox",
  sus: "Suspension",
  tnk: "Fuel tank",
  exh: "Exhaust system",
  exs: "Stack style",
  arm: "Chassis & armour",
  bpl: "Bulletproof panels",
});
CZ_PARTS.push(
  {
    id: "gbx1",
    slot: "gbx",
    n: "Quick-shift linkage",
    lv: 1,
    p: 1200,
    req: 1,
    fx: { shift: 0.75 },
    d: "Shorter throw, faster changes",
  },
  {
    id: "gbx2",
    slot: "gbx",
    n: "Close-ratio 14-speed",
    lv: 2,
    p: 3200,
    req: 3,
    fx: { shift: 0.6, acc: 1.06 },
    d: "Tighter ratios keep it on boost",
  },
  {
    id: "gbx3",
    slot: "gbx",
    n: "AMT pro auto-shift",
    lv: 3,
    p: 6500,
    req: 6,
    fx: { shift: 0.45, acc: 1.08, econ: 0.96 },
    d: "Predictive shifting, saves fuel",
  },
  {
    id: "gbx4",
    slot: "gbx",
    n: "Race dog box",
    lv: 4,
    p: 11000,
    req: 10,
    fx: { shift: 0.3, acc: 1.13, econ: 1.03, vm: 0.6 },
    d: "Clutchless instant shifts",
  },
  {
    id: "sus1",
    slot: "sus",
    n: "Sport dampers",
    lv: 1,
    p: 1000,
    req: 1,
    fx: { hand: 1.08 },
    d: "Firmer shocks, less body roll",
  },
  {
    id: "sus2",
    slot: "sus",
    n: "Air ride",
    lv: 2,
    p: 3500,
    req: 3,
    fx: { hand: 1.05, jk: 0.5 },
    d: "Air bags steady the trailer: less jackknifing",
  },
  {
    id: "sus3",
    slot: "sus",
    n: "Adaptive air",
    lv: 3,
    p: 7000,
    req: 6,
    fx: { hand: 1.12, jk: 0.8, dur: 0.95 },
    d: "Self-levelling air, strong anti-sway",
  },
  {
    id: "sus4",
    slot: "sus",
    n: "Race air + coilovers",
    lv: 4,
    p: 12000,
    req: 9,
    fx: { hand: 1.2, jk: 1.0, grip: 1.04 },
    d: "Lowered, razor sharp, trailer stays put",
  },
  {
    id: "tnk1",
    slot: "tnk",
    n: "Extra 150 L tank",
    lv: 1,
    p: 700,
    req: 1,
    fx: { tank: 150 },
    d: "Second steel tank",
  },
  {
    id: "tnk2",
    slot: "tnk",
    n: "Alloy 300 L tanks",
    lv: 2,
    p: 1600,
    req: 2,
    fx: { tank: 300, econ: 0.98 },
    d: "Lighter alloy, more range",
  },
  {
    id: "tnk3",
    slot: "tnk",
    n: "Twin 450 L tanks",
    lv: 3,
    p: 3200,
    req: 4,
    fx: { tank: 450, econ: 0.97 },
    d: "Saddle tanks both sides",
  },
  {
    id: "tnk4",
    slot: "tnk",
    n: "Long-range 600 L + eco pump",
    lv: 4,
    p: 5500,
    req: 7,
    fx: { tank: 600, econ: 0.94 },
    d: "Polished tanks, lift pump, best economy",
  },
  {
    id: "exh1",
    slot: "exh",
    n: "Straight-through pipe",
    lv: 1,
    p: 900,
    req: 1,
    fx: { pw: 1.03, snd: 1 },
    d: "Freer flow, louder note",
  },
  {
    id: "exh2",
    slot: "exh",
    n: '5" big-bore',
    lv: 2,
    p: 2200,
    req: 2,
    fx: { pw: 1.06, econ: 0.98, snd: 2 },
    d: "Big-bore system, deeper rumble",
  },
  {
    id: "exh3",
    slot: "exh",
    n: '7" twin system',
    lv: 3,
    p: 4800,
    req: 4,
    fx: { pw: 1.09, econ: 0.97, snd: 3 },
    d: 'Twin 7" pipes, thunderous',
  },
  { id: "exs1", slot: "exs", n: "Chrome twin stacks", p: 800, req: 1, look: { exs: "chrome" } },
  { id: "exs2", slot: "exs", n: "Black stacks", p: 800, req: 1, look: { exs: "black" } },
  { id: "exs3", slot: "exs", n: "Mitre-cut tall stacks", p: 1400, req: 2, look: { exs: "tall" } },
  { id: "exs4", slot: "exs", n: "Side pipes", p: 1800, req: 3, look: { exs: "side" } },
  { id: "exs5", slot: "exs", n: "Flame-tip stacks", p: 3000, req: 5, look: { exs: "flame" } },
  {
    id: "arm1",
    slot: "arm",
    n: "Reinforced frame",
    lv: 1,
    p: 1500,
    req: 1,
    fx: { dur: 0.85 },
    d: "Boxed chassis rails",
  },
  {
    id: "arm2",
    slot: "arm",
    n: "Steel underguard",
    lv: 2,
    p: 3500,
    req: 3,
    fx: { dur: 0.72 },
    d: "Bash plate + side guards",
  },
  {
    id: "arm3",
    slot: "arm",
    n: "Armoured cab",
    lv: 3,
    p: 7000,
    req: 6,
    fx: { dur: 0.58, econ: 1.03 },
    d: "Plated cab corners, heavier",
  },
  {
    id: "arm4",
    slot: "arm",
    n: "Full armour kit",
    lv: 4,
    p: 13000,
    req: 10,
    fx: { dur: 0.45, econ: 1.05, acc: 0.97 },
    d: "Riveted plate everywhere: shrugs off crashes",
  },
  // v49: bulletproof panels: cut gunfire damage (soldiers, the army jeep MG, police); crash damage is the armour slot above
  {
    id: "bpl1",
    slot: "bpl",
    n: "Ballistic door panels",
    lv: 1,
    p: 2400,
    req: 2,
    fx: { bp: 0.8 },
    d: "Kevlar-backed steel in the doors",
  },
  {
    id: "bpl2",
    slot: "bpl",
    n: "Ballistic cab kit",
    lv: 2,
    p: 5500,
    req: 4,
    fx: { bp: 0.62, econ: 1.02 },
    d: "Plated cab sides + windscreen shutter",
  },
  {
    id: "bpl3",
    slot: "bpl",
    n: "Full ballistic plating",
    lv: 3,
    p: 9800,
    req: 7,
    fx: { bp: 0.45, econ: 1.04, acc: 0.98 },
    d: "Cab, roof and tanks: rounds just spark off",
  },
);
// exhaust sound: snd adds (not multiplies)
{
  const ap0 = czApply;
  czApply = function () {
    ap0();
    const m = modelById(career.cur),
      F = czFx(czFitted(m.id));
    truck.sndP = 1 - F.snd * 0.06;
    truck.sndR = 1 + F.snd * 0.45;
  };
}
// ---- top-down art for stage-2 parts
{
  const dp0 = czDrawParts;
  czDrawParts = function (g, L, fit, X, Y, S, front, m) {
    const sus = czPart(fit.sus),
      tk = czPart(fit.tnk),
      ex = czPart(fit.exh),
      gb = czPart(fit.gbx),
      ar = czPart(fit.arm),
      bp = czPart(fit.bpl);
    // fuel tanks: cylinders on the chassis sides behind the cab, longer per level
    if (tk && m.id !== "rigger") {
      const len = 0.6 + tk.lv * 0.28,
        sides = tk.lv >= 3 ? [-1, 1] : [1];
      for (const s of sides) {
        const M = czMount(m),
          x = X(s * M.tankZ),
          y0 = Y(M.rail[0] + 0.05),
          gr = g.createLinearGradient(x - 0.2 * S, 0, x + 0.2 * S, 0);
        const c =
          tk.lv >= 4
            ? ["#8d959e", "#ffffff", "#a5adb6"]
            : tk.lv >= 2
              ? ["#7d858e", "#e6eaee", "#8e969f"]
              : ["#2b2f34", "#5a6068", "#24282d"];
        gr.addColorStop(0, c[0]);
        gr.addColorStop(0.45, c[1]);
        gr.addColorStop(1, c[2]);
        g.fillStyle = gr;
        rr(g, x - 0.2 * S, y0, 0.4 * S, len * S, 0.18 * S);
        g.fill();
        g.fillStyle = "rgba(0,0,0,0.5)";
        for (let k = 1; k <= 2; k++) g.fillRect(x - 0.2 * S, y0 + (len * S * k) / 3, 0.4 * S, 1.5);
        g.fillStyle = "#f5b82e";
        g.beginPath();
        g.arc(x, y0 + 0.12 * S, 0.06 * S, 0, 7);
        g.fill();
      }
    }
    // suspension: air tanks + bags (blue) between the rails, lowered shadow line
    if (sus) {
      if (sus.lv >= 2) {
        g.fillStyle = "#3d7fd9";
        for (const s of [-1, 1]) {
          g.beginPath();
          g.arc(X(s * 0.7), Y(0.75), 0.16 * S, 0, 7);
          g.fill();
          g.fillStyle = "#9cc6ff";
          g.beginPath();
          g.arc(X(s * 0.7) - 0.04 * S, Y(0.75) - 0.04 * S, 0.05 * S, 0, 7);
          g.fill();
          g.fillStyle = "#3d7fd9";
        }
        g.fillStyle = "#2f6dc0";
        rr(g, X(-0.35), Y(-2.25), 0.7 * S, 0.22 * S, 0.1 * S);
        g.fill();
      }
      g.fillStyle = sus.lv >= 4 ? "#e74c3c" : "#f5b82e";
      for (const s of [-1, 1])
        for (const yy of [-3.8, 0])
          g.fillRect(X(s * 0.78) - 0.05 * S, Y(yy) - 0.22 * S, 0.1 * S, 0.44 * S);
    }
    // gearbox: transmission cooler (finned) at the back of the chassis + shifter badge
    if (gb) {
      g.fillStyle = "#4b525a";
      rr(g, X(-0.45), Y(-0.95), 0.9 * S, 0.3 * S, 0.05 * S);
      g.fill();
      g.fillStyle = "#8e969f";
      for (let k = 0; k < 6 + gb.lv * 2; k++)
        g.fillRect(X(-0.42) + k * ((0.84 * S) / (6 + gb.lv * 2)), Y(-0.93), 1.2, 0.26 * S);
      g.fillStyle = ["#2ecc71", "#3498db", "#9b59b6", "#e74c3c"][gb.lv - 1];
      g.beginPath();
      g.arc(X(0), Y(-1.15), 0.1 * S, 0, 7);
      g.fill();
    }
    // armour: riveted plates on the cab corners + bash plate
    if (ar) {
      g.save();
      g.globalAlpha = 0.92;
      const pc = ar.lv >= 3 ? "#5d646c" : "#6d747c";
      g.fillStyle = pc;
      g.strokeStyle = "#2a2e33";
      g.lineWidth = 1.5;
      if (ar.lv >= 2) {
        rr(g, X(-1.15), Y(front - 0.28), 2.3 * S, 0.26 * S, 0.06 * S);
        g.fill();
        g.stroke();
      }
      if (ar.lv >= 3)
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(X(s * 1.32), Y(front + 0.05));
          g.lineTo(X(s * 1.32), Y(front + 1.1));
          g.lineTo(X(s * 1.05), Y(front + 1.1));
          g.lineTo(X(s * 1.05), Y(front + 0.05));
          g.closePath();
          g.fill();
          g.stroke();
        }
      if (ar.lv >= 4)
        for (const s of [-1, 1]) {
          rr(g, X(s * 1.32) - (s > 0 ? 0.14 * S : 0), Y(-2.4), 0.14 * S, 2.0 * S, 0.04 * S);
          g.fill();
          g.stroke();
        }
      g.fillStyle = "#c8cdd2";
      for (const s of [-1, 1])
        for (let k = 0; k < 3 + ar.lv; k++)
          g.fillRect(X(s * 1.0) - 1, Y(-2.45 + k * 0.3 * (ar.lv >= 4 ? 1 : 0.6)), 2.5, 2.5);
      g.strokeStyle = "#e0a800";
      g.lineWidth = 0.08 * S;
      g.strokeRect(X(-0.9), Y(-0.2), 1.8 * S, 0.15 * S);
      g.restore();
    }
    // bulletproof panels: olive-drab plates bolted over the cab sides (lv1), windscreen shutter (lv2), roof + tank plates (lv3)
    if (bp) {
      g.save();
      g.fillStyle = "#4a5536";
      g.strokeStyle = "#20261a";
      g.lineWidth = 1.5;
      const plate = (x, y, w, h) => {
        rr(g, X(x), Y(y), w * S, h * S, 0.05 * S);
        g.fill();
        g.stroke();
      };
      for (const s of [-1, 1]) plate(s > 0 ? 1.08 : -1.36, front + 0.35, 0.28, -2.6 - front - 0.35);
      if (bp.lv >= 2) {
        plate(-1.1, front + 0.05, 2.2, 0.32);
        g.fillStyle = "#111";
        g.fillRect(X(-0.75), Y(front + 0.17), 1.5 * S, 0.07 * S);
        g.fillStyle = "#4a5536";
      }
      if (bp.lv >= 3) {
        plate(-0.95, front + 0.55, 1.9, -2.5 - front - 0.75);
        for (const s of [-1, 1]) plate(s > 0 ? 0.95 : -1.3, -2.45, 0.35, 1.3);
      }
      g.fillStyle = "#c9c19a";
      for (const s of [-1, 1])
        for (let k = 0; k < 4 + bp.lv * 2; k++)
          g.fillRect(
            X(s > 0 ? 1.22 : -1.22) - 1,
            Y(front + 0.45 + (k * (-2.75 - front)) / (4 + bp.lv * 2)),
            2,
            2,
          );
      g.restore();
    }
    // exhaust: stacks behind the cab (style) / pipe diameter from the performance system
    const es = L.exs || (ex ? "chrome" : null);
    if (es) {
      const M = czMount(m),
        dia = 0.21 + (ex ? ex.lv * 0.04 : 0);
      const col = es === "black" ? ["#111", "#555"] : ["#8d959e", "#ffffff"];
      if (es === "side") {
        for (const s of [-1, 1]) {
          const pz = M.half - dia * 0.7,
            gr = g.createLinearGradient(X(s * pz) - dia * S, 0, X(s * pz) + dia * S, 0);
          gr.addColorStop(0, "#7d858e");
          gr.addColorStop(0.5, "#fff");
          gr.addColorStop(1, "#7d858e");
          g.fillStyle = gr;
          rr(g, X(s * pz) - dia * S * 0.7, Y(M.cabRear), dia * 1.4 * S, 1.6 * S, dia * 0.7 * S);
          g.fill();
          g.fillStyle = "#111";
          g.beginPath();
          g.arc(X(s * pz), Y(M.cabRear + 1.45), dia * 0.5 * S, 0, 7);
          g.fill();
        }
      } else
        for (const s of [-1, 1]) {
          const r = dia * S * (es === "tall" ? 1.15 : 1),
            cx = X(s * Math.min(M.stackZ, M.half - r / S - 0.02)),
            cy = Y(Math.max(M.stackY, M.cabRear + r / S + 0.04));
          const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
          gr.addColorStop(0, col[1]);
          gr.addColorStop(1, col[0]);
          g.fillStyle = gr;
          g.beginPath();
          g.arc(cx, cy, r, 0, 7);
          g.fill();
          g.fillStyle = "#050505";
          g.beginPath();
          g.arc(cx, cy, r * 0.55, 0, 7);
          g.fill();
          if (es === "tall") {
            g.strokeStyle = "#fff";
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(cx, cy, r * 0.8, -2.4, -0.6);
            g.stroke();
          }
          if (es === "flame") {
            g.fillStyle = "#ff7b00";
            g.beginPath();
            g.arc(cx, cy, r * 0.4, 0, 7);
            g.fill();
            g.fillStyle = "#ffe066";
            g.beginPath();
            g.arc(cx, cy, r * 0.2, 0, 7);
            g.fill();
          }
        }
    }
    dp0(g, L, fit, X, Y, S, front, m);
  };
}
// ---- side profile additions
{
  const sd0 = czSide;
  czSide = function (g, cx, cy, sc, m, col, fit) {
    const X = (v) => cx + v * sc,
      Y = (v) => cy - v * sc,
      L = czLook(m.id, fit),
      M = czMount(m),
      roofH = M.roof;
    const sus = czPart(fit.sus),
      tk = czPart(fit.tnk),
      ex = czPart(fit.exh),
      ar = czPart(fit.arm),
      bp = czPart(fit.bpl);
    const low = sus && sus.lv >= 2 ? 0.08 * sus.lv : 0;
    if (low) {
      g.save();
      g.translate(0, low * sc);
    }
    sd0(g, cx, cy, sc, m, col, fit);
    if (tk && m.id !== "rigger") {
      const len = 0.6 + tk.lv * 0.28,
        gr = g.createLinearGradient(0, Y(1.3), 0, Y(0.7));
      gr.addColorStop(0, "#fff");
      gr.addColorStop(1, tk.lv >= 2 ? "#8e969f" : "#2b2f34");
      g.fillStyle = gr;
      rr(g, X(M.rail[0] + 0.05), Y(1.3), len * sc, 0.62 * sc, 0.25 * sc);
      g.fill();
    }
    const es = m.id === "rigger" ? null : L.exs || (ex ? "chrome" : null);
    if (es && es !== "side") {
      const h = es === "tall" ? roofH + 1.0 : roofH + 0.6,
        w = (0.18 + (ex ? ex.lv * 0.035 : 0)) * sc;
      const sx = M.stackX,
        gr = g.createLinearGradient(X(sx), 0, X(sx) + w, 0);
      gr.addColorStop(0, es === "black" ? "#111" : "#9aa2ab");
      gr.addColorStop(0.5, es === "black" ? "#555" : "#fff");
      gr.addColorStop(1, es === "black" ? "#111" : "#7d858e");
      g.fillStyle = gr;
      g.fillRect(X(sx), Y(h), w, (h - 1.1) * sc);
      if (es === "flame") {
        g.fillStyle = "#ff7b00";
        g.beginPath();
        g.moveTo(X(sx), Y(h));
        g.quadraticCurveTo(X(sx + 0.1), Y(h + 0.7), X(sx + 0.3), Y(h + 0.9));
        g.quadraticCurveTo(X(sx + 0.15), Y(h + 0.3), X(sx) + w, Y(h));
        g.fill();
      }
    }
    if (es === "side") {
      g.fillStyle = "#e6eaee";
      rr(g, X(M.rail[0]), Y(0.72), 1.6 * sc, 0.22 * sc, 0.1 * sc);
      g.fill();
    }
    if (ar) {
      g.fillStyle = "rgba(93,100,108,0.95)";
      if (ar.lv >= 2) g.fillRect(X(-5.15), Y(1.25), 0.3 * sc, 0.6 * sc);
      if (ar.lv >= 3) g.fillRect(X(-5.0), Y(2.2), 1.0 * sc, 0.18 * sc);
      if (ar.lv >= 4) g.fillRect(X(-2.4), Y(1.0), 2.0 * sc, 0.35 * sc);
      g.fillStyle = "#c8cdd2";
      for (let k = 0; k < ar.lv * 3; k++) g.fillRect(X(-5 + k * 0.3), Y(1.2), 2, 2);
    }
    if (bp) {
      g.fillStyle = "rgba(74,85,54,0.96)";
      g.fillRect(X(-4.9), Y(2.3), 1.9 * sc, 1.0 * sc);
      if (bp.lv >= 2) g.fillRect(X(-5.25), Y(2.6), 0.3 * sc, 0.75 * sc);
      if (bp.lv >= 3) g.fillRect(X(-5.0), Y(roofH + 0.1), 2.6 * sc, 0.2 * sc);
      g.fillStyle = "#c9c19a";
      for (let k = 0; k < 4 + bp.lv * 2; k++) g.fillRect(X(-4.8 + k * 0.28), Y(2.2), 2, 2);
    }
    if (sus && sus.lv >= 2) {
      g.fillStyle = "#3d7fd9";
      for (const ax of [-3.8, 0]) g.fillRect(X(ax + 0.55), Y(1.15), 0.18 * sc, 0.3 * sc);
    }
    if (low) g.restore();
  };
}
// ---- card icons
function czIcon2(g, p, W, H, cx, cy, s, lv) {
  const sl = p.slot;
  if (sl === "gbx") {
    g.fillStyle = "#6b737c";
    rr(g, cx - 34 * s, cy - 18 * s, 56 * s, 36 * s, 8 * s);
    g.fill();
    g.fillStyle = "#8e969f";
    for (let k = 0; k < 5; k++) g.fillRect(cx - 30 * s + k * 10 * s, cy - 14 * s, 5 * s, 28 * s);
    g.strokeStyle = "#ddd";
    g.lineWidth = 4 * s;
    g.beginPath();
    g.moveTo(cx + 30 * s, cy + 20 * s);
    g.lineTo(cx + 30 * s, cy - 14 * s);
    g.stroke();
    g.fillStyle = ["#2ecc71", "#3498db", "#9b59b6", "#e74c3c"][lv - 1];
    g.beginPath();
    g.arc(cx + 30 * s, cy - 20 * s, 8 * s, 0, 7);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold " + Math.round(9 * s) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(["QS", "14", "AMT", "DOG"][lv - 1], cx + 30 * s, cy - 20 * s);
    return;
  }
  if (sl === "sus") {
    for (const x of [-18, 18]) {
      if (lv >= 2) {
        g.fillStyle = "#3d7fd9";
        rr(g, cx + (x - 11) * s, cy - 16 * s, 22 * s, 26 * s, 10 * s);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.35)";
        g.fillRect(cx + (x - 7) * s, cy - 12 * s, 4 * s, 18 * s);
      } else {
        g.strokeStyle = "#f5b82e";
        g.lineWidth = 4 * s;
        g.beginPath();
        for (let k = 0; k <= 8; k++)
          g.lineTo(cx + (x + (k % 2 ? -9 : 9)) * s, cy - 18 * s + k * 4.5 * s);
        g.stroke();
      }
      g.fillStyle = "#4b525a";
      g.fillRect(cx + (x - 13) * s, cy + 12 * s, 26 * s, 6 * s);
      g.fillRect(cx + (x - 13) * s, cy - 22 * s, 26 * s, 6 * s);
    }
    if (lv >= 4) {
      g.strokeStyle = "#e74c3c";
      g.lineWidth = 3 * s;
      g.beginPath();
      g.moveTo(cx - 40 * s, cy + 24 * s);
      g.lineTo(cx + 40 * s, cy + 24 * s);
      g.stroke();
    }
    return;
  }
  if (sl === "tnk") {
    const len = 30 + lv * 12;
    const gr = g.createLinearGradient(0, cy - 16 * s, 0, cy + 16 * s);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(0.4, lv >= 2 ? "#c9ced4" : "#555");
    gr.addColorStop(1, lv >= 2 ? "#6f7780" : "#222");
    g.fillStyle = gr;
    rr(g, cx - (len / 2) * s, cy - 16 * s, len * s, 32 * s, 15 * s);
    g.fill();
    g.fillStyle = "rgba(0,0,0,.4)";
    g.fillRect(cx - (len / 6) * s, cy - 16 * s, 2 * s, 32 * s);
    g.fillRect(cx + (len / 6) * s, cy - 16 * s, 2 * s, 32 * s);
    g.fillStyle = "#f5b82e";
    g.beginPath();
    g.arc(cx - (len / 2) * s + 10 * s, cy - 16 * s, 5 * s, 0, 7);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold " + Math.round(11 * s) + "px Arial";
    g.textAlign = "center";
    g.fillText("+" + p.fx.tank + " L", cx, cy + 30 * s);
    return;
  }
  if (sl === "exh" || sl === "exs") {
    const es = sl === "exs" ? p.look.exs : "chrome",
      w = (sl === "exh" ? 10 + lv * 4 : 12) * s;
    const n = es === "side" ? 1 : 2;
    if (es === "side") {
      const gr = g.createLinearGradient(0, cy - 8 * s, 0, cy + 8 * s);
      gr.addColorStop(0, "#fff");
      gr.addColorStop(1, "#7d858e");
      g.fillStyle = gr;
      rr(g, cx - 38 * s, cy - 7 * s, 76 * s, 14 * s, 7 * s);
      g.fill();
      return;
    }
    for (const x of [-14, 14]) {
      const h = es === "tall" ? 52 : 44,
        gr = g.createLinearGradient(cx + x * s - w / 2, 0, cx + x * s + w / 2, 0);
      gr.addColorStop(0, es === "black" ? "#111" : "#7d858e");
      gr.addColorStop(0.5, es === "black" ? "#666" : "#fff");
      gr.addColorStop(1, es === "black" ? "#111" : "#7d858e");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(cx + x * s - w / 2, cy + 26 * s);
      g.lineTo(cx + x * s - w / 2, cy + (26 - h) * s + (es === "tall" ? 6 * s : 0));
      g.lineTo(cx + x * s + w / 2, cy + (26 - h) * s);
      g.lineTo(cx + x * s + w / 2, cy + 26 * s);
      g.fill();
      if (es === "flame") {
        g.fillStyle = "#ff7b00";
        g.beginPath();
        g.moveTo(cx + x * s - w / 2, cy + (26 - h) * s);
        g.quadraticCurveTo(cx + x * s, cy + (10 - h) * s, cx + x * s + w, cy + (4 - h) * s);
        g.lineTo(cx + x * s + w / 2, cy + (26 - h) * s);
        g.fill();
      }
    }
    if (sl === "exh") {
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.lineWidth = 2 * s;
      for (let k = 0; k < lv; k++) {
        g.beginPath();
        g.arc(cx + 30 * s, cy - 20 * s, (5 + k * 6) * s, -0.8, 0.8);
        g.stroke();
      }
    }
    return;
  }
  if (sl === "arm") {
    g.fillStyle = "#5d646c";
    g.beginPath();
    g.moveTo(cx, cy - 28 * s);
    g.lineTo(cx + 26 * s, cy - 18 * s);
    g.lineTo(cx + 22 * s, cy + 10 * s);
    g.lineTo(cx, cy + 28 * s);
    g.lineTo(cx - 22 * s, cy + 10 * s);
    g.lineTo(cx - 26 * s, cy - 18 * s);
    g.closePath();
    g.fill();
    g.strokeStyle = "#2a2e33";
    g.lineWidth = 2 * s;
    g.stroke();
    g.fillStyle = "#c8cdd2";
    for (let k = 0; k < lv * 2 + 2; k++) {
      const a = (k / (lv * 2 + 2)) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 17 * s, cy + Math.sin(a) * 17 * s, 2 * s, 0, 7);
      g.fill();
    }
    g.fillStyle = "#f5b82e";
    g.font = "bold " + Math.round(14 * s) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("L" + lv, cx, cy);
    return;
  }
  if (sl === "bpl") {
    g.fillStyle = "#4a5536";
    rr(g, cx - 26 * s, cy - 24 * s, 52 * s, 48 * s, 6 * s);
    g.fill();
    g.strokeStyle = "#20261a";
    g.lineWidth = 2 * s;
    g.stroke();
    g.fillStyle = "#c9c19a";
    for (const [x, y] of [
      [-20, -18],
      [20, -18],
      [-20, 18],
      [20, 18],
    ])
      g.fillRect(cx + x * s - 2 * s, cy + y * s - 2 * s, 4 * s, 4 * s);
    g.fillStyle = "#1a1a1a";
    for (let k = 0; k < lv + 1; k++) {
      g.beginPath();
      g.arc(cx - 10 * s + k * 9 * s, cy - 4 * s + (k % 2) * 9 * s, 3 * s, 0, 7);
      g.fill();
    }
    g.fillStyle = "#f5b82e";
    g.font = "bold " + Math.round(12 * s) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("B" + lv, cx, cy + 14 * s);
    return;
  }
}
