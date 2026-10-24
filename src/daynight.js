/**
 * @file daynight.js — day / night cycle (game clock)
 * Exposes (globals): DAY_LEN, gameT, DN, dnSmooth, updateDayNight, dnClock, dnSprite, dnRGBA,
 *   dnGlow, dnBuild, DN_COL, DN_AWN, DN_NEON, drawNight (+14 more)
 * Depends on: world.js, ltg.js (ltgLights), bldg2.js, lorry.js, physics.js, traffic.js, services.js, career.js,
 *   ambient.js, gamepad.js, mp.js, indicators.js, beams.js, port.js, repair.js, rail.js,
 *   weather.js, main.js
 * Load order: #38 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
// ---------- day / night cycle (game clock) ----------
const DAY_LEN = 1200; // real seconds per 24h game day (20 min => 1 game hour = 50 s)
let gameT = 8,
  gameDay = 0; // gameDay: whole days elapsed (railway timetable clock)
//                    // game hour 0..24, starts 08:00
// phases (game hours): dawn 4.8-6.6 (1.5 min) | day 6.6-18.6 (10 min) | dusk 18.6-20.4 (1.5 min) | night 20.4-4.8 (7 min)
const DN = {
  dark: 0,
  dusk: 0,
  mm: 0,
  lit: null,
  grid: null,
  cell: 2048,
  lc: null,
  lg: null,
  spr: null,
  cone: null,
  glow: {},
  sendT: 0,
};
function dnSmooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function updateDayNight(dt, run) {
  if (run) {
    gameT += (dt * 24) / DAY_LEN;
    if (gameT >= 24) {
      gameT -= 24;
      gameDay++;
    }
  }
  const h = gameT;
  DN.dark = h < 12 ? 1 - dnSmooth(4.8, 6.6, h) : dnSmooth(18.6, 20.4, h);
  DN.dusk =
    h < 12 ? Math.max(0, 1 - Math.abs(h - 5.7) / 1.3) : Math.max(0, 1 - Math.abs(h - 19.3) / 1.3);
  if (typeof MP !== "undefined" && MP.on && MP.host) {
    DN.sendT -= dt;
    if (DN.sendT <= 0) {
      DN.sendT = 5;
      try {
        mpSendAll({ t: "clock", g: gameT, d: gameDay, w: WX.st, wt: WX.timer });
      } catch (e) {}
    }
  }
}
function dnClock() {
  const m = Math.floor(gameT * 60) % 1440;
  return String((m / 60) | 0).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
function dnSprite(r, stops) {
  const c = document.createElement("canvas");
  c.width = c.height = r * 2;
  const g = c.getContext("2d"),
    gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, r * 2, r * 2);
  return c;
}
function dnRGBA(c) {
  if (typeof c !== "string" || c[0] !== "#") return c;
  let h = c.slice(1);
  if (h.length === 3) h = h.replace(/./g, "$&$&");
  const n = parseInt(h.slice(0, 6), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",1)";
}
function dnGlow(c0) {
  const col = dnRGBA(c0);
  return (
    DN.glow[c0] ||
    (DN.glow[c0] = dnSprite(32, [
      [0, col],
      [0.35, col.replace(/[\d.]+\)$/, "0.35)")],
      [1, col.replace(/[\d.]+\)$/, "0)")],
    ]))
  );
}
function dnBuild() {
  if (DN.grid) return;
  const G = new Map(),
    C = DN.cell;
  const add = (x, y, r, k, o) => {
    const key = ((x / C) | 0) + "," + ((y / C) | 0);
    let a = G.get(key);
    if (!a) G.set(key, (a = []));
    a.push(Object.assign({ x, y, r, k }, o || {}));
  };
  for (const l of slBuild()) add(l.x, l.y, l.r, "st", { l });
  let s = 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (const o of world.objects)
    if (o.kind === "bldg") {
      const win = [];
      if (
        typeof ROOF2 !== "undefined" &&
        ROOF2[o.style] &&
        o.style !== "house" &&
        o.style !== "warehouse"
      ) {
        const f = Math.min(o.h * 0.32, Math.max(6, (o.height || 30) * 0.16)),
          fy = o.y + o.h - f;
        for (let j = 3; j < f - 4; j += 7)
          for (let k = 4; k < o.w - 6; k += 9)
            if (win.length < 60) win.push([o.x + k, fy + j, rnd() < 0.7, 21 + rnd() * 9]);
        for (let k = 8; k < o.w - 8; k += 12)
          if (win.length < 80) win.push([o.x + k, o.y + 5, rnd() < 0.55, 21 + rnd() * 9]);
      } else {
        const nw = Math.min(14, Math.max(3, ((o.w * o.h) / (32 * 32 * 2)) | 0));
        for (let i = 0; i < nw; i++)
          win.push([
            o.x + 4 + rnd() * (o.w - 12),
            o.y + 4 + rnd() * (o.h - 10),
            rnd() < 0.6,
            21.5 + rnd() * 8,
          ]);
      }
      const zc = slZone(o.x / TILE + o.w / TILE / 2, o.y / TILE + o.h / TILE / 2),
        shop =
          o.style === "shop" ||
          o.style === "mall" ||
          o.style === "supermarket" ||
          (zc === 0 && o.style !== "house" && o.style !== "warehouse" && rnd() < 0.45);
      // neon colour is still drawn from rnd() so later buildings keep their windows, but it is no longer shown
      const neon =
        zc < 2 &&
        o.style !== "house" &&
        o.style !== "warehouse" &&
        (o.sign || o.cyber || rnd() < (zc === 0 ? 0.35 : 0.12))
          ? DN_NEON[(rnd() * DN_NEON.length) | 0]
          : null;
      add(o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h) * 0.55, "b", {
        o,
        win,
        shop: shop && zc < 2,
        neon: neon && null,
        aw: DN_AWN[(rnd() * DN_AWN.length) | 0],
      });
      if (shop && zc < 2) add(o.x + o.w / 2, o.y + o.h + 18, Math.min(150, o.w * 0.7 + 40), "sh");
    }
  // floodlit plazas + car parks (city/suburb), sampled on a coarse lattice of the tile grid
  for (const k in world.cities || {}) {
    const c = world.cities[k];
    if (!c || !c.xs) continue;
    for (let ty = c.ys[0] - 30; ty <= c.Y1 + 30; ty += 6)
      for (let tx = c.xs[0] - 30; tx <= c.X1 + 30; tx += 6) {
        if (!inb(tx, ty)) continue;
        const t = G[idx(tx, ty)];
        if (t === T.PLAZA || t === T.LOT)
          add((tx + 0.5) * TILE, (ty + 0.5) * TILE, t === T.PLAZA ? 150 : 130, "fl", {
            pz: t === T.PLAZA,
          });
      }
  }
  for (const o of world.objects)
    if (o.kind === "lot")
      for (let y = o.y + 48; y < o.y + o.h; y += 200)
        for (let x = o.x + 48; x < o.x + o.w; x += 200) add(x, y, 140, "fl");
  for (const o of world.overhead)
    if (o.kind === "canopy") add(o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h) * 1.1, "fl");
  if (typeof svcLights === "function") svcLights(add);
  if (typeof siteLights === "function") siteLights(add);
  ltgLights(add);
  for (const d of world.depots || []) {
    add(d.entrance.x * PPM, d.entrance.y * PPM, 160, "fl");
    for (const b of d.bays || []) add(b.kx * PPM, b.ky * PPM, 90, "fl");
  }
  for (const P of typeof portList === "function" ? portList() : [])
    if (P.slots)
      for (let i = 0; i < P.slots.length; i += 6) {
        const q = PL(P, P.slots[i][0], P.slots[i][1]);
        add(q[0] * TILE, q[1] * TILE, 190, "fl");
      }
  DN.grid = G;
}
const DN_COL = {
  st: "rgba(255,214,140,0.55)",
  fl: "rgba(235,240,255,0.5)",
  b: "rgba(255,200,110,0.35)",
};
const DN_AWN = [
  "rgba(255,120,60,0.9)",
  "rgba(255,215,90,0.9)",
  "rgba(120,220,255,0.9)",
  "rgba(255,110,170,0.9)",
  "rgba(140,255,150,0.9)",
];
const DN_NEON = [
  "rgba(255,40,200,0.9)",
  "rgba(40,230,255,0.9)",
  "rgba(170,90,255,0.9)",
  "rgba(255,90,60,0.9)",
];
function drawNight(vx0, vy0, vx1, vy1, z) {
  const K = DN.dark,
    D = DN.dusk;
  if (K < 0.01 && D < 0.01) return;
  ctx.save();
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  if (D > 0.01) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(255,150,80," + 0.32 * D + ")";
    ctx.fillRect(0, 0, VW, VH);
  }
  if (K < 0.01) {
    ctx.restore();
    return;
  }
  dnBuild();
  const q = typeof GFX !== "undefined" && GFX.lvl === "low" ? 0.34 : 0.5, // light/darkness layer resolution
    W = Math.ceil(VW * q),
    H = Math.ceil(VH * q);
  if (!DN.lc || DN.lc.width !== W || DN.lc.height !== H) {
    DN.lc = document.createElement("canvas");
    DN.lc.width = W;
    DN.lc.height = H;
    DN.lg = DN.lc.getContext("2d");
    DN.tc = document.createElement("canvas");
    DN.tc.width = W;
    DN.tc.height = H;
    DN.tg = DN.tc.getContext("2d");
  }
  // city relief: cities sit ~45% less dark than open country, smooth falloff to the edges (one ellipse per visible city)
  const cities = dnCities().filter(
    (c) =>
      c.x + c.rx * 1.5 > vx0 &&
      c.x - c.rx * 1.5 < vx1 &&
      c.y + c.ry * 1.5 > vy0 &&
      c.y - c.ry * 1.5 < vy1,
  );
  const relief = (g, str) => {
    g.globalCompositeOperation = "destination-out";
    for (const c of cities) {
      g.save();
      g.translate((c.x - vx0) * z * q, (c.y - vy0) * z * q);
      g.scale(c.rx * 1.35 * z * q, c.ry * 1.35 * z * q);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, "rgba(0,0,0," + str + ")");
      gr.addColorStop(0.55, "rgba(0,0,0," + str + ")");
      gr.addColorStop(0.78, "rgba(0,0,0," + str * 0.45 + ")");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, 1, 0, 7);
      g.fill();
      g.restore();
    }
    g.globalCompositeOperation = "source-over";
  };
  const TG = DN.tg;
  TG.setTransform(1, 0, 0, 1, 0, 0);
  TG.globalCompositeOperation = "source-over";
  TG.globalAlpha = 1;
  TG.clearRect(0, 0, W, H);
  TG.fillStyle = "rgba(70,95,170,1)";
  TG.fillRect(0, 0, W, H);
  relief(TG, 0.45);
  ctx.globalAlpha = 0.55 * K;
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(DN.tc, 0, 0, VW, VH);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (!DN.spr) {
    DN.spr = dnSprite(64, [
      [0, "rgba(0,0,0,1)"],
      [0.45, "rgba(0,0,0,0.75)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    DN.cone = dnCone();
    DN.coneD = dnConeD();
    DN.coneF = dnConeF();
  }
  const L = DN.lg;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.globalCompositeOperation = "source-over";
  L.clearRect(0, 0, W, H);
  L.fillStyle = "rgba(4,8,22," + 0.72 * K + ")";
  L.fillRect(0, 0, W, H);
  relief(L, 0.47);
  L.globalCompositeOperation = "destination-out";
  const sx = (x) => (x - vx0) * z * q,
    sy = (y) => (y - vy0) * z * q,
    pad = 300;
  const lights = [];
  const C = DN.cell;
  for (let cy = Math.floor((vy0 - pad) / C); cy <= Math.floor((vy1 + pad) / C); cy++)
    for (let cx = Math.floor((vx0 - pad) / C); cx <= Math.floor((vx1 + pad) / C); cx++) {
      const a = DN.grid.get(cx + "," + cy);
      if (a)
        for (const l of a)
          if (l.x > vx0 - pad && l.x < vx1 + pad && l.y > vy0 - pad && l.y < vy1 + pad)
            lights.push(l);
    }
  for (const P of typeof portList === "function" ? portList() : [])
    if (P.cranes)
      for (const c of P.cranes) {
        for (const u of [P.legL, -1, c.u, 16]) {
          const p = PL(P, u, c.y);
          const x = p[0] * TILE,
            y = p[1] * TILE;
          if (x > vx0 - 300 && x < vx1 + 300 && y > vy0 - 300 && y < vy1 + 300)
            dnLight(
              x,
              y,
              u === c.u ? 150 : 70,
              u === c.u ? "rgba(235,240,255,0.7)" : "rgba(255,60,40,0.9)",
              0.8,
            );
        }
      }
  const dyn = DN.dyn || [];
  for (const l of lights.concat(dyn)) {
    if (l.k === "b") continue;
    if (l.k === "sl") {
      // v70: police roof searchlight - a soft wedge punched out of the darkness (flat on low quality)
      const r = l.r * z * q,
        X = sx(l.x),
        Y = sy(l.y);
      L.globalAlpha = 1;
      if (l.hi) {
        const gr = L.createRadialGradient(X, Y, r * 0.04, X, Y, r);
        gr.addColorStop(0, "rgba(0,0,0,0.95)");
        gr.addColorStop(0.55, "rgba(0,0,0,0.7)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        L.fillStyle = gr;
      } else L.fillStyle = "rgba(0,0,0,0.6)";
      L.beginPath();
      L.moveTo(X, Y);
      L.arc(X, Y, r, l.a - l.w, l.a + l.w);
      L.closePath();
      L.fill();
      continue;
    }
    if (l.k === "sh") {
      const r = l.r * z * q;
      L.globalAlpha = 0.9;
      L.drawImage(DN.spr, sx(l.x) - r, sy(l.y) - r, r * 2, r * 2);
      continue;
    }
    const so = l.k === "st" ? slOn(l.l) : 1;
    if (so < 0.02) continue;
    const r = l.r * z * q;
    L.globalAlpha = l.k === "st" ? 0.85 * so : 0.95;
    L.drawImage(DN.spr, sx(l.x) - r, sy(l.y) - r, r * 2, r * 2);
  }
  const veh = dnVehs();
  L.globalAlpha = 1;
  for (const V of veh) {
    const x = V.fx * PPM,
      y = V.fy * PPM;
    if (x < vx0 - 500 || x > vx1 + 500 || y < vy0 - 500 || y > vy1 + 500) continue;
    const ang = Math.atan2(V.f[1], V.f[0]);
    L.save();
    L.translate(sx(x), sy(y));
    L.rotate(ang);
    const s = z * q * (V.big ? 1.55 : 1.1) * (V.bm || 1);
    L.scale(s, s);
    const hk = V.hb || 0;
    if (hk < 0.999) {
      L.globalAlpha = 1 - hk;
      L.drawImage(DN.coneD, 0, -64);
    }
    if (hk > 0.001) {
      L.globalAlpha = hk;
      L.drawImage(DN.coneF, 0, -100);
    }
    L.globalAlpha = 1;
    L.drawImage(DN.spr, -26, -26, 52, 52);
    L.restore();
  }
  L.globalCompositeOperation = "source-over";
  L.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(DN.lc, 0, 0, VW, VH);
  // additive colour: lamp glows, windows, tail + nav lights
  ctx.globalCompositeOperation = "lighter";
  const gz = (col, x, y, r, a) => {
    const R = r * z;
    ctx.globalAlpha = a * K;
    ctx.drawImage(dnGlow(col), (x - vx0) * z - R, (y - vy0) * z - R, R * 2, R * 2);
  };
  for (const c of cities) {
    ctx.save();
    ctx.translate((c.x - vx0) * z, (c.y - vy0) * z);
    ctx.scale(c.rx * 1.2 * z, c.ry * 1.2 * z);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, "rgba(255,170,90," + 0.16 * K + ")");
    gr.addColorStop(0.6, "rgba(255,150,80," + 0.08 * K + ")");
    gr.addColorStop(1, "rgba(255,140,70,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  const hh = gameT < 12 ? gameT + 24 : gameT;
  let nb = 0;
  for (const l of lights) {
    if (l.k === "sh") {
      gz("rgba(255,215,150,1)", l.x, l.y, l.r * 0.55, 0.5);
      continue;
    }
    if (l.k === "st") {
      const so = slOn(l.l);
      if (so > 0.02) {
        gz(DN_COL.st, l.x, l.y, l.r * 0.6, 0.8 * so); // v64: no bulb dot at the head (the bulb is under the housing)
      }
    } else if (l.k === "cl") {
      const f = l.bl ? ((timeS * (l.bl === 1 ? 2.2 : 0.8)) % 1 < 0.5 ? 1 : 0.2) : 1;
      gz(l.col, l.x, l.y, l.r * 3, 0.9 * f);
    } else if (l.k === "fl")
      gz(l.pz ? "rgba(255,225,170,0.6)" : DN_COL.fl, l.x, l.y, l.r * 0.5, 0.45);
    else if (
      l.k === "b" &&
      // on-screen buildings only, then a generous cap (was 500 in grid order incl. the 300 px pad, so which roofs
      // got their window dots changed as the camera moved)
      l.o.x + l.o.w > vx0 &&
      l.o.x < vx1 &&
      l.o.y + l.o.h > vy0 &&
      l.o.y < vy1 &&
      nb++ < 4000
    ) {
      const o = l.o;
      ctx.globalAlpha = 0.75 * K;
      ctx.fillStyle = "#ffd27a"; // v51: cyber towers no longer get always-on cyan strips, just lit windows
      // v80 (James 24 Oct): no fake roof/footprint window dots at night; only the 3D walls carry lit windows
      for (const w of []) {
        if (!w[2] || hh > w[3]) continue;
        // whole screen pixels: no sub-pixel shimmer while the camera pans
        ctx.fillRect(
          Math.round((w[0] - vx0) * z),
          Math.round((w[1] - vy0) * z),
          Math.max(2, Math.round(5 * z)),
          Math.max(2, Math.round(4 * z)),
        );
      }
      // v51: no shop strips, neon bars or cyber outlines on buildings (only windows + halos / pavement pools)
    }
  }
  for (const l of dyn) gz(l.c || DN_COL.fl, l.x, l.y, l.r * 0.5, l.a || 0.6);
  const blink = typeof indBlink === "function" && indBlink();
  for (const V of veh) {
    const X = V.fx * PPM,
      Y = V.fy * PPM;
    if (X < vx0 - 600 || X > vx1 + 600 || Y < vy0 - 600 || Y > vy1 + 600) continue;
    const r = [-V.f[1], V.f[0]],
      hw = V.W / 2 - 0.15;
    for (const sd of V.one ? [0] : [-1, 1]) {
      const lx = V.fx + r[0] * sd * hw * 0.85,
        ly = V.fy + r[1] * sd * hw * 0.85;
      const hk = V.hb || 0;
      gz("rgba(255,250,225,1)", lx * PPM, ly * PPM, (V.big ? 7 : 5) * (1 + 0.3 * hk), 1);
      gz(
        "rgba(255,245,210,0.8)",
        (lx + V.f[0] * (2 + 2 * hk)) * PPM,
        (ly + V.f[1] * (2 + 2 * hk)) * PPM,
        (V.big ? 16 : 11) * (0.85 + 0.6 * hk),
        0.4 + 0.25 * hk,
      );
    }
    const rf = V.rf,
      rr = [-rf[1], rf[0]],
      rw = V.rW / 2 - 0.12;
    for (const sd of V.one ? [0] : [-1, 1]) {
      const lx = V.rx + rr[0] * sd * rw,
        ly = V.ry + rr[1] * sd * rw;
      gz("rgba(255,30,20,0.95)", lx * PPM, ly * PPM, V.br ? 8 : 5, V.br ? 1 : 0.7);
      if (V.rv)
        gz(
          "rgba(255,255,245,1)",
          (lx - rr[0] * sd * 0.45) * PPM,
          (ly - rr[1] * sd * 0.45) * PPM,
          6,
          1,
        );
      const ind = V.haz || (V.side === 1 && sd < 0) || (V.side === 2 && sd > 0);
      if (ind && blink) {
        gz("rgba(255,170,20,1)", (lx + rf[0] * 0.1) * PPM, (ly + rf[1] * 0.1) * PPM, 9, 1);
        const fl = V.fx + r[0] * sd * (hw + 0.05),
          fy = V.fy + r[1] * sd * (hw + 0.05);
        gz("rgba(255,170,20,1)", fl * PPM, fy * PPM, 9, 1);
      }
    }
    if (V.br)
      gz("rgba(255,30,20,0.55)", (V.rx - rf[0] * 2.2) * PPM, (V.ry - rf[1] * 2.2) * PPM, 28, 0.55);
    if (V.rv)
      gz("rgba(255,255,240,0.5)", (V.rx - rf[0] * 3) * PPM, (V.ry - rf[1] * 3) * PPM, 30, 0.45);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.restore();
  DN.dyn = [];
}
// lamp geometry (metres) for every lit vehicle: front lamp line + rear lamp line following trailer articulation
function dnVehs() {
  const out = [];
  {
    const t = truck,
      f = fwd(t.h);
    let rx, ry, rf, rW;
    if (t.trl) {
      const k = kingpin(t);
      rf = fwd(t.th);
      rx = k[0] - rf[0] * TRL.rear;
      ry = k[1] - rf[1] * TRL.rear;
      rW = TRL.w;
    } else {
      rf = f;
      rx = t.x - f[0] * 1.15;
      ry = t.y - f[1] * 1.15;
      rW = 2.4;
    }
    out.push({
      fx: t.x + f[0] * 5.0,
      fy: t.y + f[1] * 5.0,
      f,
      W: 2.45,
      big: 1,
      bm: t.beamM || 1,
      rx,
      ry,
      rf,
      rW,
      br: (t.brake > 0.02 && t.mode !== "R") || (t.brake > 0.02 && Math.abs(t.v) > 0.3),
      rv: t.mode === "R",
      side: typeof IND !== "undefined" ? IND.side : 0,
      haz: typeof IND !== "undefined" && IND.haz,
      hb: typeof hbStep === "function" ? hbStep() : 0,
    });
  }
  for (const v of traffic.vs || []) {
    if (v.x === undefined) continue;
    const f = fwd(v.h || 0),
      L = v.L || 4.4,
      W = v.W || 1.8;
    let rx, ry, rf, rW;
    if (v.trl) {
      rf = fwd(v.trl.h);
      rx = v.trl.x - rf[0] * 6.8;
      ry = v.trl.y - rf[1] * 6.8;
      rW = 2.55;
    } else {
      rf = f;
      rx = v.x - (f[0] * L) / 2;
      ry = v.y - (f[1] * L) / 2;
      rW = W;
    }
    out.push({
      fx: v.x + (f[0] * L) / 2,
      fy: v.y + (f[1] * L) / 2,
      f,
      W,
      big: v.kind === "lorry" || v.kind === "cab",
      rx,
      ry,
      rf,
      rW,
      br: !!v.brake,
      rv: false,
      side: 0,
      haz: false,
      one: !!(VTYPES[v.kind] && VTYPES[v.kind].bike), // v51 motorbikes: one headlamp, one tail lamp
    });
  }
  if (typeof MP !== "undefined" && MP.on)
    for (const id in MP.players) {
      const p = MP.players[id],
        r = p.cur;
      if (!p.has || !r) continue;
      const f = fwd(r.h),
        fl = r.fl | 0;
      let rx, ry, rf, rW;
      if (r.tr) {
        rf = fwd(r.th);
        rx = r.kx - rf[0] * TRL.rear;
        ry = r.ky - rf[1] * TRL.rear;
        rW = TRL.w;
      } else {
        rf = f;
        rx = r.x - f[0] * 1.15;
        ry = r.y - f[1] * 1.15;
        rW = 2.4;
      }
      out.push({
        fx: r.x + f[0] * 5.0,
        fy: r.y + f[1] * 5.0,
        f,
        W: 2.45,
        big: 1,
        rx,
        ry,
        rf,
        rW,
        br: !!(fl & 1),
        rv: !!(fl & 2),
        side: (fl >> 2) & 3,
        haz: !!(fl & 32),
        hb: (p.hbk = (p.hbk || 0) + ((fl & 64 ? 1 : 0) - (p.hbk || 0)) * 0.15),
      });
    }
  return out;
}
// twin cone beams (destination-out mask): hotspot near lamps, soft lateral + distance falloff
// dipped: short, dimmer, kicked up toward the LEFT kerb (local -y = nearside); full: long, bright, wide and symmetric
function dnConeD() {
  const Lc = 150,
    Hc = 128,
    c = document.createElement("canvas");
  c.width = Lc;
  c.height = Hc;
  const g = c.getContext("2d");
  for (const oy of [-11, 11]) {
    const cy = Hc / 2 + oy;
    g.save();
    g.beginPath();
    g.moveTo(0, cy - 3);
    g.lineTo(Lc * 0.55, cy - Hc * 0.4);
    g.lineTo(Lc, cy - Hc * 0.46);
    g.lineTo(Lc, cy + Hc * 0.1);
    g.lineTo(0, cy + 3);
    g.closePath();
    g.clip();
    g.filter = "blur(5px)";
    const gr = g.createRadialGradient(0, cy, 0, 0, cy, Lc);
    gr.addColorStop(0, "rgba(0,0,0,0.9)");
    gr.addColorStop(0.25, "rgba(0,0,0,0.7)");
    gr.addColorStop(0.65, "rgba(0,0,0,0.32)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.globalAlpha = 0.62;
    g.fillRect(0, 0, Lc, Hc);
    g.restore();
  }
  const hs = g.createRadialGradient(24, Hc / 2 - 6, 0, 24, Hc / 2 - 6, 34);
  hs.addColorStop(0, "rgba(0,0,0,0.8)");
  hs.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hs;
  g.fillRect(0, 0, 70, Hc);
  return c;
}
function dnConeF() {
  const Lc = 340,
    Hc = 200,
    c = document.createElement("canvas");
  c.width = Lc;
  c.height = Hc;
  const g = c.getContext("2d");
  for (const oy of [-11, 11]) {
    const cy = Hc / 2 + oy;
    g.save();
    g.beginPath();
    g.moveTo(0, cy - 3);
    g.lineTo(Lc, cy - Hc * 0.4);
    g.lineTo(Lc, cy + Hc * 0.4);
    g.lineTo(0, cy + 3);
    g.closePath();
    g.clip();
    g.filter = "blur(6px)";
    const gr = g.createRadialGradient(0, cy, 0, 0, cy, Lc);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(0.2, "rgba(0,0,0,0.9)");
    gr.addColorStop(0.6, "rgba(0,0,0,0.55)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.globalAlpha = 0.85;
    g.fillRect(0, 0, Lc, Hc);
    g.restore();
  }
  const hs = g.createRadialGradient(30, Hc / 2, 0, 30, Hc / 2, 46);
  hs.addColorStop(0, "rgba(0,0,0,0.95)");
  hs.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hs;
  g.fillRect(0, 0, 90, Hc);
  return c;
}
function dnCone() {
  const Lc = 230,
    Hc = 128,
    c = document.createElement("canvas");
  c.width = Lc;
  c.height = Hc;
  const g = c.getContext("2d");
  for (const oy of [-11, 11]) {
    const cy = Hc / 2 + oy;
    g.save();
    g.beginPath();
    g.moveTo(0, cy - 3);
    g.lineTo(Lc, cy - Hc * 0.36);
    g.lineTo(Lc, cy + Hc * 0.36);
    g.lineTo(0, cy + 3);
    g.closePath();
    g.clip();
    g.filter = "blur(5px)";
    const gr = g.createRadialGradient(0, cy, 0, 0, cy, Lc);
    gr.addColorStop(0, "rgba(0,0,0,0.95)");
    gr.addColorStop(0.18, "rgba(0,0,0,0.8)");
    gr.addColorStop(0.55, "rgba(0,0,0,0.45)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.globalAlpha = 0.75;
    g.fillRect(0, 0, Lc, Hc);
    g.restore();
  }
  const hs = g.createRadialGradient(28, Hc / 2, 0, 28, Hc / 2, 40);
  hs.addColorStop(0, "rgba(0,0,0,0.9)");
  hs.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hs;
  g.fillRect(0, 0, 80, Hc);
  return c;
}
function dnLight(x, y, r, c, a) {
  if (DN.dark < 0.05) return;
  (DN.dyn || (DN.dyn = [])).push({ x, y, r, c, a, k: "d" });
}
function drawClockHUD() {
  const x = VW - 126,
    y = 62,
    w = 112,
    h = 30,
    day = DN.dark < 0.5;
  ctx.save();
  ctx.fillStyle = "rgba(13,15,20,0.72)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h);
  ctx.fill();
  if (DN.dark > 0.3) {
    ctx.strokeStyle = "rgba(207,227,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (day) {
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath();
    ctx.arc(x + 17, y + 15, 6, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#ffcf3f";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + 17 + Math.cos(a) * 8, y + 15 + Math.sin(a) * 8);
      ctx.lineTo(x + 17 + Math.cos(a) * 11, y + 15 + Math.sin(a) * 11);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#dfe6ff";
    ctx.beginPath();
    ctx.arc(x + 17, y + 15, 8, 0, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(13,15,20,1)";
    ctx.beginPath();
    ctx.arc(x + 21, y + 12, 7, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "800 18px system-ui,sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(dnClock(), x + 36, y + 16);
  ctx.restore();
}
function dnMapShade(x, y, w, h, k) {
  const a = DN.dark * (k || 0.45);
  if (a < 0.02) return;
  ctx.save();
  ctx.fillStyle = "rgba(6,12,32," + a + ")";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------- street lamps (v27): posts on the pavement/verge at both road edges, arm over the lane edge, pool just inside the kerb ----------
// density by area: city core ~28 m both sides, suburbs ~48 m staggered, rural roads only at junctions/roundabouts, open country/desert none.
const SL = { list: null, grid: null, cell: 1024 };
function slZone(tx, ty) {
  let best = 2;
  for (const k in world.cities || {}) {
    const c = world.cities[k];
    if (!c || !c.xs) continue;
    const x0 = c.xs[0],
      y0 = c.ys[0],
      x1 = c.X1,
      y1 = c.Y1,
      mx = (x1 - x0) * 0.2,
      my = (y1 - y0) * 0.2;
    if (tx >= x0 + mx && tx <= x1 - mx && ty >= y0 + my && ty <= y1 - my) return 0;
    const dx = Math.max(x0 - tx, 0, tx - x1),
      dy = Math.max(y0 - ty, 0, ty - y1);
    if (Math.hypot(dx, dy) < 40) best = 1;
  }
  return best;
}
function slBuild() {
  if (SL.list) return SL.list;
  const out = [],
    taken = new Set();
  const railT = new Set();
  if (typeof RAIL !== "undefined" && RAIL.X)
    for (let i = 0; i < RAIL.L; i += 2) {
      const cx = RAIL.X[i] / M_TILE,
        cy = RAIL.Y[i] / M_TILE;
      for (let oy = -2; oy <= 2; oy++)
        for (let ox = -2; ox <= 2; ox++)
          railT.add(Math.floor(cx + ox * 0.5) + "," + Math.floor(cy + oy * 0.5));
    }
  const BAD = new Set([T.ROAD, T.BRIDGE, T.WATER, T.BLDG, T.TANK, T.PUMP, T.CONT, T.QUAY]);
  const okPost = (px, py) => {
    const tx = Math.floor(px),
      ty = Math.floor(py);
    if (!inb(tx, ty)) return false;
    const i = idx(tx, ty);
    const inMB = world.milbase && mbInside(tx, ty); // v45: base roads get lamps although the base is reserved
    if (BAD.has(G[i]) || (world.reserved && world.reserved[i] && !inMB) || railT.has(tx + "," + ty))
      return false;
    for (const d of world.depots || [])
      if (tx >= d.x - 1 && tx <= d.x + d.w && ty >= d.y - 1 && ty <= d.y + d.h) return false;
    const key = Math.round(px / 2) + "," + Math.round(py / 2);
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  };
  // post at p (tiles), arm toward the road along unit n (pointing into the road); pool 2 m inside the kerb
  const put = (kx, ky, nx, ny, dbl) => {
    const px = kx - nx * 0.25,
      py = ky - ny * 0.25;
    if (!dbl && !okPost(px, py)) return;
    const ax = kx + nx * 0.72,
      ay = ky + ny * 0.72;
    out.push({
      px: px * TILE,
      py: py * TILE,
      hx: ax * TILE,
      hy: ay * TILE,
      x: ax * TILE,
      y: ay * TILE,
      r: 110,
      dbl: !!dbl,
    });
  };
  const inJ = (tx, ty) => {
    for (const J of world.junctions)
      if (tx > J.x - 1.5 && tx < J.x + J.w + 1.5 && ty > J.y - 1.5 && ty < J.y + J.h + 1.5)
        return true;
    return false;
  };
  // v81 (James 24 Oct): residential streets (houses / driveways within ~24 m) get UK estate lamps every 9 tiles (36 m),
  // alternating sides, even outside the town zones; coarse 6-tile cell set so the test is a few Set lookups
  const resC = new Set();
  for (const o of world.objects)
    if ((o.kind === "bldg" && o.style === "house") || o.kind === "drive")
      for (let y = Math.floor(o.y / TILE / 6) - 1; y <= Math.floor((o.y + o.h) / TILE / 6) + 1; y++)
        for (let x = Math.floor(o.x / TILE / 6) - 1; x <= Math.floor((o.x + o.w) / TILE / 6) + 1; x++)
          resC.add(x + "," + y);
  const resNear = (tx, ty) => resC.has(Math.floor(tx / 6) + "," + Math.floor(ty / 6));
  for (const sg of world.segs || []) {
    if (!sg || sg.b1 === undefined || sg.type === "dirt") continue;
    if (sg.type === "lane" && !resNear(sg.dir === "h" ? (sg.b0 + sg.b1) / 2 : sg.a, sg.dir === "h" ? sg.a : (sg.b0 + sg.b1) / 2)) continue;
    const hwy = sg.type === "hwy",
      mw = sg.type === "hwy" || sg.type === "dual";
    for (let a = sg.b0 + 1, n = 0; a < sg.b1; a++) {
      const cx = sg.dir === "h" ? a + 0.5 : sg.a + sg.w / 2,
        cy = sg.dir === "h" ? sg.a + sg.w / 2 : a + 0.5,
        z = slZone(cx, cy),
        onB =
          inb(Math.floor(cx), Math.floor(cy)) &&
          G[idx(Math.floor(cx), Math.floor(cy))] === T.BRIDGE;
      const res = z > 0 && !mw && resNear(cx, cy);
      if (z === 2 && !mw && !onB && !sg.mil && !res) continue;
      const sp = sg.mil ? 6 : onB ? 6 : z === 0 ? 5 : res ? 9 : mw && z === 2 ? 10 : 12;
      if ((a - sg.b0) % sp !== 0 || inJ(Math.floor(cx), Math.floor(cy))) continue;
      n++;
      if (onB) {
        for (const sd of [-1, 1]) {
          const e = sg.a + (sd < 0 ? 0.15 : sg.w - 0.15);
          if (sg.dir === "h") put(a + 0.5, e, 0, -sd, 1);
          else put(e, a + 0.5, -sd, 0, 1);
        }
        continue;
      }
      if (mw && sg.w >= 6 && z >= 1) {
        // central reservation double lamp: arms either way over the fast lanes
        const ox = sg.dir === "h" ? 0 : 1,
          oy = sg.dir === "h" ? 1 : 0;
        out.push({
          px: cx * TILE,
          py: cy * TILE,
          hx: (cx - ox * 0.85) * TILE,
          hy: (cy - oy * 0.85) * TILE,
          x: (cx - ox * 0.85) * TILE,
          y: (cy - oy * 0.85) * TILE,
          r: 110,
          dbl: 1,
        });
        out.push({
          px: cx * TILE,
          py: cy * TILE,
          hx: (cx + ox * 0.85) * TILE,
          hy: (cy + oy * 0.85) * TILE,
          x: (cx + ox * 0.85) * TILE,
          y: (cy + oy * 0.85) * TILE,
          r: 110,
          dbl: 1,
          twin: 1,
        });
        continue;
      }
      const sides = z === 0 ? [-1, 1] : [n & 1 ? 1 : -1];
      for (const sd of sides) {
        const e = sg.a + (sd < 0 ? 0 : sg.w);
        if (sg.dir === "h") put(a + 0.5, e, 0, -sd);
        else put(e, a + 0.5, -sd, 0);
      }
    }
  }
  for (const cv of world.curves || []) {
    if (cv.type === "dirt" || cv.type === "lane" || !cv.pts || cv.pts.length < 2) continue;
    let acc = 0,
      n = 0;
    for (let i = 1; i < cv.pts.length; i++) {
      const A = cv.pts[i - 1],
        B = cv.pts[i],
        l = Math.hypot(B[0] - A[0], B[1] - A[1]);
      acc += l;
      const mw = cv.type === "hwy" || cv.type === "dual",
        bt = inb(Math.floor(B[0]), Math.floor(B[1]))
          ? G[idx(Math.floor(B[0]), Math.floor(B[1]))]
          : 0,
        onB = bt === T.BRIDGE;
      const z = slZone(B[0], B[1]),
        res = z > 0 && !mw && resNear(B[0], B[1]);
      if (z === 2 && !mw && !onB && !res) {
        acc = 0;
        continue;
      }
      const sp = onB ? 6 : z === 0 ? 5 : res ? 9 : mw && z === 2 ? 10 : 12;
      if (acc < sp) continue;
      acc = 0;
      n++;
      const ux = (B[0] - A[0]) / (l || 1),
        uy = (B[1] - A[1]) / (l || 1),
        nx = -uy,
        ny = ux,
        hw = cv.w / 2;
      if (inJ(Math.floor(B[0]), Math.floor(B[1]))) continue;
      for (const sd of z === 0 || onB ? [-1, 1] : [n & 1 ? 1 : -1])
        put(
          B[0] + nx * sd * (onB ? hw - 0.15 : hw),
          B[1] + ny * sd * (onB ? hw - 0.15 : hw),
          -nx * sd,
          -ny * sd,
          onB ? 1 : 0,
        );
    }
  }
  // v81: estate roads that are plain road tiles (no seg / curve, e.g. cul-de-sacs between homes): walk the kerbs in
  // residential cells, a post on the pavement every 9 tiles (36 m), alternating kerbs, straight stretches only,
  // never within 5 tiles of another lamp or inside a junction box
  {
    const near = new Set();
    const mark = (l) => near.add(Math.floor(l.px / TILE / 5) + "," + Math.floor(l.py / TILE / 5));
    out.forEach(mark);
    const clear = (tx, ty) => {
      const X = Math.floor(tx / 5),
        Y = Math.floor(ty / 5);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (near.has(X + i + "," + (Y + j))) return false;
      return true;
    };
    const R = (x, y) => inb(x, y) && G[idx(x, y)] === T.ROAD,
      W = (x, y) => inb(x, y) && G[idx(x, y)] === T.WALK;
    const cells = [...resC].map((k) => k.split(",").map(Number)).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    for (const [cx6, cy6] of cells)
      for (let y = cy6 * 6; y < cy6 * 6 + 6; y++)
        for (let x = cx6 * 6; x < cx6 * 6 + 6; x++) {
          if (!R(x, y) || slZone(x, y) === 0 || inJ(x, y)) continue;
          const n0 = out.length;
          // horizontal road: kerb above (WALK at y-1) or below (WALK at y+1)
          if (x % 9 === 0 && R(x - 1, y) && R(x + 1, y) && R(x - 2, y) && R(x + 2, y)) {
            const top = (x / 9) & 1;
            if (top && W(x, y - 1) && clear(x, y - 1)) put(x + 0.5, y, 0, 1);
            else if (!top && W(x, y + 1) && clear(x, y + 1)) put(x + 0.5, y + 1, 0, -1);
          } else if (y % 9 === 0 && R(x, y - 1) && R(x, y + 1) && R(x, y - 2) && R(x, y + 2)) {
            const lf = (y / 9) & 1;
            if (lf && W(x - 1, y) && clear(x - 1, y)) put(x, y + 0.5, 1, 0);
            else if (!lf && W(x + 1, y) && clear(x + 1, y)) put(x + 1, y + 0.5, -1, 0);
          }
          for (let k = n0; k < out.length; k++) mark(out[k]);
        }
    // estate footways (houses facing a pedestrian path, no road): lamp on the path's upper / left edge every 9 tiles
    const roadNear = (x, y) => {
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (R(x + i, y + j)) return true;
      return false;
    };
    for (const [cx6, cy6] of cells)
      for (let y = cy6 * 6; y < cy6 * 6 + 6; y++)
        for (let x = cx6 * 6; x < cx6 * 6 + 6; x++) {
          if (!W(x, y) || slZone(x, y) === 0 || roadNear(x, y)) continue;
          const n0 = out.length;
          if (x % 9 === 0 && !W(x, y - 1) && W(x, y + 1) && W(x - 2, y) && W(x + 2, y) && clear(x, y))
            put(x + 0.5, y + 0.45, 0, 1);
          else if (y % 9 === 0 && !W(x - 1, y) && W(x + 1, y) && W(x, y - 2) && W(x, y + 2) && clear(x, y))
            put(x + 0.45, y + 0.5, 1, 0);
          for (let k = n0; k < out.length; k++) mark(out[k]);
        }
  }
  // rural junctions + roundabouts: a lamp on each corner / around the ring
  for (const J of world.junctions) {
    const z = slZone(J.x + J.w / 2, J.y + J.h / 2);
    const hs = world.segs[J.hs],
      vs = world.segs[J.vs];
    if (z === 2 && (!hs || !vs || hs.type === "dirt" || vs.type === "dirt")) continue;
    for (const [cx, cy, dx, dy] of [
      [J.x, J.y, -1, -1],
      [J.x + J.w, J.y, 1, -1],
      [J.x, J.y + J.h, -1, 1],
      [J.x + J.w, J.y + J.h, 1, 1],
    ]) {
      const k = Math.SQRT1_2;
      put(cx + dx * 0.35, cy + dy * 0.35, -dx * k, -dy * k);
    }
  }
  for (const rb of world.rbs || []) {
    for (let q = 0; q < 6; q++) {
      const a = (q * Math.PI) / 3 + 0.3,
        c = Math.cos(a),
        s = Math.sin(a);
      put(rb.cx + c * (rb.rout + 0.15), rb.cy + s * (rb.rout + 0.15), -c, -s);
    }
  }
  let sd = 12345;
  for (const l of out) {
    sd = (sd * 16807) % 2147483647;
    l.u = sd / 2147483647;
    sd = (sd * 16807) % 2147483647;
    l.v = sd / 2147483647;
  }
  const g = new Map();
  for (const l of out) {
    const k = ((l.px / SL.cell) | 0) + "," + ((l.py / SL.cell) | 0);
    let a = g.get(k);
    if (!a) g.set(k, (a = []));
    a.push(l);
  }
  SL.grid = g;
  SL.list = out;
  return out;
}
// per-lamp switch state: each lamp has its own on-time 0.25-1.0 game-h after sunset (18.6) and off-time around sunrise, with a short warm-up flicker
function slOn(l) {
  const h = gameT,
    on = 18.85 + l.u * 0.75,
    off = 5.55 + l.v * 0.75,
    W = 0.07;
  let t;
  if (h >= 12) {
    if (h < on) return 0;
    t = h - on;
  } else if (h < off) t = 9;
  else {
    const d = h - off;
    if (d > W) return 0;
    return (Math.sin(d * 900 + l.u * 50) > 0.2 ? 0.85 : 0.15) * (1 - d / W);
  }
  if (t >= W) return 1;
  const f = t / W;
  return f * (Math.sin(t * 1100 + l.v * 70) > -0.1 ? 1 : 0.2);
}
// posts drawn after the night layer so they stay visible; colours darken with DN.dark but never vanish
function drawStreetLamps(vx0, vy0, vx1, vy1) {
  slBuild();
  const C = SL.cell,
    K = DN.dark,
    sh = 1 - 0.55 * K;
  ctx.save();
  ctx.lineCap = "round";
  const col = (r, g, b) =>
    "rgb(" +
    ((r * sh + 20 * K) | 0) +
    "," +
    ((g * sh + 24 * K) | 0) +
    "," +
    ((b * sh + 40 * K) | 0) +
    ")";
  const post = col(46, 50, 56),
    arm = col(70, 75, 82),
    base = col(30, 33, 38),
    hi = col(150, 156, 165),
    head = col(36, 39, 44);
  for (let cy = Math.floor((vy0 - 60) / C); cy <= Math.floor((vy1 + 60) / C); cy++)
    for (let cx = Math.floor((vx0 - 60) / C); cx <= Math.floor((vx1 + 60) / C); cx++) {
      const a = SL.grid.get(cx + "," + cy);
      if (!a) continue;
      for (const l of a) {
        if (l.px < vx0 - 60 || l.px > vx1 + 60 || l.py < vy0 - 60 || l.py > vy1 + 60) continue;
        const on = K > 0.02 ? slOn(l) : 0;
        l.on = on;
        const ang = Math.atan2(l.hy - l.py, l.hx - l.px);
        // soft shadow (sun from top-left; faint at night)
        ctx.strokeStyle = "rgba(0,0,0," + 0.28 * (1 - 0.6 * K) + ")";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(l.px + 3, l.py + 4);
        ctx.lineTo(l.hx + 9, l.hy + 11);
        ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0," + 0.22 * (1 - 0.6 * K) + ")";
        ctx.beginPath();
        ctx.ellipse(l.hx + 9, l.hy + 11, 6, 4, ang, 0, 7);
        ctx.fill();
        // arm
        ctx.strokeStyle = base;
        ctx.lineWidth = 4.6;
        ctx.beginPath();
        ctx.moveTo(l.px, l.py);
        ctx.lineTo(l.hx, l.hy);
        ctx.stroke();
        ctx.strokeStyle = arm;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(l.px, l.py);
        ctx.lineTo(l.hx, l.hy);
        ctx.stroke();
        // post + base plate
        if (!l.twin) {
          ctx.fillStyle = base;
          ctx.fillRect(l.px - 5, l.py - 5, 10, 10);
          ctx.fillStyle = post;
          ctx.beginPath();
          ctx.arc(l.px, l.py, 4, 0, 7);
          ctx.fill();
          ctx.fillStyle = hi;
          ctx.beginPath();
          ctx.arc(l.px - 1.2, l.py - 1.2, 1.6, 0, 7);
          ctx.fill();
        }
        // v64 lamp head seen from above: the opaque TOP of the housing (dark metal, rim highlight); the bulb is
        // underneath, so at night only a soft warm spill shows round the housing edge (plus the pool on the road)
        ctx.save();
        ctx.translate(l.hx, l.hy);
        ctx.rotate(ang);
        if (on > 0.05) {
          const sp = ctx.createRadialGradient(0, 0, 4, 0, 0, 15);
          sp.addColorStop(0, "rgba(255,206,140," + 0.42 * on + ")");
          sp.addColorStop(1, "rgba(255,190,120,0)");
          ctx.fillStyle = sp;
          ctx.beginPath();
          ctx.ellipse(0, 0, 15, 11, 0, 0, 7);
          ctx.fill();
        }
        const hw = 8.5,
          hh2 = 4.4;
        ctx.fillStyle = K > 0.02 ? col(52, 56, 62) : col(128, 133, 140);
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(-hw, -hh2, hw * 2, hh2 * 2, hh2)
          : ctx.rect(-hw, -hh2, hw * 2, hh2 * 2);
        ctx.fill();
        ctx.strokeStyle = K > 0.02 ? col(96, 102, 110) : col(176, 181, 188);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-hw + hh2, -hh2 + 0.6);
        ctx.lineTo(hw - hh2, -hh2 + 0.6);
        ctx.stroke();
        ctx.fillStyle = K > 0.02 ? col(40, 43, 48) : col(104, 109, 116);
        ctx.fillRect(-hw + 2.5, -0.6, hw * 2 - 5, 1.2); // housing seam
        ctx.restore();
      }
    }
  ctx.restore();
}

// city ellipses (px) for night relief + sky glow
function dnCities() {
  if (DN.cities) return DN.cities;
  const out = [];
  for (const k in world.cities || {}) {
    const c = world.cities[k];
    if (!c || !c.xs) continue;
    const x0 = c.xs[0] * TILE,
      y0 = c.ys[0] * TILE,
      x1 = c.X1 * TILE,
      y1 = c.Y1 * TILE;
    out.push({
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      rx: Math.max(400, (x1 - x0) / 2),
      ry: Math.max(400, (y1 - y0) / 2),
    });
  }
  return (DN.cities = out);
}
// traffic signal heads at night: drawn above the darkness at full brightness, halo + coloured spill on the road at the stop line
function drawSigNight() {
  let A = DN.sig;
  DN.sig = [];
  const K = DN.dark;
  if (!A || !A.length || K < 0.01) return;
  ctx.save();
  // v53: puffin units (ped) from drawUkjx: own glow
  const Pd = A.filter((s) => s.ped);
  A = A.filter((s) => !s.ped);
  const gl = (col, x, y, r, a) => {
    ctx.globalAlpha = a;
    ctx.drawImage(dnGlow(col), x - r, y - r, r * 2, r * 2);
  };
  ctx.globalCompositeOperation = "lighter";
  for (const s of A) {
    const col =
      s.disc || s.arrows.length
        ? "rgba(60,255,110,1)"
        : s.amb
          ? "rgba(255,170,30,1)"
          : "rgba(255,40,30,1)";
    gl(col, s.x - s.f[0] * 34, s.y - s.f[1] * 34, 30, 0.45 * K);
  }
  ctx.globalCompositeOperation = "source-over";
  for (const s of A) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c99e1e";
    ctx.fillRect(-15, -7, 30, 14);
    ctx.fillStyle = "#17191c";
    ctx.fillRect(-13, -5, 26, 10);
    const lamp = (xx, on, c, d) => {
      ctx.fillStyle = on ? c : d;
      ctx.beginPath();
      ctx.arc(xx, 0, on ? 3.8 : 3.3, 0, 7);
      ctx.fill();
      if (on) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(xx, 0, 1.4, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    lamp(8, s.red, "#ff3b30", "#3a1210");
    lamp(0, s.amb, "#ffb020", "#3a2a10");
    lamp(-8, s.disc || s.arrows.length > 0, "#3dff66", "#10240f");
    ctx.restore();
  }
  ctx.globalCompositeOperation = "lighter";
  for (const s of A) {
    const c = Math.cos(s.a),
      n = Math.sin(s.a),
      at = (xx) => [s.x + c * xx, s.y + n * xx];
    if (s.red) {
      const p = at(8);
      gl("rgba(255,40,30,1)", p[0], p[1], 20, 0.95);
    }
    if (s.amb) {
      const p = at(0);
      gl("rgba(255,170,30,1)", p[0], p[1], 20, 0.95);
    }
    if (s.disc || s.arrows.length) {
      const p = at(-8);
      gl("rgba(60,255,110,1)", p[0], p[1], 20, 0.95);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  for (const s of Pd) ukjxPed([s.x, s.y], s.a, s.g);
  ctx.globalCompositeOperation = "lighter";
  for (const s of Pd) gl(s.g ? "rgba(60,255,110,1)" : "rgba(255,40,30,1)", s.x, s.y, 9, 0.7);
  ctx.restore();
}
