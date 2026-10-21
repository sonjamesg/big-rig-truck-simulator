/**
 * @file gfx.js — GRAPHICS UPGRADE (2D, no pixel art): quality level + FPS-based automatic low-quality fallback and a
 *   Graphics setting; stage 1 lighting: sunrise/sunset colour grading (multiply tint + sun-side warmth + vignette),
 *   warm headlight light on the road, streetlight pools, window glow, day + night brake / indicator glow with road
 *   spill, and vehicles lit by nearby lamps and other vehicles' headlights. The darkness itself stays the light/darkness
 *   compositing layer of daynight.js (drawNight: a low-res mask with lights cut out, then additive colour).
 * Exposes (globals): GFX, GFX_LOW_FPS, gfxHi, gfxSet, gfxGradeAt, gfxGrade, gfxLights, gfxVehLit, gfxBloomBegin,
 *   gfxBloomEnd (+ gfx* helpers). v61: night bloom on the light layer (high quality only).
 * Depends on: daynight.js (DN, drawNight, dnVehs, dnGlow, slOn, SL), main.js (ctx, RSF, VW, VH, cam), traffic.js
 *   (traffic, VTYPES), indicators.js (indBlink), ui.js (toast)
 * Load order: after liftbridge.js in build.py (wraps drawNight). All files share one global scope (see AGENTS.md).
 */
// ---------------------------------------------------------------- quality: "auto" | "high" | "low" (localStorage)
const GFX_LOW_FPS = 30; // auto mode drops to low quality after ~6 s below this
const GFX = { q: "auto", lvl: "high", ema: 60, slowT: 0, last: 0, n: 0, off: {} }; // off: per-effect switches for profiling
{
  let q = null;
  try {
    q = localStorage.getItem("bigrig.gfx");
  } catch (e) {
    q = null; // storage blocked (private mode / sandboxed iframe): stay on auto
  }
  GFX.q = q === "high" || q === "low" ? q : "auto";
  GFX.lvl = GFX.q === "low" ? "low" : "high";
}
function gfxHi() {
  return GFX.lvl === "high";
}
function gfxSet(q) {
  GFX.q = q === "high" || q === "low" ? q : "auto";
  GFX.lvl = GFX.q === "low" ? "low" : "high";
  GFX.slowT = 0;
  try {
    localStorage.setItem("bigrig.gfx", GFX.q);
  } catch (e) {
    GFX.saveErr = String(e); // not persisted; the choice still applies for this session
  }
  if (typeof gfxQualityChanged === "function") gfxQualityChanged();
}
// frame-rate monitor (its own rAF tick = the display frame rate); auto mode falls back once, never flip-flops
function gfxTick(t) {
  const dt = GFX.last ? t - GFX.last : 16.7;
  GFX.last = t;
  if (dt > 0 && dt < 500 && !document.hidden && typeof started !== "undefined" && started) {
    GFX.ema += (1000 / dt - GFX.ema) * 0.05;
    GFX.n++;
    if (GFX.q === "auto" && GFX.lvl === "high" && GFX.n > 120 && GFX.ema < GFX_LOW_FPS) {
      GFX.slowT += dt;
      if (GFX.slowT > 6000) {
        GFX.lvl = "low";
        GFX.auto = 1;
        if (typeof gfxQualityChanged === "function") gfxQualityChanged();
        if (typeof toast === "function")
          toast("\u2699 Graphics set to Low for a smoother frame rate");
      }
    } else GFX.slowT = 0;
  }
  requestAnimationFrame(gfxTick);
}
requestAnimationFrame(gfxTick);
// settings panel (home screen): Graphics Auto / High / Low
addEventListener("load", () => {
  const ov = document.getElementById("overlay");
  if (!ov || document.getElementById("gfxQ")) return;
  const d = document.createElement("div");
  d.style.cssText =
    "margin-top:10px;display:flex;align-items:center;gap:8px;justify-content:center;color:#cfd6e0;font-weight:700;pointer-events:auto";
  d.innerHTML =
    '<label style="display:flex;align-items:center;gap:8px">\u{1F3A8} Graphics <select id="gfxQ" style="font:inherit;font-weight:800;padding:6px 8px;border-radius:8px;background:#1d2633;color:#fff;border:1px solid rgba(255,255,255,.25)"><option value="auto">Auto</option><option value="high">High</option><option value="low">Low (phones)</option></select></label>';
  (document.getElementById("setPanel") || ov).appendChild(d);
  const el = d.querySelector("select");
  el.value = GFX.q;
  el.addEventListener("change", () => gfxSet(el.value));
  for (const ev of ["pointerdown", "click", "touchstart"])
    d.addEventListener(ev, (e) => e.stopPropagation());
});
const GL = { tint: null, tintF: null, vig: null };
// ---------------------------------------------------------------- colour grading by time of day
// keyframes: hour, multiply tint rgb + strength, additive sun-side warmth rgb + strength
const GFX_GRADE = [
  [0, [255, 255, 255], 0, [0, 0, 0], 0],
  [4.6, [255, 255, 255], 0, [0, 0, 0], 0],
  [5.3, [190, 165, 235], 0.26, [255, 150, 190], 0.04],
  [6.2, [255, 175, 150], 0.3, [255, 170, 110], 0.12],
  [7.2, [255, 210, 160], 0.16, [255, 200, 130], 0.07],
  [8.6, [255, 248, 235], 0.03, [0, 0, 0], 0],
  [12, [255, 250, 238], 0.04, [0, 0, 0], 0],
  [16.4, [255, 236, 200], 0.08, [255, 210, 150], 0.03],
  [17.8, [255, 196, 140], 0.22, [255, 170, 90], 0.09],
  [18.7, [255, 150, 95], 0.36, [255, 120, 60], 0.13],
  [19.4, [225, 120, 150], 0.38, [255, 90, 110], 0.07],
  [20.2, [125, 135, 225], 0.34, [120, 120, 255], 0.02],
  [21.2, [255, 255, 255], 0, [0, 0, 0], 0],
  [24, [255, 255, 255], 0, [0, 0, 0], 0],
];
function gfxGradeAt(h) {
  const K = GFX_GRADE;
  let i = 0;
  while (i < K.length - 2 && K[i + 1][0] <= h) i++;
  const a = K[i],
    b = K[i + 1],
    t = Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0] || 1))),
    L = (p, q) => p + (q - p) * t,
    M = (p, q) => p.map((v, k) => Math.round(L(v, q[k])));
  // a zero-strength key keeps the colour of its neighbour so strength alone fades
  const mc = a[2] === 0 ? b[1] : b[2] === 0 ? a[1] : M(a[1], b[1]),
    ac = a[4] === 0 ? b[3] : b[4] === 0 ? a[3] : M(a[3], b[3]);
  return { mul: mc, ma: L(a[2], b[2]), add: ac, aa: L(a[4], b[4]) };
}
// sun direction on screen (unit vector from the screen toward the sun): east in the morning, west in the evening
function gfxSunDir(h) {
  const a = ((160 + ((h - 6) / 12) * -230) * Math.PI) / 180; // shadow angle; the sun is opposite
  return [-Math.cos(a), -Math.sin(a)];
}
function gfxGrade() {
  const g = gfxGradeAt(gameT),
    W = VW,
    H = VH,
    hi = gfxHi(),
    vg = hi ? Math.min(0.3, g.ma * 0.6) : 0; // vignette at dawn / dusk only
  if (g.ma < 0.005 && g.aa < 0.005) return;
  // both passes come from small cached sprites rebuilt every ~3 game-minutes, so a frame costs two blits
  const key = W + "x" + H + ":" + Math.round(gameT * 20) + ":" + hi;
  if (GL.gk !== key) {
    GL.gk = key;
    const cw = Math.ceil(W / 4),
      chh = Math.ceil(H / 4),
      mk = (c) => (
        (c = c || document.createElement("canvas")),
        (c.width = cw),
        (c.height = chh),
        c
      );
    // multiply sprite: tint mixed toward white by strength, edges darkened by the vignette
    const m = (GL.gm = mk(GL.gm)),
      mq = m.getContext("2d"),
      mix = g.mul.map((v) => Math.round(255 + (v - 255) * g.ma));
    mq.fillStyle = "rgb(" + mix.join(",") + ")";
    mq.fillRect(0, 0, cw, chh);
    if (vg > 0.01) {
      const gr = mq.createRadialGradient(
        cw / 2,
        chh / 2,
        Math.min(cw, chh) * 0.35,
        cw / 2,
        chh / 2,
        Math.hypot(cw, chh) * 0.6,
      );
      gr.addColorStop(0, "rgba(10,8,25,0)");
      gr.addColorStop(1, "rgba(10,8,25," + vg.toFixed(3) + ")");
      mq.fillStyle = gr;
      mq.fillRect(0, 0, cw, chh);
    }
    // additive sprite: warm/cool wash from the sun side (high quality only)
    GL.ga = null;
    if (g.aa > 0.005 && hi) {
      const c = (GL.ga = mk(GL.gaC || (GL.gaC = document.createElement("canvas")))),
        q = c.getContext("2d"),
        s = gfxSunDir(gameT),
        R = Math.hypot(cw, chh) / 2,
        gr = q.createLinearGradient(
          cw / 2 + s[0] * R,
          chh / 2 + s[1] * R,
          cw / 2 - s[0] * R,
          chh / 2 - s[1] * R,
        ),
        rgb = g.add.join(",");
      gr.addColorStop(0, "rgba(" + rgb + "," + g.aa.toFixed(3) + ")");
      gr.addColorStop(0.6, "rgba(" + rgb + "," + (g.aa * 0.25).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(" + rgb + ",0)");
      q.fillStyle = gr;
      q.fillRect(0, 0, cw, chh);
    }
  }
  ctx.save();
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  if (g.ma > 0.005 || vg > 0.01) {
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(GL.gm, 0, 0, W, H);
  }
  if (GL.ga) {
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(GL.ga, 0, 0, W, H);
  }
  ctx.restore();
}
// ---------------------------------------------------------------- additive lights drawn after the darkness layer
function gfxTintOf(c, col) {
  const t = document.createElement("canvas");
  t.width = c.width;
  t.height = c.height;
  const g = t.getContext("2d");
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = col;
  g.fillRect(0, 0, t.width, t.height);
  return t;
}
function gfxLights(vx0, vy0, vx1, vy1, z) {
  const K = DN.dark,
    hi = gfxHi(),
    day = 1 - K;
  const veh = dnVehs(),
    on = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
  ctx.save();
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  const gz = (col, x, y, r, a) => {
    if (a < 0.01) return;
    const R = r * z;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(dnGlow(col), (x - vx0) * z - R, (y - vy0) * z - R, R * 2, R * 2);
    if (bl) {
      const s = bl.width / VW;
      bl.g.globalAlpha = Math.min(1, a);
      bl.g.drawImage(
        dnGlow(col),
        ((x - vx0) * z - R * 2) * s,
        ((y - vy0) * z - R * 2) * s,
        R * 4 * s,
        R * 4 * s,
      );
    }
  };
  const bl = hi && K > 0.05 && !GFX.off.bloom ? gfxBloomBegin() : null;
  if (K > 0.02 && DN.coneD && hi) {
    // coloured light layer: half-res canvas, all night light colour added here, then one additive composite
    const q = hi ? 0.5 : 0.34,
      LW = Math.ceil(VW * q),
      LH = Math.ceil(VH * q);
    if (!GL.lc || GL.lc.width !== LW || GL.lc.height !== LH) {
      GL.lc = document.createElement("canvas");
      GL.lc.width = LW;
      GL.lc.height = LH;
      GL.lg = GL.lc.getContext("2d");
    }
    const Lg = GL.lg,
      zq = z * q;
    Lg.setTransform(1, 0, 0, 1, 0, 0);
    Lg.globalCompositeOperation = "source-over";
    Lg.globalAlpha = 1;
    Lg.clearRect(0, 0, LW, LH);
    Lg.globalCompositeOperation = "lighter";
    const gl = (col, x, y, r, a) => {
      if (a < 0.01) return;
      const R = r * zq;
      Lg.globalAlpha = Math.min(1, a);
      Lg.drawImage(dnGlow(col), (x - vx0) * zq - R, (y - vy0) * zq - R, R * 2, R * 2);
    };
    if (!GL.tint) {
      GL.tint = gfxTintOf(DN.coneD, "rgb(255,214,150)");
      GL.tintF = gfxTintOf(DN.coneF, "rgb(240,236,220)");
    }
    // warm light thrown on the road by headlights (same cone shapes as the darkness cut-outs)
    if (!GFX.off.cones)
      for (const V of veh) {
        const x = V.fx * PPM,
          y = V.fy * PPM;
        if (!on(x, y, 400)) continue;
        Lg.save();
        Lg.translate((x - vx0) * zq, (y - vy0) * zq);
        Lg.rotate(Math.atan2(V.f[1], V.f[0]));
        const s = zq * (V.big ? 1.55 : 1.1) * (V.bm || 1),
          hk = V.hb || 0;
        Lg.scale(s, s);
        Lg.globalAlpha = (V.big ? 0.3 : 0.22) * K * (1 - hk); // v51 overhaul: stronger cones
        if (Lg.globalAlpha > 0.005) Lg.drawImage(GL.tint, 0, -64);
        if (hk > 0.001) {
          Lg.globalAlpha = 0.24 * K * hk;
          Lg.drawImage(GL.tintF, 0, -100);
        }
        Lg.restore();
      }
    // streetlight pools: a wide sodium-warm pool on the ground under every lit lamp head
    if (SL.grid && !GFX.off.pools) {
      const C = SL.cell;
      for (let cy = Math.floor((vy0 - 200) / C); cy <= Math.floor((vy1 + 200) / C); cy++)
        for (let cx = Math.floor((vx0 - 200) / C); cx <= Math.floor((vx1 + 200) / C); cx++) {
          const a = SL.grid.get(cx + "," + cy);
          if (a)
            for (const l of a) {
              if (!on(l.hx, l.hy, 160)) continue;
              const so = slOn(l);
              if (so < 0.02) continue;
              gl("rgba(255,184,104,1)", l.hx, l.hy, 120, 0.2 * so * K);
              if (hi) gl("rgba(255,214,150,1)", l.hx, l.hy, 64, 0.07 * so * K); // v64: soft, no white bulb core
            }
        }
    }
    // windows: a soft halo per lit building
    if (hi && DN.grid && !GFX.off.halos) {
      const Cc = DN.cell;
      let nb = 0;
      for (let cy = Math.floor((vy0 - 300) / Cc); cy <= Math.floor((vy1 + 300) / Cc); cy++)
        for (let cx = Math.floor((vx0 - 300) / Cc); cx <= Math.floor((vx1 + 300) / Cc); cx++) {
          const a = DN.grid.get(cx + "," + cy);
          if (a)
            for (const l of a) {
              // on-screen test first, then a generous cap (was 300 in grid order: halos came and went with the camera)
              if (l.k !== "b" || !on(l.x, l.y, 250) || nb++ > 2500) continue;
              const o = l.o;
              const f = typeof g3LitShare === "function" ? g3LitShare(l) : 0,
                R = Math.min(170, Math.max(o.w, o.h) * 0.55);
              const b = typeof gfxBOff === "function" ? gfxBOff(o) : null,
                bx = l.x + (b ? b[0] : 0),
                by = l.y + (b ? b[1] : 0);
              if (f > 0.25) gl("rgba(255,196,120,1)", bx, by, R, 0.12 * f * K);
            }
        }
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(GL.lc, 0, 0, VW, VH);
    if (bl) {
      bl.g.globalAlpha = 1;
      bl.g.drawImage(GL.lc, 0, 0, bl.width, bl.height);
    }
  }
  // brake / indicator / reversing glow by day and night (night adds a spill pool on the road)
  const blink = typeof indBlink === "function" && indBlink();
  for (const V of veh) {
    if (!on(V.rx * PPM, V.ry * PPM, 200)) continue;
    const rf = V.rf,
      rr = [-rf[1], rf[0]],
      rw = V.rW / 2 - 0.12;
    for (const sd of V.one ? [0] : [-1, 1]) {
      const lx = V.rx + rr[0] * sd * rw,
        ly = V.ry + rr[1] * sd * rw;
      if (V.br) gz("rgba(255,40,30,1)", lx * PPM, ly * PPM, 9, 0.55 * day + 0.2 * K);
      const ind = V.haz || (V.side === 1 && sd < 0) || (V.side === 2 && sd > 0);
      if (ind && blink) {
        gz("rgba(255,170,20,1)", lx * PPM, ly * PPM, 10, 0.6 * day + 0.3 * K);
        if (K > 0.05)
          gz(
            "rgba(255,150,20,1)",
            (lx - rf[0] * 1.2) * PPM,
            (ly - rf[1] * 1.2) * PPM,
            26,
            0.35 * K,
          );
      }
    }
    if (V.br && K > 0.05)
      gz("rgba(255,30,20,1)", (V.rx - rf[0] * 3) * PPM, (V.ry - rf[1] * 3) * PPM, 40, 0.22 * K);
  }
  if (hi && K > 0.05) gfxVehLit(vx0, vy0, vx1, vy1, z, veh, on);
  if (bl) gfxBloomEnd(bl, K);
  ctx.restore();
}
// v61 bloom (high quality, night only): the coloured light layer (GL.lc) and the brake / indicator glows are copied
// into a 1/8-res buffer, box-blurred with a few offset additive draws into a second buffer, then added back over the
// screen with a controlled alpha. Two tiny canvases + ~6 blits a frame; no full-screen capture.
function gfxBloomBegin() {
  const w = Math.max(16, Math.ceil(VW / 8)),
    h = Math.max(10, Math.ceil(VH / 8));
  for (const k of ["bA", "bB"])
    if (!GL[k] || GL[k].width !== w || GL[k].height !== h) {
      GL[k] = document.createElement("canvas");
      GL[k].width = w;
      GL[k].height = h;
      GL[k].g = GL[k].getContext("2d");
    }
  const b = GL.bA;
  b.g.globalCompositeOperation = "source-over";
  b.g.globalAlpha = 1;
  b.g.clearRect(0, 0, w, h);
  b.g.globalCompositeOperation = "lighter";
  return b;
}
function gfxBloomEnd(b, K) {
  const o = GL.bB,
    q = o.g;
  q.globalCompositeOperation = "source-over";
  q.globalAlpha = 1;
  q.clearRect(0, 0, o.width, o.height);
  q.globalCompositeOperation = "lighter";
  q.globalAlpha = 0.22;
  for (const [dx, dy] of [
    [0, 0],
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ])
    q.drawImage(b, dx, dy);
  q.globalAlpha = 0.12;
  for (const [dx, dy] of [
    [-3, -3],
    [3, 3],
    [3, -3],
    [-3, 3],
  ])
    q.drawImage(b, dx, dy);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(0.6, 0.55 * K);
  ctx.drawImage(o, 0, 0, VW, VH);
  ctx.globalAlpha = 1;
}
// vehicles caught in lamp pools or another vehicle's headlights get a soft body highlight (body-sized, oriented)
function gfxVehLit(vx0, vy0, vx1, vy1, z, veh, on) {
  const K = DN.dark,
    list = [];
  list.push({ x: truck.x, y: truck.y, h: truck.h, L: 7, W: 2.5 });
  if (truck.trl) {
    const k = kingpin(truck),
      f = fwd(truck.th);
    list.push({ x: k[0] - f[0] * 5.6, y: k[1] - f[1] * 5.6, h: truck.th, L: 13.6, W: 2.55 });
  }
  for (const v of traffic.vs)
    if (v.x !== undefined) list.push({ x: v.x, y: v.y, h: v.h || 0, L: v.L || 4.4, W: v.W || 1.8 });
  const C = SL.cell;
  for (const b of list) {
    const X = b.x * PPM,
      Y = b.y * PPM;
    if (!on(X, Y, 60)) continue;
    let I = 0;
    // lamps within 150 px of the vehicle
    const a = SL.grid && SL.grid.get(Math.floor(X / C) + "," + Math.floor(Y / C));
    if (a)
      for (const l of a) {
        const d = Math.hypot(l.hx - X, l.hy - Y);
        if (d < 150) I += (1 - d / 150) * slOn(l) * 0.7;
      }
    // headlights of other vehicles pointing at it (within 26 m, 28 degrees)
    for (const V of veh) {
      const dx = b.x - V.fx,
        dy = b.y - V.fy,
        d = Math.hypot(dx, dy);
      if (d < 1 || d > 26) continue;
      const c = (dx * V.f[0] + dy * V.f[1]) / d;
      if (c > 0.88) I += (1 - d / 26) * (c - 0.88) * 8 * (V.big ? 1.2 : 0.9);
    }
    if (I < 0.05) continue;
    ctx.save();
    ctx.translate((X - vx0) * z, (Y - vy0) * z);
    ctx.rotate(b.h);
    ctx.globalAlpha = Math.min(0.42, I * 0.3) * K;
    const w = b.W * PPM * z * 1.2,
      l = b.L * PPM * z * 1.1;
    ctx.drawImage(dnGlow("rgba(255,232,190,1)"), -w / 2, -l / 2, w, l);
    ctx.restore();
  }
}
{
  const dn = drawNight;
  drawNight = function (vx0, vy0, vx1, vy1, z) {
    gfxGrade();
    const d = DN.dusk;
    DN.dusk = 0; // the old flat dusk multiply is replaced by gfxGrade
    try {
      dn.apply(this, arguments);
    } finally {
      DN.dusk = d;
    }
    gfxLights(vx0, vy0, vx1, vy1, z);
  };
}
