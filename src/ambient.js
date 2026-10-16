/**
 * @file ambient.js — AMBIENT LIFE (cheap, culled to the view)
 * Exposes (globals): amb, inView, boatPos, updateAmbient, drawWaterFx, BOAT, drawBoat,
 *   drawAnimal, drawCropWind, drawAmbientLow, drawPlane, planeShape, drawPlanes, drawAmbientHigh
 * Depends on: world.js, career.js, daynight.js
 * Load order: #17 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== AMBIENT LIFE (cheap, culled to the view) =====================
const amb = { birds: [], r: mulberry(777), wind: [0.82, 0.57] };
function inView(x, y, m, v) {
  return x > v[0] - m && x < v[2] + m && y > v[1] - m && y < v[3] + m;
}
function boatPos(b) {
  const L = b.L;
  let u = b.s % (2 * L),
    rev = false;
  if (u > L) {
    u = 2 * L - u;
    rev = true;
  }
  const d = b.d;
  let lo = 0,
    hi = d.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (d[m] <= u) lo = m;
    else hi = m;
  }
  const t = (u - d[lo]) / (d[hi] - d[lo] || 1),
    p = b.pts[lo],
    q = b.pts[hi];
  const x = p[0] + (q[0] - p[0]) * t,
    y = p[1] + (q[1] - p[1]) * t;
  let h = Math.atan2(q[0] - p[0], -(q[1] - p[1]));
  if (rev) h += Math.PI;
  return [x, y, h];
}
function updateAmbient(dt, v) {
  for (const b of world.boats) b.s += b.v * dt;
  // livestock wander (only near the view)
  for (const a of world.animals) {
    if (!inView(a.x, a.y, 300, v)) continue;
    a.t -= dt;
    if (a.t < 0) {
      a.t = 2 + amb.r() * 6;
      a.mv = amb.r() < 0.45;
      a.th = a.h + (amb.r() - 0.5) * 2.5;
    }
    a.h += (a.th - a.h) * Math.min(1, dt * 1.5);
    if (a.mv) {
      const s = (a.kind === "cow" ? 3 : 4) * dt;
      a.x += Math.sin(a.h) * s;
      a.y -= Math.cos(a.h) * s;
      if (a.x < a.x0 || a.x > a.x1 || a.y < a.y0 || a.y > a.y1) {
        a.x = Math.max(a.x0, Math.min(a.x1, a.x));
        a.y = Math.max(a.y0, Math.min(a.y1, a.y));
        a.th = a.h + Math.PI;
      }
    }
  }
  // bird flocks drift over the view; respawn at the edge when they leave
  const cx = (v[0] + v[2]) / 2,
    cy = (v[1] + v[3]) / 2,
    span = Math.max(v[2] - v[0], v[3] - v[1]);
  amb.birdT = (amb.birdT || 0) - dt;
  while (amb.birds.length < 1 && amb.birdT <= 0) {
    amb.birdT = 6 + amb.r() * 10;
    const a = amb.r() * 6.28,
      n = 3 + ((amb.r() * 3) | 0);
    amb.birds.push({
      x: cx - Math.cos(a) * span * 0.9,
      y: cy - Math.sin(a) * span * 0.9,
      h: Math.atan2(Math.cos(a), -Math.sin(a)) + (amb.r() - 0.5) * 0.6,
      n,
      sp: 70 + amb.r() * 40,
      ph: amb.r() * 6,
      gull: amb.r() < 0.5,
    });
  }
  for (let i = amb.birds.length - 1; i >= 0; i--) {
    const f = amb.birds[i];
    f.h += Math.sin(timeS * 0.2 + f.ph) * 0.08 * dt;
    f.x += Math.sin(f.h) * f.sp * dt;
    f.y -= Math.cos(f.h) * f.sp * dt;
    if (Math.hypot(f.x - cx, f.y - cy) > span * 1.3) amb.birds.splice(i, 1);
  }
}
function drawWaterFx(v) {
  const t = timeS,
    x0 = Math.max(0, Math.floor(v[0] / TILE)),
    x1 = Math.min(MW - 1, Math.ceil(v[2] / TILE)),
    y0 = Math.max(0, Math.floor(v[1] / TILE)),
    y1 = Math.min(MH - 1, Math.ceil(v[3] / TILE));
  if ((x1 - x0) * (y1 - y0) > 9000) return;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(225,240,255,0.32)";
  ctx.beginPath();
  const foam = [];
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const g = G[ty * MW + tx];
      if (g !== T.WATER) continue;
      const h = hash2(tx, ty);
      if (h < 0.22) {
        const px = tx * TILE + ((h * 100) % 26) + Math.sin(t * 1.1 + h * 40) * 5,
          py = ty * TILE + ((h * 731) % 28) + Math.cos(t * 0.9 + h * 17) * 2;
        const k = (Math.sin(t * 1.6 + h * 50) + 1) * 0.5;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 4 + k * 3, py - 2 - k * 2, px + 9 + k * 4, py);
      }
      const L = (u) => u !== T.WATER && u !== T.BRIDGE;
      if (L(get(tx, ty - 1)) || L(get(tx, ty + 1)) || L(get(tx - 1, ty)) || L(get(tx + 1, ty)))
        foam.push(tx, ty);
    }
  ctx.stroke();
  for (let i = 0; i < foam.length; i += 2) {
    const tx = foam[i],
      ty = foam[i + 1],
      a = 0.18 + 0.22 * (Math.sin(t * 1.8 + tx * 0.7 + ty * 0.5) + 1) * 0.5;
    ctx.fillStyle = "rgba(240,250,255," + a.toFixed(2) + ")";
    const s = 3 + 2.5 * Math.sin(t * 1.8 + tx * 0.7 + ty * 0.5);
    const px = tx * TILE,
      py = ty * TILE;
    const L = (u) => u !== T.WATER && u !== T.BRIDGE;
    if (L(get(tx, ty - 1))) ctx.fillRect(px, py + 2, 32, s);
    if (L(get(tx, ty + 1))) ctx.fillRect(px, py + 30 - s, 32, s);
    if (L(get(tx - 1, ty))) ctx.fillRect(px + 2, py, s, 32);
    if (L(get(tx + 1, ty))) ctx.fillRect(px + 30 - s, py, s, 32);
  }
}
const BOAT = { ferry: [36, 9], cargo: [62, 11], yacht: [11, 3.6], barge: [26, 6], tug: [13, 5] };
function drawBoat(b, x, y, h) {
  const [Lm, Wm] = BOAT[b.kind],
    L = Lm * PPM,
    W = Wm * PPM;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h);
  // wake
  ctx.fillStyle = "rgba(235,245,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(-W * 0.45, L * 0.4);
  ctx.lineTo(-W * 1.6, L * 1.6);
  ctx.lineTo(-W * 0.9, L * 1.6);
  ctx.lineTo(0, L * 0.55);
  ctx.lineTo(W * 0.9, L * 1.6);
  ctx.lineTo(W * 1.6, L * 1.6);
  ctx.lineTo(W * 0.45, L * 0.4);
  ctx.fill();
  ctx.fillStyle = "rgba(0,20,40,0.3)";
  ctx.beginPath();
  ctx.ellipse(10, 10, W / 2, L / 2, 0, 0, 7);
  ctx.fill();
  const hull =
    b.kind === "cargo"
      ? "#7b2a22"
      : b.kind === "tug"
        ? "#c0392b"
        : b.kind === "barge"
          ? "#3d3f45"
          : "#f4f4f4";
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -L / 2);
  ctx.quadraticCurveTo(W / 2, -L / 2 + W * 0.6, W / 2, -L / 2 + W);
  ctx.lineTo(W / 2, L / 2 - 2);
  ctx.lineTo(-W / 2, L / 2 - 2);
  ctx.lineTo(-W / 2, -L / 2 + W);
  ctx.quadraticCurveTo(-W / 2, -L / 2 + W * 0.6, 0, -L / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (b.kind === "cargo") {
    const cs = ["#c0392b", "#2e86c1", "#e67e22", "#27ae60", "#d4ac0d", "#8e44ad"];
    for (let k = 0; k < 7; k++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = cs[(k * 3 + j + b.col.length) % 6];
        ctx.fillRect(
          -W / 2 + 4 + j * (W / 2 - 4),
          -L / 2 + W * 1.2 + k * (L * 0.09),
          W / 2 - 6,
          L * 0.08,
        );
      }
    ctx.fillStyle = "#ecf0f1";
    ctx.fillRect(-W / 2 + 3, L / 2 - L * 0.16, W - 6, L * 0.12);
  } else if (b.kind === "ferry") {
    ctx.fillStyle = "#d5dde5";
    ctx.fillRect(-W / 2 + 5, -L / 2 + W, W - 10, L - W - 12);
    ctx.fillStyle = b.col === "#ecf0f1" ? "#2471a3" : b.col;
    ctx.fillRect(-W / 2 + 5, -L / 2 + W + L * 0.3, W - 10, 10);
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(-6, -L / 2 + W + L * 0.15, 12, 16);
  } else if (b.kind === "yacht") {
    ctx.fillStyle = "#d9cfb8";
    ctx.fillRect(-W / 2 + 4, -L / 4, W - 8, L / 2.5);
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(0, -L / 2 + 6);
    ctx.lineTo(0, L / 3);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(1, -L / 2 + 8);
    ctx.lineTo(W * 0.9, L / 4);
    ctx.lineTo(1, L / 4);
    ctx.fill();
  } else if (b.kind === "barge") {
    ctx.fillStyle = "#8b6b3e";
    ctx.fillRect(-W / 2 + 4, -L / 2 + 8, W - 8, L * 0.7);
    ctx.fillStyle = "#ecf0f1";
    ctx.fillRect(-W / 2 + 4, L / 2 - L * 0.2, W - 8, L * 0.15);
  } else {
    ctx.fillStyle = "#ecf0f1";
    ctx.fillRect(-W / 2 + 4, -L / 6, W - 8, L / 3);
    ctx.fillStyle = "#222";
    ctx.fillRect(-3, -4, 6, 8);
  }
  ctx.restore();
}
function drawAnimal(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.h);
  const bob = a.mv ? Math.sin(timeS * 8 + a.c * 9) * 0.6 : 0;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(3, 3, a.kind === "cow" ? 7 : 5, a.kind === "cow" ? 12 : 8, 0, 0, 7);
  ctx.fill();
  if (a.kind === "sheep") {
    ctx.fillStyle = "#f2f0ea";
    ctx.beginPath();
    ctx.ellipse(0, bob, 5, 7.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.ellipse(0, -8 + bob, 2.6, 3.2, 0, 0, 7);
    ctx.fill();
  } else {
    const base = a.c < 0.5 ? "#f4f4f0" : a.c < 0.8 ? "#6b4a2f" : "#2a2a2a";
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(0, bob, 6.5, 11, 0, 0, 7);
    ctx.fill();
    if (a.c < 0.5) {
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.ellipse(-2, -2, 3, 4, 0.4, 0, 7);
      ctx.ellipse(3, 5, 2.5, 3, 0, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = a.c < 0.5 ? "#ddd" : "#3a2a1a";
    ctx.beginPath();
    ctx.ellipse(0, -12 + bob, 3.5, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#e8c9a8";
    ctx.fillRect(-2, -16 + bob, 4, 2);
  }
  ctx.restore();
}
function drawCropWind(v) {
  const t = timeS;
  for (const f of world.crops) {
    if (f.x > v[2] || f.x + f.w < v[0] || f.y > v[3] || f.y + f.h < v[1]) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    const per = f.w + f.h + 400;
    for (let k = 0; k < 2; k++) {
      const s = ((t * 55 + (f.seed % 997) + (k * per) / 2) % per) - 200;
      ctx.fillStyle = "rgba(255,250,210,0.16)";
      ctx.beginPath();
      ctx.moveTo(f.x + s, f.y);
      ctx.lineTo(f.x + s + 70, f.y);
      ctx.lineTo(f.x + s + 70 - f.h * 0.6, f.y + f.h);
      ctx.lineTo(f.x + s - f.h * 0.6, f.y + f.h);
      ctx.fill();
      ctx.fillStyle = "rgba(90,70,20,0.10)";
      ctx.beginPath();
      ctx.moveTo(f.x + s + 70, f.y);
      ctx.lineTo(f.x + s + 110, f.y);
      ctx.lineTo(f.x + s + 110 - f.h * 0.6, f.y + f.h);
      ctx.lineTo(f.x + s + 70 - f.h * 0.6, f.y + f.h);
      ctx.fill();
    }
    ctx.restore();
  }
}
function drawAmbientLow(v) {
  drawWaterFx(v);
  drawCropWind(v);
  for (const b of world.boats) {
    const [x, y, h] = boatPos(b);
    if (!inView(x, y, 600, v)) continue;
    if (DN.dark > 0.05) {
      const c = Math.cos(h),
        sn = Math.sin(h),
        L2 = (BOAT[b.kind][0] * PPM) / 2;
      dnLight(x + c * L2, y + sn * L2, 22, "rgba(255,255,230,0.9)", 0.9);
      dnLight(x - sn * 8, y + c * 8, 18, "rgba(40,255,90,0.9)", 0.8);
      dnLight(x + sn * 8, y - c * 8, 18, "rgba(255,40,40,0.9)", 0.8);
    }
    const L = (BOAT[b.kind][0] * PPM) / 2;
    let under = false;
    for (const k of [-1, 0, 1]) {
      if (
        get(
          Math.floor((x + Math.sin(h) * L * k) / TILE),
          Math.floor((y - Math.cos(h) * L * k) / TILE),
        ) === T.BRIDGE
      )
        under = true;
    }
    if (under) {
      b.hidden = true;
      continue;
    }
    b.hidden = false;
    drawBoat(b, x, y, h);
  }
  for (const a of world.animals) if (inView(a.x, a.y, 30, v)) drawAnimal(a);
}
function drawPlane(x, y, h, sc, alt, col) {
  const s = sc;
  ctx.save();
  ctx.translate(x + alt * 50, y + alt * 50);
  ctx.rotate(h);
  ctx.fillStyle = "rgba(10,15,25," + (0.35 - alt * 0.12) + ")";
  planeShape(s);
  ctx.restore();
  {
    const c = Math.cos(h),
      sn = Math.sin(h),
      wx = 26 * s;
    dnLight(x + c * wx, y + sn * wx, 26, "rgba(40,255,90,0.9)", 0.9);
    dnLight(x - c * wx, y - sn * wx, 26, "rgba(255,40,40,0.9)", 0.9);
    if ((timeS * 1.3) % 1 < 0.15) dnLight(x, y, 60, "rgba(255,255,255,0.9)", 1);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h);
  ctx.fillStyle = "#eef1f4";
  planeShape(s);
  ctx.fillStyle = col;
  ctx.fillRect(-2 * s, 14 * s, 4 * s, 10 * s);
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(-2.2 * s, -26 * s, 4.4 * s, 3 * s);
  if (Math.sin(timeS * 6) > 0.3) {
    ctx.fillStyle = "#ff3030";
    ctx.beginPath();
    ctx.arc(-24 * s, 2 * s, 2 * s, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#30ff60";
    ctx.beginPath();
    ctx.arc(24 * s, 2 * s, 2 * s, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}
function planeShape(s) {
  ctx.beginPath();
  ctx.moveTo(0, -30 * s);
  ctx.quadraticCurveTo(4 * s, -26 * s, 4 * s, -18 * s);
  ctx.lineTo(4 * s, -4 * s);
  ctx.lineTo(26 * s, 4 * s);
  ctx.lineTo(26 * s, 8 * s);
  ctx.lineTo(4 * s, 4 * s);
  ctx.lineTo(3 * s, 20 * s);
  ctx.lineTo(11 * s, 26 * s);
  ctx.lineTo(11 * s, 29 * s);
  ctx.lineTo(0, 27 * s);
  ctx.lineTo(-11 * s, 29 * s);
  ctx.lineTo(-11 * s, 26 * s);
  ctx.lineTo(-3 * s, 20 * s);
  ctx.lineTo(-4 * s, 4 * s);
  ctx.lineTo(-26 * s, 8 * s);
  ctx.lineTo(-26 * s, 4 * s);
  ctx.lineTo(-4 * s, -4 * s);
  ctx.lineTo(-4 * s, -18 * s);
  ctx.quadraticCurveTo(-4 * s, -26 * s, 0, -30 * s);
  ctx.fill();
}
function drawPlanes(v) {
  let n = 0;
  for (const ap of world.airports)
    for (const rw of ap.rw) {
      n++;
      if (ap.albion) continue;
      const len = rw.len,
        T0 = (timeS + n * 23) % 70,
        sc = (PPM * 1.25) / 1;
      let s,
        alt,
        dir = Math.PI / 2,
        x0 = rw.x,
        vis = true,
        col = ["#c0392b", "#2471a3", "#1e8449", "#d68910"][n % 4];
      if (T0 < 30) {
        const t = T0;
        s = t < 4 ? 60 * PPM : 60 * PPM + 0.5 * 3.2 * PPM * (t - 4) * (t - 4);
        alt = Math.max(0, (s - len * 0.55) / (len * 0.5));
        if (alt > 2.5) vis = false;
      } else if (T0 < 36) vis = false;
      else {
        const t = T0 - 36;
        const touch = 200 * PPM;
        if (t < 14) {
          s = touch - (14 - t) * 70 * PPM;
          alt = Math.max(0, (touch - s) / (len * 0.5));
        } else {
          const u = t - 14;
          s = touch + 70 * PPM * u - 0.5 * 3.0 * PPM * u * u;
          if (u > 23.3) s = touch + 70 * PPM * 23.3 - 0.5 * 3 * PPM * 23.3 * 23.3;
          alt = 0;
          if (t > 33) vis = false;
        }
      }
      if (!vis) continue;
      const x = x0 + s,
        y = rw.y;
      if (!inView(x, y, 800, v)) continue;
      drawPlane(x, y, dir, 4.2 * (1 + Math.min(1.5, alt) * 0.5), Math.min(2.5, alt), col);
    }
}
function drawAmbientHigh(v) {
  const t = timeS;
  // smoke from chimneys / industry
  for (const s of world.smokers) {
    if (!inView(s.x, s.y, 260, v)) continue;
    for (let k = 0; k < 7; k++) {
      const ph = (t * 0.22 + k / 7 + ((s.x * 0.001) % 1)) % 1;
      const d = ph * 150 * s.s;
      const x = s.x + amb.wind[0] * d + Math.sin(t * 0.8 + k * 1.7) * 6 * ph,
        y = s.y + amb.wind[1] * d * 0.6 - d * 0.35,
        r = (4 + ph * 16) * s.s;
      ctx.fillStyle = "rgba(210,210,215," + ((1 - ph) * 0.38).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
    }
  }
  // wind turbines
  for (const o of world.overhead) {
    if (o.kind !== "turbine" || !inView(o.x, o.y, 120, v)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(o.x + 40, o.y + 40, 5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#e8eaed";
    ctx.beginPath();
    ctx.arc(o.x, o.y, 6, 0, 7);
    ctx.fill();
    const a0 = t * 1.6 + o.ph;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * 2.094;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(a);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(30, 32, 5, -56);
      ctx.fillStyle = "#f6f7f8";
      ctx.beginPath();
      ctx.moveTo(-2.5, 0);
      ctx.lineTo(-1, -58);
      ctx.lineTo(1.5, -58);
      ctx.lineTo(3, 0);
      ctx.fill();
      ctx.restore();
    }
    if (Math.sin(t * 2.5 + o.ph) > 0.7) {
      ctx.fillStyle = "rgba(255,40,40,0.9)";
      ctx.beginPath();
      ctx.arc(o.x, o.y, 3, 0, 7);
      ctx.fill();
    }
  }
  // flags
  for (const f of world.flags) {
    if (!inView(f.x, f.y, 80, v)) continue;
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.5, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 1);
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      ctx.lineTo(
        f.x + amb.wind[0] * u * 30 - amb.wind[1] * Math.sin(t * 6 - u * 5) * 3 * u,
        f.y + amb.wind[1] * u * 30 + amb.wind[0] * Math.sin(t * 6 - u * 5) * 3 * u,
      );
    }
    for (let k = 6; k >= 0; k--) {
      const u = k / 6;
      ctx.lineTo(
        f.x + amb.wind[0] * u * 30 - amb.wind[1] * (Math.sin(t * 6 - u * 5) * 3 * u + 16),
        f.y + amb.wind[1] * u * 30 + amb.wind[0] * (Math.sin(t * 6 - u * 5) * 3 * u + 16),
      );
    }
    ctx.fillStyle = f.col;
    ctx.fill();
  }
  // blinking beacons (towers, runway approach lights)
  for (const b of world.beacons) {
    if (!inView(b.x, b.y, 20, v)) continue;
    const on = b.run
      ? (t * 3 + b.ph) % 1 < 0.25
      : b.warn
        ? Math.sin(t * 2.2) > -0.4
        : Math.sin(t * 3 + b.ph) > 0.55;
    if (!on) continue;
    if (b.warn && typeof dnLight === "function" && typeof DN !== "undefined" && DN.dark > 0.05)
      dnLight(b.x, b.y, 46, "rgba(255,30,30,1)", 0.9);
    ctx.fillStyle = b.col;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 9, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, 7);
    ctx.fill();
  }
  drawPlanes(v);
  // bird flocks (V formation, flapping), shadows on the ground
  for (const f of amb.birds) {
    if (!inView(f.x, f.y, 200, v)) continue;
    const fw = [Math.sin(f.h), -Math.cos(f.h)],
      rt = [Math.cos(f.h), Math.sin(f.h)];
    for (let i = 0; i < f.n; i++) {
      const row = Math.ceil(i / 2),
        side = i % 2 ? 1 : -1;
      const bx = f.x - fw[0] * row * 16 + rt[0] * side * row * 13,
        by = f.y - fw[1] * row * 16 + rt[1] * side * row * 13;
      const flap = Math.sin(t * (f.gull ? 7 : 11) + i * 1.3 + f.ph);
      for (const [ox, oy, col] of [
        [60, 60, "rgba(0,0,0,0.18)"],
        [0, 0, f.gull ? "#f4f4f4" : "#2a2a2a"],
      ]) {
        ctx.save();
        ctx.translate(bx + ox, by + oy);
        ctx.rotate(f.h);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, 1 + flap * 3);
        ctx.quadraticCurveTo(-3, -2, 0, 0);
        ctx.quadraticCurveTo(3, -2, 7, 1 + flap * 3);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}
