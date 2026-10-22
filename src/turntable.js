/**
 * @file turntable.js — 360° turntable view of the whole truck (garage showroom + customiser).
 * A light 2.5D renderer: the truck is built from two part blocks (cab, chassis) with real dimensions
 * (RIG spec for the starter truck, CAB/model style for the rest). Each block face is a texture —
 * side = the detailed side profile (czSide, so paint + every mod shows), top = the in-game top-down art (czArt),
 * front / rear = drawn here from the same dimensions and look. Faces are mapped with exact affine transforms
 * (orthographic camera, yaw + pitch) and painter-sorted, so front, rear, sides and every angle between come
 * from the same data. Lighting is baked per face (sun from front-left, above).
 */
const TT = { cache: {}, n: 0 };
function ttDims(m) {
  const st = m.style || {},
    rig = m.id === "rigger" && typeof RIG !== "undefined";
  const nose = st.nose || 0,
    roofH = rig ? RIG.cab.roof : st.roof === "high" ? 3.9 : st.roof === "aero" ? 3.6 : 3.2;
  return {
    rig,
    x0: -5.0 - nose,
    nose,
    xc: rig ? RIG.cab.x1 : -2.4,
    x1: 1.25,
    zw: 1.25,
    roofH,
    top: rig ? RIG.spoiler.top : roofH,
    chH: 1.65,
  };
}
function ttShade(src, a, tint) {
  const c = mkCanvas(src.width, src.height),
    g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = tint || (a > 0 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${-a})`);
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
// ---- front face texture (z across, y up) ----
function ttFront(m, col, fit, D) {
  const L = czLook(m.id, fit),
    hide = typeof rigHide === "function" ? rigHide(fit, L) : {};
  col = L.col || col;
  const K = 60,
    zx = 1.7,
    Wt = Math.ceil(zx * 2 * K),
    Ht = Math.ceil((D.top + 0.7) * K),
    c = mkCanvas(Wt, Ht),
    g = c.getContext("2d");
  const X = (z) => Wt / 2 + z * K,
    Y = (y) => Ht - y * K,
    R = (x0, y0, x1, y1, f, r) => {
      g.fillStyle = f;
      rr(g, X(x0), Y(y1), (x1 - x0) * K, (y1 - y0) * K, (r || 0) * K);
      g.fill();
    };
  // tyres under the bumper
  for (const s of [-1, 1]) R(s > 0 ? 0.8 : -1.2, 0, s > 0 ? 1.2 : -0.8, 1.04, "#2c2f33", 0.08);
  // cab front
  const gr = g.createLinearGradient(0, Y(D.roofH), 0, Y(0.45));
  gr.addColorStop(0, shade(col, 1.12));
  gr.addColorStop(1, shade(col, 0.82));
  R(-1.25, 0.45, 1.25, D.roofH, gr, 0.12);
  // roof spoiler seen from the front (narrower, sloped back)
  if (D.rig) {
    g.fillStyle = shade(col, 1.2);
    g.beginPath();
    g.moveTo(X(-1.2), Y(D.roofH));
    g.lineTo(X(-1.05), Y(D.top));
    g.lineTo(X(1.05), Y(D.top));
    g.lineTo(X(1.2), Y(D.roofH));
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(X(-1.0), Y(D.top - 0.05), 2.0 * K, 0.06 * K);
  }
  // windscreen + wipers
  const wg = g.createLinearGradient(0, Y(2.9), 0, Y(2.0));
  wg.addColorStop(0, "#4a6782");
  wg.addColorStop(1, "#141e29");
  R(-1.1, 2.0, 1.1, 2.88, wg, 0.1);
  g.fillStyle = "rgba(220,240,255,0.18)";
  g.beginPath();
  g.moveTo(X(-0.9), Y(2.88));
  g.lineTo(X(-0.55), Y(2.88));
  g.lineTo(X(-0.85), Y(2.0));
  g.lineTo(X(-1.1), Y(2.0));
  g.fill();
  g.strokeStyle = "#111";
  g.lineWidth = 0.035 * K;
  for (const s of [-0.7, 0.15]) {
    g.beginPath();
    g.moveTo(X(s), Y(2.05));
    g.lineTo(X(s + 0.5), Y(2.4));
    g.stroke();
  }
  // grille: dark with horizontal slats + badge bar
  R(-0.85, 1.42, 0.85, 1.95, "#141517", 0.05);
  g.fillStyle = shade(col, 0.6);
  for (let k = 0; k < 4; k++) g.fillRect(X(-0.8), Y(1.52 + k * 0.11), 1.6 * K, 0.04 * K);
  R(-0.35, 1.85, 0.35, 1.93, "#cfd3d8", 0.02);
  // bumper: body-colour upper with lamps, black lower, step recesses
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(X(-1.25), Y(1.42), 2.5 * K, 0.03 * K);
  R(-1.25, 0.45, 1.25, 0.78, "#151618", 0.06);
  for (const s of [-1, 1]) {
    R(s > 0 ? 0.62 : -1.18, 0.98, s > 0 ? 1.18 : -0.62, 1.28, "#1a1b1d", 0.05);
    R(s > 0 ? 0.68 : -1.0, 1.02, s > 0 ? 1.0 : -0.68, 1.24, "#fffbe6", 0.04);
    R(s > 0 ? 1.02 : -1.14, 1.02, s > 0 ? 1.14 : -1.02, 1.24, "#f0a020", 0.02);
    R(s > 0 ? 0.75 : -0.95, 0.58, s > 0 ? 0.95 : -0.75, 0.68, "#e8ecef", 0.03); // fog lamps
  }
  R(-0.35, 0.55, 0.35, 0.72, "#f2f2ee", 0.02); // number plate
  // roof marker lamps / light bar mod
  if (!hide.lamps) for (let k = -2; k <= 2; k++) R(k * 0.25 - 0.05, D.roofH - 0.08, k * 0.25 + 0.05, D.roofH - 0.02, "#f5a623");
  if (L.rbar) {
    R(-1.0, D.roofH - 0.02, 1.0, D.roofH + 0.1, "#2b2e33", 0.03);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = "#fff6c8";
      g.beginPath();
      g.arc(X(-0.85 + k * 0.34), Y(D.roofH + 0.18), 0.09 * K, 0, 7);
      g.fill();
    }
  }
  if (L.bcn) {
    g.fillStyle = "#ff9a1a";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(X(s * 0.95), Y(D.top + 0.06), 0.12 * K, 0.12 * K, 0, Math.PI, 0);
      g.fill();
    }
  }
  if (L.vis) R(-1.2, 2.86, 1.2, 3.0, L.vis > 1 ? "#dfe3e7" : "#151515", 0.03);
  if (L.bmp) {
    const bc = L.bmp === 4 ? "#2b2e33" : "#dfe3e7";
    R(-1.3, 0.62, 1.3, 0.78, bc, 0.05);
    if (L.bmp > 1) for (const s of [-0.9, -0.3, 0.3, 0.9]) R(s - 0.04, 0.62, s + 0.04, L.bmp === 4 ? 1.5 : 1.9, bc);
  }
  if (L.led) {
    g.fillStyle = L.led;
    g.fillRect(X(-1.2), Y(0.8), 2.4 * K, 0.04 * K);
  }
  // mirrors on arms
  for (const s of [-1, 1]) {
    g.strokeStyle = "#151618";
    g.lineWidth = 0.06 * K;
    g.beginPath();
    g.moveTo(X(s * 1.22), Y(2.75));
    g.lineTo(X(s * 1.45), Y(2.8));
    g.stroke();
    R(s > 0 ? 1.38 : -1.55, 2.2, s > 0 ? 1.55 : -1.38, 2.95, "#151618", 0.05);
  }
  g.strokeStyle = "rgba(0,0,0,0.4)";
  g.lineWidth = 1.5;
  rr(g, X(-1.25), Y(D.roofH), 2.5 * K, (D.roofH - 0.45) * K, 0.12 * K);
  g.stroke();
  return { c, K, zx, Ht };
}
// ---- cab back + chassis rear textures ----
function ttBack(m, col, fit, D) {
  const L = czLook(m.id, fit);
  col = L.col || col;
  const K = 60,
    zx = 1.4,
    Wt = Math.ceil(zx * 2 * K),
    Ht = Math.ceil((D.top + 0.1) * K),
    c = mkCanvas(Wt, Ht),
    g = c.getContext("2d");
  const X = (z) => Wt / 2 + z * K,
    Y = (y) => Ht - y * K;
  g.fillStyle = shade(col, 0.8);
  rr(g, X(-1.2), Y(D.top), 2.4 * K, (D.top - 1.0) * K, 0.1 * K);
  g.fill();
  g.fillStyle = "#121314";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 1.08 : -1.3), Y(D.top), 0.22 * K, (D.top - 1.0) * K);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(X(-0.9), Y(2.6), 1.8 * K, 0.04 * K);
  g.fillStyle = "#2a2d31";
  g.fillRect(X(-0.5), Y(1.6), 1.0 * K, 0.5 * K); // air-line connectors panel
  g.fillStyle = "#c0392b";
  g.fillRect(X(-0.35), Y(1.9), 0.18 * K, 0.18 * K);
  g.fillStyle = "#2e6fd0";
  g.fillRect(X(0.15), Y(1.9), 0.18 * K, 0.18 * K);
  const c2Ht = Math.ceil(1.9 * K),
    c2 = mkCanvas(Wt, c2Ht),
    h = c2.getContext("2d"),
    Y2 = (y) => c2Ht - y * K;
  for (const s of [-1, 1]) {
    h.fillStyle = "#2c2f33";
    h.fillRect(X(s > 0 ? 0.74 : -1.26), Y2(1.04), 0.52 * K, 1.04 * K);
    h.fillStyle = "rgba(0,0,0,0.4)";
    h.fillRect(X(s > 0 ? 0.99 : -1.01), Y2(1.04), 0.02 * K, 1.04 * K);
    h.fillStyle = "#141517";
    h.fillRect(X(s > 0 ? 0.7 : -1.3), Y2(1.2), 0.6 * K, 0.16 * K);
    if (!L.mud || L.mud) {
      h.fillStyle = "#18191b";
      h.fillRect(X(s > 0 ? 0.72 : -1.28), Y2(1.0), 0.56 * K, 0.8 * K);
      if (L.mud > 1) {
        h.fillStyle = "#e6eaee";
        h.fillRect(X(s > 0 ? 0.72 : -1.28), Y2(0.3), 0.56 * K, 0.08 * K);
      }
    }
    // rear lamp cluster on the chassis end
    h.fillStyle = "#1a1b1e";
    h.fillRect(X(s > 0 ? 0.3 : -0.7), Y2(1.3), 0.4 * K, 0.16 * K);
    h.fillStyle = "#e0312b";
    h.fillRect(X(s > 0 ? 0.33 : -0.67), Y2(1.27), 0.2 * K, 0.1 * K);
    h.fillStyle = "#f0a020";
    h.fillRect(X(s > 0 ? 0.55 : -0.45), Y2(1.27), 0.12 * K, 0.1 * K);
  }
  h.fillStyle = "#151618";
  h.fillRect(X(-0.56), Y2(1.6), 1.12 * K, 0.32 * K);
  h.fillStyle = "#3b3f44";
  h.fillRect(X(-0.75), Y2(1.65), 1.5 * K, 0.1 * K);
  return { cab: c, rear: c2, K, zx, Ht, Ht2: c2Ht };
}
function ttTex(m, col, fit) {
  const key = m.id + "|" + col + "|" + JSON.stringify(fit);
  if (TT.cache[key]) return TT.cache[key];
  if (++TT.n > 12) {
    TT.cache = {};
    TT.n = 1;
  }
  const D = ttDims(m),
    K = 60,
    sx0 = D.x0 - 0.9,
    sx1 = 1.7,
    sy1 = D.top + 1.4,
    sw = Math.ceil((sx1 - sx0) * K),
    sh = Math.ceil((sy1 + 0.2) * K);
  const side = mkCanvas(sw, sh),
    sg = side.getContext("2d");
  czSide(sg, -sx0 * K, sy1 * K, K, m, col, fit);
  const A = czArt(m, col, fit),
    F = ttFront(m, col, fit, D),
    B = ttBack(m, col, fit, D);
  // erase the baked ground shadow from the side texture (the turntable draws its own)
  sg.globalCompositeOperation = "destination-out";
  sg.fillRect(0, sy1 * K + 0.06 * K, sw, sh);
  sg.globalCompositeOperation = "source-over";
  const T = {
    D,
    K,
    sx0,
    sy1,
    sideL: ttShade(side, 0.0),
    sideR: ttShade(side, 0.28),
    front: ttShade(F.c, 0.1),
    F,
    back: ttShade(B.cab, 0.35),
    rear: ttShade(B.rear, 0.3),
    B,
    top: ttShade(A.c, -0.06),
    A,
    S: PPM * ART_SCALE,
  };
  return (TT.cache[key] = T);
}
// draw the truck at (cx, cy) = ground centre, k px per metre, yaw (rad), pitch (rad)
function ttDraw(g, cx, cy, k, yaw, pitch, m, col, fit) {
  const T = ttTex(m, col, fit),
    D = T.D,
    xm = (D.x0 + D.x1) / 2;
  const cs = Math.cos(yaw),
    sn = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const P = (x, y, z) => {
    const xr = x - xm,
      X1 = xr * cs - z * sn,
      Z1 = xr * sn + z * cs;
    return [cx + k * X1, cy - k * (y * cp - Z1 * sp), Z1 * cp + y * sp];
  };
  // ground shadow: projected footprint, soft
  g.save();
  g.filter = "blur(" + Math.round(k * 0.18) + "px)";
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.beginPath();
  [
    [D.x0, -D.zw],
    [D.x1, -D.zw],
    [D.x1, D.zw],
    [D.x0, D.zw],
  ].forEach(([x, z], i) => {
    const p = P(x, 0, z);
    i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
  });
  g.fill();
  g.restore();
  const faces = [];
  // face: texture img, source rect (sx,sy,sw,sh), world corners for source (0,0),(sw,0),(0,sh); n = outward normal (for culling)
  const add = (img, sx, sy, sw, sh, p0, p1, p2, n) => {
    const q0 = P(...p0),
      q1 = P(...p1),
      q2 = P(...p2),
      qn = P(p0[0] + n[0], p0[1] + n[1], p0[2] + n[2]);
    const facing = qn[2] - q0[2];
    faces.push({ img, sx, sy, sw, sh, q0, q1, q2, d: (q1[2] + q2[2]) / 2, facing });
  };
  const K = T.K,
    sxp = (x) => (x - T.sx0) * K,
    syp = (y) => (T.sy1 - y) * K;
  const zw = D.zw;
  // sides: cab part and chassis part (same texture, split at the cab back so they sort separately)
  for (const z of [-zw, zw]) {
    const img = z < 0 ? T.sideL : T.sideR,
      n = [0, 0, Math.sign(z)];
    const yt = T.sy1;
    add(img, sxp(T.sx0), 0, sxp(D.xc) - sxp(T.sx0), syp(-0.1), [T.sx0, yt, z], [D.xc, yt, z], [T.sx0, -0.1, z], n);
    add(img, sxp(D.xc), 0, sxp(1.7) - sxp(D.xc), syp(-0.1), [D.xc, yt, z], [1.7, yt, z], [D.xc, -0.1, z], n);
  }
  // front face (x = x0): texture u = z from -zx..zx (viewer facing the front sees +z on their left? mapped geometrically)
  const F = T.F;
  add(T.front, 0, 0, F.c.width, F.c.height, [D.x0, F.Ht / F.K, F.zx], [D.x0, F.Ht / F.K, -F.zx], [D.x0, 0, F.zx], [-1, 0, 0]);
  // cab back (x = xc) and chassis rear (x = x1)
  const B = T.B;
  add(T.back, 0, 0, B.cab.width, B.cab.height, [D.xc, B.Ht / B.K, -B.zx], [D.xc, B.Ht / B.K, B.zx], [D.xc, 0, -B.zx], [1, 0, 0]);
  add(T.rear, 0, 0, B.rear.width, B.rear.height, [D.x1, B.Ht2 / B.K, -B.zx], [D.x1, B.Ht2 / B.K, B.zx], [D.x1, 0, -B.zx], [1, 0, 0]);
  // tops from the in-game art: art x = across (+ = right), art y = along (+ = back), origin rear axle
  const A = T.A,
    S = T.S,
    ax = (z) => A.ox + z * S,
    ay = (x) => A.oy + x * S,
    zA = A.W / 2 / S;
  const xa0 = (0 - A.oy) / S,
    xa1 = (A.H - A.oy) / S;
  add(T.top, 0, 0, A.W, ay(D.xc), [xa0, D.roofH, -zA], [xa0, D.roofH, zA], [D.xc, D.top, -zA], [0, 1, 0]); // sloped to follow the spoiler
  add(T.top, 0, ay(D.xc), A.W, A.H - ay(D.xc), [D.xc, D.chH, -zA], [D.xc, D.chH, zA], [xa1, D.chH, -zA], [0, 1, 0]);
  // painter: far faces first; back-facing side/front faces are still drawn (they show through cut-outs) but first
  faces.sort((a, b) => (a.facing > 0) - (b.facing > 0) || a.d - b.d);
  for (const f of faces) {
    if (f.facing <= 0 && f.img !== T.sideL && f.img !== T.sideR) continue;
    g.save();
    g.globalAlpha = f.facing <= 0 ? 0.9 : 1;
    g.transform(
      (f.q1[0] - f.q0[0]) / f.sw,
      (f.q1[1] - f.q0[1]) / f.sw,
      (f.q2[0] - f.q0[0]) / f.sh,
      (f.q2[1] - f.q0[1]) / f.sh,
      f.q0[0],
      f.q0[1],
    );
    g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    g.restore();
  }
}
// ---- garage showroom turntable (dealer / garage screen) ----
const TTS = { ang: 0.6, drag: null, raf: 0, spin: 0.35 };
function ttShowroom(cv, getTruck) {
  cancelAnimationFrame(TTS.raf);
  const g = cv.getContext("2d");
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", (e) => {
    TTS.drag = { x: e.clientX, a: TTS.ang };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (TTS.drag) TTS.ang = TTS.drag.a + (e.clientX - TTS.drag.x) * 0.012;
  });
  cv.addEventListener("pointerup", () => (TTS.drag = null));
  let last = performance.now();
  const loop = (now) => {
    if (!cv.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let rx = 0;
    for (const p of pads) if (p && Math.abs(p.axes[2] || 0) > 0.2) rx = p.axes[2];
    if (rx) TTS.ang += rx * dt * 2.5;
    else if (!TTS.drag) TTS.ang += TTS.spin * dt;
    const r = cv.getBoundingClientRect(),
      dpr = Math.min(2, window.devicePixelRatio || 1),
      W = Math.max(50, Math.round(r.width * dpr)),
      H = Math.max(50, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    g.clearRect(0, 0, W, H);
    const t = getTruck();
    if (t) {
      const k = Math.min(W / 9.5, H / 6.4);
      g.save();
      g.translate(W / 2, H * 0.74);
      g.scale(1, 0.26);
      const tg = g.createRadialGradient(0, 0, 10, 0, 0, k * 5);
      tg.addColorStop(0, "rgba(90,110,140,.5)");
      tg.addColorStop(1, "rgba(21,27,38,0)");
      g.fillStyle = tg;
      g.beginPath();
      g.arc(0, 0, k * 5, 0, 7);
      g.fill();
      g.restore();
      ttDraw(g, W / 2, H * 0.74, k, TTS.ang, 0.26, t.m, t.col, t.fit);
    }
    TTS.raf = requestAnimationFrame(loop);
  };
  TTS.raf = requestAnimationFrame(loop);
}
addEventListener("keydown", (e) => {
  if (typeof career === "undefined" || career.uiOpen !== "dealer") return;
  if (e.code === "KeyZ" || e.code === "KeyX") TTS.ang += e.code === "KeyX" ? 0.25 : -0.25;
});
