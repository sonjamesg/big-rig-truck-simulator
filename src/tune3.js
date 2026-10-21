/**
 * @file tune3.js — truck customiser stage 3: bumpers, lights, horns, cab extras, decals + company livery, MP sync
 * Exposes (globals): CZ_HORNS, czYardBrand, czDriver, czHornPreview, czStar, czLightsPreview,
 *   czLightsSide, czTruckGlow, czCosStr, mpCosmetic, czRemoteArt
 * Depends on: world.js, render.js, lorry.js, physics.js, audio.js, career.js, ui.js,
 *   indicators.js, beams.js, owndepot.js, tune.js, tune2.js, daynight.js, main.js
 * Load order: #33 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== cz stage 3: bumpers, lights, horns, cab extras, decals + company livery, truck art overhaul, MP sync =====================
CZ_TABS.push(
  { id: "bumpers", n: "Bumpers", ic: "\u{1F6E1}\uFE0F", slots: ["bmp"] },
  { id: "lights", n: "Lights", ic: "\u{1F4A1}", slots: ["bem", "rbar", "led", "bcn"] },
  { id: "horns", n: "Horns", ic: "\u{1F4EF}", slots: ["hrn"] },
  { id: "extras", n: "Cab extras", ic: "\u2728", slots: ["vis", "spl", "mud", "skt", "plt"] },
);
CZ_TABS.find((t) => t.id === "paint").slots.push("dec", "liv");
CZ_TABS.find((t) => t.id === "paint").n = "Paint & livery";
Object.assign(CZ_SLOTS, {
  bmp: "Bumper / bull bar",
  bem: "Headlights",
  rbar: "Roof light bar",
  led: "Side LEDs",
  bcn: "Beacons",
  hrn: "Horn",
  vis: "Sun visor",
  spl: "Roof spoiler",
  mud: "Mud flaps",
  skt: "Side skirts",
  plt: "Window name plate",
  dec: "Decals",
  liv: "Company livery",
});
CZ_PARTS.push(
  { id: "bmp1", slot: "bmp", n: "Chrome bumper", p: 700, req: 1, look: { bmp: 1 } },
  {
    id: "bmp2",
    slot: "bmp",
    n: "Steel bull bar",
    lv: 2,
    p: 1600,
    req: 2,
    fx: { dur: 0.95 },
    look: { bmp: 2 },
    d: "Tubular bar soaks up knocks",
  },
  {
    id: "bmp3",
    slot: "bmp",
    n: "Roo bar + spot lamps",
    lv: 3,
    p: 3000,
    req: 4,
    fx: { dur: 0.9, beam: 1.1 },
    look: { bmp: 3 },
  },
  {
    id: "bmp4",
    slot: "bmp",
    n: "Heavy push bar",
    lv: 4,
    p: 5500,
    req: 7,
    fx: { dur: 0.85, econ: 1.02 },
    look: { bmp: 4 },
  },
  {
    id: "bem1",
    slot: "bem",
    n: "LED headlights",
    lv: 1,
    p: 800,
    req: 1,
    fx: { beam: 1.2 },
    look: { bem: 1 },
  },
  {
    id: "bem2",
    slot: "bem",
    n: "Xenon projectors",
    lv: 2,
    p: 2000,
    req: 3,
    fx: { beam: 1.4 },
    look: { bem: 2 },
  },
  {
    id: "bem3",
    slot: "bem",
    n: "Laser high-beam",
    lv: 3,
    p: 4500,
    req: 6,
    fx: { beam: 1.7 },
    look: { bem: 3 },
  },
  {
    id: "rbar1",
    slot: "rbar",
    n: "4-lamp roof bar",
    p: 900,
    req: 1,
    fx: { beam: 1.05 },
    look: { rbar: 1 },
  },
  {
    id: "rbar2",
    slot: "rbar",
    n: "6-lamp chrome bar",
    p: 1800,
    req: 2,
    fx: { beam: 1.08 },
    look: { rbar: 2 },
  },
  {
    id: "rbar3",
    slot: "rbar",
    n: "LED light bar",
    p: 3200,
    req: 4,
    fx: { beam: 1.12 },
    look: { rbar: 3 },
  },
  { id: "led1", slot: "led", n: "Amber side markers", p: 500, req: 1, look: { led: "#ffab2e" } },
  { id: "led2", slot: "led", n: "Ice-blue LED strip", p: 900, req: 1, look: { led: "#52c8ff" } },
  { id: "led3", slot: "led", n: "Purple underglow", p: 1600, req: 3, look: { led: "#c06bff" } },
  { id: "bcn1", slot: "bcn", n: "Amber beacons", p: 600, req: 1, look: { bcn: 1 } },
  { id: "bcn2", slot: "bcn", n: "Twin LED beacons", p: 1200, req: 2, look: { bcn: 2 } },
  { id: "bcn3", slot: "bcn", n: "Full beacon bar", p: 2400, req: 4, look: { bcn: 3 } },
  { id: "hrn1", slot: "hrn", n: "Euro twin-tone", p: 500, req: 1, look: { hrn: 1 } },
  { id: "hrn2", slot: "hrn", n: "Deep air horn", p: 1200, req: 2, look: { hrn: 2 } },
  { id: "hrn3", slot: "hrn", n: "Musical chime", p: 2000, req: 3, look: { hrn: 3 } },
  { id: "hrn4", slot: "hrn", n: "Train horn", p: 4000, req: 6, look: { hrn: 4 } },
  { id: "vis1", slot: "vis", n: "Sun visor", p: 600, req: 1, look: { vis: 1 } },
  { id: "vis2", slot: "vis", n: "Chrome visor", p: 1100, req: 2, look: { vis: 2 } },
  {
    id: "spl1",
    slot: "spl",
    n: "Roof spoiler",
    lv: 1,
    p: 1400,
    req: 1,
    fx: { econ: 0.97 },
    look: { spl: 1 },
    d: "Smooths the airflow: small fuel saving",
  },
  {
    id: "spl2",
    slot: "spl",
    n: "Full aero kit",
    lv: 2,
    p: 3800,
    req: 4,
    fx: { econ: 0.94 },
    look: { spl: 2 },
  },
  { id: "mud1", slot: "mud", n: "Rubber mud flaps", p: 500, req: 1, look: { mud: 1 } },
  { id: "mud2", slot: "mud", n: "Chrome-weight flaps", p: 900, req: 2, look: { mud: 2 } },
  {
    id: "skt1",
    slot: "skt",
    n: "Side skirts",
    lv: 1,
    p: 1300,
    req: 1,
    fx: { econ: 0.98 },
    look: { skt: 1 },
  },
  {
    id: "skt2",
    slot: "skt",
    n: "Chrome-trim skirts",
    lv: 2,
    p: 2600,
    req: 3,
    fx: { econ: 0.97 },
    look: { skt: 2 },
  },
  { id: "plt1", slot: "plt", n: "Name plate", p: 500, req: 1, look: { plt: 1 } },
  { id: "plt2", slot: "plt", n: "Illuminated plate", p: 1000, req: 2, look: { plt: 2 } },
  { id: "dec1", slot: "dec", n: "Lightning bolt", p: 600, req: 1, look: { dec: "bolt" } },
  { id: "dec2", slot: "dec", n: "Race number", p: 700, req: 1, look: { dec: "num" } },
  { id: "dec3", slot: "dec", n: "Eagle wings", p: 1200, req: 2, look: { dec: "wings" } },
  { id: "dec4", slot: "dec", n: "Starfield", p: 1500, req: 3, look: { dec: "stars" } },
  { id: "liv1", slot: "liv", n: "Company livery", p: 2000, req: 1, needYard: 1, look: { liv: 1 } },
);
const CZ_HORNS = {
  0: [175, 176.3, 220.5, 222, 350, 441], // stock dual-trumpet air horn (F3 + A3, major third)
  1: [330, 331.5, 415, 417, 660, 830],
  2: [98, 99.5, 123, 124.6, 196, 247],
  3: [277, 330, 370, 440, 554, 660],
  4: [155.6, 185, 233, 311, 370, 466],
};
function czYardBrand() {
  if (typeof ownYards !== "function") return null;
  const y = ownYards().find((v) => ownedYard(v));
  return y ? ydBrand(y) : null;
}
function czDriver() {
  try {
    return (localStorage.getItem("bigrig.name") || "DRIVER").toUpperCase().slice(0, 12);
  } catch (e) {
    return "DRIVER";
  }
}
{
  const lk0 = czLook;
  czLook = function (mid, fit) {
    const L = lk0(mid, fit);
    if (L.liv) {
      const B = fit._livB || czYardBrand();
      if (B) {
        L.col = B.col;
        L.livB = B;
      } else delete L.liv;
    }
    return L;
  };
}
{
  const ap0 = czApply;
  czApply = function () {
    ap0();
    const L = czLook(career.cur, czFitted(career.cur));
    truck.hornP = L.hrn || 0;
    truck.czL = L;
  };
}
// lock: company livery needs an owned yard
{
  const ft0 = czFooter;
  czFooter = function (b, m, lvl) {
    ft0(b, m, lvl);
    const p = CZ.sel;
    if (p && p.needYard && !czOwned(m.id, p) && !czYardBrand()) {
      const bt = b.querySelector("#czAct");
      bt.textContent = "\u{1F512} OWN A YARD";
      bt.disabled = true;
      bt.className = "btn";
      b.querySelector("#czMsg").textContent = "Buy a haulage yard to paint your company colours";
    }
  };
}
{
  const ac0 = czAction;
  czAction = function () {
    const p = CZ.sel;
    if (p && p.needYard && !czYardBrand()) return;
    ac0();
  };
}
// horn preview + lights preview toggle on card tap
{
  const rd0 = czRender;
  czRender = function () {
    rd0();
    const b = uiRoot.querySelector(".mback");
    if (!b) return;
    b.querySelectorAll(".czg .card").forEach((el) => {
      const p = czPart(el.dataset.p);
      if (p && p.slot === "hrn") el.addEventListener("click", () => czHornPreview(p.look.hrn));
      else if (el.dataset.p === "hrn_0") el.addEventListener("click", () => czHornPreview(0));
    });
    b.querySelectorAll(".czg .card.lock").forEach((el) =>
      el.classList.toggle(
        "lock",
        !(czPart(el.dataset.p) || {}).needYard && el.classList.contains("lock"),
      ),
    );
  };
}
function czHornPreview(k) {
  if (typeof audio === "undefined" || !audio.hornOsc) return;
  audio.hornP = -1;
  audio.hornPrev = k;
  audio.hornUntil = performance.now() + 900;
}
// ---- top-down parts
function czStar(g, x, y, r, c) {
  g.fillStyle = c;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2,
      q = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
  g.fill();
}
{
  const dp0 = czDrawParts;
  czDrawParts = function (g, L, fit, X, Y, S, front, m) {
    dp0(g, L, fit, X, Y, S, front, m);
    const st = m.style || {},
      cab0 = -5.0,
      cab1 = st.roof === "high" ? -2.25 : -2.55,
      chrome = (x0, y0, w, h, r) => {
        const gr = g.createLinearGradient(0, y0, 0, y0 + h);
        gr.addColorStop(0, "#ffffff");
        gr.addColorStop(0.5, "#9aa2ab");
        gr.addColorStop(1, "#e6eaee");
        g.fillStyle = gr;
        rr(g, x0, y0, w, h, r || 2);
        g.fill();
      };
    // side skirts + mud flaps (under everything else)
    if (L.skt) {
      const c = shade(L.col || career.colors[m.id] || m.cols[0], 0.85);
      for (const s of [-1, 1]) {
        g.fillStyle = c;
        rr(g, X(s > 0 ? 1.08 : -1.3), Y(-3.2), 0.22 * S, 2.55 * S, 0.06 * S);
        g.fill();
        if (L.skt > 1) {
          g.fillStyle = "#eef2f5";
          g.fillRect(X(s > 0 ? 1.27 : -1.3), Y(-3.2), 0.04 * S, 2.55 * S);
        }
      }
    }
    if (L.mud) {
      for (const s of [-1, 1]) {
        g.fillStyle = "#111";
        g.fillRect(X(s > 0 ? 0.72 : -1.24), Y(0.62), 0.52 * S, 0.14 * S);
        if (L.mud > 1) {
          g.fillStyle = "#e6eaee";
          g.fillRect(X(s > 0 ? 0.72 : -1.24), Y(0.72), 0.52 * S, 0.05 * S);
        }
      }
    }
    if (L.led) {
      g.save();
      g.shadowColor = L.led;
      g.shadowBlur = 0.25 * S;
      g.fillStyle = L.led;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 7; k++) g.fillRect(X(s * 1.31) - 1.5, Y(-4.7 + k * 0.8), 3, 0.3 * S);
      }
      g.restore();
    }
    // bumper / bull bar at the very front
    const fy = front;
    if (L.bmp) {
      if (L.bmp === 1) chrome(X(-1.3), Y(fy - 0.3), 2.6 * S, 0.32 * S, 4);
      else if (L.bmp === 2) {
        g.strokeStyle = "#e3e7eb";
        g.lineWidth = 0.15 * S;
        g.beginPath();
        g.moveTo(X(-1.2), Y(fy + 0.05));
        g.lineTo(X(-1.15), Y(fy - 0.32));
        g.lineTo(X(1.15), Y(fy - 0.32));
        g.lineTo(X(1.2), Y(fy + 0.05));
        g.stroke();
        g.beginPath();
        for (const x of [-0.5, 0, 0.5]) {
          g.moveTo(X(x), Y(fy));
          g.lineTo(X(x), Y(fy - 0.32));
        }
        g.stroke();
      } else if (L.bmp === 3) {
        g.strokeStyle = "#eef1f4";
        g.lineWidth = 0.16 * S;
        g.beginPath();
        g.moveTo(X(-1.3), Y(fy + 0.1));
        g.quadraticCurveTo(X(-1.3), Y(fy - 0.5), X(0), Y(fy - 0.5));
        g.quadraticCurveTo(X(1.3), Y(fy - 0.5), X(1.3), Y(fy + 0.1));
        g.stroke();
        for (const x of [-0.7, -0.25, 0.25, 0.7]) {
          g.fillStyle = "#fff6c8";
          g.beginPath();
          g.arc(X(x), Y(fy - 0.42), 0.15 * S, 0, 7);
          g.fill();
          g.strokeStyle = "#666";
          g.lineWidth = 1.5;
          g.stroke();
        }
      } else {
        g.fillStyle = "#2b2e33";
        rr(g, X(-1.4), Y(fy - 0.55), 2.8 * S, 0.52 * S, 0.08 * S);
        g.fill();
        g.fillStyle = "#f5b82e";
        for (let k = 0; k < 9; k++) g.fillRect(X(-1.3 + k * 0.3), Y(fy - 0.4), 0.12 * S, 0.34 * S);
        g.fillStyle = "#ccc";
        for (let k = 0; k < 6; k++) g.fillRect(X(-1.1 + k * 0.44), Y(fy - 0.1), 2, 2);
      }
    }
    // headlights at the front corners
    if (L.bem) {
      for (const s of [-1, 1]) {
        g.fillStyle = L.bem >= 3 ? "#bfe6ff" : L.bem >= 2 ? "#e8f4ff" : "#ffffff";
        rr(g, X(s * 0.95) - 0.18 * S, Y(fy - 0.04), 0.36 * S, 0.1 * S, 2);
        g.fill();
        g.fillStyle = L.bem >= 3 ? "#3aa6ff" : "#9fd8ff";
        g.fillRect(X(s * 0.95) - 0.18 * S, Y(fy + 0.05), 0.36 * S, 0.03 * S);
      }
    }
    // visor
    if (L.vis) {
      if (L.vis > 1) chrome(X(-1.3), Y(cab0 - 0.05), 2.6 * S, 0.2 * S, 3);
      else {
        g.fillStyle = "rgba(15,15,15,0.9)";
        rr(g, X(-1.3), Y(cab0 - 0.05), 2.6 * S, 0.2 * S, 3);
        g.fill();
      }
    }
    // name plate in the windscreen
    if (L.plt) {
      const t = czDriver();
      g.fillStyle = L.plt > 1 ? "#0b2a4a" : "#111";
      rr(g, X(-0.62), Y(cab0 + 0.07), 1.24 * S, 0.2 * S, 3);
      g.fill();
      g.fillStyle = L.plt > 1 ? "#7fe3ff" : "#f5f5f5";
      g.font = "bold " + Math.round(0.15 * S) + "px Arial";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(t, X(0), Y(cab0 + 0.17));
    }
    // roof spoiler / aero kit
    if (L.spl) {
      const c = L.col || career.colors[m.id] || m.cols[0],
        gr = g.createLinearGradient(0, Y(cab0 + 0.5), 0, Y(cab0 + 1.9));
      gr.addColorStop(0, shade(c, 1.4));
      gr.addColorStop(1, shade(c, 0.9));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(X(-0.95), Y(cab0 + 1.9));
      g.quadraticCurveTo(X(-1.0), Y(cab0 + 0.5), X(0), Y(cab0 + 0.45));
      g.quadraticCurveTo(X(1.0), Y(cab0 + 0.5), X(0.95), Y(cab0 + 1.9));
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      g.stroke();
      if (L.spl > 1) {
        for (const s of [-1, 1]) {
          g.fillStyle = shade(c, 0.8);
          g.beginPath();
          g.moveTo(X(s * 1.25), Y(cab1));
          g.lineTo(X(s * 1.42), Y(cab1 + 0.4));
          g.lineTo(X(s * 1.42), Y(cab1 + 1.5));
          g.lineTo(X(s * 1.25), Y(cab1 + 1.6));
          g.fill();
        }
      }
    }
    // decals on the roof
    if (L.dec) {
      const yc = (cab0 + cab1) / 2 + 0.35;
      g.save();
      if (L.dec === "bolt") {
        g.fillStyle = "#ffe14d";
        g.strokeStyle = "#111";
        g.lineWidth = 2;
        g.beginPath();
        for (const [a, b] of [
          [0.25, -0.9],
          [-0.35, 0.05],
          [0.05, 0.05],
          [-0.25, 0.9],
          [0.4, -0.15],
          [0, -0.15],
        ])
          g.lineTo(X(a), Y(yc + b));
        g.closePath();
        g.fill();
        g.stroke();
      } else if (L.dec === "num") {
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(X(0), Y(yc), 0.48 * S, 0, 7);
        g.fill();
        g.strokeStyle = "#111";
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = "#111";
        g.font = "900 " + Math.round(0.5 * S) + "px Arial Black,Arial";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("88", X(0), Y(yc) + 1);
      } else if (L.dec === "wings") {
        g.fillStyle = "#f5f5f5";
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(X(0), Y(yc));
          for (let k = 0; k < 5; k++) {
            g.lineTo(X(s * (0.25 + k * 0.2)), Y(yc - 0.5 + k * 0.05));
            g.lineTo(X(s * (0.3 + k * 0.2)), Y(yc + 0.1 + k * 0.08));
          }
          g.lineTo(X(s * 0.15), Y(yc + 0.35));
          g.closePath();
          g.fill();
        }
        g.fillStyle = "#f5b82e";
        g.beginPath();
        g.arc(X(0), Y(yc), 0.16 * S, 0, 7);
        g.fill();
      } else if (L.dec === "stars") {
        for (let k = 0; k < 7; k++)
          czStar(
            g,
            X(-0.8 + rlh(k * 3) * 1.6),
            Y(yc - 0.8 + rlh(k * 5 + 1) * 1.6),
            (0.1 + rlh(k) * 0.12) * S,
            k % 2 ? "#fff" : "#ffe14d",
          );
      }
      g.restore();
    }
    // company livery: accent band + monogram
    if (L.livB) {
      const B = L.livB;
      g.fillStyle = B.acc;
      g.fillRect(X(-1.25), Y(cab1 - 0.45), 2.5 * S, 0.2 * S);
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.font = "900 " + Math.round(0.62 * S) + "px Arial Black,Arial";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(B.mono, X(0), Y((cab0 + cab1) / 2 + 0.25));
    }
    // roof light bar (front edge of the roof) + beacons (rear corners)
    if (L.rbar) {
      const n = L.rbar === 1 ? 4 : 6;
      if (L.rbar === 3) {
        chrome(X(-1.1), Y(cab0 + 0.28), 2.2 * S, 0.28 * S, 4);
        g.fillStyle = "#f4fbff";
        g.fillRect(X(-1.02), Y(cab0 + 0.33), 2.04 * S, 0.17 * S);
      } else {
        g.fillStyle = "#2b2e33";
        g.fillRect(X(-1.0), Y(cab0 + 0.38), 2.0 * S, 0.06 * S);
        for (let k = 0; k < n; k++) {
          const x = -0.85 + (k * 1.7) / (n - 1);
          g.fillStyle = L.rbar > 1 ? "#e6eaee" : "#555";
          g.beginPath();
          g.arc(X(x), Y(cab0 + 0.4), 0.19 * S, 0, 7);
          g.fill();
          g.fillStyle = "#fff6c8";
          g.beginPath();
          g.arc(X(x), Y(cab0 + 0.4), 0.12 * S, 0, 7);
          g.fill();
        }
      }
    }
    if (L.bcn) {
      const pts = L.bcn === 3 ? [] : L.bcn === 2 ? [-0.85, 0.85] : [0.85];
      g.fillStyle = "#222";
      if (L.bcn === 3) {
        rr(g, X(-0.9), Y(cab1 - 0.32), 1.8 * S, 0.2 * S, 4);
        g.fill();
        for (let k = 0; k < 6; k++) {
          g.fillStyle = k % 2 ? "#ff9a1a" : "#ffcf4a";
          g.fillRect(X(-0.85 + k * 0.29), Y(cab1 - 0.3), 0.24 * S, 0.16 * S);
        }
      }
      for (const x of pts) {
        const gr = g.createRadialGradient(
          X(x) - 2,
          Y(cab1 - 0.25) - 2,
          1,
          X(x),
          Y(cab1 - 0.25),
          0.16 * S,
        );
        gr.addColorStop(0, "#fff2b0");
        gr.addColorStop(1, L.bcn === 2 ? "#ff8a00" : "#e67e22");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(X(x), Y(cab1 - 0.25), 0.23 * S, 0, 7);
        g.fill();
      }
    }
    // chrome glints: small bright sparkles so fitted chrome reads at normal zoom
    const gl = (x, y, r) => {
      g.save();
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2,
          q = i % 2 ? r * 0.25 : r;
        g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
      }
      g.closePath();
      g.fill();
      g.restore();
    };
    if (L.bmp && L.bmp < 4) gl(X(0.7), Y(fy - 0.2), 0.22 * S);
    if (L.vis === 2) gl(X(-0.6), Y(cab0 + 0.05), 0.2 * S);
    if (L.rbar > 1) gl(X(0.5), Y(cab0 + 0.4), 0.2 * S);
    if (L.exs && L.exs !== "black") gl(X(1.02), Y(-2.55), 0.2 * S);
    if (L.fin === "chrome") gl(X(-0.5), Y(-4.2), 0.3 * S);
  };
}
// ---- side profile
{
  const sd0 = czSide;
  czSide = function (g, cx, cy, sc, m, col, fit) {
    sd0(g, cx, cy, sc, m, col, fit);
    const X = (v) => cx + v * sc,
      Y = (v) => cy - v * sc,
      L = czLook(m.id, fit),
      st = m.style || {},
      roofH = st.roof === "high" ? 3.9 : st.roof === "aero" ? 3.6 : 3.2,
      nose = st.nose || 0,
      cf = -5.0 - nose;
    col = L.col || col;
    if (L.skt) {
      g.fillStyle = shade(col, 0.85);
      g.fillRect(X(-3.2), Y(1.15), 2.6 * sc, 0.55 * sc);
      if (L.skt > 1) {
        g.fillStyle = "#eef2f5";
        g.fillRect(X(-3.2), Y(0.66), 2.6 * sc, 0.06 * sc);
      }
    }
    if (L.mud) {
      g.fillStyle = "#111";
      g.fillRect(X(0.6), Y(1.0), 0.1 * sc, 0.75 * sc);
      if (L.mud > 1) {
        g.fillStyle = "#e6eaee";
        g.fillRect(X(0.6), Y(0.33), 0.1 * sc, 0.08 * sc);
      }
    }
    if (L.bmp) {
      g.fillStyle = L.bmp === 4 ? "#2b2e33" : "#dfe3e7";
      if (L.bmp === 1) g.fillRect(X(cf - 0.15), Y(1.35), 0.2 * sc, 0.4 * sc);
      else {
        g.fillRect(
          X(cf - 0.35),
          Y(L.bmp === 4 ? 1.5 : 1.9),
          0.12 * sc,
          (L.bmp === 4 ? 1.0 : 1.4) * sc,
        );
        g.fillRect(X(cf - 0.35), Y(L.bmp === 4 ? 1.5 : 1.9), 0.35 * sc, 0.1 * sc);
        if (L.bmp === 3) {
          g.fillStyle = "#fff6c8";
          g.beginPath();
          g.arc(X(cf - 0.3), Y(1.95), 0.12 * sc, 0, 7);
          g.fill();
        }
      }
    }
    if (L.vis) {
      g.fillStyle = L.vis > 1 ? "#dfe3e7" : "#151515";
      g.beginPath();
      g.moveTo(X(-5.0), Y(roofH - 0.3));
      g.lineTo(X(-5.35), Y(roofH - 0.4));
      g.lineTo(X(-5.3), Y(roofH - 0.25));
      g.lineTo(X(-4.9), Y(roofH - 0.15));
      g.fill();
    }
    if (L.spl) {
      g.fillStyle = shade(col, 1.15);
      g.beginPath();
      g.moveTo(X(-4.6), Y(roofH));
      g.quadraticCurveTo(
        X(-4.2),
        Y(roofH + (L.spl > 1 ? 1.0 : 0.75)),
        X(-2.6),
        Y(roofH + (L.spl > 1 ? 1.0 : 0.75)),
      );
      g.lineTo(X(-2.6), Y(roofH));
      g.closePath();
      g.fill();
    }
    const top = roofH + (L.spl ? (L.spl > 1 ? 1.0 : 0.75) : 0);
    if (L.rbar) {
      g.fillStyle = "#2b2e33";
      g.fillRect(X(-4.9), Y(top + 0.18), 1.0 * sc, 0.08 * sc);
      g.fillStyle = "#fff6c8";
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(X(-4.8 + k * 0.4), Y(top + 0.28), 0.1 * sc, 0, 7);
        g.fill();
      }
    }
    if (L.bcn) {
      g.fillStyle = "#ff9a1a";
      g.beginPath();
      g.ellipse(X(-2.8), Y(top + 0.15), 0.18 * sc, 0.16 * sc, 0, Math.PI, 0);
      g.fill();
    }
    if (L.led) {
      g.save();
      g.shadowColor = L.led;
      g.shadowBlur = 8;
      g.fillStyle = L.led;
      g.fillRect(X(cf + 0.3), Y(1.08), (1.3 - cf - 0.4) * sc, 0.05 * sc);
      g.restore();
    }
    if (L.bem) {
      g.fillStyle = L.bem >= 3 ? "#bfe6ff" : "#ffffff";
      g.fillRect(X(cf - 0.07), Y(1.75), 0.14 * sc, 0.34 * sc);
    }
    if (L.livB) {
      g.fillStyle = L.livB.acc;
      g.fillRect(X(-5), Y(1.75), 2.5 * sc, 0.16 * sc);
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.font = "900 " + Math.round(0.5 * sc) + "px Arial Black,Arial";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(L.livB.mono, X(-3.15), Y(2.35));
    }
    if (L.dec) {
      const dx = X(-3.15),
        dy = Y(2.25);
      if (L.dec === "num") {
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(dx, dy, 0.35 * sc, 0, 7);
        g.fill();
        g.fillStyle = "#111";
        g.font = "900 " + Math.round(0.36 * sc) + "px Arial";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("88", dx, dy + 1);
      } else if (L.dec === "stars") {
        for (let k = 0; k < 4; k++)
          czStar(
            g,
            dx + (k - 1.5) * 0.35 * sc,
            dy + (k % 2 ? -0.2 : 0.15) * sc,
            0.12 * sc,
            "#ffe14d",
          );
      } else if (L.dec === "bolt") {
        g.fillStyle = "#ffe14d";
        g.beginPath();
        for (const [a, b] of [
          [-0.6, 0.3],
          [0.1, 0.3],
          [-0.1, 0],
          [0.6, 0],
          [-0.3, -0.4],
          [-0.1, -0.1],
          [-0.6, -0.1],
        ])
          g.lineTo(dx + a * sc, dy - b * sc);
        g.fill();
      } else {
        g.fillStyle = "#f5f5f5";
        g.beginPath();
        g.moveTo(dx - 0.7 * sc, dy);
        g.quadraticCurveTo(dx, dy - 0.6 * sc, dx + 0.7 * sc, dy);
        g.quadraticCurveTo(dx, dy - 0.2 * sc, dx - 0.7 * sc, dy);
        g.fill();
      }
    }
    if (L.plt) {
      g.fillStyle = L.plt > 1 ? "#7fe3ff" : "#f5f5f5";
      g.fillRect(X(-4.85), Y(2.55), 0.08 * sc, 0.25 * sc);
    }
  };
}
// lights preview (shop): beams, roof bar glow, LEDs, beacons
function czLightsPreview(g, A, sc, fit, m) {
  const L = czLook(m.id, fit),
    F = czFx(fit),
    S = PPM * ART_SCALE,
    nose = (m.style && m.style.nose) || 0,
    fy = (-A.H / 2 + A.oy + (CAB.front - nose) * S) * sc,
    k = F.beam,
    t = performance.now() / 1000;
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const s of [-1, 1]) {
    const x = s * 0.95 * S * sc + (A.ox - A.W / 2) * sc,
      len = 5.5 * S * sc * k * 0.55,
      gr = g.createRadialGradient(x, fy, 2, x, fy, len);
    gr.addColorStop(0, "rgba(255,248,220,0.75)");
    gr.addColorStop(1, "rgba(255,248,220,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x, fy);
    g.arc(x, fy, len, -Math.PI / 2 - 0.32, -Math.PI / 2 + 0.32);
    g.closePath();
    g.fill();
  }
  if (L.bcn) {
    const a = t * 6;
    for (let i = 0; i < 2; i++) {
      const gr = g.createRadialGradient(
        0,
        -A.H * 0.05 * sc,
        1,
        0,
        -A.H * 0.05 * sc,
        A.W * 0.9 * sc,
      );
      gr.addColorStop(0, "rgba(255,160,30,0.45)");
      gr.addColorStop(1, "rgba(255,160,30,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, -A.H * 0.05 * sc);
      g.arc(0, -A.H * 0.05 * sc, A.W * 0.9 * sc, a + i * Math.PI, a + i * Math.PI + 0.6);
      g.closePath();
      g.fill();
    }
  }
  if (L.led) {
    for (const s of [-1, 1])
      for (let k = 0; k < 5; k++) {
        const x = s * A.W * 0.36 * sc,
          y = (-0.3 + k * 0.15) * A.H * sc,
          gr = g.createRadialGradient(x, y, 1, x, y, A.W * 0.2 * sc);
        gr.addColorStop(0, L.led);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.35;
        g.fillStyle = gr;
        g.fillRect(x - A.W * 0.2 * sc, y - A.W * 0.2 * sc, A.W * 0.4 * sc, A.W * 0.4 * sc);
      }
  }
  g.restore();
}
function czLightsSide(g, cx, cy, sc, m, fit) {
  const L = czLook(m.id, fit),
    F = czFx(fit),
    nose = (m.style && m.style.nose) || 0,
    x = cx + (-5.0 - nose) * sc,
    y = cy - 1.9 * sc;
  g.save();
  g.globalCompositeOperation = "lighter";
  const len = 4 * sc * F.beam,
    gr = g.createLinearGradient(x, 0, x - len, 0);
  gr.addColorStop(0, "rgba(255,248,220,0.7)");
  gr.addColorStop(1, "rgba(255,248,220,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x - len, y - 0.6 * sc);
  g.lineTo(x - len, y + 1.2 * sc);
  g.closePath();
  g.fill();
  if (L.bcn && Math.sin(performance.now() / 90) > 0) {
    const gr2 = g.createRadialGradient(
      cx - 2.8 * sc,
      cy - 4 * sc,
      1,
      cx - 2.8 * sc,
      cy - 4 * sc,
      1.4 * sc,
    );
    gr2.addColorStop(0, "rgba(255,160,30,0.8)");
    gr2.addColorStop(1, "rgba(255,160,30,0)");
    g.fillStyle = gr2;
    g.fillRect(cx - 4.4 * sc, cy - 5.6 * sc, 3.2 * sc, 3.2 * sc);
  }
  g.restore();
}
// in-game night glow for fitted lights (called from czDrawBays during the world render)
function czTruckGlow() {
  const L = truck.czL;
  if (!L || typeof DN === "undefined" || DN.dark < 0.05 || typeof dnLight !== "function") return;
  const f = fwd(truck.h),
    r = [-f[1], f[0]],
    P = (a, b) => [(truck.x + r[0] * a + f[0] * b) * PPM, (truck.y + r[1] * a + f[1] * b) * PPM];
  if (L.led) {
    for (const s of [-1, 1]) {
      const p = P(s * 1.5, 1.5);
      dnLight(p[0], p[1], 16, L.led, 0.22);
    }
  }
  if (L.rbar && typeof HB !== "undefined" && HB.on) {
    const p = P(0, 6.5);
    dnLight(p[0], p[1], 120, "rgba(255,248,220,1)", 0.6);
  }
  if (
    L.bcn &&
    (Math.sin(timeS * 9) > 0 || L.bcn === 3) &&
    ((typeof IND !== "undefined" && IND.haz) || Math.abs(truck.v) < 0.5)
  ) {
    const p = P(0, 2.7);
    dnLight(p[0], p[1], 70, "rgba(255,150,30,1)", 0.7);
  }
}
{
  const db0 = czDrawBays;
  czDrawBays = function (a, b, c, d) {
    db0(a, b, c, d);
    czTruckGlow();
  };
}
// ---- card icons for stage-3 slots
{
  const ic0 = czIcon2;
  czIcon2 = function (g, p, W, H, cx, cy, s, lv) {
    const sl = p.slot,
      L = p.look || {};
    if (sl === "bmp") {
      const fake = { style: {} },
        X = (v) => cx + v * 30 * s,
        Y = (v) => cy + (v + 5.0) * 30 * s - 6 * s;
      g.fillStyle = "#c0392b";
      rr(g, X(-1.25), Y(-5.0), 2.5 * 30 * s, 1.0 * 30 * s, 8 * s);
      g.fill();
      czDrawParts(g, L, {}, X, Y, 30 * s, -5.0, fake);
      return;
    }
    if (sl === "bem" || sl === "rbar" || sl === "bcn" || sl === "led") {
      g.fillStyle = "#0d1320";
      g.fillRect(0, 0, W, H);
      const K = 40 * s,
        X = (v) => cx + v * K,
        Y = (v) => cy + (v + 4.1) * K;
      g.fillStyle = "#34495e";
      rr(g, X(-1.25), Y(-5.0), 2.5 * K, 2.4 * K, 8 * s);
      g.fill();
      czDrawParts(g, L, {}, X, Y, K, -5.0, { style: {}, id: "x", cols: ["#34495e"] });
      g.save();
      g.globalCompositeOperation = "lighter";
      const gl =
        L.bem || L.rbar ? "rgba(255,248,220," : L.bcn ? "rgba(255,160,30," : "rgba(120,200,255,";
      const gr = g.createRadialGradient(
        cx,
        L.bem || L.rbar ? Y(-5.2) : cy,
        2,
        cx,
        L.bem || L.rbar ? Y(-5.2) : cy,
        60 * s,
      );
      gr.addColorStop(0, gl + "0.5)");
      gr.addColorStop(1, gl + "0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.restore();
      return;
    }
    if (sl === "hrn") {
      const n = [2, 2, 1, 3, 3][L.hrn] || 2;
      for (let k = 0; k < n + (L.hrn === 4 ? 2 : 0); k++) {
        const x = cx - 34 * s + k * 16 * s,
          len = (26 + k * 6) * s;
        const gr = g.createLinearGradient(0, cy - 10 * s, 0, cy + 10 * s);
        gr.addColorStop(0, "#fff");
        gr.addColorStop(1, "#8e969f");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x, cy + 14 * s);
        g.lineTo(x + 5 * s, cy + 14 * s - len);
        g.lineTo(x + 12 * s, cy + 14 * s - len - 6 * s);
        g.lineTo(x + 12 * s, cy + 14 * s);
        g.fill();
      }
      g.strokeStyle = "#f5b82e";
      g.lineWidth = 3 * s;
      for (let k = 0; k < L.hrn; k++) {
        g.beginPath();
        g.arc(cx + 30 * s, cy - 4 * s, (6 + k * 6) * s, -0.9, 0.9);
        g.stroke();
      }
      if (L.hrn === 4) {
        g.fillStyle = "#f5b82e";
        g.font = "bold " + Math.round(10 * s) + "px Arial";
        g.textAlign = "center";
        g.fillText("TRAIN", cx - 6 * s, cy + 30 * s);
      }
      return;
    }
    if (["vis", "spl", "mud", "skt", "plt", "dec", "liv"].includes(sl)) {
      const c = sl === "liv" ? (czYardBrand() || {}).col || "#2c3e50" : "#c0392b",
        K = 33 * s,
        X = (v) => cx + v * K,
        Y = (v) => cy + (v + 2.0) * K,
        LL = Object.assign({}, L);
      if (sl === "liv") {
        const B = czYardBrand();
        if (B) LL.livB = B;
        else {
          LL.livB = { mono: "?", acc: "#777" };
        }
      }
      g.save();
      g.translate(cx, cy);
      g.rotate(-Math.PI / 2);
      g.translate(-cx, -cy);
      const gr = g.createLinearGradient(X(-1.25), 0, X(1.25), 0);
      gr.addColorStop(0, shade(c, 0.75));
      gr.addColorStop(0.5, shade(c, 1.15));
      gr.addColorStop(1, shade(c, 0.75));
      g.fillStyle = gr;
      rr(g, X(-1.25), Y(-5.0), 2.5 * K, 2.45 * K, 7 * s);
      g.fill();
      g.fillStyle = "#1b2a38";
      g.fillRect(X(-1.15), Y(-4.95), 2.3 * K, 0.3 * K);
      g.fillStyle = "#2a2d31";
      g.fillRect(X(-0.6), Y(-2.55), 1.2 * K, 3.2 * K);
      g.fillStyle = "#141414";
      for (const q of [-1, 1]) g.fillRect(X(q > 0 ? 0.75 : -1.25), Y(-0.55), 0.5 * K, 1.1 * K);
      czDrawParts(g, LL, {}, X, Y, K, -5.0, { style: {}, id: "x", cols: [c] });
      g.restore();
      return;
    }
    if (ic0) ic0(g, p, W, H, cx, cy, s, lv);
  };
}
// ---- MP: send fitted cosmetics with the colour, draw remote rigs with them
function czCosStr() {
  const f = czFitted(career.cur),
    ids = [];
  for (const k in f) {
    const p = czPart(f[k]);
    if (p && p.look) ids.push(p.id);
  }
  let s = ids.join(".");
  if (f.liv) {
    const B = czYardBrand();
    if (B) s += "|" + B.mono + "|" + B.col + "|" + B.acc;
  }
  return s;
}
function mpCosmetic() {
  /* state is sent every packet via the colour field; nothing else to do */
}
function czRemoteArt(mid, c) {
  const i = c.indexOf("~");
  const col = c.slice(0, i),
    parts = c.slice(i + 1).split("|"),
    ids = parts[0].split(".").filter(Boolean),
    fit = {};
  if (parts.length >= 4) fit._livB = { mono: parts[1].slice(0, 3), col: parts[2], acc: parts[3] };
  for (const id of ids) {
    const p = czPart(id);
    if (p) fit[p.slot] = id;
  }
  const m = modelById(mid);
  return czArt(m, col || m.cols[0], fit);
}
