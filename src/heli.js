/**
 * @file heli.js — HELICOPTERS: real world entities flying missions between Sandvale Military Base and helipads around the map
 *   (hospital + police roofs, Albion Airport, the docks). Take-off -> cruise at altitude (ground shadow) -> landing -> wait -> next mission.
 * Exposes (globals): HL, hlPads, hlUpdate, hlDrawPads, hlDrawHigh, hlDrawNight, hlDrawMap
 * Depends on: milbase.js (MB_HP, mbHeliBody, mbDrawHeli), services.js (SVC), world.js, daynight.js (DN, dnLight), audio.js (audio, audioLoop)
 * Load order: after milbase.js in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 * Airborne: never in traffic.vs, so no collisions with ground traffic. Pads are derived from world data at runtime (no map-data change).
 */
"use strict";
const HL = { pads: null, hs: [], snd: null, N: 4, err: null };
const HL_CRUISE = 48; // m/s (about 107 mph)
const HL_UP = 11,
  HL_DOWN = 13; // seconds for take-off / landing
// find the nearest clear 8x8-tile spot (no road, water or solid tiles) to (tx,ty) within R tiles
function hlClearSpot(tx, ty, R) {
  const bad = new Set([T.ROAD, T.BRIDGE, T.WATER, T.BLDG, T.TREE, T.CONT, T.TANK, T.PUMP, T.HEDGE]);
  const ok = (cx, cy) => {
    for (let y = cy - 4; y < cy + 4; y++)
      for (let x = cx - 4; x < cx + 4; x++) if (!inb(x, y) || bad.has(G[idx(x, y)])) return false;
    return true;
  };
  for (let r = 0; r <= R; r += 2)
    for (let a = 0; a < 16; a++) {
      const x = Math.round(tx + Math.cos((a / 16) * 6.283) * r),
        y = Math.round(ty + Math.sin((a / 16) * 6.283) * r);
      if (ok(x, y)) return [x, y];
      if (!r) break;
    }
  return null;
}
function hlPads() {
  if (HL.pads) return HL.pads;
  const P = [],
    T_ = TILE;
  MB_HP.forEach(([x, y], i) =>
    P.push({ name: "Sandvale Military Base " + (i + 1), x: x * T_, y: y * T_, base: 1, r: 6.2 }),
  );
  // hospitals already paint a rooftop helipad (services.js s.helipad, metres): land on that one; others get a roof pad drawn here
  const roof = (s) =>
    s &&
    P.push(
      s.helipad
        ? {
            name: s.name,
            x: s.helipad.x * PPM,
            y: s.helipad.y * PPM,
            roof: 1,
            own: 1,
            r: s.helipad.r / M_T,
          }
        : { name: s.name, x: (s.tx + s.w / 2) * T_, y: (s.ty + s.h * 0.42) * T_, roof: 1, r: 3.4 },
    );
  const H = (SVC && SVC.byType && SVC.byType.hospital) || [],
    PO = (SVC && SVC.byType && SVC.byType.police) || [];
  for (const n of [
    "Albion General Hospital",
    "Sandvale General Hospital",
    "Kingsbridge Community Hospital",
  ])
    roof(H.find((s) => s.name === n));
  for (const n of ["Albion North Police Station", "Sandvale North Police Station"])
    roof(PO.find((s) => s.name === n));
  const ground = (tx, ty, name) => {
    const s = hlClearSpot(tx, ty, 40);
    if (s) P.push({ name, x: (s[0] + 0.5) * T_, y: (s[1] + 0.5) * T_, r: 3.6 });
  };
  ground(300, 600, "Albion Airport helipad");
  if (world.port) ground(world.port.quayX - 8, world.port.y0 + 6, "Port Albion helipad");
  ground(1640, 1820, "Kingsbridge Harbour helipad");
  for (const p of P) p.busy = null;
  HL.pads = P;
  return P;
}
function hlNew(k, pad, wait) {
  const p = hlPads()[pad];
  p.busy = 1;
  return {
    k,
    x: p.x,
    y: p.y,
    h: 0,
    alt: 0,
    rot: 0,
    st: "park",
    t: wait,
    pad,
    dst: -1,
    v: 0,
    sx: 0,
    sy: 0,
  };
}
function hlPick(H) {
  const P = hlPads(),
    fromBase = P[H.pad].base,
    c = [];
  P.forEach((p, i) => {
    if (i !== H.pad && !p.busy && !!p.base !== !!fromBase) c.push(i);
  });
  if (!c.length) P.forEach((p, i) => i !== H.pad && !p.busy && c.push(i));
  return c.length ? c[(Math.random() * c.length) | 0] : -1;
}
const hlSS = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function hlUpdate(dt) {
  if (!world.ready || !world.milbase) return;
  try {
    const P = hlPads();
    if (!HL.hs.length) {
      HL.hs = [hlNew("wildcat", 0, 6), hlNew("chinook", 2, 28), hlNew("wildcat", 4, 50)];
      const rem = P.findIndex((p) => !p.base);
      if (rem >= 0) HL.hs.push(hlNew("wildcat", rem, 15));
    }
    const ppm = PPM;
    for (const H of HL.hs) {
      H.t -= dt;
      if (H.st === "park") {
        H.alt = 0;
        H.rot = H.t < 8 ? Math.min(1, H.rot + dt / 6) : Math.max(0, H.rot - dt / 10);
        if (H.t <= 0) {
          const d = hlPick(H);
          if (d < 0) {
            H.t = 10;
            continue;
          }
          H.dst = d;
          P[d].busy = 1;
          H.st = "up";
          H.t = HL_UP;
          H.v = 0;
        }
      } else if (H.st === "up") {
        const f = 1 - H.t / HL_UP,
          D = P[H.dst],
          want = Math.atan2(D.x - H.x, -(D.y - H.y));
        H.rot = 1;
        H.alt = hlSS(f);
        if (f > 0.25)
          H.h += Math.max(
            -0.7 * dt,
            Math.min(0.7 * dt, Math.atan2(Math.sin(want - H.h), Math.cos(want - H.h))),
          );
        H.v = HL_CRUISE * hlSS((f - 0.35) / 0.65) * 0.6;
        if (H.t <= 0) {
          P[H.pad].busy = null;
          H.st = "cruise";
        }
      } else if (H.st === "cruise") {
        const D = P[H.dst],
          dx = D.x - H.x,
          dy = D.y - H.y,
          dist = Math.hypot(dx, dy) / ppm,
          want = Math.atan2(dx, -dy),
          e = Math.atan2(Math.sin(want - H.h), Math.cos(want - H.h));
        H.h += Math.max(-0.5 * dt, Math.min(0.5 * dt, e));
        H.alt = 1;
        H.v += (Math.min(HL_CRUISE, dist * 0.35 + 8) - H.v) * Math.min(1, dt * 0.6);
        if (dist < 70) {
          H.st = "down";
          H.t = HL_DOWN;
          H.sx = H.x;
          H.sy = H.y;
        }
      } else if (H.st === "down") {
        const D = P[H.dst],
          f = 1 - H.t / HL_DOWN,
          m = hlSS(Math.min(1, f / 0.7));
        H.x = H.sx + (D.x - H.sx) * m;
        H.y = H.sy + (D.y - H.sy) * m;
        H.alt = 1 - hlSS(f);
        H.v = 0;
        if (H.t <= 0) {
          H.x = D.x;
          H.y = D.y;
          H.alt = 0;
          H.pad = H.dst;
          H.dst = -1;
          H.st = "park";
          H.t = 25 + Math.random() * 35;
        }
        continue;
      }
      H.x += Math.sin(H.h) * H.v * ppm * dt;
      H.y -= Math.cos(H.h) * H.v * ppm * dt;
    }
    hlAudio();
  } catch (e) {
    if (!HL.err) console.warn("heli", e);
    HL.err = e;
  }
}
// rotor sound: filtered noise chopped by an LFO (blade slap), volume from the nearest turning rotor
function hlAudio() {
  if (typeof audio === "undefined" || !audio.ctx || !audio.master || !audio.noise) return;
  const ac = audio.ctx;
  if (!HL.snd) {
    const n = audioLoop(160, 0.7, "lowpass"),
      lfo = ac.createOscillator(),
      lg = ac.createGain(),
      am = ac.createGain();
    n.g.disconnect();
    n.g.connect(am);
    am.connect(audio.master);
    am.gain.value = 0.5;
    lfo.frequency.value = 17;
    lg.gain.value = 0.45;
    lfo.connect(lg);
    lg.connect(am.gain);
    lfo.start();
    HL.snd = { n, lfo };
  }
  let v = 0,
    rate = 17;
  for (const H of HL.hs) {
    if (H.rot < 0.05) continue;
    const d = Math.hypot(H.x / PPM - truck.x, H.y / PPM - truck.y),
      k = (H.rot * 0.55) / (1 + (d / 60) ** 2);
    if (k > v) {
      v = k;
      rate = (H.k === "chinook" ? 12 : 18) * (0.6 + 0.4 * H.rot);
    }
  }
  const t = ac.currentTime;
  HL.snd.n.g.gain.setTargetAtTime(Math.min(0.5, v), t, 0.2);
  HL.snd.lfo.frequency.setTargetAtTime(rate, t, 0.3);
}
function hlState(H) {
  return { x: H.x, y: H.y, alt: H.alt, h: H.h, rot: H.rot };
}
const hlOn = (x, y, vx0, vy0, vx1, vy1, m) =>
  x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
// pads: on the ground / on the roof (drawn above the chunk art)
function hlDrawPads(vx0, vy0, vx1, vy1) {
  if (!world.milbase) return;
  const g = ctx,
    T_ = TILE;
  for (const p of hlPads()) {
    if (p.base || p.own || !hlOn(p.x, p.y, vx0, vy0, vx1, vy1, 200)) continue;
    const R = p.r * T_;
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.arc(p.x + 3, p.y + 4, R + 4, 0, 7);
    g.fill();
    g.fillStyle = p.roof ? "#3d6e3f" : "#5a5c5a";
    g.beginPath();
    g.arc(p.x, p.y, R, 0, 7);
    g.fill();
    g.strokeStyle = "#f5f5f0";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(p.x, p.y, R - 9, 0, 7);
    g.stroke();
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(p.x, p.y, R - 2, 0, 7);
    g.stroke();
    g.fillStyle = "#f5f5f0";
    g.font = "bold " + Math.round(R * 1.1) + "px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("H", p.x, p.y + 2);
  }
}
function hlDrawHigh(vx0, vy0, vx1, vy1) {
  for (const H of HL.hs)
    if (hlOn(H.x, H.y, vx0, vy0, vx1, vy1, 260)) mbDrawHeli(ctx, hlState(H), H.k, timeS);
}
// night: pad edge lights, nav lights (red port / green starboard / white tail), anti-collision strobe, landing light pool
function hlDrawNight(vx0, vy0, vx1, vy1) {
  if (DN.dark < 0.05) return;
  const g = ctx,
    k = DN.dark,
    T_ = TILE,
    t = timeS;
  g.save();
  g.globalCompositeOperation = "lighter";
  const dot = (x, y, r, c) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  };
  for (const p of hlPads()) {
    if (p.base || !hlOn(p.x, p.y, vx0, vy0, vx1, vy1, 100)) continue;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * 6.283;
      dot(
        p.x + Math.cos(a) * p.r * T_,
        p.y + Math.sin(a) * p.r * T_,
        9,
        "rgba(90,255,120," + 0.9 * k + ")",
      );
    }
  }
  for (const H of HL.hs) {
    if (!hlOn(H.x, H.y, vx0, vy0, vx1, vy1, 300)) continue;
    const sc = 1 + H.alt * 0.35,
      c = Math.cos(H.h),
      s = Math.sin(H.h),
      P = (fx, fy) => [H.x + (fx * c - fy * s) * PPM * sc, H.y + (fx * s + fy * c) * PPM * sc]; // fx right, fy back (m)
    const L = P(-1.6, -1),
      R = P(1.6, -1),
      Tl = P(0, H.k === "chinook" ? 7.5 : 6.4);
    dot(L[0], L[1], 14, "rgba(255,40,40," + k + ")");
    dot(R[0], R[1], 14, "rgba(40,255,90," + k + ")");
    dot(Tl[0], Tl[1], 12, "rgba(255,255,255," + 0.9 * k + ")");
    if ((t * 1.1 + H.x * 0.001) % 1 < 0.08) dot(H.x, H.y, 46, "rgba(255,255,255," + k + ")");
    if ((t * 1.1 + 0.5 + H.x * 0.001) % 1 < 0.08) dot(H.x, H.y, 30, "rgba(255,40,40," + k + ")");
    if (H.alt > 0.02 && H.alt < 0.98) {
      const gx = H.x + H.alt * 42,
        gy = H.y + H.alt * 70;
      dot(gx, gy, 150, "rgba(255,255,225," + 0.35 * k + ")");
    }
  }
  g.restore();
}
// minimap + big map: pads as small H, helicopters as a heading arrow (fx/fy map metres -> screen)
function hlDrawMap(fx, fy, big) {
  if (!world.milbase || !HL.pads) return;
  const g = ctx;
  g.save();
  if (big) {
    g.font = "bold 10px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const p of HL.pads) {
      if (p.base) continue;
      const x = fx(p.x / PPM),
        y = fy(p.y / PPM);
      g.fillStyle = "rgba(20,40,24,0.85)";
      g.beginPath();
      g.arc(x, y, 6.5, 0, 7);
      g.fill();
      g.fillStyle = "#ffd23f";
      g.fillText("H", x, y + 0.5);
    }
  }
  for (const H of HL.hs) {
    const x = fx(H.x / PPM),
      y = fy(H.y / PPM);
    g.save();
    g.translate(x, y);
    g.rotate(H.h);
    g.fillStyle = H.alt > 0.05 ? "#9dff6a" : "#5f8a48";
    g.strokeStyle = "#102010";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 4);
    g.lineTo(0, 2);
    g.lineTo(-4.5, 4);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();
}
