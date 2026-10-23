/**
 * @file wheelspec.js — per-truck real wheels (mock-up v1): realistic tyre diameter per class, distinct rim + hub style
 * per model, twin drive wheels, long-nose geometry (front axle under the bonnet, tandem twin drive under the fifth
 * wheel, tanks + steps between), wheel arches, and a per-truck Wheel size setting (85-130 % of stock, saved in
 * career.tune[mid].ws) that also lifts the ride height. Bastion gets the HET-style (M1070-like) side body.
 * Wraps czSide (cached local render, then scaled) and czArt (tyres drawn under the top art).
 * Exposes: WSPEC, czWS, czWheels, wsDraw. Load order: after milrig.js (last wrapper of czSide / czArt / modelArt).
 */
const WSPEC = {
  rigger: { r: 0.53, rim: "steel", ax: [{ x: -3.8 }, { x: 0, tw: 1 }] },
  atlas: { r: 0.53, rim: "alloy", ax: [{ x: -3.8 }, { x: 0, tw: 1 }] },
  volta: { r: 0.52, rim: "aero", ax: [{ x: -3.8 }, { x: 0, tw: 1 }] },
  kestrel: { r: 0.53, rim: "sport", ax: [{ x: -3.8 }, { x: 0, tw: 1 }] },
  northline: { r: 0.54, rim: "chrome", ax: [{ x: -5.45 }, { x: -0.68, tw: 1 }, { x: 0.62, tw: 1 }], conv: 1 },
  titan: { r: 0.56, rim: "star", ax: [{ x: -5.85 }, { x: -0.72, tw: 1 }, { x: 0.66, tw: 1 }], conv: 1 },
  bastion: { r: 0.7, rim: "mil", ax: [{ x: -5.0 }, { x: -1.45 }, { x: -0.05 }, { x: 1.35 }], mil: 1 },
};
function czWS(mid) {
  const t = career && career.tune && career.tune[mid];
  const v = t && +t.ws;
  return v ? Math.max(0.85, Math.min(1.3, v)) : 1;
}
function czWheels(m) {
  const s = WSPEC[m.id] || WSPEC.atlas,
    k = czWS(m.id),
    r = s.r * k;
  return { ...s, r, k, dr: r - 0.5 }; // dr: ride height change vs the old 0.5 m art
}
// one wheel, side view, centre (x,y) px, radius r px
function wsDraw(g, x, y, r, style, tw, o) {
  o = o || {};
  const mil = style === "mil";
  g.fillStyle = "#151617";
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
  if (mil) {
    g.fillStyle = "#26282a";
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2;
      g.save();
      g.translate(x + Math.cos(a) * r * 0.93, y + Math.sin(a) * r * 0.93);
      g.rotate(a);
      g.fillRect(-r * 0.07, -r * 0.09, r * 0.14, r * 0.18);
      g.restore();
    }
  }
  g.strokeStyle = "#2c2e31";
  g.lineWidth = Math.max(1, r * 0.05);
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, 7);
  g.stroke();
  if (o.stripe) {
    g.strokeStyle = o.stripe;
    g.lineWidth = Math.max(1, r * 0.04);
    g.beginPath();
    g.arc(x, y, r * 0.86, -2.6, -0.6);
    g.stroke();
  }
  const rr0 = r * (mil ? 0.56 : 0.62),
    rc = o.rc;
  const disc = (c) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, rr0, 0, 7);
    g.fill();
  };
  const holes = (n, rad, sz, c) => {
    g.fillStyle = c;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3;
      g.beginPath();
      g.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad, sz, 0, 7);
      g.fill();
    }
  };
  const spokes = (n, w, c) => {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.lineCap = "round";
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * rr0 * 0.3, y + Math.sin(a) * rr0 * 0.3);
      g.lineTo(x + Math.cos(a) * rr0 * 0.92, y + Math.sin(a) * rr0 * 0.92);
      g.stroke();
    }
    g.lineCap = "butt";
  };
  if (style === "steel") {
    disc(rc || "#c4c9ce");
    holes(10, rr0 * 0.68, rr0 * 0.11, "#3a3d41");
  } else if (style === "alloy") {
    const gr = g.createRadialGradient(x - rr0 * 0.3, y - rr0 * 0.3, 1, x, y, rr0);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(1, rc || "#aeb5bc");
    disc(gr);
    holes(10, rr0 * 0.72, rr0 * 0.09, "#555b62");
  } else if (style === "aero") {
    disc(rc || "#9fa7ae");
    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = Math.max(1, r * 0.03);
    g.beginPath();
    g.arc(x, y, rr0 * 0.75, -2.4, -0.5);
    g.stroke();
  } else if (style === "sport") {
    disc("#1e2023");
    spokes(6, rr0 * 0.2, rc || "#8a929b");
  } else if (style === "chrome") {
    const gr = g.createRadialGradient(x, y, 1, x, y, rr0);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.7, rc || "#cfd5db");
    gr.addColorStop(1, "#7d858d");
    disc(gr);
    holes(10, rr0 * 0.62, rr0 * 0.07, "#6a7178");
  } else if (style === "star") {
    disc("#2a2c30");
    spokes(5, rr0 * 0.28, rc || "#e3e7eb");
  } else if (style === "spoke") {
    disc("#2a2c30");
    spokes(10, rr0 * 0.1, rc || "#c8cdd2");
  } else if (style === "split") {
    disc(rc || "#b8bec4");
    g.fillStyle = "#3a3d41";
    g.fillRect(x - rr0, y - rr0 * 0.08, rr0 * 2, rr0 * 0.16);
  } else if (mil) {
    disc(rc || o.body || "#4b5d33");
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = Math.max(1, rr0 * 0.12);
    g.beginPath();
    g.arc(x, y, rr0 * 0.86, 0, 7);
    g.stroke();
    holes(12, rr0 * 0.86, rr0 * 0.05, "#d0d4c8");
  }
  if (tw) {
    // twin: dished outer wheel, recessed hub
    g.fillStyle = "rgba(0,0,0,0.38)";
    g.beginPath();
    g.arc(x, y, rr0 * 0.42, 0, 7);
    g.fill();
  }
  // hub: per style
  g.fillStyle = style === "chrome" || style === "star" ? "#eef1f4" : mil ? "#2b2f25" : "#2a2d31";
  g.beginPath();
  g.arc(x, y, rr0 * (style === "chrome" ? 0.32 : 0.24), 0, 7);
  g.fill();
  if (style === "chrome") {
    g.fillStyle = "#9aa2ab";
    g.beginPath();
    g.arc(x, y, rr0 * 0.12, 0, 7);
    g.fill();
  }
  holes(mil ? 8 : 6, rr0 * 0.16, Math.max(0.6, rr0 * 0.035), "#c9ced3");
  if (o.brk) {
    g.fillStyle = o.brk;
    g.fillRect(x + r * 0.18, y - r * 0.42, r * 0.2, r * 0.42);
  }
}
const WS_CACHE = {};
let WS_N = 0;
(function () {
  const sideOrig = czSide,
    artOrig = czArt,
    K = 60,
    LX0 = -8.6,
    LX1 = 3.2,
    LY1 = 6.2,
    LY0 = -0.4;
  const W = Math.ceil((LX1 - LX0) * K),
    H = Math.ceil((LY1 - LY0) * K),
    OX = -LX0 * K,
    OY = LY1 * K;
  function milBody(g, X, Y, col, Wh, sc) {
    const body = shade(col, 1),
      dk = shade(col, 0.68),
      lt = shade(col, 1.2),
      dr = Wh.dr;
    // chassis + rear deck over the tri-axle
    g.fillStyle = "#23251f";
    g.fillRect(X(-6.0), Y(1.05 + dr), 8.3 * sc, 0.45 * sc);
    g.fillStyle = dk;
    g.fillRect(X(-2.3), Y(1.55 + dr), 4.5 * sc, 0.12 * sc); // deck plate edge
    // high bumper with round lamps
    g.fillStyle = dk;
    g.fillRect(X(-6.25), Y(1.95 + dr), 0.45 * sc, 0.75 * sc);
    // short squared bonnet
    const gr = g.createLinearGradient(0, Y(2.7 + dr), 0, Y(1.1 + dr));
    gr.addColorStop(0, lt);
    gr.addColorStop(1, dk);
    g.fillStyle = gr;
    g.fillRect(X(-6.0), Y(2.7 + dr), 1.1 * sc, 1.6 * sc);
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let k = 0; k < 6; k++) g.fillRect(X(-5.95), Y(2.6 + dr - k * 0.2), 0.06 * sc, 0.1 * sc); // grille edge
    // tall boxy cab
    const cg = g.createLinearGradient(0, Y(3.75 + dr), 0, Y(1.1 + dr));
    cg.addColorStop(0, lt);
    cg.addColorStop(0.5, body);
    cg.addColorStop(1, dk);
    g.fillStyle = cg;
    g.fillRect(X(-4.95), Y(3.75 + dr), 2.55 * sc, 2.65 * sc);
    // flat windscreen (upright) + side glass
    g.fillStyle = "#1b2a38";
    g.fillRect(X(-4.9), Y(3.6 + dr), 0.14 * sc, 0.9 * sc);
    g.fillRect(X(-4.6), Y(3.55 + dr), 1.0 * sc, 0.8 * sc);
    g.fillRect(X(-3.45), Y(3.55 + dr), 0.85 * sc, 0.8 * sc);
    g.fillStyle = "rgba(160,220,255,0.3)";
    g.fillRect(X(-4.5), Y(3.5 + dr), 0.25 * sc, 0.6 * sc);
    // door lines, steps, grab handle
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 1.5;
    g.strokeRect(X(-4.65), Y(3.6 + dr), 1.15 * sc, 2.3 * sc);
    g.fillStyle = "#2b2e28";
    for (let k = 0; k < 3; k++) g.fillRect(X(-4.55), Y(1.25 + dr - k * 0.32 + 0.3), 0.7 * sc, 0.07 * sc);
    // roof light bar + amber beacon
    g.fillStyle = "#23251f";
    g.fillRect(X(-4.9), Y(3.85 + dr), 2.3 * sc, 0.1 * sc);
    for (let k = 0; k < 5; k++) {
      g.fillStyle = "#fff3c4";
      g.fillRect(X(-4.8 + k * 0.45), Y(3.83 + dr), 0.14 * sc, 0.06 * sc);
    }
    g.fillStyle = "#ff9a1a";
    g.beginPath();
    g.ellipse(X(-2.75), Y(3.95 + dr), 0.12 * sc, 0.14 * sc, 0, Math.PI, 0);
    g.fill();
    // mirror on a frame
    g.strokeStyle = "#1c1d1a";
    g.lineWidth = Math.max(1, 0.05 * sc);
    g.strokeRect(X(-5.25), Y(3.3 + dr), 0.25 * sc, 0.8 * sc);
    g.fillStyle = "#151614";
    g.fillRect(X(-5.3), Y(3.25 + dr), 0.14 * sc, 0.65 * sc);
    // exhaust stack behind the cab
    g.fillStyle = "#3a3c36";
    g.fillRect(X(-2.32), Y(4.0 + dr), 0.18 * sc, 2.4 * sc);
    // round lamps on the bumper face
    g.fillStyle = "#fff6d0";
    g.beginPath();
    g.arc(X(-6.22), Y(1.55 + dr), 0.1 * sc, 0, 7);
    g.fill();
    g.fillStyle = "#f0a020";
    g.beginPath();
    g.arc(X(-6.22), Y(1.32 + dr), 0.07 * sc, 0, 7);
    g.fill();
    // fuel tank + toolbox between the axles
    g.fillStyle = "#3a3d34";
    g.fillRect(X(-3.9), Y(1.15 + dr), 1.6 * sc, 0.6 * sc);
  }
  czSide = function (g, cx, cy, sc, m, col, fit) {
    const Wh = czWheels(m),
      L = czLook(m.id, fit || {}),
      key = m.id + "|" + col + "|" + JSON.stringify(fit || {}) + "|" + Wh.k;
    let c = WS_CACHE[key];
    if (!c) {
      if (++WS_N > 40) {
        for (const k in WS_CACHE) delete WS_CACHE[k];
        WS_N = 1;
      }
      c = mkCanvas(W, H);
      const g2 = c.getContext("2d"),
        X = (v) => OX + v * K,
        Y = (v) => OY - v * K;
      const lift = Wh.dr * K;
      // original body, lifted to the new ride height
      sideOrig(g2, OX, OY - lift, K, m, col, fit || {});
      // remove the old 1.0 m wheels (and, on the conventional trucks, the misplaced ones)
      g2.globalCompositeOperation = "destination-out";
      for (const ax of [-3.8, 0]) {
        g2.beginPath();
        g2.arc(X(ax), Y(0.5 + Wh.dr), 0.54 * K, 0, 7);
        g2.fill();
      }
      g2.fillRect(0, Y(-0.02), W, H); // old baked shadow below ground
      g2.globalCompositeOperation = "source-over";
      const cl = shade(L.col || col, 0.55);
      if (Wh.mil) {
        // mods = pixels the fitted parts add on top of the stock render; keep them over the new body
        const st = mkCanvas(W, H),
          sg = st.getContext("2d");
        sideOrig(sg, OX, OY - lift, K, m, col, {});
        const a = g2.getImageData(0, 0, W, H),
          b = sg.getImageData(0, 0, W, H).data,
          d = a.data;
        for (let i = 0; i < d.length; i += 4)
          if (Math.abs(d[i] - b[i]) + Math.abs(d[i + 1] - b[i + 1]) + Math.abs(d[i + 2] - b[i + 2]) + Math.abs(d[i + 3] - b[i + 3]) < 12) d[i + 3] = 0;
        const mods = mkCanvas(W, H);
        mods.getContext("2d").putImageData(a, 0, 0);
        g2.clearRect(0, 0, W, H);
        milBody(g2, X, Y, L.col || col, Wh, K);
        g2.drawImage(mods, 0, 0);
      } else {
        g2.fillStyle = "#2a2d31";
        g2.fillRect(X(-4.6), Y(1.15 + Wh.dr), 5.9 * K, 0.35 * K); // chassis rail patch
      }
      if (Wh.conv) {
        // fuel tank + steps between front axle and drive tandem
        const tg = g2.createLinearGradient(0, Y(1.15 + Wh.dr), 0, Y(0.45 + Wh.dr));
        tg.addColorStop(0, "#f2f4f6");
        tg.addColorStop(0.5, "#aab1b8");
        tg.addColorStop(1, "#6d747b");
        g2.fillStyle = tg;
        rr(g2, X(-3.55), Y(1.12 + Wh.dr), 1.75 * K, 0.62 * K, 0.25 * K);
        g2.fill();
        g2.fillStyle = "#2a2d31";
        for (let k = 0; k < 3; k++) g2.fillRect(X(-4.75), Y(1.2 + Wh.dr - k * 0.28), 0.6 * K, 0.07 * K);
      }
      // arches / mudguards then wheels
      const style = L.rim === "star" ? "star" : L.rim === "spoke" ? "spoke" : L.rim === "split" ? "split" : Wh.rim;
      const ty = czPart((fit || {}).tyre),
        bk = czPart((fit || {}).brk);
      for (const a of Wh.ax) {
        const front = a === Wh.ax[0];
        g2.fillStyle = "#0e0f10";
        g2.beginPath();
        g2.arc(X(a.x), Y(Wh.r), Wh.r * 1.12 * K, Math.PI, 0);
        g2.fill();
        g2.strokeStyle = front && !Wh.mil ? cl : "#1a1b1d";
        g2.lineWidth = 0.08 * K;
        g2.beginPath();
        g2.arc(X(a.x), Y(Wh.r), Wh.r * 1.16 * K, Math.PI * 1.05, -0.05 * Math.PI);
        g2.stroke();
      }
      for (const a of Wh.ax)
        wsDraw(g2, X(a.x), Y(Wh.r), Wh.r * K, style, a.tw, {
          rc: L.rc,
          body: shade(L.col || col, 0.8),
          stripe: ty ? (ty.id === "tyre2" ? "#7dff9a" : "#eee") : null,
          brk: bk && bk.cl,
        });
      WS_CACHE[key] = c;
    }
    const f = sc / K;
    g.drawImage(c, cx - OX * f, cy - OY * f, W * f, H * f);
  };
  czArt = function (m, col, fit) {
    const A = artOrig(m, col, fit),
      Wh = czWheels(m);
    if (Wh.mil) return A; // milRigArt draws its own HET tyres
    A.wsOut = A.wsOut || {};
    if (A.wsOut[Wh.k]) return A.wsOut[Wh.k];
    const S = PPM * ART_SCALE,
      pad = Math.ceil((Wh.mil ? 1.6 : 0.4) * S),
      c = mkCanvas(A.W, A.H + pad),
      g = c.getContext("2d");
    g.fillStyle = "#141414";
    for (const a of Wh.ax) {
      const w = a.tw ? 0.62 : Wh.mil ? 0.5 : 0.34,
        zc = a.tw ? 0.94 : Wh.mil ? 1.06 : 1.06;
      for (const s of [-1, 1]) {
        rr(g, A.ox + (s * zc - w / 2) * S, A.oy + (a.x - Wh.r) * S, w * S, 2 * Wh.r * S, 0.12 * S);
        g.fill();
        if (a.tw) {
          g.fillStyle = "#2a2a2a";
          g.fillRect(A.ox + s * zc * S - 1, A.oy + (a.x - Wh.r) * S, 2, 2 * Wh.r * S);
          g.fillStyle = "#141414";
        }
      }
    }
    g.drawImage(A.c, 0, 0);
    return (A.wsOut[Wh.k] = { ...A, c, H: A.H + pad, wsOut: null });
  };
})();
// ---- customiser: Wheel size slider (85-130 %), saved per truck; keys [ ], pad LT/RT on the Tyres tab, touch slider
function wsSet(mid, v) {
  const s = czSetup(mid);
  s.ws = Math.round(Math.max(0.85, Math.min(1.3, v)) * 100) / 100;
  if (typeof saveGame === "function") saveGame();
  const el = document.getElementById("czWs");
  if (el) {
    el.value = Math.round(s.ws * 100);
    const o = document.getElementById("czWsV");
    if (o) o.textContent = Math.round(s.ws * 100) + "%";
  }
}
(function () {
  const r0 = czRender0;
  czRender0 = function (b) {
    r0(b);
    if (CZ.tab !== "tyres") return;
    const m = modelById(career.cur),
      v = Math.round(czWS(m.id) * 100),
      grid = b.querySelector(".czg");
    if (!grid) return;
    const row = document.createElement("div");
    row.className = "czws";
    row.style.cssText = "grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:6px 8px;font-weight:700;font-size:13px";
    row.innerHTML = `<span>Wheel size</span><input id="czWs" type="range" min="85" max="130" step="1" value="${v}" style="flex:1;min-height:32px;touch-action:none" aria-label="Wheel size"><b id="czWsV">${v}%</b><button class="btn" id="czWsR" style="min-height:32px">Stock</button>`;
    grid.prepend(row);
    row.querySelector("#czWs").addEventListener("input", (e) => wsSet(m.id, e.target.value / 100));
    row.querySelector("#czWsR").addEventListener("click", () => wsSet(m.id, 1));
  };
  const p0 = czPad;
  czPad = function (g, hit, now, dt) {
    if (CZ.tab === "tyres" && (hit(6) || hit(7))) {
      const m = modelById(career.cur);
      wsSet(m.id, czWS(m.id) + (hit(7) ? 0.05 : -0.05));
      return true;
    }
    return p0(g, hit, now, dt);
  };
  addEventListener(
    "keydown",
    (e) => {
      if (typeof career === "undefined" || career.uiOpen !== "tune" || CZ.tab !== "tyres") return;
      if (e.code === "BracketLeft" || e.code === "BracketRight") {
        const m = modelById(career.cur);
        wsSet(m.id, czWS(m.id) + (e.code === "BracketRight" ? 0.05 : -0.05));
        e.preventDefault();
      }
    },
    true,
  );
})();
