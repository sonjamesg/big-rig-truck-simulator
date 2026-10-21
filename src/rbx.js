/**
 * @file rbx.js — ROUNDABOUTS: 4-lane spiral markings, signalised entries (stop line, nearside + island heads), clean lit island
 * Exposes (globals): RBSIG, rbArmKey, rbSigState, rbMouths, rbLaneLines, rbIsland, rbSigHeads
 * Depends on: world.js, traffic.js, repair.js
 * Load order: #47 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v31 ROUNDABOUTS: 3-lane spiral markings, signalised entries, landscaped lit island =====================
// Entries are signal-controlled in turn (like big UK roundabouts): each arm gets ~9 s green, amber, then a short all-red; the give-way
// check still runs on green so nothing pulls out into circulating traffic. Circulating traffic is never held (no stop lines on the circle).
const RBSIG = { on: true, G: 13, A: 2, R: 1.5 };
function rbArmKey(a) {
  return a.seg + ":" + a.side;
}
function rbSigState(rb, key) {
  if (!RBSIG.on) return "g";
  const n = rb.arms.length,
    P = RBSIG.G + RBSIG.A + RBSIG.R,
    k = rb.arms.findIndex((a) => rbArmKey(a) === key);
  if (k < 0) return "g";
  const t = (timeS + rb.id * 7.3) % (n * P),
    cur = Math.floor(t / P),
    u = t - cur * P;
  if (cur !== k) return cur === (k + n - 1) % n && u >= P - 0.01 ? "ra" : "r";
  return u < RBSIG.G ? "g" : u < RBSIG.G + RBSIG.A ? "a" : "r";
}
// 3 circulating lanes: two dashed dividers that spiral out to the outer edge just before each exit (UK spiral marking), broken across arm mouths
function rbMouths(rb, G2) {
  const ang = (p) => Math.atan2(p[1] - rb.cy, p[0] - rb.cx),
    M = [];
  for (const gm of G2) {
    const fe = gm.fil.find((q) => q.sd < 0),
      fn = gm.fil.find((q) => q.sd > 0);
    if (!fe || !fn) continue;
    let a0 = ang(rbW(gm, rb, fe.tr[0], fe.tr[1])),
      a1 = ang(rbW(gm, rb, fn.tr[0], fn.tr[1]));
    let da = a1 - a0;
    while (da < 0) da += Math.PI * 2;
    if (da > Math.PI) {
      const t = a0;
      a0 = a1;
      a1 = t;
      da = Math.PI * 2 - da;
    }
    M.push({ a0, a1: a0 + da });
  }
  return M;
}
function rbLaneLines(g, rb, G2, X, Y, S) {
  const M = rbMouths(rb, G2),
    w = rb.rout - rb.rin,
    rs = [rb.rin + w / 4, rb.rin + w / 2, rb.rin + (3 * w) / 4], // v63: 4 circulating lanes
    inM = (a) =>
      M.some((m) => {
        let d = a - m.a0;
        while (d < 0) d += Math.PI * 2;
        return d < m.a1 - m.a0;
      });
  g.save();
  g.strokeStyle = "#ececec";
  g.lineWidth = 2.4;
  const st = 0.02;
  for (const r0 of rs) {
    const pts = [];
    let on = true;
    for (let a = 0; a < Math.PI * 2 + st; a += st) {
      let r = r0; // ramp outward over the 0.55 rad before each mouth (clockwise = increasing angle)
      let sp = 0;
      for (const m of M) {
        let d = m.a0 - a;
        while (d < 0) d += Math.PI * 2;
        if (d < 0.55) sp = Math.max(sp, 1 - d / 0.55);
      }
      r = r0 + (rb.rout - 0.35 - r0) * sp * sp;
      if (inM(a)) {
        pts.push(null);
        continue;
      }
      pts.push([X + Math.cos(a) * r * S, Y + Math.sin(a) * r * S]);
    }
    let seg = 0;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!p) {
        seg = 0;
        continue;
      }
      const dash = (((i * st * r0 * S) / 16) | 0) % 2 === 0;
      if (!dash) {
        seg = 0;
        continue;
      }
      if (!seg) {
        g.moveTo(p[0], p[1]);
        seg = 1;
      } else g.lineTo(p[0], p[1]);
    }
    g.stroke();
  }
  // lane arrows on the circulatory: clockwise chevrons in each lane mid-way between arms
  g.fillStyle = "rgba(236,236,236,0.9)";
  for (let k = 0; k < M.length; k++) {
    const m = M[k],
      n = M[(k + 1) % M.length];
    let d = n.a0 - m.a1;
    while (d < 0) d += Math.PI * 2;
    const a = m.a1 + d * 0.45;
    for (const r of [
      rb.rin + w / 8,
      rb.rin + (3 * w) / 8,
      rb.rin + (5 * w) / 8,
      rb.rin + (7 * w) / 8,
    ]) {
      const x = X + Math.cos(a) * r * S,
        y = Y + Math.sin(a) * r * S;
      g.save();
      g.translate(x, y);
      g.rotate(a + Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(7, 0);
      g.lineTo(0, 9);
      g.lineTo(0, 4);
      g.lineTo(-10, 4);
      g.lineTo(-10, -4);
      g.lineTo(0, -4);
      g.closePath();
      g.fill();
      g.restore();
    }
  }
  g.restore();
}
// landscaped central island: low kerb wall, clipped hedge ring, flower beds, specimen trees placed by the caller
function rbIsland(g, rb, X, Y, S, seed) {
  const R = rb.rin * S;
  g.save();
  g.strokeStyle = "#5f8f3a";
  g.lineWidth = S * 0.55;
  g.beginPath();
  g.arc(X, Y, R - S * 0.75, 0, 7);
  g.stroke();
  g.strokeStyle = "rgba(30,60,20,0.35)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(X, Y, R - S * 1.05, 0, 7);
  g.stroke();
  // v51: clean island: hedge ring + small centre planter only (no flower beds / trees)
  g.fillStyle = "#a49c8a";
  g.beginPath();
  g.arc(X, Y, S * 0.7, 0, 7);
  g.fill();
  g.fillStyle = "#d8d2c2";
  g.beginPath();
  g.arc(X, Y, S * 0.5, 0, 7);
  g.fill();
  g.restore();
}
// signal heads at every entry (dynamic: drawn each frame over the baked roundabout)
function rbSigHeads(vx0, vy0, vx1, vy1) {
  if (!RBSIG.on) return;
  for (const rb of world.rbs || []) {
    const X = rb.cx * TILE,
      Y = rb.cy * TILE,
      E = (rb.rout + 8) * TILE;
    if (X + E < vx0 || X - E > vx1 || Y + E < vy0 || Y - E > vy1) continue;
    for (const a of rb.arms) {
      const gm = rbArmGeom(rb, a),
        st = rbSigState(rb, rbArmKey(a));
      // v63: primary on the nearside verge at the stop line, secondary on the central island facing the entry
      const ve = gm.c + gm.hw / 2,
        ri = rb.rin - 0.7,
        p = rbW(gm, rb, rb.rout + 1.1, gm.c + gm.hw + 0.45),
        q = rbW(gm, rb, Math.sqrt(Math.max(0, ri * ri - ve * ve)), ve);
      for (const pt of [p, q]) {
        const x = pt[0] * TILE,
          y = pt[1] * TILE,
          h = Math.atan2(gm.o[1], gm.o[0]);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(h + Math.PI / 2);
        ctx.fillStyle = "#111";
        ctx.strokeStyle = "#e0b000";
        ctx.lineWidth = 2;
        ctx.fillRect(-7, -17, 14, 34);
        ctx.strokeRect(-7, -17, 14, 34);
        const L = [
          ["r", -10, "#ff3030"],
          ["a", 0, "#ffb000"],
          ["g", 10, "#30e060"],
        ];
        for (const [k, yy, c] of L) {
          const lit = st === k || (st === "ra" && (k === "r" || k === "a"));
          ctx.fillStyle = lit ? c : "#2a2a2a";
          ctx.beginPath();
          ctx.arc(0, yy, 4.2, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}
// island uplights + extra column lamps at night
setTimeout(() => {
  const sl = typeof siteLights === "function" ? siteLights : null;
  siteLights = function (add) {
    if (sl) sl.apply(this, arguments);
    for (const rb of world.rbs || []) {
      const X = rb.cx * TILE,
        Y = rb.cy * TILE;
      add(X, Y, rb.rin * TILE * 1.1, "fl");
      for (let q = 0; q < 4; q++) {
        const a = (q * Math.PI) / 2 + 0.78;
        add(
          X + Math.cos(a) * (rb.rout + 1.2) * TILE,
          Y + Math.sin(a) * (rb.rout + 1.2) * TILE,
          150,
          "fl",
        );
      }
    }
  };
  const dt0 = drawTraffic;
  drawTraffic = function (vx0, vy0, vx1, vy1) {
    const r = dt0.apply(this, arguments);
    try {
      rbSigHeads(vx0, vy0, vx1, vy1);
    } catch (e) {}
    return r;
  };
}, 0);
